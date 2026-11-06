import * as XLSX from "xlsx";
import type { CompanyInfo, ConciliacionRow, MovLine } from "./types.ts";
import { inferPucAccountForRow } from "./puc-classifier.ts";

/**
 * Genera la plantilla oficial de importación de movimientos y compras
 * compatible con Helisa (Estructura de Comprobantes de Diario / Causación Helisa GW / NIIF).
 */
export function exportHelisaTemplateXlsx(
  rows: ConciliacionRow[],
  company: CompanyInfo,
  periodLabel: string,
  movLines: MovLine[] = [],
): void {
  const pendingRows = rows.filter(
    (r) => r.prioridad === "audit" && (r.estado === "pendiente" || r.estado === "posible_typo"),
  );
  const targetRows = pendingRows.length > 0 ? pendingRows : rows;

  const data: Array<Record<string, any>> = [];

  targetRows.forEach((r, idx) => {
    const compNum = String(idx + 1).padStart(6, "0");
    const net = Math.max(0, r.totalDian - (r.iva || 0));
    const iva = r.iva || 0;
    const total = r.totalDian;
    const docDate = r.fecha ? r.fecha.slice(0, 10).replace(/-/g, "/") : new Date().toISOString().slice(0, 10).replace(/-/g, "/");
    const docRef = r.numero || `FAC-${idx + 1}`;
    const cleanNit = (r.nitContraparte || "").replace(/\D/g, "");
    const puc = inferPucAccountForRow(r, movLines);

    // 1. Débito a cuenta de Gasto / Servicio
    data.push({
      "Tipo Comprobante": "01",
      "Número Comprobante": compNum,
      "Fecha (AAAA/MM/DD)": docDate,
      "Cuenta Contable": puc.cuentaGasto,
      "Nombre de Cuenta": puc.nombreGasto,
      "NIT / Tercero": cleanNit,
      "Razón Social Tercero": r.nombreContraparte,
      "Cheque / Documento Ref": docRef,
      "Concepto Movimiento": `Causación Factura ${docRef}`,
      "Débito": net,
      "Crédito": 0,
      "Base Retención": net,
      "Centro Costos": "001",
    });

    // 2. Débito a IVA Descontable
    if (iva > 0) {
      data.push({
        "Tipo Comprobante": "01",
        "Número Comprobante": compNum,
        "Fecha (AAAA/MM/DD)": docDate,
        "Cuenta Contable": puc.cuentaIva,
        "Nombre de Cuenta": puc.nombreIva,
        "NIT / Tercero": cleanNit,
        "Razón Social Tercero": r.nombreContraparte,
        "Cheque / Documento Ref": docRef,
        "Concepto Movimiento": `IVA Descontable Factura ${docRef}`,
        "Débito": iva,
        "Crédito": 0,
        "Base Retención": net,
        "Centro Costos": "001",
      });
    }

    // 3. Crédito a Proveedores Nacionales
    data.push({
      "Tipo Comprobante": "01",
      "Número Comprobante": compNum,
      "Fecha (AAAA/MM/DD)": docDate,
      "Cuenta Contable": puc.cuentaPasivo,
      "Nombre de Cuenta": puc.nombrePasivo,
      "NIT / Tercero": cleanNit,
      "Razón Social Tercero": r.nombreContraparte,
      "Cheque / Documento Ref": docRef,
      "Concepto Movimiento": `Pasivo Factura ${docRef}`,
      "Débito": 0,
      "Crédito": total,
      "Base Retención": 0,
      "Centro Costos": "001",
    });
  });

  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-ajuste de columnas
  ws["!cols"] = [
    { wch: 18 }, // Tipo Comprobante
    { wch: 20 }, // Número Comprobante
    { wch: 18 }, // Fecha
    { wch: 18 }, // Cuenta Contable
    { wch: 38 }, // Nombre de Cuenta
    { wch: 18 }, // NIT / Tercero
    { wch: 40 }, // Razón Social
    { wch: 22 }, // Cheque / Documento Ref
    { wch: 36 }, // Concepto Movimiento
    { wch: 16 }, // Débito
    { wch: 16 }, // Crédito
    { wch: 16 }, // Base Retención
    { wch: 14 }, // Centro Costos
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Helisa");

  const cleanEmpresaNit = (company.nit || "EMPRESA").replace(/\D/g, "");
  const cleanPeriod = (periodLabel || "PERIODO").replace(/[\s\-_/]/g, "_");
  const filename = `Plantilla_Helisa_Compras_${cleanEmpresaNit}_${cleanPeriod}.xlsx`;

  XLSX.writeFile(wb, filename);
}
