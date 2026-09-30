import { getDocumentProxy, extractText } from "unpdf";
import * as XLSX from "xlsx";
import type { BankExtractItem } from "./conciliar-bancos.ts";
import { parsePdfBankExtract, type BankSubAccount } from "./parse-bank-extract.ts";
import type { MovLine } from "./types.ts";

export interface UniversalColumnMapping {
  headerRow: number;
  fechaCol: number;
  descripcionCol: number;
  referenciaCol: number;
  valorMode: "separate" | "single"; // "separate" (debito + credito) o "single" (columna única con signo)
  debitoCol?: number;
  creditoCol?: number;
  valorCol?: number;
  saldoCol?: number;
}

export interface UniversalExtractPreview {
  fileName: string;
  fileType: "pdf" | "excel" | "csv";
  bancoDetectado: string;
  bancoId?: string;
  numeroCuenta?: string;
  totalFilas: number;
  headers: string[];
  rawRowsSample: string[][];
  config: UniversalColumnMapping;
  items: BankExtractItem[];
  cuentasDisponibles?: BankSubAccount[];
  saldoInicial?: number;
  saldoFinal?: number;
  totalDebitos: number;
  totalCreditos: number;
}

const MONTH_MAP: Record<string, string> = {
  ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06",
  JUL: "07", AGO: "08", SEP: "09", OCT: "10", NOV: "11", DIC: "12",
  JAN: "01", APR: "04", AUG: "08", DEC: "12",
};

/**
 * Parsea un número en formato monetario latino o anglosajón
 */
export function cleanMoneyNumber(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  let s = String(raw).trim().replace(/\s/g, "");
  if (!s) return 0;

  let isNegative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    isNegative = true;
    s = s.slice(1, -1).trim();
  } else if (s.startsWith("-")) {
    isNegative = true;
    s = s.slice(1).trim();
  }

  s = s.replace(/[$€COPcopUSD]/g, "").trim();

  const hasDot = s.includes(".");
  const hasComma = s.includes(",");

  if (hasDot && hasComma) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      // 1.234.567,89 (Latino / Europeo)
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234,567.89 (Anglosajón)
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const parts = s.split(",");
    if (parts.length > 2) {
      s = s.replace(/,/g, "");
    } else if (parts[1] && parts[1].length <= 2) {
      s = s.replace(",", ".");
    } else if (parts[1] && parts[1].length === 3 && parts[0].length <= 3) {
      s = s.replace(",", "");
    } else {
      s = s.replace(",", ".");
    }
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return isNegative ? -n : n;
}

/**
 * Normaliza fechas de cualquier banco colombiano o internacional a formato ISO YYYY-MM-DD
 */
export function normalizeUniversalDate(dStr: string, fallbackYear?: string): string {
  const s = String(dStr || "").trim();
  if (!s) return "";

  const currentYear = fallbackYear || String(new Date().getFullYear());

  // Formato YYYY-MM-DD o YYYY/MM/DD
  const mIso = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (mIso) {
    return `${mIso[1]}-${mIso[2].padStart(2, "0")}-${mIso[3].padStart(2, "0")}`;
  }

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const mFull = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (mFull) {
    return `${mFull[3]}-${mFull[2].padStart(2, "0")}-${mFull[1].padStart(2, "0")}`;
  }

  // Formato DD/MMM/YY o DD-MMM-YYYY (ej. 28/Ago/26, 15-ENE-2026)
  const mText = s.match(/^(\d{1,2})[/-]([A-Za-z]{3})[/-](\d{2,4})/);
  if (mText) {
    const day = mText[1].padStart(2, "0");
    const mCode = mText[2].toUpperCase().slice(0, 3);
    const month = MONTH_MAP[mCode] || "01";
    let yr = mText[3];
    if (yr.length === 2) yr = `20${yr}`;
    return `${yr}-${month}-${day}`;
  }

  // Formato MMM DD (ej. AGO 04, SEP 15)
  const mMmmDd = s.match(/^([A-Za-z]{3})\s+(\d{1,2})/);
  if (mMmmDd) {
    const mCode = mMmmDd[1].toUpperCase().slice(0, 3);
    const month = MONTH_MAP[mCode] || "01";
    const day = mMmmDd[2].padStart(2, "0");
    return `${currentYear}-${month}-${day}`;
  }

  // Formato DD MMM YYYY (ej. 04 AGO 2026)
  const mDdMmmYy = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (mDdMmmYy) {
    const day = mDdMmmYy[1].padStart(2, "0");
    const mCode = mDdMmmYy[2].toUpperCase().slice(0, 3);
    const month = MONTH_MAP[mCode] || "01";
    const yr = mDdMmmYy[3];
    return `${yr}-${month}-${day}`;
  }

  return s;
}

function normStr(str: unknown): string {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Auto-detecta las columnas de un archivo de extracto bancario en Excel o CSV
 */
export function detectUniversalBankColumns(rawRows: any[][]): UniversalColumnMapping {
  let headerRow = 0;

  // Buscar fila de encabezados en las primeras 25 filas
  for (let r = 0; r < Math.min(rawRows.length, 25); r++) {
    const row = rawRows[r] || [];
    const line = row.map(normStr).join(" ");

    const hasDate = line.includes("fecha") || line.includes("date") || line.includes("dia");
    const hasMoney =
      line.includes("debito") ||
      line.includes("credito") ||
      line.includes("retiro") ||
      line.includes("abono") ||
      line.includes("deposito") ||
      line.includes("cargo") ||
      line.includes("valor") ||
      line.includes("monto") ||
      line.includes("saldo");

    if (hasDate && hasMoney) {
      headerRow = r;
      break;
    }
  }

  const headers = (rawRows[headerRow] || []).map(normStr);

  let fechaCol = headers.findIndex((h) => h.includes("fecha") || h.includes("date") || h === "fec");
  let descripcionCol = headers.findIndex(
    (h) => h.includes("descrip") || h.includes("detalle") || h.includes("concepto") || h.includes("transaccion") || h.includes("movimiento")
  );
  let referenciaCol = headers.findIndex(
    (h) => h.includes("ref") || h.includes("doc") || h.includes("comprobante") || h.includes("cheque") || h.includes("lote") || h.includes("autoriz")
  );

  let debitoCol = headers.findIndex(
    (h) => h.includes("deb") || h.includes("retiro") || h.includes("cargo") || h.includes("egreso") || h.includes("salida")
  );
  let creditoCol = headers.findIndex(
    (h) => h.includes("cred") || h.includes("dep") || h.includes("abono") || h.includes("ingreso") || h.includes("entrada")
  );
  let valorCol = headers.findIndex((h) => h.includes("valor") || h.includes("monto") || h.includes("importe") || h.includes("neto"));
  let saldoCol = headers.findIndex((h) => h.includes("saldo") || h.includes("balance"));

  // Fallbacks razonables
  if (fechaCol === -1) fechaCol = 0;
  if (descripcionCol === -1) descripcionCol = Math.min(1, headers.length - 1);
  if (referenciaCol === -1) referenciaCol = Math.min(2, headers.length - 1);

  let valorMode: "separate" | "single" = "separate";
  if ((debitoCol === -1 || creditoCol === -1) && valorCol !== -1) {
    valorMode = "single";
  } else if (debitoCol === -1 && creditoCol === -1) {
    debitoCol = 3;
    creditoCol = 4;
  }

  return {
    headerRow,
    fechaCol,
    descripcionCol,
    referenciaCol,
    valorMode,
    debitoCol: debitoCol !== -1 ? debitoCol : undefined,
    creditoCol: creditoCol !== -1 ? creditoCol : undefined,
    valorCol: valorCol !== -1 ? valorCol : undefined,
    saldoCol: saldoCol !== -1 ? saldoCol : undefined,
  };
}

/**
 * Parsea las filas de un Excel/CSV según la configuración de mapeo
 */
export function parseUniversalBankRows(rawRows: any[][], config: UniversalColumnMapping): BankExtractItem[] {
  const items: BankExtractItem[] = [];

  for (let r = config.headerRow + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !row.length) continue;

    const fRaw = String(row[config.fechaCol] || "").trim();
    if (!fRaw) continue;

    const desc = config.descripcionCol !== -1 ? String(row[config.descripcionCol] || "").trim() : "";
    const ref = config.referenciaCol !== -1 ? String(row[config.referenciaCol] || "").trim() : "";

    let debito = 0;
    let credito = 0;

    if (config.valorMode === "separate") {
      if (config.debitoCol !== undefined) {
        debito = Math.abs(cleanMoneyNumber(row[config.debitoCol]));
      }
      if (config.creditoCol !== undefined) {
        credito = Math.abs(cleanMoneyNumber(row[config.creditoCol]));
      }
    } else if (config.valorCol !== undefined) {
      const val = cleanMoneyNumber(row[config.valorCol]);
      if (val < 0) {
        debito = Math.abs(val);
      } else {
        credito = val;
      }
    }

    const saldo = config.saldoCol !== undefined ? cleanMoneyNumber(row[config.saldoCol]) : undefined;

    if (debito > 0 || credito > 0) {
      items.push({
        id: `univ_${r}`,
        fecha: normalizeUniversalDate(fRaw),
        descripcion: desc || "Movimiento Bancario",
        referencia: ref,
        debito,
        credito,
        saldo,
      });
    }
  }

  return items;
}

/**
 * Extractor Universal de cualquier PDF bancario en Colombia
 * Escanea de forma resiliente fechas, conceptos, referencias y valores débito/crédito
 */
export async function parseUniversalPdfBankExtract(
  buffer: ArrayBuffer | Uint8Array
): Promise<UniversalExtractPreview> {
  const uint8 =
    buffer instanceof Uint8Array
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new Uint8Array(buffer);

  const doc = await getDocumentProxy(uint8);
  const { text: pages } = await extractText(doc, { mergePages: false });
  const fullText = pages.join("\n");

  // Identificar entidad si coincide con alguna firma
  let bancoDetectado = "Entidad Financiera";
  if (/bancolombia/i.test(fullText)) bancoDetectado = "Bancolombia S.A.";
  else if (/davivienda/i.test(fullText)) bancoDetectado = "Banco Davivienda S.A.";
  else if (/banco\s*de\s*bogot[aá]/i.test(fullText)) bancoDetectado = "Banco de Bogotá";
  else if (/bbva/i.test(fullText)) bancoDetectado = "BBVA Colombia";
  else if (/occidente/i.test(fullText)) bancoDetectado = "Banco de Occidente";
  else if (/colpatria|scotiabank/i.test(fullText)) bancoDetectado = "Scotiabank Colpatria";
  else if (/ita[uú]/i.test(fullText)) bancoDetectado = "Banco Itaú Colombia";
  else if (/caja\s*social|bcsc/i.test(fullText)) bancoDetectado = "Banco Caja Social";
  else if (/credicorp/i.test(fullText)) bancoDetectado = "Credicorp Capital";
  else if (/banistmo/i.test(fullText)) bancoDetectado = "Banistmo S.A.";
  else if (/nequi/i.test(fullText)) bancoDetectado = "Nequi Colombia";
  else if (/daviplata/i.test(fullText)) bancoDetectado = "Daviplata";

  // Intentar detectar saldo inicial y final
  const saldoIniMatch = fullText.match(
    /(?:Saldo\s*(?:Anterior|Inicial|Disponible\s*Anterior|Total\s*Anterior)|Balance\s*Inicial)\s*[:.]?\s*(\$[\d,.]+|[\d,.]+)/i
  );
  const saldoInicial = saldoIniMatch ? cleanMoneyNumber(saldoIniMatch[1]) : 0;

  const saldoFinMatch = fullText.match(
    /(?:Nuevo\s*Saldo|Saldo\s*(?:Final|Actual|Disponible)|Balance\s*Final)\s*[:.]?\s*(\$[\d,.]+|[\d,.]+)/i
  );
  const saldoFinal = saldoFinMatch ? cleanMoneyNumber(saldoFinMatch[1]) : 0;

  const items: BankExtractItem[] = [];
  const currentYear = String(new Date().getFullYear());

  for (const page of pages) {
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Busca líneas con fecha al inicio
      const dateMatch = line.match(
        /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}[/-][A-Za-z]{3}[/-]\d{2,4}|[A-Za-z]{3}\s+\d{1,2}|\d{1,2}\s+[A-Za-z]{3})/
      );

      if (dateMatch) {
        // Encontrar todos los montos de la línea
        const amounts = line.match(/-?\$?[\d,.]+\.\d{2}|-?\$?[\d.]+,\d{2}/g);
        if (amounts && amounts.length >= 1) {
          const f = normalizeUniversalDate(dateMatch[1], currentYear);

          // Extraer descripción quitando la fecha y los montos
          let desc = line.replace(dateMatch[0], "").trim();
          for (const a of amounts) {
            desc = desc.replace(a, "");
          }
          desc = desc.replace(/\s+/g, " ").trim();

          // Buscar si hay líneas de texto adicionales siguientes
          let j = i + 1;
          while (j < lines.length) {
            const nextL = lines[j];
            if (
              /^(\d{1,2}[/-]\d{1,2}|[A-Za-z]{3}\s+\d{1,2})/.test(nextL) ||
              nextL.startsWith("Pag.") ||
              nextL.startsWith("Página") ||
              nextL.startsWith("PAG.")
            ) {
              break;
            }
            // Si la línea siguiente no tiene fecha y tiene texto explicativo
            if (nextL.length > 2 && !nextL.includes("$$")) {
              desc += ` ${nextL}`;
            }
            j++;
            if (j - i > 3) break;
          }
          i = j - 1;

          // Extraer referencia si existe un código numérico o alfanumérico
          const refMatch = desc.match(/\b([A-Z0-9-]{6,16})\b/);
          const ref = refMatch ? refMatch[1] : "";

          // Determinar Débito vs Crédito
          const val1 = cleanMoneyNumber(amounts[0]);
          const val2 = amounts[1] ? cleanMoneyNumber(amounts[1]) : 0;
          const val3 = amounts[2] ? cleanMoneyNumber(amounts[2]) : undefined;

          let debito = 0;
          let credito = 0;

          if (amounts.length >= 2 && val1 > 0 && val2 > 0) {
            // Dos columnas de valores
            debito = val1;
            credito = val2;
          } else {
            const isRetiro =
              val1 < 0 ||
              /retiro|debito|d[eé]bito|gmf|4x1000|comisi[oó]n|pago|egreso|salida|compra/i.test(desc);

            if (isRetiro) {
              debito = Math.abs(val1);
            } else {
              credito = Math.abs(val1);
            }
          }

          items.push({
            id: `updf_${items.length + 1}`,
            fecha: f,
            descripcion: desc || "Movimiento Extracto",
            referencia: ref,
            debito,
            credito,
            saldo: val3,
          });
        }
      }
    }
  }

  const totalDebitos = items.reduce((a, b) => a + b.debito, 0);
  const totalCreditos = items.reduce((a, b) => a + b.credito, 0);

  return {
    fileName: "extracto-bancario.pdf",
    fileType: "pdf",
    bancoDetectado,
    totalFilas: items.length,
    headers: ["Fecha", "Descripción / Detalle", "Referencia", "Débito / Retiro", "Crédito / Abono", "Saldo"],
    rawRowsSample: items.slice(0, 5).map((it) => [it.fecha, it.descripcion, it.referencia, String(it.debito), String(it.credito), String(it.saldo || "")]),
    config: {
      headerRow: 0,
      fechaCol: 0,
      descripcionCol: 1,
      referenciaCol: 2,
      valorMode: "separate",
      debitoCol: 3,
      creditoCol: 4,
      saldoCol: 5,
    },
    items,
    saldoInicial,
    saldoFinal: saldoFinal || saldoInicial + totalCreditos - totalDebitos,
    totalDebitos,
    totalCreditos,
  };
}

/**
 * Lee un archivo de extracto (PDF, Excel o CSV) y genera la previsualización y extracción universal
 */
export async function processUniversalExtractFile(file: File): Promise<UniversalExtractPreview> {
  const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type.includes("pdf");
  const buffer = await file.arrayBuffer();

  if (isPdf) {
    try {
      const specialized = await parsePdfBankExtract(buffer);
      if (specialized && specialized.items.length > 0) {
        return {
          fileName: file.name,
          fileType: "pdf",
          bancoDetectado: specialized.bancoNombre,
          bancoId: specialized.bancoId,
          numeroCuenta: specialized.numeroCuenta,
          totalFilas: specialized.items.length,
          headers: ["Fecha", "Descripción / Detalle", "Referencia", "Débito / Retiro", "Crédito / Abono", "Saldo"],
          rawRowsSample: specialized.items.slice(0, 5).map((it) => [
            it.fecha,
            it.descripcion,
            it.referencia || "",
            String(it.debito),
            String(it.credito),
            String(it.saldo || ""),
          ]),
          config: {
            headerRow: 0,
            fechaCol: 0,
            descripcionCol: 1,
            referenciaCol: 2,
            valorMode: "separate",
            debitoCol: 3,
            creditoCol: 4,
            saldoCol: 5,
          },
          items: specialized.items,
          cuentasDisponibles: specialized.cuentasDisponibles,
          saldoInicial: specialized.saldoInicial,
          saldoFinal: specialized.saldoFinal,
          totalDebitos: specialized.totalDebitos,
          totalCreditos: specialized.totalCreditos,
        };
      }
    } catch (e) {
      console.warn("Fallo en parsePdfBankExtract especializado, usando fallback universal:", e);
    }

    return parseUniversalPdfBankExtract(buffer);
  }

  // Si es Excel o CSV
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const config = detectUniversalBankColumns(rawRows);
  const items = parseUniversalBankRows(rawRows, config);

  const headers = (rawRows[config.headerRow] || []).map((c) => String(c || ""));
  const sample = rawRows.slice(config.headerRow + 1, config.headerRow + 6).map((r) => r.map((c) => String(c || "")));

  const totalDebitos = items.reduce((a, b) => a + b.debito, 0);
  const totalCreditos = items.reduce((a, b) => a + b.credito, 0);

  return {
    fileName: file.name,
    fileType: file.name.toLowerCase().endsWith(".csv") ? "csv" : "excel",
    bancoDetectado: "Entidad Financiera (Excel/CSV)",
    totalFilas: rawRows.length,
    headers,
    rawRowsSample: sample,
    config,
    items,
    saldoInicial: 0,
    saldoFinal: totalCreditos - totalDebitos,
    totalDebitos,
    totalCreditos,
  };
}
