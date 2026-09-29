import { useEffect, useMemo, useState, useRef } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, Filter } from "lucide-react";
import { useConciliacion, type SortId } from "@/lib/store";
import { cn } from "@/lib/cn";

export function ColumnHeader({
  columnKey,
  title,
  align = "left",
  className,
  renderFilter,
}: {
  columnKey: SortId;
  title: string;
  align?: "left" | "right";
  className?: string;
  renderFilter?: (close: () => void) => React.ReactNode;
}) {
  const sort = useConciliacion((s) => s.sort);
  const sortDirection = useConciliacion((s) => s.sortDirection);
  const toggleSort = useConciliacion((s) => s.toggleSort);
  const columnFilters = useConciliacion((s) => s.columnFilters);
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isSorted = sort === columnKey || (columnKey === "dian" && sort === "monto");

  const hasFilterActive = useMemo(() => {
    if (columnKey === "estado") return Boolean(columnFilters.estado && columnFilters.estado.length > 0);
    if (columnKey === "documento") return Boolean(columnFilters.tipo && columnFilters.tipo.length > 0);
    if (columnKey === "proveedor") return Boolean(columnFilters.proveedor && columnFilters.proveedor.trim().length > 0);
    if (columnKey === "cufe") return columnFilters.hasCufe != null;
    if (columnKey === "fecha") return Boolean(columnFilters.fechaRange && columnFilters.fechaRange !== "all");
    if (columnKey === "dian" || columnKey === "monto") return Boolean(columnFilters.montoRange && columnFilters.montoRange !== "all");
    return false;
  }, [columnKey, columnFilters]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  return (
    <th
      className={cn(
        "relative px-2.5 py-2 font-semibold transition-colors select-none text-[11px] sm:text-xs uppercase tracking-wider",
        align === "right" ? "text-right" : "text-left",
        isSorted ? "bg-teal-soft/40 text-teal font-bold" : "text-ink-subtle",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex items-center gap-1 group",
          align === "right" && "justify-end flex-row-reverse",
        )}
      >
        <button
          type="button"
          onClick={() => toggleSort(columnKey)}
          className={cn(
            "inline-flex items-center gap-1 transition-colors cursor-pointer text-inherit font-inherit whitespace-nowrap",
            isSorted ? "text-teal" : "hover:text-teal",
            align === "right" && "flex-row-reverse",
          )}
          title={
            isSorted
              ? `Orden actual: ${sortDirection === "asc" ? "Menor a mayor / A-Z" : "Mayor a menor / Z-A"}. Clic para alternar dirección.`
              : `Clic para ordenar por ${title}`
          }
        >
          <span className="font-bold uppercase tracking-wider whitespace-nowrap">{title}</span>
          <span className="shrink-0 inline-flex items-center">
            {isSorted ? (
              sortDirection === "asc" ? (
                <ArrowUp className="size-3.5 text-teal animate-in zoom-in-50 duration-150" />
              ) : (
                <ArrowDown className="size-3.5 text-teal animate-in zoom-in-50 duration-150" />
              )
            ) : (
              <ArrowUpDown className="size-3 text-ink-subtle/40 opacity-0 group-hover:opacity-100 group-hover:text-teal transition-all" />
            )}
          </span>
        </button>

        {renderFilter ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            title={
              hasFilterActive
                ? `Filtro activo en ${title}. Clic para ver o cambiar.`
                : `Filtrar y opciones de ${title}`
            }
            className={cn(
              "relative rounded p-1 transition-all cursor-pointer",
              hasFilterActive
                ? "bg-teal text-bg-elevated shadow-xs ring-2 ring-teal/30"
                : "text-ink-subtle/50 hover:bg-teal-soft hover:text-teal group-hover:opacity-100 opacity-60",
              open && "bg-teal-soft text-teal opacity-100",
            )}
          >
            <Filter className="size-3" />
            {hasFilterActive && (
              <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-amber-400 ring-1 ring-white" />
            )}
          </button>
        ) : null}
      </div>

      {open && renderFilter ? (
        <div
          ref={popoverRef}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "absolute top-full mt-1.5 z-30 min-w-64 max-w-xs rounded-xl border border-line bg-bg-surface p-3.5 shadow-xl text-ink font-normal normal-case text-xs tracking-normal select-text animate-in fade-in-50 zoom-in-95 duration-150",
            align === "right" ? "right-2" : "left-2",
          )}
        >
          {renderFilter(() => setOpen(false))}
        </div>
      ) : null}
    </th>
  );
}
