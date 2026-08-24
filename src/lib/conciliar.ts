import type {
  CompanyInfo,
  ConciliacionResult,
  ConciliacionRow,
  CruceNC,
  DianDoc,
  EstadoConciliacion,
  MovHit,
  MovLine,
  OrphanMov,
} from "./types.ts";
import { digitsOnly } from "./format.ts";

const APP_RESPONSE = /application response/i;
const NOMINA = /nomina|nómina/i;
const NOTA_CREDITO = /nota\s+de\s+cr[eé]dito/i;
const FACTURA = /factura/i;
const SOPORTE = /soporte/i;

function stripZeros(s: string): string {
  const t = String(s || "").replace(/^0+/, "");
  return t || "0";
}

function compact(s: string): string {
  return (s || "").toUpperCase().replace(/[\s\-_.]/g, "");
}

function nitKey(s: string): string {
  const d = digitsOnly(s);
  if (d.length >= 10) return d.slice(0, 9);
  return d;
}

function numero(prefijo: string, folio: string): string {
  const p = (prefijo || "").trim().toUpperCase();
  const f = (folio || "").trim();
  return p ? `${p}-${f}` : f;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function closeAmount(a: number, b: number): boolean {
  const d = Math.abs(a - b);
  if (d <= 2) return true;
  const m = Math.max(Math.abs(a), Math.abs(b), 1);
  return d / m <= 0.015;
}

function isNoise(doc: DianDoc): boolean {
  return APP_RESPONSE.test(doc.tipo);
}

function isCreditNote(tipo: string): boolean {
  return NOTA_CREDITO.test(tipo);
}

function isInvoiceLike(tipo: string): boolean {
  return FACTURA.test(tipo) || /equivalente/i.test(tipo) || SOPORTE.test(tipo);
}

export function detectCompany(dian: DianDoc[]): CompanyInfo {
  const nitScores = new Map<string, number>();
  const nameCounts = new Map<string, Map<string, number>>();

  for (const d of dian) {
    const g = (d.grupo || "").trim().toLowerCase();
    let compNit = "";
    let compName = "";

    if (g === "recibido" || g === "recibidos") {
      compNit = d.nitReceptor;
      compName = d.nombreReceptor;
    } else if (g === "emitido" || g === "emitidos") {
      compNit = d.nitEmisor;
      compName = d.nombreEmisor;
    } else {
      const kE = nitKey(d.nitEmisor);
      const kR = nitKey(d.nitReceptor);
      if (kE.length >= 5) nitScores.set(kE, (nitScores.get(kE) || 0) + 1);
      if (kR.length >= 5) nitScores.set(kR, (nitScores.get(kR) || 0) + 1);
    }

    const k = nitKey(compNit);
    if (k.length >= 5) {
      nitScores.set(k, (nitScores.get(k) || 0) + 3);
      if (compName && compName.length > 2) {
        const names = nameCounts.get(k) || new Map<string, number>();
        names.set(compName.trim(), (names.get(compName.trim()) || 0) + 1);
        nameCounts.set(k, names);
      }
    }
  }

  const ranked = [...nitScores.entries()].sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return { nit: "", nombre: "Empresa" };
  const [nit] = ranked[0];

  let bestName = "Empresa";
  const names = nameCounts.get(nit);
  if (names && names.size > 0) {
    bestName = [...names.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  return { nit, nombre: bestName };
}

function grupoOf(doc: DianDoc, companyNit: string): "Emitido" | "Recibido" {
  const g = (doc.grupo || "").trim();
  if (g === "Emitido" || g === "Recibido") return g;
  return nitKey(doc.nitEmisor) === companyNit ? "Emitido" : "Recibido";
}

function counterpart(doc: DianDoc, companyNit: string) {
  if (nitKey(doc.nitEmisor) === companyNit) {
    return { nit: String(doc.nitReceptor || ""), nombre: doc.nombreReceptor };
  }
  return { nit: String(doc.nitEmisor || ""), nombre: doc.nombreEmisor };
}

function comprobanteBase(comp: string): string {
  const m = (comp || "").match(/^([A-Z])\s+(\d+)\s+(\d+)/);
  if (m) return `${m[1]} ${m[2]} ${m[3]}`;
  return (comp || "").trim();
}

function compLetter(base: string): string {
  return (base || "").trim()[0] || "";
}

function compFolio(base: string): string {
  const m = (base || "").match(/^[A-Z]\s+\d+\s+(\d+)/);
  return m ? stripZeros(m[1]) : "";
}

function isSoporte(tipo: string): boolean {
  return SOPORTE.test(tipo);
}

function isIssuedSale(doc: DianDoc, grupo: string): boolean {
  return grupo === "Emitido" && FACTURA.test(doc.tipo);
}

/** Exact prefijo+folio token: DSET1247, EDS305372, F-TLE-00000001060, FE5012100370258, FCHA000023839. */
function hasDocToken(blob: string, prefijo: string, folio: string): boolean {
  const p = compact(prefijo);
  const f = stripZeros(folio);
  if (!f || f === "0") return false;
  const up = blob.toUpperCase().replace(/[\s\-_.]/g, "");

  if (p) {
    // Regex for p + optional 0s + f with optional preceding FE
    const pRegex = new RegExp(`(?:FE)?${p}0*${f}(?:[^0-9]|$)`);
    if (pRegex.test(up)) return true;
    if (f.length >= 7 && up.includes(p + f.slice(-6))) return true;
    // Transposition check (e.g. FOB vs BOF)
    if (p.length === 3) {
      const pTrans = p[2] + p[1] + p[0];
      const pTrans2 = p[1] + p[0] + p[2];
      if (up.includes(pTrans + f) || up.includes(pTrans2 + f)) return true;
    }
  } else {
    // Empty prefix: search standalone folio with min length 4
    if (f.length >= 4) {
      if (up.includes(f) || up.includes("FE" + f)) return true;
    }
  }
  return false;
}

type LineKind = "venta" | "compra" | "pago" | "recaudo" | "ajuste";

function lineKind(l: { comprobante: string; cuenta: string }): LineKind {
  const letter = (l.comprobante || "").trim()[0];
  if (letter === "F") return "venta";
  if (letter === "R") return "recaudo";
  if (letter === "G") return "pago";
  if (letter === "U") return "ajuste";
  const cta = (l.cuenta || "").trim();
  if (/^(5|6|7|14|17|24|22|23|13)/.test(cta)) return "compra";
  return "pago";
}

type IndexedLine = MovLine & {
  blob: string;
  keys: Set<string>;
  base: string;
  nitK: string;
  amt: number;
  kind: LineKind;
  folioN: string;
};

function extractKeys(line: MovLine): Set<string> {
  const text = `${line.descripcion} ${line.cruce} ${line.observacion} ${line.comprobante}`.toUpperCase();
  const keys = new Set<string>();
  for (const m of text.matchAll(/[FPUNCA]{1,4}-([A-Z0-9]{1,10})-0*(\d{1,12})/g)) {
    keys.add(compact(m[1]) + stripZeros(m[2]));
  }
  for (const m of text.matchAll(/\b([A-Z0-9]{1,8})[-]?0*(\d{1,12})\b/g)) {
    keys.add(compact(m[1]) + stripZeros(m[2]));
  }
  for (const m of text.matchAll(/\bFE([A-Z0-9]{2,8})[-]?0*(\d{1,12})\b/g)) {
    keys.add(compact(m[1]) + stripZeros(m[2]));
  }
  return keys;
}

function indexMov(mov: MovLine[]): IndexedLine[] {
  return mov.map((l) => {
    const base = comprobanteBase(l.comprobante);
    return {
      ...l,
      blob: `${l.descripcion} ${l.cruce} ${l.observacion} ${l.comprobante} ${l.nombre}`.toUpperCase(),
      keys: extractKeys(l),
      base,
      nitK: nitKey(l.nit),
      amt: Math.max(l.debito, l.credito),
      kind: lineKind({ comprobante: l.comprobante, cuenta: l.cuenta }),
      folioN: compFolio(base),
    };
  });
}

type HitSet = { lines: IndexedLine[]; via: string; score: number };

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 2) return 9;
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

function extractPrefixedFolios(blob: string): { pref: string; folio: string }[] {
  const out: { pref: string; folio: string }[] = [];
  const up = blob.toUpperCase();
  for (const m of up.matchAll(/\b([A-Z0-9]{2,8})[-.\s]*0*(\d{1,12})\b/g)) {
    out.push({ pref: compact(m[1]), folio: stripZeros(m[2]) });
  }
  return out;
}

function collectHits(
  doc: DianDoc,
  indexed: IndexedLine[],
  grupo: string,
  cpNit: string,
  takenExact: Set<string>,
): HitSet {
  const p = compact(doc.prefijo);
  const f = stripZeros(doc.folio);
  const want = p && f !== "0" ? p + f : "";
  const sale = isIssuedSale(doc, grupo);
  const soporte = isSoporte(doc.tipo);
  const isNC = isCreditNote(doc.tipo);
  const cpNitK = nitKey(cpNit);

  // Exact matching by number or token
  const byNumber = indexed.filter((l) => {
    if (!f || f === "0" || l.folioN !== f) return false;
    if (cpNitK && l.nitK && l.nitK !== cpNitK && !sale) return false;
    const lettr = compLetter(l.base);
    if (isNC) return lettr === "U" || lettr === "P" || lettr === "F";
    if (sale) return lettr === "F";
    if (soporte || grupo === "Recibido") return lettr === "P" || lettr === "F" || lettr === "U";
    return lettr === "F" || lettr === "P" || lettr === "U";
  });

  const byToken = indexed.filter((l) => {
    if (cpNitK && l.nitK && l.nitK !== cpNitK && !l.blob.includes(cpNitK)) return false;
    if (want && l.keys.has(want)) return true;
    return hasDocToken(l.blob, doc.prefijo, doc.folio);
  });

  let lines: IndexedLine[] = [];
  let via = "";
  if (byNumber.length) {
    lines = byNumber;
    via = "comprobante=folio";
  }
  if (byToken.length) {
    const extra = byToken.filter(
      (l) => !lines.some((x) => x.base === l.base && x.cuenta === l.cuenta && x.debito === l.debito && x.credito === l.credito),
    );
    lines = lines.concat(extra);
    via = via ? `${via}+prefijo` : (isNC && lines.some((l) => l.base.startsWith("U")) ? "nota devolución (U)" : "prefijo+folio");
  }
  if (lines.length) return { lines, via: via || "prefijo+folio", score: 90 };

  const nitK = nitKey(cpNit);
  if (!nitK || f.length < 3) return { lines: [], via: "", score: 0 };

  const sameNit = indexed.filter((l) => l.nitK && (l.nitK === nitK || l.nitK.startsWith(nitK) || nitK.startsWith(l.nitK)));
  const typed: IndexedLine[] = [];
  let seenToken = "";
  for (const l of sameNit) {
    const up = l.blob.replace(/[\s\-_.]/g, "");
    if (p && up.includes(p)) {
      const re = new RegExp(`${p}0*(\\d{3,12})`);
      const m = up.match(re);
      if (m) {
        const candFolio = stripZeros(m[1]);
        const dist = levenshtein(f, candFolio);
        if (dist >= 1 && dist <= 2) {
          const amtOk = closeAmount(l.amt, doc.total || 0) || amountsMatch(doc.total || 0, doc.iva || 0, l.amt);
          if (amtOk) {
            typed.push(l);
            seenToken = `${p}-${candFolio}`;
            break;
          }
        }
      }
    }
  }
  if (typed.length) {
    return {
      lines: typed,
      via: `posible digitación ${seenToken}`,
      score: 40,
    };
  }

  return { lines: [], via: "", score: 0 };
}

function registroLines(doc: DianDoc, grupo: string, hits: IndexedLine[]): IndexedLine[] {
  const sale = isIssuedSale(doc, grupo);
  const soporte = isSoporte(doc.tipo);
  const isNC = isCreditNote(doc.tipo);
  if (isNC) return hits;
  const wanted: LineKind[] = sale ? ["venta"] : ["compra", "ajuste"];
  if (soporte) wanted.push("compra");
  const reg = hits.filter(
    (h) => wanted.includes(h.kind) || (grupo === "Recibido" && /^(24|13|22|23|5|6|7|14|17)/.test((h.cuenta || "").trim())),
  );
  return reg.length ? reg : hits.filter((h) => h.kind !== "recaudo" && h.kind !== "pago");
}

function siigoAmount(hits: IndexedLine[], dianTotal: number): number {
  if (!hits.length) return 0;
  const byComp = new Map<string, IndexedLine[]>();
  for (const h of hits) {
    const arr = byComp.get(h.base) || [];
    arr.push(h);
    byComp.set(h.base, arr);
  }
  const cands: number[] = [];
  for (const lines of byComp.values()) {
    const byAcc = new Map<string, number>();
    const byDescDeb = new Map<string, number>();
    let maxLine = 0;
    let sumDeb = 0;
    let sumCre = 0;
    for (const h of lines) {
      maxLine = Math.max(maxLine, h.amt);
      byAcc.set(h.cuenta, (byAcc.get(h.cuenta) || 0) + h.amt);
      sumDeb += h.debito;
      sumCre += h.credito;
      const descKey = (h.descripcion || "").trim().toUpperCase();
      if (descKey) {
        byDescDeb.set(descKey, (byDescDeb.get(descKey) || 0) + h.debito);
      }
    }
    cands.push(maxLine, ...byAcc.values(), sumDeb, sumCre, ...byDescDeb.values());
  }
  const pos = cands.filter((n) => n > 0);
  if (!pos.length) return 0;
  return pos.reduce((b, v) => (Math.abs(v - dianTotal) < Math.abs(b - dianTotal) ? v : b));
}

function uniqueRegistros(hits: IndexedLine[], isDocNC?: boolean): string[] {
  if (isDocNC) {
    return [...new Set(hits.map((h) => h.base).filter(Boolean))];
  }
  const purchaseComps = hits
    .filter((h) => !h.base.startsWith("G ") && !h.base.startsWith("G-") && !h.base.startsWith("R ") && !h.base.startsWith("R-") && !h.base.startsWith("U ") && !h.base.startsWith("U-"))
    .map((h) => h.base)
    .filter(Boolean);
  return [...new Set(purchaseComps.length ? purchaseComps : hits.map((h) => h.base).filter(Boolean))];
}

function amountsMatch(dianTotal: number, iva: number, siigo: number): boolean {
  if (siigo <= 0 || dianTotal <= 0) return false;
  const net = dianTotal - (iva || 0);
  const base19 = dianTotal / 1.19;
  if (closeAmount(siigo, dianTotal) || (net > 0 && closeAmount(siigo, net)) || closeAmount(siigo, base19)) {
    return true;
  }
  const rates = [0.01, 0.025, 0.035, 0.04, 0.044, 0.06, 0.11];
  for (const r of rates) {
    if (closeAmount(siigo, dianTotal * (1 - r))) return true;
    if (net > 0 && closeAmount(siigo, net * (1 - r))) return true;
  }
  return false;
}

function isDocumentoSoporte(doc: DianDoc): boolean {
  return isSoporte(doc.tipo) || (doc.prefijo || "").toUpperCase().startsWith("DS");
}

function countDuplicateComps(comps: string[], doc: DianDoc): number {
  if (!comps || comps.length <= 1) return comps.length;

  if (isDocumentoSoporte(doc)) {
    // Para Documentos Soporte (DSEC, DSNE, DSET, DSEF, etc. en cualquier empresa):
    // En Siigo / ERPs se genera un comprobante de emisión (cuyo folio coincide con el folio del DSE, e.g. P 003, P 004, P 005...)
    // y un comprobante de causación contable con retenciones (P 001, P 002, etc.).
    const f = stripZeros(doc.folio);
    const emisionComps = comps.filter((c) => compFolio(c) === f);
    const causacionComps = comps.filter((c) => !emisionComps.includes(c));

    // Si tiene máximo 1 emisión y máximo 1 causación (o máximo 2 comprobantes en total), es el ciclo normal de 2 pasos del documento soporte
    if ((emisionComps.length <= 1 && causacionComps.length <= 1) || comps.length <= 2) {
      return 1;
    }
  }

  return comps.length;
}

function classifyRow(
  doc: DianDoc,
  registro: IndexedLine[],
  amount: number,
): EstadoConciliacion {
  if (isNoise(doc) && !(doc.total > 0)) return "no_aplica";
  if (!registro.length) return isNoise(doc) ? "no_aplica" : "pendiente";
  const comps = uniqueRegistros(registro, isCreditNote(doc.tipo));
  if (countDuplicateComps(comps, doc) >= 2) return "duplicado";
  const dianTotal = doc.total || 0;
  if (dianTotal > 0 && amount > 0 && !amountsMatch(dianTotal, doc.iva || 0, amount)) {
    const diff = Math.abs(dianTotal - amount);
    const rel = diff / dianTotal;
    if (diff > 5000 && rel > 0.08) return "diferencia";
  }
  return "conciliado";
}

function toHits(lines: IndexedLine[]): MovHit[] {
  const unique: MovHit[] = [];
  const seen = new Set<string>();
  for (const h of lines) {
    const id = `${h.base}|${h.cuenta}|${h.debito}|${h.credito}|${h.descripcion}`;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push({
      comprobante: h.comprobante,
      fecha: h.fecha,
      nit: h.nit,
      nombre: h.nombre,
      descripcion: h.descripcion,
      cruce: h.cruce,
      cuenta: h.cuenta,
      debito: h.debito,
      credito: h.credito,
    });
  }
  return unique;
}

function findCruzes(rows: ConciliacionRow[]): CruceNC[] {
  const ncs = rows.filter((r) => isCreditNote(r.tipo) && r.totalDian > 0);
  const facts = rows.filter((r) => isInvoiceLike(r.tipo) && !isCreditNote(r.tipo) && r.totalDian > 0);
  const usedF = new Set<string>();
  const usedN = new Set<string>();
  const out: CruceNC[] = [];
  for (const nc of ncs) {
    const nit = nitKey(nc.nitContraparte);
    const cand = facts
      .filter((f) => !usedF.has(f.id) && nitKey(f.nitContraparte) === nit && closeAmount(f.totalDian, nc.totalDian))
      .sort((a, b) => Math.abs(a.totalDian - nc.totalDian) - Math.abs(b.totalDian - nc.totalDian));
    const f = cand[0];
    if (!f) continue;
    usedF.add(f.id);
    usedN.add(nc.id);
    out.push({
      id: `cruce-${f.id}-${nc.id}`,
      nit: nc.nitContraparte,
      nombre: nc.nombreContraparte,
      facturaId: f.id,
      facturaNumero: f.numero,
      notaId: nc.id,
      notaNumero: nc.numero,
      valor: nc.totalDian,
      facturaEstado: f.estado,
      notaEstado: nc.estado,
    });
  }
  return out;
}

export function conciliar(
  dian: DianDoc[],
  mov: MovLine[],
  periodLabel: string,
): ConciliacionResult {
  const company = detectCompany(dian);
  const indexed = indexMov(mov);
  const takenExact = new Set(
    dian.map((d) => compact(d.prefijo) + stripZeros(d.folio)).filter((k) => k.length > 3),
  );
  const usedBases = new Set<string>();

  const rows: ConciliacionRow[] = [];

  dian.forEach((doc, i) => {
    const grupo = grupoOf(doc, company.nit);
    const cp = counterpart(doc, company.nit);
    const found = isNoise(doc)
      ? { lines: [], via: "", score: 0 }
      : collectHits(doc, indexed, grupo, cp.nit, takenExact);

    found.lines.forEach((h) => {
      if (h.base && found.score >= 80) usedBases.add(h.base);
    });

    const isNC = isCreditNote(doc.tipo);
    const registro = registroLines(doc, grupo, found.lines);
    const comps = uniqueRegistros(registro, isNC);
    const totalSiigo = siigoAmount(registro, doc.total || 0);
    let estado = classifyRow(doc, registro, totalSiigo);
    let alerta = "";
    let matchVia = found.via;

    if (estado === "duplicado") {
      alerta = `Aparece en ${comps.length} comprobantes de causación distintos (${comps.join(", ")}).`;
    } else if (estado === "diferencia") {
      alerta = `DIAN: $${(doc.total || 0).toLocaleString("es-CO")} vs Libros: $${totalSiigo.toLocaleString("es-CO")}.`;
    } else if (found.score === 40) {
      estado = "posible_typo";
      const token = found.via.replace("posible digitación ", "");
      alerta = `En el movimiento aparece ${token} (mismo NIT y valor). Posible error al digitar el folio.`;
    } else if (isDocumentoSoporte(doc) && comps.length > 1 && estado === "conciliado") {
      const f = stripZeros(doc.folio);
      const emisionComp = comps.find((c) => compFolio(c) === f) || comps[0];
      const causacionComps = comps.filter((c) => c !== emisionComp);
      const causacionLabel = causacionComps.length ? causacionComps.join(", ") : (comps[1] || "Causación");

      matchVia = `Doc. soporte emitido (${emisionComp}) + Causación retenciones (${causacionLabel})`;
      alerta = `Ciclo completo: Emisión soporte (${emisionComp}) y causación con retenciones (${causacionLabel}).`;
    } else if (isNC && comps.some((c) => c.startsWith("U")) && estado === "conciliado") {
      matchVia = "Nota de devolución / ajuste en libros (Comprobante U)";
      alerta = `Registrada en comprobante ${comps.join(", ")} cruzando con la factura correspondiente.`;
    }

    const prioridad: "audit" | "secundario" =
      grupo === "Recibido" && !isNoise(doc) && !NOMINA.test(doc.tipo) ? "audit" : "secundario";

    rows.push({
      id: `d-${i}-${(doc.cufe || String(i)).slice(0, 12)}`,
      estado,
      grupo,
      tipo: doc.tipo,
      prefijo: (doc.prefijo || "").trim(),
      folio: String(doc.folio || "").trim(),
      numero: numero(doc.prefijo, doc.folio),
      cufe: doc.cufe || "",
      fecha: doc.fechaEmision || doc.fechaRecepcion,
      nitContraparte: cp.nit,
      nombreContraparte: cp.nombre,
      iva: doc.iva || 0,
      totalDian: doc.total || 0,
      totalSiigo: totalSiigo > 0 ? totalSiigo : (estado === "conciliado" ? doc.total || 0 : 0),
      diferencia: round2((doc.total || 0) - totalSiigo),
      hits: toHits(found.lines),
      comprobantes: comps,
      matchVia,
      prioridad,
      linked: [],
      alerta,
    });
  });

  // 2nd Pass: Batch / Totalized Invoices (e.g. Camara de Comercio, Peajes)
  const unmatched = rows.filter((r) => r.estado === "pendiente" && r.totalDian > 0 && r.grupo === "Recibido");
  const byNit = new Map<string, typeof unmatched>();
  unmatched.forEach((r) => {
    const k = nitKey(r.nitContraparte);
    const arr = byNit.get(k) || [];
    arr.push(r);
    byNit.set(k, arr);
  });

  for (const [k, docs] of byNit) {
    if (docs.length < 2) continue;
    const sumDocs = docs.reduce((s, d) => s + d.totalDian, 0);
    const availMov = indexed.filter(
      (l) => l.nitK === k && !usedBases.has(l.base) && l.kind !== "pago" && l.kind !== "recaudo",
    );
    const compGroups = new Map<string, IndexedLine[]>();
    availMov.forEach((l) => {
      const arr = compGroups.get(l.base) || [];
      arr.push(l);
      compGroups.set(l.base, arr);
    });

    for (const [base, lines] of compGroups) {
      const compTotal = Math.max(...lines.map((l) => Math.max(l.debito, l.credito, l.amt)));
      if (closeAmount(compTotal, sumDocs)) {
        docs.forEach((d) => {
          d.estado = "totalizado";
          d.hits = toHits(lines);
          d.comprobantes = [base];
          d.totalSiigo = d.totalDian;
          d.diferencia = 0;
          d.matchVia = `totalizado en ${base} ($${compTotal.toLocaleString("es-CO")})`;
          d.alerta = `Totalizado en comprobante ${base} junto con ${docs.length} facturas del mismo proveedor.`;
        });
        usedBases.add(base);
        break;
      }
    }
  }

  // 3rd Pass: Single Invoices with same NIT and same Amount (Typo / Folio review / CCB)
  rows
    .filter((r) => r.estado === "pendiente" && r.totalDian > 0 && r.grupo === "Recibido")
    .forEach((r) => {
      const k = nitKey(r.nitContraparte);
      if (!k) return;
      const avail = indexed.filter(
        (l) => l.nitK === k && !usedBases.has(l.base) && l.kind !== "pago" && l.kind !== "recaudo",
      );
      for (const l of avail) {
        if (closeAmount(l.amt, r.totalDian) || amountsMatch(r.totalDian, r.iva || 0, l.amt)) {
          const isCamara = /camara\s+de\s+comercio/i.test(r.nombreContraparte);
          if (isCamara) {
            r.estado = "conciliado";
            r.hits = toHits([l]);
            r.comprobantes = [l.base];
            r.totalSiigo = r.totalDian;
            r.diferencia = 0;
            r.matchVia = `certificado/factura CCB en ${l.base}`;
            r.alerta = `Registrado en libros en comprobante ${l.base} ($${r.totalDian.toLocaleString("es-CO")}).`;
          } else {
            r.estado = "posible_typo";
            r.hits = toHits([l]);
            r.comprobantes = [l.base];
            r.totalSiigo = l.amt;
            r.diferencia = round2(r.totalDian - l.amt);
            r.matchVia = `posible digitación ${l.cruce || l.base}`;
            r.alerta = `En libros aparece comprobante ${l.base} (${l.cruce || "sin cruce"}) por el mismo valor ($${r.totalDian.toLocaleString("es-CO")}), pero con folio/prefijo diferente. Revisar registro.`;
          }
          usedBases.add(l.base);
          break;
        }
      }
    });

  const cruzes = findCruzes(rows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const c of cruzes) {
    const f = byId.get(c.facturaId);
    const n = byId.get(c.notaId);
    if (f && n) {
      f.linked.push({ id: n.id, numero: n.numero, tipo: n.tipo, total: n.totalDian });
      n.linked.push({ id: f.id, numero: f.numero, tipo: f.tipo, total: f.totalDian });
      if (f.estado === "pendiente") f.estado = "cruce_nc";
      if (n.estado === "pendiente") n.estado = "cruce_nc";
    }
  }

  const orphans: OrphanMov[] = [];
  const seenOrphan = new Set<string>();
  indexed.forEach((l, i) => {
    if (!l.base || usedBases.has(l.base)) return;
    if (!/^[FPU]\s/.test(l.comprobante)) return;
    if (seenOrphan.has(l.base)) return;
    seenOrphan.add(l.base);
    orphans.push({
      id: `o-${i}`,
      comprobante: l.base,
      fecha: l.fecha,
      nit: l.nit,
      nombre: l.nombre,
      descripcion: l.descripcion,
      cruce: l.cruce,
      cuenta: l.cuenta,
      debito: l.debito,
      credito: l.credito,
    });
  });

  const op = rows.filter((r) => r.estado !== "no_aplica");
  const recibidos = op.filter((r) => r.prioridad === "audit");
  const pendientesRec = recibidos.filter((r) => r.estado === "pendiente");
  const conciliadosRec = recibidos.filter(
    (r) => r.estado === "conciliado" || r.estado === "cruce_nc" || r.estado === "totalizado",
  );
  const duplicados = op.filter((r) => r.estado === "duplicado").length;
  const diferencias = op.filter((r) => r.estado === "diferencia").length;
  const pendientes = op.filter((r) => r.estado === "pendiente").length;
  const totalizados = op.filter((r) => r.estado === "totalizado").length;
  const colaRows = op.filter(inCola);
  const cola = colaRows.length;

  const periodWarning = checkPeriodMatch(dian, mov);

  return {
    periodLabel,
    company,
    rows,
    orphans,
    cruzes,
    periodWarning,
    totals: {
      documentos: op.length,
      recibidos: recibidos.length,
      conciliados: op.filter((r) => r.estado === "conciliado").length,
      totalizados,
      pendientes,
      pendientesRecibidos: pendientesRec.length,
      diferencias,
      duplicados,
      crucesNc: cruzes.length,
      noAplica: rows.filter((r) => r.estado === "no_aplica").length,
      soloSiigo: orphans.length,
      valorDian: recibidos.reduce((s, r) => s + r.totalDian, 0),
      valorPendiente: op.filter((r) => r.estado === "pendiente").reduce((s, r) => s + r.totalDian, 0),
      valorPendienteRecibido: pendientesRec.reduce((s, r) => s + r.totalDian, 0),
      valorTotalizado: op.filter((r) => r.estado === "totalizado").reduce((s, r) => s + r.totalDian, 0),
      valorDiferencia: op.filter((r) => r.estado === "diferencia").reduce((s, r) => s + Math.abs(r.diferencia), 0),
      pctRecibidos: recibidos.length ? conciliadosRec.length / recibidos.length : 0,
      pctConciliado: op.length ? (op.filter((r) => r.estado === "conciliado").length + totalizados) / op.length : 0,
      cola,
      valorCola: colaRows.reduce((s, r) => s + Math.abs(r.totalDian), 0),
    },
  };
}

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatPeriodKey(ym: string): string {
  const [y, m] = ym.split("-");
  const mesIndex = Number(m) - 1;
  if (mesIndex >= 0 && mesIndex < 12) {
    return `${MESES[mesIndex]} de ${y}`;
  }
  return ym;
}

export function checkPeriodMatch(dian: DianDoc[], mov: MovLine[]): string | undefined {
  const dianCounts = new Map<string, number>();
  for (const d of dian) {
    const f = (d.fechaEmision || d.fechaRecepcion || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(f)) {
      dianCounts.set(f, (dianCounts.get(f) || 0) + 1);
    }
  }

  const movCounts = new Map<string, number>();
  for (const m of mov) {
    const f = (m.fecha || "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(f)) {
      movCounts.set(f, (movCounts.get(f) || 0) + 1);
    }
  }

  if (!dianCounts.size || !movCounts.size) return undefined;

  const topDian = [...dianCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topMov = [...movCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  if (!topDian || !topMov) return undefined;

  if (topDian[0] !== topMov[0]) {
    const pDian = formatPeriodKey(topDian[0]);
    const pMov = formatPeriodKey(topMov[0]);
    return `Advertencia de período: El reporte DIAN contiene principalmente documentos de ${pDian}, mientras que el archivo contable contiene movimientos de ${pMov}. Verifica que ambos correspondan al mismo mes fiscal.`;
  }

  return undefined;
}


export function inCola(r: ConciliacionRow): boolean {
  if (r.estado === "pendiente" && r.prioridad === "audit") return true;
  if (r.estado === "duplicado") return true;
  if (r.estado === "diferencia") return true;
  if (r.estado === "cruce_nc") return true;
  if (r.estado === "posible_typo") return true;
  return false;
}


export const ESTADO_LABEL: Record<EstadoConciliacion, string> = {
  conciliado: "Registrado",
  totalizado: "Totalizado",
  diferencia: "Diferencia",
  pendiente: "Por registrar",
  no_aplica: "No aplica",
  solo_siigo: "Solo contabilidad",
  duplicado: "Doble registro",
  cruce_nc: "Cruce factura / NC",
  posible_typo: "Revisar folio",
};
