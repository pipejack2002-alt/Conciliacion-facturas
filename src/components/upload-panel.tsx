import { useRef, useState, useEffect } from "react";
import {
  Building2,
  FileSpreadsheet,
  Loader2,
  TableProperties,
  Upload,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  ArrowRight,
  RefreshCw,
  Trash2,
  Layers,
  FileCheck,
  Lock,
  SlidersHorizontal,
} from "lucide-react";
import type * as XLSX from "xlsx";
import {
  findBestDianSheet,
  findBestMovSheet,
  getWorkbookSheets,
  inspectMovSheet,
  parseDianSheet,
  parseMovSheet,
  readWorkbook,
} from "@/lib/parse-excel";
import type { ColumnMapping, DetectedProfile, SoftwareProfileId } from "@/lib/types";
import { useConciliacion } from "@/lib/store";
import { getHistoryEntries, syncUserHistoryWithCloud } from "@/lib/history-store";
import { useTributoAuth } from "./tributo-auth-guardian";
import { HistoryModal } from "./history-modal";
import { GuiaConciliacionModal } from "./guia-conciliacion-modal";
import { ColumnMapperModal } from "./column-mapper-modal";
import { cn } from "@/lib/cn";

export function UploadPanel() {
  const setFiles = useConciliacion((s) => s.setFiles);
  const loadHistorySession = useConciliacion((s) => s.loadHistorySession);
  const setError = useConciliacion((s) => s.setError);
  const error = useConciliacion((s) => s.error);
  const dianRef = useRef<HTMLInputElement>(null);
  const movRef = useRef<HTMLInputElement>(null);

  const [dianFile, setDianFile] = useState<File | null>(null);
  const [movFile, setMovFile] = useState<File | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showGuia, setShowGuia] = useState(false);
  const [historyCount, setHistoryCount] = useState(0);

  const [dianWb, setDianWb] = useState<XLSX.WorkBook | null>(null);
  const [movWb, setMovWb] = useState<XLSX.WorkBook | null>(null);

  const [dianSheets, setDianSheets] = useState<string[]>([]);
  const [movSheets, setMovSheets] = useState<string[]>([]);

  const [selectedDianSheet, setSelectedDianSheet] = useState<string>("");
  const [selectedMovSheet, setSelectedMovSheet] = useState<string>("");

  // Estado del Motor Universal de Software Contable
  const [detectedMovProfile, setDetectedMovProfile] = useState<DetectedProfile | null>(null);
  const [movRowsSample, setMovRowsSample] = useState<string[][]>([]);
  const [customMapping, setCustomMapping] = useState<ColumnMapping | null>(null);
  const [customProfileId, setCustomProfileId] = useState<SoftwareProfileId | null>(null);
  const [customHeaderRow, setCustomHeaderRow] = useState<number | null>(null);
  const [showMapperModal, setShowMapperModal] = useState(false);

  const [busy, setBusy] = useState(false);
  const [isDraggingDian, setIsDraggingDian] = useState(false);
  const [isDraggingMov, setIsDraggingMov] = useState(false);

  const { session } = useTributoAuth();
  const userKey = session?.user?.email || (session?.user?.id ? String(session.user.id) : "");

  useEffect(() => {
    try {
      const entries = getHistoryEntries(userKey);
      setHistoryCount(entries.length);

      syncUserHistoryWithCloud(userKey)
        .then((synced) => {
          setHistoryCount(synced.length);
        })
        .catch(() => {});
    } catch {
      setHistoryCount(0);
    }
  }, [showHistory, userKey]);

  async function handleDianPick(file: File | null) {
    setDianFile(file);
    if (!file) {
      setDianWb(null);
      setDianSheets([]);
      setSelectedDianSheet("");
      return;
    }
    try {
      const wb = await readWorkbook(file);
      setDianWb(wb);
      const sheets = getWorkbookSheets(wb);
      setDianSheets(sheets);
      const best = findBestDianSheet(wb);
      setSelectedDianSheet(best || sheets[0] || "");
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar el archivo DIAN.");
    }
  }

  async function handleMovPick(file: File | null) {
    setMovFile(file);
    if (!file) {
      setMovWb(null);
      setMovSheets([]);
      setSelectedMovSheet("");
      setDetectedMovProfile(null);
      setMovRowsSample([]);
      setCustomMapping(null);
      setCustomProfileId(null);
      setCustomHeaderRow(null);
      return;
    }
    try {
      const wb = await readWorkbook(file);
      setMovWb(wb);
      const sheets = getWorkbookSheets(wb);
      setMovSheets(sheets);
      const best = findBestMovSheet(wb);
      const chosen = best || sheets[0] || "";
      setSelectedMovSheet(chosen);

      // Inspección inteligente de perfil de software contable
      const inspection = inspectMovSheet(wb, chosen);
      setDetectedMovProfile(inspection.detectedProfile);
      setMovRowsSample(inspection.rowsSample);
      setCustomMapping(null);
      setCustomProfileId(null);
      setCustomHeaderRow(null);

      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar el archivo contable.");
    }
  }

  function handleSelectMovSheet(sheet: string) {
    setSelectedMovSheet(sheet);
    if (movWb) {
      const inspection = inspectMovSheet(movWb, sheet);
      setDetectedMovProfile(inspection.detectedProfile);
      setMovRowsSample(inspection.rowsSample);
      setCustomMapping(null);
      setCustomProfileId(null);
      setCustomHeaderRow(null);
    }
  }

  async function run() {
    if (!dianFile || !movFile) return;
    setBusy(true);
    setError(null);
    try {
      const dWb = dianWb || (await readWorkbook(dianFile));
      const mWb = movWb || (await readWorkbook(movFile));
      const dian = parseDianSheet(dWb, selectedDianSheet);
      const mov = parseMovSheet(mWb, selectedMovSheet, {
        mapping: customMapping ?? detectedMovProfile?.mapping,
        profileId: customProfileId ?? detectedMovProfile?.id,
        headerRow: customHeaderRow ?? detectedMovProfile?.headerRow,
      });
      if (!dian.length)
        throw new Error(
          `No pude leer documentos en la hoja '${selectedDianSheet || "seleccionada"}' del reporte DIAN.`
        );
      if (!mov.length)
        throw new Error(
          `No pude leer movimientos en la hoja '${selectedMovSheet || "seleccionada"}' del archivo contable.`
        );
      setFiles(dian, mov, { dian: dianFile.name, mov: movFile.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer los archivos.");
    } finally {
      setBusy(false);
    }
  }

  const isReadyToReconcile = Boolean(dianFile && movFile && !busy);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-2 sm:pt-4 relative">
      {/* Glow de Fondo */}
      <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[700px] h-[280px] bg-gradient-to-b from-teal-500/10 via-emerald-500/5 to-transparent blur-3xl -z-10" />

      {/* Hero Header Corporativo */}
      <div className="text-center max-w-2xl mx-auto mb-8 space-y-3.5">
        <div className="inline-flex items-center gap-2.5 rounded-full bg-bg-surface border-2 border-teal/40 px-4 py-1.5 text-xs font-black text-teal shadow-xs">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-teal-600" />
          </span>
          <Sparkles className="size-3.5 text-teal" />
          <span className="tracking-wide uppercase text-[11px]">Motor de Auditoría y Cruce de Facturas DIAN 2026</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-ink leading-[1.15]">
          Conciliador de Facturas DIAN{" "}
          <span className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400 bg-clip-text text-transparent">
            vs. Libros Contables
          </span>
        </h1>

        <p className="text-sm sm:text-base text-ink-muted leading-relaxed font-normal">
          Cruce automático e instantáneo de facturación electrónica. Identifique facturas no causadas, omisiones, duplicados, diferencias en IVA y cruces con notas crédito en segundos.
        </p>

        {/* Barra de acceso rápido a la guía */}
        <div className="pt-1 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setShowGuia(true)}
            className="inline-flex items-center gap-2 text-xs font-bold text-teal bg-bg-surface hover:bg-bg-subtle px-4 py-2 rounded-xl border border-line hover:border-teal shadow-2xs hover:shadow-xs transition cursor-pointer"
          >
            <HelpCircle className="size-4 text-teal" />
            <span>¿Cómo exportar y conciliar? Ver Guía Rápida</span>
          </button>
        </div>
      </div>

      {/* Stepper interactivo de 3 pasos */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div
          className={cn(
            "p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3.5 shadow-xs",
            dianFile
              ? "bg-teal-soft/20 border-teal/50 text-teal-deep dark:text-teal"
              : "bg-bg-surface border-line text-ink"
          )}
        >
          <div
            className={cn(
              "size-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs",
              dianFile
                ? "bg-teal text-white"
                : "bg-bg-subtle text-ink-muted border border-line"
            )}
          >
            {dianFile ? <CheckCircle2 className="size-5" /> : "1"}
          </div>
          <div className="text-xs leading-tight">
            <span className="font-extrabold text-ink block text-sm">
              Reporte DIAN
            </span>
            <span className="text-[11px] font-medium text-ink-subtle">
              {dianFile ? "Archivo cargado" : "Documentos recibidos (.xlsx)"}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3.5 shadow-xs",
            movFile
              ? "bg-teal-soft/20 border-teal/50 text-teal-deep dark:text-teal"
              : "bg-bg-surface border-line text-ink"
          )}
        >
          <div
            className={cn(
              "size-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs",
              movFile
                ? "bg-teal text-white"
                : "bg-bg-subtle text-ink-muted border border-line"
            )}
          >
            {movFile ? <CheckCircle2 className="size-5" /> : "2"}
          </div>
          <div className="text-xs leading-tight">
            <span className="font-extrabold text-ink block text-sm">
              Movimiento Contable
            </span>
            <span className="text-[11px] font-medium text-ink-subtle">
              {movFile ? "Archivo cargado" : "Libro auxiliar ERP (.xlsx)"}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3.5 shadow-xs",
            isReadyToReconcile
              ? "bg-teal-soft/30 border-teal text-teal-deep dark:text-teal"
              : "bg-bg-surface border-line text-ink"
          )}
        >
          <div
            className={cn(
              "size-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs",
              isReadyToReconcile
                ? "bg-teal text-white animate-pulse"
                : "bg-bg-subtle text-ink-subtle border border-line"
            )}
          >
            <Zap className="size-4" />
          </div>
          <div className="text-xs leading-tight">
            <span className="font-extrabold text-ink block text-sm">
              Cruce Instantáneo
            </span>
            <span className="text-[11px] font-medium text-ink-subtle">
              {isReadyToReconcile ? "Listo para conciliar" : "Auditoría en 2 seg"}
            </span>
          </div>
        </div>
      </div>

      {/* Tarjetas de Carga Interactivas (Drag & Drop) */}
      <div className="grid gap-5 sm:grid-cols-2">
        {/* DropCard 1: DIAN */}
        <InteractiveDropCard
          step="1"
          label="Reporte Oficial DIAN"
          hint="Excel descargado de Facturación Electrónica DIAN"
          badgeText="Documentos Recibidos (.xlsx)"
          file={dianFile}
          sheets={dianSheets}
          selectedSheet={selectedDianSheet}
          onSelectSheet={setSelectedDianSheet}
          onPick={() => dianRef.current?.click()}
          onClear={() => handleDianPick(null)}
          isDragging={isDraggingDian}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingDian(true);
          }}
          onDragLeave={() => setIsDraggingDian(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingDian(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) void handleDianPick(dropped);
          }}
        />

        {/* DropCard 2: Movimiento Contable */}
        <InteractiveDropCard
          step="2"
          label="Movimiento Contable ERP"
          hint="Extracto de Siigo, World Office, Helisa, Alegra, Loggro o Excel"
          badgeText="Libro Auxiliar / Comprobantes (.xlsx)"
          file={movFile}
          sheets={movSheets}
          selectedSheet={selectedMovSheet}
          onSelectSheet={handleSelectMovSheet}
          onPick={() => movRef.current?.click()}
          onClear={() => handleMovPick(null)}
          isDragging={isDraggingMov}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingMov(true);
          }}
          onDragLeave={() => setIsDraggingMov(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingMov(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) void handleMovPick(dropped);
          }}
          footerContent={
            detectedMovProfile && (
              <div className="mt-3.5 w-full flex items-center justify-between gap-2 p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-ink-muted font-medium">Software: </span>
                    <strong className="text-ink font-extrabold">
                      {customProfileId ? customProfileId.toUpperCase() : detectedMovProfile.label}
                    </strong>
                    <span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-md bg-purple-200/80 dark:bg-purple-900 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-600">
                      {detectedMovProfile.confidence}%
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMapperModal(true);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-ink bg-bg-surface hover:bg-bg-subtle px-2.5 py-1 rounded-lg border border-line hover:shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <SlidersHorizontal className="size-3 text-purple-600" />
                  <span>Ajustar Mapeo</span>
                </button>
              </div>
            )
          }
        />
      </div>

      <input
        ref={dianRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => void handleDianPick(e.target.files?.[0] ?? null)}
      />
      <input
        ref={movRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => void handleMovPick(e.target.files?.[0] ?? null)}
      />

      {/* Alerta de Error */}
      {error && (
        <div className="mt-4 rounded-xl bg-danger-bg border border-danger/30 p-3.5 text-sm text-danger flex items-start gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 text-xs sm:text-sm font-medium">{error}</div>
        </div>
      )}

      {/* Barra Principal de Acciones */}
      <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={!isReadyToReconcile}
          onClick={run}
          className={cn(
            "flex-1 inline-flex h-13 items-center justify-center gap-2.5 rounded-2xl text-sm sm:text-base font-black text-white shadow-xl transition-all cursor-pointer select-none",
            isReadyToReconcile
              ? "bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 shadow-teal-700/30 hover:shadow-teal-700/40 hover:-translate-y-0.5 active:translate-y-0"
              : "bg-bg-subtle text-ink-subtle border border-line cursor-not-allowed shadow-none opacity-60"
          )}
        >
          {busy ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              <span>Conciliando y Auditando...</span>
            </>
          ) : (
            <>
              <Zap className="size-5 text-amber-300 fill-amber-300" />
              <span>Conciliar Facturas DIAN vs Libros</span>
              <ArrowRight className="size-4.5 opacity-80" />
            </>
          )}
        </button>

        {/* Botón para Vaciar Archivos si hay alguno cargado */}
        {(dianFile || movFile) && (
          <button
            type="button"
            onClick={() => {
              handleDianPick(null);
              handleMovPick(null);
            }}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 text-xs sm:text-sm font-bold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 transition shadow-xs cursor-pointer"
            title="Quitar archivos cargados y dejar la plantilla en blanco"
          >
            <Trash2 className="size-4" />
            <span>Vaciar Archivos</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-line bg-bg-surface px-5 text-xs sm:text-sm font-extrabold text-ink hover:border-teal hover:text-teal transition-all shadow-xs hover:shadow-sm cursor-pointer"
        >
          <Building2 className="size-4 text-teal" />
          <span>Historial de Empresas</span>
          {historyCount > 0 && (
            <span className="rounded-full bg-teal-soft px-2 py-0.5 text-[11px] font-black text-teal border border-teal/30">
              {historyCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowGuia(true)}
          className="inline-flex h-13 items-center justify-center gap-2 rounded-2xl border border-line bg-bg-surface px-4 text-xs sm:text-sm font-extrabold text-ink hover:border-teal hover:text-teal transition-all shadow-xs hover:shadow-sm cursor-pointer"
        >
          <HelpCircle className="size-4 text-teal" />
          <span>Guía de Uso</span>
        </button>
      </div>

      {/* Barra de Compatibilidad y Seguridad */}
      <div className="mt-10 border-t border-line pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2.5 text-ink-muted font-medium">
          <div className="size-7 rounded-lg bg-teal-soft text-teal flex items-center justify-center shrink-0 border border-teal/20">
            <Lock className="size-3.5" />
          </div>
          <span>
            <strong className="text-ink font-bold">Privacidad Total:</strong> Procesamiento 100% en tu navegador (Client-Side). Tus datos contables nunca salen de tu equipo.
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-bold text-ink-muted bg-bg-surface px-3.5 py-1.5 rounded-xl border border-line shadow-2xs">
          <span className="text-ink-subtle">Compatible con:</span>
          <span className="text-teal font-black">Siigo · Helisa · World Office · CGUNO · Alegra · Excel</span>
        </div>
      </div>

      {/* Modales de Historial, Guía y Mapeador Universal */}
      <HistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectEntry={(entry) => loadHistorySession(entry)}
      />

      <GuiaConciliacionModal
        open={showGuia}
        onClose={() => setShowGuia(false)}
      />

      {detectedMovProfile && (
        <ColumnMapperModal
          open={showMapperModal}
          onClose={() => setShowMapperModal(false)}
          detectedProfile={detectedMovProfile}
          headers={detectedMovProfile.detectedHeaders}
          rowsSample={movRowsSample}
          onApplyMapping={(mapping, profileId, hRow) => {
            setCustomMapping(mapping);
            setCustomProfileId(profileId);
            setCustomHeaderRow(hRow);
          }}
        />
      )}
    </div>
  );
}

interface InteractiveDropCardProps {
  step: string;
  label: string;
  hint: string;
  badgeText: string;
  file: File | null;
  sheets?: string[];
  selectedSheet?: string;
  onSelectSheet?: (s: string) => void;
  onPick: () => void;
  onClear: () => void;
  isDragging?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  footerContent?: React.ReactNode;
}

function InteractiveDropCard({
  step,
  label,
  hint,
  badgeText,
  file,
  sheets,
  selectedSheet,
  onSelectSheet,
  onPick,
  onClear,
  isDragging,
  onDragOver,
  onDragLeave,
  onDrop,
  footerContent,
}: InteractiveDropCardProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "relative flex min-h-[220px] flex-col justify-between rounded-3xl border-2 p-6 transition-all duration-200 shadow-sm",
        isDragging
          ? "border-teal-500 bg-teal-50/60 dark:bg-teal-950/40 shadow-xl scale-[1.01]"
          : file
            ? "border-emerald-500/80 bg-white dark:bg-slate-900 shadow-md ring-1 ring-emerald-500/20"
            : "border-slate-300/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-500/70 hover:shadow-md"
      )}
    >
      {/* Contenido Principal */}
      <div className="flex w-full flex-col items-start text-left">
        {/* Cabecera de la Tarjeta */}
        <div className="flex w-full items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-7 items-center justify-center rounded-xl text-xs font-black shadow-xs",
                file
                  ? "bg-emerald-600 text-white"
                  : "bg-gradient-to-br from-teal-700 to-emerald-700 text-white"
              )}
            >
              {file ? <CheckCircle2 className="size-4" /> : step}
            </span>
            <span className="font-black text-slate-950 dark:text-white text-base tracking-tight">
              {label}
            </span>
          </div>

          <span
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-black uppercase tracking-wider border shadow-2xs",
              file
                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
            )}
          >
            .XLSX
          </span>
        </div>

        {file ? (
          <div className="w-full mt-1 p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/40 border-2 border-emerald-300 dark:border-emerald-700/80 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <FileCheck className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black text-slate-950 dark:text-white truncate">
                  {file.name}
                </p>
                <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 mt-0.5">
                  <span>✓ Archivo verificado</span>
                  <span>·</span>
                  <span>{formatFileSize(file.size)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={onPick}
                title="Cambiar archivo"
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-teal-800 dark:hover:text-teal-200 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-300 dark:hover:border-slate-700 transition cursor-pointer shadow-2xs"
              >
                <RefreshCw className="size-4" />
              </button>
              <button
                type="button"
                onClick={onClear}
                title="Quitar archivo"
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition cursor-pointer shadow-2xs"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPick}
            className="w-full mt-1 flex flex-col items-center justify-center py-7 px-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-teal-600 dark:border-slate-700 dark:hover:border-teal-400 bg-slate-50/70 hover:bg-teal-50/40 dark:bg-slate-800/40 dark:hover:bg-teal-950/30 transition-all text-center cursor-pointer group shadow-2xs hover:shadow-xs"
          >
            <div className="size-12 rounded-2xl bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 flex items-center justify-center mb-2.5 group-hover:scale-110 group-hover:bg-teal-600 group-hover:text-white transition-all shadow-xs">
              <Upload className="size-6" />
            </div>
            <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 group-hover:text-teal-800 dark:group-hover:text-teal-300 transition-colors">
              Arrastra tu archivo aquí o haz clic para explorar
            </span>
            <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {hint}
            </span>
          </button>
        )}
      </div>

      {/* Selector de Hoja si el archivo tiene múltiples pestañas */}
      {file && sheets && sheets.length > 1 && (
        <div className="mt-3.5 w-full border-t border-slate-200 dark:border-slate-800 pt-3">
          <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 mb-1.5 font-bold">
            <div className="flex items-center gap-1.5">
              <TableProperties className="size-4 text-teal" />
              <span>Hoja de cálculo activa:</span>
            </div>
            <span className="text-[11px] text-teal font-extrabold bg-teal-100 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-300 dark:border-teal-800">
              {sheets.length} pestañas
            </span>
          </div>
          <select
            value={selectedSheet}
            onChange={(e) => onSelectSheet?.(e.target.value)}
            className="h-9 w-full rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-teal-600 transition"
          >
            {sheets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Contenido Extra / Badge de Software */}
      {footerContent}
    </div>
  );
}
