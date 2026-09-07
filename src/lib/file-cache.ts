import type { CompanyInfo, ConciliacionResult, ConciliacionRow, DianDoc, MovLine } from "./types.ts";

const DB_NAME = "conciliacion_files_db_v1";
const STORE_NAME = "files_cache";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Guarda los arreglos completos de documentos DIAN y movimientos en IndexedDB
 * para que persistan a través de recargas (F5) sin sobrecargar el límite de 5MB de localStorage.
 */
export async function saveCachedFiles(dian: DianDoc[], mov: MovLine[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      if (dian && dian.length) store.put(dian, "active_dian");
      if (mov && mov.length) store.put(mov, "active_mov");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Carga los archivos DIAN y movimientos desde IndexedDB.
 */
export async function loadCachedFiles(): Promise<{ dian: DianDoc[]; mov: MovLine[] } | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const reqDian = store.get("active_dian");
      const reqMov = store.get("active_mov");
      tx.oncomplete = () => {
        const dian = (reqDian.result as DianDoc[]) || [];
        const mov = (reqMov.result as MovLine[]) || [];
        resolve({ dian, mov });
      };
      tx.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Limpia la caché de archivos al reiniciar la auditoría.
 */
export async function clearCachedFiles(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.delete("active_dian");
      store.delete("active_mov");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Reconstruye el arreglo de DianDoc[] a partir de result.rows y la información de la empresa.
 * Esto garantiza que si el usuario recarga la página (F5) o viene del historial y le da a
 * "Actualizar movimiento", se pueda re-conciliar inmediatamente sin pedirle volver a subir el DIAN.
 */
export function reconstructDianFromRows(
  rows: ConciliacionRow[],
  company: CompanyInfo,
): DianDoc[] {
  if (!rows || !rows.length) return [];

  // Excluir filas que solo existían en Siigo/libros contables
  const dianRows = rows.filter(
    (r) => r.estado !== "solo_siigo" && !r.id.startsWith("solo-"),
  );

  return dianRows.map((r) => {
    const isEmitido = r.grupo === "Emitido";
    const compNit = company?.nit || "";
    const compNom = company?.nombre || "";
    const cpNit = r.nitContraparte || "";
    const cpNom = r.nombreContraparte || "";

    return {
      tipo: r.tipo || "Factura Electrónica",
      cufe: r.cufe || "",
      folio: r.folio || "",
      prefijo: r.prefijo || "",
      fechaEmision: r.fecha || "",
      fechaRecepcion: r.fecha || "",
      nitEmisor: isEmitido ? compNit : cpNit,
      nombreEmisor: isEmitido ? compNom : cpNom,
      nitReceptor: isEmitido ? cpNit : compNit,
      nombreReceptor: isEmitido ? cpNom : compNom,
      iva: r.iva || 0,
      total: r.totalDian || 0,
      estadoDian: "",
      grupo: r.grupo || (isEmitido ? "Emitido" : "Recibido"),
    };
  });
}

/**
 * Reconstruye el arreglo de MovLine[] a partir de las coincidencias (hits) y huérfanos del resultado.
 * Permite que "Actualizar DIAN" funcione incluso si el movimiento original no está en memoria.
 */
export function reconstructMovFromResults(result: ConciliacionResult): MovLine[] {
  if (!result) return [];
  const lines: MovLine[] = [];
  const seen = new Set<string>();

  for (const r of result.rows || []) {
    for (const h of r.hits || []) {
      const key = `${h.comprobante}|${h.cuenta}|${h.debito}|${h.credito}|${h.descripcion}|${h.fecha}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push({
        cuenta: h.cuenta || "CUENTA",
        cuentaNombre: "",
        comprobante: h.comprobante,
        fecha: h.fecha,
        nit: h.nit,
        nombre: h.nombre,
        descripcion: h.descripcion,
        cruce: h.cruce,
        debito: h.debito,
        credito: h.credito,
        observacion: "",
      });
    }
  }

  for (const o of result.orphans || []) {
    const key = `${o.comprobante}|${o.cuenta}|${o.debito}|${o.credito}|${o.descripcion}|${o.fecha}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push({
      cuenta: o.cuenta || "CUENTA",
      cuentaNombre: "",
      comprobante: o.comprobante,
      fecha: o.fecha,
      nit: o.nit,
      nombre: o.nombre,
      descripcion: o.descripcion,
      cruce: o.cruce,
      debito: o.debito,
      credito: o.credito,
      observacion: "",
    });
  }

  return lines;
}
