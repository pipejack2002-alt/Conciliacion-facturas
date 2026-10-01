import { useState } from "react";
import { X, Printer, Award, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { formatMoneyExact, formatDate } from "@/lib/format";
import type { BankConciliacionResult } from "@/lib/conciliar-bancos";

interface Props {
  open: boolean;
  onClose: () => void;
  result: BankConciliacionResult;
  bancoNombre?: string;
  numeroCuenta?: string;
  periodo?: string;
  cuentaContable?: string;
  empresaNombre?: string;
  onExportExcel?: () => void;
}

export function ActaBancariaModal({
  open,
  onClose,
  result,
  bancoNombre = "Entidad Financiera",
  numeroCuenta = "No especificado",
  periodo = "",
  cuentaContable = "111005 (Bancos)",
  empresaNombre = "EMPRESA CONTABLE S.A.S.",
  onExportExcel,
}: Props) {
  const [contadorNombre, setContadorNombre] = useState("");
  const [contadorTp, setContadorTp] = useState("");
  const [revisorNombre, setRevisorNombre] = useState("");
  const [revisorDoc, setRevisorDoc] = useState("");
  const [fechaActa, setFechaActa] = useState(() => new Date().toISOString().split("T")[0]);

  if (!open) return null;

  const { summary, rows } = result;

  const consignacionesList = rows.filter(
    (r) => r.estado === "partida_en_transito_libros" && r.tipo === "consignacion"
  );
  const chequesList = rows.filter(
    (r) => r.estado === "partida_en_transito_libros" && r.tipo === "retiro"
  );
  const notasDebitoList = rows.filter((r) => r.estado === "nota_debito_banco");
  const notasCreditoList = rows.filter((r) => r.estado === "nota_credito_banco");

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
                Acta Oficial de Conciliación Bancaria y Tesorería
              </h2>
              <p className="text-xs text-ink-muted">
                Documento formal conforme a NIIF / NIC 7 para archivo tributario y revisoría fiscal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:text-teal hover:border-teal transition cursor-pointer"
              >
                <FileSpreadsheet className="size-3.5 text-teal" />
                Descargar Excel
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-deep transition shadow-xs cursor-pointer"
            >
              <Printer className="size-3.5" />
              Imprimir / Guardar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Formulario de Firmas y Datos (No print) */}
        <div className="no-print border-b border-line bg-bg-subtle/60 px-6 py-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="block font-semibold text-ink-muted text-[11px] mb-1">
                Fecha del Acta:
              </label>
              <input
                type="date"
                value={fechaActa}
                onChange={(e) => setFechaActa(e.target.value)}
                className="w-full rounded-md border border-line bg-bg-surface px-2.5 py-1 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block font-semibold text-ink-muted text-[11px] mb-1">
                Nombre del Contador:
              </label>
              <input
                type="text"
                placeholder="Ej. Juan Pérez"
                value={contadorNombre}
                onChange={(e) => setContadorNombre(e.target.value)}
                className="w-full rounded-md border border-line bg-bg-surface px-2.5 py-1 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block font-semibold text-ink-muted text-[11px] mb-1">
                Tarjeta Profesional (T.P.):
              </label>
              <input
                type="text"
                placeholder="Ej. 123456-T"
                value={contadorTp}
                onChange={(e) => setContadorTp(e.target.value)}
                className="w-full rounded-md border border-line bg-bg-surface px-2.5 py-1 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block font-semibold text-ink-muted text-[11px] mb-1">
                Revisor Fiscal / Representante:
              </label>
              <input
                type="text"
                placeholder="Ej. María Gómez"
                value={revisorNombre}
                onChange={(e) => setRevisorNombre(e.target.value)}
                className="w-full rounded-md border border-line bg-bg-surface px-2.5 py-1 text-xs text-ink"
              />
            </div>
            <div>
              <label className="block font-semibold text-ink-muted text-[11px] mb-1">
                Identificación (C.C. / T.P.):
              </label>
              <input
                type="text"
                placeholder="Ej. 1.098.765.432"
                value={revisorDoc}
                onChange={(e) => setRevisorDoc(e.target.value)}
                className="w-full rounded-md border border-line bg-bg-surface px-2.5 py-1 text-xs text-ink"
              />
            </div>
          </div>
        </div>

        {/* Documento Imprimible Formal */}
        <div className="overflow-y-auto p-8 text-ink print:p-0 print:text-black">
          <div className="mx-auto max-w-3xl space-y-6 bg-white p-8 text-slate-900 shadow-sm print:shadow-none print:p-0">
            {/* Membrete Oficial */}
            <div className="border-b-2 border-teal pb-4 text-center">
              <div className="text-[11px] font-black uppercase tracking-widest text-teal">
                Sistema Integrado de Control Financiero y Tesorería
              </div>
              <h1 className="text-xl font-black uppercase text-slate-900 mt-1">
                Acta de Conciliación Bancaria
              </h1>
              <p className="text-xs text-slate-600 mt-0.5 font-medium">
                Conforme al Marco Técnico Normativo Contable (Decreto 2420 de 2015 · NIIF / NIC 7)
              </p>
            </div>

            {/* Metadatos de la Conciliación */}
            <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-xs border border-slate-200">
              <div>
                <span className="font-semibold text-slate-500 block text-[11px]">Razón Social / Empresa:</span>
                <span className="font-bold text-slate-900 text-sm">{empresaNombre}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[11px]">Entidad Financiera:</span>
                <span className="font-bold text-slate-900 text-sm">{bancoNombre}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[11px]">Número de Cuenta:</span>
                <span className="font-mono font-bold text-slate-900">{numeroCuenta}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[11px]">Cuenta Contable en Libros:</span>
                <span className="font-mono font-bold text-slate-900">{cuentaContable}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[11px]">Periodo de Conciliación:</span>
                <span className="font-medium text-slate-900">{periodo || "Corte a la fecha"}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[11px]">Fecha de Expedición del Acta:</span>
                <span className="font-medium text-slate-900">{formatDate(fechaActa)}</span>
              </div>
            </div>

            {/* Estructura Canónica de Conciliación Aritmética */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-teal border-b border-slate-200 pb-1.5 mb-2">
                1. Estructura de Conciliación Aritmética
              </h3>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-200">
                  <tr className="font-semibold bg-slate-100/80">
                    <td className="py-2 px-3 text-slate-800">Saldo Final según Extracto Bancario</td>
                    <td className="py-2 px-3 text-center text-slate-500 font-mono w-12">(=)</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-900">
                      {formatMoneyExact(summary.saldoExtracto)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-700 pl-6">
                      (+) Consignaciones y Abonos en Tránsito (en libros contables pero aún no en banco)
                    </td>
                    <td className="py-2 px-3 text-center text-emerald-600 font-mono font-bold">(+)</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                      {formatMoneyExact(summary.consignacionesEnTransito)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-700 pl-6">
                      (-) Cheques y Giros pendientes de cobro (girados en libros pero no cobrados en banco)
                    </td>
                    <td className="py-2 px-3 text-center text-rose-600 font-mono font-bold">(-)</td>
                    <td className="py-2 px-3 text-right font-mono text-rose-700 font-semibold">
                      {summary.chequesEnTransito > 0 ? `-${formatMoneyExact(summary.chequesEnTransito)}` : "$ 0,00"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-700 pl-6">
                      (-) Notas Débito Bancarias no registradas en libros (GMF 4x1000 / Comisiones / Gastos)
                    </td>
                    <td className="py-2 px-3 text-center text-rose-600 font-mono font-bold">(-)</td>
                    <td className="py-2 px-3 text-right font-mono text-rose-700 font-semibold">
                      {summary.notasDebitoNoRegistradas > 0 ? `-${formatMoneyExact(summary.notasDebitoNoRegistradas)}` : "$ 0,00"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 text-slate-700 pl-6">
                      (+) Notas Crédito Bancarias no registradas en libros (Rendimientos / Intereses)
                    </td>
                    <td className="py-2 px-3 text-center text-emerald-600 font-mono font-bold">(+)</td>
                    <td className="py-2 px-3 text-right font-mono text-emerald-700 font-semibold">
                      {formatMoneyExact(summary.notasCreditoNoRegistradas)}
                    </td>
                  </tr>
                  <tr className="font-bold bg-teal-50 border-t-2 border-teal text-teal-900">
                    <td className="py-2.5 px-3">(=) SALDO CONCILIADO DE BANCOS</td>
                    <td className="py-2.5 px-3 text-center font-mono font-black">(=)</td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-sm">
                      {formatMoneyExact(summary.saldoConciliado)}
                    </td>
                  </tr>
                  <tr className="font-semibold bg-slate-50">
                    <td className="py-2 px-3 text-slate-800">Saldo Final según Libros Contables</td>
                    <td className="py-2 px-3 text-center text-slate-500 font-mono">(=)</td>
                    <td className="py-2 px-3 text-right font-mono text-slate-900">
                      {formatMoneyExact(summary.saldoLibros)}
                    </td>
                  </tr>
                  <tr className={`font-bold ${summary.cuadrado ? "bg-emerald-50 text-emerald-950" : "bg-amber-50 text-amber-950"}`}>
                    <td className="py-2.5 px-3 flex items-center gap-2">
                      {summary.cuadrado ? (
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="size-4 text-amber-600 shrink-0" />
                      )}
                      <span>(=) DIFERENCIA DE CONCILIACIÓN</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-black">(=)</td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-sm">
                      {formatMoneyExact(summary.diferenciaCuadre)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Certificación del Cuadre */}
            <div className={`rounded-lg border p-4 text-xs ${summary.cuadrado ? "border-emerald-300 bg-emerald-50/70 text-emerald-900" : "border-amber-300 bg-amber-50/70 text-amber-900"}`}>
              <div className="font-bold text-sm mb-1">
                {summary.cuadrado
                  ? "Dictamen Contable: Conciliación Cuadrada al 100%"
                  : "Dictamen Contable: Conciliación con Partidas Pendientes de Registro"}
              </div>
              <p className="leading-relaxed">
                {summary.cuadrado
                  ? `Se certifica que una vez cotejados los movimientos del extracto bancario de ${bancoNombre} contra el libro contable de tesorería, los saldos concilian aritméticamente sin diferencias no justificadas, soportando la razonabilidad de las cifras registradas al cierre del periodo.`
                  : `Se evidencian partidas pendientes de ajuste por un valor neto de ${formatMoneyExact(summary.diferenciaCuadre)}, las cuales se detallan a continuación para su respectiva causación mediante comprobante de ajuste contable.`}
              </p>
            </div>

            {/* Resumen de Partidas Conciliatorias */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-teal border-b border-slate-200 pb-1.5">
                2. Detalle de Partidas Conciliatorias
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                  <span className="font-bold text-slate-700 block mb-1">Consignaciones en Tránsito ({consignacionesList.length}):</span>
                  <span className="font-mono text-slate-900 font-semibold">{formatMoneyExact(summary.consignacionesEnTransito)}</span>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                  <span className="font-bold text-slate-700 block mb-1">Cheques y Giros en Tránsito ({chequesList.length}):</span>
                  <span className="font-mono text-slate-900 font-semibold">{formatMoneyExact(summary.chequesEnTransito)}</span>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                  <span className="font-bold text-slate-700 block mb-1">Notas Débito por Causar ({notasDebitoList.length} - GMF/Comisiones):</span>
                  <span className="font-mono text-slate-900 font-semibold">{formatMoneyExact(summary.notasDebitoNoRegistradas)}</span>
                </div>
                <div className="border border-slate-200 rounded p-2.5 bg-slate-50">
                  <span className="font-bold text-slate-700 block mb-1">Notas Crédito por Causar ({notasCreditoList.length} - Rendimientos):</span>
                  <span className="font-mono text-slate-900 font-semibold">{formatMoneyExact(summary.notasCreditoNoRegistradas)}</span>
                </div>
              </div>
            </div>

            {/* Firmas de Responsabilidad */}
            <div className="pt-10">
              <div className="grid grid-cols-2 gap-12 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 pb-1 min-h-[40px] flex items-end justify-center font-bold text-slate-900">
                    {contadorNombre || "_________________________________"}
                  </div>
                  <div className="font-bold text-slate-800 mt-1">Elaboró: Contador Público</div>
                  <div className="text-slate-500 text-[11px]">
                    T.P. No. {contadorTp || "_______________"}
                  </div>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-1 min-h-[40px] flex items-end justify-center font-bold text-slate-900">
                    {revisorNombre || "_________________________________"}
                  </div>
                  <div className="font-bold text-slate-800 mt-1">Revisó: Revisor Fiscal / Gerente</div>
                  <div className="text-slate-500 text-[11px]">
                    C.C. / T.P. No. {revisorDoc || "_______________"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
