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
  Scale,
  CheckCircle2,
} from "lucide-react";
import { formatMoneyExact, formatDate } from "@/lib/format";
import type { BankConciliacionRow } from "@/lib/conciliar-bancos";
import type { MovLine } from "@/lib/types";
import { AsientoContableModal } from "./asiento-contable-modal";
import { resolveVoucherFullEntry } from "@/lib/voucher-entry-resolver";
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
  allMovLines?: MovLine[];
  cuentaContable?: string;
  bancoNombre?: string;
}

export const BankTable = memo(function BankTable({
  rows,
  tabFilter,
  onSetTabFilter,
  counts,
  extractoItemsCount,
  effectiveMovLinesCount,
  onCargarDemo,
  allMovLines = [],
  cuentaContable,
  bancoNombre,
}: BankTableProps) {
  // Búsqueda con debounce para alto rendimiento
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [modalRow, setModalRow] = useState<BankConciliacionRow | null>(null);

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
                  className="px-3.5 py-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap min-w-[130px]"
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
                        <td className="px-3.5 py-2.5 whitespace-nowrap min-w-[130px]">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold border shadow-2xs whitespace-nowrap shrink-0",
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
                                "inline-block size-1.5 rounded-full shrink-0",
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
                                ? "GMF 4x1000"
                                : r.esRendimiento
                                ? "Rendimiento"
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
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setModalRow(r)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-purple-700 hover:bg-purple-800 text-white px-2.5 py-1 text-xs font-bold transition cursor-pointer shadow-xs"
                                    >
                                      <FileText className="size-3.5" />
                                      <span>Ver Asientos en Modal</span>
                                    </button>
                                    <div className="font-mono text-xs font-extrabold text-purple-950 dark:text-purple-200 bg-purple-200/80 dark:bg-purple-900/60 px-3 py-1 rounded-lg border border-purple-300 dark:border-purple-700">
                                      Total: {formatMoneyExact(r.itemsLibrosLote.reduce((a, b) => a + (r.tipo === "retiro" ? b.credito : b.debito), 0))}
                                    </div>
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
                                        <th className="px-3 py-2 text-center">Acción</th>
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
                                          <td className="px-3 py-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => setModalRow({ ...r, itemLibros: c })}
                                              className="inline-flex items-center gap-1 rounded bg-purple-100 hover:bg-purple-200 text-purple-900 px-2 py-0.5 text-[10px] font-bold transition cursor-pointer"
                                              title="Ver todas las cuentas del comprobante"
                                            >
                                              Asiento
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : r.itemLibros ? (() => {
                              const resolved = resolveVoucherFullEntry(
                                r.itemLibros.comprobante || "",
                                r.itemLibros,
                                allMovLines,
                                r
                              );
                              const voucherLines = resolved.lines;
                              const isCuadrado = resolved.isPartidaDobleCuadrada;

                              return (
                                <div className="rounded-xl border border-teal-300 bg-teal-50/40 dark:bg-teal-950/30 dark:border-teal-800 p-4 space-y-3 shadow-2xs">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-teal-200 dark:border-teal-800 pb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-lg bg-teal text-white p-1.5 shadow-2xs">
                                        <FileText className="size-4" />
                                      </span>
                                      <div>
                                        <div className="font-bold text-xs text-teal-950 dark:text-teal-200">
                                          Asiento Contable en Libros · Comprobante {resolved.comprobante} ({voucherLines.length} registros)
                                        </div>
                                        <div className="text-[11px] text-ink-muted">
                                          {resolved.terceroNombre ? `${resolved.terceroNombre} · ` : ""}
                                          {resolved.terceroNit ? `NIT: ${resolved.terceroNit} · ` : ""}
                                          Fecha: {formatDate(resolved.fecha)}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isCuadrado && (
                                        <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-300 flex items-center gap-1 shadow-2xs">
                                          <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                                          Partida Doble Cuadrada
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setModalRow(r)}
                                        className="inline-flex items-center gap-1 rounded-lg bg-teal hover:bg-teal-deep text-white px-2.5 py-1 text-xs font-bold transition cursor-pointer shadow-xs"
                                        title="Abrir vista maximizada de este asiento contable"
                                      >
                                        <FileText className="size-3.5" />
                                        <span>Maximizar Asiento</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Franja Destacada de Contrapartida Contable */}
                                  {resolved.contrapartidaResumen && (
                                    <div className="rounded-lg bg-teal-100/70 dark:bg-teal-900/40 px-3 py-2 border border-teal-300 dark:border-teal-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                      <div className="flex items-center gap-2 text-teal-950 dark:text-teal-100">
                                        <Scale className="size-4 text-teal shrink-0" />
                                        <div>
                                          <span className="font-extrabold text-teal-950 dark:text-teal-100">Contrapartida: </span>
                                          <span className="font-medium text-teal-900 dark:text-teal-200">{resolved.contrapartidaResumen.descripcionCruce}</span>
                                        </div>
                                      </div>
                                      {resolved.contrapartidaResumen.esDeducida && (
                                        <span className="text-[10px] font-semibold text-teal-800 dark:text-teal-300 self-start sm:self-auto bg-teal-200/50 dark:bg-teal-950/50 px-2 py-0.5 rounded">
                                          Deducida de movimiento
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Tabla del Asiento Contable Completo */}
                                  <div className="overflow-x-auto rounded-lg border border-teal-200 dark:border-teal-800 bg-bg-surface">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-teal-100/60 dark:bg-teal-950/60 text-teal-950 dark:text-teal-200 font-semibold border-b border-teal-200 dark:border-teal-800">
                                        <tr>
                                          <th className="px-3 py-2">Cuenta PUC</th>
                                          <th className="px-3 py-2">Nombre Cuenta</th>
                                          <th className="px-3 py-2">Tercero / NIT</th>
                                          <th className="px-3 py-2">Concepto / Glosa</th>
                                          <th className="px-3 py-2">Cruce / Ref</th>
                                          <th className="px-3 py-2 text-right">Débito (COP)</th>
                                          <th className="px-3 py-2 text-right">Crédito (COP)</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-teal-100 dark:divide-teal-900/30">
                                        {voucherLines.map((line, lIdx) => {
                                          const isBank = line.esBanco;
                                          return (
                                            <tr
                                              key={[line.cuenta, line.debito, line.credito, lIdx].join("-")}
                                              className={`hover:bg-teal-50/50 dark:hover:bg-teal-950/20 transition ${
                                                isBank ? "bg-teal-50/30 font-semibold" : ""
                                              }`}
                                            >
                                              <td className="px-3 py-2 font-mono text-ink">
                                                <span className={isBank ? "text-teal font-bold" : ""}>{line.cuenta}</span>
                                                {line.esContrapartidaDeducida && (
                                                  <span className="block text-[10px] text-teal font-medium">
                                                    (Contrapartida Cruce)
                                                  </span>
                                                )}
                                              </td>
                                              <td className="px-3 py-2 font-medium text-ink max-w-44 truncate" title={line.cuentaNombre}>
                                                {line.cuentaNombre}
                                              </td>
                                              <td className="px-3 py-2 text-ink max-w-40 truncate" title={line.nombre}>
                                                <span>{line.nombre || "—"}</span>
                                                {line.nit && <span className="block text-[10px] text-ink-subtle font-mono">NIT: {line.nit}</span>}
                                              </td>
                                              <td className="px-3 py-2 text-ink-muted max-w-56 truncate" title={line.descripcion}>
                                                {line.descripcion}
                                              </td>
                                              <td className="px-3 py-2 font-mono text-ink-subtle">
                                                {line.cruce || "—"}
                                              </td>
                                              <td className="px-3 py-2 font-mono font-bold text-right text-ink">
                                                {line.debito > 0 ? formatMoneyExact(line.debito) : "—"}
                                              </td>
                                              <td className="px-3 py-2 font-mono font-bold text-right text-ink">
                                                {line.credito > 0 ? formatMoneyExact(line.credito) : "—"}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                      <tfoot className="bg-teal-100/40 dark:bg-teal-950/40 font-bold border-t border-teal-200 dark:border-teal-800">
                                        <tr>
                                          <td colSpan={5} className="px-3 py-1.5 text-right text-teal-950 dark:text-teal-200">
                                            Sumas Iguales:
                                          </td>
                                          <td className="px-3 py-1.5 font-mono text-right text-teal-950 dark:text-teal-200">
                                            {formatMoneyExact(resolved.totalDebito)}
                                          </td>
                                          <td className="px-3 py-1.5 font-mono text-right text-teal-950 dark:text-teal-200">
                                            {formatMoneyExact(resolved.totalCredito)}
                                          </td>
                                        </tr>
                                      </tfoot>
                                    </table>
                                  </div>
                                </div>
                              );
                            })() : r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco" ? (
                              <div className="rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-xs space-y-3 shadow-2xs">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-amber-200 dark:border-amber-800 pb-2">
                                  <div className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                                    <AlertCircle className="size-4 text-amber-600" />
                                    <span>Partida Pendiente en Libros · Asiento Contable Sugerido para Causación</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setModalRow(r)}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 text-xs font-bold transition cursor-pointer shadow-xs"
                                  >
                                    <FileText className="size-3.5" />
                                    <span>Ver / Descargar Asiento</span>
                                  </button>
                                </div>

                                <p className="text-amber-900 dark:text-amber-300">
                                  {r.nota}
                                </p>

                                {/* Tabla de Asiento Sugerido */}
                                <div className="overflow-x-auto rounded-lg border border-amber-200 dark:border-amber-800 bg-bg-surface">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-amber-100/60 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 font-semibold border-b border-amber-200">
                                      <tr>
                                        <th className="px-3 py-1.5">Cuenta PUC</th>
                                        <th className="px-3 py-1.5">Concepto Contable</th>
                                        <th className="px-3 py-1.5">Tercero Sugerido</th>
                                        <th className="px-3 py-1.5 text-right">Débito (COP)</th>
                                        <th className="px-3 py-1.5 text-right">Crédito (COP)</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-amber-100">
                                      {r.estado === "nota_debito_banco" ? (
                                        <>
                                          <tr>
                                            <td className="px-3 py-1.5 font-mono font-bold text-amber-900">
                                              {r.esGmf ? "51159501" : r.esComision ? "53051501" : "53059501"}
                                            </td>
                                            <td className="px-3 py-1.5 text-ink">
                                              {r.esGmf ? "GMF 4x1000" : r.esComision ? "Comisión Bancaria" : "Gasto Bancario"}
                                            </td>
                                            <td className="px-3 py-1.5 text-ink-muted">
                                              {r.esGmf ? "DIAN" : bancoNombre || "Banco"}
                                            </td>
                                            <td className="px-3 py-1.5 font-mono font-bold text-right text-ink">
                                              {formatMoneyExact(r.montoBanco)}
                                            </td>
                                            <td className="px-3 py-1.5 font-mono text-right text-ink-subtle">—</td>
                                          </tr>
                                          <tr>
                                            <td className="px-3 py-1.5 font-mono font-bold text-teal">
                                              {cuentaContable || "111005"}
                                            </td>
                                            <td className="px-3 py-1.5 text-ink">Bancos Moneda Nacional</td>
                                            <td className="px-3 py-1.5 text-ink-muted">{bancoNombre || "Banco"}</td>
                                            <td className="px-3 py-1.5 font-mono text-right text-ink-subtle">—</td>
                                            <td className="px-3 py-1.5 font-mono font-bold text-right text-ink">
                                              {formatMoneyExact(r.montoBanco)}
                                            </td>
                                          </tr>
                                        </>
                                      ) : (
                                        <>
                                          <tr>
                                            <td className="px-3 py-1.5 font-mono font-bold text-teal">
                                              {cuentaContable || "111005"}
                                            </td>
                                            <td className="px-3 py-1.5 text-ink">Bancos Moneda Nacional</td>
                                            <td className="px-3 py-1.5 text-ink-muted">{bancoNombre || "Banco"}</td>
                                            <td className="px-3 py-1.5 font-mono font-bold text-right text-ink">
                                              {formatMoneyExact(r.montoBanco)}
                                            </td>
                                            <td className="px-3 py-1.5 font-mono text-right text-ink-subtle">—</td>
                                          </tr>
                                          <tr>
                                            <td className="px-3 py-1.5 font-mono font-bold text-amber-900">
                                              {r.esRendimiento ? "42100502" : "13050501"}
                                            </td>
                                            <td className="px-3 py-1.5 text-ink">
                                              {r.esRendimiento ? "Rendimientos Financieros" : "Clientes / Anticipos"}
                                            </td>
                                            <td className="px-3 py-1.5 text-ink-muted">
                                              {r.esRendimiento ? bancoNombre || "Banco" : "Clientes Varios"}
                                            </td>
                                            <td className="px-3 py-1.5 font-mono text-right text-ink-subtle">—</td>
                                            <td className="px-3 py-1.5 font-mono font-bold text-right text-ink">
                                              {formatMoneyExact(r.montoBanco)}
                                            </td>
                                          </tr>
                                        </>
                                      )}
                                    </tbody>
                                  </table>
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

      {/* Modal Completo de Auditoría del Asiento Contable */}
      {modalRow && (
        <AsientoContableModal
          open={Boolean(modalRow)}
          onClose={() => setModalRow(null)}
          row={modalRow}
          allMovLines={allMovLines}
          cuentaContable={cuentaContable}
          bancoNombre={bancoNombre}
        />
      )}
    </div>
  );
});
