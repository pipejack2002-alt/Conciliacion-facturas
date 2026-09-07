import { create } from "zustand";
import type { AuditDelta, Review } from "./reviews.ts";
import {
  clearConfirmedMarks,
  computeDelta,
  docKey,
  loadReviews,
  loadSnapshot,
  saveReviews,
  saveSnapshot,
} from "./reviews.ts";
import { conciliar } from "./conciliar.ts";
import { saveHistoryEntry, getHistoryEntries, type HistoryEntry } from "./history-store.ts";
import type { ConciliacionResult, DianDoc, MovLine } from "./types.ts";
import {
  clearCachedFiles,
  loadCachedFiles,
  reconstructDianFromRows,
  reconstructMovFromResults,
  saveCachedFiles,
} from "./file-cache.ts";

export type { Review } from "./reviews.ts";

export type TabId =
  | "cola"
  | "pendiente"
  | "posible_typo"
  | "totalizado"
  | "duplicado"
  | "diferencia"
  | "cruce_nc"
  | "conciliado"
  | "emitidos"
  | "todos"
  | "solo_siigo";


export type SortId =
  | "prioridad"
  | "monto"
  | "fecha"
  | "proveedor"
  | "estado"
  | "documento"
  | "cufe"
  | "dian"
  | "libros";

export type SortDirection = "asc" | "desc";

export interface ColumnFilters {
  estado?: string[];
  tipo?: string[];
  proveedor?: string;
  hasCufe?: boolean | null;
  fechaRange?: "all" | "7dias" | "15dias" | "30dias" | "mas30dias";
  montoRange?: "all" | "gte5m" | "1m_5m" | "lt1m";
}

type State = {
  dian: DianDoc[];
  mov: MovLine[];
  dianName: string;
  movName: string;
  result: ConciliacionResult | null;
  query: string;
  tab: TabId;
  sort: SortId;
  sortDirection: SortDirection;
  columnFilters: ColumnFilters;
  groupByProveedor: boolean;
  hideRevisados: boolean;
  reviews: Record<string, Review>;
  selectedId: string | null;
  error: string | null;
  toast: string | null;
  delta: AuditDelta | null;
  setFiles: (dian: DianDoc[], mov: MovLine[], names: { dian: string; mov: string }, period?: string) => void;
  loadHistorySession: (entry: HistoryEntry) => void;
  replaceDian: (dian: DianDoc[], name: string) => Promise<void> | void;
  replaceMov: (mov: MovLine[], name: string) => Promise<void> | void;
  setQuery: (q: string) => void;
  setTab: (t: TabId) => void;
  setSort: (s: SortId, dir?: SortDirection) => void;
  toggleSort: (col: SortId) => void;
  setColumnFilter: <K extends keyof ColumnFilters>(key: K, value: ColumnFilters[K]) => void;
  clearColumnFilter: (key: keyof ColumnFilters) => void;
  clearAllColumnFilters: () => void;
  toggleGroup: () => void;
  toggleHideRevisados: () => void;
  setReview: (row: { cufe?: string; nitContraparte?: string; numero?: string; folio?: string }, patch: Partial<Review>) => void;
  markValidated: (row: { cufe?: string; nitContraparte?: string; numero?: string; folio?: string }, action: "validada" | "omitir") => void;
  select: (id: string | null) => void;
  reset: () => void;
  restoreActiveSession: () => boolean;
  setError: (e: string | null) => void;
  flash: (msg: string | null) => void;
  dismissDelta: () => void;
};

export function reviewOf(
  reviews: Record<string, Review>,
  row: { cufe?: string; nitContraparte?: string; numero?: string; folio?: string },
): Review | undefined {
  return reviews[docKey(row)];
}

export interface ActiveSessionData {
  result: ConciliacionResult | null;
  dianName: string;
  movName: string;
  reviews: Record<string, Review>;
  tab?: TabId;
  sort?: SortId;
  sortDirection?: SortDirection;
  columnFilters?: ColumnFilters;
  groupByProveedor?: boolean;
  hideRevisados?: boolean;
}

const ACTIVE_SESSION_STORAGE_KEY = "conciliacion_active_session_v1";
const DISMISSED_SESSION_STORAGE_KEY = "conciliacion_session_dismissed_v1";

export function loadActiveSession(): ActiveSessionData | null {
  if (typeof window === "undefined") return null;
  try {
    // Si el usuario explícitamente hizo clic en "Nueva auditoría", respetar su decisión
    if (
      sessionStorage.getItem(DISMISSED_SESSION_STORAGE_KEY) === "true" ||
      localStorage.getItem(DISMISSED_SESSION_STORAGE_KEY) === "true"
    ) {
      return null;
    }

    const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.result && parsed.result.company && Array.isArray(parsed.result.rows)) {
        return parsed as ActiveSessionData;
      }
    }

    // Fallback inteligente: si no hay sesión activa guardada pero el usuario tiene historial reciente
    const historyEntries = getHistoryEntries();
    if (historyEntries.length > 0) {
      const latest = historyEntries[0];
      if (latest && latest.result) {
        return {
          result: latest.result,
          dianName: latest.dianName || "Reporte DIAN",
          movName: latest.movName || "Movimiento Contable",
          reviews: latest.reviews || {},
          tab: "cola",
          sort: "prioridad",
          sortDirection: "asc",
          columnFilters: {},
          groupByProveedor: false,
          hideRevisados: false,
        };
      }
    }

    return null;
  } catch (e) {
    console.warn("[store] No se pudo cargar sesión activa previa:", e);
    return null;
  }
}

export function saveActiveSession(data: ActiveSessionData) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(DISMISSED_SESSION_STORAGE_KEY);
    localStorage.removeItem(DISMISSED_SESSION_STORAGE_KEY);
    if (!data.result) {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("[store] Error al persistir sesión activa:", e);
  }
}

export function clearActiveSession() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DISMISSED_SESSION_STORAGE_KEY, "true");
    localStorage.setItem(DISMISSED_SESSION_STORAGE_KEY, "true");
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch {}
}

function autoPersist(get: () => State) {
  const s = get();
  if (s.result) {
    saveActiveSession({
      result: s.result,
      dianName: s.dianName,
      movName: s.movName,
      reviews: s.reviews,
      tab: s.tab,
      sort: s.sort,
      sortDirection: s.sortDirection,
      columnFilters: s.columnFilters,
      groupByProveedor: s.groupByProveedor,
      hideRevisados: s.hideRevisados,
    });
  } else {
    clearActiveSession();
  }
}

const initialActive = typeof window !== "undefined" ? loadActiveSession() : null;

export const useConciliacion = create<State>((set, get) => ({
  dian: [],
  mov: [],
  dianName: initialActive?.dianName || "",
  movName: initialActive?.movName || "",
  result: initialActive?.result || null,
  query: "",
  tab: initialActive?.tab || "cola",
  sort: initialActive?.sort || "prioridad",
  sortDirection: initialActive?.sortDirection || "asc",
  columnFilters: initialActive?.columnFilters || {},
  groupByProveedor: Boolean(initialActive?.groupByProveedor),
  hideRevisados: Boolean(initialActive?.hideRevisados),
  reviews: initialActive?.reviews || {},
  selectedId: null,
  error: null,
  toast: null,
  delta: null,
  restoreActiveSession: () => {
    const active = loadActiveSession();
    if (active && active.result) {
      set({
        dianName: active.dianName || "",
        movName: active.movName || "",
        result: active.result,
        tab: active.tab || get().tab || "cola",
        sort: active.sort || get().sort || "prioridad",
        sortDirection: active.sortDirection || get().sortDirection || "asc",
        columnFilters: active.columnFilters || get().columnFilters || {},
        groupByProveedor: active.groupByProveedor ?? get().groupByProveedor,
        hideRevisados: active.hideRevisados ?? get().hideRevisados,
        reviews: active.reviews || get().reviews || {},
      });
      // Cargar archivos raw desde IndexedDB en segundo plano
      void loadCachedFiles().then((cached) => {
        if (cached && (cached.dian.length || cached.mov.length)) {
          set({
            dian: cached.dian.length ? cached.dian : get().dian,
            mov: cached.mov.length ? cached.mov : get().mov,
          });
        }
      });
      return true;
    }
    return false;
  },
  setFiles: (dian, mov, names, period) => {
    const result = conciliar(dian, mov, period || names.dian);
    const nit = result.company.nit;
    const prev = loadSnapshot(nit);
    const delta0 = computeDelta(prev, result);
    let reviews = loadReviews(nit);
    if (delta0?.confirmed.length) {
      reviews = clearConfirmedMarks(reviews, delta0.confirmed);
      saveReviews(nit, reviews);
    }
    const stillMarked = result.rows
      .filter((r) => {
        const rv = reviews[docKey(r)];
        return Boolean(rv?.done && rv.action === "validada" && (r.estado === "pendiente" || r.estado === "posible_typo"));
      })
      .map((r) => ({
        key: docKey(r),
        numero: r.numero,
        nombre: r.nombreContraparte,
        total: r.totalDian,
        de: r.estado,
        a: r.estado,
      }));
    const delta = delta0 ? { ...delta0, stillMarked } : stillMarked.length ? { at: new Date().toISOString(), confirmed: [], stillOpen: [], newIssues: [], stillMarked } : null;
    saveSnapshot(result);
    saveHistoryEntry(result, names.dian, names.mov, reviews);
    // Guardar en caché persistente IndexedDB
    void saveCachedFiles(dian, mov);
    set({
      dian,
      mov,
      dianName: names.dian,
      movName: names.mov,
      result,
      selectedId: null,
      error: null,
      tab: "cola",
      query: "",
      reviews,
      delta,
      toast: delta?.confirmed.length
        ? `${delta.confirmed.length} documento${delta.confirmed.length === 1 ? "" : "s"} que estaban en cola ya aparecen en libros.`
        : get().toast,
    });
    autoPersist(get);
  },
  loadHistorySession: (entry: HistoryEntry) => {
    const reviews = entry.reviews || loadReviews(entry.company.nit);
    set({
      dian: [],
      mov: [],
      dianName: entry.dianName || "Reporte DIAN",
      movName: entry.movName || "Movimiento Contable",
      result: entry.result,
      selectedId: null,
      error: null,
      tab: "cola",
      query: "",
      reviews,
      delta: null,
      toast: `Sesión de ${entry.company.nombre || "Empresa"} (${entry.periodLabel || "Período"}) cargada desde el historial.`,
    });
    autoPersist(get);
  },
  replaceDian: async (dian, name) => {
    let { mov, movName, result } = get();
    if (!mov.length) {
      const cached = await loadCachedFiles();
      if (cached && cached.mov && cached.mov.length) {
        mov = cached.mov;
      }
    }
    if (!mov.length && result && result.rows && result.rows.length) {
      mov = reconstructMovFromResults(result);
    }
    if (!mov.length) {
      get().setError("No se encontraron movimientos contables previos para cruzar contra el nuevo reporte DIAN.");
      get().flash("⚠️ No hay movimientos contables en la sesión. Sube ambos archivos.");
      return;
    }
    get().setFiles(dian, mov, { dian: name, mov: movName || "Movimiento Contable" });
  },
  replaceMov: async (mov, name) => {
    let { dian, dianName, result } = get();
    if (!dian.length) {
      const cached = await loadCachedFiles();
      if (cached && cached.dian && cached.dian.length) {
        dian = cached.dian;
      }
    }
    if (!dian.length && result && result.rows && result.rows.length) {
      dian = reconstructDianFromRows(result.rows, result.company);
    }
    if (!dian.length) {
      get().setError("No se encontraron documentos DIAN previos para cruzar contra el nuevo movimiento.");
      get().flash("⚠️ No hay documentos DIAN en la sesión. Sube ambos archivos.");
      return;
    }
    get().setFiles(dian, mov, { dian: dianName || "Reporte DIAN", mov: name });
  },
  setQuery: (query) => set({ query }),
  setTab: (tab) => {
    set({ tab, selectedId: null });
    autoPersist(get);
  },
  setSort: (sort, dir) => {
    if (dir) {
      set({ sort, sortDirection: dir });
    } else {
      const defaultDir: SortDirection =
        sort === "monto" || sort === "dian" || sort === "libros" ? "desc" : "asc";
      set({ sort, sortDirection: defaultDir });
    }
    autoPersist(get);
  },
  toggleSort: (col) => {
    const currentSort = get().sort;
    const currentDir = get().sortDirection;
    if (currentSort === col) {
      set({ sortDirection: currentDir === "asc" ? "desc" : "asc" });
    } else {
      const defaultDir: SortDirection =
        col === "monto" || col === "dian" || col === "libros" ? "desc" : "asc";
      set({ sort: col, sortDirection: defaultDir });
    }
    autoPersist(get);
  },
  setColumnFilter: (key, value) => {
    set((state) => ({
      columnFilters: {
        ...state.columnFilters,
        [key]: value,
      },
    }));
    autoPersist(get);
  },
  clearColumnFilter: (key) => {
    set((state) => {
      const next = { ...state.columnFilters };
      delete next[key];
      return { columnFilters: next };
    });
    autoPersist(get);
  },
  clearAllColumnFilters: () => {
    set({ columnFilters: {} });
    autoPersist(get);
  },
  toggleGroup: () => {
    set({ groupByProveedor: !get().groupByProveedor });
    autoPersist(get);
  },
  toggleHideRevisados: () => {
    set({ hideRevisados: !get().hideRevisados });
    autoPersist(get);
  },
  setReview: (row, patch) => {
    const nit = get().result?.company.nit || "";
    const key = docKey(row);
    const prev = get().reviews[key] || { done: false, note: "" };
    const next = { ...get().reviews, [key]: { ...prev, ...patch } };
    saveReviews(nit, next);
    set({ reviews: next });
    autoPersist(get);
  },
  markValidated: (row, action) => {
    const nit = get().result?.company.nit || "";
    const key = docKey(row);
    const prev = get().reviews[key] || { done: false, note: "" };
    const done = !(prev.done && prev.action === action);
    const nextReview: Review = {
      ...prev,
      done,
      action: done ? action : undefined,
      at: done ? new Date().toISOString() : prev.at,
    };
    const next = { ...get().reviews, [key]: nextReview };
    saveReviews(nit, next);
    set({
      reviews: next,
      toast: done
        ? action === "validada"
          ? "Marcada. Cuando subas el movimiento actualizado, la volvemos a cruzar."
          : "Omitida en esta auditoría. Puedes ocultar las revisadas."
        : "Marca quitada",
    });
    autoPersist(get);
  },
  select: (selectedId) => set({ selectedId }),
  reset: () => {
    clearActiveSession();
    void clearCachedFiles();
    set({
      dian: [],
      mov: [],
      dianName: "",
      movName: "",
      result: null,
      query: "",
      tab: "cola",
      sort: "prioridad",
      sortDirection: "asc",
      columnFilters: {},
      groupByProveedor: false,
      hideRevisados: false,
      reviews: {},
      selectedId: null,
      error: null,
      toast: null,
      delta: null,
    });
  },
  setError: (error) => set({ error }),
  flash: (toast) => set({ toast }),
  dismissDelta: () => set({ delta: null }),
}));
