import { create } from "zustand";
import type { AuditDelta, Review } from "./reviews";
import {
  clearConfirmedMarks,
  computeDelta,
  docKey,
  loadReviews,
  loadSnapshot,
  saveReviews,
  saveSnapshot,
} from "./reviews";
import { conciliar } from "./conciliar";
import { saveHistoryEntry, type HistoryEntry } from "./history-store";
import type { ConciliacionResult, DianDoc, MovLine } from "./types";

export type { Review } from "./reviews";

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


export type SortId = "prioridad" | "monto" | "fecha" | "proveedor";

type State = {
  dian: DianDoc[];
  mov: MovLine[];
  dianName: string;
  movName: string;
  result: ConciliacionResult | null;
  query: string;
  tab: TabId;
  sort: SortId;
  groupByProveedor: boolean;
  hideRevisados: boolean;
  reviews: Record<string, Review>;
  selectedId: string | null;
  error: string | null;
  toast: string | null;
  delta: AuditDelta | null;
  setFiles: (dian: DianDoc[], mov: MovLine[], names: { dian: string; mov: string }, period?: string) => void;
  loadHistorySession: (entry: HistoryEntry) => void;
  replaceDian: (dian: DianDoc[], name: string) => void;
  replaceMov: (mov: MovLine[], name: string) => void;
  setQuery: (q: string) => void;
  setTab: (t: TabId) => void;
  setSort: (s: SortId) => void;
  toggleGroup: () => void;
  toggleHideRevisados: () => void;
  setReview: (row: { cufe?: string; nitContraparte?: string; numero?: string; folio?: string }, patch: Partial<Review>) => void;
  markValidated: (row: { cufe?: string; nitContraparte?: string; numero?: string; folio?: string }, action: "validada" | "omitir") => void;
  select: (id: string | null) => void;
  reset: () => void;
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

export const useConciliacion = create<State>((set, get) => ({
  dian: [],
  mov: [],
  dianName: "",
  movName: "",
  result: null,
  query: "",
  tab: "cola",
  sort: "prioridad",
  groupByProveedor: false,
  hideRevisados: false,
  reviews: {},
  selectedId: null,
  error: null,
  toast: null,
  delta: null,
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
  },
  replaceDian: (dian, name) => {
    const { mov, movName } = get();
    if (!mov.length) return;
    get().setFiles(dian, mov, { dian: name, mov: movName });
  },
  replaceMov: (mov, name) => {
    const { dian, dianName } = get();
    if (!dian.length) return;
    get().setFiles(dian, mov, { dian: dianName, mov: name });
  },
  setQuery: (query) => set({ query }),
  setTab: (tab) => set({ tab, selectedId: null }),
  setSort: (sort) => set({ sort }),
  toggleGroup: () => set({ groupByProveedor: !get().groupByProveedor }),
  toggleHideRevisados: () => set({ hideRevisados: !get().hideRevisados }),
  setReview: (row, patch) => {
    const nit = get().result?.company.nit || "";
    const key = docKey(row);
    const prev = get().reviews[key] || { done: false, note: "" };
    const next = { ...get().reviews, [key]: { ...prev, ...patch } };
    saveReviews(nit, next);
    set({ reviews: next });
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
  },
  select: (selectedId) => set({ selectedId }),
  reset: () =>
    set({
      dian: [],
      mov: [],
      dianName: "",
      movName: "",
      result: null,
      query: "",
      tab: "cola",
      sort: "prioridad",
      groupByProveedor: false,
      hideRevisados: false,
      reviews: {},
      selectedId: null,
      error: null,
      toast: null,
      delta: null,
    }),
  setError: (error) => set({ error }),
  flash: (toast) => set({ toast }),
  dismissDelta: () => set({ delta: null }),
}));
