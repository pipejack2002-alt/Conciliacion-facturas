import { useState, useMemo, useRef } from "react";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar fila activa si se abre desde una fila específica de la tabla o drawer
  const activeRow = useMemo(() => {
    if (initialRow && (!selectedRowId || selectedRowId === initialRow.id)) {
      return initialRow;
    }
    if (selectedRowId) {
      return result.rows.find((r) => r.id === selectedRowId) || initialRow || null;
    }
    return initialRow || result.rows.find((r) => Boolean(r.cufe)) || null;
  }, [initialRow, selectedRowId, result.rows]);

  const rowsWithCufe = useMemo(() => {
    const list = result.rows.filter((r) => Boolean(r.cufe));
    const q = rowSearch.trim().toLowerCase();
    if (!q) return list.slice(0, 60);
    return list
      .filter(
        (r) =>
          r.numero.toLowerCase().includes(q) ||
          r.nombreContraparte.toLowerCase().includes(q) ||
          r.nitContraparte.includes(q) ||
          r.cufe.toLowerCase().includes(q),
      )
      .slice(0, 60);
  }, [result.rows, rowSearch]);

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
          `CUFE copiado. En la DIAN pega el CUFE y usa el NIT sin DV (${receptorNitSinDv || emisorNitSinDv})`,
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
          `🔓 ${newUnlocked.length} ${newUnlocked.length === 1 ? "factura PDF desbloqueada" : "facturas PDF desbloqueadas"} sin contraseña`,
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
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-bg-elevated shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-4 border-b border-line bg-bg-surface px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-teal text-white shadow-xs">
              <Unlock className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-ink">
                  Asistente DIAN por CUFE & Desbloqueador Automático de PDF
                </h2>
                <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-[11px] font-bold text-teal">
                  Quita Clave NIT sin DV
                </span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                Consulta la factura en el catálogo de la DIAN con el NIT sin DV y elimina automáticamente la contraseña del PDF descargado.
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
          {/* Explicación transparente sobre Cloudflare Turnstile + Automatización */}
          <div className="flex items-start gap-3 rounded-xl border border-teal/30 bg-teal-soft/30 px-4 py-3 text-xs text-ink">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />
            <div className="leading-relaxed">
              <span className="font-bold text-teal-deep">¿Cómo funciona este módulo inteligente?</span>{" "}
              El portal oficial de la DIAN (<code className="font-mono text-[11px]">catalogo-vpfe.dian.gov.co</code>) incluye verificación humana <strong>Cloudflare ("No soy un robot")</strong> que por seguridad fiscal debe marcarse en tu navegador. Nosotros automatizamos todo lo demás: <strong>extraemos el CUFE y los NIT sin dígito de verificación (DV) con 1 clic</strong>, y cuando descargas el PDF con contraseña, <strong>le quitamos la clave automáticamente</strong> probando el NIT del Receptor y del Emisor.
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* COLUMNA IZQUIERDA: PASO 1 — ASISTENTE DE CONSULTA DIAN POR CUFE */}
            <div className="lg:col-span-6 flex flex-col gap-4 rounded-xl border border-line bg-bg p-4">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-teal text-xs font-bold text-white">
                    1
                  </span>
                  <h3 className="text-sm font-bold text-ink">
                    Consultar Factura en Portal DIAN
                  </h3>
                </div>
                <span className="text-[11px] font-medium text-ink-subtle">
                  NIT sin puntos ni DV
                </span>
              </div>

              {/* Selector de factura de la conciliación */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-1.5">
                  Seleccionar factura de la conciliación ({result.rows.filter((r) => Boolean(r.cufe)).length} con CUFE)
                </label>
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
                    {rowsWithCufe.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.numero} · {r.nombreContraparte.slice(0, 28)} ({formatMoneyExact(r.totalDian)})
                      </option>
                    ))}
                  </select>
                </div>
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
                    {/* NIT Receptor sin DV */}
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
                        {result.company.nombre || "Tu Empresa"}
                      </div>
                    </div>

                    {/* NIT Emisor sin DV */}
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
                      onClick={() => handleOpenDianPortal("search")}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-teal px-3.5 py-2.5 text-xs font-bold text-white hover:bg-teal-deep transition shadow-sm cursor-pointer"
                    >
                      <ExternalLink className="size-4 shrink-0" />
                      <span>Copiar CUFE y Abrir Buscador DIAN</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDianPortal("qr")}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-teal/40 bg-teal-soft/40 px-3 py-2.5 text-xs font-semibold text-teal hover:bg-teal hover:text-white transition cursor-pointer"
                      title="Abre el enlace directo QR del documento en el catálogo de la DIAN"
                    >
                      <Sparkles className="size-3.5 shrink-0" />
                      <span>Vista Directa QR</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-bg-elevated p-4 text-center text-xs text-ink-muted">
                  Selecciona una factura con CUFE para ver sus datos de consulta DIAN.
                </div>
              )}
            </div>

            {/* COLUMNA DERECHA: PASO 2 — DESBLOQUEADOR AUTOMÁTICO DE PDF DIAN */}
            <div className="lg:col-span-6 flex flex-col gap-4 rounded-xl border border-line bg-bg p-4">
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-teal text-xs font-bold text-white">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-ink">
                    Quitar Contraseña al PDF Descargado
                  </h3>
                </div>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ok">
                  <KeyRound className="size-3" />
                  {candidatePasswords.length} claves NIT listas
                </span>
              </div>

              {/* Zona Drag & Drop para el PDF o ZIP descargado de la DIAN */}
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
                  "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition cursor-pointer",
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
                      Probando NITs sin DV y eliminando contraseña del PDF...
                    </p>
                    <p className="text-xs text-ink-muted">
                      Reconstruyendo documento PDF libre de clave
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex size-12 items-center justify-center rounded-full bg-teal-soft text-teal mb-2.5 shadow-2xs">
                      <Upload className="size-6" />
                    </div>
                    <p className="text-sm font-bold text-ink">
                      Arrastra aquí el PDF (o ZIP) descargado de la DIAN
                    </p>
                    <p className="mt-1 text-xs text-ink-muted max-w-md">
                      Puedes arrastrarlo directamente desde la barra de descargas de tu navegador o hacer clic para elegir varios archivos a la vez.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
                      <span className="rounded-md bg-bg px-2 py-0.5 font-mono text-ink-subtle border border-line">
                        Prueba 1: {receptorNitSinDv || "NIT Receptor"}
                      </span>
                      {emisorNitSinDv && (
                        <span className="rounded-md bg-bg px-2 py-0.5 font-mono text-ink-subtle border border-line">
                          Prueba 2: {emisorNitSinDv}
                        </span>
                      )}
                      <span className="rounded-md bg-teal-soft/60 px-2 py-0.5 font-semibold text-teal">
                        + {Math.max(0, candidatePasswords.length - 2)} NITs del mes
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Opciones de desbloqueo */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-ink cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoDownload}
                    onChange={(e) => setAutoDownload(e.target.checked)}
                    className="size-3.5 rounded border-line text-teal accent-teal cursor-pointer"
                  />
                  <span>Descargar automáticamente el PDF ya sin contraseña</span>
                </label>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={customNitPassword}
                    onChange={(e) => setCustomNitPassword(e.target.value)}
                    placeholder="Otro NIT / clave manual (opcional)"
                    className="h-7 w-48 rounded-lg border border-line bg-bg-elevated px-2.5 text-xs font-mono outline-none focus:border-teal"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-bg px-3 py-2 text-xs text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Lista de PDFs desbloqueados en esta sesión */}
              {unlockedItems.length > 0 && (
                <div className="space-y-2 pt-1">
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
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
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
                            {item.wasEncrypted ? (
                              <span className="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-950/70 px-1.5 py-0.5 font-bold text-emerald-900 dark:text-emerald-200">
                                🔓 Clave quitada: {item.matchedPassword} ({item.matchedSourceLabel})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-bg-subtle px-1.5 py-0.5 font-medium text-ink-muted">
                                PDF no tenía contraseña ({item.pageCount} pág.)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.previewDataUrls.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setPreviewItemIndex(idx)}
                              className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg px-2.5 py-1.5 text-xs font-semibold text-ink hover:border-teal hover:text-teal transition cursor-pointer"
                            >
                              <Eye className="size-3.5" />
                              Ver
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              downloadUnlockedPdf(item);
                              flash(`Descargado ${item.unlockedFileName}`);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-deep transition cursor-pointer"
                          >
                            <Download className="size-3.5" />
                            Descargar sin clave
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Visor integrado de la factura ya desbloqueada */}
          {activePreviewItem && activePreviewItem.previewDataUrls.length > 0 && (
            <div className="rounded-xl border border-line bg-bg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <Eye className="size-4 text-teal" />
                  <h4 className="text-sm font-bold text-ink">
                    Vista Previa de la Factura Desbloqueada: {activePreviewItem.unlockedFileName}
                  </h4>
                  <span className="rounded bg-teal-soft px-2 py-0.5 text-[11px] font-semibold text-teal">
                    {activePreviewItem.pageCount}{" "}
                    {activePreviewItem.pageCount === 1 ? "página" : "páginas"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => downloadUnlockedPdf(activePreviewItem)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-deep transition cursor-pointer"
                >
                  <Download className="size-3.5" />
                  Descargar PDF Libre de Contraseña
                </button>
              </div>
              <div className="max-h-[480px] overflow-y-auto space-y-4 rounded-lg bg-bg-subtle p-3">
                {activePreviewItem.previewDataUrls.map((dataUrl, i) => (
                  <img
                    key={i}
                    src={dataUrl}
                    alt={`Página ${i + 1} de ${activePreviewItem.unlockedFileName}`}
                    className="mx-auto max-w-full rounded-lg border border-line shadow-md"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <div className="flex items-center justify-between border-t border-line bg-bg-surface px-5 py-3 text-xs text-ink-muted">
          <span>
            💡 Tip: En la tabla principal también puedes hacer clic en el botón <strong>🔓 DIAN</strong> junto a cada CUFE.
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

