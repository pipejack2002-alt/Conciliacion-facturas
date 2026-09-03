import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, RefreshCw, X } from "lucide-react";
import { parseDianSheet, parseMovSheet, readWorkbook } from "@/lib/parse-excel";
import { formatMoneyExact } from "@/lib/format";
import { useConciliacion } from "@/lib/store";
import type { AuditDelta } from "@/lib/reviews";

export function ToastHost() {
  const toast = useConciliacion((s) => s.toast);
  const flash = useConciliacion((s) => s.flash);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => flash(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast, flash]);

  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center justify-end px-4 pointer-events-none animate-in fade-in-0 slide-in-from-bottom-5 duration-200">
      <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-900/95 border border-teal-500/40 px-4 py-3 text-sm font-medium text-white shadow-2xl shadow-black/50 backdrop-blur-md">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-400 text-slate-950 font-bold shadow-xs">
          <CheckCircle2 className="size-4 text-slate-950" />
        </div>
        <p className="max-w-xs sm:max-w-md leading-tight text-slate-100 font-semibold">{toast}</p>
        <button
          type="button"
          onClick={() => flash(null)}
          className="rounded p-1 text-slate-400 hover:text-white transition cursor-pointer"
          title="Cerrar notificación"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function DeltaBanner({ delta }: { delta: AuditDelta }) {
  const dismiss = useConciliacion((s) => s.dismissDelta);
  if (!delta.confirmed.length && !delta.newIssues.length && !delta.stillMarked.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-teal/30 bg-teal-soft px-4 py-3 text-sm text-teal-deep">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <div>
            {delta.confirmed.length ? (
              <p>
                <span className="font-semibold">
                  {delta.confirmed.length} ya salieron en el movimiento nuevo
                </span>
                : {delta.confirmed.map((c) => c.numero).join(", ")}. Las quitamos de la cola.
              </p>
            ) : null}
            {delta.newIssues.length ? (
              <p className={delta.confirmed.length ? "mt-1" : ""}>
                {delta.newIssues.length} documento{delta.newIssues.length === 1 ? "" : "s"} nuevo
                {delta.newIssues.length === 1 ? "" : "s"} en cola
                {delta.newIssues.length <= 6
                  ? `: ${delta.newIssues.map((c) => c.numero).join(", ")}`
                  : ""}
                .
              </p>
            ) : null}
            {delta.stillMarked.length ? (
              <p className="mt-1">
                Marcadas como validadas que aún no cruzan en libros:{" "}
                {delta.stillMarked.map((c) => c.numero).join(", ")}. Revisa el número de factura o el comprobante.
              </p>
            ) : null}
          </div>
        </div>
        <button type="button" onClick={dismiss} className="rounded-md p-1 hover:bg-bg-elevated" aria-label="Cerrar">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function ReplaceBar() {
  const replaceDian = useConciliacion((s) => s.replaceDian);
  const replaceMov = useConciliacion((s) => s.replaceMov);
  const setError = useConciliacion((s) => s.setError);
  const flash = useConciliacion((s) => s.flash);
  const dianRef = useRef<HTMLInputElement>(null);
  const movRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"dian" | "mov" | null>(null);

  async function onDian(file: File) {
    setBusy("dian");
    setError(null);
    try {
      const wb = await readWorkbook(file);
      const dian = parseDianSheet(wb);
      if (!dian.length) throw new Error("No pude leer documentos en el reporte DIAN.");
      replaceDian(dian, file.name);
      flash("Reporte DIAN actualizado. Recalculamos la conciliación.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer el DIAN.");
    } finally {
      setBusy(null);
      if (dianRef.current) dianRef.current.value = "";
    }
  }

  async function onMov(file: File) {
    setBusy("mov");
    setError(null);
    try {
      const wb = await readWorkbook(file);
      const mov = parseMovSheet(wb);
      if (!mov.length) throw new Error("No pude leer movimientos en el archivo contable.");
      replaceMov(mov, file.name);
      flash("Movimiento actualizado. Cruzamos de nuevo contra el DIAN.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer el movimiento.");
    } finally {
      setBusy(null);
      if (movRef.current) movRef.current.value = "";
    }
  }

  return (
    <div className="no-print mt-3 flex flex-wrap items-center gap-2 text-sm">
      <RefreshCw className="size-3.5 text-ink-subtle" />
      <span className="text-ink-muted">Re-auditar con Excel nuevo:</span>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => dianRef.current?.click()}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-3 font-medium hover:border-line-strong disabled:opacity-40"
      >
        <FileSpreadsheet className="size-3.5" />
        {busy === "dian" ? "Leyendo…" : "Actualizar DIAN"}
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={() => movRef.current?.click()}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-3 font-medium hover:border-line-strong disabled:opacity-40"
      >
        <FileSpreadsheet className="size-3.5" />
        {busy === "mov" ? "Leyendo…" : "Actualizar movimiento"}
      </button>
      <input
        ref={dianRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onDian(f);
        }}
      />
      <input
        ref={movRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onMov(f);
        }}
      />
    </div>
  );
}
