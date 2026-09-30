import { useRef, useState, useEffect } from "react";
import {
  Building2,
  Loader2,
  TableProperties,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Zap,
  ArrowRight,
  RefreshCw,
  Trash2,
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
    <div className="mx-auto max-w-4xl px-3 sm:px-4 pb-8 pt-1 sm:pt-2 relative">
      {/* Glow de Fondo */}
      <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[600px] h-[220px] bg-linear-to-b from-teal-500/10 via-emerald-500/5 to-transparent blur-3xl -z-10" />

      {/* Hero Header Corporativo */}
      <div className="text-center max-w-2xl mx-auto mb-4 sm:mb-6 space-y-2 sm:space-y-2.5">
        <div className="inline-flex items-center gap-2 rounded-full bg-bg-surface border border-teal/40 px-3 py-1 text-[11px] font-black text-teal shadow-2xs">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-teal-600" />
          </span>
          <Sparkles className="size-3 text-teal" />
          <span className="tracking-wide uppercase">Motor de Auditoría y Cruce Fiscal 2026</span>
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-ink leading-tight">
          Conciliador de Facturas DIAN{" "}
          <span className="bg-linear-to-r from-teal-700 via-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400 bg-clip-text text-transparent">
            vs. Libros Contables
          </span>
        </h1>

        <p className="text-xs sm:text-sm text-ink-muted leading-relaxed font-normal max-w-xl mx-auto">
          Cruce automático e instantáneo de facturación electrónica. Identifique facturas no causadas, omisiones, diferencias en IVA y cruces con notas crédito en segundos.
        </p>

        {/* Barra de acceso rápido a la guía */}
        <div className="pt-0.5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuia(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-teal bg-bg-surface hover:bg-bg-subtle px-3 py-1.5 rounded-xl border border-line hover:border-teal shadow-2xs hover:shadow-xs transition cursor-pointer"
          >
            <HelpCircle className="size-3.5 text-teal" />
            <span>¿Cómo exportar y conciliar? Ver Guía Rápida</span>
          </button>
        </div>
      </div>

      {/* Stepper interactivo de 3 pasos */}
      <div className="mb-4 sm:mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        <div
          className={cn(
            "p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all flex items-center gap-2 sm:gap-3 shadow-2xs",
            dianFile
              ? "bg-teal-soft/20 border-teal/50 text-teal-deep dark:text-teal"
              : "bg-bg-surface border-line text-ink"
          )}
        >
          <div
            className={cn(
              "size-7 sm:size-8 rounded-lg sm:rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs",
              dianFile
                ? "bg-teal text-white"
                : "bg-bg-subtle text-ink-muted border border-line"
            )}
          >
            {dianFile ? <CheckCircle2 className="size-4" /> : "1"}
          </div>
          <div className="text-xs leading-tight min-w-0">
            <span className="font-extrabold text-ink block text-xs sm:text-sm truncate">
              Reporte DIAN
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-ink-subtle hidden sm:block truncate">
              {dianFile ? "Archivo cargado" : "Documentos (.xlsx)"}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all flex items-center gap-2 sm:gap-3 shadow-2xs",
            movFile
              ? "bg-teal-soft/20 border-teal/50 text-teal-deep dark:text-teal"
              : "bg-bg-surface border-line text-ink"
          )}
        >
          <div
            className={cn(
              "size-7 sm:size-8 rounded-lg sm:rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs",
              movFile
                ? "bg-teal text-white"
                : "bg-bg-subtle text-ink-muted border border-line"
            )}
          >
            {movFile ? <CheckCircle2 className="size-4" /> : "2"}
          </div>
          <div className="text-xs leading-tight min-w-0">
            <span className="font-extrabold text-ink block text-xs sm:text-sm truncate">
              Movimiento ERP
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-ink-subtle hidden sm:block truncate">
              {movFile ? "Archivo cargado" : "Libro auxiliar (.xlsx)"}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "p-2 sm:p-3 rounded-xl sm:rounded-2xl border transition-all flex items-center gap-2 sm:gap-3 shadow-2xs",
            isReadyToReconcile
              ? "bg-teal-soft/30 border-teal text-teal-deep dark:text-teal"
              : "bg-bg-surface border-line text-ink"
          )}
        >
          <div
            className={cn(
              "size-7 sm:size-8 rounded-lg sm:rounded-xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs",
              isReadyToReconcile
                ? "bg-teal text-white animate-pulse"
                : "bg-bg-subtle text-ink-subtle border border-line"
            )}
          >
            <Zap className="size-3.5 sm:size-4" />
          </div>
          <div className="text-xs leading-tight min-w-0">
            <span className="font-extrabold text-ink block text-xs sm:text-sm truncate">
              Cruce Listo
            </span>
            <span className="text-[10px] sm:text-[11px] font-medium text-ink-subtle hidden sm:block truncate">
              {isReadyToReconcile ? "Listo para conciliar" : "Auditoría en 2 seg"}
            </span>
          </div>
        </div>
      </div>

      {/* Tarjetas de Carga Interactivas (Drag & Drop) */}
      <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
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
              <div className="mt-3 w-full flex items-center justify-between gap-2 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="size-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
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
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-ink bg-bg-surface hover:bg-bg-subtle px-2 py-1 rounded-lg border border-line hover:shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <SlidersHorizontal className="size-3 text-purple-600" />
                  <span>Ajustar</span>
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
        <div className="mt-3.5 rounded-xl bg-danger-bg border border-danger/30 p-3 text-xs sm:text-sm text-danger flex items-start gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {/* Barra Principal de Acciones */}
      <div className="mt-5 sm:mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={!isReadyToReconcile}
          onClick={run}
          className={cn(
            "flex-1 inline-flex h-11 sm:h-12 items-center justify-center gap-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-black text-white shadow-lg transition-all cursor-pointer select-none",
            isReadyToReconcile
              ? "bg-linear-to-r from-teal-700 via-teal-600 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 shadow-teal-700/25 hover:shadow-teal-700/35 hover:-translate-y-0.5 active:translate-y-0"
              : "bg-bg-subtle text-ink-subtle border border-line cursor-not-allowed shadow-none opacity-60"
          )}
        >
          {busy ? (
            <>
              <Loader2 className="size-4 sm:size-4.5 animate-spin" />
              <span>Conciliando y Auditando...</span>
            </>
          ) : (
            <>
              <Zap className="size-4 sm:size-4.5 text-amber-300 fill-amber-300" />
              <span>Conciliar Facturas DIAN vs Libros</span>
              <ArrowRight className="size-4 opacity-80" />
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
            className="inline-flex h-11 sm:h-12 items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3.5 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 transition shadow-2xs cursor-pointer"
            title="Quitar archivos cargados y dejar la plantilla en blanco"
          >
            <Trash2 className="size-3.5" />
            <span>Vaciar</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="inline-flex h-11 sm:h-12 items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border border-line bg-bg-surface px-4 text-xs font-extrabold text-ink hover:border-teal hover:text-teal transition-all shadow-2xs hover:shadow-xs cursor-pointer"
        >
          <Building2 className="size-3.5 text-teal" />
          <span>Historial de Empresas</span>
          {historyCount > 0 && (
            <span className="rounded-full bg-teal-soft px-1.5 py-0.2 text-[10px] font-black text-teal border border-teal/30">
              {historyCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowGuia(true)}
          className="inline-flex h-11 sm:h-12 items-center justify-center gap-1.5 rounded-xl sm:rounded-2xl border border-line bg-bg-surface px-3.5 text-xs font-extrabold text-ink hover:border-teal hover:text-teal transition-all shadow-2xs hover:shadow-xs cursor-pointer"
        >
          <HelpCircle className="size-3.5 text-teal" />
          <span>Guía</span>
        </button>
      </div>

      {/* Barra de Compatibilidad y Seguridad Responsiva */}
      <div className="mt-6 sm:mt-7 border-t border-line pt-4 sm:pt-5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-ink-muted">
          <div className="size-6 rounded-lg bg-teal-soft text-teal flex items-center justify-center shrink-0 border border-teal/20">
            <Lock className="size-3.5" />
          </div>
          <p className="text-[11.5px] leading-snug">
            <strong className="text-ink font-bold">Privacidad 100% Client-Side:</strong> Tus datos contables se procesan en tu memoria local, nunca viajan a servidores externos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px] shrink-0">
          <span className="font-semibold text-ink-subtle mr-0.5">Compatible con:</span>
          {["Siigo", "Helisa", "World Office", "CGUNO", "Alegra", "Loggro", "Excel"].map((erp) => (
            <span
              key={erp}
              className="rounded-md border border-line bg-bg-surface px-2 py-0.5 font-bold text-ink-muted hover:text-teal hover:border-teal/40 transition-colors shadow-2xs"
            >
              {erp}
            </span>
          ))}
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
  _badgeText: string;
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
        "relative flex min-h-[165px] sm:min-h-[175px] flex-col justify-between rounded-2xl border p-4 sm:p-5 transition-all duration-200 shadow-2xs",
        isDragging
          ? "border-teal bg-teal-soft/30 shadow-md scale-[1.01]"
          : file
            ? "border-teal/60 bg-bg-surface shadow-xs ring-1 ring-teal/20"
            : "border-line bg-bg-surface hover:border-teal/50 hover:shadow-xs"
      )}
    >
      {/* Contenido Principal */}
      <div className="flex w-full flex-col items-start text-left">
        {/* Cabecera de la Tarjeta */}
        <div className="flex w-full items-center justify-between mb-2 sm:mb-2.5">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-6 sm:size-7 items-center justify-center rounded-lg text-xs font-black shadow-2xs",
                file
                  ? "bg-teal text-white"
                  : "bg-teal-deep text-white"
              )}
            >
              {file ? <CheckCircle2 className="size-3.5 sm:size-4" /> : step}
            </span>
            <span className="font-black text-ink text-sm sm:text-base tracking-tight">
              {label}
            </span>
          </div>

          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border shadow-2xs",
              file
                ? "bg-teal-soft text-teal-deep dark:text-teal border-teal/30"
                : "bg-bg-subtle text-ink-muted border-line"
            )}
          >
            .XLSX
          </span>
        </div>

        {file ? (
          <div className="w-full mt-1 p-3 rounded-xl bg-teal-soft/20 border border-teal/40 shadow-2xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 sm:size-9 rounded-lg bg-teal text-white flex items-center justify-center shrink-0 shadow-2xs">
                <FileCheck className="size-4 sm:size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-black text-ink truncate">
                  {file.name}
                </p>
                <p className="text-[10.5px] sm:text-[11px] font-semibold text-teal-deep dark:text-teal flex items-center gap-1 mt-0.5">
                  <span>✓ Verificado</span>
                  <span>·</span>
                  <span>{formatFileSize(file.size)}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onPick}
                title="Cambiar archivo"
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-bg-surface border border-transparent hover:border-line transition cursor-pointer shadow-2xs"
              >
                <RefreshCw className="size-3.5 sm:size-4" />
              </button>
              <button
                type="button"
                onClick={onClear}
                title="Quitar archivo"
                className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition cursor-pointer shadow-2xs"
              >
                <Trash2 className="size-3.5 sm:size-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPick}
            className="w-full mt-1 flex flex-col items-center justify-center py-4 sm:py-5 px-3 rounded-xl border border-dashed border-line hover:border-teal bg-bg-subtle/40 hover:bg-teal-soft/15 transition-all text-center cursor-pointer group shadow-2xs hover:shadow-xs"
          >
            <div className="size-9 sm:size-10 rounded-xl bg-teal-soft text-teal flex items-center justify-center mb-1.5 group-hover:scale-105 group-hover:bg-teal group-hover:text-white transition-all shadow-2xs">
              <Upload className="size-4.5 sm:size-5" />
            </div>
            <span className="text-xs sm:text-sm font-black text-ink group-hover:text-teal transition-colors">
              Arrastra tu archivo aquí o haz clic para explorar
            </span>
            <span className="mt-0.5 text-[10.5px] sm:text-[11px] text-ink-muted font-medium">
              {hint}
            </span>
          </button>
        )}
      </div>

      {/* Selector de Hoja si el archivo tiene múltiples pestañas */}
      {file && sheets && sheets.length > 1 && (
        <div className="mt-3 w-full border-t border-line pt-2.5">
          <div className="flex items-center justify-between text-xs text-ink mb-1 font-bold">
            <div className="flex items-center gap-1.5">
              <TableProperties className="size-3.5 text-teal" />
              <span className="text-[11px]">Hoja de cálculo activa:</span>
            </div>
            <span className="text-[10px] text-teal font-extrabold bg-teal-soft px-1.5 py-0.2 rounded border border-teal/30">
              {sheets.length} pestañas
            </span>
          </div>
          <select
            value={selectedSheet}
            onChange={(e) => onSelectSheet?.(e.target.value)}
            className="h-8 w-full rounded-lg border border-line bg-bg-surface px-2.5 text-xs font-bold text-ink outline-none focus:border-teal transition"
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
