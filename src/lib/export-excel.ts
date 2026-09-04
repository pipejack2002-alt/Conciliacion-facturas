import XLSX from "xlsx-js-style";
import { ESTADO_LABEL } from "./conciliar.ts";
import { getTaxInsight } from "./tax-insights.ts";
import type { Review } from "./reviews.ts";
import type { ConciliacionResult, ConciliacionRow, EstadoConciliacion } from "./types.ts";

// Estilos corporativos prémium
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

// Función auxiliar para construir y formatear una hoja de auditoría
function buildAuditSheet(
  dataRows: ConciliacionRow[],
  reviews?: Record<string, Review>,
) {
  const auditHeaders = [
    "Estado Auditoría",
    "Grupo",
    "Tipo Documento",
    "Prefijo",
    "Folio",
    "Número Completo",
    "Fecha",
    "NIT Contraparte",
    "Razón Social Contraparte",
    "Total DIAN (COP)",
    "Valor en Libros (COP)",
    "Diferencia (COP)",
    "Sugerencia / Causa Tributaria",
    "Método de Cruce",
    "Comprobantes Contables",
    "Cruce con NC",
    "CUFE",
    "Alerta / Inconsistencia",
    "Justificación / Nota Auditor",
    "Revisión Auditor",
  ];

  const auditData: (string | number)[][] = [auditHeaders];

  for (const r of dataRows) {
    const rev = reviews ? reviews[r.id] : undefined;
    const revNota = rev?.note || "";
    let revEstado = "Pendiente de Revisión";
    if (rev?.done) {
      revEstado = rev.action === "omitir" ? "Omitido por Auditor" : "Validado por Auditor";
    } else if (r.estado === "conciliado" || r.estado === "totalizado" || r.estado === "cruce_nc") {
      revEstado = "Conciliado OK (Automático)";
    } else if (r.estado === "no_aplica") {
      revEstado = "No Requiere Revisión";
    }
    const insight = getTaxInsight(r);
    const causaTexto = insight ? `${insight.etiqueta}: ${insight.detalle}` : "";

    auditData.push([
      ESTADO_LABEL[r.estado as EstadoConciliacion] || r.estado,
      r.grupo,
      r.tipo,
      r.prefijo,
      r.folio,
      r.numero,
      r.fecha,
      r.nitContraparte,
      r.nombreContraparte,
      r.totalDian,
      r.totalSiigo,
      r.diferencia,
      causaTexto,
      r.matchVia,
      r.comprobantes.join(" | "),
      r.linked.map((l) => l.numero).join(" | "),
      r.cufe,
      r.alerta,
      revNota,
      revEstado,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(auditData);
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:T1");

  // A. Estilo de Encabezados (Fila 0)
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (ws[addr]) {
      ws[addr].s = HEADER_STYLE;
    }
  }

  // B. Estilo de Filas de Datos (Fila 1 en adelante)
  for (let R = 1; R <= range.e.r; ++R) {
    const isEven = R % 2 === 0;
    const bgRow = isEven ? "F8FAFC" : "FFFFFF";

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) continue;

      cell.s = {
        fill: { fgColor: { rgb: bgRow } },
        font: { name: "Calibri", sz: 10, color: { rgb: "1E293B" } },
        alignment: { vertical: "center", horizontal: "left" },
        border: BORDER_THIN,
      };

      if (C === 0) {
        cell.s.alignment = { vertical: "center", horizontal: "center" };
        cell.s.font = { name: "Calibri", sz: 10, bold: true, color: { rgb: "0F172A" } };
      }

      if (C === 3 || C === 4 || C === 6) {
        cell.s.alignment = { vertical: "center", horizontal: "center" };
      }

      if (C === 9 || C === 10 || C === 11) {
        cell.z = '"$"#,##0.00';
        cell.s.alignment = { vertical: "center", horizontal: "right" };
        cell.s.font = { name: "Calibri", sz: 10, bold: C === 9 || C === 10, color: { rgb: "0F172A" } };
      }

      if (C === 19) {
        const val = String(cell.v || "");
        if (val.includes("Conciliado OK") || val.includes("Validado")) {
          cell.s = {
            fill: { fgColor: { rgb: "DCFCE7" } },
            font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "166534" } },
            alignment: { vertical: "center", horizontal: "center" },
            border: BORDER_THIN,
          };
        } else if (val.includes("Pendiente")) {
          cell.s = {
            fill: { fgColor: { rgb: "FEF3C7" } },
            font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "92400E" } },
            alignment: { vertical: "center", horizontal: "center" },
            border: BORDER_THIN,
          };
        } else {
          cell.s = {
            fill: { fgColor: { rgb: "F1F5F9" } },
            font: { name: "Calibri", sz: 10, color: { rgb: "475569" } },
            alignment: { vertical: "center", horizontal: "center" },
            border: BORDER_THIN,
          };
        }
      }
    }
  }

  ws["!cols"] = [
    { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 10 }, { wch: 12 },
    { wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 36 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 35 }, { wch: 24 }, { wch: 26 },
    { wch: 22 }, { wch: 32 }, { wch: 36 }, { wch: 35 }, { wch: 26 },
  ];
  ws["!rows"] = [{ hpt: 28 }, ...dataRows.map(() => ({ hpt: 22 }))];
  ws["!autofilter"] = { ref: `A1:T${dataRows.length + 1}` };
  ws["!views"] = [{ state: "frozen", ySplit: 1, activeCell: "A2" }];

  return ws;
}

export function exportAuditoriaXlsx(
  rows: ConciliacionRow[],
  result: ConciliacionResult,
  tab: string,
  reviews?: Record<string, Review>,
) {
  const wb = XLSX.utils.book_new();

  // Siempre garantizamos el universo completo de auditoría
  const allDataRows = result.rows.filter((r) => r.estado !== "no_aplica");
  const conciliadasRows = allDataRows.filter((r) => r.estado === "conciliado");
  const pendientesRows = allDataRows.filter((r) => r.estado === "pendiente" || r.estado === "posible_typo");
  const totalizadasRows = allDataRows.filter((r) => r.estado === "totalizado");
  const diferenciasRows = allDataRows.filter((r) => r.estado === "diferencia" || r.estado === "duplicado");

  // 2. Hoja de Resumen Ejecutivo (Con diseño de certificación gerencial)
  const t = result.totals;
  const summaryData: (string | number)[][] = [
    ["INFORME OFICIAL DE AUDITORÍA FISCAL Y CONCILIACIÓN CONTABLE", ""],
    ["", ""],
    ["DATOS DE LA EMPRESA", ""],
    ["Razón Social:", result.company.nombre],
    ["NIT / Identificación:", result.company.nit],
    ["Período Fiscal Evaluado:", result.periodLabel || "Mes actual"],
    ["Fecha y Hora de Emisión:", new Date().toLocaleString("es-CO")],
    ["", ""],
    ["RESUMEN DE EFECTIVIDAD Y COBERTURA", "CANTIDAD", "VALOR TOTAL (COP)"],
    ["Documentos Operativos Evaluados", t.documentos, ""],
    ["Facturas Recibidas (Compras y Gastos)", t.recibidos, t.valorDian],
    ["Conciliados / Registrados OK", t.conciliados, ""],
    ["Totalizados / Compras Agrupadas", t.totalizados, t.valorTotalizado],
    ["Pendientes de Registro en Libros", t.pendientesRecibidos, t.valorPendienteRecibido],
    ["Doble Registro en Contabilidad", t.duplicados, ""],
    ["Diferencias de Valor / Retenciones", t.diferencias, t.valorDiferencia],
    ["Cruces con Nota Crédito", t.crucesNc, ""],
    ["Movimientos Solo en Libros (Sin soporte DIAN)", t.soloSiigo, ""],
    ["", "", ""],
    ["EFECTIVIDAD DE CONCILIACIÓN DE COMPRAS", `${(t.pctRecibidos * 100).toFixed(1)}%`, ""],
    ["VALOR TOTAL EN RIESGO / COLA AUDITORÍA", t.cola, t.valorCola],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

  // Estilizado de la hoja Resumen
  const rangeSum = XLSX.utils.decode_range(wsSummary["!ref"] || "A1:C22");
  if (wsSummary["A1"]) {
    wsSummary["A1"].s = {
      fill: { fgColor: { rgb: "0F766E" } },
      font: { name: "Calibri", sz: 13, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { vertical: "center", horizontal: "left" },
    };
  }

  // Secciones en Resumen
  ["A3", "A9"].forEach((cellRef) => {
    if (wsSummary[cellRef]) {
      wsSummary[cellRef].s = {
        fill: { fgColor: { rgb: "F1F5F9" } },
        font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "0F172A" } },
        border: BORDER_THIN,
      };
    }
  });

  // Formatear valores numéricos de moneda en resumen
  for (let R = 8; R <= rangeSum.e.r; ++R) {
    const addrVal = XLSX.utils.encode_cell({ r: R, c: 2 });
    if (wsSummary[addrVal] && typeof wsSummary[addrVal].v === "number") {
      wsSummary[addrVal].z = '"$"#,##0.00';
    }
  }

  wsSummary["!cols"] = [{ wch: 44 }, { wch: 18 }, { wch: 24 }];
  wsSummary["!rows"] = [{ hpt: 30 }, { hpt: 15 }, { hpt: 24 }];
  
  // 1. Hoja: Resumen Ejecutivo
  XLSX.utils.book_append_sheet(wb, wsSummary, "1. Resumen Ejecutivo");

  // 2. Hoja: Universo Completo (DIAN) - Todas las facturas
  XLSX.utils.book_append_sheet(wb, buildAuditSheet(allDataRows, reviews), "2. Universo Completo DIAN");

  // 3. Hoja: Facturas Conciliadas OK (Soportadas y Cuadradas al 100%)
  if (conciliadasRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      buildAuditSheet(conciliadasRows, reviews),
      `3. Conciliadas OK (${conciliadasRows.length})`,
    );
  }

  // 4. Hoja: Facturas Pendientes (Cola de Auditoría por Causar)
  if (pendientesRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      buildAuditSheet(pendientesRows, reviews),
      `4. Pendientes Cola (${pendientesRows.length})`,
    );
  }

  // 5. Hoja: Facturas Totalizadas / Agrupadas en Bloque
  if (totalizadasRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      buildAuditSheet(totalizadasRows, reviews),
      `5. Totalizadas Bloque (${totalizadasRows.length})`,
    );
  }

  // 6. Hoja: Discrepancias / Diferencias y Duplicados si existen
  if (diferenciasRows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      buildAuditSheet(diferenciasRows, reviews),
      `6. Diferencias (${diferenciasRows.length})`,
    );
  }

  // 7. Hoja de Solo Libros (Huérfanos sin factura DIAN) con formato profesional
  if (result.orphans && result.orphans.length > 0) {
    const orphanHeaders = [
      "Comprobante",
      "Fecha",
      "NIT Tercero",
      "Nombre Tercero",
      "Descripción",
      "Cuenta Contable",
      "Débito (COP)",
      "Crédito (COP)",
    ];
    const orphanData: (string | number)[][] = [
      orphanHeaders,
      ...result.orphans.map((o) => [
        o.comprobante,
        o.fecha,
        o.nit,
        o.nombre,
        o.descripcion,
        o.cuenta,
        o.debito,
        o.credito,
      ]),
    ];
    const wsOrphans = XLSX.utils.aoa_to_sheet(orphanData);

    // Estilos de encabezado y celdas en Solo Libros
    const rangeOrf = XLSX.utils.decode_range(wsOrphans["!ref"] || "A1:H1");
    for (let C = 0; C <= rangeOrf.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (wsOrphans[addr]) wsOrphans[addr].s = HEADER_STYLE;
    }
    for (let R = 1; R <= rangeOrf.e.r; ++R) {
      const isEven = R % 2 === 0;
      const bg = isEven ? "F8FAFC" : "FFFFFF";
      for (let C = 0; C <= rangeOrf.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (wsOrphans[addr]) {
          wsOrphans[addr].s = {
            fill: { fgColor: { rgb: bg } },
            font: { name: "Calibri", sz: 10, color: { rgb: "1E293B" } },
            alignment: { vertical: "center", horizontal: C === 6 || C === 7 ? "right" : "left" },
            border: BORDER_THIN,
          };
          if (C === 6 || C === 7) {
            wsOrphans[addr].z = '"$"#,##0.00';
          }
        }
      }
    }

    wsOrphans["!cols"] = [
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 34 },
      { wch: 36 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
    ];
    wsOrphans["!rows"] = [{ hpt: 28 }, ...result.orphans.map(() => ({ hpt: 20 }))];
    wsOrphans["!autofilter"] = { ref: `A1:H${result.orphans.length + 1}` };
    wsOrphans["!views"] = [{ state: "frozen", ySplit: 1 }];

    XLSX.utils.book_append_sheet(wb, wsOrphans, `7. Solo Libros (${result.orphans.length})`);
  }

  // 8. Hoja de Cruces Factura - NC
  if (result.cruzes && result.cruzes.length > 0) {
    const cruceHeaders = [
      "Factura Número",
      "Estado Factura",
      "Nota Crédito Número",
      "Estado Nota Crédito",
      "NIT Proveedor",
      "Nombre Proveedor",
      "Valor Cruzado (COP)",
    ];
    const cruceData: (string | number)[][] = [
      cruceHeaders,
      ...result.cruzes.map((c) => [
        c.facturaNumero,
        ESTADO_LABEL[c.facturaEstado] || c.facturaEstado,
        c.notaNumero,
        ESTADO_LABEL[c.notaEstado] || c.notaEstado,
        c.nit,
        c.nombre,
        c.valor,
      ]),
    ];
    const wsCruzes = XLSX.utils.aoa_to_sheet(cruceData);

    const rangeCr = XLSX.utils.decode_range(wsCruzes["!ref"] || "A1:G1");
    for (let C = 0; C <= rangeCr.e.c; ++C) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C });
      if (wsCruzes[addr]) wsCruzes[addr].s = HEADER_STYLE;
    }
    for (let R = 1; R <= rangeCr.e.r; ++R) {
      for (let C = 0; C <= rangeCr.e.c; ++C) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        if (wsCruzes[addr]) {
          wsCruzes[addr].s = {
            fill: { fgColor: { rgb: R % 2 === 0 ? "F8FAFC" : "FFFFFF" } },
            border: BORDER_THIN,
            alignment: { vertical: "center", horizontal: C === 6 ? "right" : "left" },
          };
          if (C === 6) wsCruzes[addr].z = '"$"#,##0.00';
        }
      }
    }

    wsCruzes["!cols"] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
      { wch: 34 },
      { wch: 20 },
    ];
    wsCruzes["!rows"] = [{ hpt: 28 }, ...result.cruzes.map(() => ({ hpt: 20 }))];
    wsCruzes["!autofilter"] = { ref: `A1:G${result.cruzes.length + 1}` };
    wsCruzes["!views"] = [{ state: "frozen", ySplit: 1 }];

    XLSX.utils.book_append_sheet(wb, wsCruzes, `8. Cruces Factura-NC (${result.cruzes.length})`);
  }

  // Generar y descargar archivo en navegador
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const a = document.createElement("a");
  const cleanName = (result.company.nombre || "Auditoria")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-");
  a.href = URL.createObjectURL(blob);
  a.download = `auditoria-dian-${cleanName || "empresa"}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
