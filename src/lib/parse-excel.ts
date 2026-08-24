import * as XLSX from "xlsx";
import type { DianDoc, MovLine } from "./types";

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function cellNum(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const n = Number(String(v).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function cellDate(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "number") {
    const parsed = XLSX.SSF.parse_date_code(v);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  const s = cellStr(v);
  const m1 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  const m2 = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
  return s.slice(0, 10);
}

function normHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function col(map: Map<string, number>, aliases: string[]): number | undefined {
  for (const a of aliases) {
    const i = map.get(normHeader(a));
    if (i != null) return i;
  }
  for (const [k, i] of map) {
    for (const a of aliases) {
      if (k.includes(normHeader(a))) return i;
    }
  }
  return undefined;
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: "array", cellDates: true });
}

export function getWorkbookSheets(wb: XLSX.WorkBook): string[] {
  return wb.SheetNames || [];
}

export function findBestDianSheet(wb: XLSX.WorkBook): string {
  const names = wb.SheetNames || [];
  if (!names.length) return "";
  if (names.length === 1) return names[0];

  for (const name of names) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });
    if (!rows.length) continue;
    const firstFew = rows.slice(0, 5).flat().map((c) => normHeader(cellStr(c)));
    const hasDian = firstFew.some((h) => h.includes("cufe") || h.includes("folio") || h.includes("nit emisor"));
    if (hasDian) return name;
  }
  return names[0];
}

export function findBestMovSheet(wb: XLSX.WorkBook): string {
  const names = wb.SheetNames || [];
  if (!names.length) return "";
  if (names.length === 1) return names[0];

  for (const name of names) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    });
    if (!rows.length) continue;
    const text = rows.slice(0, 20).map((r) => r.map((c) => cellStr(c).toUpperCase()).join(" ")).join(" ");
    if (text.includes("COMPROBANTE") && text.includes("DEBITO")) return name;
    if (text.includes("CUENTA") && (text.includes("DEBITO") || text.includes("CREDITO"))) return name;
  }
  return names[0];
}

export function parseDianSheet(wb: XLSX.WorkBook, sheetName?: string): DianDoc[] {
  const chosenSheet = sheetName && wb.Sheets[sheetName] ? sheetName : findBestDianSheet(wb);
  const sheet = wb.Sheets[chosenSheet];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  if (!rows.length) return [];
  const headerRow = rows[0].map((c) => cellStr(c));
  const map = new Map<string, number>();
  headerRow.forEach((h, i) => map.set(normHeader(h), i));

  const iTipo = col(map, ["tipo de documento", "tipo"]);
  const iCufe = col(map, ["cufe/cude", "cufe"]);
  const iFolio = col(map, ["folio"]);
  const iPref = col(map, ["prefijo"]);
  const iFe = col(map, ["fecha emision"]);
  const iFr = col(map, ["fecha recepcion"]);
  const iNe = col(map, ["nit emisor"]);
  const iNome = col(map, ["nombre emisor"]);
  const iNr = col(map, ["nit receptor"]);
  const iNomr = col(map, ["nombre receptor"]);
  const iIva = col(map, ["iva"]);
  const iTot = col(map, ["total"]);
  const iEst = col(map, ["estado"]);
  const iGr = col(map, ["grupo"]);

  const out: DianDoc[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;
    const tipo = iTipo != null ? cellStr(row[iTipo]) : "";
    if (!tipo) continue;
    out.push({
      tipo,
      cufe: iCufe != null ? cellStr(row[iCufe]) : "",
      folio: iFolio != null ? cellStr(row[iFolio]) : "",
      prefijo: iPref != null ? cellStr(row[iPref]) : "",
      fechaEmision: iFe != null ? cellDate(row[iFe]) : "",
      fechaRecepcion: iFr != null ? cellDate(row[iFr]) : "",
      nitEmisor: iNe != null ? cellStr(row[iNe]) : "",
      nombreEmisor: iNome != null ? cellStr(row[iNome]) : "",
      nitReceptor: iNr != null ? cellStr(row[iNr]) : "",
      nombreReceptor: iNomr != null ? cellStr(row[iNomr]) : "",
      iva: iIva != null ? cellNum(row[iIva]) : 0,
      total: iTot != null ? cellNum(row[iTot]) : 0,
      estadoDian: iEst != null ? cellStr(row[iEst]) : "",
      grupo: iGr != null ? cellStr(row[iGr]) : "",
    });
  }
  return out;
}

export function parseMovSheet(wb: XLSX.WorkBook, sheetName?: string): MovLine[] {
  const chosenSheet = sheetName && wb.Sheets[sheetName] ? sheetName : findBestMovSheet(wb);
  const sheet = wb.Sheets[chosenSheet];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const joined = rows[i].map((c) => cellStr(c).toUpperCase()).join(" ");
    if (joined.includes("COMPROBANTE") && (joined.includes("DEBITO") || joined.includes("DEBITOS"))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) headerIdx = 0;
  const headerRow = rows[headerIdx].map((c) => cellStr(c));
  const map = new Map<string, number>();
  headerRow.forEach((h, i) => map.set(normHeader(h), i));

  const iCta = col(map, ["cuenta"]) ?? 1;
  const iCtaNom = 2;
  const iComp = col(map, ["comprobante"]) ?? 4;
  const iFecha = col(map, ["fecha"]) ?? 5;
  const iNit = col(map, ["nit"]) ?? 6;
  const iNom = col(map, ["nombre"]) ?? 7;
  const iDesc = col(map, ["descripcion"]) ?? 8;
  const iCruce = col(map, ["inventario-cruce-cheque", "cruce"]) ?? 9;
  const iDeb = col(map, ["debitos", "debito"]) ?? 12;
  const iCred = col(map, ["creditos", "credito"]) ?? 13;
  const iObs = col(map, ["observacion"]) ?? 15;

  const out: MovLine[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const first = cellStr(row[0]);
    if (first.toLowerCase().startsWith("total")) continue;
    const cuenta = cellStr(row[iCta]);
    if (!cuenta) continue;
    const nitRaw = cellStr(row[iNit]);
    out.push({
      cuenta,
      cuentaNombre: cellStr(row[iCtaNom]),
      comprobante: cellStr(row[iComp]),
      fecha: cellDate(row[iFecha]),
      nit: nitRaw === "0" ? "" : nitRaw,
      nombre: cellStr(row[iNom]),
      descripcion: cellStr(row[iDesc]),
      cruce: cellStr(row[iCruce]),
      debito: cellNum(row[iDeb]),
      credito: cellNum(row[iCred]),
      observacion: cellStr(row[iObs]).slice(0, 400),
    });
  }
  return out;
}

