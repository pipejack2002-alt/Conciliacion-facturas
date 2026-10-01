import { getDocumentProxy, extractText } from "unpdf";
import * as XLSX from "xlsx";
import type { BankExtractItem } from "./conciliar-bancos.ts";

export type BankId =
  | "banco_caja_social"
  | "credicorp"
  | "banistmo"
  | "bancolombia"
  | "davivienda"
  | "generico";

export interface BankSubAccount {
  id: string;
  nombre: string;
  numeroCuenta?: string;
  saldoInicial: number;
  saldoFinal: number;
  totalDebitos: number;
  totalCreditos: number;
  items: BankExtractItem[];
}

export interface ParsedBankExtractResult {
  bancoId: BankId;
  bancoNombre: string;
  numeroCuenta: string;
  titular?: string;
  periodo: string;
  saldoInicial: number;
  saldoFinal: number;
  totalDebitos: number;
  totalCreditos: number;
  items: BankExtractItem[];
  cuentasDisponibles?: BankSubAccount[];
}

const MONTH_MAP: Record<string, string> = {
  ENE: "01",
  FEB: "02",
  MAR: "03",
  ABR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AGO: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DIC: "12",
  JAN: "01",
  APR: "04",
  AUG: "08",
  DEC: "12",
};

/**
 * Parsea un número en formato monetario latino o anglosajón
 */
function cleanMoneyNumber(raw: unknown): number {
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
 * Normaliza fechas variadas (AGO 04, 28/Ago/26, 2026-08-04, 04/08/2026, 04-08-2026) a ISO YYYY-MM-DD
 */
function normalizeDate(dStr: string, fallbackYear = "2026"): string {
  const s = String(dStr || "").trim();
  if (!s) return "";

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Formato DD/MM/YYYY o DD-MM-YYYY
  const mFull = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mFull) {
    return `${mFull[3]}-${mFull[2].padStart(2, "0")}-${mFull[1].padStart(2, "0")}`;
  }

  // Formato DD/MMM/YY o DD/MMM/YYYY (ej. 28/Ago/26)
  const mText = s.match(/^(\d{1,2})[/-]([A-Za-z]{3})[/-](\d{2,4})$/);
  if (mText) {
    const day = mText[1].padStart(2, "0");
    const mCode = mText[2].toUpperCase().slice(0, 3);
    const month = MONTH_MAP[mCode] || "01";
    let yr = mText[3];
    if (yr.length === 2) yr = `20${yr}`;
    return `${yr}-${month}-${day}`;
  }

  // Formato MMM DD (ej. AGO 04)
  const mMmmDd = s.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (mMmmDd) {
    const mCode = mMmmDd[1].toUpperCase().slice(0, 3);
    const month = MONTH_MAP[mCode] || "01";
    const day = mMmmDd[2].padStart(2, "0");
    return `${fallbackYear}-${month}-${day}`;
  }

  return s;
}

/**
 * Extractor especializado para Banco Caja Social (BCSC)
 */
function parseBancoCajaSocial(pages: string[]): ParsedBankExtractResult {
  const fullText = pages.join("\n");

  // Detección de cuenta corriente
  const ctaMatch = fullText.match(/Cuenta\s+Corriente\s+([0-9*]{10,25})/i);
  const numeroCuenta = ctaMatch ? ctaMatch[1] : "";

  // Detección de periodo
  const periodoMatch = fullText.match(/Periodo del Informe\s+([\w\s]+a[\w\s]+\d{4})/i);
  const periodo = periodoMatch ? periodoMatch[1].trim() : "";
  const yearMatch = periodo.match(/\b(20\d{2})\b/);
  const currentYear = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

  // Saldos
  const saldoIniMatch = fullText.match(/Saldo\s+(?:Disponible|Total)\s+Anterior\s+([\d,.]+)/i);
  const saldoInicial = saldoIniMatch ? cleanMoneyNumber(saldoIniMatch[1]) : 0;

  const saldoFinMatch = fullText.match(/Nuevo\s+Saldo\s+([\d,.]+)/i);
  const saldoFinal = saldoFinMatch ? cleanMoneyNumber(saldoFinMatch[1]) : 0;

  const items: BankExtractItem[] = [];

  for (const page of pages) {
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Formato típico Banco Caja Social:
      // AGO 04 DEBITO AUTORIZADO POR ACH 07068610 ACH -2,272,515.00 20,246,726.78 20,246,726.78
      const txMatch = line.match(
        /^([A-Z]{3})\s+(\d{1,2})\s+(.+?)\s+(\d{6,14})\s+(ACH|INTERNET|OFICINA|BE EM 962 BAR GE|[A-Z0-9\s]+?)\s+(-?[\d,.]+)\s+([\d,.]+)\s+([\d,.]+)$/
      );

      if (txMatch) {
        const monStr = txMatch[1];
        const dayStr = txMatch[2];
        const descBase = txMatch[3].trim();
        const docRef = txMatch[4];
        const valor = cleanMoneyNumber(txMatch[6]);
        const saldoDisp = cleanMoneyNumber(txMatch[7]);

        const fecha = normalizeDate(`${monStr} ${dayStr}`, currentYear);

        // Capturar líneas siguientes descriptivas (ej. DEBITO POR LOTE:...)
        let fullDesc = descBase;
        if (/gravamen\s+movs?\s+financieros|gmf\b/i.test(descBase)) {
          fullDesc = "GRAVAMEN MOVIMIENTOS FINANCIEROS (GMF 4x1000)";
        } else {
          let j = i + 1;
          while (j < lines.length) {
            const nextL = lines[j];
            if (
              /^[A-Z]{3}\s+\d{1,2}\s+/.test(nextL) ||
              nextL.startsWith("Pag.") ||
              nextL.startsWith("Continua") ||
              nextL.startsWith("BC") ||
              nextL.startsWith("Fecha Transacción")
            ) {
              break;
            }
            fullDesc += ` ${nextL}`;
            j++;
          }
        }

        const isDebito = valor < 0; // En extracto Caja Social, negativo es retiro/débito
        const deb = isDebito ? Math.abs(valor) : 0;
        const cred = !isDebito ? valor : 0;

        items.push({
          id: `bcs_${items.length + 1}`,
          fecha,
          descripcion: fullDesc.trim(),
          referencia: docRef,
          debito: deb,
          credito: cred,
          saldo: saldoDisp,
        });
      }
    }
  }

  const totalDebitos = items.reduce((acc, it) => acc + it.debito, 0);
  const totalCreditos = items.reduce((acc, it) => acc + it.credito, 0);

  return {
    bancoId: "banco_caja_social",
    bancoNombre: "Banco Caja Social (BCSC)",
    numeroCuenta,
    periodo,
    saldoInicial,
    saldoFinal: saldoFinal || saldoInicial + totalCreditos - totalDebitos,
    totalDebitos,
    totalCreditos,
    items,
  };
}

/**
 * Extractor especializado para Credicorp Capital
 * Soporta Fondos de Inversión Colectiva (FIC Alta Liquidez y Vista) y Cuenta Administradora de Valores
 * Maneja los 2 saldos de inversión y consolida el Portafolio Total.
 */
function parseCredicorpCapital(pages: string[]): ParsedBankExtractResult {
  const fullText = pages.join("\n");

  // Detección de periodo
  const perMatch = fullText.match(
    /Del\s+(\d{1,2}\s+de\s+[A-Za-z]+\s+de\s+\d{4})\s+al\s+(\d{1,2}\s+de\s+[A-Za-z]+\s+de\s+\d{4})/i
  );
  const periodo = perMatch ? perMatch[0] : "";
  const yearMatch = periodo.match(/\b(20\d{2})\b/);
  const currentYear = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

  const subAccounts: BankSubAccount[] = [];

  // Detección de la tabla resumen de Fondos en Página 4 (o en fullText)
  // SALDO INICIAL TOTAL INGRESOS TOTAL EGRESOS RENDIMIENTOS RETEFUENTE SALDO FINAL
  const altaRowMatch = fullText.match(
    /CREDICORP\s+CAPITAL\s+ALTA\s+LIQUIDEZ\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)/i
  );
  const vistaRowMatch = fullText.match(
    /CREDICORP\s+CAPITAL\s+VISTA\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)/i
  );
  const totalRowMatch = fullText.match(
    /Total\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)\s+\$?([\d.,]+)/i
  );

  // 1. Cuenta Administradora de Valores
  let adminCta = "";
  const adminItems: BankExtractItem[] = [];
  let adminSaldoIni = 0;
  let adminSaldoFin = 0;

  // 2. Fondos de Inversión Colectiva (Alta Liquidez)
  let ficAltaCta = "";
  const ficAltaItems: BankExtractItem[] = [];
  const ficAltaSaldoIni = altaRowMatch ? cleanMoneyNumber(altaRowMatch[1]) : 0;
  const ficAltaSaldoFin = altaRowMatch ? cleanMoneyNumber(altaRowMatch[6]) : 0;
  const _ficAltaRend = altaRowMatch ? cleanMoneyNumber(altaRowMatch[4]) : 0;
  const _ficAltaRetefuente = altaRowMatch ? cleanMoneyNumber(altaRowMatch[5]) : 0;

  // 3. Fondos de Inversión Colectiva (Vista)
  let ficVistaCta = "";
  const ficVistaItems: BankExtractItem[] = [];
  const ficVistaSaldoIni = vistaRowMatch ? cleanMoneyNumber(vistaRowMatch[1]) : 0;
  const ficVistaSaldoFin = vistaRowMatch ? cleanMoneyNumber(vistaRowMatch[6]) : 0;
  const ficVistaRend = vistaRowMatch ? cleanMoneyNumber(vistaRowMatch[4]) : 0;

  // 4. Totales Portafolio
  const portafolioSaldoIni = totalRowMatch ? cleanMoneyNumber(totalRowMatch[1]) : ficAltaSaldoIni + ficVistaSaldoIni;
  const portafolioSaldoFin = totalRowMatch ? cleanMoneyNumber(totalRowMatch[6]) : ficAltaSaldoFin + ficVistaSaldoFin;

  let currentSection: "none" | "admin" | "fic_vista" | "fic_alta" = "none";

  for (const page of pages) {
    if (page.includes("Detalle del portafolio: Cuenta Administradora de Valores")) {
      currentSection = "admin";
    } else if (page.includes("CREDICORP CAPITAL VISTA N° DE CUENTA")) {
      currentSection = "fic_vista";
    } else if (page.includes("CREDICORP CAPITAL ALTA LIQUIDEZ N° DE CUENTA")) {
      currentSection = "fic_alta";
    } else if (page.includes("Información legal")) {
      currentSection = "none";
    }

    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);

    // Sección Cuenta Administradora de Valores
    if (currentSection === "admin") {
      const ctaM = page.match(/N°\s*DE\s*CUENTA:\s*([\w-]+)/i);
      if (ctaM) adminCta = ctaM[1];

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^\d{2}\/[A-Za-z]{3}\/\d{2}/.test(l)) {
          if (l.includes("SALDO INICIAL")) {
            const iniM = l.match(/\$[\d,.]+/g);
            if (iniM && iniM.length >= 3) {
              adminSaldoIni = cleanMoneyNumber(iniM[2]);
            }
            continue;
          }
          if (l.includes("SALDO FINAL")) {
            const finM = l.match(/\$[\d,.]+/g);
            if (finM && finM.length >= 3) {
              adminSaldoFin = cleanMoneyNumber(finM[2]);
            }
            continue;
          }

          let fullL = l;
          let j = i + 1;
          while (
            j < lines.length &&
            !/^\d{2}\/[A-Za-z]{3}\/\d{2}/.test(lines[j]) &&
            !lines[j].startsWith("Página") &&
            !lines[j].startsWith("TIPO")
          ) {
            fullL += ` ${lines[j]}`;
            j++;
          }
          i = j - 1;

          const dollarMatches = [...fullL.matchAll(/\$[\d,.]+/g)];
          if (dollarMatches.length >= 3) {
            const last3 = dollarMatches.slice(-3);
            const descEnd = last3[0].index;
            const dateEnd = fullL.indexOf(" ");
            const dateRaw = fullL.slice(0, dateEnd);
            const desc = fullL.slice(dateEnd, descEnd).trim();
            const ingresos = cleanMoneyNumber(last3[0][0]);
            const egresos = cleanMoneyNumber(last3[1][0]);
            const saldo = cleanMoneyNumber(last3[2][0]);

            const fecha = normalizeDate(dateRaw, currentYear);
            const docM = desc.match(/\b(PCD\s+\d+|HD=\d+|LOTE\s+\d+|ND\s+\d+|TP\s+\d+|\d{6,12})\b/i);
            const ref = docM ? docM[0] : "";

            adminItems.push({
              id: `cre_adm_${adminItems.length + 1}`,
              fecha,
              descripcion: desc,
              referencia: ref,
              debito: egresos,
              credito: ingresos,
              saldo,
            });
          }
        }
      }
    }

    // Sección FIC Vista (Detalle específico en página 5)
    if (currentSection === "fic_vista") {
      const ctaM = page.match(/N°\s*DE\s*CUENTA:\s*([\w-]+)/i);
      if (ctaM) ficVistaCta = ctaM[1];

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^\d{2}\/[A-Za-z]{3}\/\d{2}/.test(l)) {
          if (l.includes("SALDO INICIAL") || l.includes("SALDO FINAL")) continue;
          let fullL = l;
          let j = i + 1;
          while (
            j < lines.length &&
            !/^\d{2}\/[A-Za-z]{3}\/\d{2}/.test(lines[j]) &&
            !lines[j].startsWith("TIPO") &&
            !lines[j].startsWith("Página")
          ) {
            fullL += ` ${lines[j]}`;
            j++;
          }
          i = j - 1;

          const dollarMatches = [...fullL.matchAll(/\$[\d,.]+/g)];
          if (dollarMatches.length >= 2) {
            const dateEnd = fullL.indexOf(" ");
            const dateRaw = fullL.slice(0, dateEnd);
            const descEnd = dollarMatches[0].index;
            const desc = fullL.slice(dateEnd, descEnd).trim();
            const ingresos = cleanMoneyNumber(dollarMatches[0][0]);
            const egresos = dollarMatches.length >= 3 ? cleanMoneyNumber(dollarMatches[1][0]) : 0;
            const saldo =
              dollarMatches.length >= 3
                ? cleanMoneyNumber(dollarMatches[2][0])
                : cleanMoneyNumber(dollarMatches[1][0]);
            const fecha = normalizeDate(dateRaw, currentYear);

            ficVistaItems.push({
              id: `cre_vista_${ficVistaItems.length + 1}`,
              fecha,
              descripcion: desc,
              referencia: ficVistaCta || "VISTA",
              debito: egresos,
              credito: ingresos,
              saldo,
            });
          }
        }
      }
    }

    // Sección FIC Alta Liquidez (Detalle específico en páginas 7-9)
    if (currentSection === "fic_alta") {
      const ctaM = page.match(/N°\s*DE\s*CUENTA:\s*([\w-]+)/i);
      if (ctaM) ficAltaCta = ctaM[1];

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/^\d{2}\/[A-Za-z]{3}\/\d{2}/.test(l)) {
          if (l.includes("SALDO INICIAL") || l.includes("SALDO FINAL")) continue;

          let fullL = l;
          let j = i + 1;
          while (
            j < lines.length &&
            !/^\d{2}\/[A-Za-z]{3}\/\d{2}/.test(lines[j]) &&
            !lines[j].startsWith("TIPO") &&
            !lines[j].startsWith("Página") &&
            !lines[j].startsWith("MOVIMIENTOS DEL PERIODO")
          ) {
            fullL += ` ${lines[j]}`;
            j++;
          }
          i = j - 1;

          const dollarMatches = [...fullL.matchAll(/\$[\d,.]+/g)];
          if (dollarMatches.length >= 2) {
            const dateEnd = fullL.indexOf(" ");
            const dateRaw = fullL.slice(0, dateEnd);
            const descEnd = dollarMatches[0].index;
            const desc = fullL.slice(dateEnd, descEnd).trim();

            const ingresos = cleanMoneyNumber(dollarMatches[0][0]);
            const egresos = dollarMatches.length >= 3 ? cleanMoneyNumber(dollarMatches[1][0]) : 0;
            const saldo =
              dollarMatches.length >= 3
                ? cleanMoneyNumber(dollarMatches[2][0])
                : cleanMoneyNumber(dollarMatches[1][0]);

            const fecha = normalizeDate(dateRaw, currentYear);

            ficAltaItems.push({
              id: `cre_alta_${ficAltaItems.length + 1}`,
              fecha,
              descripcion: desc,
              referencia: ficAltaCta || "FIC ALTA LIQUIDEZ",
              debito: egresos,
              credito: ingresos,
              saldo,
            });
          }
        }
      }
    }
  }

  // Si no se capturaron items específicos de vista pero hay rendimientos de vista en la tabla resumen
  if (ficVistaItems.length === 0 && ficVistaRend > 0) {
    ficVistaItems.push({
      id: "cre_vista_rend",
      fecha: `${currentYear}-08-31`,
      descripcion: "RENDIMIENTOS FINANCIEROS (CREDICORP CAPITAL VISTA)",
      referencia: ficVistaCta || "VISTA",
      debito: 0,
      credito: ficVistaRend,
      saldo: ficVistaSaldoFin,
    });
  }

  // Generar el Portafolio Consolidado (que cruza exactamente con la contabilidad 1250)
  // Se excluyen los traslados puente internos entre Administradora y FIC para no duplicar movimientos
  const consolidatedItems: BankExtractItem[] = [];

  adminItems.forEach((it) => {
    if (!/movimiento\s+interno\s+traslado/i.test(it.descripcion)) {
      consolidatedItems.push({ ...it, id: `cons_${it.id}` });
    }
  });

  ficAltaItems.forEach((it) => {
    if (
      !/traslado\s+a\s+cuenta\s+administradora/i.test(it.descripcion) &&
      !/incremento\s+por\s+traslado/i.test(it.descripcion)
    ) {
      consolidatedItems.push({ ...it, id: `cons_${it.id}` });
    }
  });

  // Asegurar que los rendimientos de Vista estén en el portafolio consolidado si no estaban ya
  if (ficVistaRend > 0 && !consolidatedItems.some((it) => /vista.*rendimiento|rendimiento.*vista/i.test(it.descripcion))) {
    consolidatedItems.push({
      id: "cons_rend_vista",
      fecha: `${currentYear}-08-31`,
      descripcion: "RENDIMIENTOS FINANCIEROS (CREDICORP CAPITAL VISTA)",
      referencia: "VISTA",
      debito: 0,
      credito: ficVistaRend,
      saldo: ficVistaSaldoFin,
    });
  }

  const consDeb = consolidatedItems.reduce((a, b) => a + b.debito, 0);
  const consCred = consolidatedItems.reduce((a, b) => a + b.credito, 0);

  // 1. Portafolio Consolidado Total (Suma de Alta Liquidez + Vista)
  const accountDisplay = [ficAltaCta, ficVistaCta, adminCta].filter(Boolean).join(" / ");
  subAccounts.push({
    id: "consolidado",
    nombre: "Portafolio Consolidado Total (Alta Liquidez + Vista)",
    numeroCuenta: accountDisplay,
    saldoInicial: portafolioSaldoIni,
    saldoFinal: portafolioSaldoFin,
    totalDebitos: consDeb,
    totalCreditos: consCred,
    items: consolidatedItems,
  });

  // 2. Subcuenta Credicorp Capital Alta Liquidez
  if (ficAltaItems.length > 0 || ficAltaSaldoIni > 0) {
    const altaDeb = ficAltaItems.reduce((a, b) => a + b.debito, 0);
    const altaCred = ficAltaItems.reduce((a, b) => a + b.credito, 0);
    subAccounts.push({
      id: "alta_liquidez",
      nombre: "Credicorp Capital Alta Liquidez (FIC)",
      numeroCuenta: ficAltaCta || "1-1-47311-2",
      saldoInicial: ficAltaSaldoIni,
      saldoFinal: ficAltaSaldoFin || ficAltaSaldoIni + altaCred - altaDeb,
      totalDebitos: altaDeb,
      totalCreditos: altaCred,
      items: ficAltaItems,
    });
  }

  // 3. Subcuenta Credicorp Capital Vista
  if (ficVistaItems.length > 0 || ficVistaSaldoIni > 0) {
    const vistaDeb = ficVistaItems.reduce((a, b) => a + b.debito, 0);
    const vistaCred = ficVistaItems.reduce((a, b) => a + b.credito, 0);
    subAccounts.push({
      id: "vista",
      nombre: "Credicorp Capital Vista (FIC)",
      numeroCuenta: ficVistaCta || "1-1-368-3",
      saldoInicial: ficVistaSaldoIni,
      saldoFinal: ficVistaSaldoFin || ficVistaSaldoIni + vistaCred - vistaDeb,
      totalDebitos: vistaDeb,
      totalCreditos: vistaCred,
      items: ficVistaItems,
    });
  }

  // 4. Subcuenta Cuenta Administradora de Valores
  if (adminItems.length > 0) {
    const admDeb = adminItems.reduce((a, b) => a + b.debito, 0);
    const admCred = adminItems.reduce((a, b) => a + b.credito, 0);
    subAccounts.push({
      id: "admin",
      nombre: "Cuenta Administradora de Valores",
      numeroCuenta: adminCta || "",
      saldoInicial: adminSaldoIni,
      saldoFinal: adminSaldoFin || adminSaldoIni + admCred - admDeb,
      totalDebitos: admDeb,
      totalCreditos: admCred,
      items: adminItems,
    });
  }

  const defaultAccount = subAccounts[0];

  return {
    bancoId: "credicorp",
    bancoNombre: "Credicorp Capital Colombia",
    numeroCuenta: defaultAccount?.numeroCuenta || ficAltaCta || adminCta,
    periodo,
    saldoInicial: defaultAccount?.saldoInicial || 0,
    saldoFinal: defaultAccount?.saldoFinal || 0,
    totalDebitos: defaultAccount?.totalDebitos || 0,
    totalCreditos: defaultAccount?.totalCreditos || 0,
    items: defaultAccount?.items || [],
    cuentasDisponibles: subAccounts,
  };
}


/**
 * Extractor especializado para Banistmo (Bancolombia Panamá)
 */
function parseBanistmo(pages: string[]): ParsedBankExtractResult {
  const fullText = pages.join("\n");

  const ctaMatch = fullText.match(/(?:No\.?\s*de\s*Cuenta|Cuenta\s*N[o°]?\.?)\s*[:.]?\s*([0-9-]{7,25})/i);
  const numeroCuenta = ctaMatch ? ctaMatch[1] : "";

  const periodoMatch = fullText.match(/(?:Periodo|Desde)\s*[:.]?\s*([\d/.-]+\s*(?:al|hasta|-)\s*[\d/.-]+)/i);
  const periodo = periodoMatch ? periodoMatch[1].trim() : "";

  const yearMatch = periodo.match(/\b(20\d{2})\b/);
  const currentYear = yearMatch ? yearMatch[1] : String(new Date().getFullYear());

  const saldoIniMatch = fullText.match(/(?:Saldo\s*Anterior|Balance\s*Inicial)\s*[:.]?\s*([\d,.]+)/i);
  const saldoInicial = saldoIniMatch ? cleanMoneyNumber(saldoIniMatch[1]) : 0;

  const saldoFinMatch = fullText.match(/(?:Nuevo\s*Saldo|Balance\s*Final|Saldo\s*Actual)\s*[:.]?\s*([\d,.]+)/i);
  const saldoFinal = saldoFinMatch ? cleanMoneyNumber(saldoFinMatch[1]) : 0;

  const items: BankExtractItem[] = [];

  for (const page of pages) {
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Formato típico Banistmo:
      // DD/MM/YYYY DESCRIPCION REF DEBITO CREDITO SALDO
      // o DD-MMM-YYYY
      const txMatch = line.match(
        /^(\d{1,2}[/-]\w{2,3}[/-]\d{2,4}|\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+(\d{4,12}|-)?\s*(-?[\d,.]+)\s+(-?[\d,.]+)\s+([\d,.]+)$/
      );

      if (txMatch) {
        const fRaw = txMatch[1];
        const desc = txMatch[2].trim();
        const ref = txMatch[3] || "";
        const m1 = cleanMoneyNumber(txMatch[4]);
        const m2 = cleanMoneyNumber(txMatch[5]);
        const sld = cleanMoneyNumber(txMatch[6]);

        const fecha = normalizeDate(fRaw, currentYear);

        items.push({
          id: `ban_${items.length + 1}`,
          fecha,
          descripcion: desc,
          referencia: ref,
          debito: Math.abs(m1),
          credito: Math.abs(m2),
          saldo: sld,
        });
      }
    }
  }

  const totalDebitos = items.reduce((acc, it) => acc + it.debito, 0);
  const totalCreditos = items.reduce((acc, it) => acc + it.credito, 0);

  return {
    bancoId: "banistmo",
    bancoNombre: "Banistmo S.A.",
    numeroCuenta,
    periodo,
    saldoInicial,
    saldoFinal: saldoFinal || saldoInicial + totalCreditos - totalDebitos,
    totalDebitos,
    totalCreditos,
    items,
  };
}

/**
 * Extractor genérico de extractos PDF (Bancolombia, Davivienda, etc.)
 */
function parseGenericPdf(pages: string[]): ParsedBankExtractResult {
  const fullText = pages.join("\n");

  let bancoNombre = "Extracto Bancario";
  let bancoId: BankId = "generico";

  if (/bancolombia/i.test(fullText)) {
    bancoNombre = "Bancolombia S.A.";
    bancoId = "bancolombia";
  } else if (/davivienda/i.test(fullText)) {
    bancoNombre = "Banco Davivienda S.A.";
    bancoId = "davivienda";
  }

  const ctaMatch = fullText.match(/(?:Cuenta|No\.?\s*Cuenta|No\.?\s*de\s*Cuenta)\s*[:.]?\s*([0-9*#-]{7,25})/i);
  const numeroCuenta = ctaMatch ? ctaMatch[1] : "";

  const saldoIniMatch = fullText.match(/(?:Saldo\s*(?:Anterior|Inicial)|Balance\s*Inicial)\s*[:.]?\s*([\d,.]+)/i);
  const saldoInicial = saldoIniMatch ? cleanMoneyNumber(saldoIniMatch[1]) : 0;

  const saldoFinMatch = fullText.match(/(?:Nuevo\s*Saldo|Saldo\s*Final|Balance\s*Final)\s*[:.]?\s*([\d,.]+)/i);
  const saldoFinal = saldoFinMatch ? cleanMoneyNumber(saldoFinMatch[1]) : 0;

  const items: BankExtractItem[] = [];
  const currentYear = String(new Date().getFullYear());

  for (const page of pages) {
    const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Busca líneas con fecha al inicio y montos monetarios
      const dMatch = line.match(/^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3}|[A-Za-z]{3}\s+\d{1,2})/);
      if (dMatch) {
        const amounts = line.match(/-?\$?[\d,.]+\.\d{2}|-?\$?[\d.]+,\d{2}/g);
        if (amounts && amounts.length >= 1) {
          const f = normalizeDate(dMatch[1], currentYear);
          const val1 = cleanMoneyNumber(amounts[0]);
          const val2 = amounts[1] ? cleanMoneyNumber(amounts[1]) : 0;

          // Limpiar descripción
          let desc = line.replace(dMatch[0], "").trim();
          for (const a of amounts) {
            desc = desc.replace(a, "");
          }
          desc = desc.replace(/\s+/g, " ").trim();

          const isDeb = val1 < 0 || (val2 === 0 && /retiro|debito|gmf|comision|pago/i.test(desc));

          items.push({
            id: `gen_${items.length + 1}`,
            fecha: f,
            descripcion: desc || "Movimiento Extracto",
            referencia: "",
            debito: isDeb ? Math.abs(val1) : 0,
            credito: !isDeb ? Math.abs(val1) : val2,
          });
        }
      }
    }
  }

  const totalDebitos = items.reduce((acc, it) => acc + it.debito, 0);
  const totalCreditos = items.reduce((acc, it) => acc + it.credito, 0);

  return {
    bancoId,
    bancoNombre,
    numeroCuenta,
    periodo: "",
    saldoInicial,
    saldoFinal: saldoFinal || saldoInicial + totalCreditos - totalDebitos,
    totalDebitos,
    totalCreditos,
    items,
  };
}

/**
 * Función principal para analizar y parsear un extracto bancario en formato PDF
 */
export async function parsePdfBankExtract(buffer: ArrayBuffer | Uint8Array): Promise<ParsedBankExtractResult> {
  const uint8 =
    buffer instanceof Uint8Array
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new Uint8Array(buffer);
  const doc = await getDocumentProxy(uint8);
  const { text: pages } = await extractText(doc, { mergePages: false });
  const fullText = pages.join("\n");

  // Identificación del banco
  if (/banco\s*caja\s*social|bcsc|bc\s*34/i.test(fullText)) {
    return parseBancoCajaSocial(pages);
  }

  if (/credicorp\s*capital/i.test(fullText)) {
    return parseCredicorpCapital(pages);
  }

  if (/banistmo/i.test(fullText)) {
    return parseBanistmo(pages);
  }

  return parseGenericPdf(pages);
}

/**
 * Función para analizar y parsear un extracto bancario en formato Excel o CSV
 */
export function parseExcelBankExtract(data: ArrayBuffer | Uint8Array | string): ParsedBankExtractResult {
  const wb = typeof data === "string" ? XLSX.read(data, { type: "binary" }) : XLSX.read(data, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rawRows.length, 25); i++) {
    const rowText = (rawRows[i] || []).join(" ").toLowerCase();
    if (
      rowText.includes("fecha") &&
      (rowText.includes("debito") ||
        rowText.includes("retiro") ||
        rowText.includes("credito") ||
        rowText.includes("deposito") ||
        rowText.includes("valor") ||
        rowText.includes("saldo"))
    ) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) headerIdx = 0;

  const headerRow = (rawRows[headerIdx] || []).map((c) => String(c || "").toLowerCase().trim());
  let iFecha = headerRow.findIndex((h) => h.includes("fecha"));
  let iDesc = headerRow.findIndex((h) => h.includes("descrip") || h.includes("detalle") || h.includes("concepto"));
  let iRef = headerRow.findIndex((h) => h.includes("ref") || h.includes("doc") || h.includes("comprobante"));
  let iDeb = headerRow.findIndex((h) => h.includes("deb") || h.includes("retiro") || h.includes("cargo") || h.includes("egreso"));
  let iCred = headerRow.findIndex((h) => h.includes("cred") || h.includes("dep") || h.includes("abono") || h.includes("ingreso"));
  const iVal = headerRow.findIndex((h) => h.includes("valor") || h.includes("monto") || h.includes("importe"));
  const iSaldo = headerRow.findIndex((h) => h.includes("saldo") || h.includes("balance"));

  if (iFecha === -1) iFecha = 0;
  if (iDesc === -1) iDesc = 1;
  if (iRef === -1) iRef = 2;
  if (iDeb === -1 && iVal === -1) iDeb = 3;
  if (iCred === -1 && iVal === -1) iCred = 4;

  const items: BankExtractItem[] = [];

  for (let r = headerIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || !row.length) continue;

    const fRaw = String(row[iFecha] || "").trim();
    if (!fRaw) continue;

    const desc = iDesc !== -1 ? String(row[iDesc] || "").trim() : "";
    const ref = iRef !== -1 ? String(row[iRef] || "").trim() : "";

    let deb = 0;
    let cred = 0;

    if (iDeb !== -1 && iCred !== -1 && (iDeb !== iVal || iCred !== iVal)) {
      deb = Math.abs(cleanMoneyNumber(row[iDeb]));
      cred = Math.abs(cleanMoneyNumber(row[iCred]));
    } else if (iVal !== -1) {
      const v = cleanMoneyNumber(row[iVal]);
      if (v < 0) deb = Math.abs(v);
      else cred = v;
    }

    const sld = iSaldo !== -1 ? cleanMoneyNumber(row[iSaldo]) : undefined;

    if (deb > 0 || cred > 0) {
      items.push({
        id: `ext_xl_${r}`,
        fecha: normalizeDate(fRaw),
        descripcion: desc,
        referencia: ref,
        debito: deb,
        credito: cred,
        saldo: sld,
      });
    }
  }

  const totalDebitos = items.reduce((acc, it) => acc + it.debito, 0);
  const totalCreditos = items.reduce((acc, it) => acc + it.credito, 0);

  return {
    bancoId: "generico",
    bancoNombre: "Extracto Bancario (Excel/CSV)",
    numeroCuenta: "",
    periodo: "",
    saldoInicial: 0,
    saldoFinal: totalCreditos - totalDebitos,
    totalDebitos,
    totalCreditos,
    items,
  };
}

/**
 * Función unificada para cargar un extracto bancario desde un archivo (PDF, XLSX, XLS, CSV)
 */
export async function parseBankExtractFile(file: File): Promise<ParsedBankExtractResult> {
  const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type.includes("pdf");
  const buffer = await file.arrayBuffer();

  if (isPdf) {
    return parsePdfBankExtract(buffer);
  }
  return parseExcelBankExtract(buffer);
}
