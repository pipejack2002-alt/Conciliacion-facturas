import { memo } from "react";
import { CheckCircle2, AlertCircle, DollarSign } from "lucide-react";
import { formatMoney, formatMoneyExact } from "@/lib/format";
import type { BankConciliacionSummary } from "@/lib/conciliar-bancos";
import { cn } from "@/lib/cn";

interface BankSummaryCardsProps {
  extractoItemsCount: number;
  summary: BankConciliacionSummary;
  librosEfectivosCount: number;
  saldoInputStr: string;
  onSaldoChange: (val: string) => void;
  onSaldoBlur: () => void;
}

export const BankSummaryCards = memo(function BankSummaryCards({
  extractoItemsCount,
  summary,
  librosEfectivosCount,
  saldoInputStr,
  onSaldoChange,
  onSaldoBlur,
}: BankSummaryCardsProps) {
  const isSinExtracto = extractoItemsCount === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Panel A: Estado del Cuadre con Alto Contraste */}
      <div
        className={cn(
          "lg:col-span-4 rounded-2xl border-2 p-5 shadow-xs flex flex-col justify-between transition-all",
          isSinExtracto
            ? "border-line bg-bg-surface text-ink"
            : summary.cuadrado
            ? "border-emerald-500/70 bg-linear-to-br from-emerald-50/90 via-white to-emerald-50/40 dark:from-emerald-950/60 dark:via-bg-surface dark:to-emerald-950/20 text-ink"
            : "border-amber-500/70 bg-linear-to-br from-amber-50/90 via-white to-amber-50/40 dark:from-amber-950/60 dark:via-bg-surface dark:to-amber-950/20 text-ink"
        )}
      >
        <div>
          <div className="flex items-center justify-between">
            <span
              className={cn(
                "text-[11px] font-black uppercase tracking-wider",
                isSinExtracto
                  ? "text-ink-muted"
                  : summary.cuadrado
                  ? "text-emerald-800 dark:text-emerald-400"
                  : "text-amber-800 dark:text-amber-400"
              )}
            >
              Resultado de Conciliación
            </span>
            {isSinExtracto ? (
              <span className="flex items-center gap-1.5 rounded-full bg-bg-subtle border border-line px-3 py-1 text-xs font-bold text-ink-muted shadow-2xs">
                Sin Extracto
              </span>
            ) : summary.cuadrado ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow-xs">
                <CheckCircle2 className="size-3.5" />
                {summary.soloRendimientos ? "Cuadrado (Solo Rendimientos)" : "Cuadrado 100%"}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-white shadow-xs">
                <AlertCircle className="size-3.5" />
                Con Diferencia
              </span>
            )}
          </div>

          <div className="mt-3.5">
            <div
              className={cn(
                "font-display text-2xl sm:text-3xl font-black tracking-tight",
                isSinExtracto
                  ? "text-ink"
                  : summary.cuadrado
                  ? "text-emerald-950 dark:text-emerald-200"
                  : "text-amber-950 dark:text-amber-200"
              )}
            >
              {isSinExtracto
                ? "LISTO PARA CONCILIAR"
                : summary.cuadrado
                ? summary.soloRendimientos
                  ? `CUADRADO: SOLO RENDIMIENTOS (${formatMoney(summary.notasCreditoRendimientos || 0)})`
                  : "CUADRADO PERFECTO"
                : `DIFERENCIA: ${formatMoney(summary.diferenciaCuadre)}`}
            </div>
            <p
              className={cn(
                "mt-1.5 text-xs font-medium leading-relaxed",
                isSinExtracto
                  ? "text-ink-muted"
                  : summary.cuadrado
                  ? "text-emerald-900/90 dark:text-emerald-300"
                  : "text-amber-900/90 dark:text-amber-300"
              )}
            >
              {isSinExtracto
                ? "Carga tu extracto bancario en PDF o Excel arriba para realizar el cruce automático con tus libros auxiliares."
                : summary.cuadrado
                ? summary.soloRendimientos
                  ? `El saldo contable conciliado coincide al 100% con el extracto bancario. La única partida pendiente de registro contable son los rendimientos financieros (${formatMoney(summary.notasCreditoRendimientos || 0)}) que se causan al mes siguiente.`
                  : "El saldo bancario ajustado coincide con el saldo de libros contables al 100% sin partidas huérfanas."
                : "Existen partidas pendientes por identificar, cheques en tránsito o notas bancarias pendientes de registro."}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3.5 border-t border-line space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-ink font-semibold">
            <span>Movimientos Conciliados:</span>
            <span className="font-mono font-bold text-ink bg-bg-subtle border border-line px-2 py-0.5 rounded-md">
              {summary.totalMovimientosBancoConciliados || summary.totalConciliados} de {extractoItemsCount} en extracto ({summary.totalConciliados} partidas)
            </span>
          </div>
          <div className="flex items-center justify-between text-ink font-semibold">
            <span>Registros en Libros Analizados:</span>
            <span className="font-mono font-bold text-ink bg-bg-subtle border border-line px-2 py-0.5 rounded-md">
              {librosEfectivosCount} movimientos
            </span>
          </div>
        </div>
      </div>

      {/* Panel B: Cuadro Aritmético de Conciliación */}
      <div className="lg:col-span-8 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-semibold text-sm text-ink flex items-center gap-1.5">
            <DollarSign className="size-4 text-teal" />
            Estado de Conciliación Bancaria (Norma Técnica NIIF / DIAN)
          </h3>

          {/* Ajuste manual de saldo inicial con formato de miles y decimales */}
          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-bg-subtle/70 px-3 py-1.5 shadow-2xs">
            <span className="text-ink-muted text-xs font-semibold whitespace-nowrap">Saldo Inicial:</span>
            <span className="font-mono text-xs font-bold text-teal">$</span>
            <input
              type="text"
              value={saldoInputStr}
              onChange={(e) => onSaldoChange(e.target.value)}
              onBlur={onSaldoBlur}
              placeholder="0,00"
              className="w-36 rounded-md bg-transparent px-1 font-mono text-right text-xs font-bold text-ink focus:outline-teal focus:bg-bg-surface transition"
              title="Ingresa el saldo inicial del extracto bancario con separadores de miles y decimales"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <div className="flex justify-between py-1 border-b border-line/60">
            <span className="text-ink-muted">Saldo según Libros Contables:</span>
            <span className="font-mono font-bold text-ink">
              {formatMoneyExact(summary.saldoLibros)}
            </span>
          </div>

          <div className="py-1 border-b border-line/60 text-blue-600 dark:text-blue-400">
            <div className="flex justify-between">
              <span title="Abonos e ingresos registrados por el banco pendientes de causar en libros contables (ej. rendimientos financieros del mes)">
                (+) Notas Crédito Banco (Rendimientos / Abonos):
              </span>
              <span className="font-mono font-bold">
                +{formatMoneyExact(summary.notasCreditoNoRegistradas)}
              </span>
            </div>
            {summary.notasCreditoNoRegistradas > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-ink-muted mt-0.5 font-normal">
                <span>Rendimientos: <strong className="text-teal font-mono">{formatMoneyExact(summary.notasCreditoRendimientos || 0)}</strong></span>
                <span>•</span>
                <span>Otros Abonos: <strong className="text-ink font-mono">{formatMoneyExact(summary.notasCreditoOperativas || 0)}</strong></span>
              </div>
            )}
          </div>

          <div className="py-1 border-b border-line/60 text-amber-600 dark:text-amber-400">
            <div className="flex justify-between">
              <span title="Cargos y retiros efectuados por el banco que aún no se han registrado en libros contables (GMF 4x1000, comisiones bancarias)">
                (-) Notas Débito Banco (Cargos no en Libros):
              </span>
              <span className="font-mono font-bold">
                -{formatMoneyExact(summary.notasDebitoNoRegistradas)}
              </span>
            </div>
            {summary.notasDebitoNoRegistradas > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-ink-muted mt-0.5 font-normal">
                <span>GMF 4×1000: <strong className="text-amber-700 dark:text-amber-300 font-mono">{formatMoneyExact(summary.notasDebitoGmf || 0)}</strong></span>
                <span>•</span>
                <span>Comisiones: <strong className="text-blue-700 dark:text-blue-300 font-mono">{formatMoneyExact(summary.notasDebitoComisiones || 0)}</strong></span>
                <span>•</span>
                <span>Pagos/Otros: <strong className="text-ink font-mono">{formatMoneyExact(summary.notasDebitoOperativas || 0)}</strong></span>
              </div>
            )}
          </div>

          <div className="flex justify-between py-1 border-b border-line/60 text-rose-600 dark:text-rose-400">
            <span>(+) Cheques / Transferencias en Tránsito:</span>
            <span className="font-mono font-bold">
              +{formatMoneyExact(summary.chequesEnTransito)}
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-line/60 text-emerald-600 dark:text-emerald-400">
            <span>(-) Consignaciones en Tránsito:</span>
            <span className="font-mono font-bold">
              -{formatMoneyExact(summary.consignacionesEnTransito)}
            </span>
          </div>

          <div className="flex justify-between py-1 border-b border-teal/40 bg-teal-soft/20 px-2 rounded font-semibold text-teal-deep dark:text-teal">
            <span title="Saldo bancario resultante de conciliar libros con extracto (debe coincidir con el Saldo según Extracto Bancario)">
              (=) Saldo Bancario Conciliado (según Extracto):
            </span>
            <span className="font-mono font-bold">
              {formatMoneyExact(summary.saldoConciliado)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
