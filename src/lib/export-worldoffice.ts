import * as XLSX from "xlsx";
import type { CompanyInfo, ConciliacionRow } from "./types.ts";

/**
 * Genera la plantilla oficial de importación masiva de compras y causaciones
 * compatible con World Office (Estructura de Documentos Contables / Facturas de Compra).
 */
export function exportWorldOfficeTemplateXlsx(
  rows: ConciliacionRow[],
  company: CompanyInfo,
  periodLabel: string,
): void {
  const pendingRows = rows.filter(
    (r) => r.prioridad === "audit" && (r.estado === "pendiente" || r.estado === "posible_typo"),
  );

  const data: Array<Record<string, any>> = [];

  pendingRows.forEach((r, idx) => {
    const net = Math.max(0, r.totalDian - (r.iva || 0));
    const iva = r.iva || 0;
    const total = r.totalDian;
    const docDate = r.fecha ? r.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const prefijo = r.prefijo || "FC";
    const folio = r.folio || String(idx + 1);
    const docRef = r.numero || `${prefijo}-${folio}`;
    const cleanNit = (r.nitContraparte || "").replace(/\D/g, "");

    // 1. Registro Débito: Gasto / Costo / Compra
    data.push({
      "Tipo Documento": "FC",
      "Prefijo": prefijo,
      "Número Documento": folio,
      "Fecha (AAAA-MM-DD)": docDate,
      "Identificación Tercero": cleanNit,
      "Razón Social": r.nombreContraparte,
      "Código Cuenta Contable": "51359501",
      "Nombre Cuenta": "Gastos y Servicios Diversos",
      "Centro Costo": "01",
      "Documento Referencia": docRef,
      "Valor Débito": net,
      "Valor Crédito": 0,
      "Base Impuesto": net,
      "Detalle / Observación": `Causación Factura Electrónica ${docRef}`,
    });

    // 2. Registro Débito: IVA Descontable (si aplica)
    if (iva > 0) {
      data.push({
        "Tipo Documento": "FC",
        "Prefijo": prefijo,
        "Número Documento": folio,
        "Fecha (AAAA-MM-DD)": docDate,
        "Identificación Tercero": cleanNit,
        "Razón Social": r.nombreContraparte,
        "Código Cuenta Contable": "24080301",
        "Nombre Cuenta": "IVA Descontable en Compras y Servicios",
        "Centro Costo": "01",
        "Documento Referencia": docRef,
        "Valor Débito": iva,
        "Valor Crédito": 0,
        "Base Impuesto": net,
        "Detalle / Observación": `IVA Descontable Factura ${docRef}`,
      });
    }

    // 3. Registro Crédito: Pasivo / Cuenta por Pagar a Proveedor
    data.push({
      "Tipo Documento": "FC",
      "Prefijo": prefijo,
      "Número Documento": folio,
      "Fecha (AAAA-MM-DD)": docDate,
      "Identificación Tercero": cleanNit,
      "Razón Social": r.nombreContraparte,
      "Código Cuenta Contable": "22050101",
      "Nombre Cuenta": "Proveedores Nacionales",
      "Centro Costo": "01",
      "Documento Referencia": docRef,
      "Valor Débito": 0,
      "Valor Crédito": total,
      "Base Impuesto": 0,
      "Detalle / Observación": `Pasivo Proveedor Factura ${docRef}`,
    });
  });

  const ws = XLSX.utils.json_to_sheet(data);

  // Anchos de columna optimizados
  ws["!cols"] = [
    { wch: 16 }, // Tipo Documento
    { wch: 12 }, // Prefijo
    { wch: 18 }, // Número Documento
    { wch: 16 }, // Fecha
    { wch: 20 }, // Identificación Tercero
    { wch: 42 }, // Razón Social
    { wch: 22 }, // Código Cuenta Contable
    { wch: 38 }, // Nombre Cuenta
    { wch: 14 }, // Centro Costo
    { wch: 22 }, // Documento Referencia
    { wch: 16 }, // Valor Débito
    { wch: 16 }, // Valor Crédito
    { wch: 16 }, // Base Impuesto
    { wch: 42 }, // Detalle / Observación
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Plantilla_WorldOffice");

  const cleanEmpresaNit = (company.nit || "EMPRESA").replace(/\D/g, "");
  const cleanPeriod = (periodLabel || "PERIODO").replace(/[\s\-_/]/g, "_");
  const filename = `Plantilla_WorldOffice_Compras_${cleanEmpresaNit}_${cleanPeriod}.xlsx`;

  XLSX.writeFile(wb, filename);
}
