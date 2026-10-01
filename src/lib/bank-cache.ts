/**
 * Módulo de Persistencia de Sesión Bancaria (Evitar pérdida en F5 / Actualizar)
 * 
 * Permite que al recargar la página (F5) o navegar entre pestañas, el usuario
 * conserve exactamente el extracto bancario cargado, el movimiento contable,
 * los saldos iniciales, la cuenta contable seleccionada y el estado de la conciliación.
 */

import type { BankExtractItem } from "./conciliar-bancos.ts";
import type { ParsedBankExtractResult } from "./parse-bank-extract.ts";
import type { MovLine } from "./types.ts";

export interface StoredBankSession {
  extractoItems: BankExtractItem[];
  extractoMeta: ParsedBankExtractResult | null;
  extractoFileName: string;
  selectedSubAccount: string;
  customMovLines: MovLine[] | null;
  customMovFileName: string;
  saldoInicialExtracto: number;
  saldoInicialLibros: number;
  cuentaSeleccionada: string;
  isDemoMode: boolean;
  tabFilter: "todas" | "conciliado" | "banco_pend" | "transito";
  timestamp: number;
}

const DB_NAME = "conciliacion_files_db_v1";
const STORE_NAME = "files_cache";
const BANK_SESSION_IDB_KEY = "active_bank_session";
export const BANK_SESSION_STORAGE_KEY = "conciliador_bank_session_v1";
export const BANK_DISMISSED_KEY = "conciliador_bank_dismissed_v1";

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
 * Guarda la sesión bancaria activa en IndexedDB y localStorage
 */
export async function saveStoredBankSession(session: Omit<StoredBankSession, "timestamp">): Promise<void> {
  if (typeof window === "undefined") return;

  const data: StoredBankSession = {
    ...session,
    timestamp: Date.now(),
  };

  try {
    sessionStorage.removeItem(BANK_DISMISSED_KEY);
    localStorage.removeItem(BANK_DISMISSED_KEY);

    // 1. Guardar en localStorage (rápido para montaje síncrono si el tamaño lo permite)
    try {
      localStorage.setItem(BANK_SESSION_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Si excede cuota en localStorage, guardar versión ligera en localStorage
      try {
        const lightweight = {
          ...data,
          // Si el movimiento contable es enorme, guardar sólo metadatos en localStorage
          customMovLines: (data.customMovLines && data.customMovLines.length > 500)
            ? data.customMovLines.slice(0, 500)
            : data.customMovLines,
        };
        localStorage.setItem(BANK_SESSION_STORAGE_KEY, JSON.stringify(lightweight));
      } catch {
        // Silently ignore quota exceeded in localStorage
      }
    }

    // 2. Guardar el objeto íntegro sin límites en IndexedDB
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(data, BANK_SESSION_IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch (err) {
    console.warn("[bank-cache] Error al guardar sesión bancaria:", err);
  }
}

/**
 * Carga la sesión bancaria activa desde localStorage (síncrono/inicial) o IndexedDB
 */
export function getInitialBankSessionSync(): StoredBankSession | null {
  if (typeof window === "undefined") return null;
  try {
    if (
      sessionStorage.getItem(BANK_DISMISSED_KEY) === "true" ||
      localStorage.getItem(BANK_DISMISSED_KEY) === "true"
    ) {
      return null;
    }

    const raw = localStorage.getItem(BANK_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (Array.isArray(parsed.extractoItems) || Array.isArray(parsed.customMovLines) || parsed.isDemoMode)) {
      return parsed as StoredBankSession;
    }
  } catch {
    // Silently ignore parse errors
  }
  return null;
}

/**
 * Carga la sesión bancaria íntegra desde IndexedDB
 */
export async function loadStoredBankSession(): Promise<StoredBankSession | null> {
  if (typeof window === "undefined") return null;

  if (
    sessionStorage.getItem(BANK_DISMISSED_KEY) === "true" ||
    localStorage.getItem(BANK_DISMISSED_KEY) === "true"
  ) {
    return null;
  }

  // 1. Intentar cargar desde IndexedDB (versión completa sin límites de cuota)
  try {
    const db = await openDb();
    if (db) {
      const fromIdb = await new Promise<StoredBankSession | null>((resolve) => {
        try {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(BANK_SESSION_IDB_KEY);
          tx.oncomplete = () => {
            resolve((req.result as StoredBankSession) || null);
          };
          tx.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (fromIdb && (Array.isArray(fromIdb.extractoItems) || Array.isArray(fromIdb.customMovLines) || fromIdb.isDemoMode)) {
        return fromIdb;
      }
    }
  } catch {
    // Fallback a localStorage
  }

  // 2. Fallback a localStorage
  return getInitialBankSessionSync();
}

/**
 * Limpia la sesión bancaria cuando el usuario hace clic en "Vaciar datos"
 */
export async function clearStoredBankSession(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(BANK_DISMISSED_KEY, "true");
    localStorage.setItem(BANK_DISMISSED_KEY, "true");
    localStorage.removeItem(BANK_SESSION_STORAGE_KEY);

    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(BANK_SESSION_IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } catch {
    // Silently ignore
  }
}
