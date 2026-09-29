import { CheckCircle2, XCircle, FileSpreadsheet, X } from "lucide-react";
import type { ConciliacionRow } from "@/lib/types";

interface BatchActionsBarProps {
  selectedRows: ConciliacionRow[];
  onMarkValidated: (action: "validada" | "omitir") => void;
  onExportSelected: () => void;
  onClearSelection: () => void;
}

export function BatchActionsBar({
  selectedRows,
  onMarkValidated,
  onExportSelected,
  onClearSelection,
}: BatchActionsBarProps) {
  if (selectedRows.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border-2 border-teal-600 bg-bg-surface/95 px-5 py-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-2 border-r border-line pr-3">
        <span className="flex size-6 items-center justify-center rounded-full bg-teal text-white text-xs font-black">
          {selectedRows.length}
        </span>
        <span className="text-xs font-bold text-ink">
          {selectedRows.length === 1 ? "partida seleccionada" : "partidas seleccionadas"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onMarkValidated("validada")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-deep transition shadow-xs cursor-pointer"
          title="Marcar todas las facturas seleccionadas como validadas (revisadas)"
        >
          <CheckCircle2 className="size-3.5" />
          <span>Validar ({selectedRows.length})</span>
        </button>

        <button
          type="button"
          onClick={() => onMarkValidated("omitir")}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-bg-surface px-3 py-1.5 text-xs font-semibold text-ink-muted hover:text-ink hover:bg-bg-subtle transition shadow-2xs cursor-pointer"
          title="Desmarcar validación de las seleccionadas"
        >
          <XCircle className="size-3.5" />
          <span>Desmarcar</span>
        </button>

        <button
          type="button"
          onClick={onExportSelected}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-bg-surface px-3 py-1.5 text-xs font-semibold text-ink hover:text-teal hover:border-teal transition shadow-2xs cursor-pointer"
          title="Exportar únicamente las filas seleccionadas a un libro de Excel"
        >
          <FileSpreadsheet className="size-3.5 text-ok" />
          <span>Exportar ({selectedRows.length})</span>
        </button>

        <button
          type="button"
          onClick={onClearSelection}
          className="ml-2 inline-flex size-7 items-center justify-center rounded-lg text-ink-subtle hover:text-ink hover:bg-bg-subtle transition cursor-pointer"
          title="Cancelar y deseleccionar todo"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
