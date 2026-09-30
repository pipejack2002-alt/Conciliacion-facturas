import { memo } from "react";
import { BadgePercent, CreditCard, TrendingUp, Layers } from "lucide-react";
import { formatMoneyExact } from "@/lib/format";
import type { BankExecutiveBreakdown } from "@/lib/conciliar-bancos";
import { cn } from "@/lib/cn";

interface BankExecutiveCardsProps {
  breakdown: BankExecutiveBreakdown;
}

export const BankExecutiveCards = memo(function BankExecutiveCards({
  breakdown,
}: BankExecutiveCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Card 1: GMF 4x1000 */}
      <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs transition">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
              <BadgePercent className="size-4" />
            </span>
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              GMF (4×1000)
            </span>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-extrabold border",
              breakdown.gmf.pendiente === 0 && breakdown.gmf.count > 0
                ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                : breakdown.gmf.pendiente > 0
                ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                : "bg-bg-subtle text-ink-subtle border-line"
            )}
          >
            {breakdown.gmf.pendiente === 0 && breakdown.gmf.count > 0
              ? "✓ 100% Contabilizado"
              : breakdown.gmf.pendiente > 0
              ? `⚠️ ${formatMoneyExact(breakdown.gmf.pendiente)} Pendiente`
              : "Sin Movimientos"}
          </span>
        </div>
        <div className="font-mono text-lg font-black text-ink">
          {formatMoneyExact(breakdown.gmf.total)}
        </div>
        <div className="mt-1 text-[11px] text-ink-muted flex items-center justify-between">
          <span>{breakdown.gmf.count} cargos bancarios</span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            Reg: {formatMoneyExact(breakdown.gmf.registrado)}
          </span>
        </div>
      </div>

      {/* Card 2: Comisiones Banco */}
      <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs transition">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-blue-500/10 p-1.5 text-blue-600 dark:text-blue-400">
              <CreditCard className="size-4" />
            </span>
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Comisiones Banco
            </span>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-extrabold border",
              breakdown.comisiones.pendiente === 0 && breakdown.comisiones.count > 0
                ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                : breakdown.comisiones.pendiente > 0
                ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                : "bg-bg-subtle text-ink-subtle border-line"
            )}
          >
            {breakdown.comisiones.pendiente === 0 && breakdown.comisiones.count > 0
              ? "✓ 100% Contabilizado"
              : breakdown.comisiones.pendiente > 0
              ? `⚠️ ${formatMoneyExact(breakdown.comisiones.pendiente)} Pendiente`
              : "Sin Movimientos"}
          </span>
        </div>
        <div className="font-mono text-lg font-black text-ink">
          {formatMoneyExact(breakdown.comisiones.total)}
        </div>
        <div className="mt-1 text-[11px] text-ink-muted flex items-center justify-between">
          <span>{breakdown.comisiones.count} cargos y tarifas</span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            Reg: {formatMoneyExact(breakdown.comisiones.registrado)}
          </span>
        </div>
      </div>

      {/* Card 3: Rendimientos Financieros */}
      <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs transition">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-teal-500/10 p-1.5 text-teal">
              <TrendingUp className="size-4" />
            </span>
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Rendimientos (+)
            </span>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-extrabold border",
              breakdown.rendimientos.pendiente === 0 && breakdown.rendimientos.count > 0
                ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                : breakdown.rendimientos.pendiente > 0
                ? "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-300"
                : "bg-bg-subtle text-ink-subtle border-line"
            )}
          >
            {breakdown.rendimientos.pendiente === 0 && breakdown.rendimientos.count > 0
              ? "✓ 100% Contabilizado"
              : breakdown.rendimientos.pendiente > 0
              ? `⚠️ ${formatMoneyExact(breakdown.rendimientos.pendiente)} Por Causar`
              : "Sin Rendimientos"}
          </span>
        </div>
        <div className="font-mono text-lg font-black text-teal">
          +{formatMoneyExact(breakdown.rendimientos.total)}
        </div>
        <div className="mt-1 text-[11px] text-ink-muted flex items-center justify-between">
          <span>{breakdown.rendimientos.count} abonos de intereses</span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            Reg: {formatMoneyExact(breakdown.rendimientos.registrado)}
          </span>
        </div>
      </div>

      {/* Card 4: Lotes ACH y Pagos Masivos */}
      <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs transition">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-purple-500/10 p-1.5 text-purple-600 dark:text-purple-400">
              <Layers className="size-4" />
            </span>
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              Lotes ACH / Masivos
            </span>
          </div>
          <span className="rounded-full bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 text-[10px] font-extrabold">
            {breakdown.lotesAch.countLotes} Lotes Auditados
          </span>
        </div>
        <div className="font-mono text-lg font-black text-ink">
          {formatMoneyExact(breakdown.lotesAch.total)}
        </div>
        <div className="mt-1 text-[11px] text-ink-muted flex items-center justify-between">
          <span>{breakdown.lotesAch.countComprobantes} comprobantes agrupados</span>
          <span className="font-black text-emerald-700 dark:text-emerald-400">
            Diferencia $0,00
          </span>
        </div>
      </div>
    </div>
  );
});
