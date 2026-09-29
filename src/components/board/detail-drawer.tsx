import { useEffect } from "react";
import { AlertTriangle, Check, Copy, Sparkles, X } from "lucide-react";
import { BadgeEstado } from "../badge-estado";
import { reviewOf, useConciliacion } from "@/lib/store";
import { daysAgo, formatDate, formatMoneyExact } from "@/lib/format";
import { getTaxInsight } from "@/lib/tax-insights";
import type { ConciliacionRow } from "@/lib/types";
import { cn } from "@/lib/cn";
import { CopyButton, Field } from "./board-utils";

export function DetailDrawer({
  row,
  onClose,
  onPrev,
  onNext,
}: {
  row: ConciliacionRow;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const review = useConciliacion((s) => reviewOf(s.reviews, row));
  const setReview = useConciliacion((s) => s.setReview);
  const markValidated = useConciliacion((s) => s.markValidated);
  const flash = useConciliacion((s) => s.flash);
  const dias = daysAgo(row.fecha);
  const insight = getTaxInsight(row);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
      if (e.key === "v" || e.key === "V") markValidated(row, "validada");
      if (e.key === "c" || e.key === "C") {
        if (row.cufe) {
          void navigator.clipboard.writeText(row.cufe);
          flash("CUFE copiado");
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [row, onClose, onPrev, onNext, markValidated, flash]);

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    flash("CUFE copiado");
  }

  const markedAt = review?.at
    ? new Date(review.at).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })
    : "";

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30 no-print" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-line bg-bg-elevated p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <BadgeEstado estado={row.estado} />
            <div className="flex items-center gap-2 mt-2">
              <h2 className="font-display text-2xl font-semibold select-text">{row.numero || "Sin número"}</h2>
              {row.numero && (
                <CopyButton
                  text={row.numero}
                  label="Copiar N° de documento"
                  successMessage={`N° de documento ${row.numero} copiado al portapapeles`}
                  className="rounded p-1 text-ink-subtle hover:bg-teal-soft hover:text-teal transition cursor-pointer"
                >
                  <Copy className="size-4" />
                </CopyButton>
              )}
            </div>
            <p className="text-sm text-ink-muted">{row.tipo}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 hover:bg-bg-subtle" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        {/* Card de Insight Tributario / Redondeo si existe */}
        {insight && (
          <div
            className={cn(
              "mb-4 rounded-xl border p-3.5 text-xs shadow-xs",
              insight.tipo === "trm_diferencia"
                ? "border-sky-300 bg-sky-50/90 text-sky-950"
                : insight.tipo === "comision_bancaria"
                ? "border-emerald-300 bg-emerald-50/90 text-emerald-950"
                : insight.tipo === "riesgo_fiscal_radian"
                ? "border-rose-300 bg-rose-50/95 text-rose-950 ring-1 ring-rose-200"
                : "border-amber-300 bg-amber-50/90 text-amber-950",
            )}
          >
            <div className="flex items-center gap-1.5 font-bold mb-1.5 text-sm">
              {insight.tipo === "riesgo_fiscal_radian" ? (
                <AlertTriangle className="size-4 shrink-0 text-rose-600" />
              ) : (
                <Sparkles className="size-4 shrink-0 text-current" />
              )}
              {insight.tipo === "riesgo_fiscal_radian" ? "Alerta Fiscal Preventiva:" : "Sugerencia Tributaria:"} {insight.etiqueta}
            </div>
            <p className="leading-relaxed opacity-95 text-xs">{insight.detalle}</p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
          <Field label="Grupo" value={row.grupo} />
          <Field
            label="Fecha"
            value={`${formatDate(row.fecha)}${dias != null ? ` · ${dias} días` : ""}`}
          />
          <Field label="NIT" value={row.nitContraparte} mono copyable />
          <Field label="Contraparte" value={row.nombreContraparte} copyable />
          <Field label="Total DIAN" value={formatMoneyExact(row.totalDian)} copyable />
          <Field label="Valor en libros" value={row.hits.length ? formatMoneyExact(row.totalSiigo) : "—"} copyable />
          <Field label="Diferencia" value={formatMoneyExact(row.diferencia)} />
          <Field label="Cruce" value={row.matchVia || "sin match"} copyable={Boolean(row.matchVia)} />
        </dl>
        {row.alerta ? (
          <p className="mt-4 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">{row.alerta}</p>
        ) : null}
        {row.linked.length ? (
          <div className="mt-4 rounded-xl border border-teal/20 bg-teal-soft/40 p-3.5 text-xs shadow-xs">
            <div className="flex items-center gap-1.5 font-bold mb-2.5">
              <span className="text-teal-deep font-extrabold text-sm">
                {row.estado === "solo_siigo" ? "📄 Facturas del Tercero en DIAN:" : "🔗 Documento Relacionado:"}
              </span>
            </div>
            <div className="space-y-2">
              {row.linked.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-3 bg-white p-3 rounded-lg border border-line shadow-2xs"
                >
                  <div>
                    <span className="font-bold text-ink text-sm block">{l.numero}</span>
                    <span className="text-ink-muted text-xs block mt-0.5">
                      {l.tipo} · {formatMoneyExact(l.total)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => useConciliacion.getState().select(l.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal text-white hover:bg-teal-deep text-xs font-bold shadow-xs cursor-pointer shrink-0 transition-all"
                  >
                    Ver Documento →
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {row.cufe ? (
          <button
            type="button"
            onClick={() => copy(row.cufe)}
            className="mt-4 flex items-start gap-2 text-left cursor-pointer"
          >
            <Copy className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" />
            <span className="break-all font-mono text-[11px] leading-relaxed text-ink-subtle">
              CUFE {row.cufe}
            </span>
          </button>
        ) : null}

        <div className="mt-5 rounded-xl border border-line bg-bg px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Control de Auditoría y Trazabilidad
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            Registre notas de auditoría y valide el documento. Al cargar el
            extracto contable actualizado, el cruce se confirmará automáticamente.
          </p>
          <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Notas de auditoría
          </label>
          <textarea
            value={review?.note ?? ""}
            onChange={(e) => setReview(row, { note: e.target.value })}
            rows={3}
            placeholder="Ej. Radicado en compras comprobante P-003, pendiente causación..."
            className="mt-1 w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-teal"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => markValidated(row, "validada")}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold cursor-pointer",
                review?.done && review.action === "validada"
                  ? "bg-ok-bg text-ok"
                  : "bg-teal text-bg-elevated",
              )}
            >
              <Check className="size-4" />
              {review?.done && review.action === "validada" ? "Validado" : "Validar documento"}
            </button>
            <button
              type="button"
              onClick={() => markValidated(row, "omitir")}
              className={cn(
                "inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold cursor-pointer",
                review?.done && review.action === "omitir"
                  ? "border-warn bg-warn-bg text-warn"
                  : "border-line text-ink-muted",
              )}
            >
              Omitir
            </button>
          </div>
          {review?.done && markedAt ? (
            <p className="mt-2 text-xs text-ink-subtle">
              {review.action === "omitir" ? "Omitido" : "Validado"} el {markedAt}. Atajo: V
            </p>
          ) : (
            <p className="mt-2 text-xs text-ink-subtle">Atajos: V validar · C copiar CUFE · ← →</p>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={!onPrev}
            onClick={onPrev}
            className="h-10 flex-1 rounded-lg border border-line text-sm disabled:opacity-40 cursor-pointer"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={!onNext}
            onClick={onNext}
            className="h-10 flex-1 rounded-lg border border-line text-sm disabled:opacity-40 cursor-pointer"
          >
            Siguiente
          </button>
        </div>

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          Líneas en contabilidad ({row.hits.length})
        </h3>
        {row.hits.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No aparece en el movimiento del mes. Hay que registrarla.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {row.hits.slice(0, 30).map((h, i) => (
              <li key={i} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-mono text-xs">{h.comprobante || h.cruce}</span>
                  <span className="tabular-nums">
                    {h.debito ? formatMoneyExact(h.debito) : formatMoneyExact(h.credito)}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-xs text-ink-muted">
                  {h.cuenta} · {h.descripcion || h.nombre}
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
