import { memo } from "react";
import { CheckCircle2, AlertCircle, DollarSign, FileSpreadsheet, ArrowUpRight, ArrowDownLeft, Scale } from "lucide-react";
import { formatMoneyExact } from "@/lib/format";
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
  const isSinArchivos = extractoItemsCount === 0 && librosEfectivosCount === 0;
  const isSoloExtracto = extractoItemsCount > 0 && librosEfectivosCount === 0;
  const isSoloLibros = extractoItemsCount === 0 && librosEfectivosCount > 0;
  const isAmbosCargados = extractoItemsCount > 0 && librosEfectivosCount > 0;

  const totalPartidasSuman = (summary.notasCreditoNoRegistradas || 0) + (summary.chequesEnTransito || 0);
  const totalPartidasRestan = (summary.notasDebitoNoRegistradas || 0) + (summary.consignacionesEnTransito || 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Panel A: Estado del Cuadre y Diagnóstico */}
      <div
        className={cn(
          "lg:col-span-4 rounded-2xl border-2 p-5 shadow-xs flex flex-col justify-between transition-all",
          isSinArchivos
            ? "border-line bg-bg-surface text-ink"
            : isSoloExtracto || isSoloLibros
            ? "border-amber-500/70 bg-linear-to-br from-amber-50/90 via-white to-amber-50/40 dark:from-amber-950/60 dark:via-bg-surface dark:to-amber-950/20 text-ink"
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
                isSinArchivos
                  ? "text-ink-muted"
                  : isSoloExtracto || isSoloLibros
                  ? "text-amber-800 dark:text-amber-400"
                  : summary.cuadrado
                  ? "text-emerald-800 dark:text-emerald-400"
                  : "text-amber-800 dark:text-amber-400"
              )}
            >
              Resultado de Conciliación
            </span>
            {isSinArchivos ? (
              <span className="flex items-center gap-1.5 rounded-full bg-bg-subtle border border-line px-3 py-1 text-xs font-bold text-ink-muted shadow-2xs">
                Sin Archivos
              </span>
            ) : isSoloExtracto ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-white shadow-xs">
                <AlertCircle className="size-3.5" />
                Falta Archivo Contable
              </span>
            ) : isSoloLibros ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-white shadow-xs">
                <AlertCircle className="size-3.5" />
                Falta Extracto Bancario
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
                isSinArchivos
                  ? "text-ink"
                  : isSoloExtracto || isSoloLibros
                  ? "text-amber-950 dark:text-amber-200"
                  : summary.cuadrado
                  ? "text-emerald-950 dark:text-emerald-200"
                  : "text-amber-950 dark:text-amber-200"
              )}
            >
              {isSinArchivos
                ? "LISTO PARA CONCILIAR"
                : isSoloExtracto
                ? "PENDIENTE: CARGAR LIBRO AUXILIAR"
                : isSoloLibros
                ? "PENDIENTE: CARGAR EXTRACTO"
                : summary.cuadrado
                ? summary.soloRendimientos
                  ? `CUADRADO: SOLO RENDIMIENTOS (${formatMoneyExact(summary.notasCreditoRendimientos || 0)})`
                  : "CUADRADO PERFECTO"
                : `DIFERENCIA: ${formatMoneyExact(summary.diferenciaCuadre)}`}
            </div>
            <p
              className={cn(
                "mt-1.5 text-xs font-medium leading-relaxed",
                isSinArchivos
                  ? "text-ink-muted"
                  : isSoloExtracto || isSoloLibros
                  ? "text-amber-900/90 dark:text-amber-300"
                  : summary.cuadrado
                  ? "text-emerald-900/90 dark:text-emerald-300"
                  : "text-amber-900/90 dark:text-amber-300"
              )}
            >
              {isSinArchivos
                ? "Carga tu extracto bancario en PDF o Excel y el archivo de movimientos auxiliares para realizar el cruce automático."
                : isSoloExtracto
                ? `Se cargó el extracto bancario con ${extractoItemsCount} movimientos, pero aún falta cargar el archivo de movimientos en libros (Excel) para realizar la confrontación y cuadre.`
                : isSoloLibros
                ? `Se cargó el libro auxiliar con ${librosEfectivosCount} registros contables, pero aún falta cargar el extracto bancario (PDF o Excel) para realizar la conciliación.`
                : summary.cuadrado
                ? summary.soloRendimientos
                  ? `El saldo contable conciliado coincide al 100% con el extracto bancario. La única partida pendiente de registro contable son los rendimientos financieros (${formatMoneyExact(summary.notasCreditoRendimientos || 0)}) que se causan al mes siguiente.`
                  : "El saldo bancario ajustado coincide con el saldo de libros contables al 100% sin partidas huérfanas."
                : "Existen partidas pendientes por identificar, cheques en tránsito o notas bancarias pendientes de registro contable."}
            </p>
          </div>
        </div>

        <div className="mt-4 pt-3.5 border-t border-line space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-ink font-semibold">
            <span>Movimientos en Extracto:</span>
            <span className="font-mono font-bold text-ink bg-bg-subtle border border-line px-2 py-0.5 rounded-md">
              {isAmbosCargados
                ? `${summary.totalMovimientosBancoConciliados || summary.totalConciliados} de ${extractoItemsCount} (${summary.totalConciliados} partidas)`
                : `${extractoItemsCount} movimientos`}
            </span>
          </div>
          <div className="flex items-center justify-between text-ink font-semibold">
            <span>Registros en Libros Analizados:</span>
            <span className="font-mono font-bold text-ink bg-bg-subtle border border-line px-2 py-0.5 rounded-md">
              {librosEfectivosCount > 0 ? `${librosEfectivosCount} movimientos` : "0 (Pendiente subir archivo)"}
            </span>
          </div>
        </div>
      </div>

      {/* Panel B: Formato Oficial de Conciliación Bancaria (Norma Técnica NIIF / DIAN) */}
      <div className="lg:col-span-8 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs space-y-3.5">
        {/* Cabecera del Formato Oficial */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-teal-soft/80 p-1.5 text-teal">
              <Scale className="size-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-ink flex items-center gap-1.5">
                Formato de Conciliación Bancaria (Norma Técnica NIIF / DIAN)
              </h3>
              <p className="text-[11px] text-ink-muted">
                Método de Saldos Ajustados · Libros Contables hacia Extracto Bancario
              </p>
            </div>
          </div>

          {/* Ajuste manual de saldo inicial del extracto */}
          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-bg-subtle/70 px-3 py-1.5 shadow-2xs">
            <span className="text-ink-muted text-xs font-semibold whitespace-nowrap">Saldo Inicial Extracto:</span>
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

        {/* Estructura Aritmética Vertical Formal de Conciliación */}
        <div className="space-y-2 text-xs">
          {/* 1. Saldo en Libros Contables */}
          <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-bg-subtle/70 border border-line font-medium text-ink">
            <span className="font-bold">1. Saldo Final según Libros Contables al Cierre:</span>
            <span className="font-mono font-black text-sm text-ink">
              ${formatMoneyExact(summary.saldoLibros)}
            </span>
          </div>

          {/* 2. Grupo Partidas que Suman (+) */}
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/15 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <ArrowUpRight className="size-3.5 text-emerald-600" />
                (+) MÁS: Partidas que Aumentan el Saldo en Libros (Abonos no causados / Giros en tránsito)
              </span>
              <span className="font-mono text-xs font-black">
                +{formatMoneyExact(totalPartidasSuman)}
              </span>
            </div>

            <div className="space-y-1 pl-4 text-[11px]">
              <div className="flex items-center justify-between text-ink py-0.5 border-b border-emerald-500/10">
                <div>
                  <span className="font-medium">• Rendimientos Financieros del Periodo (Notas Crédito Banco):</span>
                  <span className="block text-[10px] text-ink-muted">Intereses abonados por el banco pendientes de causar en libros</span>
                </div>
                <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                  +{formatMoneyExact(summary.notasCreditoRendimientos || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-ink py-0.5 border-b border-emerald-500/10">
                <div>
                  <span className="font-medium">• Otros Abonos y Transferencias Bancarias pendientes de registrar:</span>
                  <span className="block text-[10px] text-ink-muted">Consignaciones directas de clientes no identificadas en libros</span>
                </div>
                <span className="font-mono font-bold text-ink whitespace-nowrap">
                  +{formatMoneyExact(summary.notasCreditoOperativas || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-ink py-0.5">
                <div>
                  <span className="font-medium">• Cheques y Transferencias en Tránsito (Girados y no Cobrados):</span>
                  <span className="block text-[10px] text-ink-muted">Pagos registrados en libros pero aún no debitados por el banco</span>
                </div>
                <span className="font-mono font-bold text-ink whitespace-nowrap">
                  +{formatMoneyExact(summary.chequesEnTransito || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Grupo Partidas que Restan (-) */}
          <div className="rounded-xl border border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/15 p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-rose-800 dark:text-rose-400 font-bold text-[11px] uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <ArrowDownLeft className="size-3.5 text-rose-600" />
                (-) MENOS: Partidas que Disminuyen el Saldo en Libros (Cargos bancarios no registrados / En tránsito)
              </span>
              <span className="font-mono text-xs font-black">
                -{formatMoneyExact(totalPartidasRestan)}
              </span>
            </div>

            <div className="space-y-1 pl-4 text-[11px]">
              <div className="flex items-center justify-between text-ink py-0.5 border-b border-rose-500/10">
                <div>
                  <span className="font-medium">• Gravamen a los Movimientos Financieros (GMF 4×1000):</span>
                  <span className="block text-[10px] text-ink-muted">Impuesto bancario debitado por el banco pendiente de registrar</span>
                </div>
                <span className="font-mono font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
                  -{formatMoneyExact(summary.notasDebitoGmf || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-ink py-0.5 border-b border-rose-500/10">
                <div>
                  <span className="font-medium">• Comisiones Bancarias y Gastos Financieros con IVA:</span>
                  <span className="block text-[10px] text-ink-muted">Cuotas de manejo, transferencias y comisiones debitadas</span>
                </div>
                <span className="font-mono font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
                  -{formatMoneyExact(summary.notasDebitoComisiones || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-ink py-0.5 border-b border-rose-500/10">
                <div>
                  <span className="font-medium">• Otras Notas Débito Bancarias no Contabilizadas:</span>
                  <span className="block text-[10px] text-ink-muted">Pagos automáticos o débitos bancarios pendientes de causar</span>
                </div>
                <span className="font-mono font-bold text-ink whitespace-nowrap">
                  -{formatMoneyExact(summary.notasDebitoOperativas || 0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-ink py-0.5">
                <div>
                  <span className="font-medium">• Consignaciones en Tránsito (Registradas y no Acreditadas):</span>
                  <span className="block text-[10px] text-ink-muted">Depósitos registrados en libros aún no abonados en el extracto</span>
                </div>
                <span className="font-mono font-bold text-ink whitespace-nowrap">
                  -{formatMoneyExact(summary.consignacionesEnTransito || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Confrontación Final y Cuadre */}
          <div className="pt-1.5 space-y-1.5">
            <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-teal-soft/30 border border-teal/40 font-bold text-ink">
              <span className="text-teal-deep dark:text-teal font-extrabold">
                (=) Saldo Bancario Conciliado (Libros Ajustados):
              </span>
              <span className="font-mono font-black text-sm text-teal-deep dark:text-teal">
                ${formatMoneyExact(summary.saldoConciliado)}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 px-3 rounded-lg border border-line text-ink font-semibold">
              <span className="text-ink-muted">
                (=) Saldo Final según Extracto Bancario al Corte:
              </span>
              <span className="font-mono font-bold text-ink">
                ${formatMoneyExact(summary.saldoExtracto)}
              </span>
            </div>

            {/* Banner de Diferencia Neta */}
            <div
              className={cn(
                "flex items-center justify-between py-2 px-3 rounded-xl border text-xs font-bold transition",
                summary.cuadrado
                  ? "border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                  : "border-amber-500/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
              )}
            >
              <div className="flex items-center gap-1.5">
                {summary.cuadrado ? (
                  <>
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span>DIFERENCIA NETA DE CONCILIACIÓN: CUADRADA AL 100%</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
                    <span>DIFERENCIA NETA DE CONCILIACIÓN PENDIENTE</span>
                  </>
                )}
              </div>
              <span className="font-mono font-black text-sm">
                ${formatMoneyExact(summary.diferenciaCuadre)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
