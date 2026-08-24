import { useState } from "react";
import { X, Printer, Building2, ShieldCheck, Award, FileText, CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { ConciliacionResult } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  result: ConciliacionResult;
  dianName?: string;
  movName?: string;
}

export function ActaConciliacionModal({ open, onClose, result, dianName, movName }: Props) {
  const [contadorNombre, setContadorNombre] = useState("");
  const [contadorTp, setContadorTp] = useState("");
  const [revisorNombre, setRevisorNombre] = useState("");
  const [revisorDoc, setRevisorDoc] = useState("");
  const [fechaActa, setFechaActa] = useState(() => new Date().toISOString().split("T")[0]);

  if (!open) return null;

  const { company, periodLabel, totals, rows, orphans } = result;

  const totalDian = totals.valorDian || 0;
  const totalLibros = (totals.valorDian - totals.valorPendiente - totals.valorDiferencia) || 0;
  const totalDocs = totals.recibidos || 1;
  const pctConciliado = Math.min(100, Math.round((totals.conciliados / totalDocs) * 100));

  const pendingAudit = rows.filter((r) => r.prioridad === "audit" && (r.estado === "pendiente" || r.estado === "posible_typo"));
  const differences = rows.filter((r) => r.estado === "diferencia");

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-xl border border-line bg-bg-surface shadow-2xl flex flex-col">
        {/* Header no-print */}
        <div className="no-print flex items-center justify-between border-b border-line px-6 py-3.5 bg-bg-elevated">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal/10 text-teal">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">
                Acta y Certificado Formal de Conciliación
              </h2>
              <p className="text-xs text-ink-muted">
                Documento oficial para auditorías, archivo contable o requerimientos DIAN
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-bg-elevated hover:bg-teal/90 transition shadow-sm"
            >
              <Printer className="size-3.5" />
              Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Panel de configuración de firmas (no-print) */}
        <div className="no-print border-b border-line bg-bg-subtle/50 px-6 py-3">
          <div className="text-xs font-semibold text-ink mb-2">Datos para el acta formal:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
            <div>
              <label className="block text-[11px] text-ink-muted mb-0.5">Fecha del Acta</label>
              <input
                type="date"
                value={fechaActa}
                onChange={(e) => setFechaActa(e.target.value)}
                className="h-8 w-full rounded border border-line bg-bg-elevated px-2 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink-muted mb-0.5">Contador Público</label>
              <input
                type="text"
                placeholder="Nombre del contador"
                value={contadorNombre}
                onChange={(e) => setContadorNombre(e.target.value)}
                className="h-8 w-full rounded border border-line bg-bg-elevated px-2 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink-muted mb-0.5">Tarjeta Profesional N°</label>
              <input
                type="text"
                placeholder="Ej. TP 123456-T"
                value={contadorTp}
                onChange={(e) => setContadorTp(e.target.value)}
                className="h-8 w-full rounded border border-line bg-bg-elevated px-2 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink-muted mb-0.5">Revisor Fiscal / Rep. Legal</label>
              <input
                type="text"
                placeholder="Nombre representante"
                value={revisorNombre}
                onChange={(e) => setRevisorNombre(e.target.value)}
                className="h-8 w-full rounded border border-line bg-bg-elevated px-2 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block text-[11px] text-ink-muted mb-0.5">Documento Identidad</label>
              <input
                type="text"
                placeholder="C.C. / NIT"
                value={revisorDoc}
                onChange={(e) => setRevisorDoc(e.target.value)}
                className="h-8 w-full rounded border border-line bg-bg-elevated px-2 text-xs text-ink"
              />
            </div>
          </div>
        </div>

        {/* Printable Paper Area */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-bg-surface text-ink print:p-0 print:m-0">
          <div className="mx-auto max-w-3xl space-y-6 text-sm">
            
            {/* Header del Acta */}
            <div className="border-b-2 border-ink pb-4 text-center">
              <div className="text-xs font-bold tracking-wider text-teal uppercase mb-1">
                REPÚBLICA DE COLOMBIA • CONTROL Y GESTIÓN TRIBUTARIA
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-ink uppercase tracking-tight">
                ACTA FORMAL DE CONCILIACIÓN TRIBUTARIA
              </h1>
              <div className="text-xs text-ink-muted mt-1 font-mono">
                REGISTRO DIAN VS. MOVIMIENTO CONTABLE EN LIBROS
              </div>
            </div>

            {/* Datos de la Empresa y Período */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-lg border border-line bg-bg-subtle/30 p-3.5 text-xs">
              <div>
                <span className="text-ink-muted block text-[11px]">Razón Social:</span>
                <strong className="text-ink font-semibold">{company.nombre || "Empresa"}</strong>
              </div>
              <div>
                <span className="text-ink-muted block text-[11px]">NIT:</span>
                <strong className="text-ink font-mono">{company.nit || "N/A"}</strong>
              </div>
              <div>
                <span className="text-ink-muted block text-[11px]">Período Fiscal:</span>
                <strong className="text-ink">{periodLabel || "Período actual"}</strong>
              </div>
              <div>
                <span className="text-ink-muted block text-[11px]">Fecha de Expedición:</span>
                <span className="text-ink font-medium">{fechaActa}</span>
              </div>
              <div>
                <span className="text-ink-muted block text-[11px]">Archivo DIAN:</span>
                <span className="text-ink truncate block" title={dianName}>{dianName || "Reporte Oficial DIAN"}</span>
              </div>
              <div>
                <span className="text-ink-muted block text-[11px]">Archivo Movimientos:</span>
                <span className="text-ink truncate block" title={movName}>{movName || "Libro Diario / Auxiliar"}</span>
              </div>
            </div>

            {/* Cuadro de Cifras Clave */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                1. RESUMEN DE CIFRAS CONCILIATORIAS
              </h3>
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="bg-bg-subtle border-b border-line text-ink-subtle uppercase">
                    <tr>
                      <th className="p-2.5 font-semibold">Concepto</th>
                      <th className="p-2.5 text-right font-semibold">Documentos</th>
                      <th className="p-2.5 text-right font-semibold">Valor Total DIAN</th>
                      <th className="p-2.5 text-right font-semibold">Estado / Participación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line font-mono">
                    <tr>
                      <td className="p-2.5 font-sans font-medium text-ink">Total Facturación Electrónica DIAN</td>
                      <td className="p-2.5 text-right">{totals.recibidos}</td>
                      <td className="p-2.5 text-right font-bold text-ink">{formatMoney(totalDian)}</td>
                      <td className="p-2.5 text-right font-sans text-teal">100.0% Base</td>
                    </tr>
                    <tr className="bg-ok-bg/30">
                      <td className="p-2.5 font-sans font-medium text-ok">Facturas Registradas y Conciliadas en Libros</td>
                      <td className="p-2.5 text-right text-ok">{totals.conciliados}</td>
                      <td className="p-2.5 text-right text-ok">{formatMoney(totalDian - totals.valorPendiente)}</td>
                      <td className="p-2.5 text-right font-sans text-ok font-bold">{pctConciliado}%</td>
                    </tr>
                    {totals.pendientesRecibidos > 0 && (
                      <tr className="bg-warn-bg/30">
                        <td className="p-2.5 font-sans font-medium text-warn">Partidas Pendientes de Registro Contable</td>
                        <td className="p-2.5 text-right text-warn">{totals.pendientesRecibidos}</td>
                        <td className="p-2.5 text-right text-warn">{formatMoney(totals.valorPendienteRecibido)}</td>
                        <td className="p-2.5 text-right font-sans text-warn">{((totals.valorPendienteRecibido / (totalDian || 1)) * 100).toFixed(1)}%</td>
                      </tr>
                    )}
                    {totals.diferencias > 0 && (
                      <tr className="bg-warn-bg/20">
                        <td className="p-2.5 font-sans font-medium text-warn">Discrepancias en Valor (Diferencias)</td>
                        <td className="p-2.5 text-right text-warn">{totals.diferencias}</td>
                        <td className="p-2.5 text-right text-warn">{formatMoney(totals.valorDiferencia)}</td>
                        <td className="p-2.5 text-right font-sans text-warn">Auditadas</td>
                      </tr>
                    )}
                    {orphans.length > 0 && (
                      <tr>
                        <td className="p-2.5 font-sans font-medium text-ink-muted">Causaciones en Libros sin Factura DIAN asociada</td>
                        <td className="p-2.5 text-right">{orphans.length}</td>
                        <td className="p-2.5 text-right">{formatMoney(orphans.reduce((s, o) => s + (o.debito || o.credito || 0), 0))}</td>
                        <td className="p-2.5 text-right font-sans text-ink-subtle">Huérfanos</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Partidas de Auditoría */}
            {pendingAudit.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
                  2. PRINCIPALES PARTIDAS CONCILIATORIAS PENDIENTES ({pendingAudit.length})
                </h3>
                <div className="overflow-hidden rounded-lg border border-line text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-bg-subtle border-b border-line text-ink-subtle">
                      <tr>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Doc / Folio</th>
                        <th className="p-2">Tercero / Proveedor</th>
                        <th className="p-2 text-right">Valor DIAN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line font-mono">
                      {pendingAudit.slice(0, 8).map((r) => (
                        <tr key={r.id}>
                          <td className="p-2 text-ink-muted">{r.fecha}</td>
                          <td className="p-2 font-bold text-ink">{r.numero}</td>
                          <td className="p-2 font-sans truncate max-w-[220px]" title={r.nombreContraparte}>{r.nombreContraparte}</td>
                          <td className="p-2 text-right text-ink font-semibold">{formatMoney(r.totalDian)}</td>
                        </tr>
                      ))}
                      {pendingAudit.length > 8 && (
                        <tr className="bg-bg-subtle/50 font-sans">
                          <td colSpan={4} className="p-2 text-center text-ink-muted italic">
                            ... y {pendingAudit.length - 8} partidas pendientes adicionales detalladas en el anexo de auditoría.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cláusula de Certificación */}
            <div className="rounded-lg border border-line bg-bg-subtle/40 p-3.5 text-xs text-ink-muted leading-relaxed">
              <p className="font-semibold text-ink mb-1">DECLARACIÓN DE CONFORMIDAD:</p>
              Se certifica que se ha realizado la confrontación minuciosa y sistemática entre los registros oficiales de facturación electrónica emitidos y recibidos en la plataforma de la Dirección de Impuestos y Aduanas Nacionales (DIAN) y los movimientos contables asentados en los libros de la empresa para el período <strong>{periodLabel || "auditado"}</strong>. Las partidas conciliatorias identificadas se encuentran debidamente clasificadas y soportadas para los fines fiscales y de auditoría pertinentes.
            </div>

            {/* Firmas */}
            <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
              <div className="border-t border-ink pt-2">
                <div className="font-bold text-ink uppercase">{contadorNombre || "_________________________________"}</div>
                <div className="text-ink-muted">Contador(a) Público(a)</div>
                <div className="font-mono text-ink-subtle mt-0.5">{contadorTp ? `T.P. N° ${contadorTp}` : "T.P. N° ________________"}</div>
              </div>

              <div className="border-t border-ink pt-2">
                <div className="font-bold text-ink uppercase">{revisorNombre || "_________________________________"}</div>
                <div className="text-ink-muted">Revisor(a) Fiscal / Representante Legal</div>
                <div className="font-mono text-ink-subtle mt-0.5">{revisorDoc ? `C.C. ${revisorDoc}` : "C.C. / NIT ________________"}</div>
              </div>
            </div>

          </div>
        </div>

        {/* Footer no-print */}
        <div className="no-print border-t border-line bg-bg-subtle/50 px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-ink-muted">
            {pctConciliado}% de efectividad conciliatoria registrada
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-lg bg-teal px-4 py-2 text-xs font-semibold text-bg-elevated hover:bg-teal/90 transition shadow-sm"
            >
              Imprimir Acta
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line bg-bg-elevated px-4 py-2 text-xs font-medium text-ink hover:border-line-strong transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
