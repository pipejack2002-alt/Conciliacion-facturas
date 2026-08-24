import { X, FileText, CheckCircle2, AlertCircle, Percent, Receipt, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { ConciliacionResult } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  result: ConciliacionResult;
}

export function TaxSummaryModal({ open, onClose, result }: Props) {
  if (!open) return null;

  const { rows, company, periodLabel } = result;

  // 1. Calculations for Recibidas (Purchases / Expenses)
  const recibidas = rows.filter((r) => r.grupo === "Recibido" && r.estado !== "no_aplica");
  const totalIvaDianRecibidas = recibidas.reduce((s, r) => s + (r.iva || 0), 0);
  const totalBaseDianRecibidas = recibidas.reduce((s, r) => s + Math.max(0, r.totalDian - (r.iva || 0)), 0);
  const totalFacturadoDian = recibidas.reduce((s, r) => s + r.totalDian, 0);

  // Estimations for Formulario 300
  const gravadas19 = recibidas.filter((r) => (r.iva || 0) > 0);
  const baseGravada19 = gravadas19.reduce((s, r) => s + Math.max(0, r.totalDian - (r.iva || 0)), 0);
  const baseExcluida = totalBaseDianRecibidas - baseGravada19;

  // 2. Calculations for Emitidas (Sales)
  const emitidas = rows.filter((r) => r.grupo === "Emitido" && r.estado !== "no_aplica");
  const totalIvaEmitidas = emitidas.reduce((s, r) => s + (r.iva || 0), 0);
  const totalBaseEmitidas = emitidas.reduce((s, r) => s + Math.max(0, r.totalDian - (r.iva || 0)), 0);

  // Estimated ReteFuente
  const estReteFuenteCompras = baseGravada19 * 0.025; // standard 2.5% reference

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-line bg-bg-surface p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/10 text-teal">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                Conciliación Fiscal & Borrador Formulario 300 / 350
              </h2>
              <p className="text-xs text-text-secondary">
                {company.nombre} (NIT: {company.nit}) · {periodLabel || "Período actual"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-muted hover:bg-bg-subtle hover:text-text-primary transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-6 space-y-6">
          {/* Top Comparison Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* IVA Descontable */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <ArrowDownLeft className="h-4 w-4" /> IVA Descontable (Compras)
                </span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  {recibidas.length} facturas
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-text-primary">
                {formatMoney(totalIvaDianRecibidas)}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Total IVA facturado electrónicamente por proveedores en la DIAN disponible para descuento en el Formulario 300.
              </p>
            </div>

            {/* IVA Generado */}
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  <ArrowUpRight className="h-4 w-4" /> IVA Generado (Ventas)
                </span>
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                  {emitidas.length} facturas
                </span>
              </div>
              <p className="mt-2 text-2xl font-bold text-text-primary">
                {formatMoney(totalIvaEmitidas)}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Total IVA generado en ventas electrónicas emitidas ante la DIAN (Base Gravable: {formatMoney(totalBaseEmitidas)}).
              </p>
            </div>
          </div>

          {/* Formulario 300 DIAN Draft */}
          <div className="rounded-xl border border-line bg-bg-elevated p-5">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <Receipt className="h-4 w-4 text-teal" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                Borrador Referencial de Renglones · Formulario 300 (IVA)
              </h3>
            </div>

            <div className="mt-4 divide-y divide-line text-sm">
              <div className="flex justify-between py-2.5">
                <span className="text-text-secondary">
                  Compras nacionales gravadas a tarifa general (Base 19%)
                </span>
                <span className="font-semibold text-text-primary">
                  {formatMoney(baseGravada19)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-text-secondary">
                  Compras de bienes y servicios no gravados / excluidos
                </span>
                <span className="font-semibold text-text-primary">
                  {formatMoney(baseExcluida)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="font-medium text-text-primary">
                  Total Compras y Adquisiciones del Período
                </span>
                <span className="font-bold text-text-primary">
                  {formatMoney(totalFacturadoDian)}
                </span>
              </div>
              <div className="flex justify-between py-2.5 bg-teal/5 px-2 rounded font-semibold">
                <span className="text-teal">
                  Impuesto a las ventas descontable por compras a tarifa general (19%)
                </span>
                <span className="text-teal">
                  {formatMoney(totalIvaDianRecibidas)}
                </span>
              </div>
            </div>
          </div>

          {/* Formulario 350 Estimator */}
          <div className="rounded-xl border border-line bg-bg-elevated p-5">
            <div className="flex items-center gap-2 border-b border-line pb-3">
              <FileText className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                Retención en la Fuente Estimada · Formulario 350
              </h3>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
              <div>
                <p className="text-xs text-text-secondary">Base Gravable Compras y Servicios:</p>
                <p className="mt-1 font-semibold text-text-primary">{formatMoney(baseGravada19)}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">ReteFuente Estimada (2.5% compras ref.):</p>
                <p className="mt-1 font-semibold text-amber-600 dark:text-amber-400">{formatMoney(estReteFuenteCompras)}</p>
              </div>
            </div>
          </div>

          {/* Tax Audit Recommendation Alert */}
          <div className="flex items-start gap-3 rounded-lg border border-teal/20 bg-teal/5 p-3.5 text-xs text-teal">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-teal mt-0.5" />
            <div>
              <span className="font-bold">Control Tributario: </span>
              El cruce electrónico garantiza que el 100% del IVA descontable declarado en el Formulario 300 esté amparado con factura electrónica validada en el servidor de la DIAN, eliminando riesgos de rechazo en auditoría fiscal.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end border-t border-line pt-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-white shadow hover:bg-teal-hover transition"
          >
            Cerrar Resumen Fiscal
          </button>
        </div>
      </div>
    </div>
  );
}
