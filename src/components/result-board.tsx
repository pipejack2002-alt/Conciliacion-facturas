import { useEffect, useMemo, useState, useRef } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  Download,
  FileCheck,
  FileSpreadsheet,
  Printer,
  Search,
  Users,
  X,
  Award,
  Sparkles,
  Keyboard,
  ArrowUp,
  ArrowDown,
  Filter,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { DeltaBanner, ReplaceBar } from "./audit-chrome";
import { reviewOf, useConciliacion, type TabId } from "@/lib/store";
import { daysAgo, formatMoney, formatMoneyExact } from "@/lib/format";
import { ESTADO_LABEL, inCola } from "@/lib/conciliar";
import { exportAuditoriaXlsx } from "@/lib/export-excel";
import { exportSiigoTemplateXlsx } from "@/lib/export-siigo";
import { exportWorldOfficeTemplateXlsx } from "@/lib/export-worldoffice";
import { exportHelisaTemplateXlsx } from "@/lib/export-helisa";
import { HistoryModal } from "./history-modal";
import { TaxSummaryModal } from "./tax-summary-modal";
import { ExecutiveReportModal } from "./executive-report-modal";
import { NominaAuditModal } from "./nomina-audit-modal";
import { ActaConciliacionModal } from "./acta-conciliacion-modal";
import { getTaxInsight } from "@/lib/tax-insights";
import type { ConciliacionRow, EstadoConciliacion } from "@/lib/types";
import { cn } from "@/lib/cn";
import { KpiRow } from "./kpi-row";
import { ConciliationProgress } from "./conciliation-progress";
import { DocTable } from "./board/doc-table";
import { DetailDrawer } from "./board/detail-drawer";
import { CruceBanner } from "./board/cruce-banner";
import { Empty, shortTipo } from "./board/board-utils";
import { exportCsv } from "@/lib/export-csv";

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

type MaterialidadFilter = "todos" | "altos" | "con_sugerencia" | "riesgo_fiscal" | "sin_revisar";

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
  const sortDirection = useConciliacion((s) => s.sortDirection);
  const toggleSort = useConciliacion((s) => s.toggleSort);
  const columnFilters = useConciliacion((s) => s.columnFilters);
  const _setColumnFilter = useConciliacion((s) => s.setColumnFilter);
  const clearColumnFilter = useConciliacion((s) => s.clearColumnFilter);
  const clearAllColumnFilters = useConciliacion((s) => s.clearAllColumnFilters);
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
  const searchInputRef = useRef<HTMLInputElement>(null);

  const hasActiveFilters = Boolean(
    (columnFilters.estado && columnFilters.estado.length > 0) ||
    (columnFilters.tipo && columnFilters.tipo.length > 0) ||
    (columnFilters.proveedor && columnFilters.proveedor.trim().length > 0) ||
    columnFilters.hasCufe != null ||
    (columnFilters.fechaRange && columnFilters.fechaRange !== "all") ||
    (columnFilters.montoRange && columnFilters.montoRange !== "all")
  );

  // Atajo de teclado global Ctrl+K / Cmd+K para enfocar el buscador
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      if (tab === "solo_siigo") {
        if (r.estado !== "solo_siigo") return false;
      } else {
        if (r.estado === "solo_siigo" && tab !== "todos") return false;
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
      }
      if (hideRevisados && reviewOf(reviews, r)?.done) return false;

      // Filtro de Materialidad
      const amt = r.estado === "solo_siigo" ? r.totalSiigo : r.totalDian;
      if (materialidad === "altos" && amt < 5000000) return false;
      if (materialidad === "con_sugerencia" && !getTaxInsight(r)) return false;
      if (materialidad === "riesgo_fiscal" && getTaxInsight(r)?.tipo !== "riesgo_fiscal_radian") return false;
      if (materialidad === "sin_revisar" && reviewOf(reviews, r)?.done) return false;

      // Filtros específicos por columna ("El filtríco")
      if (columnFilters.estado && columnFilters.estado.length > 0) {
        if (!columnFilters.estado.includes(r.estado)) return false;
      }
      if (columnFilters.tipo && columnFilters.tipo.length > 0) {
        const sTipo = shortTipo(r.tipo);
        if (!columnFilters.tipo.includes(sTipo) && !columnFilters.tipo.includes(r.tipo)) return false;
      }
      if (columnFilters.proveedor && columnFilters.proveedor.trim().length > 0) {
        const pQuery = columnFilters.proveedor.trim().toLowerCase();
        if (
          !r.nombreContraparte.toLowerCase().includes(pQuery) &&
          !r.nitContraparte.includes(pQuery)
        ) {
          return false;
        }
      }
      if (columnFilters.hasCufe != null) {
        if (columnFilters.hasCufe && !r.cufe) return false;
        if (!columnFilters.hasCufe && r.cufe) return false;
      }
      if (columnFilters.fechaRange && columnFilters.fechaRange !== "all") {
        const dias = daysAgo(r.fecha);
        if (columnFilters.fechaRange === "7dias" && (dias == null || dias > 7)) return false;
        if (columnFilters.fechaRange === "15dias" && (dias == null || dias > 15)) return false;
        if (columnFilters.fechaRange === "30dias" && (dias == null || dias > 30)) return false;
        if (columnFilters.fechaRange === "mas30dias" && (dias == null || dias <= 30)) return false;
      }
      if (columnFilters.montoRange && columnFilters.montoRange !== "all") {
        if (columnFilters.montoRange === "gte5m" && amt < 5000000) return false;
        if (columnFilters.montoRange === "1m_5m" && (amt < 1000000 || amt >= 5000000)) return false;
        if (columnFilters.montoRange === "lt1m" && amt >= 1000000) return false;
      }

      if (!q) return true;
      return (
        r.numero.toLowerCase().includes(q) ||
        r.nombreContraparte.toLowerCase().includes(q) ||
        r.nitContraparte.includes(q) ||
        r.tipo.toLowerCase().includes(q) ||
        r.cufe.toLowerCase().includes(q) ||
        r.alerta.toLowerCase().includes(q) ||
        r.comprobantes.join(" ").toLowerCase().includes(q)
      );
    });

    const dirMult = sortDirection === "desc" ? -1 : 1;

    list = [...list].sort((a, b) => {
      const amtA = a.estado === "solo_siigo" ? a.totalSiigo : a.totalDian;
      const amtB = b.estado === "solo_siigo" ? b.totalSiigo : b.totalDian;

      if (sort === "monto" || sort === "dian") {
        const diff = amtA - amtB;
        if (diff !== 0) return diff * dirMult;
        return (a.numero || "").localeCompare(b.numero || "", undefined, { numeric: true });
      }

      if (sort === "libros") {
        const librosA = a.hits.length ? a.totalSiigo : 0;
        const librosB = b.hits.length ? b.totalSiigo : 0;
        const diff = librosA - librosB;
        if (diff !== 0) return diff * dirMult;
        return (amtA - amtB) * dirMult;
      }

      if (sort === "fecha") {
        const dateA = a.fecha || "";
        const dateB = b.fecha || "";
        const cmp = dateA.localeCompare(dateB);
        if (cmp !== 0) return cmp * dirMult;
        return (amtB - amtA);
      }

      if (sort === "proveedor") {
        const nameA = a.nombreContraparte || "";
        const nameB = b.nombreContraparte || "";
        const cmp = nameA.localeCompare(nameB, "es", { sensitivity: "base" });
        if (cmp !== 0) return cmp * dirMult;
        return (amtB - amtA);
      }

      if (sort === "documento") {
        const docA = a.numero || "";
        const docB = b.numero || "";
        const cmp = docA.localeCompare(docB, undefined, { numeric: true, sensitivity: "base" });
        if (cmp !== 0) return cmp * dirMult;
        return (amtB - amtA);
      }

      if (sort === "cufe") {
        const cufeA = a.cufe || "";
        const cufeB = b.cufe || "";
        if (!cufeA && cufeB) return 1 * dirMult;
        if (cufeA && !cufeB) return -1 * dirMult;
        const cmp = cufeA.localeCompare(cufeB);
        if (cmp !== 0) return cmp * dirMult;
        return (amtB - amtA);
      }

      if (sort === "estado") {
        const ra = RANK[a.estado] ?? 9;
        const rb = RANK[b.estado] ?? 9;
        if (ra !== rb) return (ra - rb) * dirMult;
        return (amtB - amtA);
      }

      // Default: sort === "prioridad"
      const ra = RANK[a.estado] ?? 9;
      const rb = RANK[b.estado] ?? 9;
      if (ra !== rb) return (ra - rb) * dirMult;
      return amtB - amtA;
    });

    return list;
  }, [result, query, tab, sort, sortDirection, columnFilters, hideRevisados, reviews, materialidad]);

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
        total: rows.reduce((s, r) => s + (r.estado === "solo_siigo" ? r.totalSiigo : r.totalDian), 0),
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

  const sumaDian = filtered.reduce((s, r) => s + (r.estado === "solo_siigo" ? r.totalSiigo : r.totalDian), 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-3 sm:px-6 lg:px-8 pb-20">
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
                const fullUniverse = result.rows.filter((r) => r.estado !== "no_aplica");
                exportAuditoriaXlsx(fullUniverse, result, tab, reviews);
                flash("Descargando reporte completo en Excel con todas las hojas...");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium hover:bg-teal-soft/50 hover:text-teal"
              title="Descargar libro de Excel completo con hojas de Conciliadas, Pendientes, Totalizadas, Solo Libros y Resumen"
            >
              <FileSpreadsheet className="size-3.5 text-ok" />
              Excel Completo (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => {
                const fullUniverse = result.rows.filter((r) => r.estado !== "no_aplica");
                exportCsv(fullUniverse, result, tab);
                flash("Descargando archivo CSV con todo el universo de auditoría...");
              }}
              className="inline-flex h-8 items-center gap-1 rounded-md border-l border-line px-2 text-xs font-medium text-ink-muted hover:bg-teal-soft/50 hover:text-teal"
              title="Descargar datos en formato CSV plano de todo el universo"
            >
              <Download className="size-3" />
              CSV Completo
            </button>
          </div>

          {/* Menú de Plantillas de Causación Contable para ERPs */}
          <div className="relative inline-flex items-center rounded-lg border border-teal/40 bg-teal-soft/40 p-0.5 text-xs shadow-2xs">
            <span className="inline-flex items-center px-2 py-1 font-bold text-teal-deep text-[11px]">
              Causar en ERP:
            </span>
            <button
              type="button"
              onClick={() => {
                exportSiigoTemplateXlsx(result.rows, result.company, result.periodLabel);
                flash("Plantilla de causación para Siigo descargada con éxito");
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-teal hover:bg-bg-surface hover:text-teal-deep transition shadow-2xs cursor-pointer"
              title="Exportar archivo de causación masiva para Siigo (P)"
            >
              Siigo
            </button>
            <button
              type="button"
              onClick={() => {
                exportWorldOfficeTemplateXlsx(result.rows, result.company, result.periodLabel);
                flash("Plantilla de causación para World Office descargada con éxito");
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md border-l border-teal/20 px-2 text-[11px] font-semibold text-teal hover:bg-bg-surface hover:text-teal-deep transition shadow-2xs cursor-pointer"
              title="Exportar archivo de causación masiva para World Office (FC)"
            >
              World Office
            </button>
            <button
              type="button"
              onClick={() => {
                exportHelisaTemplateXlsx(result.rows, result.company, result.periodLabel);
                flash("Plantilla de causación para Helisa descargada con éxito");
              }}
              className="inline-flex h-7 items-center gap-1 rounded-md border-l border-teal/20 px-2 text-[11px] font-semibold text-teal hover:bg-bg-surface hover:text-teal-deep transition shadow-2xs cursor-pointer"
              title="Exportar archivo de causación masiva para Helisa (01)"
            >
              Helisa
            </button>
          </div>

          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-bg px-3 text-xs font-semibold text-danger hover:bg-danger hover:text-white transition shadow-2xs cursor-pointer"
            title="Vaciar todos los datos de la conciliación y volver a cargar"
          >
            <Trash2 className="size-3.5" />
            <span>Vaciar Datos</span>
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

      {/* 1. Barra de Progreso y Efectividad Comercial */}
      <div className="mt-4">
        <ConciliationProgress
          result={result}
          currentTab={tab}
          onSelectTab={setTab}
        />
      </div>

      {/* 2. Tarjetas KPI de Estado */}
      <div className="mt-4">
        <KpiRow result={result} currentTab={tab} onSelectTab={setTab} />
      </div>

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
                ref={searchInputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar NIT, proveedor, N° factura…"
                className="h-9 w-full rounded-lg border border-line bg-bg-elevated pl-9 pr-14 text-xs outline-none focus:border-teal transition shadow-2xs"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-ink-subtle hover:text-ink text-xs transition"
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line bg-bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-ink-subtle">
                  Ctrl K
                </kbd>
              )}
            </label>
            <span className="text-xs text-ink-subtle hidden sm:inline-block">
              {filtered.length} {filtered.length === 1 ? "documento" : "documentos"}
            </span>

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
                  "inline-flex items-center gap-1 rounded px-2 py-1 font-medium transition cursor-pointer",
                  materialidad === "con_sugerencia" ? "bg-teal text-bg-elevated font-semibold" : "text-ink-muted hover:text-ink",
                )}
                title="Filtrar partidas con causas tributarias detectadas (Retefuente, IVA, Redondeo)"
              >
                <Sparkles className="size-3 text-amber-500" />
                Con Sugerencia
              </button>
              <button
                type="button"
                onClick={() => setMaterialidad("riesgo_fiscal")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-1 font-medium transition cursor-pointer",
                  materialidad === "riesgo_fiscal"
                    ? "bg-rose-600 text-white font-semibold"
                    : "text-rose-700 hover:text-rose-900 bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/80",
                )}
                title="Filtrar facturas a crédito en riesgo por Art. 771-2 E.T. (sin acuses de recibo RADIAN)"
              >
                <AlertTriangle className="size-3 text-current" />
                Riesgo Art. 771-2
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

            <div className="inline-flex items-center rounded-lg border border-line bg-bg-elevated shadow-2xs">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="h-9 rounded-l-lg border-r border-line bg-transparent px-2.5 text-xs text-ink outline-none cursor-pointer"
                title="Criterio de ordenamiento principal"
              >
                <option value="prioridad">Ordenar: Prioridad contable</option>
                <option value="estado">Ordenar: Estado</option>
                <option value="documento">Ordenar: N° Documento</option>
                <option value="proveedor">Ordenar: Proveedor</option>
                <option value="cufe">Ordenar: CUFE</option>
                <option value="fecha">Ordenar: Fecha</option>
                <option value="dian">Ordenar: Monto DIAN</option>
                <option value="libros">Ordenar: Libros</option>
              </select>
              <button
                type="button"
                onClick={() => toggleSort(sort)}
                className="inline-flex h-9 items-center gap-1 px-2.5 text-xs font-semibold text-teal hover:bg-teal-soft/40 transition cursor-pointer"
                title={`Cambiar dirección de orden (actual: ${sortDirection === "asc" ? "Menor a mayor / A-Z" : "Mayor a menor / Z-A"}). Clic para alternar.`}
              >
                {sortDirection === "asc" ? (
                  <>
                    <ArrowUp className="size-3.5" />
                    <span>Asc</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="size-3.5" />
                    <span>Desc</span>
                  </>
                )}
              </button>
            </div>
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

        {/* Barra de Filtros por Columna Activos ("El filtríco") */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-teal/30 bg-teal-soft/30 px-3.5 py-2 text-xs text-ink animate-in fade-in">
            <span className="font-semibold text-teal flex items-center gap-1.5">
              <Filter className="size-3.5" />
              Filtros activos:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {columnFilters.estado && columnFilters.estado.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-bg-surface px-2 py-0.5 border border-line shadow-2xs text-[11px] font-medium">
                  <span>Estado: {columnFilters.estado.map((e) => ESTADO_LABEL[e as EstadoConciliacion] || e).join(", ")}</span>
                  <button
                    type="button"
                    onClick={() => clearColumnFilter("estado")}
                    className="text-ink-subtle hover:text-danger ml-0.5 cursor-pointer font-bold"
                    title="Quitar filtro de estado"
                  >
                    ✕
                  </button>
                </span>
              )}
              {columnFilters.tipo && columnFilters.tipo.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-bg-surface px-2 py-0.5 border border-line shadow-2xs text-[11px] font-medium">
                  <span>Tipo: {columnFilters.tipo.join(", ")}</span>
                  <button
                    type="button"
                    onClick={() => clearColumnFilter("tipo")}
                    className="text-ink-subtle hover:text-danger ml-0.5 cursor-pointer font-bold"
                    title="Quitar filtro de tipo de documento"
                  >
                    ✕
                  </button>
                </span>
              )}
              {columnFilters.proveedor && columnFilters.proveedor.trim().length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-bg-surface px-2 py-0.5 border border-line shadow-2xs text-[11px] font-medium">
                  <span>Proveedor: "{columnFilters.proveedor}"</span>
                  <button
                    type="button"
                    onClick={() => clearColumnFilter("proveedor")}
                    className="text-ink-subtle hover:text-danger ml-0.5 cursor-pointer font-bold"
                    title="Quitar filtro de proveedor"
                  >
                    ✕
                  </button>
                </span>
              )}
              {columnFilters.hasCufe != null && (
                <span className="inline-flex items-center gap-1 rounded-md bg-bg-surface px-2 py-0.5 border border-line shadow-2xs text-[11px] font-medium">
                  <span>CUFE: {columnFilters.hasCufe ? "Solo con CUFE" : "Sin CUFE"}</span>
                  <button
                    type="button"
                    onClick={() => clearColumnFilter("hasCufe")}
                    className="text-ink-subtle hover:text-danger ml-0.5 cursor-pointer font-bold"
                    title="Quitar filtro de CUFE"
                  >
                    ✕
                  </button>
                </span>
              )}
              {columnFilters.fechaRange && columnFilters.fechaRange !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-bg-surface px-2 py-0.5 border border-line shadow-2xs text-[11px] font-medium">
                  <span>
                    Fecha:{" "}
                    {columnFilters.fechaRange === "7dias"
                      ? "Últimos 7 días"
                      : columnFilters.fechaRange === "15dias"
                      ? "Últimos 15 días"
                      : columnFilters.fechaRange === "30dias"
                      ? "Últimos 30 días"
                      : "Más de 30 días"}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearColumnFilter("fechaRange")}
                    className="text-ink-subtle hover:text-danger ml-0.5 cursor-pointer font-bold"
                    title="Quitar filtro de fecha"
                  >
                    ✕
                  </button>
                </span>
              )}
              {columnFilters.montoRange && columnFilters.montoRange !== "all" && (
                <span className="inline-flex items-center gap-1 rounded-md bg-bg-surface px-2 py-0.5 border border-line shadow-2xs text-[11px] font-medium">
                  <span>
                    Monto:{" "}
                    {columnFilters.montoRange === "gte5m"
                      ? "≥ $5.000.000"
                      : columnFilters.montoRange === "1m_5m"
                      ? "$1M - $5M"
                      : "< $1.000.000"}
                  </span>
                  <button
                    type="button"
                    onClick={() => clearColumnFilter("montoRange")}
                    className="text-ink-subtle hover:text-danger ml-0.5 cursor-pointer font-bold"
                    title="Quitar filtro de monto"
                  >
                    ✕
                  </button>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={clearAllColumnFilters}
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-teal hover:underline cursor-pointer"
            >
              <RotateCcw className="size-3" />
              Limpiar todos los filtros
            </button>
          </div>
        )}
      </div>

      {tab === "cruce_nc" && result.cruzes.length ? <CruceBanner cruzes={result.cruzes} /> : null}

      {/* Banner Especial de Causación Masiva a ERPs en Pestaña 'Por Registrar' */}
      {tab === "pendiente" && result.totals.pendientesRecibidos > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-teal/40 bg-teal-soft/40 p-4 shadow-2xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-teal text-white shrink-0 shadow-xs">
              <Download className="size-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-ink flex items-center gap-1.5">
                <span>Causación Masiva en 1 Clic para tu ERP</span>
                <span className="rounded bg-teal/20 px-1.5 py-0.5 text-[10px] font-bold text-teal-deep">
                  {result.totals.pendientesRecibidos} facturas pendientes
                </span>
              </h4>
              <p className="text-[11px] text-ink-muted leading-tight mt-0.5">
                Descarga la plantilla con asientos de partida doble (gasto + IVA descontable vs. proveedores) para causar estas facturas en segundos:
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                exportSiigoTemplateXlsx(result.rows, result.company, result.periodLabel);
                flash("Plantilla de importación Siigo descargada");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal/40 bg-bg-surface px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal hover:text-white transition shadow-2xs cursor-pointer"
            >
              <span>📘 Siigo</span>
            </button>
            <button
              type="button"
              onClick={() => {
                exportWorldOfficeTemplateXlsx(result.rows, result.company, result.periodLabel);
                flash("Plantilla de importación World Office descargada");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal/40 bg-bg-surface px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal hover:text-white transition shadow-2xs cursor-pointer"
            >
              <span>📗 World Office</span>
            </button>
            <button
              type="button"
              onClick={() => {
                exportHelisaTemplateXlsx(result.rows, result.company, result.periodLabel);
                flash("Plantilla de importación Helisa descargada");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal/40 bg-bg-surface px-3 py-1.5 text-xs font-semibold text-teal hover:bg-teal hover:text-white transition shadow-2xs cursor-pointer"
            >
              <span>📙 Helisa</span>
            </button>
          </div>
        </div>
      )}

      {groups ? (
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
