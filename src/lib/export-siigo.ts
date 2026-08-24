import * as XLSX from "xlsx";
import type { CompanyInfo, ConciliacionRow } from "./types.ts";

export function exportSiigoTemplateXlsx(
  rows: ConciliacionRow[],
  company: CompanyInfo,
  periodLabel: string,
): void {
  const pendingRows = rows.filter(
    (r) => r.prioridad === "audit" && (r.estado === "pendiente" || r.estado === "posible_typo"),
  );

  const data: Array<Record<string, any>> = [];

  pendingRows.forEach((r, idx) => {
    const seq = String(idx + 1).padStart(3, "0");
    const net = Math.max(0, r.totalDian - (r.iva || 0));
    const iva = r.iva || 0;
    const total = r.totalDian;
    const docDate = r.fecha ? r.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const prefijo = r.prefijo || "FAC";
    const folio = r.folio || "1";

    // 1. Line: Expense / Purchase (Debit)
    data.push({
      "Tipo Comprobante": "P",
      "Consecutivo": seq,
      "Fecha": docDate,
      "Cuenta Contable": "51359501",
      "Nombre Cuenta": "Gastos / Servicios Diversos",
      "NIT / Cédula Tercero": r.nitContraparte,
      "Razón Social Tercero": r.nombreContraparte,
      "Prefijo Factura": prefijo,
      "Número Factura": folio,
      "Débito": net,
      "Crédito": 0,
      "Descripción / Detalle": `Compra Factura ${r.numero}`,
    });

    // 2. Line: IVA Descontable (Debit) if applicable
    if (iva > 0) {
      data.push({
        "Tipo Comprobante": "P",
        "Consecutivo": seq,
        "Fecha": docDate,
        "Cuenta Contable": "24080326",
        "Nombre Cuenta": "IVA Descontable en Compras y Servicios",
        "NIT / Cédula Tercero": r.nitContraparte,
        "Razón Social Tercero": r.nombreContraparte,
        "Prefijo Factura": prefijo,
        "Número Factura": folio,
        "Débito": iva,
        "Crédito": 0,
        "Descripción / Detalle": `IVA Factura ${r.numero}`,
      });
    }

    // 3. Line: Supplier / Accounts Payable (Credit)
    data.push({
      "Tipo Comprobante": "P",
      "Consecutivo": seq,
      "Fecha": docDate,
      "Cuenta Contable": "22050101",
      "Nombre Cuenta": "Proveedores Nacionales",
      "NIT / Cédula Tercero": r.nitContraparte,
      "Razón Social Tercero": r.nombreContraparte,
      "Prefijo Factura": prefijo,
      "Número Factura": folio,
      "Débito": 0,
      "Crédito": total,
      "Descripción / Detalle": `Causación Factura ${r.numero}`,
    });
  });

  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-fit column widths
  const cols = [
    { wch: 18 }, // Tipo Comprobante
    { wch: 14 }, // Consecutivo
    { wch: 14 }, // Fecha
    { wch: 18 }, // Cuenta Contable
    { wch: 38 }, // Nombre Cuenta
    { wch: 20 }, // NIT / Cédula
    { wch: 40 }, // Razón Social
    { wch: 16 }, // Prefijo
    { wch: 16 }, // Número
    { wch: 18 }, // Débito
    { wch: 18 }, // Crédito
    { wch: 36 }, // Descripción
  ];
  ws["!cols"] = cols;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla_Siigo_Compras");

  const cleanNit = (company.nit || "EMPRESA").replace(/\D/g, "");
  const cleanPeriod = (periodLabel || "PERIODO").replace(/[\s\-_/]/g, "_");
  const filename = `Plantilla_Siigo_Compras_${cleanNit}_${cleanPeriod}.xlsx`;

  XLSX.writeFile(wb, filename);
}
