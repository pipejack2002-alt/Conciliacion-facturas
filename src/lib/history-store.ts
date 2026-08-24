import type { CompanyInfo, ConciliacionResult, Totales } from "./types.ts";
import type { Review } from "./reviews.ts";

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

const STORAGE_KEY = "conciliacion_dian_history_v1";

export function getHistoryEntries(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(
  result: ConciliacionResult,
  dianName: string,
  movName: string,
  reviews?: Record<string, Review>,
): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getHistoryEntries();
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

    // Filter out existing identical company + period if older, prepend new entry
    const filtered = current.filter(
      (e) => !(e.company.nit === result.company.nit && e.periodLabel === result.periodLabel),
    );
    const updated = [newEntry, ...filtered].slice(0, 50); // keep up to 50 recent company sessions
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (err) {
    console.error("Failed to save history entry:", err);
    return getHistoryEntries();
  }
}

export function deleteHistoryEntry(id: string): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getHistoryEntries();
    const updated = current.filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearAllHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

/**
 * Exporta todas las sesiones del historial en un archivo JSON descargable.
 */
export function exportHistoryJson(): void {
  if (typeof window === "undefined") return;
  try {
    const entries = getHistoryEntries();
    if (entries.length === 0) {
      alert("No hay sesiones guardadas en el historial para exportar.");
      return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(entries, null, 2));
    const downloadAnchor = document.createElement("a");
    const dateStr = new Date().toISOString().split("T")[0];
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `respaldo_conciliaciones_dian_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } catch (err) {
    console.error("Error al exportar historial:", err);
    alert("Error al generar el archivo de respaldo.");
  }
}

/**
 * Importa y fusiona sesiones desde un archivo JSON de respaldo.
 */
export function importHistoryJson(jsonContent: string): { success: boolean; count: number; error?: string } {
  if (typeof window === "undefined") return { success: false, count: 0, error: "No window context" };
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

    const current = getHistoryEntries();
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

    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return { success: true, count: validEntries.length };
  } catch (err: any) {
    console.error("Error al importar historial:", err);
    return { success: false, count: 0, error: err.message || "Error al procesar el archivo JSON." };
  }
}
