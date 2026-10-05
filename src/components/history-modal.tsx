import { useState, useEffect, useRef } from "react";
import {
  X,
  Building2,
  CheckCircle2,
  Clock,
  Trash2,
  ArrowRight,
  FolderOpen,
  Download,
  Upload,
  Search,
  RefreshCw,
  UserCheck,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Database,
  AlertCircle,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import {
  getHistoryEntries,
  syncUserHistoryWithCloud,
  getCloudStatus,
  deleteHistoryEntry,
  clearAllHistory,
  exportHistoryJson,
  importHistoryJson,
  getActiveUserKey,
  type HistoryEntry,
} from "@/lib/history-store";
import { useTributoAuth } from "./tributo-auth-guardian";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectEntry: (entry: HistoryEntry) => void;
}

export function HistoryModal({ open, onClose, onSelectEntry }: Props) {
  const { session } = useTributoAuth();
  const user = session?.user;
  const activeUserKey = getActiveUserKey(user?.email || (user?.id ? String(user.id) : ""));

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{
    isConfigured: boolean;
    provider: string;
    mode: "persistent" | "ephemeral" | "error";
    userEntriesCount: number;
    hasDatabaseUrl: boolean;
    error?: string;
  } | null>(null);
  const [showCloudGuide, setShowCloudGuide] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // 1. Mostrar de inmediato la versión local en caché
      setEntries(getHistoryEntries(activeUserKey));
      setFeedback(null);

      // 2. Consultar diagnóstico de estado en la nube
      getCloudStatus(activeUserKey)
        .then((st) => setCloudStatus(st))
        .catch(() => {});

      // 3. Sincronizar en segundo plano con la base de datos en la nube
      setIsSyncing(true);
      syncUserHistoryWithCloud(activeUserKey)
        .then((synced) => {
          setEntries(synced);
        })
        .catch((err) => {
          console.warn("Fallo sincronización en nube:", err);
        })
        .finally(() => {
          setIsSyncing(false);
        });
    }
  }, [open, activeUserKey]);

  if (!open) return null;

  async function handleManualSync() {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const [synced, st] = await Promise.all([
        syncUserHistoryWithCloud(activeUserKey),
        getCloudStatus(activeUserKey),
      ]);
      setEntries(synced);
      setCloudStatus(st);
      if (st.hasDatabaseUrl) {
        setFeedback({
          msg: `✅ Historial sincronizado con la nube (${st.provider}). ${synced.length} sesiones disponibles en todos sus dispositivos.`,
          type: "ok",
        });
      } else {
        setFeedback({
          msg: `⚠️ Modo local en este equipo: Se guardaron ${synced.length} sesiones. Para sincronizar automáticamente entre varios computadores, configure DATABASE_URL en Vercel.`,
          type: "err",
        });
      }
    } catch {
      setFeedback({ msg: "⚠️ No se pudo conectar a la base de datos en la nube. Mostrando caché local.", type: "err" });
    } finally {
      setIsSyncing(false);
    }
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = deleteHistoryEntry(id, activeUserKey);
    setEntries(updated);
  }

  function handleClearAll() {
    if (
      window.confirm(
        `¿Está seguro de eliminar todo el historial de conciliaciones de la cuenta "${user?.email || activeUserKey}"? Esta acción se aplicará en todos sus dispositivos.`
      )
    ) {
      clearAllHistory(activeUserKey);
      setEntries([]);
      setFeedback({ msg: "Historial vaciado en este equipo y en la nube.", type: "ok" });
    }
  }

  function handleExport() {
    exportHistoryJson(activeUserKey);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const res = importHistoryJson(content, activeUserKey);
      if (res.success) {
        setEntries(getHistoryEntries(activeUserKey));
        setFeedback({ msg: `✅ Se importaron y sincronizaron ${res.count} sesiones exitosamente.`, type: "ok" });
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
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 ${
        isMaximized ? "p-1 sm:p-2" : "p-3 sm:p-6"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative flex flex-col w-full transition-all duration-200 overflow-hidden rounded-2xl border border-line bg-bg-surface shadow-2xl ${
          isMaximized
            ? "h-[98vh] max-w-[99vw]"
            : "max-h-[95vh] max-w-4xl xl:max-w-5xl 2xl:max-w-6xl"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-bg-elevated/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/10 text-teal">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink">
                  Historial de Sesiones Multi-Empresa
                </h2>
                {cloudStatus?.hasDatabaseUrl ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3 text-emerald-500" />
                    Nube Multi-Dispositivo Activa
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCloudGuide((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                    title="Haga clic para ver cómo habilitar la sincronización entre varios computadores"
                  >
                    <AlertCircle className="size-3 text-amber-500" />
                    <span>Guardado Local · ¿Sincronizar entre varios equipos?</span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-ink-muted">
                  Sesiones vinculadas a su cuenta:
                </p>
                <span className="inline-flex items-center gap-1 font-semibold text-xs text-ink bg-bg-elevated px-2 py-0.2 rounded border border-line">
                  <UserCheck className="size-3 text-teal" />
                  {user?.email || user?.name || activeUserKey}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSyncing}
              onClick={handleManualSync}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink hover:border-teal hover:text-teal transition disabled:opacity-60 cursor-pointer"
              title="Sincronizar historial con la base de datos en la nube"
            >
              <RefreshCw className={`size-3.5 text-teal ${isSyncing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{isSyncing ? "Sincronizando..." : "Sincronizar"}</span>
            </button>

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
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink hover:border-teal hover:text-teal transition cursor-pointer"
              title="Restaurar sesiones desde un archivo JSON de respaldo"
            >
              <Upload className="size-3.5 text-teal" />
              <span className="hidden sm:inline">Importar</span>
            </button>

            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink hover:border-teal hover:text-teal transition cursor-pointer"
                title="Descargar copia de seguridad en JSON de todas las sesiones"
              >
                <Download className="size-3.5 text-teal" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            )}

            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-bg px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger/20 transition cursor-pointer"
                title="Vaciar historial de esta cuenta"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Vaciar</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="rounded-lg p-2 text-ink-muted hover:bg-bg-subtle hover:text-ink transition cursor-pointer"
              title={isMaximized ? "Restaurar tamaño normal" : "Maximizar a pantalla completa"}
            >
              {isMaximized ? <Minimize2 className="size-4.5" /> : <Maximize2 className="size-4.5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-ink-muted hover:bg-bg-subtle hover:text-ink transition cursor-pointer"
              title="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Banner Explicativo de Sincronización Multi-Dispositivo */}
        {showCloudGuide && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-teal" />
                  <h4 className="text-xs font-bold text-ink uppercase tracking-wider">
                    Sincronización en la Nube para tu Usuario ({user?.email || activeUserKey})
                  </h4>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  Actualmente el historial se está guardando localmente en este navegador. Para que todas tus conciliaciones aparezcan <b>automáticamente al iniciar sesión en cualquier otro computador o portátil</b>:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                  <div className="rounded-xl border border-line bg-bg-surface p-3 space-y-1">
                    <span className="font-bold text-teal block">1. Base de Datos Gratis</span>
                    <p className="text-ink-muted text-[11px] leading-relaxed">
                      Crea una base de datos PostgreSQL gratuita en 1 minuto en <a href="https://neon.tech" target="_blank" rel="noopener noreferrer" className="text-teal underline font-semibold">Neon.tech</a> o <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-teal underline font-semibold">Supabase</a>.
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-bg-surface p-3 space-y-1">
                    <span className="font-bold text-teal block">2. Configura en Vercel</span>
                    <p className="text-ink-muted text-[11px] leading-relaxed">
                      En tu panel de Vercel: <b>Settings &gt; Environment Variables</b>, agrega la variable <code className="bg-bg-elevated px-1 py-0.5 rounded font-mono text-[10px] text-teal">DATABASE_URL</code> con tu enlace de conexión.
                    </p>
                  </div>
                  <div className="rounded-xl border border-line bg-bg-surface p-3 space-y-1">
                    <span className="font-bold text-teal block">3. ¡Sincronización Total!</span>
                    <p className="text-ink-muted text-[11px] leading-relaxed">
                      Las tablas se crean solas de forma automática. Al iniciar sesión en cualquier máquina con tu cuenta, verás tu historial unificado.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-ink-subtle">
                  <span>💡 <b>¿Necesitas transferir tus sesiones ya mismo?</b> Usa los botones de <b>Exportar</b> e <b>Importar</b> de la barra superior para mover tus archivos de conciliación en formato JSON a otro equipo al instante.</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCloudGuide(false)}
                className="text-ink-muted hover:text-ink p-1 rounded transition cursor-pointer"
                title="Cerrar guía"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )}

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
        <div className="flex-1 overflow-y-auto p-6 [scrollbar-width:thin]">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="size-12 text-ink-subtle/50 mb-3" />
              <h3 className="text-base font-semibold text-ink">No hay conciliaciones para esta cuenta</h3>
              <p className="mt-1 max-w-sm text-xs text-ink-muted leading-relaxed">
                Cada vez que ejecute una conciliación entre el archivo DIAN y los libros contables, la sesión se guardará automáticamente y se sincronizará en la nube para su usuario <b className="text-ink font-semibold">{user?.email || activeUserKey}</b>.
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
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="size-3.5 text-teal" />
            <span>
              {entries.length} {entries.length === 1 ? "sesión vinculada" : "sesiones vinculadas"} a esta cuenta y sincronizadas en la nube
            </span>
          </div>
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
