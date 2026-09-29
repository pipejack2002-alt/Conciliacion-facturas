import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

export function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [50, 100, 250],
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = pageSize === 0 ? totalItems : Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg-surface/80 px-4 py-2.5 text-xs text-ink-muted">
      {/* Información de Registros */}
      <div className="flex items-center gap-2">
        <span>
          Mostrando{" "}
          <strong className="font-semibold text-ink">
            {pageSize === 0 ? `todos los ${totalItems}` : `${startItem} - ${endItem}`}
          </strong>{" "}
          de <strong className="font-semibold text-ink">{totalItems}</strong> registros
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Selector de Filas por Página */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-ink-subtle">Filas por página:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-line bg-bg-surface px-2 py-1 text-xs font-semibold text-ink focus:outline-teal cursor-pointer shadow-2xs"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value={0}>Todas</option>
          </select>
        </div>

        {/* Controles de Navegación de Página (sólo si no es "Todas") */}
        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <span className="mr-2 text-[11px] text-ink-subtle">
              Página <strong className="text-ink">{currentPage}</strong> de{" "}
              <strong className="text-ink">{totalPages}</strong>
            </span>

            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(1)}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-line bg-bg-surface text-ink hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
              title="Primera página"
            >
              <ChevronsLeft className="size-3.5" />
            </button>

            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-line bg-bg-surface text-ink hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
              title="Página anterior"
            >
              <ChevronLeft className="size-3.5" />
            </button>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-line bg-bg-surface text-ink hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
              title="Página siguiente"
            >
              <ChevronRight className="size-3.5" />
            </button>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(totalPages)}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-line bg-bg-surface text-ink hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition shadow-2xs cursor-pointer"
              title="Última página"
            >
              <ChevronsRight className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
