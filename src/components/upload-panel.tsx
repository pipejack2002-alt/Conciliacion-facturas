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
import { getHistoryEntries } from "@/lib/history-store";
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

  useEffect(() => {
    try {
      const entries = getHistoryEntries();
      setHistoryCount(entries.length);
    } catch {
      setHistoryCount(0);
    }
  }, [showHistory]);

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
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-2 sm:pt-4">
      {/* Hero Header Corporativo */}
      <div className="text-center max-w-2xl mx-auto mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-teal-soft/80 border border-teal/30 px-3.5 py-1 text-xs font-bold text-teal-deep shadow-xs">
          <Sparkles className="size-3.5 text-teal" />
          <span>Motor de Auditoría y Cruce de Facturas DIAN 2026</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-ink">
          Conciliador de Facturas DIAN <span className="text-teal">vs. Libros Contables</span>
        </h1>

        <p className="text-xs sm:text-sm text-ink-muted leading-relaxed">
          Cruce automático e instantáneo de facturación electrónica. Identifique facturas no causadas, omisiones, duplicados, diferencias en IVA y cruces con notas crédito en segundos.
        </p>

        {/* Barra de acceso rápido a la guía */}
        <div className="pt-1 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setShowGuia(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal hover:text-teal-deep bg-teal-soft/40 hover:bg-teal-soft/70 px-3 py-1.5 rounded-lg border border-teal/20 transition"
          >
            <HelpCircle className="size-3.5" />
            <span>¿Cómo exportar y conciliar? Ver Guía Rápida</span>
          </button>
        </div>
      </div>

      {/* Stepper interactivo de 3 pasos */}
      <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          className={cn(
            "p-3 rounded-xl border transition flex items-center gap-3",
            dianFile
              ? "bg-ok-bg/50 border-ok/30 text-ok"
              : "bg-bg-surface border-line text-ink-muted"
          )}
        >
          <div
            className={cn(
              "size-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0",
              dianFile ? "bg-ok text-white" : "bg-teal-soft text-teal-deep"
            )}
          >
            {dianFile ? <CheckCircle2 className="size-4" /> : "1"}
          </div>
          <div className="text-xs leading-tight">
            <span className="font-bold text-ink block">Reporte DIAN</span>
            <span className="text-ink-subtle">
              {dianFile ? "Archivo cargado" : "Documentos recibidos (.xlsx)"}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "p-3 rounded-xl border transition flex items-center gap-3",
            movFile
              ? "bg-ok-bg/50 border-ok/30 text-ok"
              : "bg-bg-surface border-line text-ink-muted"
          )}
        >
          <div
            className={cn(
              "size-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0",
              movFile ? "bg-ok text-white" : "bg-teal-soft text-teal-deep"
            )}
          >
            {movFile ? <CheckCircle2 className="size-4" /> : "2"}
          </div>
          <div className="text-xs leading-tight">
            <span className="font-bold text-ink block">Movimiento Contable</span>
            <span className="text-ink-subtle">
              {movFile ? "Archivo cargado" : "Libro auxiliar (.xlsx)"}
            </span>
          </div>
        </div>

        <div
          className={cn(
            "p-3 rounded-xl border transition flex items-center gap-3",
            isReadyToReconcile
              ? "bg-teal-soft/60 border-teal/40 text-teal-deep"
              : "bg-bg-surface border-line text-ink-muted"
          )}
        >
          <div
            className={cn(
              "size-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0",
              isReadyToReconcile
                ? "bg-teal text-white animate-pulse"
                : "bg-bg-subtle text-ink-subtle"
            )}
          >
            <Zap className="size-3.5" />
          </div>
          <div className="text-xs leading-tight">
            <span className="font-bold text-ink block">Cruce Instantáneo</span>
            <span className="text-ink-subtle">
              {isReadyToReconcile ? "Listo para conciliar" : "Auditoría en 2 seg"}
            </span>
          </div>
        </div>
      </div>

      {/* Tarjetas de Carga Interactivas (Drag & Drop) */}
      <div className="grid gap-4 sm:grid-cols-2">
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
          label="Movimiento Contable"
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
              <div className="mt-3 w-full flex items-center justify-between gap-2 p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="size-4 text-teal-600 dark:text-teal-400 shrink-0" />
                  <div className="truncate">
                    <span className="text-slate-500 dark:text-slate-400">Software: </span>
                    <strong className="text-slate-800 dark:text-slate-100 font-bold">
                      {customProfileId ? customProfileId.toUpperCase() : detectedMovProfile.label}
                    </strong>
                    <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-teal-200/60 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200">
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
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-300 hover:text-teal-800 dark:hover:text-teal-200 bg-white/80 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-teal-500/30 hover:shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <SlidersHorizontal className="size-3 text-teal-600" />
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
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={!isReadyToReconcile}
          onClick={run}
          className={cn(
            "flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal px-6 text-sm font-bold text-white shadow-lg shadow-teal/20 transition-all",
            "hover:bg-teal-deep hover:shadow-xl hover:shadow-teal/30 active:scale-[0.99]",
            "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          )}
        >
          {busy ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              <span>Conciliando y Auditando...</span>
            </>
          ) : (
            <>
              <Zap className="size-5" />
              <span>Conciliar Facturas DIAN vs Libros</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-bg-surface px-5 text-xs sm:text-sm font-semibold text-ink hover:border-teal hover:text-teal hover:bg-bg-subtle/50 transition shadow-xs"
        >
          <Building2 className="size-4 text-teal" />
          <span>Historial de Empresas</span>
          {historyCount > 0 && (
            <span className="rounded-full bg-teal/10 px-2 py-0.5 text-[11px] font-bold text-teal">
              {historyCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setShowGuia(true)}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-bg-surface px-4 text-xs sm:text-sm font-semibold text-ink hover:border-teal hover:text-teal hover:bg-bg-subtle/50 transition shadow-xs"
        >
          <HelpCircle className="size-4 text-teal" />
          <span>Guía de Uso</span>
        </button>
      </div>

      {/* Barra de Compatibilidad y Seguridad */}
      <div className="mt-10 border-t border-line/80 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted">
        <div className="flex items-center gap-2 text-ink-subtle">
          <Lock className="size-4 text-teal" />
          <span>
            <strong>Privacidad Total:</strong> Procesamiento 100% en tu navegador (Client-Side). Tus datos nunca salen de tu equipo.
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-medium text-ink-subtle bg-bg-subtle px-3 py-1 rounded-lg border border-line/60">
          <span>Compatible con:</span>
          <span className="text-ink font-semibold">Siigo · Helisa · World Office · CGUNO · Excel</span>
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
        "relative flex min-h-[170px] flex-col justify-between rounded-2xl border-2 border-dashed p-5 transition-all duration-200",
        isDragging
          ? "border-teal bg-teal-soft/40 shadow-lg scale-[1.01]"
          : file
            ? "border-teal/40 bg-teal-soft/10 shadow-xs"
            : "border-line-strong bg-bg-surface hover:border-teal/60 hover:bg-teal-soft/10 hover:shadow-xs"
      )}
    >
      {/* Contenido Principal / Botón de Carga */}
      <div className="flex w-full flex-col items-start text-left">
        <div className="flex w-full items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-teal text-white text-xs font-bold shadow-xs">
              {step}
            </span>
            <span className="font-bold text-ink text-sm sm:text-base">{label}</span>
          </div>

          <span className="rounded-md bg-bg-subtle border border-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
            .XLSX
          </span>
        </div>

        {file ? (
          <div className="w-full mt-2 p-3 rounded-xl bg-bg-surface border border-teal/30 shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-8 rounded-lg bg-teal/10 text-teal flex items-center justify-center shrink-0">
                <FileCheck className="size-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-ink truncate">{file.name}</p>
                <p className="text-[11px] text-ink-subtle">
                  {formatFileSize(file.size)} · Archivo listo
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onPick}
                title="Cambiar archivo"
                className="p-1.5 rounded-lg text-ink-muted hover:text-teal hover:bg-bg-subtle transition"
              >
                <RefreshCw className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={onClear}
                title="Quitar archivo"
                className="p-1.5 rounded-lg text-ink-muted hover:text-danger hover:bg-danger-bg transition"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPick}
            className="w-full mt-2 flex flex-col items-center justify-center py-4 rounded-xl border border-dashed border-line bg-bg-subtle/40 hover:bg-bg-subtle transition text-center cursor-pointer group"
          >
            <div className="size-10 rounded-xl bg-teal-soft/80 text-teal flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Upload className="size-5" />
            </div>
            <span className="text-xs font-semibold text-ink group-hover:text-teal transition">
              Arrastra tu archivo aquí o haz clic para explorar
            </span>
            <span className="mt-0.5 text-[11px] text-ink-subtle">{hint}</span>
          </button>
        )}
      </div>

      {/* Selector de Hoja si el archivo tiene múltiples pestañas */}
      {file && sheets && sheets.length > 1 && (
        <div className="mt-3 w-full border-t border-teal/20 pt-2.5">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-1">
            <div className="flex items-center gap-1.5 font-medium">
              <TableProperties className="size-3.5 text-teal" />
              <span>Hoja de cálculo:</span>
            </div>
            <span className="text-[10px] text-teal font-semibold">
              {sheets.length} hojas detectadas
            </span>
          </div>
          <select
            value={selectedSheet}
            onChange={(e) => onSelectSheet?.(e.target.value)}
            className="h-8 w-full rounded-lg border border-teal/30 bg-bg-surface px-2 text-xs font-semibold text-ink outline-none focus:ring-1 focus:ring-teal"
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
