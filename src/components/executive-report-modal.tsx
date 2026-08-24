import { useRef } from "react";
import { X, Printer, Building2, CheckCircle2, AlertTriangle, ShieldCheck, FileCheck, Award, FileText } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { ConciliacionResult, ConciliacionRow } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  result: ConciliacionResult;
  dianName?: string;
  movName?: string;
}

export function ExecutiveReportModal({ open, onClose, result, dianName, movName }: Props) {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  const { company, periodLabel, totals, rows, orphans } = result;

  const totalDian = totals.valorDian || 0;
  const totalMov = totals.valorTotalizado || 0;
  const totalDocs = totals.recibidos || 1;
  const pctConciliado = Math.min(100, Math.round((totals.conciliados / totalDocs) * 100));

  // Top 10 Proveedores
  const proveedorMap = new Map<string, { nit: string; nombre: string; totalDian: number; count: number; pendientes: number }>();
  for (const r of rows) {
    if (r.grupo === "Recibido" && r.estado !== "no_aplica") {
      const nit = r.nitContraparte || "S/N";
      const cur = proveedorMap.get(nit) || {
        nit,
        nombre: r.nombreContraparte || "Sin Nombre",
        totalDian: 0,
        count: 0,
        pendientes: 0,
      };
      cur.totalDian += r.totalDian;
      cur.count += 1;
      if (r.prioridad === "audit" && (r.estado === "pendiente" || r.estado === "posible_typo")) {
        cur.pendientes += 1;
      }
      proveedorMap.set(nit, cur);
    }
  }

  const topProveedores = [...proveedorMap.values()]
    .sort((a, b) => b.totalDian - a.totalDian)
    .slice(0, 10);

  const pendingRows = rows.filter((r) => r.prioridad === "audit" && (r.estado === "pendiente" || r.estado === "posible_typo"));
  const totalMontoPendiente = pendingRows.reduce((s, r) => s + r.totalDian, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-xl border border-line bg-bg-surface shadow-2xl flex flex-col">
        {/* Modal Topbar (hidden during print) */}
        <div className="no-print flex items-center justify-between border-b border-line px-6 py-4 bg-bg-elevated">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/10 text-teal">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">
                Informe Ejecutivo de Auditoría Fiscal
              </h2>
              <p className="text-xs text-ink-muted">
                Dictamen para Gerencia, Junta Directiva y Revisoría Fiscal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-bg-elevated shadow hover:bg-teal-deep transition"
            >
              <Printer className="size-4" />
              Imprimir / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-ink-muted hover:bg-bg-subtle hover:text-ink transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div ref={printAreaRef} className="flex-1 overflow-y-auto p-6 sm:p-10 bg-white text-slate-900 font-sans">
          {/* Official Letterhead */}
          <div className="border-b-2 border-teal pb-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-teal font-bold tracking-wider text-xs uppercase">
                  <ShieldCheck className="size-4" />
                  Informe Formal de Auditoría y Conciliación DIAN
                </div>
                <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-1">
                  {company.nombre || "EMPRESA AUDITADA"}
                </h1>
                <p className="text-sm font-mono text-slate-600 mt-0.5">
                  NIT: <b>{company.nit || "N/A"}</b> · DV: {company.dv || "N/A"}
                </p>
              </div>
              <div className="text-left sm:text-right text-xs text-slate-600 space-y-1">
                <div><b>Período Auditado:</b> {periodLabel || "Mensual"}</div>
                <div><b>Fecha de Emisión:</b> {new Date().toLocaleDateString("es-CO", { dateStyle: "long" })}</div>
                <div className="font-mono text-[11px] text-slate-500">Ref: AUD-DIAN-{company.nit || "EMP"}-{Date.now().toString().slice(-6)}</div>
              </div>
            </div>
          </div>

          {/* Executive Summary Metrics */}
          <div className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <Award className="size-4 text-teal" /> 1. Resumen Ejecutivo del Período
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Efectividad Cruce</span>
                <p className="text-2xl font-black text-emerald-700 mt-1">{pctConciliado}%</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{totals.conciliados} de {totalDocs} docs</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Facturado DIAN</span>
                <p className="text-xl font-bold text-slate-900 mt-1 font-mono">{formatMoney(totalDian)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{rows.length} comprobantes</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <span className="text-[11px] font-semibold text-slate-500 uppercase">Total Libros Contables</span>
                <p className="text-xl font-bold text-slate-900 mt-1 font-mono">{formatMoney(totalMov)}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Software contable</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <span className="text-[11px] font-semibold text-amber-800 uppercase">Pendiente Causación</span>
                <p className="text-xl font-bold text-amber-900 mt-1 font-mono">{formatMoney(totalMontoPendiente)}</p>
                <p className="text-[11px] text-amber-700 mt-0.5">{pendingRows.length} facturas en cola</p>
              </div>
            </div>
          </div>

          {/* Audit Breakdown Table */}
          <div className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="size-4 text-teal" /> 2. Clasificación de Resultados de Auditoría
            </h2>
            <div className="overflow-hidden rounded-lg border border-slate-200 text-xs">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Estado / Categoría de Auditoría</th>
                    <th className="py-2.5 px-3 text-center">Cant. Documentos</th>
                    <th className="py-2.5 px-3 text-right">Impacto Contable / Riesgo</th>
                    <th className="py-2.5 px-3 text-left">Acción Recomendada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                  <tr>
                    <td className="py-2 px-3 font-semibold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-600" /> Registrados Correctamente
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-medium">{totals.conciliados}</td>
                    <td className="py-2 px-3 text-right text-emerald-700 font-semibold">Conforme</td>
                    <td className="py-2 px-3 text-slate-600">Soporte fiscal debidamente causado en libros.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-amber-600" /> Facturas por Registrar (Cola)
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-amber-800">{totals.pendientesRecibidos}</td>
                    <td className="py-2 px-3 text-right text-amber-800 font-mono font-bold">{formatMoney(totalMontoPendiente)}</td>
                    <td className="py-2 px-3 text-slate-600">Causar comprobante P-001/P-002 para descontar IVA y gasto.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-rose-800 flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-rose-600" /> Posibles Duplicados / Dobles
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-rose-800">{totals.duplicados}</td>
                    <td className="py-2 px-3 text-right text-rose-700 font-semibold">{totals.duplicados > 0 ? "Riesgo Alto" : "Cero"}</td>
                    <td className="py-2 px-3 text-slate-600">Revisar comprobantes con mismo folio causados dos veces.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-blue-800 flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-blue-600" /> Cruces con Notas Crédito
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-medium">{totals.crucesNc}</td>
                    <td className="py-2 px-3 text-right text-blue-700 font-semibold">Anulaciones</td>
                    <td className="py-2 px-3 text-slate-600">Verificar que la NC aplique al comprobante U correspondiente.</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-semibold text-purple-800 flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 text-purple-600" /> Registros Solo en Libros (Sin DIAN)
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-medium">{orphans.length}</td>
                    <td className="py-2 px-3 text-right text-purple-700 font-semibold">Soporte Faltante</td>
                    <td className="py-2 px-3 text-slate-600">Verificar si corresponde a compras a personas naturales o caja menor.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Top 10 Suppliers Table */}
          <div className="mt-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
              3. Top 10 Proveedores con Mayor Volumen de Compras
            </h2>
            <div className="overflow-hidden rounded-lg border border-slate-200 text-xs">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-2 px-3 text-left">NIT Proveedor</th>
                    <th className="py-2 px-3 text-left">Razón Social</th>
                    <th className="py-2 px-3 text-center">Docs</th>
                    <th className="py-2 px-3 text-right">Total Facturado DIAN</th>
                    <th className="py-2 px-3 text-center">Estado Auditoría</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white text-slate-800">
                  {topProveedores.map((p) => (
                    <tr key={p.nit}>
                      <td className="py-2 px-3 font-mono font-medium text-slate-900">{p.nit}</td>
                      <td className="py-2 px-3 font-medium text-slate-900 truncate max-w-[200px]">{p.nombre}</td>
                      <td className="py-2 px-3 text-center font-mono">{p.count}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{formatMoney(p.totalDian)}</td>
                      <td className="py-2 px-3 text-center">
                        {p.pendientes === 0 ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            100% Causado
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            {p.pendientes} pendiente{p.pendientes > 1 ? "s" : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dictamen & Revisoría Conclusion */}
          <div className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">
              4. Dictamen y Conclusiones del Auditor
            </h3>
            <p>
              Se ha verificado la totalidad de la información contenida en el Reporte Oficial de Facturación Electrónica expedido por la Dirección de Impuestos y Aduanas Nacionales (DIAN) frente a los comprobantes de egreso, causación y compras registrados en el libro auxiliar de la compañía para el período indicado. Las inconsistencias detectadas se encuentran detalladas en los anexos correspondientes para su saneamiento antes del cierre contable e impositivo.
            </p>
          </div>

          {/* Signatures Section */}
          <div className="mt-12 pt-8 border-t border-slate-300">
            <div className="grid grid-cols-2 gap-12 text-center text-xs">
              <div>
                <div className="mx-auto w-48 border-b-2 border-slate-900 pb-1 h-12 flex items-end justify-center">
                  <span className="text-[10px] text-slate-400 font-mono italic">Firma Contador</span>
                </div>
                <p className="mt-2 font-bold text-slate-900 uppercase">Contador Público</p>
                <p className="text-slate-600 font-mono text-[11px]">T.P. N°: __________________</p>
                <p className="text-slate-600 font-mono text-[11px]">C.C. N°: __________________</p>
              </div>

              <div>
                <div className="mx-auto w-48 border-b-2 border-slate-900 pb-1 h-12 flex items-end justify-center">
                  <span className="text-[10px] text-slate-400 font-mono italic">Firma Revisor Fiscal</span>
                </div>
                <p className="mt-2 font-bold text-slate-900 uppercase">Revisor Fiscal / Auditor</p>
                <p className="text-slate-600 font-mono text-[11px]">T.P. N°: __________________</p>
                <p className="text-slate-600 font-mono text-[11px]">C.C. N°: __________________</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
