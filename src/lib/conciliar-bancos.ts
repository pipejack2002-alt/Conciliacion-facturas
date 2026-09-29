import type { MovLine } from "./types.ts";

export interface BankExtractItem {
  id: string;
  fecha: string;
  descripcion: string;
  referencia: string;
  debito: number; // Salida / Retiro del banco
  credito: number; // Entrada / Abono al banco
  saldo?: number;
}

export type EstadoConciliacionBancaria =
  | "conciliado"
  | "partida_en_transito_libros" // Está en libros, falta en el banco (ej. cheque girado y no cobrado)
  | "nota_debito_banco" // Salida en banco no registrada en libros (GMF 4x1000, comisión, chequera)
  | "nota_credito_banco" // Entrada en banco no registrada en libros (rendimientos, transferencias no identificadas)
  | "diferencia_valor";

export interface BankConciliacionRow {
  id: string;
  estado: EstadoConciliacionBancaria;
  fecha: string;
  descripcion: string;
  referencia: string;
  tipo: "retiro" | "consignacion";
  montoBanco: number;
  montoLibros: number;
  diferencia: number;
  esGmf: boolean;
  esComision: boolean;
  esRendimiento: boolean;
  itemBanco?: BankExtractItem;
  itemLibros?: MovLine;
  nota: string;
}

export interface BankConciliacionSummary {
  saldoExtracto: number;
  saldoLibros: number;
  consignacionesEnTransito: number;
  chequesEnTransito: number;
  notasDebitoNoRegistradas: number;
  notasCreditoNoRegistradas: number;
  saldoConciliado: number;
  diferenciaCuadre: number;
  cuadrado: boolean;
  totalItemsBanco: number;
  totalItemsLibros: number;
  totalConciliados: number;
}

export interface BankConciliacionResult {
  rows: BankConciliacionRow[];
  summary: BankConciliacionSummary;
  cuentasBancosDetectadas: string[];
}

/**
 * Filtra los movimientos contables del ERP correspondientes a cuentas de bancos y tesorería
 * (Clase 11, típicamente 1110 Bancos, 1120 Cuentas de Ahorro, 1105 Caja General).
 */
export function extractLibroBancos(mov: MovLine[], cuentaFiltro?: string): MovLine[] {
  return mov.filter((m) => {
    const c = m.cuenta.trim();
    if (cuentaFiltro) return c.startsWith(cuentaFiltro);
    return c.startsWith("1110") || c.startsWith("1120") || c.startsWith("1105");
  });
}

/**
 * Motor de Conciliación Bancaria Automática (Extracto Bancario vs Cuenta 11)
 * Aplica la regla contable espejo:
 * - Débito en Banco (Retiro) <=> Crédito en Libros (Disminución de Banco)
 * - Crédito en Banco (Abono)  <=> Débito en Libros (Aumento de Banco)
 */
export function conciliarBancos(
  extracto: BankExtractItem[],
  libros: MovLine[],
  saldoInicialExtracto = 0,
  saldoInicialLibros = 0
): BankConciliacionResult {
  const matchedExtractoIds = new Set<string>();
  const matchedLibroIndices = new Set<number>();
  const rows: BankConciliacionRow[] = [];

  // 1. Detección de cuentas bancarias en libros
  const cuentasSet = new Set<string>();
  for (const l of libros) {
    if (l.cuenta.startsWith("11")) cuentasSet.add(l.cuenta);
  }
  const cuentasBancosDetectadas = Array.from(cuentasSet);

  // FASE 1: Cruce exacto por Referencia / Cheque y Valor
  for (const bItem of extracto) {
    const isRetiro = bItem.debito > 0;
    const montoBanco = isRetiro ? bItem.debito : bItem.credito;
    const refClean = bItem.referencia.replace(/\D/g, "");

    if (refClean.length >= 4) {
      for (let i = 0; i < libros.length; i++) {
        if (matchedLibroIndices.has(i)) continue;
        const lItem = libros[i];
        const montoLibro = isRetiro ? lItem.credito : lItem.debito;

        const libroRefClean = (lItem.referencia || lItem.cruce || lItem.comprobante).replace(/\D/g, "");
        if (libroRefClean.includes(refClean) || refClean.includes(libroRefClean)) {
          if (Math.abs(montoBanco - montoLibro) <= 1) {
            matchedExtractoIds.add(bItem.id);
            matchedLibroIndices.add(i);
            rows.push({
              id: `match_${bItem.id}_${i}`,
              estado: "conciliado",
              fecha: bItem.fecha,
              descripcion: `${bItem.descripcion} ↔ ${lItem.descripcion || lItem.nombre}`,
              referencia: bItem.referencia || lItem.referencia || "Match directo",
              tipo: isRetiro ? "retiro" : "consignacion",
              montoBanco,
              montoLibros: montoLibro,
              diferencia: 0,
              esGmf: false,
              esComision: false,
              esRendimiento: false,
              itemBanco: bItem,
              itemLibros: lItem,
              nota: "Conciliado por referencia de cheque/documento y valor exacto.",
            });
            break;
          }
        }
      }
    }
  }

  // FASE 2: Cruce por Valor Exacto y Fecha cercana (±5 días)
  for (const bItem of extracto) {
    if (matchedExtractoIds.has(bItem.id)) continue;
    const isRetiro = bItem.debito > 0;
    const montoBanco = isRetiro ? bItem.debito : bItem.credito;

    for (let i = 0; i < libros.length; i++) {
      if (matchedLibroIndices.has(i)) continue;
      const lItem = libros[i];
      const montoLibro = isRetiro ? lItem.credito : lItem.debito;

      if (Math.abs(montoBanco - montoLibro) <= 1) {
        // Verificar proximidad de fechas si ambas son válidas
        const bTime = new Date(bItem.fecha).getTime();
        const lTime = new Date(lItem.fecha).getTime();
        const diffDays = Math.abs(bTime - lTime) / (1000 * 60 * 60 * 24);

        if (isNaN(diffDays) || diffDays <= 7) {
          matchedExtractoIds.add(bItem.id);
          matchedLibroIndices.add(i);
          rows.push({
            id: `match_val_${bItem.id}_${i}`,
            estado: "conciliado",
            fecha: bItem.fecha,
            descripcion: `${bItem.descripcion} ↔ ${lItem.descripcion || lItem.nombre}`,
            referencia: bItem.referencia || lItem.referencia || "Valor exacto",
            tipo: isRetiro ? "retiro" : "consignacion",
            montoBanco,
            montoLibros: montoLibro,
            diferencia: 0,
            esGmf: false,
            esComision: false,
            esRendimiento: false,
            itemBanco: bItem,
            itemLibros: lItem,
            nota: `Conciliado por valor idéntico ($${montoBanco.toLocaleString("es-CO")}) dentro de la ventana de compensación.`,
          });
          break;
        }
      }
    }
  }

  // FASE 3: Partidas que están en el Extracto del Banco pero NO en Libros
  for (const bItem of extracto) {
    if (matchedExtractoIds.has(bItem.id)) continue;
    const isRetiro = bItem.debito > 0;
    const montoBanco = isRetiro ? bItem.debito : bItem.credito;
    const desc = bItem.descripcion.toLowerCase();

    const esGmf = /gmf|4x1000|gravamen|impuesto.*gobierno/i.test(desc);
    const esComision = /comisi[oó]n|cuota.*manejo|chequera|tarifa|costo.*transferencia|cobro/i.test(desc);
    const esRendimiento = /rendimiento|inter[eé]s.*abono|intereses.*liquidados/i.test(desc);

    let nota = "Movimiento en extracto pendiente de causar en contabilidad.";
    if (esGmf) nota = "Gravamen a los Movimientos Financieros (4x1000) descontado por el banco. Pendiente comprobante de gasto (PUC 511595).";
    if (esComision) nota = "Comisión o costo financiero bancario con IVA. Requiere nota contable de gastos bancarios (PUC 530515).";
    if (esRendimiento) nota = "Rendimientos financieros abonados por la entidad. Requiere causación de ingresos no operacionales (PUC 421005).";

    rows.push({
      id: `extracto_pend_${bItem.id}`,
      estado: isRetiro ? "nota_debito_banco" : "nota_credito_banco",
      fecha: bItem.fecha,
      descripcion: bItem.descripcion,
      referencia: bItem.referencia || "Extracto Bancario",
      tipo: isRetiro ? "retiro" : "consignacion",
      montoBanco,
      montoLibros: 0,
      diferencia: montoBanco,
      esGmf,
      esComision,
      esRendimiento,
      itemBanco: bItem,
      nota,
    });
  }

  // FASE 4: Partidas que están en Libros pero NO en el Extracto Bancario
  for (let i = 0; i < libros.length; i++) {
    if (matchedLibroIndices.has(i)) continue;
    const lItem = libros[i];
    const isRetiro = lItem.credito > 0;
    const montoLibro = isRetiro ? lItem.credito : lItem.debito;

    const nota = isRetiro
      ? "Giro, cheque o transferencia contabilizada en libros aún no debitada por el banco (Partida en Tránsito)."
      : "Consignación o ingreso contabilizado en libros en trámite de acreditación bancaria (Consignación en Tránsito).";

    rows.push({
      id: `libro_pend_${i}`,
      estado: "partida_en_transito_libros",
      fecha: lItem.fecha,
      descripcion: lItem.descripcion || lItem.nombre || `Comprobante ${lItem.comprobante}`,
      referencia: lItem.referencia || lItem.comprobante || "Contabilidad",
      tipo: isRetiro ? "retiro" : "consignacion",
      montoBanco: 0,
      montoLibros: montoLibro,
      diferencia: montoLibro,
      esGmf: false,
      esComision: false,
      esRendimiento: false,
      itemLibros: lItem,
      nota,
    });
  }

  // Cálculo del resumen y conciliación aritmética
  let consignacionesEnTransito = 0;
  let chequesEnTransito = 0;
  let notasDebitoNoRegistradas = 0;
  let notasCreditoNoRegistradas = 0;

  for (const r of rows) {
    if (r.estado === "partida_en_transito_libros") {
      if (r.tipo === "consignacion") consignacionesEnTransito += r.montoLibros;
      if (r.tipo === "retiro") chequesEnTransito += r.montoLibros;
    } else if (r.estado === "nota_debito_banco") {
      notasDebitoNoRegistradas += r.montoBanco;
    } else if (r.estado === "nota_credito_banco") {
      notasCreditoNoRegistradas += r.montoBanco;
    }
  }

  // Cálculo de saldos
  const totalDebitosExtracto = extracto.reduce((a, b) => a + b.debito, 0);
  const totalCreditosExtracto = extracto.reduce((a, b) => a + b.credito, 0);
  const saldoFinalExtracto = saldoInicialExtracto + totalCreditosExtracto - totalDebitosExtracto;

  const totalDebitosLibros = libros.reduce((a, b) => a + b.debito, 0);
  const totalCreditosLibros = libros.reduce((a, b) => a + b.credito, 0);
  const saldoFinalLibros = saldoInicialLibros + totalDebitosLibros - totalCreditosLibros;

  // Fórmula estándar de conciliación bancaria:
  // Saldo según Extracto
  // (+) Consignaciones en tránsito
  // (-) Cheques y transferencias en tránsito
  // (-) Notas débito bancarias no registradas
  // (+) Notas crédito bancarias no registradas
  // = Saldo Conciliado
  const saldoConciliado =
    saldoFinalExtracto +
    consignacionesEnTransito -
    chequesEnTransito -
    notasDebitoNoRegistradas +
    notasCreditoNoRegistradas;

  const diferenciaCuadre = Math.abs(saldoConciliado - saldoFinalLibros);
  const cuadrado = diferenciaCuadre < 1;

  const summary: BankConciliacionSummary = {
    saldoExtracto: saldoFinalExtracto,
    saldoLibros: saldoFinalLibros,
    consignacionesEnTransito,
    chequesEnTransito,
    notasDebitoNoRegistradas,
    notasCreditoNoRegistradas,
    saldoConciliado,
    diferenciaCuadre,
    cuadrado,
    totalItemsBanco: extracto.length,
    totalItemsLibros: libros.length,
    totalConciliados: rows.filter((r) => r.estado === "conciliado").length,
  };

  return {
    rows,
    summary,
    cuentasBancosDetectadas,
  };
}
