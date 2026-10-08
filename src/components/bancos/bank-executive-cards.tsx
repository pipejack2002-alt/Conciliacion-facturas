import { memo, useState } from "react";
import {
  BadgePercent,
  CreditCard,
  TrendingUp,
  Receipt,
  Layers,
  History,
  Sparkles,
  X,
} from "lucide-react";
import { formatMoneyExact, formatDate } from "@/lib/format";
import type { BankExecutiveBreakdown } from "@/lib/conciliar-bancos";
import { cn } from "@/lib/cn";

interface BankExecutiveCardsProps {
  breakdown: BankExecutiveBreakdown;
}

export const BankExecutiveCards = memo(function BankExecutiveCards({
  breakdown,
}: BankExecutiveCardsProps) {
  const [activeModal, setActiveModal] = useState<
    "gmf" | "comisiones" | "rendimientos" | "retenciones" | "lotesAch" | null
  >(null);
  const [rendimientoTab, setRendimientoTab] = useState<"actual" | "anterior">("actual");

  const hasPriorRend = (breakdown.rendimientos.periodoAnterior?.count || 0) > 0;
  const actualRend = breakdown.rendimientos.periodoActual || breakdown.rendimientos;
  const anteriorRend = breakdown.rendimientos.periodoAnterior;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* Card 1: GMF 4x1000 */}
        <div
          onClick={() => setActiveModal("gmf")}
          className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs hover:border-amber-500/40 transition cursor-pointer flex flex-col justify-between"
          title="Click para ver el desglose detallado de débitos por GMF 4x1000"
        >
          <div>
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
          </div>
          <div className="mt-2 text-[11px] text-ink-muted flex items-center justify-between pt-1 border-t border-line/40">
            <span>{breakdown.gmf.count} cargos bancarios</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              Reg: {formatMoneyExact(breakdown.gmf.registrado)}
            </span>
          </div>
        </div>

        {/* Card 2: Comisiones Banco */}
        <div
          onClick={() => setActiveModal("comisiones")}
          className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs hover:border-blue-500/40 transition cursor-pointer flex flex-col justify-between"
          title="Click para ver el desglose detallado de comisiones y tarifas"
        >
          <div>
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
          </div>
          <div className="mt-2 text-[11px] text-ink-muted flex items-center justify-between pt-1 border-t border-line/40">
            <span>{breakdown.comisiones.count} cargos y tarifas</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              Reg: {formatMoneyExact(breakdown.comisiones.registrado)}
            </span>
          </div>
        </div>

        {/* Card 3: Rendimientos Financieros (Separado: Periodo Actual vs Periodo Anterior) */}
        <div
          onClick={() => setActiveModal("rendimientos")}
          className={cn(
            "rounded-2xl border bg-bg-surface p-4 shadow-2xs hover:shadow-xs transition cursor-pointer flex flex-col justify-between",
            hasPriorRend ? "border-teal/50 bg-linear-to-b from-teal-soft/10 via-bg-surface to-bg-surface" : "border-line"
          )}
          title="Click para ver el desglose comparativo entre rendimientos del periodo actual y causaciones del periodo anterior"
        >
          <div>
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
                  actualRend.pendiente === 0 && actualRend.count > 0
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                    : actualRend.pendiente > 0
                    ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-bg-subtle text-ink-subtle border-line"
                )}
              >
                {actualRend.pendiente === 0 && actualRend.count > 0
                  ? "✓ 100% Contabilizado"
                  : actualRend.pendiente > 0
                  ? `⚠️ ${formatMoneyExact(actualRend.pendiente)} Por Causar`
                  : "Sin Rendimientos"}
              </span>
            </div>

            {/* Valor Principal: Rendimiento del Periodo Actual (Extracto) */}
            <div className="font-mono text-lg font-black text-teal">
              +{formatMoneyExact(actualRend.total)}
            </div>
            <div className="text-[11px] text-ink-muted flex items-center justify-between mt-0.5">
              <span>Periodo actual ({actualRend.count} abono)</span>
              {actualRend.pendiente > 0 && (
                <span className="text-amber-700 dark:text-amber-400 font-bold text-[10px]">
                  Falta causar: {formatMoneyExact(actualRend.pendiente)}
                </span>
              )}
            </div>

            {/* Subsección: Rendimientos del Periodo Anterior (Causación Libros que igualan saldo inicial) */}
            {hasPriorRend && anteriorRend && (
              <div className="mt-2.5 pt-2 border-t border-teal/20 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-teal">
                    <History className="size-3" />
                    Periodo Anterior (Libros):
                  </span>
                  <span className="font-mono font-bold text-ink">
                    +{formatMoneyExact(anteriorRend.total)}
                  </span>
                </div>
                <div className="space-y-1">
                  {anteriorRend.items.map((it, idx) => {
                    const val = it.montoBanco > 0 ? it.montoBanco : it.montoLibros;
                    const ctaName =
                      it.itemLibros?.cuentaNombre ||
                      it.itemLibros?.cuenta ||
                      it.referencia ||
                      "Rendimiento anterior";
                    const comp = it.itemLibros?.comprobante || `Subcuenta ${idx + 1}`;
                    return (
                      <div
                        key={it.id}
                        className="flex items-center justify-between text-[10px] bg-teal-soft/25 dark:bg-teal-soft/10 px-2 py-0.5 rounded border border-teal/15"
                      >
                        <span className="truncate max-w-[155px] text-ink font-medium" title={it.descripcion}>
                          • {comp}: {ctaName}
                        </span>
                        <span className="font-mono font-bold text-teal whitespace-nowrap">
                          +{formatMoneyExact(val)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="mt-2 text-[10px] text-ink-muted flex items-center justify-between pt-1 border-t border-line/40">
            <span>
              {hasPriorRend
                ? "Separados por periodo"
                : `${breakdown.rendimientos.count} abonos de intereses`}
            </span>
            <span className="font-semibold text-teal hover:underline flex items-center gap-0.5">
              Ver detalle →
            </span>
          </div>
        </div>

        {/* Card 4: Retención en la Fuente (-) */}
        <div
          onClick={() => setActiveModal("retenciones")}
          className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs hover:border-rose-500/40 transition cursor-pointer flex flex-col justify-between"
          title="Click para ver el desglose detallado de retenciones en la fuente deducidas en el extracto"
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-rose-500/10 p-1.5 text-rose-600 dark:text-rose-400">
                  <Receipt className="size-4" />
                </span>
                <span className="text-xs font-bold text-ink uppercase tracking-wider">
                  Retención en la Fuente (-)
                </span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-extrabold border",
                  breakdown.retenciones.pendiente === 0 && breakdown.retenciones.count > 0
                    ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                    : breakdown.retenciones.pendiente > 0
                    ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-bg-subtle text-ink-subtle border-line"
                )}
              >
                {breakdown.retenciones.pendiente === 0 && breakdown.retenciones.count > 0
                  ? "✓ 100% Contabilizado"
                  : breakdown.retenciones.pendiente > 0
                  ? `⚠️ ${formatMoneyExact(breakdown.retenciones.pendiente)} Por Registrar`
                  : "Sin Movimientos"}
              </span>
            </div>
            <div className="font-mono text-lg font-black text-rose-600 dark:text-rose-400">
              {breakdown.retenciones.total > 0
                ? `-${formatMoneyExact(breakdown.retenciones.total)}`
                : formatMoneyExact(0)}
            </div>
          </div>
          <div className="mt-2 text-[11px] text-ink-muted flex items-center justify-between pt-1 border-t border-line/40">
            <span>{breakdown.retenciones.count} retenciones</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              Reg: {formatMoneyExact(breakdown.retenciones.registrado)}
            </span>
          </div>
        </div>

        {/* Card 5: Lotes ACH y Pagos Masivos */}
        <div
          onClick={() => setActiveModal("lotesAch")}
          className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs hover:border-purple-500/40 transition cursor-pointer flex flex-col justify-between"
          title="Click para ver el desglose de lotes agrupados ACH"
        >
          <div>
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
          </div>
          <div className="mt-2 text-[11px] text-ink-muted flex items-center justify-between pt-1 border-t border-line/40">
            <span>{breakdown.lotesAch.countComprobantes} comprobantes agrupados</span>
            <span className="font-black text-emerald-700 dark:text-emerald-400">
              Diferencia $0,00
            </span>
          </div>
        </div>
      </div>

      {/* Modal de Detalle Interactivo de Conceptos */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
          <div className="bg-bg-surface border border-line rounded-2xl max-w-2xl w-full p-5 shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div className="flex items-center gap-2">
                {activeModal === "gmf" && (
                  <>
                    <span className="rounded-lg bg-amber-500/10 p-1.5 text-amber-600">
                      <BadgePercent className="size-5" />
                    </span>
                    <h3 className="font-bold text-base text-ink">
                      Detalle de Gravamen a los Movimientos Financieros (GMF 4×1000)
                    </h3>
                  </>
                )}
                {activeModal === "comisiones" && (
                  <>
                    <span className="rounded-lg bg-blue-500/10 p-1.5 text-blue-600">
                      <CreditCard className="size-5" />
                    </span>
                    <h3 className="font-bold text-base text-ink">
                      Detalle de Comisiones Bancarias y Tarifas
                    </h3>
                  </>
                )}
                {activeModal === "rendimientos" && (
                  <>
                    <span className="rounded-lg bg-teal-500/10 p-1.5 text-teal">
                      <TrendingUp className="size-5" />
                    </span>
                    <h3 className="font-bold text-base text-ink">
                      Desglose Separado de Rendimientos Financieros
                    </h3>
                  </>
                )}
                {activeModal === "retenciones" && (
                  <>
                    <span className="rounded-lg bg-rose-500/10 p-1.5 text-rose-600 dark:text-rose-400">
                      <Receipt className="size-5" />
                    </span>
                    <h3 className="font-bold text-base text-ink">
                      Detalle de Retención en la Fuente Deducida en Extracto
                    </h3>
                  </>
                )}
                {activeModal === "lotesAch" && (
                  <>
                    <span className="rounded-lg bg-purple-500/10 p-1.5 text-purple-600">
                      <Layers className="size-5" />
                    </span>
                    <h3 className="font-bold text-base text-ink">
                      Auditoría de Lotes ACH y Pagos Masivos
                    </h3>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-lg p-1 text-ink-muted hover:text-ink hover:bg-bg-subtle transition cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Contenido según Modal */}
            <div className="overflow-y-auto py-3 space-y-3 grow">
              {activeModal === "rendimientos" && (
                <div className="space-y-3">
                  {/* Selector de Pestañas entre Periodo Actual y Periodo Anterior */}
                  <div className="flex items-center gap-2 border-b border-line pb-2">
                    <button
                      type="button"
                      onClick={() => setRendimientoTab("actual")}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                        rendimientoTab === "actual"
                          ? "bg-teal text-white shadow-2xs"
                          : "bg-bg-subtle text-ink-muted hover:text-ink"
                      )}
                    >
                      <Sparkles className="size-3.5" />
                      <span>Periodo Actual (Extracto: {formatMoneyExact(actualRend.total)})</span>
                    </button>
                    {hasPriorRend && anteriorRend && (
                      <button
                        type="button"
                        onClick={() => setRendimientoTab("anterior")}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer",
                          rendimientoTab === "anterior"
                            ? "bg-teal text-white shadow-2xs"
                            : "bg-bg-subtle text-ink-muted hover:text-ink"
                        )}
                      >
                        <History className="size-3.5" />
                        <span>Periodo Anterior (Libros: {formatMoneyExact(anteriorRend.total)})</span>
                      </button>
                    )}
                  </div>

                  {rendimientoTab === "actual" ? (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-teal-soft/20 border border-teal/30 text-xs">
                        <span className="font-bold text-teal block mb-0.5">
                          Rendimientos generados en el mes actual (Abonados en Extracto):
                        </span>
                        <p className="text-ink-muted text-[11px]">
                          Corresponden a los intereses generados por el banco durante el periodo. Si están pendientes de causar, se registrarán en la contabilidad al cierre del mes o en el periodo siguiente.
                        </p>
                      </div>
                      <div className="divide-y divide-line/60 rounded-xl border border-line overflow-hidden">
                        {actualRend.items.map((r) => (
                          <div key={r.id} className="p-3 text-xs flex items-center justify-between bg-bg-surface hover:bg-bg-subtle/50 transition">
                            <div>
                              <div className="font-bold text-ink">{r.descripcion}</div>
                              <div className="text-[11px] text-ink-muted flex items-center gap-2 mt-0.5">
                                <span>Fecha: {formatDate(r.fecha)}</span>
                                <span>Ref: {r.referencia || "—"}</span>
                                <span className={cn("px-1.5 py-0.2 rounded text-[10px] font-bold", r.estado === "conciliado" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
                                  {r.estado === "conciliado" ? "Contabilizado" : "Pendiente de Causar"}
                                </span>
                              </div>
                            </div>
                            <div className="font-mono font-black text-sm text-teal">
                              +{formatMoneyExact(r.montoBanco > 0 ? r.montoBanco : r.montoLibros)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="p-3 rounded-xl bg-teal-soft/20 border border-teal/30 text-xs">
                        <span className="font-bold text-teal block mb-0.5">
                          Causaciones del Periodo Anterior registradas en libros:
                        </span>
                        <p className="text-ink-muted text-[11px]">
                          Estos valores fueron causados en la contabilidad al inicio de este mes para reflejar los rendimientos devengados en el mes anterior, los cuales ya se encontraban incluidos en el saldo inicial del extracto bancario.
                        </p>
                      </div>
                      <div className="divide-y divide-line/60 rounded-xl border border-line overflow-hidden">
                        {anteriorRend?.items.map((r) => (
                          <div key={r.id} className="p-3 text-xs flex items-center justify-between bg-bg-surface hover:bg-bg-subtle/50 transition">
                            <div>
                              <div className="font-bold text-ink">{r.itemLibros?.descripcion || r.descripcion}</div>
                              <div className="text-[11px] text-ink-muted flex items-center gap-2 mt-0.5">
                                <span>Fecha: {formatDate(r.fecha)}</span>
                                <span>Comprobante: {r.itemLibros?.comprobante || r.referencia}</span>
                                <span>Cuenta: {r.itemLibros?.cuenta} ({r.itemLibros?.cuentaNombre})</span>
                              </div>
                            </div>
                            <div className="font-mono font-black text-sm text-teal">
                              +{formatMoneyExact(r.montoLibros)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeModal === "gmf" && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                    <span className="font-bold text-amber-800 dark:text-amber-400 block mb-0.5">
                      Gravamen a los Movimientos Financieros (4×1000):
                    </span>
                    <p className="text-ink-muted text-[11px]">
                      Impuesto gubernamental debitado automáticamente por la entidad sobre los retiros y traslados financieros.
                    </p>
                  </div>
                  <div className="divide-y divide-line/60 rounded-xl border border-line overflow-hidden max-h-96 overflow-y-auto">
                    {breakdown.gmf.items.map((r) => (
                      <div key={r.id} className="p-3 text-xs flex items-center justify-between bg-bg-surface hover:bg-bg-subtle/50 transition">
                        <div>
                          <div className="font-bold text-ink">{r.descripcion}</div>
                          <div className="text-[11px] text-ink-muted flex items-center gap-2 mt-0.5">
                            <span>Fecha: {formatDate(r.fecha)}</span>
                            <span>Ref: {r.referencia || "—"}</span>
                          </div>
                        </div>
                        <div className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                          -{formatMoneyExact(r.montoBanco > 0 ? r.montoBanco : r.montoLibros)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === "comisiones" && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
                    <span className="font-bold text-blue-800 dark:text-blue-400 block mb-0.5">
                      Comisiones y Gastos Bancarios:
                    </span>
                    <p className="text-ink-muted text-[11px]">
                      Costos por transferencias interbancarias, cuotas de manejo, emisión de chequeras o servicios de plataforma.
                    </p>
                  </div>
                  <div className="divide-y divide-line/60 rounded-xl border border-line overflow-hidden max-h-96 overflow-y-auto">
                    {breakdown.comisiones.items.map((r) => (
                      <div key={r.id} className="p-3 text-xs flex items-center justify-between bg-bg-surface hover:bg-bg-subtle/50 transition">
                        <div>
                          <div className="font-bold text-ink">{r.descripcion}</div>
                          <div className="text-[11px] text-ink-muted flex items-center gap-2 mt-0.5">
                            <span>Fecha: {formatDate(r.fecha)}</span>
                            <span>Ref: {r.referencia || "—"}</span>
                          </div>
                        </div>
                        <div className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                          -{formatMoneyExact(r.montoBanco > 0 ? r.montoBanco : r.montoLibros)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeModal === "retenciones" && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                    <span className="font-bold text-rose-800 dark:text-rose-400 block mb-0.5">
                      Retención en la Fuente Deducida en Extracto:
                    </span>
                    <p className="text-ink-muted text-[11px]">
                      Deducciones fiscales aplicadas por la entidad financiera o fiduciaria (ej. 7% sobre rendimientos de inversiones o traslados). Si figura pendiente, se debe causar en libros como anticipo de impuestos (PUC 135515) acreditando la cuenta bancaria.
                    </p>
                  </div>
                  <div className="divide-y divide-line/60 rounded-xl border border-line overflow-hidden max-h-96 overflow-y-auto">
                    {breakdown.retenciones.items.length === 0 ? (
                      <div className="p-4 text-center text-xs text-ink-muted">
                        No se detectaron movimientos de retención en la fuente en este extracto o auxiliar contable.
                      </div>
                    ) : (
                      breakdown.retenciones.items.map((r) => (
                        <div key={r.id} className="p-3 text-xs flex items-center justify-between bg-bg-surface hover:bg-bg-subtle/50 transition">
                          <div>
                            <div className="font-bold text-ink">{r.descripcion}</div>
                            <div className="text-[11px] text-ink-muted flex items-center gap-2 mt-0.5">
                              <span>Fecha: {formatDate(r.fecha)}</span>
                              <span>Ref / Comp: {r.referencia || r.itemLibros?.comprobante || "—"}</span>
                              <span
                                className={cn(
                                  "px-1.5 py-0.2 rounded text-[10px] font-bold",
                                  r.estado === "conciliado"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                )}
                              >
                                {r.estado === "conciliado" ? "Contabilizado" : "Pendiente por Registrar"}
                              </span>
                            </div>
                          </div>
                          <div className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                            -{formatMoneyExact(r.montoBanco > 0 ? r.montoBanco : r.montoLibros)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeModal === "lotesAch" && (
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs">
                    <span className="font-bold text-purple-800 dark:text-purple-400 block mb-0.5">
                      Lotes ACH y Pagos Agrupados:
                    </span>
                    <p className="text-ink-muted text-[11px]">
                      Débitos bancarios masivos compensados contra múltiples comprobantes individuales registrados en libros con cuadre exacto al centavo ($0,00).
                    </p>
                  </div>
                  <div className="divide-y divide-line/60 rounded-xl border border-line overflow-hidden max-h-96 overflow-y-auto">
                    {breakdown.lotesAch.items.map((r) => (
                      <div key={r.id} className="p-3 text-xs flex flex-col gap-1.5 bg-bg-surface hover:bg-bg-subtle/50 transition">
                        <div className="flex items-center justify-between">
                          <div className="font-bold text-ink">{r.descripcion}</div>
                          <div className="font-mono font-black text-sm text-ink">
                            {formatMoneyExact(r.montoBanco)}
                          </div>
                        </div>
                        <div className="text-[11px] text-ink-muted">
                          {r.itemsLibrosLote?.length || 0} comprobantes agrupados:{" "}
                          <span className="font-mono font-medium text-ink">
                            {r.itemsLibrosLote?.map((c) => c.comprobante).filter(Boolean).slice(0, 6).join(", ")}
                            {(r.itemsLibrosLote?.length || 0) > 6 ? "..." : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-line flex justify-end">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 rounded-xl bg-bg-subtle border border-line text-xs font-bold text-ink hover:bg-line transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

