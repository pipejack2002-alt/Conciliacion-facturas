import { useMemo, useState, useEffect } from "react";
import { ArrowUp, ArrowDown, AlertTriangle, Sparkles, Copy } from "lucide-react";
import { BadgeEstado } from "../badge-estado";
import { reviewOf, useConciliacion, type Review } from "@/lib/store";
import { daysAgo, formatDate, formatMoneyExact } from "@/lib/format";
import { getTaxInsight } from "@/lib/tax-insights";
import type { ConciliacionRow, EstadoConciliacion } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ColumnHeader } from "./column-header";
import { CopyButton, getInitials } from "./board-utils";
import { TablePagination } from "./table-pagination";
import { BatchActionsBar } from "./batch-actions-bar";
import { HighlightedText } from "./highlighted-text";
import { exportAuditoriaXlsx } from "@/lib/export-excel";

export function DocTable({
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
  const sort = useConciliacion((s) => s.sort);
  const sortDirection = useConciliacion((s) => s.sortDirection);
  const setSort = useConciliacion((s) => s.setSort);
  const columnFilters = useConciliacion((s) => s.columnFilters);
  const setColumnFilter = useConciliacion((s) => s.setColumnFilter);
  const clearColumnFilter = useConciliacion((s) => s.clearColumnFilter);
  const markValidated = useConciliacion((s) => s.markValidated);
  const flash = useConciliacion((s) => s.flash);
  const result = useConciliacion((s) => s.result);
  const query = useConciliacion((s) => s.query);

  // Paginación de alto rendimiento para grandes volúmenes de facturas
  const [pageSize, setPageSize] = useState<number>(compact ? 0 : 50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Selección múltiple para acciones masivas (Batch Actions)
  const [selectedBatchIds, setSelectedBatchIds] = useState<Set<string>>(new Set());

  // Reset de página y selección al cambiar datos o filtros
  useEffect(() => {
    setCurrentPage(1);
    setSelectedBatchIds(new Set());
  }, [rows]);

  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(rows.length / pageSize));

  const paginatedRows = useMemo(() => {
    if (pageSize === 0 || compact) return rows;
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize, compact]);

  const selectedRowsList = useMemo(() => {
    return rows.filter((r) => selectedBatchIds.has(r.id));
  }, [rows, selectedBatchIds]);

  function handleBatchMark(action: "validada" | "omitir") {
    if (selectedRowsList.length === 0) return;
    selectedRowsList.forEach((r) => {
      markValidated(r, action);
    });
    flash(
      action === "validada"
        ? `✅ ${selectedRowsList.length} documento${selectedRowsList.length === 1 ? "" : "s"} marcado${selectedRowsList.length === 1 ? "" : "s"} como validado${selectedRowsList.length === 1 ? "" : "s"}.`
        : `Marcas removidas en ${selectedRowsList.length} documento${selectedRowsList.length === 1 ? "" : "s"}.`
    );
    setSelectedBatchIds(new Set());
  }

  function handleBatchExport() {
    if (!result || selectedRowsList.length === 0) return;
    exportAuditoriaXlsx(selectedRowsList, result, "seleccionadas", reviews);
    flash(`Descargando ${selectedRowsList.length} registro${selectedRowsList.length === 1 ? "" : "s"} seleccionado${selectedRowsList.length === 1 ? "" : "s"} en Excel...`);
  }

  const stateCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.estado] = (map[r.estado] || 0) + 1;
    }
    return map;
  }, [rows]);

  const stateOptions: { id: EstadoConciliacion; label: string }[] = [
    { id: "pendiente", label: "Por registrar" },
    { id: "posible_typo", label: "Revisar factura" },
    { id: "totalizado", label: "Totalizados" },
    { id: "duplicado", label: "Dobles" },
    { id: "diferencia", label: "Diferencias" },
    { id: "cruce_nc", label: "Cruces NC" },
    { id: "conciliado", label: "Registrados" },
    { id: "solo_siigo", label: "Solo libros" },
  ];

  return (
    <div className="relative">
      <table className="w-full min-w-[820px] text-left text-sm table-auto">
        <colgroup>
          {!compact && <col className="w-[36px]" />}
          <col className="w-[15%] min-w-[125px]" />
          <col className="w-[13%] min-w-[110px]" />
          <col className="w-[31%] min-w-[185px]" />
          <col className="w-[9%] min-w-[80px]" />
          <col className="w-[8%] min-w-[75px]" />
          <col className="w-[11%] min-w-[105px]" />
          <col className="w-[10%] min-w-[105px]" />
        </colgroup>
        {!compact ? (
          <thead className="sticky top-0 z-10 border-b border-line bg-bg-surface/95 backdrop-blur text-[11px] sm:text-xs uppercase tracking-wider text-ink-subtle shadow-xs">
            <tr>
              {!compact && (
                <th className="w-[36px] px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedRows.length > 0 && paginatedRows.every((r) => selectedBatchIds.has(r.id))}
                    onChange={(e) => {
                      const next = new Set(selectedBatchIds);
                      if (e.target.checked) {
                        paginatedRows.forEach((r) => next.add(r.id));
                      } else {
                        paginatedRows.forEach((r) => next.delete(r.id));
                      }
                      setSelectedBatchIds(next);
                    }}
                    className="size-3.5 rounded border-line text-teal focus:ring-teal cursor-pointer accent-teal"
                    title="Seleccionar todas las visibles en esta página"
                  />
                </th>
              )}
              <ColumnHeader
                columnKey="estado"
                title="ESTADO"
                className="w-[15%] min-w-[125px]"
              renderFilter={(close) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-semibold text-ink">Columna: Estado</span>
                    {columnFilters.estado?.length ? (
                      <button
                        type="button"
                        onClick={() => clearColumnFilter("estado")}
                        className="text-[11px] text-teal hover:underline font-semibold cursor-pointer"
                      >
                        Limpiar
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Ordenar:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setSort("estado", "asc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          sort === "estado" && sortDirection === "asc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowUp className="size-3" /> Prioridad
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSort("estado", "desc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          sort === "estado" && sortDirection === "desc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowDown className="size-3" /> Invertido
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Filtrar por estado:</span>
                    <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                      {stateOptions.map((opt) => {
                        const count = stateCounts[opt.id] || 0;
                        const isChecked = columnFilters.estado?.includes(opt.id) ?? false;
                        return (
                          <label
                            key={opt.id}
                            className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-bg-subtle cursor-pointer text-xs"
                          >
                            <div className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const curr = columnFilters.estado || [];
                                  const next = e.target.checked
                                    ? [...curr, opt.id]
                                    : curr.filter((s) => s !== opt.id);
                                  if (next.length === 0) clearColumnFilter("estado");
                                  else setColumnFilter("estado", next);
                                }}
                                className="rounded border-line text-teal focus:ring-teal size-3.5"
                              />
                              <span>{opt.label}</span>
                            </div>
                            <span className="text-[10px] text-ink-subtle font-mono">{count}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 border-t border-line">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-md bg-bg-subtle px-2.5 py-1 text-xs font-medium text-ink hover:bg-line transition cursor-pointer"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            />

            <ColumnHeader
              columnKey="documento"
              title="DOCUMENTO"
              className="w-[13%] min-w-[110px] whitespace-nowrap"
              renderFilter={(close) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-semibold text-ink">Columna: Documento</span>
                    {columnFilters.tipo?.length ? (
                      <button
                        type="button"
                        onClick={() => clearColumnFilter("tipo")}
                        className="text-[11px] text-teal hover:underline font-semibold cursor-pointer"
                      >
                        Limpiar
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Ordenar por número:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setSort("documento", "asc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          sort === "documento" && sortDirection === "asc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowUp className="size-3" /> A → Z (Asc)
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSort("documento", "desc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          sort === "documento" && sortDirection === "desc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowDown className="size-3" /> Z → A (Desc)
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Filtrar por tipo de documento:</span>
                    <div className="space-y-1">
                      {[
                        { id: "Factura", label: "Facturas electrónicas" },
                        { id: "soporte", label: "Documentos soporte" },
                        { id: "Nomina", label: "Nómina electrónica" },
                        { id: "crédito", label: "Notas crédito" },
                        { id: "equivalente", label: "Documentos equivalentes" },
                      ].map((t) => {
                        const isChecked = columnFilters.tipo?.includes(t.id) ?? false;
                        return (
                          <label
                            key={t.id}
                            className="flex items-center gap-2 rounded px-2 py-1 hover:bg-bg-subtle cursor-pointer text-xs"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const curr = columnFilters.tipo || [];
                                const next = e.target.checked
                                  ? [...curr, t.id]
                                  : curr.filter((x) => x !== t.id);
                                if (next.length === 0) clearColumnFilter("tipo");
                                else setColumnFilter("tipo", next);
                              }}
                              className="rounded border-line text-teal focus:ring-teal size-3.5"
                            />
                            <span>{t.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 border-t border-line">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-md bg-bg-subtle px-2.5 py-1 text-xs font-medium text-ink hover:bg-line transition cursor-pointer"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            />

            <ColumnHeader
              columnKey="proveedor"
              title="PROVEEDOR / CLIENTE"
              className="w-[32%] min-w-[190px]"
              renderFilter={(close) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-semibold text-ink">Columna: Proveedor</span>
                    {columnFilters.proveedor?.trim() ? (
                      <button
                        type="button"
                        onClick={() => clearColumnFilter("proveedor")}
                        className="text-[11px] text-teal hover:underline font-semibold cursor-pointer"
                      >
                        Limpiar
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Ordenar alfabéticamente:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setSort("proveedor", "asc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          sort === "proveedor" && sortDirection === "asc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowUp className="size-3" /> A → Z
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSort("proveedor", "desc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          sort === "proveedor" && sortDirection === "desc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowDown className="size-3" /> Z → A
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Filtrar por proveedor o NIT:</span>
                    <input
                      type="text"
                      placeholder="Ej. Éxito, Claro, 900..."
                      value={columnFilters.proveedor || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val.trim()) clearColumnFilter("proveedor");
                        else setColumnFilter("proveedor", val);
                      }}
                      className="w-full rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-xs outline-none focus:border-teal"
                    />
                  </div>

                  <div className="flex justify-end pt-1 border-t border-line">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-md bg-bg-subtle px-2.5 py-1 text-xs font-medium text-ink hover:bg-line transition cursor-pointer"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            />

            <ColumnHeader
              columnKey="cufe"
              title="CUFE"
              className="w-[10%] min-w-[85px]"
              renderFilter={(close) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-semibold text-ink">Columna: CUFE</span>
                    {columnFilters.hasCufe != null ? (
                      <button
                        type="button"
                        onClick={() => clearColumnFilter("hasCufe")}
                        className="text-[11px] text-teal hover:underline font-semibold cursor-pointer"
                      >
                        Limpiar
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Ordenar:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setSort("cufe", "asc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          sort === "cufe" && sortDirection === "asc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowUp className="size-3" /> Con CUFE 1°
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSort("cufe", "desc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          sort === "cufe" && sortDirection === "desc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowDown className="size-3" /> Sin CUFE 1°
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Filtrar por presencia de CUFE:</span>
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => { clearColumnFilter("hasCufe"); close(); }}
                        className={cn(
                          "w-full text-left rounded px-2 py-1 text-xs transition cursor-pointer",
                          columnFilters.hasCufe == null ? "bg-teal-soft text-teal font-semibold" : "hover:bg-bg-subtle text-ink"
                        )}
                      >
                        Todos los documentos
                      </button>
                      <button
                        type="button"
                        onClick={() => { setColumnFilter("hasCufe", true); close(); }}
                        className={cn(
                          "w-full text-left rounded px-2 py-1 text-xs transition cursor-pointer",
                          columnFilters.hasCufe === true ? "bg-teal-soft text-teal font-semibold" : "hover:bg-bg-subtle text-ink"
                        )}
                      >
                        Solo con CUFE registrado
                      </button>
                      <button
                        type="button"
                        onClick={() => { setColumnFilter("hasCufe", false); close(); }}
                        className={cn(
                          "w-full text-left rounded px-2 py-1 text-xs transition cursor-pointer",
                          columnFilters.hasCufe === false ? "bg-teal-soft text-teal font-semibold" : "hover:bg-bg-subtle text-ink"
                        )}
                      >
                        Solo sin CUFE
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 border-t border-line">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-md bg-bg-subtle px-2.5 py-1 text-xs font-medium text-ink hover:bg-line transition cursor-pointer"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            />

            <ColumnHeader
              columnKey="fecha"
              title="FECHA"
              className="w-[9%] min-w-[80px] whitespace-nowrap"
              renderFilter={(close) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-semibold text-ink">Columna: Fecha</span>
                    {columnFilters.fechaRange && columnFilters.fechaRange !== "all" ? (
                      <button
                        type="button"
                        onClick={() => clearColumnFilter("fechaRange")}
                        className="text-[11px] text-teal hover:underline font-semibold cursor-pointer"
                      >
                        Limpiar
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Ordenar cronológicamente:</span>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => { setSort("fecha", "asc"); close(); }}
                        className={cn(
                          "w-full flex items-center justify-start gap-2 rounded-md border px-2.5 py-1.5 text-xs transition cursor-pointer",
                          sort === "fecha" && sortDirection === "asc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowUp className="size-3.5 shrink-0" />
                        <span>Menor a mayor (más antiguo primero)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSort("fecha", "desc"); close(); }}
                        className={cn(
                          "w-full flex items-center justify-start gap-2 rounded-md border px-2.5 py-1.5 text-xs transition cursor-pointer",
                          sort === "fecha" && sortDirection === "desc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowDown className="size-3.5 shrink-0" />
                        <span>Mayor a menor (más reciente primero)</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Filtrar por período:</span>
                    <div className="space-y-1">
                      {[
                        { id: "all", label: "Todas las fechas" },
                        { id: "7dias", label: "Últimos 7 días" },
                        { id: "15dias", label: "Últimos 15 días" },
                        { id: "30dias", label: "Últimos 30 días" },
                        { id: "mas30dias", label: "Más de 30 días" },
                      ].map((opt) => {
                        const isCurrent = (columnFilters.fechaRange || "all") === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              if (opt.id === "all") clearColumnFilter("fechaRange");
                              else setColumnFilter("fechaRange", opt.id as any);
                              close();
                            }}
                            className={cn(
                              "w-full text-left rounded px-2 py-1 text-xs transition cursor-pointer",
                              isCurrent ? "bg-teal-soft text-teal font-semibold" : "hover:bg-bg-subtle text-ink"
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 border-t border-line">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-md bg-bg-subtle px-2.5 py-1 text-xs font-medium text-ink hover:bg-line transition cursor-pointer"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            />

            <ColumnHeader
              columnKey="dian"
              title="DIAN"
              align="right"
              className="w-[11%] min-w-[110px] whitespace-nowrap"
              renderFilter={(close) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-semibold text-ink">Columna: Monto DIAN</span>
                    {columnFilters.montoRange && columnFilters.montoRange !== "all" ? (
                      <button
                        type="button"
                        onClick={() => clearColumnFilter("montoRange")}
                        className="text-[11px] text-teal hover:underline font-semibold cursor-pointer"
                      >
                        Limpiar
                      </button>
                    ) : null}
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Ordenar por valor:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setSort("dian", "desc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          (sort === "dian" || sort === "monto") && sortDirection === "desc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowDown className="size-3" /> Mayor a menor
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSort("dian", "asc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          (sort === "dian" || sort === "monto") && sortDirection === "asc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowUp className="size-3" /> Menor a mayor
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Filtrar por rango:</span>
                    <div className="space-y-1">
                      {[
                        { id: "all", label: "Todos los montos" },
                        { id: "gte5m", label: "≥ $5.000.000 (Altos)" },
                        { id: "1m_5m", label: "$1.000.000 a $5.000.000" },
                        { id: "lt1m", label: "< $1.000.000 (Menores)" },
                      ].map((opt) => {
                        const isCurrent = (columnFilters.montoRange || "all") === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              if (opt.id === "all") clearColumnFilter("montoRange");
                              else setColumnFilter("montoRange", opt.id as any);
                              close();
                            }}
                            className={cn(
                              "w-full text-left rounded px-2 py-1 text-xs transition cursor-pointer",
                              isCurrent ? "bg-teal-soft text-teal font-semibold" : "hover:bg-bg-subtle text-ink"
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 border-t border-line">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-md bg-bg-subtle px-2.5 py-1 text-xs font-medium text-ink hover:bg-line transition cursor-pointer"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            />

            <ColumnHeader
              columnKey="libros"
              title="LIBROS"
              align="right"
              className="w-[10%] min-w-[110px] whitespace-nowrap"
              renderFilter={(close) => (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-line pb-2">
                    <span className="font-semibold text-ink">Columna: Libros</span>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-ink-subtle block mb-1">Ordenar por valor en libros:</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setSort("libros", "desc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          sort === "libros" && sortDirection === "desc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowDown className="size-3" /> Mayor a menor
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSort("libros", "asc"); close(); }}
                        className={cn(
                          "flex items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs transition cursor-pointer",
                          sort === "libros" && sortDirection === "asc"
                            ? "bg-teal text-bg-elevated border-teal font-semibold"
                            : "border-line bg-bg-subtle hover:bg-teal-soft/50 text-ink"
                        )}
                      >
                        <ArrowUp className="size-3" /> Menor a mayor
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 border-t border-line">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-md bg-bg-subtle px-2.5 py-1 text-xs font-medium text-ink hover:bg-line transition cursor-pointer"
                    >
                      Listo
                    </button>
                  </div>
                </div>
              )}
            />
          </tr>
        </thead>
      ) : null}
      <tbody>
        {paginatedRows.map((r) => {
          const dias = daysAgo(r.fecha);
          const done = reviewOf(reviews, r)?.done;
          const action = reviewOf(reviews, r)?.action;
          const insight = getTaxInsight(r);

          return (
            <tr
              key={r.id}
              onClick={() => {
                const sel = window.getSelection()?.toString();
                if (sel && sel.trim().length > 0) return;
                onSelect(r.id);
              }}
              className={cn(
                "cursor-pointer border-b border-line/70 last:border-0 hover:bg-teal-soft/30 transition-all duration-150 select-text",
                selectedId === r.id && "bg-teal-soft/70 ring-1 ring-inset ring-teal/30",
                done && "opacity-55",
              )}
            >
              {!compact && (
                <td className="w-[36px] px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.has(r.id)}
                    onChange={(e) => {
                      const next = new Set(selectedBatchIds);
                      if (e.target.checked) next.add(r.id);
                      else next.delete(r.id);
                      setSelectedBatchIds(next);
                    }}
                    className="size-3.5 rounded border-line text-teal focus:ring-teal cursor-pointer accent-teal"
                  />
                </td>
              )}
              <td className="px-2.5 py-2 min-w-[125px]">
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <BadgeEstado estado={r.estado} />
                    {done ? (
                      <span className="text-[10px] font-semibold text-ok">
                        {action === "omitir" ? "Omitida" : "Validada"}
                      </span>
                    ) : null}
                  </div>
                  {insight && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold border shadow-2xs whitespace-nowrap",
                        insight.tipo === "redondeo"
                          ? "bg-slate-100 text-slate-800 border-slate-300"
                          : insight.tipo === "retefuente"
                          ? "bg-amber-100 text-amber-950 border-amber-400"
                          : insight.tipo === "iva"
                          ? "bg-blue-100 text-blue-950 border-blue-400"
                          : insight.tipo === "trm_diferencia"
                          ? "bg-sky-100 text-sky-950 border-sky-400"
                          : insight.tipo === "comision_bancaria"
                          ? "bg-emerald-100 text-emerald-950 border-emerald-400"
                          : insight.tipo === "riesgo_fiscal_radian"
                          ? "bg-rose-100 text-rose-950 border-rose-300 font-extrabold"
                          : "bg-teal-100 text-teal-950 border-teal-400",
                      )}
                      title={insight.detalle}
                    >
                      {insight.tipo === "riesgo_fiscal_radian" ? (
                        <AlertTriangle className="size-2.5 shrink-0 text-rose-600" />
                      ) : (
                        <Sparkles className="size-2.5 shrink-0 text-current" />
                      )}
                      {insight.etiqueta}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-2.5 py-2 min-w-[110px] whitespace-nowrap">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <HighlightedText
                    text={r.numero || "—"}
                    query={query}
                    className="font-bold tabular-nums select-text text-ink text-xs sm:text-sm tracking-tight"
                  />
                  {r.numero && (
                    <CopyButton
                      text={r.numero}
                      label={`Copiar N° ${r.numero}`}
                      successMessage={`N° de documento ${r.numero} copiado`}
                      className="rounded p-0.5 text-ink-subtle hover:bg-teal-soft hover:text-teal transition cursor-pointer shrink-0"
                    >
                      <Copy className="size-3" />
                    </CopyButton>
                  )}
                </div>
              </td>
              <td className="px-2.5 py-2 min-w-[190px]">
                <div className="flex items-start gap-2">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded bg-teal-soft/80 text-[9px] font-bold text-teal shadow-2xs mt-0.5">
                    {getInitials(r.nombreContraparte)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className="max-w-[200px] sm:max-w-[260px] truncate font-semibold text-ink text-xs select-text" title={r.nombreContraparte}>
                        <HighlightedText text={r.nombreContraparte || "—"} query={query} />
                      </div>
                      {r.nombreContraparte && (
                        <CopyButton
                          text={r.nombreContraparte}
                          label="Copiar nombre del proveedor"
                          successMessage={`Proveedor "${r.nombreContraparte}" copiado`}
                          className="rounded p-0.5 text-ink-subtle hover:bg-teal-soft hover:text-teal transition cursor-pointer shrink-0"
                        >
                          <Copy className="size-2.5" />
                        </CopyButton>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <HighlightedText
                        text={r.nitContraparte}
                        query={query}
                        className="font-mono text-[11px] text-ink-subtle font-medium select-text"
                      />
                      {r.nitContraparte && (
                        <CopyButton
                          text={r.nitContraparte}
                          label="Copiar NIT al portapapeles"
                          successMessage={`NIT ${r.nitContraparte} copiado`}
                        />
                      )}
                    </div>
                    {r.linked.length ? (
                      <div className="mt-0.5 text-[11px] text-info font-medium truncate max-w-[260px]" title={r.linked.map((l) => l.numero).join(", ")}>
                        {r.estado === "solo_siigo" ? "DIAN: " : "Cruza con: "}
                        {r.linked.map((l) => l.numero).join(", ")}
                      </div>
                    ) : null}
                    {r.alerta ? (
                      <div
                        className="mt-0.5 line-clamp-2 text-[11px] text-amber-800 font-medium leading-snug select-text max-w-[300px]"
                        title={r.alerta}
                      >
                        {r.alerta}
                      </div>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-2 py-2 min-w-[85px]">
                {r.cufe ? (
                  <CopyButton
                    text={r.cufe}
                    label="Copiar CUFE"
                    successMessage="CUFE copiado al portapapeles"
                    className="group inline-flex items-center gap-1 max-w-[5.5rem] truncate rounded px-1 py-0.5 font-mono text-[10px] text-ink-muted hover:bg-teal-soft hover:text-teal transition cursor-pointer"
                  >
                    <Copy className="size-2.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                    <span className="truncate">{r.cufe}</span>
                  </CopyButton>
                ) : (
                  <span className="text-ink-subtle text-xs">—</span>
                )}
              </td>
              <td className="px-2 py-2 min-w-[80px] whitespace-nowrap tabular-nums text-ink-muted text-xs">
                <div>{formatDate(r.fecha)}</div>
                {dias != null ? (
                  <div className={cn("text-[10px] font-medium", dias > 30 ? "text-danger" : "text-ink-subtle")}>
                    {dias} {dias === 1 ? "día" : "días"}
                  </div>
                ) : null}
              </td>
              <td className="px-2.5 py-2 min-w-[110px] whitespace-nowrap text-right tabular-nums">
                <div className="font-semibold text-ink text-xs sm:text-sm">{formatMoneyExact(r.totalDian)}</div>
                {r.iva ? (
                  <div className="text-[10px] text-ink-subtle" title="IVA en DIAN">
                    IVA {formatMoneyExact(r.iva)}
                  </div>
                ) : null}
              </td>
              <td className="px-2.5 py-2 min-w-[110px] whitespace-nowrap text-right tabular-nums">
                <div className="font-semibold text-ink text-xs sm:text-sm">
                  {r.hits.length ? formatMoneyExact(r.totalSiigo) : "—"}
                </div>
                {r.hits.length ? (
                  <div
                    className={cn(
                      "text-[10px] font-semibold",
                      r.diferencia === 0 ? "text-ok" : "text-danger",
                    )}
                  >
                    {r.diferencia === 0 ? "Cuadrado" : `Dif. ${formatMoneyExact(r.diferencia)}`}
                  </div>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
      {footer ? (
        <tfoot className="border-t border-line bg-bg-subtle/60 text-xs font-medium text-ink-muted">
          <tr>
            <td colSpan={!compact ? 6 : 5} className="px-3 py-2.5 text-right">
              Total DIAN visible
            </td>
            <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink whitespace-nowrap">
              {footer}
            </td>
            <td className="px-3 py-2.5" />
          </tr>
        </tfoot>
      ) : null}
    </table>

    {!compact && (
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={rows.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setCurrentPage(1);
        }}
      />
    )}

    {!compact && (
      <BatchActionsBar
        selectedRows={selectedRowsList}
        onMarkValidated={handleBatchMark}
        onExportSelected={handleBatchExport}
        onClearSelection={() => setSelectedBatchIds(new Set())}
      />
    )}
  </div>
  );
}
