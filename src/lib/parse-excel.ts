import * as XLSX from "xlsx";
import type { ColumnMapping, DetectedProfile, DianDoc, MovLine, SoftwareProfileId } from "./types.ts";
import { detectSoftwareProfile } from "./software-profiles.ts";

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

function cellNum(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s/g, "");
  if (!s) return 0;

  // Manejar negativos con paréntesis: (1234.56) -> -1234.56
  let isNegative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    isNegative = true;
    s = s.slice(1, -1).trim();
  } else if (s.startsWith("-")) {
    isNegative = true;
    s = s.slice(1).trim();
  }

  // Quitar símbolos de moneda
  s = s.replace(/[$€COPcop]/g, "").trim();

  // Detección inteligente de separador de miles vs decimal
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // Formato latino/europeo: 1.234.567,89
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato anglosajón: 1,234,567.89
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // Solo comas: si tiene exactamente 3 dígitos al final (ej. 1,000 o 25,000) podría ser miles, pero comúnmente 12,50
    // Si tiene más de una coma o coma seguida de 2 decimales
    const parts = s.split(",");
    if (parts.length > 2) {
      s = s.replace(/,/g, "");
    } else if (parts[1] && parts[1].length <= 2) {
      s = s.replace(",", ".");
    } else if (parts[1] && parts[1].length === 3 && parts[0].length <= 3) {
      // Probablemente separador de miles sin decimales: "25,000"
      s = s.replace(",", "");
    } else {
      s = s.replace(",", ".");
    }
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return isNegative ? -n : n;
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
    try {
      const SSF = (XLSX as any).SSF;
      if (SSF && typeof SSF.parse_date_code === "function") {
        const parsed = SSF.parse_date_code(v);
        if (parsed) {
          return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        }
      }
    } catch {
      // ignore
    }
    // Fallback matemático exacto para números seriales de fecha de Excel
    if (v > 20000 && v < 70000) {
      const date = new Date(Math.round((v - 25569) * 86400 * 1000));
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().slice(0, 10);
      }
    }
  }
  const s = cellStr(v).trim();
  if (!s || s.startsWith("0000") || s === "0") return "";
  const m1 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m1) {
    const y = m1[3];
    if (y !== "0000" && Number(y) >= 1900) {
      return `${y}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
    }
  }
  const m2 = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (m2) {
    const y = m2[1];
    if (y !== "0000" && Number(y) >= 1900) {
      return `${y}-${m2[2].padStart(2, "0")}-${m2[3].padStart(2, "0")}`;
    }
  }
  return "";
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
    if (text.includes("DOCUMENTO DE REFERENCIA") || text.includes("DOC. FUENTE") || text.includes("CHEQUE / REFERENCIA")) return name;
    if (text.includes("NIT") && (text.includes("DEBITO") || text.includes("CREDITO"))) return name;
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

export type ParseMovOptions = {
  mapping?: ColumnMapping;
  profileId?: SoftwareProfileId;
  headerRow?: number;
};

/**
 * Inspecciona la hoja de movimientos contables y extrae la detección de perfil y muestra de filas.
 */
export function inspectMovSheet(
  wb: XLSX.WorkBook,
  sheetName?: string,
): {
  detectedProfile: DetectedProfile;
  rowsSample: string[][];
  totalRows: number;
} {
  const chosenSheet = sheetName && wb.Sheets[sheetName] ? sheetName : findBestMovSheet(wb);
  const sheet = wb.Sheets[chosenSheet];
  if (!sheet) {
    return {
      detectedProfile: {
        id: "custom",
        label: "Sin hoja",
        confidence: 0,
        headerRow: 0,
        mapping: {},
        detectedHeaders: [],
      },
      rowsSample: [],
      totalRows: 0,
    };
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });

  const detectedProfile = detectSoftwareProfile(rows);

  const start = detectedProfile.headerRow;
  const sample = rows.slice(start, start + 6).map((r) => r.map((c) => cellStr(c)));

  return {
    detectedProfile,
    rowsSample: sample,
    totalRows: rows.length,
  };
}

export function parseMovSheet(
  wb: XLSX.WorkBook,
  sheetName?: string,
  options?: ParseMovOptions,
): MovLine[] {
  const chosenSheet = sheetName && wb.Sheets[sheetName] ? sheetName : findBestMovSheet(wb);
  const sheet = wb.Sheets[chosenSheet];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  if (!rows.length) return [];

  const detected = detectSoftwareProfile(rows);
  const headerIdx = options?.headerRow ?? detected.headerRow;
  const mapping = options?.mapping ?? detected.mapping;

  const iCta = mapping.cuenta;
  const iCtaNom = mapping.cuentaNombre;
  const iComp = mapping.comprobante;
  const iFecha = mapping.fecha;
  const iNit = mapping.nit;
  const iNom = mapping.nombre;
  const iDesc = mapping.descripcion;
  const iCruce = mapping.cruce;
  const iRef = mapping.referencia;
  const iDeb = mapping.debito;
  const iCred = mapping.credito;
  const iObs = mapping.observacion;

  const out: MovLine[] = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !row.length) continue;

    // Omitir filas de totales o vacías
    const first = cellStr(row[0]);
    if (first.toLowerCase().startsWith("total") || first.toLowerCase().startsWith("resumen")) continue;

    const cuenta = iCta != null ? cellStr(row[iCta]) : "";
    const debito = iDeb != null ? cellNum(row[iDeb]) : 0;
    const credito = iCred != null ? cellNum(row[iCred]) : 0;

    const comprobante = iComp != null ? cellStr(row[iComp]).trim() : "";
    const fecha = iFecha != null ? cellDate(row[iFecha]) : "";

    // Si no tiene cuenta y no tiene valores contables, es una fila vacía o de adorno
    if (!cuenta && debito === 0 && credito === 0) continue;

    // Omitir filas de saldos iniciales (sin débito ni crédito y sin comprobante real o fecha válida)
    if (debito === 0 && credito === 0 && (!comprobante || /^0\s+000/.test(comprobante) || !fecha)) {
      continue;
    }

    const nitRaw = iNit != null ? cellStr(row[iNit]) : "";
    const cleanNit = nitRaw === "0" ? "" : nitRaw.replace(/\s+/g, "").trim();

    out.push({
      cuenta: cuenta || "CUENTA",
      cuentaNombre: iCtaNom != null ? cellStr(row[iCtaNom]) : "",
      comprobante,
      fecha,
      nit: cleanNit,
      nombre: iNom != null ? cellStr(row[iNom]) : "",
      descripcion: iDesc != null ? cellStr(row[iDesc]) : "",
      cruce: iCruce != null ? cellStr(row[iCruce]) : "",
      referencia: iRef != null ? cellStr(row[iRef]) : "",
      debito,
      credito,
      observacion: iObs != null ? cellStr(row[iObs]).slice(0, 400) : "",
      origenSoftware: detected.id,
    });
  }
  return out;
}

