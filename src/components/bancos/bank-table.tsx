import { useState, useMemo, useEffect, memo, Fragment } from "react";
import {
  Search,
  Landmark,
  Sparkles,
  Layers,
  FileText,
  Clock,
  Info,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { formatMoneyExact, formatDate } from "@/lib/format";
import type { BankConciliacionRow } from "@/lib/conciliar-bancos";
import { cn } from "@/lib/cn";

export type BankSortField =
  | "estado"
  | "fecha"
  | "descripcion"
  | "referencia"
  | "montoBanco"
  | "montoLibros"
  | "diagnostico";

export type BankSortDirection = "asc" | "desc";

interface BankTableProps {
  rows: BankConciliacionRow[];
  tabFilter: "todas" | "conciliado" | "banco_pend" | "transito";
  onSetTabFilter: (tab: "todas" | "conciliado" | "banco_pend" | "transito") => void;
  counts: {
    todas: number;
    conciliado: number;
    banco_pend: number;
    transito: number;
  };
  extractoItemsCount: number;
  effectiveMovLinesCount: number;
  onCargarDemo: () => void;
}

export const BankTable = memo(function BankTable({
  rows,
  tabFilter,
  onSetTabFilter,
  counts,
  extractoItemsCount,
  effectiveMovLinesCount,
  onCargarDemo,
}: BankTableProps) {
  // Búsqueda con debounce para alto rendimiento
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim().toLowerCase());
    }, 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Paginación inteligente
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Filtrado de filas (pestañas + búsqueda debounced)
  const filteredRows = useMemo(() => {
    let list = rows;

    if (tabFilter === "conciliado") {
      list = list.filter((r) => r.estado === "conciliado");
    } else if (tabFilter === "banco_pend") {
      list = list.filter(
        (r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco"
      );
    } else if (tabFilter === "transito") {
      list = list.filter((r) => r.estado === "partida_en_transito_libros");
    }

    if (debouncedQuery) {
      list = list.filter(
        (r) =>
          r.descripcion.toLowerCase().includes(debouncedQuery) ||
          r.referencia.toLowerCase().includes(debouncedQuery) ||
          r.fecha.includes(debouncedQuery) ||
          String(r.montoBanco).includes(debouncedQuery) ||
          String(r.montoLibros).includes(debouncedQuery) ||
          r.nota.toLowerCase().includes(debouncedQuery)
      );
    }

    return list;
  }, [rows, tabFilter, debouncedQuery]);

  // Estado de ordenamiento
  const [sortField, setSortField] = useState<BankSortField>("fecha");
  const [sortDirection, setSortDirection] = useState<BankSortDirection>("desc");

  const handleToggleSort = (field: BankSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Para montos, ordenar desc por defecto; para texto o fecha, asc o desc intuitivo
      setSortDirection(field === "montoBanco" || field === "montoLibros" ? "desc" : "asc");
    }
  };

  const handleSelectSort = (field: BankSortField) => {
    setSortField(field);
    setSortDirection(field === "montoBanco" || field === "montoLibros" ? "desc" : "asc");
  };

  // Ordenamiento de filas filtradas
  const sortedRows = useMemo(() => {
    const list = [...filteredRows];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "estado": {
          const rank = (row: BankConciliacionRow) => {
            if (row.estado === "nota_debito_banco") return 1;
            if (row.estado === "nota_credito_banco") return 2;
            if (row.estado === "partida_en_transito_libros") return 3;
            return 4;
          };
          cmp = rank(a) - rank(b);
          break;
        }
        case "fecha": {
          const fA = a.fecha || "";
          const fB = b.fecha || "";
          cmp = fA.localeCompare(fB);
          break;
        }
        case "descripcion": {
          cmp = (a.descripcion || "").localeCompare(b.descripcion || "", "es", { sensitivity: "base" });
          break;
        }
        case "referencia": {
          cmp = (a.referencia || "").localeCompare(b.referencia || "", "es", { numeric: true, sensitivity: "base" });
          break;
        }
        case "montoBanco": {
          cmp = (a.montoBanco || 0) - (b.montoBanco || 0);
          break;
        }
        case "montoLibros": {
          cmp = (a.montoLibros || 0) - (b.montoLibros || 0);
          break;
        }
        case "diagnostico": {
          cmp = (a.nota || "").localeCompare(b.nota || "", "es", { sensitivity: "base" });
          break;
        }
        default:
          cmp = 0;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filteredRows, sortField, sortDirection]);

  // Reset de página al cambiar filtros u ordenamiento
  useEffect(() => {
    setCurrentPage(1);
  }, [tabFilter, debouncedQuery, pageSize, sortField, sortDirection]);

  // Paginado de datos ordenados
  const totalPages = pageSize === 0 ? 1 : Math.ceil(sortedRows.length / pageSize) || 1;
  const pagedRows = useMemo(() => {
    if (pageSize === 0) return sortedRows;
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  return (
    <div className="space-y-3">
      {/* Barra de Filtros de Pestañas y Buscador */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-line pb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(
            [
              { id: "todas", label: `Todos (${counts.todas})` },
              { id: "conciliado", label: `Conciliados (${counts.conciliado})` },
              { id: "banco_pend", label: `Notas Banco (${counts.banco_pend})` },
              { id: "transito", label: `En Tránsito (${counts.transito})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSetTabFilter(tab.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer select-none",
                tabFilter === tab.id
                  ? "bg-teal text-white shadow-xs font-bold"
                  : "bg-bg-surface text-ink-muted hover:bg-bg-subtle hover:text-ink border border-line"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Buscador de partidas con debounce */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-muted" />
          <input
            type="text"
            placeholder="Buscar por detalle, valor..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg-surface pl-8 pr-3 py-1.5 text-xs text-ink focus:outline-teal shadow-2xs"
          />
        </div>
      </div>

      {/* Controles de Paginación Superior, Ordenamiento y Conteo */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-ink-muted">
        <div className="flex items-center gap-2">
          <span>
            Mostrando <strong>{sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> -{" "}
            <strong>{pageSize === 0 ? sortedRows.length : Math.min(currentPage * pageSize, sortedRows.length)}</strong> de{" "}
            <strong>{sortedRows.length}</strong> partidas
          </span>
        </div>

        {/* Selector de ordenamiento interactivo */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-ink-muted flex items-center gap-1">
            <ArrowUpDown className="size-3 text-teal" /> Organizar por:
          </span>
          <select
            value={sortField}
            onChange={(e) => handleSelectSort(e.target.value as BankSortField)}
            className="rounded-lg border border-line bg-bg-surface px-2.5 py-1 text-xs font-semibold text-ink focus:outline-teal shadow-2xs cursor-pointer"
          >
            <option value="fecha">Fecha</option>
            <option value="estado">Estado (Prioridad contable)</option>
            <option value="montoBanco">Monto Extracto</option>
            <option value="montoLibros">Monto Libros</option>
            <option value="descripcion">Descripción / Concepto</option>
            <option value="referencia">Referencia / Comprobante</option>
            <option value="diagnostico">Diagnóstico Contable</option>
          </select>
          <button
            type="button"
            onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg-surface hover:bg-bg-subtle px-2 py-1 text-xs font-bold text-ink cursor-pointer transition shadow-2xs"
            title={`Alternar dirección de orden (actual: ${sortDirection === "asc" ? "Ascendente" : "Descendente"})`}
          >
            {sortDirection === "asc" ? (
              <>
                <ArrowUp className="size-3 text-teal font-black" />
                <span className="text-[10px] font-extrabold uppercase">Asc</span>
              </>
            ) : (
              <>
                <ArrowDown className="size-3 text-teal font-black" />
                <span className="text-[10px] font-extrabold uppercase">Desc</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px]">Por página:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-lg border border-line bg-bg-surface px-2 py-1 text-xs font-semibold text-ink focus:outline-teal"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={0}>Todas</option>
          </select>

          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1 ml-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded-lg border border-line bg-bg-surface hover:bg-bg-subtle disabled:opacity-40 transition cursor-pointer"
                title="Página anterior"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="px-2 font-mono text-[11px] font-bold text-ink">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1 rounded-lg border border-line bg-bg-surface hover:bg-bg-subtle disabled:opacity-40 transition cursor-pointer"
                title="Página siguiente"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabla Detallada de Partidas de Conciliación Bancaria */}
      <div className="rounded-2xl border border-line bg-bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs table-auto">
            <thead className="border-b border-line bg-bg-subtle/80 uppercase tracking-wider text-ink-subtle font-semibold select-none">
              <tr>
                <th
                  onClick={() => handleToggleSort("estado")}
                  className="px-3.5 py-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group"
                  title="Clic para ordenar por Estado"
                >
                  <div className="flex items-center gap-1">
                    <span>Estado</span>
                    {sortField === "estado" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="size-3.5 text-teal" />
                      ) : (
                        <ArrowDown className="size-3.5 text-teal" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("fecha")}
                  className="px-3.5 py-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group"
                  title="Clic para ordenar por Fecha"
                >
                  <div className="flex items-center gap-1">
                    <span>Fecha</span>
                    {sortField === "fecha" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="size-3.5 text-teal" />
                      ) : (
                        <ArrowDown className="size-3.5 text-teal" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("descripcion")}
                  className="px-3.5 py-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group"
                  title="Clic para ordenar por Descripción"
                >
                  <div className="flex items-center gap-1">
                    <span>Descripción / Concepto</span>
                    {sortField === "descripcion" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="size-3.5 text-teal" />
                      ) : (
                        <ArrowDown className="size-3.5 text-teal" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("referencia")}
                  className="px-3.5 py-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group"
                  title="Clic para ordenar por Referencia / Documento"
                >
                  <div className="flex items-center gap-1">
                    <span>Referencia</span>
                    {sortField === "referencia" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="size-3.5 text-teal" />
                      ) : (
                        <ArrowDown className="size-3.5 text-teal" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("montoBanco")}
                  className="px-3.5 py-3 text-right cursor-pointer hover:bg-bg-surface hover:text-ink transition group"
                  title="Clic para ordenar por Monto de Extracto"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Monto Extracto</span>
                    {sortField === "montoBanco" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="size-3.5 text-teal" />
                      ) : (
                        <ArrowDown className="size-3.5 text-teal" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("montoLibros")}
                  className="px-3.5 py-3 text-right cursor-pointer hover:bg-bg-surface hover:text-ink transition group"
                  title="Clic para ordenar por Monto en Libros"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Monto Libros</span>
                    {sortField === "montoLibros" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="size-3.5 text-teal" />
                      ) : (
                        <ArrowDown className="size-3.5 text-teal" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleToggleSort("diagnostico")}
                  className="px-3.5 py-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group"
                  title="Clic para ordenar por Diagnóstico Contable"
                >
                  <div className="flex items-center gap-1">
                    <span>Diagnóstico Contable</span>
                    {sortField === "diagnostico" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="size-3.5 text-teal" />
                      ) : (
                        <ArrowDown className="size-3.5 text-teal" />
                      )
                    ) : (
                      <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                    )}
                  </div>
                </th>
                <th className="px-3.5 py-3 text-center">Auditoría / Rastrear</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-xs text-ink-muted">
                    {extractoItemsCount === 0 && effectiveMovLinesCount === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Landmark className="size-8 text-teal opacity-60" />
                        <p className="font-bold text-ink text-sm">Plantilla en blanco lista para conciliar</p>
                        <p className="text-ink-muted max-w-md">
                          Sube tu extracto bancario (PDF o Excel) y tu auxiliar de movimientos contables arriba para conciliar en segundos.
                        </p>
                        <button
                          type="button"
                          onClick={onCargarDemo}
                          className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-teal/40 bg-teal-soft px-3.5 py-1.5 text-xs font-bold text-teal hover:bg-teal hover:text-white transition cursor-pointer"
                        >
                          <Sparkles className="size-3.5" />
                          <span>Cargar datos de demostración</span>
                        </button>
                      </div>
                    ) : (
                      "No se encontraron partidas con los filtros seleccionados."
                    )}
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => {
                  const isExpanded = expandedRowId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr className="hover:bg-bg-subtle/40 transition">
                        <td className="px-3.5 py-2.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-black border shadow-2xs",
                              r.estado === "conciliado"
                                ? r.itemsLibrosLote
                                  ? "bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-700"
                                  : r.esGmf
                                  ? "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700"
                                  : "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700"
                                : r.esGmf
                                ? "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700 font-extrabold"
                                : r.esComision
                                ? "bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-700 font-extrabold"
                                : r.esRendimiento
                                ? "bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950/80 dark:text-teal-200 dark:border-teal-700 font-extrabold"
                                : r.estado === "partida_en_transito_libros"
                                ? "bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700 font-extrabold"
                                : "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block size-1.5 rounded-full",
                                r.estado === "conciliado"
                                  ? r.itemsLibrosLote
                                    ? "bg-purple-600 dark:bg-purple-400"
                                    : r.esGmf
                                    ? "bg-amber-600 dark:bg-amber-400"
                                    : "bg-emerald-600 dark:bg-emerald-400"
                                  : r.esGmf
                                  ? "bg-amber-600 dark:bg-amber-400"
                                  : r.esComision
                                  ? "bg-blue-600 dark:bg-blue-400"
                                  : r.esRendimiento
                                  ? "bg-teal-600 dark:bg-teal-400"
                                  : "bg-rose-600 dark:bg-rose-400"
                              )}
                            />
                            {r.estado === "conciliado"
                              ? r.itemsLibrosLote
                                ? `Lote ACH (${r.itemsLibrosLote.length})`
                                : r.esGmf
                                ? "GMF 4x1000 Conciliado"
                                : r.esRendimiento
                                ? "Rendimiento Conciliado"
                                : "Conciliado"
                              : r.esGmf
                              ? "GMF 4x1000"
                              : r.esComision
                              ? "Comisión Banco"
                              : r.esRendimiento
                              ? "Rendimiento"
                              : "En Tránsito"}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-ink-muted whitespace-nowrap">
                          {formatDate(r.fecha)}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-ink max-w-80 truncate" title={r.descripcion}>
                          {r.esGmf && (
                            <span className="mr-1.5 inline-block text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300">
                              GMF 4x1000
                            </span>
                          )}
                          {r.descripcion}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-ink-subtle whitespace-nowrap">
                          {r.referencia || "—"}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-right text-ink whitespace-nowrap">
                          {r.montoBanco > 0 ? formatMoneyExact(r.montoBanco) : "—"}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-right text-ink whitespace-nowrap">
                          {r.montoLibros > 0 ? formatMoneyExact(r.montoLibros) : "—"}
                        </td>
                        <td className="px-3.5 py-2.5 text-ink-muted leading-tight max-w-80">
                          {r.nota}
                        </td>
                        <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                          {r.itemsLibrosLote && r.itemsLibrosLote.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-300 dark:bg-purple-950/60 dark:hover:bg-purple-900 dark:text-purple-200 dark:border-purple-700 px-2.5 py-1 text-xs font-bold transition cursor-pointer shadow-2xs"
                              title="Rastrear los comprobantes contables agrupados en este lote"
                            >
                              <Layers className="size-3.5 text-purple-600" />
                              <span>Rastrear ({r.itemsLibrosLote.length})</span>
                              <ChevronDown className={cn("size-3 transition-transform duration-200", isExpanded && "rotate-180")} />
                            </button>
                          ) : r.itemLibros ? (
                            <button
                              type="button"
                              onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-bg-subtle hover:bg-teal-soft/60 text-ink hover:text-teal border border-line px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                              title="Rastrear comprobante contable en libros"
                            >
                              <FileText className="size-3.5 text-teal" />
                              <span>{r.itemLibros.comprobante ? `Comp. ${r.itemLibros.comprobante}` : "Rastrear"}</span>
                              <ChevronDown className={cn("size-3 transition-transform duration-200", isExpanded && "rotate-180")} />
                            </button>
                          ) : r.estado === "partida_en_transito_libros" ? (
                            <button
                              type="button"
                              onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                            >
                              <Clock className="size-3.5 text-rose-600" />
                              <span>En Tránsito</span>
                              <ChevronDown className={cn("size-3 transition-transform duration-200", isExpanded && "rotate-180")} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                            >
                              <Info className="size-3.5 text-amber-600" />
                              <span>Sugerencia PUC</span>
                              <ChevronDown className={cn("size-3 transition-transform duration-200", isExpanded && "rotate-180")} />
                            </button>
                          )}
                        </td>
                      </tr>

                      {/* Fila Expandida de Auditoría y Rastreo */}
                      {isExpanded && (
                        <tr className="bg-bg-subtle/50 border-b border-line animate-in fade-in duration-150">
                          <td colSpan={8} className="p-3.5">
                            {r.itemsLibrosLote && r.itemsLibrosLote.length > 0 ? (
                              <div className="rounded-xl border border-purple-300 bg-purple-50/50 dark:bg-purple-950/30 dark:border-purple-800 p-4 space-y-3 shadow-2xs">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-purple-200 dark:border-purple-800 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-lg bg-purple-600 text-white p-1.5 shadow-2xs">
                                      <Layers className="size-4" />
                                    </span>
                                    <div>
                                      <div className="font-bold text-xs text-purple-950 dark:text-purple-200">
                                        Rastreo y Auditoría del Lote Bancario ({r.itemsLibrosLote.length} Comprobantes Contables Individuales)
                                      </div>
                                      <p className="text-[11px] text-purple-800 dark:text-purple-300">
                                        El extracto bancario consolidó un débito total de <strong>{formatMoneyExact(r.montoBanco)}</strong> que canceló individualmente cada uno de estos registros en libros contables.
                                      </p>
                                    </div>
                                  </div>
                                  <div className="font-mono text-xs font-extrabold text-purple-950 dark:text-purple-200 bg-purple-200/80 dark:bg-purple-900/60 px-3 py-1 rounded-lg border border-purple-300 dark:border-purple-700">
                                    Total Lote: {formatMoneyExact(r.itemsLibrosLote.reduce((a, b) => a + (r.tipo === "retiro" ? b.credito : b.debito), 0))} · Diferencia: $0,00
                                  </div>
                                </div>

                                <div className="overflow-x-auto rounded-lg border border-purple-200 dark:border-purple-800 bg-bg-surface">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-purple-100/60 dark:bg-purple-950/60 text-purple-950 dark:text-purple-200 font-semibold border-b border-purple-200 dark:border-purple-800">
                                      <tr>
                                        <th className="px-3 py-2">Comprobante</th>
                                        <th className="px-3 py-2">Fecha</th>
                                        <th className="px-3 py-2">Cuenta PUC</th>
                                        <th className="px-3 py-2">Tercero / Beneficiario</th>
                                        <th className="px-3 py-2">Detalle / Concepto en Libros</th>
                                        <th className="px-3 py-2">Cruce / Ref.</th>
                                        <th className="px-3 py-2 text-right">Monto Contabilizado</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-purple-100 dark:divide-purple-900/30">
                                      {r.itemsLibrosLote.map((c, cIdx) => (
                                        <tr key={[c.comprobante, c.fecha, cIdx].filter(Boolean).join("-")} className="hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition">
                                          <td className="px-3 py-2 font-mono font-bold text-purple-950 dark:text-purple-300">
                                            {c.comprobante || "—"}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-ink-muted">
                                            {formatDate(c.fecha)}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-ink-muted">
                                            {c.cuenta} <span className="text-[10px] text-ink-subtle">({c.cuentaNombre})</span>
                                          </td>
                                          <td className="px-3 py-2 text-ink">
                                            <span className="font-semibold">{c.nombre || "—"}</span>
                                            {c.nit && <span className="text-[10px] text-ink-subtle block font-mono">NIT: {c.nit}</span>}
                                          </td>
                                          <td className="px-3 py-2 text-ink-muted max-w-65 truncate" title={c.descripcion}>
                                            {c.descripcion}
                                          </td>
                                          <td className="px-3 py-2 font-mono text-ink-subtle">
                                            {c.cruce || c.referencia || "—"}
                                          </td>
                                          <td className="px-3 py-2 font-mono font-bold text-right text-ink">
                                            {formatMoneyExact(r.tipo === "retiro" ? c.credito : c.debito)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : r.itemLibros ? (
                              <div className="rounded-xl border border-teal-300 bg-teal-50/40 dark:bg-teal-950/30 dark:border-teal-800 p-4 space-y-2 shadow-2xs">
                                <div className="flex items-center justify-between border-b border-teal-200 dark:border-teal-800 pb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-lg bg-teal text-white p-1.5 shadow-2xs">
                                      <FileText className="size-4" />
                                    </span>
                                    <div className="font-bold text-xs text-teal-950 dark:text-teal-200">
                                      Rastreo de Comprobante Contable en Libros (Coincidencia 1 a 1)
                                    </div>
                                  </div>
                                  <span className="text-[11px] font-mono font-bold text-teal bg-teal-soft/80 px-2.5 py-0.5 rounded-md border border-teal/30">
                                    Diferencia: $0,00 · Conciliado
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
                                  <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                    <span className="text-ink-muted block text-[11px]">Comprobante Contable:</span>
                                    <span className="font-mono font-bold text-ink text-xs">{r.itemLibros.comprobante || "Sin número"}</span>
                                  </div>
                                  <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                    <span className="text-ink-muted block text-[11px]">Fecha en Libros:</span>
                                    <span className="font-mono font-bold text-ink text-xs">{formatDate(r.itemLibros.fecha)}</span>
                                  </div>
                                  <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                    <span className="text-ink-muted block text-[11px]">Cuenta PUC:</span>
                                    <span className="font-mono text-ink text-xs font-semibold">{r.itemLibros.cuenta} - {r.itemLibros.cuentaNombre}</span>
                                  </div>
                                  <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                    <span className="text-ink-muted block text-[11px]">Tercero / Beneficiario:</span>
                                    <span className="text-ink font-semibold text-xs">{r.itemLibros.nombre} {r.itemLibros.nit ? `(NIT: ${r.itemLibros.nit})` : ""}</span>
                                  </div>
                                  <div className="bg-bg-surface p-2 rounded-lg border border-line sm:col-span-2">
                                    <span className="text-ink-muted block text-[11px]">Glosa / Concepto en Libros:</span>
                                    <span className="text-ink text-xs">{r.itemLibros.descripcion}</span>
                                  </div>
                                  <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                    <span className="text-ink-muted block text-[11px]">Documento Fuente / Cruce:</span>
                                    <span className="font-mono text-ink text-xs">{r.itemLibros.cruce || r.itemLibros.referencia || "—"}</span>
                                  </div>
                                  <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                    <span className="text-ink-muted block text-[11px]">Monto en Contabilidad:</span>
                                    <span className="font-mono font-bold text-teal text-xs">{formatMoneyExact(r.montoLibros)}</span>
                                  </div>
                                </div>
                              </div>
                            ) : r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco" ? (
                              <div className="rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-xs space-y-2 shadow-2xs">
                                <div className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                                  <AlertCircle className="size-4 text-amber-600" />
                                  <span>Instrucción Contable para Causación de Partida Pendiente</span>
                                </div>
                                <p className="text-amber-900 dark:text-amber-300">
                                  {r.nota}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                                  <div className="bg-bg-surface p-2 rounded border border-amber-200">
                                    <span className="text-ink-muted block">Cuenta Sugerida:</span>
                                    <span className="font-bold text-ink">
                                      {r.esGmf ? "511595 (GMF 4x1000)" : r.esComision ? "530515 (Comisiones Bancarias)" : r.esRendimiento ? "421005 (Rendimientos Financieros)" : "111005 (Bancos)"}
                                    </span>
                                  </div>
                                  <div className="bg-bg-surface p-2 rounded border border-amber-200">
                                    <span className="text-ink-muted block">Monto en Extracto:</span>
                                    <span className="font-bold text-amber-900">{formatMoneyExact(r.montoBanco)}</span>
                                  </div>
                                  <div className="bg-bg-surface p-2 rounded border border-amber-200">
                                    <span className="text-ink-muted block">Contrapartida:</span>
                                    <span className="font-bold text-ink">Cuenta Bancaria de Tesorería</span>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});
