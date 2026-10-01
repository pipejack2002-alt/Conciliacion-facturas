import XLSX from "xlsx-js-style";
import type { BankConciliacionResult, BankConciliacionRow } from "./conciliar-bancos.ts";
import type { MovLine } from "./types.ts";

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
  _allMovLines: MovLine[] = []
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
    ["CUENTA CONTABLE LIBROS:", meta.cuentaContable === "todas" || !meta.cuentaContable ? "Cuentas de Tesorería PUC 11 / 1250" : meta.cuentaContable],
    ["PERIODO CONCILIADO:", periodo],
    ["FECHA DE EMISIÓN:", fechaGeneracion],
    [],
    ["ESTRUCTURA DE CONCILIACIÓN ARITMÉTICA", "SIGNO", "VALOR EN PESOS (COP)"],
    ["Saldo Final según Extracto Bancario", "(=)", summary.saldoExtracto],
    ["(+) Consignaciones o Abonos en Tránsito (Libros pero no en Banco)", "(+)", summary.consignacionesEnTransito],
    ["(-) Cheques y Giros pendientes de cobro (Libros pero no en Banco)", "(-)", -summary.chequesEnTransito],
    ["(-) Notas Débito Bancarias no contabilizadas (GMF 4x1000 / Comisiones)", "(-)", -summary.notasDebitoNoRegistradas],
    ["(+) Notas Crédito Bancarias no contabilizadas (Rendimientos)", "(+)", summary.notasCreditoNoRegistradas],
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
      estadoLabel = r.esGmf ? "GMF 4x1000 (Pendiente Libros)" : r.esComision ? "Comisión Bancaria (Pendiente Libros)" : "Nota Débito (Pendiente Libros)";
    } else if (r.estado === "nota_credito_banco") {
      estadoLabel = r.esRendimiento ? "Rendimientos (Pendiente Libros)" : "Nota Crédito (Pendiente Libros)";
    } else if (r.estado === "diferencia_valor") {
      estadoLabel = "Diferencia de Valor";
    }

    const compStr = r.itemsLibrosLote
      ? r.itemsLibrosLote.map((c) => c.comprobante).filter(Boolean).join(" | ")
      : r.itemLibros?.comprobante || "—";

    const ctaStr = r.itemsLibrosLote
      ? r.itemsLibrosLote.map((c) => c.cuenta).filter(Boolean).slice(0, 3).join(", ")
      : r.itemLibros?.cuenta ? `${r.itemLibros.cuenta} (${r.itemLibros.cuentaNombre})` : "—";

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
    { wch: 28 },
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
    "Instrucción para el Contador",
  ];

  const rowsPendientes: (string | number)[][] = [headersPendientes];

  for (const r of pendingRows) {
    let categoria = "Partida en Tránsito";
    let efecto = "Sin efecto";
    let ctaDebito = "—";
    let ctaCredito = "—";

    if (r.estado === "partida_en_transito_libros") {
      if (r.tipo === "retiro") {
        categoria = "Cheque / Giro en Tránsito";
        efecto = "Resta al extracto (-)";
        ctaDebito = "Ya causado en libros";
        ctaCredito = "Banco (Cobro diferido)";
      } else {
        categoria = "Consignación en Tránsito";
        efecto = "Suma al extracto (+)";
        ctaDebito = "Banco (Abono diferido)";
        ctaCredito = "Ya causado en libros";
      }
    } else if (r.estado === "nota_debito_banco") {
      efecto = "Resta al libro de bancos (-)";
      if (r.esGmf) {
        categoria = "GMF 4x1000";
        ctaDebito = "51159501 (GMF Deducible)";
        ctaCredito = meta.cuentaContable || "111005 (Bancos)";
      } else if (r.esComision) {
        categoria = "Comisión Bancaria";
        ctaDebito = "530515 (Comisiones Financieras)";
        ctaCredito = meta.cuentaContable || "111005 (Bancos)";
      } else {
        categoria = "Nota Débito Banco";
        ctaDebito = "530595 (Gastos Bancarios)";
        ctaCredito = meta.cuentaContable || "111005 (Bancos)";
      }
    } else if (r.estado === "nota_credito_banco") {
      efecto = "Suma al libro de bancos (+)";
      if (r.esRendimiento) {
        categoria = "Rendimientos Financieros";
        ctaDebito = meta.cuentaContable || "111005 (Bancos)";
        ctaCredito = "42100502 (Rendimientos Financieros)";
      } else {
        categoria = "Nota Crédito Banco";
        ctaDebito = meta.cuentaContable || "111005 (Bancos)";
        ctaCredito = "130505 (Clientes / Anticipos)";
      }
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
      r.nota,
    ]);
  }

  const wsPendientes = XLSX.utils.aoa_to_sheet(rowsPendientes);
  wsPendientes["!cols"] = [
    { wch: 25 },
    { wch: 24 },
    { wch: 13 },
    { wch: 38 },
    { wch: 20 },
    { wch: 22 },
    { wch: 28 },
    { wch: 28 },
    { wch: 36 },
  ];

  const rangePendientes = XLSX.utils.decode_range(wsPendientes["!ref"] || "A1:I1");
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
  const ctaBancoDefault = meta.cuentaContable && meta.cuentaContable !== "todas" ? meta.cuentaContable : "111005";

  for (const r of unrecordedBankNotes) {
    const fecha = r.fecha || new Date().toISOString().slice(0, 10);
    const monto = r.montoBanco;

    if (r.estado === "nota_debito_banco") {
      // Débito al gasto (GMF o Comisión) y Crédito al Banco
      if (r.esGmf) {
        rowsAsiento.push([
          fecha,
          "NC-AJUSTE",
          "51159501",
          "Gravamen a los Movimientos Financieros (GMF 4x1000)",
          "800197268",
          "DIAN - DIRECCION DE IMPUESTOS Y ADUANAS NACIONALES",
          `Causación GMF 4x1000 Extracto ${banco}`,
          monto,
          0,
        ]);
        rowsAsiento.push([
          fecha,
          "NC-AJUSTE",
          ctaBancoDefault,
          `Bancos Moneda Nacional (${banco})`,
          "890903938",
          banco,
          `Cargo por GMF Extracto ${banco}`,
          0,
          monto,
        ]);
      } else if (r.esComision) {
        rowsAsiento.push([
          fecha,
          "NC-AJUSTE",
          "53051501",
          "Comisiones y Servicios Bancarios",
          "890903938",
          banco,
          `Comisión bancaria / cuota manejo Extracto ${banco}`,
          monto,
          0,
        ]);
        rowsAsiento.push([
          fecha,
          "NC-AJUSTE",
          ctaBancoDefault,
          `Bancos Moneda Nacional (${banco})`,
          "890903938",
          banco,
          `Cargo por comisión Extracto ${banco}`,
          0,
          monto,
        ]);
      } else {
        rowsAsiento.push([
          fecha,
          "NC-AJUSTE",
          "53059501",
          "Otros Gastos Bancarios y Financieros",
          "890903938",
          banco,
          r.descripcion || "Nota Débito no registrada",
          monto,
          0,
        ]);
        rowsAsiento.push([
          fecha,
          "NC-AJUSTE",
          ctaBancoDefault,
          `Bancos Moneda Nacional (${banco})`,
          "890903938",
          banco,
          r.descripcion || "Nota Débito bancaria",
          0,
          monto,
        ]);
      }
    } else if (r.estado === "nota_credito_banco") {
      // Débito al Banco y Crédito a Rendimientos o Clientes
      if (r.esRendimiento) {
        rowsAsiento.push([
          fecha,
          "NC-AJUSTE",
          ctaBancoDefault,
          `Bancos Moneda Nacional (${banco})`,
          "890903938",
          banco,
          `Abono de Rendimientos Financieros Extracto ${banco}`,
          monto,
          0,
        ]);
        rowsAsiento.push([
          fecha,
          "NC-AJUSTE",
          "42100502",
          "Intereses y Rendimientos Financieros Cuentas Corrientes/Ahorros",
          "890903938",
          banco,
          `Rendimientos liquidados Extracto ${banco}`,
          0,
          monto,
        ]);
      } else {
        rowsAsiento.push([
          fecha,
          "NC-AJUSTE",
          ctaBancoDefault,
          `Bancos Moneda Nacional (${banco})`,
          "890903938",
          banco,
          r.descripcion || "Abono bancario no registrado",
          monto,
          0,
        ]);
        rowsAsiento.push([
          fecha,
          "NC-AJUSTE",
          "13050501",
          "Clientes Nacionales / Anticipos Pendientes",
          "222222222",
          "Clientes Varios / Por Identificar",
          r.descripcion || "Abono bancario no identificado",
          0,
          monto,
        ]);
      }
    }
  }

  const wsAsiento = XLSX.utils.aoa_to_sheet(rowsAsiento);
  wsAsiento["!cols"] = [
    { wch: 13 },
    { wch: 15 },
    { wch: 18 },
    { wch: 38 },
    { wch: 16 },
    { wch: 35 },
    { wch: 42 },
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
        wsAsiento[addr].s = { alignment: { horizontal: "right" }, border: BORDER_THIN };
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
  cuentaBanco = "111005"
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

    if (r.estado === "nota_debito_banco") {
      const ctaGasto = r.esGmf ? "51159501" : r.esComision ? "53051501" : "53059501";
      const desc = r.esGmf ? "GMF 4x1000 Extracto Bancario" : r.esComision ? "Comisión Bancaria Extracto" : r.descripcion;
      data.push([fecha, "NC", num, ctaGasto, "890903938", bancoNombre, desc, monto, 0]);
      data.push([fecha, "NC", num, cuentaBanco, "890903938", bancoNombre, `Contrapartida ${desc}`, 0, monto]);
    } else {
      const ctaIngreso = r.esRendimiento ? "42100502" : "13050501";
      const desc = r.esRendimiento ? "Rendimientos Financieros Extracto" : r.descripcion;
      data.push([fecha, "NC", num, cuentaBanco, "890903938", bancoNombre, desc, monto, 0]);
      data.push([fecha, "NC", num, ctaIngreso, "890903938", bancoNombre, `Contrapartida ${desc}`, 0, monto]);
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 22 },
    { wch: 30 },
    { wch: 38 },
    { wch: 18 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Asiento_Ajuste");
  XLSX.writeFile(wb, `Asiento_Ajuste_Bancario_${bancoNombre.replace(/\s+/g, "_")}.xlsx`);
}
