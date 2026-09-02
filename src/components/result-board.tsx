import { useEffect, useMemo, useState, useCallback } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  Copy,
  Download,
  FileCheck,
  FileSpreadsheet,
  Layers,
  Percent,
  Printer,
  Search,
  Users,
  X,
  Award,
  Sparkles,
  Keyboard,
  Filter,
} from "lucide-react";
import { BadgeEstado } from "./badge-estado";
import { DeltaBanner, ReplaceBar } from "./audit-chrome";
import { reviewOf, useConciliacion, type Review, type TabId } from "@/lib/store";
import { daysAgo, formatDate, formatMoney, formatMoneyExact } from "@/lib/format";
import { ESTADO_LABEL, inCola } from "@/lib/conciliar";
import { exportAuditoriaXlsx } from "@/lib/export-excel";
import { exportSiigoTemplateXlsx } from "@/lib/export-siigo";
import { HistoryModal } from "./history-modal";
import { TaxSummaryModal } from "./tax-summary-modal";
import { ExecutiveReportModal } from "./executive-report-modal";
import { NominaAuditModal } from "./nomina-audit-modal";
import { ActaConciliacionModal } from "./acta-conciliacion-modal";
import { getTaxInsight, type TaxInsight } from "@/lib/tax-insights";
import type { ConciliacionResult, ConciliacionRow, EstadoConciliacion } from "@/lib/types";
import { cn } from "@/lib/cn";
import { KpiRow } from "./kpi-row";

const TABS: { id: TabId; label: string }[] = [
  { id: "cola", label: "Cola" },
  { id: "pendiente", label: "Por registrar" },
  { id: "posible_typo", label: "Revisar factura" },
  { id: "totalizado", label: "Totalizados" },
  { id: "duplicado", label: "Dobles" },
  { id: "diferencia", label: "Diferencias" },
  { id: "cruce_nc", label: "Cruces NC" },
  { id: "conciliado", label: "Registrados" },
  { id: "emitidos", label: "Emitidos" },
  { id: "todos", label: "Todos" },
  { id: "solo_siigo", label: "Solo libros" },
];

type MaterialidadFilter = "todos" | "altos" | "con_sugerencia" | "sin_revisar";

const RANK: Record<string, number> = {
  duplicado: 0,
  diferencia: 1,
  pendiente: 2,
  posible_typo: 3,
  cruce_nc: 4,
  totalizado: 5,
  conciliado: 6,
  solo_siigo: 7,
  no_aplica: 8,
};

export function ResultBoard() {
  const result = useConciliacion((s) => s.result);
  const query = useConciliacion((s) => s.query);
  const setQuery = useConciliacion((s) => s.setQuery);
  const tab = useConciliacion((s) => s.tab);
  const setTab = useConciliacion((s) => s.setTab);
  const sort = useConciliacion((s) => s.sort);
  const setSort = useConciliacion((s) => s.setSort);
  const groupByProveedor = useConciliacion((s) => s.groupByProveedor);
  const toggleGroup = useConciliacion((s) => s.toggleGroup);
  const hideRevisados = useConciliacion((s) => s.hideRevisados);
  const toggleHideRevisados = useConciliacion((s) => s.toggleHideRevisados);
  const reviews = useConciliacion((s) => s.reviews);
  const selectedId = useConciliacion((s) => s.selectedId);
  const select = useConciliacion((s) => s.select);
  const reset = useConciliacion((s) => s.reset);
  const dianName = useConciliacion((s) => s.dianName);
  const movName = useConciliacion((s) => s.movName);
  const delta = useConciliacion((s) => s.delta);
  const markValidated = useConciliacion((s) => s.markValidated);
  const flash = useConciliacion((s) => s.flash);
  const error = useConciliacion((s) => s.error);
  const loadHistorySession = useConciliacion((s) => s.loadHistorySession);

  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showNominaModal, setShowNominaModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showActaModal, setShowActaModal] = useState(false);
  const [materialidad, setMaterialidad] = useState<MaterialidadFilter>("todos");
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  const counts = useMemo(() => {
    if (!result) return {} as Record<TabId, number>;
    const rows = result.rows.filter((r) => r.estado !== "no_aplica");
    return {
      cola: result.totals.cola,
      pendiente: result.totals.pendientesRecibidos,
      posible_typo: rows.filter((r) => r.estado === "posible_typo").length,
      totalizado: result.totals.totalizados,
      duplicado: result.totals.duplicados,
      diferencia: result.totals.diferencias,
      cruce_nc: result.totals.crucesNc,
      conciliado: rows.filter((r) => r.estado === "conciliado").length,
      emitidos: rows.filter((r) => r.grupo === "Emitido").length,
      todos: rows.length,
      solo_siigo: result.orphans.length,
    } satisfies Record<TabId, number>;
  }, [result]);

  const filtered = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    let list = result.rows.filter((r) => {
      if (r.estado === "no_aplica") return false;
      if (tab === "solo_siigo") return false;
      if (tab === "cola") {
        if (!inCola(r)) return false;
      } else if (tab === "pendiente") {
        if (r.prioridad !== "audit" || r.estado !== "pendiente") return false;
      } else if (tab === "posible_typo") {
        if (r.estado !== "posible_typo") return false;
      } else if (tab === "emitidos") {
        if (r.grupo !== "Emitido") return false;
      } else if (tab === "cruce_nc") {
        if (r.estado !== "cruce_nc" && r.linked.length === 0) return false;
      } else if (tab !== "todos" && r.estado !== tab) {
        return false;
      }
      if (hideRevisados && reviewOf(reviews, r)?.done) return false;

      // Filtro de Materialidad
      if (materialidad === "altos" && r.totalDian < 5000000) return false;
      if (materialidad === "con_sugerencia" && !getTaxInsight(r)) return false;
      if (materialidad === "sin_revisar" && reviewOf(reviews, r)?.done) return false;

      if (!q) return true;
      return (
        r.numero.toLowerCase().includes(q) ||
        r.nombreContraparte.toLowerCase().includes(q) ||
        r.nitContraparte.includes(q) ||
        r.tipo.toLowerCase().includes(q) ||
        r.cufe.toLowerCase().includes(q) ||
        r.comprobantes.join(" ").toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === "monto") return b.totalDian - a.totalDian;
      if (sort === "fecha") return (a.fecha || "").localeCompare(b.fecha || "");
      if (sort === "proveedor") return (a.nombreContraparte || "").localeCompare(b.nombreContraparte || "", "es");
      const ra = RANK[a.estado] ?? 9;
      const rb = RANK[b.estado] ?? 9;
      if (ra !== rb) return ra - rb;
      return b.totalDian - a.totalDian;
    });
    return list;
  }, [result, query, tab, sort, hideRevisados, reviews, materialidad]);

  const groups = useMemo(() => {
    if (!groupByProveedor) return null;
    const map = new Map<string, ConciliacionRow[]>();
    for (const r of filtered) {
      const k = r.nitContraparte || r.nombreContraparte || "Sin NIT";
      const arr = map.get(k) || [];
      arr.push(r);
      map.set(k, arr);
    }
    return [...map.entries()]
      .map(([nit, rows]) => ({
        nit,
        nombre: rows[0]?.nombreContraparte || "—",
        rows,
        total: rows.reduce((s, r) => s + r.totalDian, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, groupByProveedor]);

  const selected = result?.rows.find((r) => r.id === selectedId) ?? null;
  const selectedIndex = filtered.findIndex((r) => r.id === selectedId);

  // Atajos globales de teclado
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        if (e.key === "Escape") {
          (e.target as HTMLElement)?.blur();
        }
        return;
      }

      if (e.key === "Escape") {
        if (selectedId) select(null);
        if (showShortcutsHelp) setShowShortcutsHelp(false);
      } else if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        if (filtered.length === 0) return;
        if (selectedIndex === -1 || selectedIndex >= filtered.length - 1) {
          select(filtered[0].id);
        } else {
          select(filtered[selectedIndex + 1].id);
        }
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        if (filtered.length === 0) return;
        if (selectedIndex <= 0) {
          select(filtered[filtered.length - 1].id);
        } else {
          select(filtered[selectedIndex - 1].id);
        }
      } else if ((e.key === "v" || e.key === "V" || e.key === " ") && selected) {
        e.preventDefault();
        const isDone = reviewOf(reviews, selected)?.done;
        markValidated(selected, isDone ? "omitir" : "validada");
        flash(isDone ? "Documento desmarcado" : "✅ Documento validado");
      } else if (e.key === "?") {
        setShowShortcutsHelp((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filtered, selectedIndex, selected, selectedId, reviews, select, markValidated, flash, showShortcutsHelp]);

  if (!result) return null;

  const sumaDian = filtered.reduce((s, r) => s + r.totalDian, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-muted">
        <div>
          <span className="font-medium text-ink">{result.company.nombre}</span>
          <span className="mx-2 font-mono text-xs">{result.company.nit}</span>
          <span className="text-line-strong">·</span>
          <span className="ml-2">{dianName}</span>
          <span className="mx-2 text-line-strong">·</span>
          <span>{movName}</span>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          {/* Botón Acta Formal */}
          <button
            type="button"
            onClick={() => setShowActaModal(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-teal/40 bg-teal/10 px-3 text-xs font-semibold text-teal hover:bg-teal hover:text-bg-elevated transition shadow-sm"
            title="Generar Acta formal de conciliación con firmas de Contador y Revisor Fiscal"
          >
            <Award className="size-3.5" />
            Acta Oficial
          </button>

          {/* Botón Informe Ejecutivo */}
          <button
            type="button"
            onClick={() => setShowReportModal(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-3 text-xs font-medium text-ink hover:border-line-strong transition"
          >
            <FileCheck className="size-3.5 text-teal" />
            Informe Ejecutivo
          </button>

          {/* Botón Historial de Sesiones */}
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-3 text-xs font-medium text-ink hover:border-line-strong transition"
          >
            <Building2 className="size-3.5 text-teal" />
            Historial
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-3 text-xs font-medium hover:border-line-strong"
          >
            <Printer className="size-3.5" />
            Imprimir
          </button>

          <div className="inline-flex rounded-lg border border-line bg-bg-elevated p-0.5">
            <button
              type="button"
              onClick={() => {
                exportAuditoriaXlsx(tab === "solo_siigo" ? [] : filtered, result, tab, reviews);
                flash("Descargando reporte en Excel (.xlsx)...");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium hover:bg-teal-soft/50 hover:text-teal"
              title="Descargar libro de Excel formateado con causas tributarias"
            >
              <FileSpreadsheet className="size-3.5 text-ok" />
              Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => {
                exportCsv(tab === "solo_siigo" ? [] : filtered, result, tab);
                flash("Descargando archivo CSV...");
              }}
              className="inline-flex h-8 items-center gap-1 rounded-md border-l border-line px-2 text-xs font-medium text-ink-muted hover:bg-teal-soft/50 hover:text-teal"
              title="Descargar datos en formato CSV plano"
            >
              <Download className="size-3" />
              CSV
            </button>
          </div>

          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center rounded-lg px-2.5 text-xs font-medium text-ink-muted hover:text-ink"
          >
            Nueva auditoría
          </button>
        </div>
      </div>

      <ReplaceBar />
      {error ? (
        <p className="mt-3 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}
      {result.periodWarning ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-warn/40 bg-warn-bg px-4 py-3 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="leading-snug">{result.periodWarning}</div>
        </div>
      ) : null}
      {delta ? <DeltaBanner delta={delta} /> : null}

      <KpiRow result={result} onSelectTab={setTab} />

      <div className="mt-6 flex flex-col gap-3 no-print">
        {/* Pestañas de estado */}
        <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-bg-elevated p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium sm:px-3",
                tab === t.id ? "bg-teal text-bg-elevated" : "text-ink-muted hover:text-ink",
              )}
            >
              {t.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  tab === t.id ? "bg-bg/20" : "bg-bg-subtle text-ink-subtle",
                )}
              >
                {counts[t.id] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <label className="relative min-w-44 flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar NIT, proveedor, N° factura…"
                className="h-9 w-full rounded-lg border border-line bg-bg-elevated pl-9 pr-3 text-xs outline-none focus:border-teal"
              />
            </label>

            {/* Píldoras de Filtro por Materialidad */}
            <div className="flex items-center gap-1 rounded-lg border border-line bg-bg-elevated p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMaterialidad("todos")}
                className={cn(
                  "rounded px-2 py-1 font-medium transition",
                  materialidad === "todos" ? "bg-teal text-bg-elevated font-semibold" : "text-ink-muted hover:text-ink",
                )}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setMaterialidad("altos")}
                className={cn(
                  "rounded px-2 py-1 font-medium transition",
                  materialidad === "altos" ? "bg-teal text-bg-elevated font-semibold" : "text-ink-muted hover:text-ink",
                )}
                title="Filtrar facturas de monto mayor o igual a $5.000.000 COP"
              >
                ≥ $5M
              </button>
              <button
                type="button"
                onClick={() => setMaterialidad("con_sugerencia")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-1 font-medium transition",
                  materialidad === "con_sugerencia" ? "bg-teal text-bg-elevated font-semibold" : "text-ink-muted hover:text-ink",
                )}
                title="Filtrar partidas con causas tributarias detectadas (Retefuente, IVA, Redondeo)"
              >
                <Sparkles className="size-3 text-amber-500" />
                Con Sugerencia
              </button>
              <button
                type="button"
                onClick={() => setMaterialidad("sin_revisar")}
                className={cn(
                  "rounded px-2 py-1 font-medium transition",
                  materialidad === "sin_revisar" ? "bg-teal text-bg-elevated font-semibold" : "text-ink-muted hover:text-ink",
                )}
                title="Mostrar únicamente documentos sin validar"
              >
                Sin Validar
              </button>
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-9 rounded-lg border border-line bg-bg-elevated px-2.5 text-xs text-ink outline-none"
            >
              <option value="prioridad">Ordenar: Prioridad</option>
              <option value="monto">Ordenar: Monto mayor</option>
              <option value="fecha">Ordenar: Fecha</option>
              <option value="proveedor">Ordenar: Proveedor</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleGroup}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition",
                groupByProveedor ? "border-teal bg-teal-soft/60 text-teal font-semibold" : "border-line bg-bg-elevated text-ink-muted hover:text-ink",
              )}
            >
              <Users className="size-3.5" />
              Agrupar proveedor
            </button>

            <button
              type="button"
              onClick={toggleHideRevisados}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition",
                hideRevisados ? "border-teal bg-teal-soft/60 text-teal font-semibold" : "border-line bg-bg-elevated text-ink-muted hover:text-ink",
              )}
            >
              <Check className="size-3.5" />
              Ocultar validados
            </button>

            {/* Atajos de teclado helper */}
            <button
              type="button"
              onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
              className="inline-flex h-9 items-center gap-1 rounded-lg border border-line bg-bg-elevated px-2 text-xs text-ink-muted hover:text-teal hover:border-teal transition"
              title="Ver atajos de teclado"
            >
              <Keyboard className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Legend de Atajos de Teclado */}
        {showShortcutsHelp && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-teal/30 bg-teal-soft/40 px-3.5 py-2 text-xs text-ink animate-in fade-in">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-semibold text-teal">⌨️ Atajos de teclado:</span>
              <span><kbd className="rounded bg-bg border border-line px-1.5 py-0.5 font-mono text-[10px]">↓</kbd> / <kbd className="rounded bg-bg border border-line px-1.5 py-0.5 font-mono text-[10px]">j</kbd> Siguiente</span>
              <span><kbd className="rounded bg-bg border border-line px-1.5 py-0.5 font-mono text-[10px]">↑</kbd> / <kbd className="rounded bg-bg border border-line px-1.5 py-0.5 font-mono text-[10px]">k</kbd> Anterior</span>
              <span><kbd className="rounded bg-bg border border-line px-1.5 py-0.5 font-mono text-[10px]">V</kbd> / <kbd className="rounded bg-bg border border-line px-1.5 py-0.5 font-mono text-[10px]">Espacio</kbd> Validar</span>
              <span><kbd className="rounded bg-bg border border-line px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> Cerrar detalle</span>
            </div>
            <button
              type="button"
              onClick={() => setShowShortcutsHelp(false)}
              className="text-ink-subtle hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
      </div>

      {tab === "cruce_nc" && result.cruzes.length ? <CruceBanner cruzes={result.cruzes} /> : null}

      {tab === "solo_siigo" ? (
        <OrphanTable />
      ) : groups ? (
        <div className="mt-4 space-y-3">
          {groups.length === 0 ? (
            <Empty tab={tab} />
          ) : (
            groups.map((g) => (
              <details
                key={g.nit}
                open
                className="overflow-hidden rounded-xl border border-line bg-bg-elevated"
              >
                <summary className="flex cursor-pointer select-none items-center justify-between border-b border-line/60 bg-bg-subtle/50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{g.nombre}</span>
                    <span className="font-mono text-xs text-ink-subtle">{g.nit}</span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="tabular-nums font-medium">{formatMoney(g.total)}</div>
                    <div className="text-xs text-ink-subtle">{g.rows.length} docs</div>
                  </div>
                </summary>
                <DocTable
                  rows={g.rows}
                  selectedId={selectedId}
                  reviews={reviews}
                  onSelect={select}
                  compact
                />
              </details>
            ))
          )}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-bg-elevated">
          {filtered.length === 0 ? (
            <Empty tab={tab} />
          ) : (
            <DocTable
              rows={filtered}
              selectedId={selectedId}
              reviews={reviews}
              onSelect={select}
              footer={formatMoneyExact(sumaDian)}
            />
          )}
        </div>
      )}

      {selected ? (
        <DetailDrawer
          row={selected}
          onClose={() => select(null)}
          onPrev={selectedIndex > 0 ? () => select(filtered[selectedIndex - 1].id) : undefined}
          onNext={selectedIndex < filtered.length - 1 ? () => select(filtered[selectedIndex + 1].id) : undefined}
        />
      ) : null}

      <HistoryModal
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        onSelectEntry={loadHistorySession}
      />
      <TaxSummaryModal
        open={showTaxModal}
        onClose={() => setShowTaxModal(false)}
        result={result}
      />
      <ExecutiveReportModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        result={result}
        dianName={dianName}
        movName={movName}
      />
      <NominaAuditModal
        open={showNominaModal}
        onClose={() => setShowNominaModal(false)}
        result={result}
      />
      <ActaConciliacionModal
        open={showActaModal}
        onClose={() => setShowActaModal(false)}
        result={result}
        dianName={dianName}
        movName={movName}
      />
    </div>
  );
}

function Empty({ tab }: { tab: TabId }) {
  return (
    <p className="px-3 py-10 text-center text-sm text-ink-muted">
      {tab === "pendiente" || tab === "cola" || tab === "posible_typo"
        ? "Nada pendiente en esta vista. Revisa las otras pestañas o sube otro mes."
        : "No hay documentos en esta vista."}
    </p>
  );
}

function DocTable({
  rows,
  selectedId,
  reviews,
  onSelect,
  footer,
  compact,
}: {
  rows: ConciliacionRow[];
  selectedId: string | null;
  reviews: Record<string, Review>;
  onSelect: (id: string) => void;
  footer?: string;
  compact?: boolean;
}) {
  return (
    <table className="w-full min-w-[920px] text-left text-sm">
      {!compact ? (
        <thead className="border-b border-line bg-bg-subtle/60 text-xs uppercase tracking-wider text-ink-subtle">
          <tr>
            <th className="px-3 py-3 font-medium">Estado</th>
            <th className="px-3 py-3 font-medium">Documento</th>
            <th className="px-3 py-3 font-medium">Proveedor / cliente</th>
            <th className="px-3 py-3 font-medium">CUFE</th>
            <th className="px-3 py-3 font-medium">Fecha</th>
            <th className="px-3 py-3 text-right font-medium">DIAN</th>
            <th className="px-3 py-3 text-right font-medium">Libros</th>
          </tr>
        </thead>
      ) : null}
      <tbody>
        {rows.map((r) => {
          const dias = daysAgo(r.fecha);
          const done = reviewOf(reviews, r)?.done;
          const action = reviewOf(reviews, r)?.action;
          const insight = getTaxInsight(r);

          return (
            <tr
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={cn(
                "cursor-pointer border-b border-line/70 last:border-0 hover:bg-teal-soft/40 transition-colors",
                selectedId === r.id && "bg-teal-soft/70",
                done && "opacity-55",
              )}
            >
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <BadgeEstado estado={r.estado} />
                  {done ? (
                    <span className="text-[11px] font-medium text-ok">
                      {action === "omitir" ? "Omitida" : "Validada"}
                    </span>
                  ) : null}
                  {insight && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border",
                        insight.tipo === "redondeo"
                          ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                          : insight.tipo === "retefuente"
                          ? "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                          : insight.tipo === "iva"
                          ? "bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
                          : "bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
                      )}
                      title={insight.detalle}
                    >
                      <Sparkles className="size-2.5" />
                      {insight.etiqueta}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <div className="font-medium tabular-nums">{r.numero || "—"}</div>
                <div className="text-xs text-ink-subtle">
                  {r.grupo} · {shortTipo(r.tipo)}
                  {r.matchVia ? ` · ${r.matchVia}` : ""}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <div className="max-w-56 truncate font-medium">{r.nombreContraparte || "—"}</div>
                <div className="font-mono text-xs text-ink-subtle">{r.nitContraparte}</div>
                {r.linked.length ? (
                  <div className="mt-0.5 text-xs text-info font-medium">
                    Cruza con {r.linked.map((l) => l.numero).join(", ")}
                  </div>
                ) : null}
                {r.alerta ? <div className="mt-0.5 max-w-56 text-xs text-warn font-medium">{r.alerta}</div> : null}
              </td>
              <td className="px-3 py-2.5">
                {r.cufe ? (
                  <button
                    type="button"
                    title={r.cufe}
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigator.clipboard.writeText(r.cufe);
                      useConciliacion.getState().flash("CUFE copiado");
                    }}
                    className="block max-w-[11rem] truncate font-mono text-[11px] text-ink-muted hover:text-teal"
                  >
                    {r.cufe}
                  </button>
                ) : (
                  <span className="text-ink-subtle">—</span>
                )}
              </td>
              <td className="px-3 py-2.5 tabular-nums text-ink-muted">
                <div>{formatDate(r.fecha)}</div>
                {dias != null ? (
                  <div className={cn("text-xs font-medium", dias > 30 ? "text-danger" : "text-ink-subtle")}>
                    {dias} d
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold">{formatMoneyExact(r.totalDian)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">
                {r.comprobantes.length ? formatMoneyExact(r.totalSiigo) : "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
      {footer ? (
        <tfoot>
          <tr className="border-t border-line bg-bg-subtle/40 text-sm font-medium">
            <td className="px-3 py-2.5" colSpan={5}>
              {rows.length} documentos
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">{footer}</td>
            <td />
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}

function CruceBanner({ cruzes }: { cruzes: ConciliacionResult["cruzes"] }) {
  return (
    <div className="mt-4 rounded-xl border border-info/30 bg-info-bg px-4 py-3 text-sm text-info">
      {cruzes.length} cruce{cruzes.length === 1 ? "" : "s"} factura + nota crédito del mismo NIT y valor.
      Si ambas están pendientes, el neto puede ser cero; igual conviene revisar si deben contabilizarse.
    </div>
  );
}

function shortTipo(t: string) {
  if (t.includes("Factura")) return "Factura";
  if (t.includes("soporte")) return "Doc. soporte";
  if (t.includes("Nomina") || t.includes("Nómina")) return "Nómina";
  if (t.includes("crédito") || t.includes("credito")) return "Nota crédito";
  if (t.includes("equivalente")) return "Doc. equivalente";
  return t;
}

function OrphanTable() {
  const orphans = useConciliacion((s) => s.result?.orphans ?? []);
  if (!orphans.length) {
    return (
      <p className="px-3 py-10 text-center text-sm text-ink-muted">
        No hay movimientos huérfanos en libros contables.
      </p>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-bg-elevated">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-line bg-bg-subtle/60 text-xs uppercase tracking-wider text-ink-subtle">
          <tr>
            <th className="px-3 py-3 font-medium">Comprobante</th>
            <th className="px-3 py-3 font-medium">Tercero</th>
            <th className="px-3 py-3 font-medium">Descripción</th>
            <th className="px-3 py-3 font-medium">Fecha</th>
            <th className="px-3 py-3 text-right font-medium">Débito</th>
            <th className="px-3 py-3 text-right font-medium">Crédito</th>
          </tr>
        </thead>
        <tbody>
          {orphans.map((o) => (
            <tr key={o.id} className="border-b border-line/70 last:border-0">
              <td className="px-3 py-2.5 font-mono text-xs">{o.comprobante}</td>
              <td className="px-3 py-2.5">
                <div className="max-w-48 truncate">{o.nombre || "—"}</div>
                <div className="font-mono text-xs text-ink-subtle">{o.nit}</div>
              </td>
              <td className="max-w-xs truncate px-3 py-2.5 text-ink-muted">{o.descripcion}</td>
              <td className="px-3 py-2.5 tabular-nums">{formatDate(o.fecha)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{o.debito ? formatMoneyExact(o.debito) : ""}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{o.credito ? formatMoneyExact(o.credito) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailDrawer({
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
            <h2 className="mt-2 font-display text-2xl font-semibold">{row.numero || "Sin número"}</h2>
            <p className="text-sm text-ink-muted">{row.tipo}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 hover:bg-bg-subtle" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>

        {/* Card de Insight Tributario / Redondeo si existe */}
        {insight && (
          <div className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <Sparkles className="size-3.5 text-amber-600" />
              Sugerencia Tributaria: {insight.etiqueta}
            </div>
            <p className="leading-relaxed text-ink-muted dark:text-amber-300/80">{insight.detalle}</p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
          <Field label="Grupo" value={row.grupo} />
          <Field
            label="Fecha"
            value={`${formatDate(row.fecha)}${dias != null ? ` · ${dias} días` : ""}`}
          />
          <Field label="NIT" value={row.nitContraparte} mono />
          <Field label="Contraparte" value={row.nombreContraparte} />
          <Field label="Total DIAN" value={formatMoneyExact(row.totalDian)} />
          <Field label="Valor en libros" value={row.hits.length ? formatMoneyExact(row.totalSiigo) : "—"} />
          <Field label="Diferencia" value={formatMoneyExact(row.diferencia)} />
          <Field label="Cruce" value={row.matchVia || "sin match"} />
        </dl>
        {row.alerta ? (
          <p className="mt-4 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">{row.alerta}</p>
        ) : null}
        {row.linked.length ? (
          <p className="mt-4 rounded-lg bg-info-bg px-3 py-2 text-sm text-info">
            Relacionado con {row.linked.map((l) => `${l.numero} (${formatMoneyExact(l.total)})`).join(" · ")}
          </p>
        ) : null}
        {row.cufe ? (
          <button
            type="button"
            onClick={() => copy(row.cufe)}
            className="mt-4 flex items-start gap-2 text-left"
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
                "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold",
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
                "inline-flex h-10 items-center justify-center rounded-lg border px-3 text-sm font-semibold",
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
            className="h-10 flex-1 rounded-lg border border-line text-sm disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={!onNext}
            onClick={onNext}
            className="h-10 flex-1 rounded-lg border border-line text-sm disabled:opacity-40"
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

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className={cn("mt-0.5", mono && "font-mono text-xs")}>{value || "—"}</dd>
    </div>
  );
}

function exportCsv(rows: ConciliacionRow[], result: ConciliacionResult, tab: string) {
  const lines: string[][] =
    tab === "solo_siigo"
      ? [
          ["Comprobante", "Fecha", "NIT", "Nombre", "Descripcion", "Debito", "Credito"],
          ...result.orphans.map((o) => [
            o.comprobante,
            o.fecha,
            o.nit,
            o.nombre,
            o.descripcion,
            String(o.debito),
            String(o.credito),
          ]),
        ]
      : [
          [
            "Estado",
            "Grupo",
            "Tipo",
            "Numero",
            "Fecha",
            "NIT",
            "Contraparte",
            "Total DIAN",
            "Valor libros",
            "Diferencia",
            "Match",
            "Comprobantes",
            "Cruce NC",
            "CUFE",
            "Alerta",
          ],
          ...rows.map((r) => [
            ESTADO_LABEL[r.estado as EstadoConciliacion],
            r.grupo,
            r.tipo,
            r.numero,
            r.fecha,
            r.nitContraparte,
            r.nombreContraparte,
            String(r.totalDian),
            String(r.totalSiigo),
            String(r.diferencia),
            r.matchVia,
            r.comprobantes.join(" | "),
            r.linked.map((l) => l.numero).join(" | "),
            r.cufe,
            r.alerta,
          ]),
        ];
  const csv = lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "auditoria-dian.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
