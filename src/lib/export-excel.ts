import * as XLSX from "xlsx";
import { ESTADO_LABEL } from "./conciliar";
import { getTaxInsight } from "./tax-insights";
import type { Review } from "./reviews";
import type { ConciliacionResult, ConciliacionRow, EstadoConciliacion } from "./types";

export function exportAuditoriaXlsx(
  rows: ConciliacionRow[],
  result: ConciliacionResult,
  tab: string,
  reviews?: Record<string, Review>,
) {
  const wb = XLSX.utils.book_new();

  // 1. Hoja de Documentos de Auditoría
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

  // Si rows viene vacío o se exporta desde una vista sin elementos (ej. Cola con 0 inconsistencias),
  // se exporta automáticamente el universo completo de auditoría para garantizar el soporte formal íntegro.
  const dataRows = (rows && rows.length > 0)
    ? rows
    : result.rows.filter((r) => r.estado !== "no_aplica");
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

  const wsAudit = XLSX.utils.aoa_to_sheet(auditData);
  wsAudit["!cols"] = [
    { wch: 18 }, // Estado
    { wch: 12 }, // Grupo
    { wch: 22 }, // Tipo
    { wch: 10 }, // Prefijo
    { wch: 12 }, // Folio
    { wch: 18 }, // Número
    { wch: 12 }, // Fecha
    { wch: 15 }, // NIT
    { wch: 34 }, // Razón Social
    { wch: 16 }, // Total DIAN
    { wch: 16 }, // Valor Libros
    { wch: 16 }, // Diferencia
    { wch: 32 }, // Causa Tributaria
    { wch: 20 }, // Match
    { wch: 22 }, // Comprobantes
    { wch: 18 }, // Cruce NC
    { wch: 30 }, // CUFE
    { wch: 35 }, // Alerta
    { wch: 35 }, // Justificación
    { wch: 22 }, // Revisión
  ];
  XLSX.utils.book_append_sheet(wb, wsAudit, "Auditoría DIAN");

  // 2. Hoja de Resumen Ejecutivo
  const t = result.totals;
  const summaryData: (string | number)[][] = [
    ["INFORME DE AUDITORÍA Y CONCILIACIÓN DIAN VS LIBROS CONTABLES"],
    [],
    ["DATOS DE LA EMPRESA", ""],
    ["Empresa / Razón Social:", result.company.nombre],
    ["NIT:", result.company.nit],
    ["Período Evaluado:", result.periodLabel || "Mes actual"],
    ["Fecha de Generación:", new Date().toLocaleString("es-CO")],
    [],
    ["MÉTRICAS Y RESULTADOS", "CANTIDAD", "VALOR TOTAL (COP)"],
    ["Documentos Operativos Totales", t.documentos, ""],
    ["Facturas Recibidas (Compras / Gastos)", t.recibidos, t.valorDian],
    ["Conciliados / Registrados OK", t.conciliados, ""],
    ["Totalizados / Compras en Bloque", t.totalizados, t.valorTotalizado],
    ["Por Registrar (Pendientes en cola)", t.pendientesRecibidos, t.valorPendienteRecibido],
    ["Doble Registro en Libros", t.duplicados, ""],
    ["Diferencias de Valor / Impuestos", t.diferencias, t.valorDiferencia],
    ["Cruces con Nota Crédito", t.crucesNc, ""],
    ["Movimientos Solo en Libros (Huérfanos)", t.soloSiigo, ""],
    [],
    ["Efectividad de Conciliación Recibidas", `${(t.pctRecibidos * 100).toFixed(1)}%`, ""],
    ["Total en Riesgo / Cola de Auditoría", t.cola, t.valorCola],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 42 }, { wch: 18 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Ejecutivo");

  // 3. Hoja de Solo Libros (Huérfanos)
  if (result.orphans && result.orphans.length > 0) {
    const orphanHeaders = [
      "Comprobante",
      "Fecha",
      "NIT Tercero",
      "Nombre Tercero",
      "Descripción",
      "Cuenta",
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
    wsOrphans["!cols"] = [
      { wch: 16 },
      { wch: 12 },
      { wch: 15 },
      { wch: 32 },
      { wch: 35 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsOrphans, "Solo Libros (Sin DIAN)");
  }

  // 4. Hoja de Cruces Factura - NC
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
    wsCruzes["!cols"] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 18 },
      { wch: 15 },
      { wch: 32 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsCruzes, "Cruces Factura-NC");
  }

  // Generar y descargar archivo
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
