import { memo, useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Scale,
  Sparkles,
  ArrowRightLeft,
  BookOpen,
  Building2,
} from "lucide-react";
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
  const [metodoFormato, setMetodoFormato] = useState<"libros_a_banco" | "banco_a_libros" | "saldos_ajustados">("libros_a_banco");

  const isSinArchivos = extractoItemsCount === 0 && librosEfectivosCount === 0;
  const isSoloExtracto = extractoItemsCount > 0 && librosEfectivosCount === 0;
  const isSoloLibros = extractoItemsCount === 0 && librosEfectivosCount > 0;
  const isAmbosCargados = extractoItemsCount > 0 && librosEfectivosCount > 0;

  const totalPartidasSuman = (summary.notasCreditoNoRegistradas || 0) + (summary.chequesEnTransito || 0);
  const totalPartidasRestan = (summary.notasDebitoNoRegistradas || 0) + (summary.consignacionesEnTransito || 0);

  // Cálculos para método "De Banco a Libros"
  const saldoBancoAjustadoALibros = summary.saldoExtracto + totalPartidasRestan - totalPartidasSuman;
  const difBancoALibros = Math.abs(saldoBancoAjustadoALibros - summary.saldoLibros);

  // Cálculos para método "Saldos Ajustados"
  const saldoLibrosAjustado = summary.saldoLibros + (summary.notasCreditoNoRegistradas || 0) - (summary.notasDebitoNoRegistradas || 0);
  const saldoBancoAjustado = summary.saldoExtracto + (summary.consignacionesEnTransito || 0) - (summary.chequesEnTransito || 0);
  const difSaldosAjustados = Math.abs(saldoLibrosAjustado - saldoBancoAjustado);

  const diferenciaSaldos = Math.abs(summary.saldoExtracto - summary.saldoLibros);
  const sinPartidasPendientes =
    totalPartidasSuman === 0 && totalPartidasRestan === 0 && diferenciaSaldos < 0.05;

  const isSoloRend =
    summary.soloRendimientos ||
    ((summary.notasCreditoRendimientos || 0) > 0 &&
      (summary.notasDebitoNoRegistradas || 0) === 0 &&
      (summary.chequesEnTransito || 0) === 0 &&
      (summary.consignacionesEnTransito || 0) === 0);

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
            : sinPartidasPendientes
            ? "border-emerald-500/70 bg-linear-to-br from-emerald-50/90 via-white to-emerald-50/40 dark:from-emerald-950/60 dark:via-bg-surface dark:to-emerald-950/20 text-ink"
            : summary.cuadrado
            ? "border-amber-500/70 bg-linear-to-br from-amber-50/90 via-white to-amber-50/40 dark:from-amber-950/60 dark:via-bg-surface dark:to-amber-950/20 text-ink"
            : "border-rose-500/70 bg-linear-to-br from-rose-50/90 via-white to-rose-50/40 dark:from-rose-950/60 dark:via-bg-surface dark:to-rose-950/20 text-ink"
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
                  : sinPartidasPendientes
                  ? "text-emerald-800 dark:text-emerald-400"
                  : summary.cuadrado
                  ? "text-amber-800 dark:text-amber-400"
                  : "text-rose-800 dark:text-rose-400"
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
            ) : sinPartidasPendientes ? (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow-xs">
                <CheckCircle2 className="size-3.5" />
                Cuadrado 100% (Sin Pendientes)
              </span>
            ) : summary.cuadrado ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-white shadow-xs">
                <AlertCircle className="size-3.5" />
                Diferencia por Registrar en Libros
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-rose-600 px-3 py-1 text-xs font-black text-white shadow-xs">
                <AlertCircle className="size-3.5" />
                Descuadre Pendiente
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
                  : sinPartidasPendientes
                  ? "text-emerald-950 dark:text-emerald-200"
                  : summary.cuadrado
                  ? "text-amber-950 dark:text-amber-200"
                  : "text-rose-950 dark:text-rose-200"
              )}
            >
              {isSinArchivos
                ? "LISTO PARA CONCILIAR"
                : isSoloExtracto
                ? "PENDIENTE: CARGAR LIBRO AUXILIAR"
                : isSoloLibros
                ? "PENDIENTE: CARGAR EXTRACTO"
                : sinPartidasPendientes
                ? "SALDOS COINCIDENTES: $ 0,00"
                : `DIFERENCIA: ${formatMoneyExact(diferenciaSaldos)}`}
            </div>

            {/* A qué corresponde la diferencia */}
            {isAmbosCargados && diferenciaSaldos > 0.05 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-2">
                <div className="text-[11px] font-extrabold text-amber-900 dark:text-amber-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-amber-600" />
                    A qué corresponde la diferencia:
                  </span>
                  {summary.cuadrado && (
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/60 px-2 py-0.5 rounded-full">
                      Justificada en Cédula
                    </span>
                  )}
                </div>

                <div className="space-y-1 text-xs">
                  {(summary.notasCreditoRendimientos || 0) > 0 && (
                    <div className="flex items-center justify-between bg-bg-surface/90 px-2.5 py-1.5 rounded-lg border border-amber-500/20 text-ink">
                      <div>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">• Rendimientos Financieros del Periodo:</span>
                        <span className="block text-[10px] text-ink-muted">Abonados en extracto, pendientes de causar en libros</span>
                      </div>
                      <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                        +{formatMoneyExact(summary.notasCreditoRendimientos || 0)}
                      </span>
                    </div>
                  )}

                  {(summary.notasCreditoOperativas || 0) > 0 && (
                    <div className="flex items-center justify-between bg-bg-surface/90 px-2.5 py-1.5 rounded-lg border border-line text-ink">
                      <div>
                        <span className="font-bold text-ink">• Otros Abonos en Extracto:</span>
                        <span className="block text-[10px] text-ink-muted">Consignaciones pendientes de registrar</span>
                      </div>
                      <span className="font-mono font-bold text-ink whitespace-nowrap">
                        +{formatMoneyExact(summary.notasCreditoOperativas || 0)}
                      </span>
                    </div>
                  )}

                  {(summary.notasDebitoGmf || 0) > 0 && (
                    <div className="flex items-center justify-between bg-bg-surface/90 px-2.5 py-1.5 rounded-lg border border-line text-ink">
                      <div>
                        <span className="font-bold text-rose-700 dark:text-rose-400">• GMF (4×1000) en Extracto:</span>
                        <span className="block text-[10px] text-ink-muted">Impuesto debitado pendiente de causar</span>
                      </div>
                      <span className="font-mono font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
                        -{formatMoneyExact(summary.notasDebitoGmf || 0)}
                      </span>
                    </div>
                  )}

                  {(summary.notasDebitoComisiones || 0) > 0 && (
                    <div className="flex items-center justify-between bg-bg-surface/90 px-2.5 py-1.5 rounded-lg border border-line text-ink">
                      <div>
                        <span className="font-bold text-rose-700 dark:text-rose-400">• Comisiones Bancarias en Extracto:</span>
                        <span className="block text-[10px] text-ink-muted">Cargos debitados pendientes de causar</span>
                      </div>
                      <span className="font-mono font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
                        -{formatMoneyExact(summary.notasDebitoComisiones || 0)}
                      </span>
                    </div>
                  )}

                  {(summary.chequesEnTransito || 0) > 0 && (
                    <div className="flex items-center justify-between bg-bg-surface/90 px-2.5 py-1.5 rounded-lg border border-line text-ink">
                      <div>
                        <span className="font-bold text-ink">• Cheques / Giros en Tránsito:</span>
                        <span className="block text-[10px] text-ink-muted">Girados en libros no cobrados en banco</span>
                      </div>
                      <span className="font-mono font-bold text-ink whitespace-nowrap">
                        +{formatMoneyExact(summary.chequesEnTransito || 0)}
                      </span>
                    </div>
                  )}

                  {(summary.consignacionesEnTransito || 0) > 0 && (
                    <div className="flex items-center justify-between bg-bg-surface/90 px-2.5 py-1.5 rounded-lg border border-line text-ink">
                      <div>
                        <span className="font-bold text-ink">• Consignaciones en Tránsito:</span>
                        <span className="block text-[10px] text-ink-muted">Registradas en libros no acreditadas en banco</span>
                      </div>
                      <span className="font-mono font-bold text-ink whitespace-nowrap">
                        -{formatMoneyExact(summary.consignacionesEnTransito || 0)}
                      </span>
                    </div>
                  )}

                  {summary.diferenciaCuadre > 0.05 && (
                    <div className="flex items-center justify-between bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-rose-300 text-rose-900 dark:text-rose-200">
                      <div>
                        <span className="font-bold text-rose-800 dark:text-rose-300">• Descuadre Pendiente por Explicar:</span>
                        <span className="block text-[10px] text-rose-700 dark:text-rose-400">Diferencia sin justificación documental</span>
                      </div>
                      <span className="font-mono font-black text-rose-800 dark:text-rose-300 whitespace-nowrap">
                        ${formatMoneyExact(summary.diferenciaCuadre)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p
              className={cn(
                "mt-2.5 text-xs font-medium leading-relaxed",
                isSinArchivos
                  ? "text-ink-muted"
                  : isSoloExtracto || isSoloLibros
                  ? "text-amber-900/90 dark:text-amber-300"
                  : sinPartidasPendientes
                  ? "text-emerald-900/90 dark:text-emerald-300"
                  : summary.cuadrado
                  ? "text-amber-900/90 dark:text-amber-300"
                  : "text-rose-900/90 dark:text-rose-300"
              )}
            >
              {isSinArchivos
                ? "Carga tu extracto bancario en PDF o Excel y el archivo de movimientos auxiliares para realizar el cruce automático."
                : isSoloExtracto
                ? `Se cargó el extracto bancario con ${extractoItemsCount} movimientos, pero aún falta cargar el archivo de movimientos en libros (Excel) para realizar la confrontación y cuadre.`
                : isSoloLibros
                ? `Se cargó el libro auxiliar con ${librosEfectivosCount} registros contables, pero aún falta cargar el extracto bancario (PDF o Excel) para realizar la conciliación.`
                : sinPartidasPendientes
                ? "El saldo bancario coincide con el saldo de libros contables al 100% sin partidas pendientes ni ajustes requeridos."
                : summary.cuadrado
                ? `Existe una diferencia contable de ${formatMoneyExact(diferenciaSaldos)} entre el saldo en libros (${formatMoneyExact(summary.saldoLibros)}) y el extracto (${formatMoneyExact(summary.saldoExtracto)}) debida a que las partidas indicadas aún no se han registrado en contabilidad. En la Cédula (lado derecho) se realiza la conciliación técnica que demuestra el cuadre exacto al 100% al incorporar dichas partidas.`
                : `Existe un descuadre de ${formatMoneyExact(summary.diferenciaCuadre)} que no ha sido justificado por las partidas conciliatorias conocidas y requiere revisión contable.`}
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

      {/* Panel B: Cédula de Conciliación Bancaria con Enfoque Dual (Libros ↔ Extracto) */}
      <div className="lg:col-span-8 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs space-y-3.5">
        {/* Cabecera del Formato Oficial y Selector de Método */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-teal-soft/80 p-1.5 text-teal">
              <Scale className="size-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm text-ink flex items-center gap-1.5">
                Cédula Oficial de Conciliación Bancaria (PUC / NIIF Colombia)
              </h3>
              <p className="text-[11px] text-ink-muted">
                Confrontación técnica y matemática entre la contabilidad y el extracto financiero
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Pestañas de Método: Libros a Banco / Banco a Libros / Saldos Ajustados */}
            <div className="inline-flex rounded-xl bg-bg-subtle p-0.5 border border-line text-xs font-bold">
              <button
                type="button"
                onClick={() => setMetodoFormato("libros_a_banco")}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1",
                  metodoFormato === "libros_a_banco"
                    ? "bg-bg-surface text-teal shadow-2xs border border-line/60"
                    : "text-ink-muted hover:text-ink"
                )}
                title="Partir del saldo en libros contables hasta llegar al extracto"
              >
                <BookOpen className="size-3" />
                <span>Libros → Banco</span>
              </button>
              <button
                type="button"
                onClick={() => setMetodoFormato("banco_a_libros")}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1",
                  metodoFormato === "banco_a_libros"
                    ? "bg-bg-surface text-teal shadow-2xs border border-line/60"
                    : "text-ink-muted hover:text-ink"
                )}
                title="Partir del saldo del extracto bancario hasta llegar a libros contables"
              >
                <Building2 className="size-3" />
                <span>Banco → Libros</span>
              </button>
              <button
                type="button"
                onClick={() => setMetodoFormato("saldos_ajustados")}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1",
                  metodoFormato === "saldos_ajustados"
                    ? "bg-bg-surface text-teal shadow-2xs border border-line/60"
                    : "text-ink-muted hover:text-ink"
                )}
                title="Confrontar ambos saldos ajustados simultáneamente"
              >
                <ArrowRightLeft className="size-3" />
                <span>Saldos Ajustados</span>
              </button>
            </div>

            {/* Saldo Inicial Extracto */}
            <div className="flex items-center gap-1.5 rounded-xl border border-line bg-bg-subtle/70 px-3 py-1 shadow-2xs">
              <span className="text-ink-muted text-[11px] font-semibold whitespace-nowrap">Saldo Inicial Extracto:</span>
              <span className="font-mono text-xs font-bold text-teal">$</span>
              <input
                type="text"
                value={saldoInputStr}
                onChange={(e) => onSaldoChange(e.target.value)}
                onBlur={onSaldoBlur}
                placeholder="0,00"
                className="w-32 rounded bg-transparent px-1 font-mono text-right text-xs font-bold text-ink focus:outline-teal focus:bg-bg-surface transition"
                title="Saldo inicial según extracto bancario"
              />
            </div>
          </div>
        </div>

        {/* MÉTODO 1: LIBROS HACIA BANCO */}
        {metodoFormato === "libros_a_banco" && (
          <div className="space-y-2 text-xs">
            {/* 1. Saldo en Libros Contables */}
            <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-bg-subtle/70 border border-line font-medium text-ink">
              <span className="font-bold">1. Saldo Final según Libro Auxiliar de Bancos (al corte):</span>
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
                <div className="flex items-center justify-between text-ink py-1 border-b border-emerald-500/10">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold">• Rendimientos Financieros del Periodo (Abonados en Extracto):</span>
                      <span className="rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide border border-emerald-300/60">
                        Partida Conciliatoria (Pendiente de Registrar)
                      </span>
                    </div>
                    <span className="block text-[10px] text-ink-muted">Abonados por el banco en extracto, pendientes de causar en libros contables (aumenta libros)</span>
                  </div>
                  <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
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
                    <span className="font-medium">• Cheques y Transferencias en Tránsito (Girados en Libros no Cobrados):</span>
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
                    <span className="block text-[10px] text-ink-muted">Impuesto bancario debitado por el banco pendiente de registrar (PUC 511595)</span>
                  </div>
                  <span className="font-mono font-bold text-rose-700 dark:text-rose-400 whitespace-nowrap">
                    -{formatMoneyExact(summary.notasDebitoGmf || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-ink py-0.5 border-b border-rose-500/10">
                  <div>
                    <span className="font-medium">• Comisiones Bancarias y Gastos Financieros con IVA:</span>
                    <span className="block text-[10px] text-ink-muted">Cuotas de manejo, transferencias y comisiones debitadas (PUC 530515)</span>
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
                    <span className="font-medium">• Consignaciones en Tránsito (Registradas en Libros no Acreditadas en Banco):</span>
                    <span className="block text-[10px] text-ink-muted">Depósitos contabilizados aún no compensados en el extracto</span>
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

              {/* Banner de Diferencia Neta de la Cédula */}
              <div
                className={cn(
                  "flex items-center justify-between py-2.5 px-3.5 rounded-xl border text-xs font-bold transition",
                  summary.cuadrado
                    ? "border-emerald-500/60 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                    : "border-amber-500/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                )}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-black text-sm">
                    {summary.cuadrado ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>CONCILIACIÓN CUADRADA AL 100%</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>DIFERENCIA NETA DE CONCILIACIÓN PENDIENTE</span>
                      </>
                    )}
                  </div>
                  {summary.cuadrado && (
                    <div className="text-[10px] font-normal text-emerald-800/90 dark:text-emerald-300/90">
                      {isSoloRend
                        ? `Al aplicar la partida conciliatoria de rendimientos (+${formatMoneyExact(summary.notasCreditoRendimientos || 0)}), el saldo conciliado iguala exactamente al extracto bancario ($0,00 de diferencia neta).`
                        : "Al incorporar las partidas conciliatorias identificadas, la conciliación técnica queda cuadrada con exactitud matemática al 100%."}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-[10px] text-ink-muted uppercase">Diferencia Neta:</span>
                  <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300">
                    ${formatMoneyExact(summary.diferenciaCuadre)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MÉTODO 2: BANCO HACIA LIBROS ("Y al contrario...") */}
        {metodoFormato === "banco_a_libros" && (
          <div className="space-y-2 text-xs">
            {/* 1. Saldo Final en Extracto */}
            <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-bg-subtle/70 border border-line font-medium text-ink">
              <span className="font-bold">1. Saldo Final según Extracto Bancario al Corte:</span>
              <span className="font-mono font-black text-sm text-ink">
                ${formatMoneyExact(summary.saldoExtracto)}
              </span>
            </div>

            {/* 2. (-) Partidas de Abono que Faltan en Libros (Rendimientos / Abonos) */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-50/30 dark:bg-rose-950/15 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-rose-800 dark:text-rose-400 font-bold text-[11px] uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <ArrowDownLeft className="size-3.5 text-rose-600" />
                  (-) MENOS: Partidas Acreditadas en Extracto y no Causadas en Libros
                </span>
                <span className="font-mono text-xs font-black">
                  -{formatMoneyExact(totalPartidasSuman)}
                </span>
              </div>

              <div className="space-y-1 pl-4 text-[11px]">
                <div className="flex items-center justify-between text-ink py-1 border-b border-rose-500/10">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold">• Rendimientos Financieros del Periodo en Extracto:</span>
                      <span className="rounded-full bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide border border-rose-300/60">
                        Partida Conciliatoria (Pendiente de Registrar)
                      </span>
                    </div>
                    <span className="block text-[10px] text-ink-muted">Abonados por el banco, a deducir del extracto para conciliar con libros contables</span>
                  </div>
                  <span className="font-mono font-black text-rose-700 dark:text-rose-400 whitespace-nowrap">
                    -{formatMoneyExact(summary.notasCreditoRendimientos || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-ink py-0.5 border-b border-rose-500/10">
                  <div>
                    <span className="font-medium">• Otros Abonos Bancarios pendientes de contabilizar:</span>
                    <span className="block text-[10px] text-ink-muted">Abonos directos pendientes de identificación</span>
                  </div>
                  <span className="font-mono font-bold text-ink whitespace-nowrap">
                    -{formatMoneyExact(summary.notasCreditoOperativas || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-ink py-0.5">
                  <div>
                    <span className="font-medium">• Cheques y Giros en Tránsito (Girados y no Cobrados):</span>
                    <span className="block text-[10px] text-ink-muted">Ya deducidos en libros, pendientes de débito en banco</span>
                  </div>
                  <span className="font-mono font-bold text-ink whitespace-nowrap">
                    -{formatMoneyExact(summary.chequesEnTransito || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. (+) Partidas de Débito que Faltan en Libros (GMF / Comisiones) */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/15 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-400 font-bold text-[11px] uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="size-3.5 text-emerald-600" />
                  (+) MÁS: Partidas Debitadas en Extracto y no Causadas en Libros
                </span>
                <span className="font-mono text-xs font-black">
                  +{formatMoneyExact(totalPartidasRestan)}
                </span>
              </div>

              <div className="space-y-1 pl-4 text-[11px]">
                <div className="flex items-center justify-between text-ink py-0.5 border-b border-emerald-500/10">
                  <div>
                    <span className="font-medium">• Gravamen a los Movimientos Financieros (GMF 4×1000):</span>
                    <span className="block text-[10px] text-ink-muted">Cargado en banco, pendiente de asiento en libros</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    +{formatMoneyExact(summary.notasDebitoGmf || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-ink py-0.5 border-b border-emerald-500/10">
                  <div>
                    <span className="font-medium">• Comisiones y Gastos Bancarios:</span>
                    <span className="block text-[10px] text-ink-muted">Cargados en extracto, pendientes de causar</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                    +{formatMoneyExact(summary.notasDebitoComisiones || 0)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-ink py-0.5">
                  <div>
                    <span className="font-medium">• Consignaciones en Tránsito:</span>
                    <span className="block text-[10px] text-ink-muted">Acreditadas en libros, pendientes de cobro por banco</span>
                  </div>
                  <span className="font-mono font-bold text-ink whitespace-nowrap">
                    +{formatMoneyExact(summary.consignacionesEnTransito || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Confrontación Final contra Libros */}
            <div className="pt-1.5 space-y-1.5">
              <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-teal-soft/30 border border-teal/40 font-bold text-ink">
                <span className="text-teal-deep dark:text-teal font-extrabold">
                  (=) Saldo Bancario Ajustado al Libro Contable:
                </span>
                <span className="font-mono font-black text-sm text-teal-deep dark:text-teal">
                  ${formatMoneyExact(saldoBancoAjustadoALibros)}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 px-3 rounded-lg border border-line text-ink font-semibold">
                <span className="text-ink-muted">
                  (=) Saldo Final según Libro Auxiliar de Bancos al Cierre:
                </span>
                <span className="font-mono font-bold text-ink">
                  ${formatMoneyExact(summary.saldoLibros)}
                </span>
              </div>

              {/* Banner de Diferencia Neta de la Cédula (Banco a Libros) */}
              <div
                className={cn(
                  "flex items-center justify-between py-2.5 px-3.5 rounded-xl border text-xs font-bold transition",
                  difBancoALibros < 0.05
                    ? "border-emerald-500/60 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                    : "border-amber-500/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
                )}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-black text-sm">
                    {difBancoALibros < 0.05 ? (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>CONCILIACIÓN CUADRADA AL 100%</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>DIFERENCIA NETA PENDIENTE</span>
                      </>
                    )}
                  </div>
                  {difBancoALibros < 0.05 && (
                    <div className="text-[10px] font-normal text-emerald-800/90 dark:text-emerald-300/90">
                      {isSoloRend
                        ? `Al deducir del extracto los rendimientos pendientes de registro (-${formatMoneyExact(summary.notasCreditoRendimientos || 0)}), el saldo concilia exactamente con los libros contables ($0,00 de diferencia neta).`
                        : "Al aplicar las partidas conciliatorias identificadas, el extracto concilia con exactitud matemática al 100% con los libros contables."}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-[10px] text-ink-muted uppercase">Diferencia Neta:</span>
                  <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300">
                    ${formatMoneyExact(difBancoALibros)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MÉTODO 3: SALDOS AJUSTADOS (SIMULTÁNEO) */}
        {metodoFormato === "saldos_ajustados" && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Columna A: Lado Libros Contables */}
              <div className="rounded-xl border border-line bg-bg-subtle/30 p-3 space-y-2">
                <div className="font-bold text-ink flex items-center justify-between pb-1 border-b border-line">
                  <span className="flex items-center gap-1.5 text-teal">
                    <BookOpen className="size-3.5" />
                    Lado Contable (Libros)
                  </span>
                  <span className="font-mono">${formatMoneyExact(summary.saldoLibros)}</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                    <span>(+) Rendimientos por causar:</span>
                    <span className="font-mono font-bold">+{formatMoneyExact(summary.notasCreditoNoRegistradas || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
                    <span>(-) Gastos bancarios (GMF/Com):</span>
                    <span className="font-mono font-bold">-{formatMoneyExact(summary.notasDebitoNoRegistradas || 0)}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-line flex items-center justify-between font-black text-teal">
                  <span>(=) Saldo Libros Ajustado:</span>
                  <span className="font-mono">${formatMoneyExact(saldoLibrosAjustado)}</span>
                </div>
              </div>

              {/* Columna B: Lado Extracto Bancario */}
              <div className="rounded-xl border border-line bg-bg-subtle/30 p-3 space-y-2">
                <div className="font-bold text-ink flex items-center justify-between pb-1 border-b border-line">
                  <span className="flex items-center gap-1.5 text-teal">
                    <Building2 className="size-3.5" />
                    Lado Bancario (Extracto)
                  </span>
                  <span className="font-mono">${formatMoneyExact(summary.saldoExtracto)}</span>
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                    <span>(+) Consignaciones en tránsito:</span>
                    <span className="font-mono font-bold">+{formatMoneyExact(summary.consignacionesEnTransito || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between text-rose-700 dark:text-rose-400">
                    <span>(-) Cheques en tránsito:</span>
                    <span className="font-mono font-bold">-{formatMoneyExact(summary.chequesEnTransito || 0)}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-line flex items-center justify-between font-black text-teal">
                  <span>(=) Saldo Banco Ajustado:</span>
                  <span className="font-mono">${formatMoneyExact(saldoBancoAjustado)}</span>
                </div>
              </div>
            </div>

            {/* Confrontación de ambos lados */}
            <div
              className={cn(
                "flex items-center justify-between py-2.5 px-3.5 rounded-xl border text-xs font-bold transition",
                difSaldosAjustados < 0.05
                  ? "border-emerald-500/60 bg-emerald-50/90 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                  : "border-amber-500/60 bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200"
              )}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-black text-sm">
                  {difSaldosAjustados < 0.05 ? (
                    <>
                      <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>CONCILIACIÓN COINCIDENTE EN AMBOS SALDOS AJUSTADOS</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>DIFERENCIA ENTRE SALDOS AJUSTADOS</span>
                    </>
                  )}
                </div>
                {difSaldosAjustados < 0.05 && (
                  <div className="text-[10px] font-normal text-emerald-800/90 dark:text-emerald-300/90">
                    Al aplicar las partidas conciliatorias respectivas a cada lado, ambos saldos ajustados concilian al centavo con exactitud matemática ($0,00 de diferencia).
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="block text-[10px] text-ink-muted uppercase">Diferencia Neta:</span>
                <span className="font-mono font-black text-sm text-emerald-700 dark:text-emerald-300">
                  ${formatMoneyExact(difSaldosAjustados)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

