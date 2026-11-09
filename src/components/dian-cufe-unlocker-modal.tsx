import { useState, useMemo, useRef, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Unlock,
  Upload,
  Download,
  FileText,
  ShieldCheck,
  Sparkles,
  Eye,
  AlertCircle,
  Loader2,
  KeyRound,
  Search,
  FolderOpen,
  ChevronLeft,
  ChevronRight,
  Type,
} from "lucide-react";
import type { ConciliacionResult, ConciliacionRow } from "@/lib/types";
import { formatMoneyExact, formatDate } from "@/lib/format";
import {
  DIAN_SEARCH_DOCUMENT_URL,
  buildDianQrDirectUrl,
  getNitSinDv,
  buildCandidatePasswordsForDianPdf,
  unlockDianPdfBuffer,
  extractPdfsFromZipBuffer,
  downloadUnlockedPdf,
  type UnlockedDianPdfResult,
} from "@/lib/dian-pdf-unlocker";
import { useConciliacion } from "@/lib/store";
import { cn } from "@/lib/cn";

export function DianCufeUnlockerModal({
  open,
  onClose,
  result,
  initialRow,
}: {
  open: boolean;
  onClose: () => void;
  result: ConciliacionResult;
  initialRow?: ConciliacionRow | null;
}) {
  const flash = useConciliacion((s) => s.flash);
  const [selectedRowId, setSelectedRowId] = useState<string>(initialRow?.id || "");
  const [rowSearch, setRowSearch] = useState("");
  const [customNitPassword, setCustomNitPassword] = useState("");
  const [autoDownload, setAutoDownload] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [unlockedItems, setUnlockedItems] = useState<UnlockedDianPdfResult[]>([]);
  const [previewItemIndex, setPreviewItemIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [watchDirHandle, setWatchDirHandle] = useState<any | null>(null);
  const [watchDirName, setWatchDirName] = useState<string>("");
  const [watchedCount, setWatchedCount] = useState<number>(0);
  const processedWatchFilesRef = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialRow?.id) {
      setSelectedRowId(initialRow.id);
    }
  }, [initialRow?.id]);

  const rowsWithCufe = useMemo(() => {
    const list = result.rows.filter((r) => Boolean(r.cufe) && r.estado !== "no_aplica");
    const q = rowSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.numero.toLowerCase().includes(q) ||
        r.nombreContraparte.toLowerCase().includes(q) ||
        r.nitContraparte.includes(q) ||
        r.cufe.toLowerCase().includes(q),
    );
  }, [result.rows, rowSearch]);

  const activeRow = useMemo(() => {
    if (selectedRowId) {
      const found = result.rows.find((r) => r.id === selectedRowId);
      if (found) return found;
    }
    return initialRow || rowsWithCufe[0] || null;
  }, [initialRow, selectedRowId, result.rows, rowsWithCufe]);

  const activeRowIndex = useMemo(() => {
    if (!activeRow) return -1;
    return rowsWithCufe.findIndex((r) => r.id === activeRow.id);
  }, [activeRow, rowsWithCufe]);

  const receptorNitSinDv = useMemo(
    () => getNitSinDv(result.company.nit),
    [result.company.nit],
  );

  const emisorNitSinDv = useMemo(
    () => getNitSinDv(activeRow?.nitContraparte || ""),
    [activeRow?.nitContraparte],
  );

  const candidatePasswords = useMemo(
    () =>
      buildCandidatePasswordsForDianPdf({
        companyNit: result.company.nit,
        companyNombre: result.company.nombre,
        rowNit: activeRow?.nitContraparte,
        rowNombre: activeRow?.nombreContraparte,
        allRows: result.rows,
        customPassword: customNitPassword,
      }),
    [
      result.company.nit,
      result.company.nombre,
      activeRow?.nitContraparte,
      activeRow?.nombreContraparte,
      result.rows,
      customNitPassword,
    ],
  );

  // Vigilante automático de la carpeta Descargas (File System Access API)
  useEffect(() => {
    if (!watchDirHandle || !open) return;
    let cancelled = false;

    const scanDirectory = async () => {
      if (cancelled || !watchDirHandle) return;
      try {
        for await (const [entryName, entryHandle] of (watchDirHandle as any).entries()) {
          if (cancelled) break;
          if (entryHandle.kind !== "file") continue;
          const lower = String(entryName).toLowerCase();
          if (lower.endsWith("_sin_clave.pdf")) continue;
          if (!lower.endsWith(".pdf") && !lower.endsWith(".zip")) continue;

          const file: File = await entryHandle.getFile();
          const fileKey = `${file.name}__${file.size}__${file.lastModified}`;
          if (processedWatchFilesRef.current.has(fileKey)) continue;
          processedWatchFilesRef.current.add(fileKey);

          // Procesar automáticamente archivos descargados en los últimos 10 minutos
          const ageMs = Date.now() - file.lastModified;
          if (ageMs > 10 * 60 * 1000) continue;

          await processSingleWatchedFile(file, watchDirHandle);
        }
      } catch {
        // continuar vigilancia
      }
    };

    const interval = setInterval(scanDirectory, 2000);
    void scanDirectory();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [watchDirHandle, open, candidatePasswords, activeRow]);

  const processSingleWatchedFile = async (file: File, dirHandle: any) => {
    try {
      setIsProcessing(true);
      const buffer = await file.arrayBuffer();
      const lower = file.name.toLowerCase();
      const itemsToSave: UnlockedDianPdfResult[] = [];

      if (lower.endsWith(".zip")) {
        const extracted = await extractPdfsFromZipBuffer(buffer);
        for (const entry of extracted) {
          const unlocked = await unlockDianPdfBuffer(
            entry.pdfBytes,
            entry.fileName,
            candidatePasswords,
          );
          itemsToSave.push(unlocked);
        }
      } else {
        const unlocked = await unlockDianPdfBuffer(buffer, file.name, candidatePasswords);
        itemsToSave.push(unlocked);
      }

      for (const item of itemsToSave) {
        // Guardar el PDF sin contraseña (y con texto seleccionable) directamente en la carpeta vigilada
        try {
          const outHandle = await dirHandle.getFileHandle(item.unlockedFileName, {
            create: true,
          });
          const writable = await outHandle.createWritable();
          await writable.write(item.unlockedPdfBytes);
          await writable.close();
          setWatchedCount((c) => c + 1);
        } catch {
          if (autoDownload) {
            downloadUnlockedPdf(item);
          }
        }
      }

      if (itemsToSave.length > 0) {
        setUnlockedItems((prev) => [...itemsToSave, ...prev]);
        setPreviewItemIndex(0);
        flash(
          `🔓 Auto-desbloqueado en "${watchDirName}": ${itemsToSave[0].unlockedFileName} (con texto 100% copiable)`,
        );
      }
    } catch {
      // ignorar archivos que no sean facturas DIAN
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConnectDownloadsFolder = async () => {
    const win = window as any;
    if (typeof win.showDirectoryPicker !== "function") {
      setErrorMsg(
        "Tu navegador actual no soporta la conexión directa de carpeta local. Usa Chrome o Edge, o arrastra los PDFs al recuadro de abajo.",
      );
      return;
    }
    try {
      const handle = await win.showDirectoryPicker({
        mode: "readwrite",
      });
      setWatchDirHandle(handle);
      setWatchDirName(handle.name || "Descargas");
      setErrorMsg(null);
      flash(
        `📂 Carpeta "${handle.name}" conectada. Cada PDF que descargues de la DIAN se desbloqueará solo en esa misma carpeta.`,
      );
    } catch {
      // Usuario canceló el selector
    }
  };

  if (!open) return null;

  const copyText = async (text: string, fieldId: string, label: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      flash(`${label} copiado al portapapeles`);
      setTimeout(() => {
        setCopiedField((prev) => (prev === fieldId ? null : prev));
      }, 2200);
    } catch {
      flash("No se pudo copiar automáticamente");
    }
  };

  const handleOpenDianPortal = async (mode: "search" | "qr") => {
    const cufe = activeRow?.cufe || "";
    if (cufe) {
      try {
        await navigator.clipboard.writeText(cufe);
        setCopiedField("cufe-launch");
        flash(
          `CUFE copiado · NIT Receptor sin DV: ${receptorNitSinDv || emisorNitSinDv}`,
        );
      } catch {
        // continuar abriendo pestaña
      }
    }
    const targetUrl =
      mode === "qr" && cufe ? buildDianQrDirectUrl(cufe) : DIAN_SEARCH_DOCUMENT_URL;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  const buildSmartOutputName = (originalName: string): string => {
    const base = originalName.replace(/\.pdf$/i, "");
    if (activeRow && unlockedItems.length === 0) {
      const cleanProv = (activeRow.nombreContraparte || "FACTURA")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 28);
      const cleanNum = (activeRow.numero || base).replace(/[^a-zA-Z0-9_-]+/g, "");
      return `${cleanNum}_${cleanProv}_SIN_CLAVE.pdf`;
    }
    return base.endsWith("_SIN_CLAVE") ? `${base}.pdf` : `${base}_SIN_CLAVE.pdf`;
  };

  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);
    const newUnlocked: UnlockedDianPdfResult[] = [];
    const errors: string[] = [];

    try {
      for (const file of files) {
        const lower = file.name.toLowerCase();
        const buffer = await file.arrayBuffer();

        if (lower.endsWith(".zip")) {
          try {
            const extractedPdfs = await extractPdfsFromZipBuffer(buffer);
            if (extractedPdfs.length === 0) {
              errors.push(`El archivo ZIP "${file.name}" no contiene ningún PDF adentro.`);
              continue;
            }
            for (const entry of extractedPdfs) {
              try {
                const unlocked = await unlockDianPdfBuffer(
                  entry.pdfBytes,
                  entry.fileName,
                  candidatePasswords,
                );
                const smartName = buildSmartOutputName(entry.fileName);
                const finalItem = { ...unlocked, unlockedFileName: smartName };
                newUnlocked.push(finalItem);
                if (autoDownload) {
                  downloadUnlockedPdf(finalItem, smartName);
                }
              } catch (err: any) {
                errors.push(err?.message || `Error al desbloquear ${entry.fileName}`);
              }
            }
          } catch (err: any) {
            errors.push(err?.message || `No se pudo abrir el ZIP ${file.name}`);
          }
        } else if (lower.endsWith(".pdf") || file.type.includes("pdf")) {
          try {
            const unlocked = await unlockDianPdfBuffer(
              buffer,
              file.name,
              candidatePasswords,
            );
            const smartName = buildSmartOutputName(file.name);
            const finalItem = { ...unlocked, unlockedFileName: smartName };
            newUnlocked.push(finalItem);
            if (autoDownload) {
              downloadUnlockedPdf(finalItem, smartName);
            }
          } catch (err: any) {
            errors.push(err?.message || `Error al desbloquear ${file.name}`);
          }
        } else {
          errors.push(`Formato no soportado (${file.name}). Sube archivos .PDF o .ZIP de la DIAN.`);
        }
      }

      if (newUnlocked.length > 0) {
        setUnlockedItems((prev) => [...newUnlocked, ...prev]);
        setPreviewItemIndex(0);
        flash(
          `🔓 ${newUnlocked.length} ${newUnlocked.length === 1 ? "PDF desbloqueado con texto seleccionable (Ctrl+C)" : "PDFs desbloqueados con texto seleccionable (Ctrl+C)"}`,
        );
      }

      if (errors.length > 0) {
        setErrorMsg(errors.join(" · "));
      }
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const activePreviewItem =
    previewItemIndex != null && unlockedItems[previewItemIndex]
      ? unlockedItems[previewItemIndex]
      : unlockedItems[0] || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[93vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-bg-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-line bg-bg-surface px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal text-white shadow-xs">
              <Unlock className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-ink">
                  Asistente DIAN por CUFE & Desbloqueador Automático con Texto Seleccionable
                </h2>
                <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-[11px] font-bold text-teal">
                  PDF con Texto Copiable (Ctrl+C)
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Quita la contraseña NIT sin DV conservando la capa de texto digital para que puedas seleccionar y copiar descripciones, ítems y valores.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-subtle hover:bg-bg-subtle hover:text-ink transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Banner de Carpeta Vigilada (Auto-Desbloqueo en Vivo de Descargas) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-teal/40 bg-teal-soft/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <FolderOpen className="mt-0.5 size-5 shrink-0 text-teal" />
              <div className="text-xs text-ink leading-relaxed">
                <div className="font-bold text-teal-deep">
                  ⚡ Auto-Desbloqueo en Vivo de tu Carpeta "Descargas" (Sin arrastrar archivos)
                </div>
                <p className="text-ink-muted mt-0.5">
                  Conecta tu carpeta <code className="font-mono">Descargas</code> una sola vez: cada vez que descargues una factura desde la pestaña de la DIAN, la app detectará el PDF automáticamente y guardará allí mismo la versión <strong>_SIN_CLAVE.pdf</strong> con texto 100% seleccionable.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {watchDirHandle ? (
                <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/70 px-3.5 py-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    Vigilando "{watchDirName}" ({watchedCount} auto-desbloqueados)
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectDownloadsFolder}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-deep transition shadow-xs cursor-pointer"
                >
                  <FolderOpen className="size-4" />
                  <span>Conectar Carpeta "Descargas"</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* COLUMNA IZQUIERDA: PASO 1 — CONSULTA DIAN EN MODO RÁFAGA */}
            <div className="lg:col-span-6 flex flex-col gap-4 rounded-xl border border-line bg-bg p-4">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-teal text-xs font-bold text-white">
                    1
                  </span>
                  <h3 className="text-sm font-bold text-ink">
                    Cola Rápida de Consulta DIAN por CUFE
                  </h3>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={activeRowIndex <= 0}
                    onClick={() => {
                      if (activeRowIndex > 0) {
                        setSelectedRowId(rowsWithCufe[activeRowIndex - 1].id);
                      }
                    }}
                    className="inline-flex items-center gap-0.5 rounded border border-line bg-bg-elevated px-2 py-1 text-[11px] font-semibold text-ink hover:border-teal disabled:opacity-40 cursor-pointer"
                    title="Factura anterior"
                  >
                    <ChevronLeft className="size-3.5" /> Ant.
                  </button>
                  <span className="px-1.5 font-mono text-[11px] text-ink-subtle">
                    {activeRowIndex >= 0 ? `${activeRowIndex + 1}/${rowsWithCufe.length}` : "—"}
                  </span>
                  <button
                    type="button"
                    disabled={activeRowIndex < 0 || activeRowIndex >= rowsWithCufe.length - 1}
                    onClick={() => {
                      if (activeRowIndex >= 0 && activeRowIndex < rowsWithCufe.length - 1) {
                        setSelectedRowId(rowsWithCufe[activeRowIndex + 1].id);
                      }
                    }}
                    className="inline-flex items-center gap-0.5 rounded border border-line bg-bg-elevated px-2 py-1 text-[11px] font-semibold text-ink hover:border-teal disabled:opacity-40 cursor-pointer"
                    title="Siguiente factura"
                  >
                    Sig. <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Selector de factura de la conciliación */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle" />
                  <input
                    type="text"
                    value={rowSearch}
                    onChange={(e) => setRowSearch(e.target.value)}
                    placeholder="Filtrar por N° factura, proveedor o NIT..."
                    className="h-8 w-full rounded-lg border border-line bg-bg-elevated pl-8 pr-2.5 text-xs outline-none focus:border-teal"
                  />
                </div>
                <select
                  value={activeRow?.id || ""}
                  onChange={(e) => setSelectedRowId(e.target.value)}
                  className="h-8 flex-[1.4] rounded-lg border border-line bg-bg-elevated px-2.5 text-xs font-medium text-ink outline-none focus:border-teal cursor-pointer"
                >
                  {rowsWithCufe.slice(0, 100).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.numero} · {r.nombreContraparte.slice(0, 28)} ({formatMoneyExact(r.totalDian)})
                    </option>
                  ))}
                </select>
              </div>

              {activeRow ? (
                <div className="space-y-3 rounded-xl border border-line bg-bg-elevated p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2 border-b border-line/70 pb-2">
                    <div>
                      <span className="font-mono text-sm font-bold text-teal">
                        {activeRow.numero}
                      </span>
                      <span className="mx-1.5 text-line-strong">·</span>
                      <span className="text-xs font-semibold text-ink">
                        {activeRow.nombreContraparte}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-ink">
                        {formatMoneyExact(activeRow.totalDian)}
                      </span>
                      <span className="ml-2 text-[11px] text-ink-subtle">
                        {formatDate(activeRow.fecha)}
                      </span>
                    </div>
                  </div>

                  {/* CUFE */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">
                        1. CUFE o UUID del Documento
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(activeRow.cufe, "cufe", "CUFE")}
                        className="inline-flex items-center gap-1 rounded bg-teal-soft px-2 py-0.5 text-[11px] font-bold text-teal hover:bg-teal hover:text-white transition cursor-pointer"
                      >
                        {copiedField === "cufe" ? (
                          <>
                            <Check className="size-3" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="size-3" /> Copiar CUFE
                          </>
                        )}
                      </button>
                    </div>
                    <div className="break-all rounded-lg border border-line bg-bg px-2.5 py-2 font-mono text-[11px] text-ink select-all leading-relaxed">
                      {activeRow.cufe || "Sin CUFE en el archivo"}
                    </div>
                  </div>

                  {/* NITs sin DV */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div className="rounded-lg border border-teal/30 bg-teal-soft/20 p-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-deep">
                          NIT Receptor (sin DV)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              receptorNitSinDv,
                              "nit-receptor",
                              `NIT Receptor sin DV (${receptorNitSinDv})`,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded bg-teal px-2 py-0.5 text-[10px] font-bold text-white hover:bg-teal-deep transition cursor-pointer"
                        >
                          {copiedField === "nit-receptor" ? (
                            <>
                              <Check className="size-2.5" /> Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="size-2.5" /> Copiar
                            </>
                          )}
                        </button>
                      </div>
                      <div className="mt-1 font-mono text-base font-extrabold text-ink select-all">
                        {receptorNitSinDv || "—"}
                      </div>
                      <div className="truncate text-[10px] text-ink-muted" title={result.company.nombre}>
                        {result.company.nombre || "Tu Empresa (Igual para todas tus facturas)"}
                      </div>
                    </div>

                    <div className="rounded-lg border border-line bg-bg p-2.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">
                          NIT Emisor (sin DV)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              emisorNitSinDv,
                              "nit-emisor",
                              `NIT Emisor sin DV (${emisorNitSinDv})`,
                            )
                          }
                          className="inline-flex items-center gap-1 rounded border border-line bg-bg-elevated px-2 py-0.5 text-[10px] font-bold text-ink hover:border-teal hover:text-teal transition cursor-pointer"
                        >
                          {copiedField === "nit-emisor" ? (
                            <>
                              <Check className="size-2.5" /> Copiado
                            </>
                          ) : (
                            <>
                              <Copy className="size-2.5" /> Copiar
                            </>
                          )}
                        </button>
                      </div>
                      <div className="mt-1 font-mono text-base font-extrabold text-ink select-all">
                        {emisorNitSinDv || "—"}
                      </div>
                      <div className="truncate text-[10px] text-ink-muted" title={activeRow.nombreContraparte}>
                        {activeRow.nombreContraparte}
                      </div>
                    </div>
                  </div>

                  {/* Botones de apertura del portal DIAN */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDianPortal("qr")}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-3.5 py-2.5 text-xs font-bold text-white hover:bg-teal-deep transition shadow-sm cursor-pointer"
                      title="Abre directamente el documento en la DIAN llevando el CUFE en la URL (sin digitar NIT)"
                    >
                      <Sparkles className="size-4 shrink-0" />
                      <span>Abrir Factura Directa en DIAN (Con CUFE en URL)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDianPortal("search")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal/40 bg-teal-soft/40 px-3 py-2.5 text-xs font-semibold text-teal hover:bg-teal hover:text-white transition cursor-pointer"
                    >
                      <ExternalLink className="size-3.5 shrink-0" />
                      <span>Buscador CUFE + NIT</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* COLUMNA DERECHA: PASO 2 — DESBLOQUEADOR CON TEXTO SELECCIONABLE */}
            <div className="lg:col-span-6 flex flex-col gap-4 rounded-xl border border-line bg-bg p-4">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-teal text-xs font-bold text-white">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-ink">
                    Desbloquear PDF Conservando Texto Seleccionable
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ok">
                  <KeyRound className="size-3" />
                  {candidatePasswords.length} claves NIT listas
                </span>
              </div>

              {/* Zona Drag & Drop */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files?.length) {
                    processFiles(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition cursor-pointer",
                  isDragging
                    ? "border-teal bg-teal-soft/40 scale-[0.99]"
                    : "border-teal/40 bg-bg-elevated hover:border-teal hover:bg-teal-soft/20",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.zip,application/pdf,application/zip"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      processFiles(e.target.files);
                    }
                  }}
                />
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="size-8 animate-spin text-teal" />
                    <p className="text-sm font-bold text-ink">
                      Quitando clave NIT e incrustando capa de texto seleccionable...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex size-11 items-center justify-center rounded-full bg-teal-soft text-teal mb-2 shadow-2xs">
                      <Upload className="size-5" />
                    </div>
                    <p className="text-sm font-bold text-ink">
                      Suelta aquí uno o varios PDFs / ZIPs descargados de la DIAN
                    </p>
                    <p className="mt-1 text-xs text-ink-muted max-w-md">
                      El PDF resultante <strong>conserva la capa de texto digital</strong> para que puedas seleccionar y copiar (<kbd className="font-mono">Ctrl+C</kbd>) cualquier descripción, ítem o valor.
                    </p>
                  </>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-ink cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoDownload}
                    onChange={(e) => setAutoDownload(e.target.checked)}
                    className="size-3.5 rounded border-line text-teal accent-teal cursor-pointer"
                  />
                  <span>Auto-descargar PDF sin contraseña (con texto seleccionable)</span>
                </label>

                <input
                  type="text"
                  value={customNitPassword}
                  onChange={(e) => setCustomNitPassword(e.target.value)}
                  placeholder="Otro NIT / clave manual (opcional)"
                  className="h-7 w-48 rounded-lg border border-line bg-bg-elevated px-2.5 text-xs font-mono outline-none focus:border-teal"
                />
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-bg px-3 py-2 text-xs text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {unlockedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                      Facturas Desbloqueadas ({unlockedItems.length})
                    </span>
                    {unlockedItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          unlockedItems.forEach((item) => downloadUnlockedPdf(item));
                          flash(`Descargando ${unlockedItems.length} PDFs sin contraseña...`);
                        }}
                        className="text-xs font-bold text-teal hover:underline cursor-pointer"
                      >
                        Descargar todas ({unlockedItems.length})
                      </button>
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                    {unlockedItems.map((item, idx) => (
                      <div
                        key={`${item.fileName}-${idx}`}
                        className={cn(
                          "flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-xs transition",
                          previewItemIndex === idx
                            ? "border-teal bg-teal-soft/30"
                            : "border-line bg-bg-elevated",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <FileText className="size-4 shrink-0 text-teal" />
                            <span className="font-bold text-ink truncate" title={item.unlockedFileName}>
                              {item.unlockedFileName}
                            </span>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/70 px-1.5 py-0.5 font-bold text-emerald-900 dark:text-emerald-200">
                              🔓 {item.wasEncrypted ? `Clave quitada: ${item.matchedPassword}` : "Libre"} · Texto seleccionable
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPreviewItemIndex(idx)}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-teal hover:text-teal transition cursor-pointer"
                          >
                            <Eye className="size-3.5" />
                            Texto / Vista
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              downloadUnlockedPdf(item);
                              flash(`Descargado ${item.unlockedFileName}`);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-deep transition cursor-pointer"
                          >
                            <Download className="size-3.5" />
                            Descargar PDF
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PANEL DE TEXTO DIGITAL COPIABLE EN 1 CLIC + VISTA DE LA FACTURA */}
          {activePreviewItem && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 rounded-xl border border-teal/40 bg-bg p-4">
              {/* Lado Izquierdo: Renglones y Conceptos Copiables en 1 Clic */}
              <div className="lg:col-span-6 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                  <div className="flex items-center gap-2">
                    <Type className="size-4 text-teal" />
                    <h4 className="text-sm font-bold text-ink">
                      Texto Digital e Ítems Copiables de la Factura
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(
                        activePreviewItem.extractedText,
                        "full-pdf-text",
                        "Texto completo de la factura",
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-xs font-bold text-white hover:bg-teal-deep transition cursor-pointer"
                  >
                    {copiedField === "full-pdf-text" ? (
                      <>
                        <Check className="size-3.5" /> Todo copiado
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" /> Copiar todo el texto
                      </>
                    )}
                  </button>
                </div>

                {activePreviewItem.extractedLines.length > 0 ? (
                  <>
                    <p className="text-[11px] text-ink-muted">
                      Haz clic sobre cualquier renglón (descripción del producto/servicio, NIT, resolución o valor) para copiarlo al instante, o selecciona fragmentos libremente:
                    </p>
                    <div className="max-h-[380px] overflow-y-auto space-y-1.5 rounded-lg border border-line bg-bg-elevated p-2.5">
                      {activePreviewItem.extractedLines.map((line, lIdx) => (
                        <div
                          key={lIdx}
                          className="group flex items-center justify-between gap-2 rounded-md border border-transparent hover:border-teal/40 hover:bg-teal-soft/20 px-2 py-1 text-xs transition"
                        >
                          <span className="font-mono text-[11px] text-ink select-text break-all">
                            {line}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              copyText(line, `line-${lIdx}`, `Renglón "${line.slice(0, 28)}..."`)
                            }
                            className="shrink-0 inline-flex items-center gap-1 rounded bg-bg px-2 py-0.5 text-[10px] font-bold text-teal border border-line group-hover:bg-teal group-hover:text-white transition cursor-pointer"
                          >
                            {copiedField === `line-${lIdx}` ? (
                              <>
                                <Check className="size-2.5" /> Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="size-2.5" /> Copiar
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <textarea
                    readOnly
                    value={
                      activePreviewItem.extractedText ||
                      "Esta factura no contiene texto digital embebido."
                    }
                    rows={12}
                    className="w-full rounded-lg border border-line bg-bg-elevated p-3 font-mono text-xs text-ink outline-none"
                  />
                )}
              </div>

              {/* Lado Derecho: Vista Visual de la Factura */}
              <div className="lg:col-span-6 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 border-b border-line pb-2">
                  <div className="flex items-center gap-2">
                    <Eye className="size-4 text-teal" />
                    <h4 className="text-sm font-bold text-ink truncate">
                      Vista de la Factura ({activePreviewItem.pageCount} pág.)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadUnlockedPdf(activePreviewItem)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal bg-teal-soft/30 px-2.5 py-1 text-xs font-bold text-teal hover:bg-teal hover:text-white transition cursor-pointer"
                  >
                    <Download className="size-3.5" />
                    Descargar PDF (Texto Seleccionable)
                  </button>
                </div>
                <div className="max-h-[410px] overflow-y-auto space-y-3 rounded-lg bg-bg-subtle p-2.5">
                  {activePreviewItem.previewDataUrls.map((dataUrl, i) => (
                    <img
                      key={i}
                      src={dataUrl}
                      alt={`Página ${i + 1} de ${activePreviewItem.unlockedFileName}`}
                      className="mx-auto max-w-full rounded-lg border border-line shadow-sm"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <div className="flex items-center justify-between border-t border-line bg-bg-surface px-5 py-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-teal" />
            <span>
              El PDF descargado incluye fuente estándar <code className="font-mono">/Helvetica</code> sobre las coordenadas exactas de la factura para copiar texto con <kbd className="font-mono">Ctrl+C</kbd>.
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-bg-elevated px-4 py-1.5 text-xs font-semibold text-ink hover:bg-bg-subtle transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
