import XLSX from "xlsx-js-style";
import type { BankConciliacionResult, BankConciliacionRow } from "./conciliar-bancos.ts";
import type { MovLine } from "./types.ts";
import { inferBankPucForRow } from "./puc-classifier.ts";

// Estilos corporativos prémium para Excel de Bancos
const HEADER_STYLE = {
  fill: { fgColor: { rgb: "0F766E" } }, // Teal corporativo
  font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
  alignment: { vertical: "center", horizontal: "center", wrapText: true },
  border: {
    top: { style: "thin", color: { rgb: "0D655E" } },
    bottom: { style: "medium", color: { rgb: "0A4F49" } },
    left: { style: "thin", color: { rgb: "0D655E" } },
    right: { style: "thin", color: { rgb: "0D655E" } },
  },
};

const BORDER_THIN = {
  top: { style: "thin", color: { rgb: "E2E8F0" } },
  bottom: { style: "thin", color: { rgb: "E2E8F0" } },
  left: { style: "thin", color: { rgb: "E2E8F0" } },
  right: { style: "thin", color: { rgb: "E2E8F0" } },
};

export interface BankExportMeta {
  bancoNombre?: string;
  numeroCuenta?: string;
  periodo?: string;
  cuentaContable?: string;
  company?: string;
  titular?: string;
}

/**
 * Exporta el libro completo de auditoría y conciliación bancaria con estilos profesionales
 */
export function exportConciliacionBancariaXlsx(
  result: BankConciliacionResult,
  meta: BankExportMeta,
  allMovLines: MovLine[] = []
) {
  const wb = XLSX.utils.book_new();
  const summary = result.summary;
  const banco = meta.bancoNombre || "Entidad Bancaria";
  const numCta = meta.numeroCuenta || "No especificado";
  const periodo = meta.periodo || new Date().toISOString().slice(0, 7);
  const empresa = meta.company || meta.titular || "Empresa Contable";
  const fechaGeneracion = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ==========================================
  // HOJA 1: ACTA DE CONCILIACIÓN ARITMÉTICA
  // ==========================================
  const actaData: (string | number)[][] = [
    ["ACTA OFICIAL DE CONCILIACIÓN BANCARIA Y TESORERÍA"],
    ["ESTÁNDAR NIIF / NIC 7 · CONCILIACIÓN ARITMÉTICA DE SALDOS"],
    [],
    ["EMPRESA / RAZÓN SOCIAL:", empresa],
    ["ENTIDAD FINANCIERA:", banco],
    ["NÚMERO DE CUENTA:", numCta],
    ["CUENTA CONTABLE LIBROS:", meta.cuentaContable === "todas" || meta.cuentaContable === "credicorp_all" || !meta.cuentaContable ? "Cuentas de Tesorería PUC 11 / 1250" : meta.cuentaContable],
    ["PERIODO CONCILIADO:", periodo],
    ["FECHA DE EMISIÓN:", fechaGeneracion],
    [],
    ["ESTRUCTURA DE CONCILIACIÓN ARITMÉTICA", "SIGNO", "VALOR EN PESOS (COP)"],
    ["Saldo Final según Extracto Bancario", "(=)", summary.saldoExtracto],
    ["(+) Consignaciones o Abonos en Tránsito (Libros pero no en Banco)", "(+)", summary.consignacionesEnTransito],
    ["(-) Cheques y Giros pendientes de cobro (Libros pero no en Banco)", "(-)", -summary.chequesEnTransito],
    ["(-) Notas Débito Bancarias no contabilizadas (GMF 4x1000 / Comisiones / Retenciones)", "(-)", -summary.notasDebitoNoRegistradas],
    ["(+) Notas Crédito Bancarias no contabilizadas (Rendimientos / Abonos)", "(+)", summary.notasCreditoNoRegistradas],
    ["(=) SALDO CONCILIADO DE BANCOS", "(=)", summary.saldoConciliado],
    [],
    ["Saldo Final según Libros Contables (Cuentas 11 / 1250)", "(=)", summary.saldoLibros],
    ["(=) DIFERENCIA DE CONCILIACIÓN (CUADRE)", "(=)", summary.diferenciaCuadre],
    [],
    ["ESTADO DE AUDITORÍA:", summary.cuadrado ? "CONCILIACIÓN CUADRADA AL 100% · SIN DIFERENCIAS" : "CONCILIACIÓN CON PARTIDAS PENDIENTES DE AJUSTE"],
    [],
    [],
    ["CERTIFICACIÓN Y FIRMAS DE RESPONSABILIDAD CONTABLE"],
    [],
    [],
    ["_________________________________________", "", "_________________________________________"],
    ["ELABORÓ: CONTADOR PÚBLICO", "", "REVISÓ: REVISOR FISCAL / REPRESENTANTE LEGAL"],
    ["T.P. No.", "", "C.C. / T.P. No."],
  ];

  const wsActa = XLSX.utils.aoa_to_sheet(actaData);
  wsActa["!cols"] = [{ wch: 45 }, { wch: 10 }, { wch: 25 }, { wch: 30 }];

  // Estilos de la Hoja 1
  const rangeActa = XLSX.utils.decode_range(wsActa["!ref"] || "A1:C28");
  for (let R = rangeActa.s.r; R <= rangeActa.e.r; ++R) {
    for (let C = rangeActa.s.c; C <= rangeActa.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!wsActa[addr]) continue;

      if (R === 0) {
        wsActa[addr].s = {
          font: { name: "Calibri", sz: 14, bold: true, color: { rgb: "0F766E" } },
        };
      } else if (R === 10) {
        wsActa[addr].s = HEADER_STYLE;
      } else if (R === 16 || R === 19) {
        // Filas de Saldo Conciliado y Diferencia
        wsActa[addr].s = {
          fill: { fgColor: { rgb: summary.cuadrado ? "DCFCE7" : "FEF3C7" } },
          font: { name: "Calibri", sz: 11, bold: true, color: { rgb: summary.cuadrado ? "166534" : "92400E" } },
          border: BORDER_THIN,
        };
      } else if (R >= 11 && R <= 19 && C === 2) {
        wsActa[addr].z = "$#,##0.00;($#,##0.00);\"$0.00\"";
        wsActa[addr].s = {
          font: { name: "Calibri", sz: 11, bold: R === 16 || R === 19 },
          alignment: { horizontal: "right" },
          border: BORDER_THIN,
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, wsActa, "Acta Conciliación");

  // ==========================================
  // HOJA 2: DETALLE GENERAL DE MOVIMIENTOS
  // ==========================================
  const headersDetalle = [
    "Estado Conciliación",
    "Fecha",
    "Descripción / Concepto",
    "Referencia Bancaria",
    "Tipo Operación",
    "Monto en Extracto (COP)",
    "Monto en Libros (COP)",
    "Diferencia (COP)",
    "Diagnóstico / Clasificación Contable",
    "Comprobante Contable",
    "Cuenta Contable",
    "Tercero / Beneficiario",
  ];

  const rowsDetalle: (string | number)[][] = [headersDetalle];

  for (const r of result.rows) {
    let estadoLabel = "Conciliado";
    if (r.estado === "partida_en_transito_libros") {
      estadoLabel = r.tipo === "retiro" ? "Cheque/Giro en Tránsito" : "Consignación en Tránsito";
    } else if (r.estado === "nota_debito_banco") {
      estadoLabel = r.esGmf
        ? "GMF 4x1000 (Pendiente Libros)"
        : r.esRetencion
        ? "Retención Fuente 7% (Pendiente Libros)"
        : r.esComision
        ? "Comisión Bancaria (Pendiente Libros)"
        : "Nota Débito (Pendiente Libros)";
    } else if (r.estado === "nota_credito_banco") {
      estadoLabel = r.esRendimiento ? "Rendimientos (Pendiente Libros)" : "Nota Crédito (Pendiente Libros)";
    } else if (r.estado === "diferencia_valor") {
      estadoLabel = "Diferencia de Valor";
    }

    const compStr = r.itemsLibrosLote
      ? r.itemsLibrosLote.map((c) => c.comprobante).filter(Boolean).join(" | ")
      : r.itemLibros?.comprobante || "—";

    let ctaStr = "—";
    if (r.itemsLibrosLote) {
      ctaStr = r.itemsLibrosLote.map((c) => c.cuenta).filter(Boolean).slice(0, 3).join(", ");
    } else if (r.itemLibros?.cuenta) {
      ctaStr = `${r.itemLibros.cuenta} (${r.itemLibros.cuentaNombre})`;
    } else if (r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco") {
      const puc = inferBankPucForRow(r, banco, meta.cuentaContable, allMovLines);
      ctaStr = `${puc.cuentaContrapartida} (${puc.nombreContrapartida}) [Sugerida]`;
    }

    const terceroStr = r.itemsLibrosLote
      ? `Lote ACH (${r.itemsLibrosLote.length} comprobantes)`
      : r.itemLibros?.nombre ? `${r.itemLibros.nombre} ${r.itemLibros.nit ? `[${r.itemLibros.nit}]` : ""}` : "—";

    rowsDetalle.push([
      estadoLabel,
      r.fecha,
      r.descripcion,
      r.referencia || "—",
      r.tipo === "retiro" ? "Egreso / Retiro" : "Ingreso / Abono",
      r.montoBanco,
      r.montoLibros,
      r.diferencia,
      r.nota,
      compStr,
      ctaStr,
      terceroStr,
    ]);
  }

  const wsDetalle = XLSX.utils.aoa_to_sheet(rowsDetalle);
  wsDetalle["!cols"] = [
    { wch: 26 },
    { wch: 13 },
    { wch: 42 },
    { wch: 18 },
    { wch: 16 },
    { wch: 22 },
    { wch: 22 },
    { wch: 18 },
    { wch: 38 },
    { wch: 22 },
    { wch: 36 },
    { wch: 32 },
  ];

  // Aplicar estilos a encabezado y columnas de valores
  const rangeDetalle = XLSX.utils.decode_range(wsDetalle["!ref"] || "A1:L1");
  for (let C = rangeDetalle.s.c; C <= rangeDetalle.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (wsDetalle[addr]) wsDetalle[addr].s = HEADER_STYLE;
  }
  for (let R = 1; R <= rangeDetalle.e.r; ++R) {
    for (const cIdx of [5, 6, 7]) {
      const addr = XLSX.utils.encode_cell({ r: R, c: cIdx });
      if (wsDetalle[addr]) {
        wsDetalle[addr].z = "$#,##0.00;($#,##0.00);\"-\"";
        wsDetalle[addr].s = { alignment: { horizontal: "right" }, border: BORDER_THIN };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle Conciliación");

  // ==========================================
  // HOJA 3: PARTIDAS EN TRÁNSITO Y PENDIENTES
  // ==========================================
  const pendingRows = result.rows.filter(
    (r) =>
      r.estado === "nota_debito_banco" ||
      r.estado === "nota_credito_banco" ||
      r.estado === "partida_en_transito_libros"
  );

  const headersPendientes = [
    "Categoría Conciliatoria",
    "Efecto en Conciliación",
    "Fecha",
    "Concepto / Descripción",
    "Referencia / Comprobante",
    "Valor Pendiente (COP)",
    "Cuenta Débito Sugerida",
    "Cuenta Crédito Sugerida",
    "Tercero / NIT Sugerido",
    "Instrucción para el Contador",
  ];

  const rowsPendientes: (string | number)[][] = [headersPendientes];

  for (const r of pendingRows) {
    let categoria = "Partida en Tránsito";
    let efecto = "Sin efecto";
    let ctaDebito = "—";
    let ctaCredito = "—";
    let terceroSug = "—";

    if (r.estado === "partida_en_transito_libros") {
      if (r.tipo === "retiro") {
        categoria = "Cheque / Giro en Tránsito";
        efecto = "Resta al extracto (-)";
        ctaDebito = "Ya causado en libros";
        ctaCredito = "Banco (Cobro diferido)";
        terceroSug = r.itemLibros?.nombre ? `${r.itemLibros.nombre} [${r.itemLibros.nit || ""}]` : "Beneficiario giro";
      } else {
        categoria = "Consignación en Tránsito";
        efecto = "Suma al extracto (+)";
        ctaDebito = "Banco (Abono diferido)";
        ctaCredito = "Ya causado en libros";
        terceroSug = r.itemLibros?.nombre ? `${r.itemLibros.nombre} [${r.itemLibros.nit || ""}]` : "Depositante";
      }
    } else {
      const puc = inferBankPucForRow(r, banco, meta.cuentaContable, allMovLines);
      categoria = puc.naturalezaLabel;
      efecto = r.estado === "nota_debito_banco" ? "Resta al libro de bancos (-)" : "Suma al libro de bancos (+)";
      ctaDebito = `${puc.cuentaDebito} (${puc.nombreDebito})`;
      ctaCredito = `${puc.cuentaCredito} (${puc.nombreCredito})`;
      terceroSug = `${puc.nombreTercero} [${puc.nitTercero}]`;
    }

    const valor = r.montoBanco > 0 ? r.montoBanco : r.montoLibros;
    const refComp = r.itemLibros?.comprobante || r.referencia || "—";

    rowsPendientes.push([
      categoria,
      efecto,
      r.fecha,
      r.descripcion,
      refComp,
      valor,
      ctaDebito,
      ctaCredito,
      terceroSug,
      r.nota,
    ]);
  }

  const wsPendientes = XLSX.utils.aoa_to_sheet(rowsPendientes);
  wsPendientes["!cols"] = [
    { wch: 28 },
    { wch: 24 },
    { wch: 13 },
    { wch: 38 },
    { wch: 20 },
    { wch: 22 },
    { wch: 36 },
    { wch: 36 },
    { wch: 32 },
    { wch: 36 },
  ];

  const rangePendientes = XLSX.utils.decode_range(wsPendientes["!ref"] || "A1:J1");
  for (let C = rangePendientes.s.c; C <= rangePendientes.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (wsPendientes[addr]) wsPendientes[addr].s = HEADER_STYLE;
  }
  for (let R = 1; R <= rangePendientes.e.r; ++R) {
    const addr = XLSX.utils.encode_cell({ r: R, c: 5 });
    if (wsPendientes[addr]) {
      wsPendientes[addr].z = "$#,##0.00;($#,##0.00);\"-\"";
      wsPendientes[addr].s = { alignment: { horizontal: "right" }, border: BORDER_THIN };
    }
  }

  XLSX.utils.book_append_sheet(wb, wsPendientes, "Partidas Pendientes");

  // ==========================================
  // HOJA 4: ASIENTO CONTABLE DE AJUSTE (ERP)
  // ==========================================
  const unrecordedBankNotes = result.rows.filter(
    (r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco"
  );

  const headersAsiento = [
    "Fecha",
    "Comprobante",
    "Código Cuenta PUC",
    "Nombre de la Cuenta",
    "NIT / Tercero",
    "Razón Social Tercero",
    "Concepto / Detalle de la Operación",
    "Débito (COP)",
    "Crédito (COP)",
  ];

  const rowsAsiento: (string | number)[][] = [headersAsiento];
  let totalAsientoDeb = 0;
  let totalAsientoCred = 0;

  unrecordedBankNotes.forEach((r, idx) => {
    const fecha = r.fecha || new Date().toISOString().slice(0, 10);
    const compNum = `NC-AJ-${String(idx + 1).padStart(3, "0")}`;
    const monto = r.montoBanco;
    const puc = inferBankPucForRow(r, banco, meta.cuentaContable, allMovLines);

    // Línea 1: Débito
    rowsAsiento.push([
      fecha,
      compNum,
      puc.cuentaDebito,
      puc.nombreDebito,
      puc.nitDebito,
      puc.terceroDebito,
      `${puc.naturalezaLabel}: ${r.descripcion || "Ajuste bancario"}`,
      monto,
      0,
    ]);

    // Línea 2: Crédito
    rowsAsiento.push([
      fecha,
      compNum,
      puc.cuentaCredito,
      puc.nombreCredito,
      puc.nitCredito,
      puc.terceroCredito,
      `Contrapartida ${puc.naturalezaLabel} (${banco})`,
      0,
      monto,
    ]);

    totalAsientoDeb += monto;
    totalAsientoCred += monto;
  });

  if (unrecordedBankNotes.length > 0) {
    rowsAsiento.push([
      "",
      "",
      "",
      "",
      "",
      "",
      "TOTAL SUMAS IGUALES (PARTIDA DOBLE):",
      totalAsientoDeb,
      totalAsientoCred,
    ]);
  }

  const wsAsiento = XLSX.utils.aoa_to_sheet(rowsAsiento);
  wsAsiento["!cols"] = [
    { wch: 13 },
    { wch: 15 },
    { wch: 18 },
    { wch: 42 },
    { wch: 16 },
    { wch: 36 },
    { wch: 44 },
    { wch: 20 },
    { wch: 20 },
  ];

  const rangeAsiento = XLSX.utils.decode_range(wsAsiento["!ref"] || "A1:I1");
  for (let C = rangeAsiento.s.c; C <= rangeAsiento.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (wsAsiento[addr]) wsAsiento[addr].s = HEADER_STYLE;
  }
  for (let R = 1; R <= rangeAsiento.e.r; ++R) {
    for (const cIdx of [7, 8]) {
      const addr = XLSX.utils.encode_cell({ r: R, c: cIdx });
      if (wsAsiento[addr]) {
        wsAsiento[addr].z = "$#,##0.00;($#,##0.00);\"-\"";
        wsAsiento[addr].s = {
          font: { name: "Calibri", sz: 11, bold: R === rangeAsiento.e.r && unrecordedBankNotes.length > 0 },
          alignment: { horizontal: "right" },
          border: BORDER_THIN,
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, wsAsiento, "Asiento Ajuste Contable");

  // Descargar el archivo con nombre corporativo
  const cleanBanco = banco.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
  XLSX.writeFile(wb, `Conciliacion_Bancaria_Oficial_${cleanBanco}_${periodo}.xlsx`);
}

/**
 * Exporta exclusivamente el comprobante de diario de ajuste listo para importar a software contable
 */
export function exportAsientoAjusteBancario(
  rows: BankConciliacionRow[],
  bancoNombre = "Banco",
  cuentaBanco = "111005",
  allMovLines: MovLine[] = []
) {
  const wb = XLSX.utils.book_new();
  const unrecorded = rows.filter(
    (r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco"
  );

  const headers = [
    "Fecha (AAAA-MM-DD)",
    "Tipo Comprobante",
    "Numero",
    "Cuenta Contable",
    "Nombre Cuenta",
    "Identificacion Tercero",
    "Nombre Tercero",
    "Descripcion / Concepto",
    "Debito",
    "Credito",
  ];

  const data: (string | number)[][] = [headers];

  unrecorded.forEach((r, idx) => {
    const fecha = r.fecha || new Date().toISOString().slice(0, 10);
    const num = `AJ-${String(idx + 1).padStart(3, "0")}`;
    const monto = r.montoBanco;
    const puc = inferBankPucForRow(r, bancoNombre, cuentaBanco, allMovLines);
    const desc = `${puc.naturalezaLabel}: ${r.descripcion || "Ajuste bancario"}`;

    data.push([
      fecha,
      "NC",
      num,
      puc.cuentaDebito,
      puc.nombreDebito,
      puc.nitDebito,
      puc.terceroDebito,
      desc,
      monto,
      0,
    ]);
    data.push([
      fecha,
      "NC",
      num,
      puc.cuentaCredito,
      puc.nombreCredito,
      puc.nitCredito,
      puc.terceroCredito,
      `Contrapartida ${desc}`,
      0,
      monto,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 36 },
    { wch: 22 },
    { wch: 34 },
    { wch: 40 },
    { wch: 18 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Asiento_Ajuste");
  XLSX.writeFile(wb, `Asiento_Ajuste_Bancario_${bancoNombre.replace(/\s+/g, "_")}.xlsx`);
}

/**
 * Plantilla de causación bancaria en formato nativo Siigo Nube / Pyme (Comprobante Contable / Notas Bancarias)
 */
export function exportBancosSiigoXlsx(
  rows: BankConciliacionRow[],
  bancoNombre = "Banco",
  cuentaBanco = "11100501",
  allMovLines: MovLine[] = []
) {
  const unrecorded = rows.filter(
    (r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco"
  );
  const targetRows = unrecorded.length > 0 ? unrecorded : rows;
  const data: Array<Record<string, string | number>> = [];

  targetRows.forEach((r, idx) => {
    const seq = String(idx + 1).padStart(3, "0");
    const docDate = r.fecha ? r.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const monto = r.montoBanco > 0 ? r.montoBanco : r.montoLibros;
    const puc = inferBankPucForRow(r, bancoNombre, cuentaBanco, allMovLines);
    const ref = r.referencia || `AJ-${seq}`;

    // 1. Línea Débito
    data.push({
      "Tipo Comprobante": "CC",
      "Consecutivo": seq,
      "Fecha": docDate,
      "Cuenta Contable": puc.cuentaDebito,
      "Nombre Cuenta": puc.nombreDebito,
      "NIT / Cédula Tercero": puc.nitDebito,
      "Razón Social Tercero": puc.terceroDebito,
      "Documento Cruce": ref,
      "Débito": monto,
      "Crédito": 0,
      "Descripción / Detalle": `${puc.naturalezaLabel} - ${r.descripcion}`,
    });

    // 2. Línea Crédito
    data.push({
      "Tipo Comprobante": "CC",
      "Consecutivo": seq,
      "Fecha": docDate,
      "Cuenta Contable": puc.cuentaCredito,
      "Nombre Cuenta": puc.nombreCredito,
      "NIT / Cédula Tercero": puc.nitCredito,
      "Razón Social Tercero": puc.terceroCredito,
      "Documento Cruce": ref,
      "Débito": 0,
      "Crédito": monto,
      "Descripción / Detalle": `Contrapartida ${puc.naturalezaLabel} (${bancoNombre})`,
    });
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 18 },
    { wch: 38 },
    { wch: 20 },
    { wch: 38 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 42 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Siigo_Bancos");
  const cleanBanco = (bancoNombre || "Bancos").replace(/[^a-zA-Z0-9_-]/g, "_");
  XLSX.writeFile(wb, `Plantilla_Siigo_Bancos_${cleanBanco}.xlsx`);
}

/**
 * Plantilla de causación bancaria en formato nativo World Office (Nota de Contabilidad / Ajustes Bancarios)
 */
export function exportBancosWorldOfficeXlsx(
  rows: BankConciliacionRow[],
  bancoNombre = "Banco",
  cuentaBanco = "11100501",
  allMovLines: MovLine[] = []
) {
  const unrecorded = rows.filter(
    (r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco"
  );
  const targetRows = unrecorded.length > 0 ? unrecorded : rows;
  const data: Array<Record<string, string | number>> = [];

  targetRows.forEach((r, idx) => {
    const folio = String(idx + 1);
    const docDate = r.fecha ? r.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const monto = r.montoBanco > 0 ? r.montoBanco : r.montoLibros;
    const puc = inferBankPucForRow(r, bancoNombre, cuentaBanco, allMovLines);
    const docRef = r.referencia || `NB-${folio}`;

    // 1. Línea Débito
    data.push({
      "Tipo Documento": "NC",
      "Prefijo": "BAN",
      "Número Documento": folio,
      "Fecha (AAAA-MM-DD)": docDate,
      "Identificación Tercero": puc.nitDebito,
      "Razón Social": puc.terceroDebito,
      "Código Cuenta Contable": puc.cuentaDebito,
      "Nombre Cuenta": puc.nombreDebito,
      "Centro Costo": "01",
      "Documento Referencia": docRef,
      "Valor Débito": monto,
      "Valor Crédito": 0,
      "Detalle / Observación": `${puc.naturalezaLabel} - ${r.descripcion}`,
    });

    // 2. Línea Crédito
    data.push({
      "Tipo Documento": "NC",
      "Prefijo": "BAN",
      "Número Documento": folio,
      "Fecha (AAAA-MM-DD)": docDate,
      "Identificación Tercero": puc.nitCredito,
      "Razón Social": puc.terceroCredito,
      "Código Cuenta Contable": puc.cuentaCredito,
      "Nombre Cuenta": puc.nombreCredito,
      "Centro Costo": "01",
      "Documento Referencia": docRef,
      "Valor Débito": 0,
      "Valor Crédito": monto,
      "Detalle / Observación": `Contrapartida ${puc.naturalezaLabel} (${bancoNombre})`,
    });
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 16 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
    { wch: 22 },
    { wch: 38 },
    { wch: 22 },
    { wch: 38 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 42 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "WorldOffice_Bancos");
  const cleanBanco = (bancoNombre || "Bancos").replace(/[^a-zA-Z0-9_-]/g, "_");
  XLSX.writeFile(wb, `Plantilla_WorldOffice_Bancos_${cleanBanco}.xlsx`);
}

/**
 * Plantilla de causación bancaria en formato nativo Helisa GW / NIIF (Comprobante deAjuste Bancario)
 */
export function exportBancosHelisaXlsx(
  rows: BankConciliacionRow[],
  bancoNombre = "Banco",
  cuentaBanco = "11100501",
  allMovLines: MovLine[] = []
) {
  const unrecorded = rows.filter(
    (r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco"
  );
  const targetRows = unrecorded.length > 0 ? unrecorded : rows;
  const data: Array<Record<string, string | number>> = [];

  targetRows.forEach((r, idx) => {
    const compNum = String(idx + 1).padStart(6, "0");
    const docDate = r.fecha
      ? r.fecha.slice(0, 10).replace(/-/g, "/")
      : new Date().toISOString().slice(0, 10).replace(/-/g, "/");
    const monto = r.montoBanco > 0 ? r.montoBanco : r.montoLibros;
    const puc = inferBankPucForRow(r, bancoNombre, cuentaBanco, allMovLines);
    const docRef = r.referencia || `BAN-${idx + 1}`;

    // 1. Línea Débito
    data.push({
      "Tipo Comprobante": "05",
      "Número Comprobante": compNum,
      "Fecha (AAAA/MM/DD)": docDate,
      "Cuenta Contable": puc.cuentaDebito,
      "Nombre de Cuenta": puc.nombreDebito,
      "NIT / Tercero": puc.nitDebito,
      "Razón Social Tercero": puc.terceroDebito,
      "Cheque / Documento Ref": docRef,
      "Concepto Movimiento": `${puc.naturalezaLabel} - ${r.descripcion}`,
      "Débito": monto,
      "Crédito": 0,
      "Centro Costos": "001",
    });

    // 2. Línea Crédito
    data.push({
      "Tipo Comprobante": "05",
      "Número Comprobante": compNum,
      "Fecha (AAAA/MM/DD)": docDate,
      "Cuenta Contable": puc.cuentaCredito,
      "Nombre de Cuenta": puc.nombreCredito,
      "NIT / Tercero": puc.nitCredito,
      "Razón Social Tercero": puc.terceroCredito,
      "Cheque / Documento Ref": docRef,
      "Concepto Movimiento": `Contrapartida ${puc.naturalezaLabel} (${bancoNombre})`,
      "Débito": 0,
      "Crédito": monto,
      "Centro Costos": "001",
    });
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 18 },
    { wch: 38 },
    { wch: 18 },
    { wch: 38 },
    { wch: 22 },
    { wch: 42 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Helisa_Bancos");
  const cleanBanco = (bancoNombre || "Bancos").replace(/[^a-zA-Z0-9_-]/g, "_");
  XLSX.writeFile(wb, `Plantilla_Helisa_Bancos_${cleanBanco}.xlsx`);
}

