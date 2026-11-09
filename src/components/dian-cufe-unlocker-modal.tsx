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
  Pencil,
  Trash2,
  RefreshCw,
  FolderSync,
  PictureInPicture2,
  Save,
} from "lucide-react";
import type { ConciliacionResult, ConciliacionRow } from "@/lib/types";
import { formatMoneyExact, formatDate } from "@/lib/format";
import {
  EXTENSION_VERSION,
  buildDianQrDirectUrl,
  buildDianSearchDocumentUrl,
  buildDianAutofillBookmarklet,
  getNitSinDv,
  buildCandidatePasswordsForDianPdf,
  unlockDianPdfBuffer,
  extractPdfsFromZipBuffer,
  downloadUnlockedPdf,
  saveUnlockedPdfWithPicker,
  downloadDianAutofillExtensionZip,
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [watchDirHandle, setWatchDirHandle] = useState<any | null>(null);
  const [watchDirName, setWatchDirName] = useState<string>("");
  const [watchedCount, setWatchedCount] = useState<number>(0);
  const [deleteOriginalLocked, setDeleteOriginalLocked] = useState<boolean>(true);
  const deleteOriginalLockedRef = useRef(deleteOriginalLocked);
  const processedWatchFilesRef = useRef<Set<string>>(new Set());
  const processSingleWatchedFileRef = useRef<
    (file: File, dirHandle: any) => Promise<void>
  >(() => Promise.resolve());
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    deleteOriginalLockedRef.current = deleteOriginalLocked;
  }, [deleteOriginalLocked]);

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

  const primaryNitSinDv = receptorNitSinDv || emisorNitSinDv;

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

  const bookmarkletHref = useMemo(
    () => buildDianAutofillBookmarklet(activeRow?.cufe || "", primaryNitSinDv),
    [activeRow?.cufe, primaryNitSinDv],
  );

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
            {
              preferredDocNumero: activeRow?.numero,
              allRows: result.rows,
              includeSinClaveSuffix: true,
            },
          );
          itemsToSave.push(unlocked);
        }
      } else {
        const unlocked = await unlockDianPdfBuffer(buffer, file.name, candidatePasswords, {
          preferredDocNumero: activeRow?.numero,
          allRows: result.rows,
          includeSinClaveSuffix: true,
        });
        itemsToSave.push(unlocked);
      }

      for (const item of itemsToSave) {
        try {
          processedWatchFilesRef.current.add(item.unlockedFileName.toLowerCase());
          const outHandle = await dirHandle.getFileHandle(item.unlockedFileName, {
            create: true,
          });
          const writable = await outHandle.createWritable();
          await writable.write(item.unlockedPdfBytes);
          await writable.close();
          setWatchedCount((c) => c + 1);

          // Si deleteOriginalLocked está activo, eliminar el archivo original con clave de la carpeta
          if (deleteOriginalLockedRef.current && typeof dirHandle.removeEntry === "function") {
            const origName = file.name;
            if (origName.toLowerCase() !== item.unlockedFileName.toLowerCase()) {
              try {
                await dirHandle.removeEntry(origName);
              } catch (delErr) {
                console.warn(`[WatchDir] No se pudo eliminar archivo original con clave ${origName}:`, delErr);
              }
            }
          }
        } catch {
          if (autoDownload) {
            downloadUnlockedPdf(item);
          }
        }
      }

      if (itemsToSave.length > 0) {
        setUnlockedItems((prev) => [...itemsToSave, ...prev]);
        setPreviewItemIndex(0);
        const deletedMsg = deleteOriginalLockedRef.current
          ? ` (archivo original con clave "${file.name}" eliminado)`
          : "";
        flash(
          `🔓 Guardado "${itemsToSave[0].unlockedFileName}" en "${watchDirName}" con texto seleccionable${deletedMsg}`,
        );
      }
    } catch {
      // ignorar archivos que no sean facturas DIAN
    } finally {
      setIsProcessing(false);
    }
  };

  processSingleWatchedFileRef.current = processSingleWatchedFile;

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
          if (lower.endsWith("_sin_clave.pdf") || processedWatchFilesRef.current.has(lower)) continue;
          if (!lower.endsWith(".pdf") && !lower.endsWith(".zip")) continue;

          const file: File = await entryHandle.getFile();
          const fileKey = `${file.name}__${file.size}__${file.lastModified}`;
          if (processedWatchFilesRef.current.has(fileKey)) continue;
          processedWatchFilesRef.current.add(fileKey);

          // En el barrido automático en segundo plano procesamos archivos de las últimas 2 horas
          const ageMs = Date.now() - file.lastModified;
          if (ageMs > 2 * 60 * 60 * 1000) continue;

          await processSingleWatchedFileRef.current(file, watchDirHandle);
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
  }, [watchDirHandle, open]);

  // Escaneo completo bajo demanda de todos los PDF/ZIP en la carpeta seleccionada
  const handleForceScanAllInFolder = async () => {
    if (!watchDirHandle) return;
    setIsProcessing(true);
    let count = 0;
    try {
      for await (const [entryName, entryHandle] of (watchDirHandle as any).entries()) {
        if (entryHandle.kind !== "file") continue;
        const lower = String(entryName).toLowerCase();
        if (lower.endsWith("_sin_clave.pdf") || processedWatchFilesRef.current.has(lower)) continue;
        if (!lower.endsWith(".pdf") && !lower.endsWith(".zip")) continue;

        const file: File = await entryHandle.getFile();
        const fileKey = `${file.name}__${file.size}__${file.lastModified}`;
        processedWatchFilesRef.current.add(fileKey);
        await processSingleWatchedFileRef.current(file, watchDirHandle);
        count++;
      }
      flash(
        count > 0
          ? `✅ Se escanearon ${count} archivos en la carpeta "${watchDirName}"`
          : `No se encontraron archivos .PDF o .ZIP pendientes en "${watchDirName}"`,
      );
    } catch {
      setErrorMsg("No se pudo escanear la carpeta seleccionada.");
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
      processedWatchFilesRef.current.clear();
      setWatchDirHandle(handle);
      setWatchDirName(handle.name || "Descargas");
      setWatchedCount(0);
      setErrorMsg(null);
      flash(
        `📂 Carpeta "${handle.name}" activa. Cada PDF descargado de la DIAN se desbloqueará automáticamente allí.`,
      );
    } catch {
      // Usuario canceló el selector
    }
  };

  const handleDisconnectFolder = () => {
    setWatchDirHandle(null);
    setWatchDirName("");
    processedWatchFilesRef.current.clear();
    flash("Vigilancia de carpeta desconectada.");
  };

  // Renombrar / editar una factura desbloqueada (y actualizarla en la carpeta si está conectada)
  const handleSaveEditedName = async (idx: number) => {
    const item = unlockedItems[idx];
    if (!item) return;
    const rawTrimmed = editingName.trim();
    if (!rawTrimmed) {
      setEditingIndex(null);
      return;
    }
    const finalName = rawTrimmed.toLowerCase().endsWith(".pdf")
      ? rawTrimmed
      : `${rawTrimmed}.pdf`;
    const oldName = item.unlockedFileName;

    const updated = unlockedItems.map((it, i) =>
      i === idx ? { ...it, unlockedFileName: finalName } : it,
    );
    setUnlockedItems(updated);
    setEditingIndex(null);

    if (watchDirHandle && oldName !== finalName) {
      try {
        const outHandle = await watchDirHandle.getFileHandle(finalName, {
          create: true,
        });
        const writable = await outHandle.createWritable();
        await writable.write(item.unlockedPdfBytes);
        await writable.close();
        if (typeof watchDirHandle.removeEntry === "function") {
          await watchDirHandle.removeEntry(oldName).catch(() => {});
        }
      } catch {
        // continuar
      }
    }
    flash(`✏️ Nombre actualizado a "${finalName}"`);
  };

  // Eliminar una factura desbloqueada de la lista (y de la carpeta vigilada si existe)
  const handleDeleteUnlockedItem = async (idx: number) => {
    const target = unlockedItems[idx];
    if (!target) return;

    if (watchDirHandle && typeof watchDirHandle.removeEntry === "function") {
      try {
        await watchDirHandle.removeEntry(target.unlockedFileName);
      } catch {
        // ignorar si no existía en disco
      }
    }

    setUnlockedItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (previewItemIndex === idx) {
        setPreviewItemIndex(next.length > 0 ? 0 : null);
      } else if (previewItemIndex != null && previewItemIndex > idx) {
        setPreviewItemIndex(previewItemIndex - 1);
      }
      return next;
    });
    if (editingIndex === idx) setEditingIndex(null);
    flash(`🗑️ Factura "${target.unlockedFileName}" eliminada`);
  };

  const handleClearAllUnlocked = () => {
    setUnlockedItems([]);
    setPreviewItemIndex(null);
    setEditingIndex(null);
    flash("🗑️ Lista de facturas desbloqueadas vaciada");
  };

  // Abrir Mini-Asistente Flotante (Always-on-Top) sobre la pestaña de la DIAN
  const handleOpenFloatingMiniHelper = async () => {
    if (!activeRow) return;
    const cufe = activeRow.cufe || "";
    const nitReceptor = receptorNitSinDv || "";
    const nitEmisor = emisorNitSinDv || "";

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Asistente DIAN — ${activeRow.numero}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 12px; background: #0f172a; color: #f8fafc; font-size: 12px; }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 10px; margin-bottom: 8px; }
  .title { font-weight: 800; color: #2dd4bf; font-size: 13px; margin-bottom: 4px; }
  .mono { font-family: ui-monospace, monospace; word-break: break-all; background: #0f172a; padding: 6px; border-radius: 6px; color: #e2e8f0; font-size: 11px; margin: 4px 0 6px; }
  button { width: 100%; border: none; border-radius: 7px; padding: 8px 10px; font-weight: 700; cursor: pointer; font-size: 12px; margin-top: 4px; transition: 0.15s; }
  .btn-primary { background: #0d9488; color: white; }
  .btn-primary:hover { background: #0f766e; }
  .btn-sec { background: #334155; color: #f8fafc; }
  .btn-sec:hover { background: #475569; }
  .ok { color: #4ade80; font-weight: 700; font-size: 11px; text-align: center; min-height: 16px; margin-top: 4px; }
</style>
</head>
<body>
  <div class="card">
    <div class="title">📄 ${activeRow.numero} · ${activeRow.nombreContraparte.slice(0, 26)}</div>
    <div><strong>1. CUFE:</strong></div>
    <div class="mono" id="cufe">${cufe}</div>
    <button class="btn-primary" onclick="navigator.clipboard.writeText('${cufe}');document.getElementById('msg').innerText='✅ CUFE copiado — Pégalo con Ctrl+V';">📋 1. Copiar CUFE</button>
  </div>
  <div class="card">
    <div><strong>2. NIT Receptor sin DV:</strong> <span style="font-family:monospace;font-size:14px;font-weight:800;color:#2dd4bf;">${nitReceptor}</span></div>
    <button class="btn-primary" onclick="navigator.clipboard.writeText('${nitReceptor}');document.getElementById('msg').innerText='✅ NIT Receptor (${nitReceptor}) copiado — Pégalo con Ctrl+V';">📋 2. Copiar NIT Receptor (${nitReceptor})</button>
    <div style="margin-top:8px;"><strong>NIT Emisor sin DV:</strong> <span style="font-family:monospace;font-weight:700;">${nitEmisor}</span></div>
    <button class="btn-sec" onclick="navigator.clipboard.writeText('${nitEmisor}');document.getElementById('msg').innerText='✅ NIT Emisor (${nitEmisor}) copiado';">📋 Copiar NIT Emisor (${nitEmisor})</button>
  </div>
  <div class="ok" id="msg">Listo para pegar en la pestaña de la DIAN</div>
</body>
</html>`;

    const win = window as any;
    try {
      if (win.documentPictureInPicture?.requestWindow) {
        const pipWin = await win.documentPictureInPicture.requestWindow({
          width: 340,
          height: 350,
        });
        pipWin.document.open();
        pipWin.document.write(htmlContent);
        pipWin.document.close();
        return;
      }
    } catch {
      // fallback a popup compacto
    }

    const popup = window.open(
      "",
      "dian_cufe_helper",
      "width=350,height=370,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes",
    );
    if (popup) {
      popup.document.open();
      popup.document.write(htmlContent);
      popup.document.close();
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
    const nit = primaryNitSinDv;
    const docNumero = activeRow?.numero || "";
    if (nit || cufe) {
      try {
        // Como ?DocumentKey=... ya rellena automáticamente la casilla del CUFE en la DIAN,
        // copiamos el NIT sin DV al portapapeles (y la extensión rellena ambos sola)
        await navigator.clipboard.writeText(nit || cufe);
        setCopiedField("nit-receptor");
        flash(
          `Abriendo DIAN con CUFE pre-cargado, NIT sin DV (${nit}) y N° ${docNumero || "factura"} listos.`,
        );
      } catch {
        // continuar abriendo pestaña
      }
    }
    const targetUrl =
      mode === "qr" && cufe
        ? buildDianQrDirectUrl(cufe, receptorNitSinDv, emisorNitSinDv, docNumero)
        : buildDianSearchDocumentUrl(cufe, receptorNitSinDv, emisorNitSinDv, docNumero);
    window.open(targetUrl, "_blank", "noopener,noreferrer");
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
                  {
                    preferredDocNumero:
                      files.length === 1 && extractedPdfs.length === 1
                        ? activeRow?.numero
                        : undefined,
                    allRows: result.rows,
                    includeSinClaveSuffix: true,
                  },
                );
                newUnlocked.push(unlocked);
                if (autoDownload) {
                  downloadUnlockedPdf(unlocked, unlocked.unlockedFileName);
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
              {
                preferredDocNumero: files.length === 1 ? activeRow?.numero : undefined,
                allRows: result.rows,
                includeSinClaveSuffix: true,
              },
            );
            newUnlocked.push(unlocked);
            if (autoDownload) {
              downloadUnlockedPdf(unlocked, unlocked.unlockedFileName);
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
        className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-line bg-bg-elevated shadow-2xl"
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
                Cambia o vigila tu carpeta de descargas, edita o elimina facturas desbloqueadas y rellena CUFE + NIT sin DV al instante.
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
          {/* Banner de Carpeta de Descarga Vigilada (Conectar / Cambiar Carpeta / Escanear / Desconectar) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-teal/40 bg-teal-soft/30 px-4 py-3">
            <div className="flex items-start gap-3">
              <FolderOpen className="mt-0.5 size-5 shrink-0 text-teal" />
              <div className="text-xs text-ink leading-relaxed">
                <div className="font-bold text-teal-deep flex items-center gap-2 flex-wrap">
                  <span>⚡ Carpeta de Descarga y Auto-Desbloqueo en Vivo</span>
                  {watchDirHandle && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 text-[11px] font-bold text-emerald-900 dark:text-emerald-200 border border-emerald-300">
                      <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                      Activa: "{watchDirName}" ({watchedCount} desbloqueados)
                    </span>
                  )}
                </div>
                <p className="text-ink-muted mt-0.5">
                  Elige la carpeta donde guardas tus descargas: al descargar desde la DIAN con contraseña, el asistente leerá el archivo, le quitará la clave, lo guardará como <strong className="text-ink">[Prefijo-Número]_SIN_CLAVE.pdf</strong> y eliminará el archivo con clave.
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-deep cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={deleteOriginalLocked}
                      onChange={(e) => setDeleteOriginalLocked(e.target.checked)}
                      className="size-3.5 rounded border-line text-teal accent-teal cursor-pointer"
                    />
                    <span>Eliminar archivo original con clave al guardar _SIN_CLAVE.pdf</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="shrink-0 flex flex-wrap items-center gap-2">
              {watchDirHandle ? (
                <>
                  <button
                    type="button"
                    onClick={handleForceScanAllInFolder}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-teal bg-bg-elevated px-3 py-1.5 text-xs font-bold text-teal hover:bg-teal hover:text-white transition cursor-pointer"
                    title="Desbloquear todos los PDF y ZIP que ya estén dentro de esta carpeta"
                  >
                    <RefreshCw className="size-3.5" />
                    <span>Escanear carpeta ahora</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConnectDownloadsFolder}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-deep transition cursor-pointer"
                    title="Cambiar a otra carpeta de descarga o destino"
                  >
                    <FolderSync className="size-3.5" />
                    <span>Cambiar Carpeta</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectFolder}
                    className="inline-flex items-center gap-1 rounded-lg border border-danger/40 bg-danger-bg px-2.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger hover:text-white transition cursor-pointer"
                    title="Dejar de vigilar esta carpeta"
                  >
                    <X className="size-3.5" />
                    <span>Desconectar</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectDownloadsFolder}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-deep transition shadow-xs cursor-pointer"
                >
                  <FolderOpen className="size-4" />
                  <span>Elegir / Conectar Carpeta de Descargas</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* COLUMNA IZQUIERDA: PASO 1 — CONSULTA DIAN CON CUFE + NIT ENSEGUIDA */}
            <div className="lg:col-span-6 flex flex-col gap-4 rounded-xl border border-line bg-bg p-4">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-teal text-xs font-bold text-white">
                    1
                  </span>
                  <h3 className="text-sm font-bold text-ink">
                    Consulta Directa DIAN (CUFE + NIT sin DV)
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
                          2. NIT Receptor (sin DV)
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
                              <Copy className="size-2.5" /> Copiar NIT
                            </>
                          )}
                        </button>
                      </div>
                      <div className="mt-1 font-mono text-base font-extrabold text-ink select-all">
                        {receptorNitSinDv || "—"}
                      </div>
                      <div className="truncate text-[10px] text-ink-muted" title={result.company.nombre}>
                        {result.company.nombre || "Tu Empresa"}
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
                              <Copy className="size-2.5" /> Copiar NIT
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

                  {/* Botones de apertura directa + Mini-Ventana Flotante + Auto-Fill Bookmarklet */}
                  <div className="pt-2 space-y-2">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenDianPortal("qr")}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal px-3 py-2.5 text-xs font-bold text-white hover:bg-teal-deep transition shadow-sm cursor-pointer"
                        title="Abre el enlace directo QR de la DIAN con el CUFE y el NIT en la URL"
                      >
                        <Sparkles className="size-4 shrink-0" />
                        <span>URL Directa DIAN (CUFE + NIT en URL)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDianPortal("search")}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal/40 bg-teal-soft/40 px-3 py-2.5 text-xs font-semibold text-teal hover:bg-teal hover:text-white transition cursor-pointer"
                        title="Abre SearchDocument con parámetros y copia el CUFE"
                      >
                        <ExternalLink className="size-3.5 shrink-0" />
                        <span>Abrir Buscador DIAN</span>
                      </button>
                    </div>

                    {/* Extensión Chrome/Edge + Mini-Ventana Flotante + Botón Favoritos */}
                    <div className="rounded-xl border border-teal/40 bg-teal-soft/20 p-3 space-y-2 text-[11px]">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-teal-deep">
                          🧩 Autollenado CUFE+NIT y Descarga Desbloqueada Automática (v{EXTENSION_VERSION})
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            downloadDianAutofillExtensionZip();
                            flash(
                              `Extensión actualizada v${EXTENSION_VERSION} descargada (extension-dian-autofill-v${EXTENSION_VERSION}.zip). También está sincronizada en la carpeta extension-dian-autofill de tu proyecto.`,
                            );
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-deep transition shadow-2xs cursor-pointer"
                        >
                          <Download className="size-3.5" />
                          <span>Descargar Extensión Chrome / Edge v{EXTENSION_VERSION} (.ZIP)</span>
                        </button>
                      </div>
                      <p className="text-ink-muted leading-snug">
                        Instálala o recárgala (🔄) en <code className="font-mono">chrome://extensions</code> o <code className="font-mono">edge://extensions</code> → <strong>Cargar descomprimida</strong> → carpeta <code className="font-mono font-semibold text-ink">extension-dian-autofill</code>. Rellena el <strong>CUFE + NIT sin DV</strong>, desbloquea el PDF automáticamente y lo guarda con el <strong>Prefijo y Número de Factura</strong> (ej. <code className="font-mono">{activeRow.numero || "FE-29159"}.pdf</code>).
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-teal/20">
                        <button
                          type="button"
                          onClick={handleOpenFloatingMiniHelper}
                          className="inline-flex items-center gap-1.5 font-bold text-teal hover:underline cursor-pointer"
                        >
                          <PictureInPicture2 className="size-3.5" />
                          <span>📌 Mini-Ventana Flotante sobre DIAN</span>
                        </button>

                        <a
                          href={bookmarkletHref}
                          onClick={(e) => {
                            e.preventDefault();
                            flash(
                              "Arrastra este botón '⚡ Autollenar DIAN' hacia la barra superior de Favoritos de tu navegador.",
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-amber-100 dark:bg-amber-950/70 border border-amber-300 px-2 py-0.5 font-bold text-amber-950 dark:text-amber-200 cursor-grab"
                        >
                          ⚡ Autollenar CUFE+NIT (Arrastrar a Favoritos)
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* COLUMNA DERECHA: PASO 2 — GESTIÓN, EDICIÓN Y BORRADO DE FACTURAS DESBLOQUEADAS */}
            <div className="lg:col-span-6 flex flex-col gap-4 rounded-xl border border-line bg-bg p-4">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-teal text-xs font-bold text-white">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-ink">
                    Desbloquear, Editar o Borrar Facturas PDF
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
                  "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center transition cursor-pointer",
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
                    <Loader2 className="size-7 animate-spin text-teal" />
                    <p className="text-sm font-bold text-ink">
                      Quitando clave NIT e incrustando capa de texto seleccionable...
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex size-10 items-center justify-center rounded-full bg-teal-soft text-teal mb-1.5 shadow-2xs">
                      <Upload className="size-5" />
                    </div>
                    <p className="text-sm font-bold text-ink">
                      Suelta aquí uno o varios PDFs / ZIPs descargados de la DIAN
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted max-w-md">
                      El PDF resultante <strong>conserva la capa de texto digital</strong> (<kbd className="font-mono">Ctrl+C</kbd>) y puedes renombrarlo, elegir carpeta destino o borrarlo abajo.
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
                  <span>Auto-descargar apenas se desbloquee</span>
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

              {/* Lista de Facturas Desbloqueadas con Edición de Nombre, Guardar en Carpeta y Borrado */}
              {unlockedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
                      Facturas Desbloqueadas ({unlockedItems.length})
                    </span>
                    <div className="flex items-center gap-3">
                      {unlockedItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            unlockedItems.forEach((item) => downloadUnlockedPdf(item));
                            flash(`Descargando ${unlockedItems.length} PDFs sin contraseña...`);
                          }}
                          className="text-xs font-bold text-teal hover:underline cursor-pointer"
                        >
                          Descargar todas
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleClearAllUnlocked}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-danger hover:underline cursor-pointer"
                        title="Vaciar toda la lista de facturas descargadas"
                      >
                        <Trash2 className="size-3" />
                        <span>Borrar todas</span>
                      </button>
                    </div>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                    {unlockedItems.map((item, idx) => (
                      <div
                        key={`${item.fileName}-${idx}`}
                        className={cn(
                          "flex flex-col gap-2 rounded-xl border p-2.5 text-xs transition",
                          previewItemIndex === idx
                            ? "border-teal bg-teal-soft/30"
                            : "border-line bg-bg-elevated",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {editingIndex === idx ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void handleSaveEditedName(idx);
                                    if (e.key === "Escape") setEditingIndex(null);
                                  }}
                                  autoFocus
                                  className="h-7 flex-1 rounded border border-teal bg-bg px-2 font-mono text-xs text-ink outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => void handleSaveEditedName(idx)}
                                  className="inline-flex items-center gap-1 rounded bg-teal px-2 py-1 text-[11px] font-bold text-white hover:bg-teal-deep cursor-pointer"
                                >
                                  <Save className="size-3" /> Guardar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingIndex(null)}
                                  className="rounded border border-line bg-bg px-2 py-1 text-[11px] text-ink-muted hover:text-ink cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <FileText className="size-4 shrink-0 text-teal" />
                                <span
                                  className="font-bold text-ink truncate cursor-pointer hover:text-teal"
                                  title="Haz clic en Editar para cambiar el nombre del archivo"
                                  onClick={() => {
                                    setEditingIndex(idx);
                                    setEditingName(item.unlockedFileName.replace(/\.pdf$/i, ""));
                                  }}
                                >
                                  {item.unlockedFileName}
                                </span>
                              </div>
                            )}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/70 px-1.5 py-0.5 font-bold text-emerald-900 dark:text-emerald-200">
                                🔓 {item.wasEncrypted ? `Clave quitada: ${item.matchedPassword}` : "Libre"} · Texto copiable
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Acciones por factura: Ver, Editar nombre, Guardar en carpeta..., Descargar, Borrar */}
                        <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-line/60">
                          <button
                            type="button"
                            onClick={() => setPreviewItemIndex(idx)}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg px-2 py-1 text-[11px] font-semibold text-ink hover:border-teal hover:text-teal transition cursor-pointer"
                            title="Ver factura y renglones copiables"
                          >
                            <Eye className="size-3" />
                            <span>Ver / Copiar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIndex(idx);
                              setEditingName(item.unlockedFileName.replace(/\.pdf$/i, ""));
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg px-2 py-1 text-[11px] font-semibold text-ink hover:border-teal hover:text-teal transition cursor-pointer"
                            title="Editar el nombre del archivo PDF"
                          >
                            <Pencil className="size-3" />
                            <span>Editar nombre</span>
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              const saved = await saveUnlockedPdfWithPicker(item);
                              if (saved) {
                                flash(`💾 Guardado como "${saved}"`);
                              }
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-teal/40 bg-teal-soft/30 px-2 py-1 text-[11px] font-bold text-teal hover:bg-teal hover:text-white transition cursor-pointer"
                            title="Elegir en qué carpeta de tu computador guardar este PDF"
                          >
                            <FolderOpen className="size-3" />
                            <span>Guardar en...</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              downloadUnlockedPdf(item);
                              flash(`Descargado ${item.unlockedFileName}`);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-[11px] font-bold text-white hover:bg-teal-deep transition cursor-pointer"
                          >
                            <Download className="size-3" />
                            <span>Descargar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteUnlockedItem(idx)}
                            className="inline-flex items-center gap-1 rounded-lg border border-danger/30 bg-danger-bg px-2 py-1 text-[11px] font-semibold text-danger hover:bg-danger hover:text-white transition cursor-pointer"
                            title="Eliminar esta factura de la lista (y de la carpeta vigilada si existe)"
                          >
                            <Trash2 className="size-3" />
                            <span>Borrar</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PANEL DE TEXTO DIGITAL COPIABLE Y EDITABLE + VISTA DE LA FACTURA */}
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
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        const saved = await saveUnlockedPdfWithPicker(activePreviewItem);
                        if (saved) flash(`💾 Guardado como "${saved}"`);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg-elevated px-2.5 py-1 text-xs font-semibold text-ink hover:border-teal hover:text-teal transition cursor-pointer"
                    >
                      <FolderOpen className="size-3.5" />
                      Elegir carpeta...
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadUnlockedPdf(activePreviewItem)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-teal bg-teal-soft/30 px-2.5 py-1 text-xs font-bold text-teal hover:bg-teal hover:text-white transition cursor-pointer"
                    >
                      <Download className="size-3.5" />
                      Descargar PDF
                    </button>
                  </div>
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
              Puedes cambiar la carpeta vigilada en cualquier momento, renombrar o eliminar facturas desbloqueadas, y usar el botón flotante o marcador rápido sobre la DIAN.
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
