import type { CompanyInfo, ConciliacionResult, Totales } from "./types.ts";
import type { Review } from "./reviews.ts";
import { getStoredSession } from "./tributo-auth.ts";

export interface HistoryEntry {
  id: string;
  timestamp: number;
  company: CompanyInfo;
  periodLabel: string;
  dianName: string;
  movName: string;
  totals: Totales;
  result: ConciliacionResult;
  reviews?: Record<string, Review>;
}

const LEGACY_STORAGE_KEY = "conciliacion_dian_history_v1";

/**
 * Carga perezosa del módulo del servidor para evitar inicializaciones
 * en tiempo de prueba o SSR cuando el runtime de servidor de Vite no está presente.
 */
async function getHistoryServer() {
  if (typeof window === "undefined" || (globalThis as any).__TEST_ENV__) {
    return null;
  }
  try {
    return await import("./history-server.ts");
  } catch (err) {
    console.warn("[history-store] Conexión de servidor de historial no disponible:", err);
    return null;
  }
}

/**
 * Obtiene el identificador de usuario activo para aislamiento de sesiones.
 * Prioriza email, luego ID numérico de TributoApp, o 'invitado'.
 */
export function getActiveUserKey(overrideKey?: string): string {
  if (overrideKey && overrideKey.trim()) {
    return overrideKey.trim().toLowerCase();
  }

  if (typeof window !== "undefined") {
    try {
      const session = getStoredSession();
      if (session?.valid && session.user) {
        const u = session.user;
        if (u.email && typeof u.email === "string" && u.email.trim()) {
          return u.email.trim().toLowerCase();
        }
        if (u.id !== undefined && u.id !== null) {
          return String(u.id).trim().toLowerCase();
        }
      }
    } catch {}
  }

  return "invitado";
}

/**
 * Retorna la clave de localStorage aislada para un usuario específico.
 */
export function getScopedStorageKey(userKey?: string): string {
  const clean = (userKey || getActiveUserKey()).replace(/[^a-z0-9_.-]/g, "_");
  return `conciliacion_dian_history_${clean}`;
}

/**
 * Obtiene las entradas guardadas localmente para el usuario activo.
 * Si el usuario no tiene entradas aún pero existen sesiones previas en el almacén
 * legado global, las migra de forma transparente a su cuenta.
 */
export function getHistoryEntries(userKey?: string): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const key = getScopedStorageKey(userKey);

  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Si la partición del usuario está vacía, revisar si hay datos en la clave legacy
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacyParsed = JSON.parse(legacyRaw);
      if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
        localStorage.setItem(key, legacyRaw);
        return legacyParsed;
      }
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * Sincroniza el historial con la nube de forma asíncrona:
 * Consulta la base de datos (Postgres/Neon o PGLite), fusiona con los registros
 * locales más recientes, actualiza la memoria caché y retorna la lista unificada.
 */
export async function syncUserHistoryWithCloud(userKey?: string): Promise<HistoryEntry[]> {
  const activeUser = userKey || getActiveUserKey();
  const localEntries = getHistoryEntries(activeUser);

  try {
    const srv = await getHistoryServer();
    if (!srv) return localEntries;

    const cloudEntries = await srv.getUserHistoryServerFn({ data: { userId: activeUser } });

    if (!Array.isArray(cloudEntries)) {
      return localEntries;
    }

    // Fusionar cloud + local dando prioridad a la versión más reciente de cada sesión
    const map = new Map<string, HistoryEntry>();

    for (const e of cloudEntries) {
      map.set(e.id, e);
    }
    for (const e of localEntries) {
      const existing = map.get(e.id);
      if (!existing || e.timestamp >= existing.timestamp) {
        map.set(e.id, e);
      }
    }

    const merged = Array.from(map.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);

    if (typeof window !== "undefined") {
      const key = getScopedStorageKey(activeUser);
      localStorage.setItem(key, JSON.stringify(merged));
    }

    // Si había entradas locales que no estaban en la nube, sincronizarlas en background
    const cloudIdSet = new Set(cloudEntries.map((c) => c.id));
    const missingInCloud = localEntries.filter((l) => !cloudIdSet.has(l.id));
    if (missingInCloud.length > 0) {
      Promise.allSettled(
        missingInCloud.map((entry) =>
          srv.saveUserHistoryServerFn({
            data: {
              userId: activeUser,
              userEmail: activeUser.includes("@") ? activeUser : undefined,
              entry,
            },
          })
        )
      ).catch(() => {});
    }

    return merged;
  } catch (err) {
    console.warn("[history-store] No se pudo sincronizar con la nube (usando caché local):", err);
    return localEntries;
  }
}

/**
 * Guarda una sesión de conciliación localmente y la sincroniza en la base de datos en la nube.
 */
export function saveHistoryEntry(
  result: ConciliacionResult,
  dianName: string,
  movName: string,
  reviews?: Record<string, Review>,
  userKey?: string,
): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const activeUser = userKey || getActiveUserKey();
  const key = getScopedStorageKey(activeUser);

  try {
    const current = getHistoryEntries(activeUser);
    const id = `${result.company.nit || "EMP"}_${result.periodLabel || "PER"}_${Date.now()}`;
    const newEntry: HistoryEntry = {
      id,
      timestamp: Date.now(),
      company: result.company,
      periodLabel: result.periodLabel,
      dianName,
      movName,
      totals: result.totals,
      result,
      reviews,
    };

    // Filtrar sesión previa idéntica si existe (misma empresa + mismo período)
    const filtered = current.filter(
      (e) => !(e.company.nit === result.company.nit && e.periodLabel === result.periodLabel),
    );
    const updated = [newEntry, ...filtered].slice(0, 50);
    localStorage.setItem(key, JSON.stringify(updated));

    // Sincronizar en la nube en segundo plano (fire-and-forget seguro)
    if (typeof window !== "undefined" && !(globalThis as any).__TEST_ENV__) {
      getHistoryServer().then((srv) => {
        srv
          ?.saveUserHistoryServerFn({
            data: {
              userId: activeUser,
              userEmail: activeUser.includes("@") ? activeUser : undefined,
              entry: newEntry,
            },
          })
          .catch((err) => {
            console.warn("[history-store] Falló guardado asíncrono en la nube:", err);
          });
      });
    }

    return updated;
  } catch (err) {
    console.error("Failed to save history entry:", err);
    return getHistoryEntries(activeUser);
  }
}

/**
 * Elimina una sesión del historial tanto localmente como en la base de datos en la nube.
 */
export function deleteHistoryEntry(id: string, userKey?: string): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const activeUser = userKey || getActiveUserKey();
  const key = getScopedStorageKey(activeUser);

  try {
    const current = getHistoryEntries(activeUser);
    const updated = current.filter((e) => e.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));

    // Eliminar de la nube en segundo plano
    if (typeof window !== "undefined" && !(globalThis as any).__TEST_ENV__) {
      getHistoryServer().then((srv) => {
        srv
          ?.deleteUserHistoryServerFn({
            data: { id, userId: activeUser },
          })
          .catch((err) => {
            console.warn("[history-store] Falló eliminación asíncrona en la nube:", err);
          });
      });
    }

    return updated;
  } catch {
    return [];
  }
}

/**
 * Vacía todo el historial del usuario actual tanto localmente como en la nube.
 */
export function clearAllHistory(userKey?: string): void {
  if (typeof window === "undefined") return;
  const activeUser = userKey || getActiveUserKey();
  const key = getScopedStorageKey(activeUser);

  try {
    localStorage.removeItem(key);

    if (typeof window !== "undefined" && !(globalThis as any).__TEST_ENV__) {
      getHistoryServer().then((srv) => {
        srv
          ?.clearUserHistoryServerFn({
            data: { userId: activeUser },
          })
          .catch((err) => {
            console.warn("[history-store] Falló vaciado en la nube:", err);
          });
      });
    }
  } catch {}
}

/**
 * Exporta todas las sesiones del historial del usuario en un archivo JSON descargable.
 */
export function exportHistoryJson(userKey?: string): void {
  if (typeof window === "undefined") return;
  const activeUser = userKey || getActiveUserKey();

  try {
    const entries = getHistoryEntries(activeUser);
    if (entries.length === 0) {
      alert("No hay sesiones guardadas en el historial para exportar.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries, null, 2));
    const downloadAnchor = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    const safeUser = activeUser.replace(/[^a-z0-9_.-]/g, "_");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `respaldo_conciliaciones_${safeUser}_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } catch (err) {
    console.error("Error al exportar historial:", err);
    alert("Error al generar el archivo de respaldo.");
  }
}

/**
 * Importa y fusiona sesiones desde un archivo JSON de respaldo para el usuario actual
 * y las persiste tanto localmente como en la base de datos en la nube.
 */
export function importHistoryJson(
  jsonContent: string,
  userKey?: string,
): { success: boolean; count: number; error?: string } {
  if (typeof window === "undefined") return { success: false, count: 0, error: "No window context" };
  const activeUser = userKey || getActiveUserKey();
  const key = getScopedStorageKey(activeUser);

  try {
    const parsed = JSON.parse(jsonContent);
    if (!Array.isArray(parsed)) {
      return { success: false, count: 0, error: "El archivo no contiene un formato de historial válido (debe ser un arreglo JSON)." };
    }

    const validEntries: HistoryEntry[] = [];
    for (const item of parsed) {
      if (item && typeof item === "object" && item.id && item.company && item.result && item.totals) {
        validEntries.push(item as HistoryEntry);
      }
    }

    if (validEntries.length === 0) {
      return { success: false, count: 0, error: "No se encontraron sesiones válidas en el archivo seleccionado." };
    }

    const current = getHistoryEntries(activeUser);
    const map = new Map<string, HistoryEntry>();
    
    // Primero agregar los existentes
    for (const e of current) {
      map.set(e.id, e);
    }
    // Luego sobrescribir o añadir los importados
    for (const e of validEntries) {
      map.set(e.id, e);
    }

    const merged = Array.from(map.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);

    localStorage.setItem(key, JSON.stringify(merged));

    // Sincronizar importados en la nube
    if (typeof window !== "undefined" && !(globalThis as any).__TEST_ENV__) {
      getHistoryServer().then((srv) => {
        if (!srv) return;
        Promise.allSettled(
          validEntries.map((entry) =>
            srv.saveUserHistoryServerFn({
              data: {
                userId: activeUser,
                userEmail: activeUser.includes("@") ? activeUser : undefined,
                entry,
              },
            })
          )
        ).catch(() => {});
      });
    }

    return { success: true, count: validEntries.length };
  } catch (err: any) {
    console.error("Error al importar historial:", err);
    return { success: false, count: 0, error: err.message || "Error al procesar el archivo JSON." };
  }
}
