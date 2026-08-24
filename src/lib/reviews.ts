import { inCola } from "./conciliar";
import type { ConciliacionResult, ConciliacionRow, EstadoConciliacion } from "./types";

export type ReviewAction = "validada" | "omitir";

export type Review = {
  done: boolean;
  note?: string;
  action?: ReviewAction;
  at?: string;
};

export type DeltaItem = {
  key: string;
  numero: string;
  nombre: string;
  total: number;
  de: EstadoConciliacion | "";
  a: EstadoConciliacion | "";
};

export type AuditDelta = {
  at: string;
  confirmed: DeltaItem[];
  stillOpen: DeltaItem[];
  newIssues: DeltaItem[];
  stillMarked: DeltaItem[];
};

export type Snapshot = {
  nit: string;
  at: string;
  byKey: Record<
    string,
    { estado: EstadoConciliacion; numero: string; nombre: string; total: number; inCola: boolean }
  >;
};

export function docKey(r: { cufe?: string; nitContraparte?: string; numero?: string; folio?: string }): string {
  const cufe = (r.cufe || "").trim().toLowerCase();
  if (cufe.length >= 20) return `cufe:${cufe}`;
  const nit = (r.nitContraparte || "").replace(/\D/g, "");
  const num = (r.numero || r.folio || "").toUpperCase().replace(/\s/g, "");
  return `doc:${nit}:${num}`;
}

function reviewStoreKey(nit: string) {
  return `auditoria-dian:reviews:${nit || "sin-nit"}`;
}

function snapStoreKey(nit: string) {
  return `auditoria-dian:snap:${nit || "sin-nit"}`;
}

export function loadReviews(nit: string): Record<string, Review> {
  try {
    const raw = localStorage.getItem(reviewStoreKey(nit));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Review>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveReviews(nit: string, reviews: Record<string, Review>) {
  try {
    localStorage.setItem(reviewStoreKey(nit), JSON.stringify(reviews));
  } catch {
    /* quota */
  }
}

export function loadSnapshot(nit: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(snapStoreKey(nit));
    if (!raw) return null;
    return JSON.parse(raw) as Snapshot;
  } catch {
    return null;
  }
}

export function saveSnapshot(result: ConciliacionResult) {
  const snap: Snapshot = {
    nit: result.company.nit,
    at: new Date().toISOString(),
    byKey: {},
  };
  for (const r of result.rows) {
    snap.byKey[docKey(r)] = {
      estado: r.estado,
      numero: r.numero,
      nombre: r.nombreContraparte,
      total: r.totalDian,
      inCola: inCola(r),
    };
  }
  try {
    localStorage.setItem(snapStoreKey(result.company.nit), JSON.stringify(snap));
  } catch {
    /* quota */
  }
}

function itemFromRow(r: ConciliacionRow, de: EstadoConciliacion | "", a: EstadoConciliacion | ""): DeltaItem {
  return {
    key: docKey(r),
    numero: r.numero,
    nombre: r.nombreContraparte,
    total: r.totalDian,
    de,
    a,
  };
}

export function computeDelta(prev: Snapshot | null, result: ConciliacionResult): AuditDelta | null {
  if (!prev || prev.nit !== result.company.nit || !Object.keys(prev.byKey).length) return null;
  const confirmed: DeltaItem[] = [];
  const newIssues: DeltaItem[] = [];

  for (const r of result.rows) {
    const p = prev.byKey[docKey(r)];
    if (!p) {
      if (inCola(r) && r.prioridad === "audit") newIssues.push(itemFromRow(r, "", r.estado));
      continue;
    }
    const nowOk = r.estado === "conciliado" || r.estado === "cruce_nc";
    if (p.inCola && nowOk) confirmed.push(itemFromRow(r, p.estado, r.estado));
  }

  const stillOpen: DeltaItem[] = [];
  for (const r of result.rows) {
    if (!inCola(r)) continue;
    const p = prev.byKey[docKey(r)];
    if (p?.inCola) stillOpen.push(itemFromRow(r, p.estado, r.estado));
  }

  return { at: new Date().toISOString(), confirmed, stillOpen, newIssues, stillMarked: [] };
}

export function clearConfirmedMarks(
  reviews: Record<string, Review>,
  confirmed: DeltaItem[],
): Record<string, Review> {
  if (!confirmed.length) return reviews;
  const next = { ...reviews };
  for (const c of confirmed) {
    if (!next[c.key]) continue;
    next[c.key] = {
      ...next[c.key],
      done: false,
      action: undefined,
      note: next[c.key].note
        ? `${next[c.key].note}\n[Confirmada en libros ${new Date().toLocaleDateString("es-CO")}]`
        : `Confirmada en el movimiento ${new Date().toLocaleDateString("es-CO")}`,
    };
  }
  return next;
}
