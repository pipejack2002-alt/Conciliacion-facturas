import { useState, useEffect, useRef } from "react";
import {
  X,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Trash2,
  ArrowRight,
  FolderOpen,
  AlertCircle,
  Download,
  Upload,
  Search,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import {
  getHistoryEntries,
  deleteHistoryEntry,
  clearAllHistory,
  exportHistoryJson,
  importHistoryJson,
  type HistoryEntry,
} from "@/lib/history-store";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectEntry: (entry: HistoryEntry) => void;
}

export function HistoryModal({ open, onClose, onSelectEntry }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setEntries(getHistoryEntries());
      setFeedback(null);
    }
  }, [open]);

  if (!open) return null;

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = deleteHistoryEntry(id);
    setEntries(updated);
  }

  function handleClearAll() {
    if (window.confirm("¿Está seguro de eliminar todo el historial de conciliaciones guardadas?")) {
      clearAllHistory();
      setEntries([]);
      setFeedback({ msg: "Historial vaciado correctamente.", type: "ok" });
    }
  }

  function handleExport() {
    exportHistoryJson();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const res = importHistoryJson(content);
      if (res.success) {
        setEntries(getHistoryEntries());
        setFeedback({ msg: `✅ Se importaron y restauraron ${res.count} sesiones exitosamente.`, type: "ok" });
      } else {
        setFeedback({ msg: `❌ Error al importar: ${res.error || "Formato no válido"}`, type: "err" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const filteredEntries = entries.filter((e) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      (e.company?.nombre || "").toLowerCase().includes(q) ||
      (e.company?.nit || "").includes(q) ||
      (e.periodLabel || "").toLowerCase().includes(q) ||
      (e.dianName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-line bg-bg-surface shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/10 text-teal">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">
                Historial de Sesiones Multi-Empresa
              </h2>
              <p className="text-xs text-ink-muted">
                Consulte, recupere o descargue copias de seguridad de sus auditorías previas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink hover:border-teal hover:text-teal transition"
              title="Restaurar sesiones desde un archivo JSON de respaldo"
            >
              <Upload className="size-3.5 text-teal" />
              Importar copia
            </button>

            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink hover:border-teal hover:text-teal transition"
                title="Descargar copia de seguridad en JSON de todas las sesiones"
              >
                <Download className="size-3.5 text-teal" />
                Exportar respaldo
              </button>
            )}

            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-bg px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger/20 transition"
              >
                <Trash2 className="size-3.5" />
                Vaciar
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search & feedback bar */}
        <div className="border-b border-line bg-bg-subtle/40 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por empresa, NIT o período..."
              className="h-8 w-full rounded-md border border-line bg-bg-elevated pl-8 pr-3 text-xs outline-none focus:border-teal"
            />
          </div>
          {feedback && (
            <div
              className={`text-xs font-medium px-2.5 py-1 rounded-md ${
                feedback.type === "ok" ? "bg-ok-bg text-ok border border-ok/30" : "bg-danger-bg text-danger border border-danger/30"
              }`}
            >
              {feedback.msg}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="size-12 text-ink-subtle/50 mb-3" />
              <h3 className="text-base font-semibold text-ink">No hay conciliaciones guardadas</h3>
              <p className="mt-1 max-w-sm text-xs text-ink-muted leading-relaxed">
                Cada vez que ejecute una conciliación entre el archivo DIAN y los libros contables, la sesión se guardará automáticamente aquí para su posterior consulta o auditoría.
              </p>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted">
              No se encontraron sesiones que coincidan con &quot;{query}&quot;.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => {
                const totalDocs = entry.totals.recibidos || 1;
                const pctConciliado = Math.min(100, Math.round((entry.totals.conciliados / totalDocs) * 100));
                const dateStr = new Date(entry.timestamp).toLocaleString("es-CO", {
                  dateStyle: "medium",
                  timeStyle: "short",
                });

                return (
                  <div
                    key={entry.id}
                    onClick={() => {
                      onSelectEntry(entry);
                      onClose();
                    }}
                    className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-line bg-bg-elevated p-4 transition-all hover:border-teal hover:shadow-md cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-ink text-sm sm:text-base">
                          {entry.company.nombre || "Empresa Sin Nombre"}
                        </span>
                        <span className="rounded bg-teal/10 px-2 py-0.5 font-mono text-xs font-semibold text-teal">
                          NIT: {entry.company.nit || "N/A"}
                        </span>
                        <span className="rounded border border-line px-2 py-0.5 text-xs text-ink-muted">
                          {entry.periodLabel || "Período actual"}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3 text-ink-subtle" /> {dateStr}
                        </span>
                        <span>·</span>
                        <span>DIAN: <b className="text-ink font-mono">{entry.totals.recibidos}</b> docs</span>
                        <span>·</span>
                        <span>Total: <b className="text-ink font-mono">{formatMoney(entry.totals.valorDian)}</b></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 self-end sm:self-center">
                      <div className="text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <CheckCircle2 className="size-4 text-ok" />
                          <span className="text-sm font-bold text-ok">{pctConciliado}%</span>
                        </div>
                        <p className="text-[11px] text-ink-muted">
                          {entry.totals.cola > 0 ? (
                            <span className="text-warn font-medium">{entry.totals.cola} en cola</span>
                          ) : (
                            <span className="text-ok">100% al día</span>
                          )}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(entry.id, e)}
                        className="rounded-lg p-2 text-ink-muted hover:bg-danger-bg hover:text-danger transition"
                        title="Eliminar de historial"
                      >
                        <Trash2 className="size-4" />
                      </button>

                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal/10 text-teal group-hover:bg-teal group-hover:text-bg-elevated transition">
                        <ArrowRight className="size-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line bg-bg-subtle/50 px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-ink-muted">
            {entries.length} {entries.length === 1 ? "sesión guardada" : "sesiones guardadas"} localmente
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-bg-elevated px-4 py-2 text-sm font-medium text-ink hover:border-line-strong transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
