import type { MovLine } from "./types.ts";
import type { BankConciliacionRow } from "./conciliar-bancos.ts";

export interface ResolvedVoucherLine {
  cuenta: string;
  cuentaNombre: string;
  nit: string;
  nombre: string;
  descripcion: string;
  cruce: string;
  referencia?: string;
  debito: number;
  credito: number;
  esBanco: boolean;
  esContrapartidaDeducida?: boolean;
}

export interface ContrapartidaResumen {
  cuenta: string;
  nombre: string;
  esDeducida: boolean;
  tipo: "proveedor" | "gmf" | "comision" | "rendimiento" | "cliente" | "otro";
  descripcionCruce: string;
}

export interface ResolvedVoucherEntry {
  comprobante: string;
  fecha: string;
  terceroNombre: string;
  terceroNit: string;
  cruceDoc: string;
  glosa: string;
  totalDebito: number;
  totalCredito: number;
  isPartidaDobleCuadrada: boolean;
  lines: ResolvedVoucherLine[];
  contrapartidaResumen: ContrapartidaResumen;
}

function normComp(s: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Extrae la raíz principal de un comprobante eliminando sufijos de secuencia de línea
 * Ejemplos:
 *  "G 002 00000002743 002" -> "g 002 00000002743"
 *  "CE-00124-01"           -> "ce-00124"
 *  "L 007 00000000067 010" -> "l 007 00000000067"
 */
export function extractVoucherRoot(comprobante: string): string {
  const norm = normComp(comprobante);
  if (!norm) return "";

  // Caso: separado por espacio y termina en número de 1 a 4 dígitos
  const matchSpace = norm.match(/^(.+?)\s+(\d{1,4})$/);
  if (matchSpace && matchSpace[1].length >= 3) {
    return matchSpace[1];
  }

  // Caso: separado por guión y termina en número
  const matchDash = norm.match(/^(.+?)-(\d{1,4})$/);
  if (matchDash && matchDash[1].length >= 3) {
    return matchDash[1];
  }

  return norm;
}

/**
 * Busca todas las líneas pertenecientes al mismo comprobante contable en el libro auxiliar
 */
export function findVoucherLinesInMov(
  targetComprobante: string,
  allMovLines: MovLine[]
): MovLine[] {
  if (!targetComprobante || !allMovLines || allMovLines.length === 0) return [];
  const targetExact = normComp(targetComprobante);
  const targetRoot = extractVoucherRoot(targetComprobante);

  // 1. Coincidencia exacta
  const exactMatches = allMovLines.filter(
    (m) => normComp(m.comprobante) === targetExact
  );

  // Si la coincidencia exacta ya trajo múltiples líneas con débitos y créditos, es perfecta
  const hasBothSides = (lines: MovLine[]) => {
    const deb = lines.reduce((a, b) => a + (b.debito || 0), 0);
    const cred = lines.reduce((a, b) => a + (b.credito || 0), 0);
    return deb > 0 && cred > 0;
  };

  if (exactMatches.length > 1 && hasBothSides(exactMatches)) {
    return exactMatches;
  }

  // 2. Coincidencia por raíz (agrupa secuencias 001, 002, 003 del mismo comprobante)
  if (targetRoot && targetRoot !== targetExact) {
    const rootMatches = allMovLines.filter((m) => {
      const mNorm = normComp(m.comprobante);
      return mNorm === targetRoot || extractVoucherRoot(m.comprobante) === targetRoot;
    });

    if (rootMatches.length > 0) {
      return rootMatches;
    }
  }

  return exactMatches;
}

/**
 * Resuelve el asiento contable completo y su contrapartida.
 * Si el auxiliar contable solo contiene la cuenta de bancos (11) porque el usuario exportó
 * únicamente el auxiliar bancario, deduce automáticamente la contrapartida contable (2205 Proveedores,
 * 5115 GMF, 5305 Comisiones, 4210 Rendimientos o 1305 Clientes) para garantizar partida doble cuadrada.
 */
export function resolveVoucherFullEntry(
  comprobante: string,
  currentLine: MovLine | null,
  allMovLines: MovLine[],
  row?: BankConciliacionRow | null
): ResolvedVoucherEntry {
  const compLabel = comprobante || currentLine?.comprobante || row?.itemLibros?.comprobante || "Sin Comprobante";
  const linesFound = findVoucherLinesInMov(compLabel, allMovLines);

  const baseLine: MovLine = currentLine || row?.itemLibros || (linesFound.length > 0 ? linesFound[0] : {
    cuenta: "111005",
    cuentaNombre: "BANCO",
    comprobante: compLabel,
    fecha: row?.fecha || "",
    nit: "",
    nombre: "",
    descripcion: row?.descripcion || "",
    cruce: row?.referencia || "",
    referencia: row?.referencia || "",
    observacion: "",
    debito: row?.tipo === "consignacion" ? row.montoLibros || row.montoBanco : 0,
    credito: row?.tipo === "retiro" ? row.montoLibros || row.montoBanco : 0,
  });

  const isBankAcc = (cta: string) => /^(11|1250|1245|10)/.test((cta || "").trim());

  let finalLines: ResolvedVoucherLine[] = [];
  let contrapartida: ContrapartidaResumen;

  const debFound = linesFound.reduce((a, b) => a + (b.debito || 0), 0);
  const credFound = linesFound.reduce((a, b) => a + (b.credito || 0), 0);
  const hasMultipleLegs = linesFound.length > 1 && debFound > 0 && credFound > 0;

  if (hasMultipleLegs) {
    // CASO 1: El libro contable ya contiene ambas contrapartidas reales
    finalLines = linesFound.map((l) => ({
      cuenta: l.cuenta,
      cuentaNombre: l.cuentaNombre || "",
      nit: l.nit || "",
      nombre: l.nombre || "",
      descripcion: l.descripcion || "",
      cruce: l.cruce || l.referencia || "",
      debito: l.debito || 0,
      credito: l.credito || 0,
      esBanco: isBankAcc(l.cuenta),
      esContrapartidaDeducida: false,
    }));

    // Encontrar la línea que no es de banco para el resumen
    const nonBankLine = linesFound.find((l) => !isBankAcc(l.cuenta)) || linesFound[0];
    contrapartida = {
      cuenta: nonBankLine.cuenta,
      nombre: nonBankLine.cuentaNombre || nonBankLine.nombre || "Contrapartida en Libros",
      esDeducida: false,
      tipo: nonBankLine.cuenta.startsWith("22")
        ? "proveedor"
        : nonBankLine.cuenta.startsWith("5")
        ? "gmf"
        : nonBankLine.cuenta.startsWith("13")
        ? "cliente"
        : "otro",
      descripcionCruce: nonBankLine.nombre
        ? `Cruzó con cuenta ${nonBankLine.cuenta} · ${nonBankLine.nombre}${nonBankLine.cruce ? ` (Ref: ${nonBankLine.cruce})` : ""}`
        : `Cruzó con cuenta ${nonBankLine.cuenta} · ${nonBankLine.cuentaNombre}`,
    };
  } else {
    // CASO 2: Solo está la pata de banco (porque se exportó un auxiliar de la cuenta 11).
    // Deducimos la contrapartida exacta para que el usuario vea con qué cuenta cruzó.
    const bankLineToUse = linesFound.length > 0 ? linesFound[0] : baseLine;
    const isRetiro = (bankLineToUse.credito || 0) > 0 || (row?.tipo === "retiro");
    const monto = isRetiro
      ? bankLineToUse.credito || row?.montoLibros || row?.montoBanco || 0
      : bankLineToUse.debito || row?.montoLibros || row?.montoBanco || 0;

    const descUpper = `${bankLineToUse.descripcion || ""} ${row?.descripcion || ""}`.toUpperCase();
    const isGmf = Boolean(row?.esGmf || descUpper.includes("GMF") || descUpper.includes("4X1000") || descUpper.includes("GRAVAMEN") || compLabel.toUpperCase().startsWith("L"));
    const isComision = Boolean(row?.esComision || descUpper.includes("COMIS") || descUpper.includes("MANEJO") || descUpper.includes("CUOTA"));
    const isRendimiento = Boolean(row?.esRendimiento || descUpper.includes("RENDIMIENTO") || descUpper.includes("INTERES"));

    const bankResolved: ResolvedVoucherLine = {
      cuenta: bankLineToUse.cuenta || "111005",
      cuentaNombre: bankLineToUse.cuentaNombre || "BANCO",
      nit: bankLineToUse.nit || "",
      nombre: bankLineToUse.nombre || "",
      descripcion: bankLineToUse.descripcion || "Movimiento registrado en cuenta bancaria",
      cruce: bankLineToUse.cruce || bankLineToUse.referencia || "",
      debito: isRetiro ? 0 : monto,
      credito: isRetiro ? monto : 0,
      esBanco: true,
      esContrapartidaDeducida: false,
    };

    let counterLine: ResolvedVoucherLine;

    if (isRetiro) {
      if (isGmf) {
        counterLine = {
          cuenta: "511570",
          cuentaNombre: "GASTOS FINANCIEROS · GMF 4X1000",
          nit: "800197268",
          nombre: "DIAN / BANCO (GRAVAMEN MOVIMIENTOS FINANCIEROS)",
          descripcion: bankLineToUse.descripcion || "Causación GMF 4x1000 sobre débitos de extracto",
          cruce: bankLineToUse.cruce || bankLineToUse.referencia || "GMF-MES",
          debito: monto,
          credito: 0,
          esBanco: false,
          esContrapartidaDeducida: true,
        };
        contrapartida = {
          cuenta: "511570",
          nombre: "GASTOS FINANCIEROS · GMF 4X1000",
          esDeducida: true,
          tipo: "gmf",
          descripcionCruce: "Cruzó con Gastos Financieros (GMF 4x1000 · Cuenta 511570)",
        };
      } else if (isComision) {
        counterLine = {
          cuenta: "530515",
          cuentaNombre: "GASTOS FINANCIEROS · COMISIONES Y CUOTAS BANCARIAS",
          nit: "",
          nombre: bankLineToUse.nombre || "ENTIDAD BANCARIA",
          descripcion: bankLineToUse.descripcion || "Gastos y comisiones de manejo bancario",
          cruce: bankLineToUse.cruce || bankLineToUse.referencia || "",
          debito: monto,
          credito: 0,
          esBanco: false,
          esContrapartidaDeducida: true,
        };
        contrapartida = {
          cuenta: "530515",
          nombre: "GASTOS FINANCIEROS · COMISIONES BANCARIAS",
          esDeducida: true,
          tipo: "comision",
          descripcionCruce: "Cruzó con Gastos Bancarios / Comisiones (Cuenta 530515)",
        };
      } else {
        // Pago a proveedor / cuentas por pagar
        const provNombre = bankLineToUse.nombre || "PROVEEDOR NACIONAL";
        const provNit = bankLineToUse.nit || "";
        const cruceDoc = bankLineToUse.cruce || bankLineToUse.referencia || "";
        counterLine = {
          cuenta: "220505",
          cuentaNombre: "CUENTAS POR PAGAR · PROVEEDORES NACIONALES",
          nit: provNit,
          nombre: provNombre,
          descripcion: `Cancelación obligación cuenta por pagar ${cruceDoc ? `(Ref / Factura: ${cruceDoc})` : ""}`,
          cruce: cruceDoc,
          debito: monto,
          credito: 0,
          esBanco: false,
          esContrapartidaDeducida: true,
        };
        contrapartida = {
          cuenta: "220505",
          nombre: `CUENTAS POR PAGAR · PROVEEDORES (${provNombre})`,
          esDeducida: true,
          tipo: "proveedor",
          descripcionCruce: `Cruzó con la cuenta por pagar (Cuenta 220505) · Proveedor: ${provNombre}${cruceDoc ? ` (Cruce: ${cruceDoc})` : ""}`,
        };
      }
      finalLines = [counterLine, bankResolved]; // En asientos contables, primero los débitos luego créditos
    } else {
      // Consignación / Ingreso
      if (isRendimiento) {
        counterLine = {
          cuenta: "421005",
          cuentaNombre: "INGRESOS FINANCIEROS · INTERESES Y RENDIMIENTOS",
          nit: "",
          nombre: "ENTIDAD BANCARIA",
          descripcion: bankLineToUse.descripcion || "Rendimientos financieros abonados por banco",
          cruce: bankLineToUse.cruce || bankLineToUse.referencia || "",
          debito: 0,
          credito: monto,
          esBanco: false,
          esContrapartidaDeducida: true,
        };
        contrapartida = {
          cuenta: "421005",
          nombre: "INGRESOS FINANCIEROS · RENDIMIENTOS",
          esDeducida: true,
          tipo: "rendimiento",
          descripcionCruce: "Cruzó con Ingresos Financieros por Rendimientos (Cuenta 421005)",
        };
      } else {
        const clienteNombre = bankLineToUse.nombre || "CLIENTE NACIONAL";
        const cruceDoc = bankLineToUse.cruce || bankLineToUse.referencia || "";
        counterLine = {
          cuenta: "130505",
          cuentaNombre: "DEUDORES / CLIENTES NACIONALES (CARTERA)",
          nit: bankLineToUse.nit || "",
          nombre: clienteNombre,
          descripcion: `Abono / Recaudo cartera cliente ${cruceDoc ? `(Factura: ${cruceDoc})` : ""}`,
          cruce: cruceDoc,
          debito: 0,
          credito: monto,
          esBanco: false,
          esContrapartidaDeducida: true,
        };
        contrapartida = {
          cuenta: "130505",
          nombre: `CLIENTES NACIONALES · CARTERA (${clienteNombre})`,
          esDeducida: true,
          tipo: "cliente",
          descripcionCruce: `Cruzó con Cartera de Clientes (Cuenta 130505) · ${clienteNombre}`,
        };
      }
      finalLines = [bankResolved, counterLine];
    }
  }

  const totalDeb = finalLines.reduce((a, b) => a + (b.debito || 0), 0);
  const totalCred = finalLines.reduce((a, b) => a + (b.credito || 0), 0);
  const isPartidaDobleCuadrada = Math.abs(totalDeb - totalCred) < 0.05 && (totalDeb > 0 || totalCred > 0);

  return {
    comprobante: compLabel,
    fecha: baseLine.fecha || row?.fecha || "",
    terceroNombre: baseLine.nombre || "",
    terceroNit: baseLine.nit || "",
    cruceDoc: baseLine.cruce || baseLine.referencia || row?.referencia || "",
    glosa: baseLine.descripcion || row?.descripcion || "",
    totalDebito: totalDeb,
    totalCredito: totalCred,
    isPartidaDobleCuadrada,
    lines: finalLines,
    contrapartidaResumen: contrapartida,
  };
}
