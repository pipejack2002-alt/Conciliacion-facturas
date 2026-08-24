import { useRef, useState } from "react";
import { Building2, FileSpreadsheet, Loader2, TableProperties, Upload } from "lucide-react";
import type * as XLSX from "xlsx";
import {
  findBestDianSheet,
  findBestMovSheet,
  getWorkbookSheets,
  parseDianSheet,
  parseMovSheet,
  readWorkbook,
} from "@/lib/parse-excel";
import type { SampleBundle } from "@/lib/types";
import { useConciliacion } from "@/lib/store";
import { HistoryModal } from "./history-modal";
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

  const [dianWb, setDianWb] = useState<XLSX.WorkBook | null>(null);
  const [movWb, setMovWb] = useState<XLSX.WorkBook | null>(null);

  const [dianSheets, setDianSheets] = useState<string[]>([]);
  const [movSheets, setMovSheets] = useState<string[]>([]);

  const [selectedDianSheet, setSelectedDianSheet] = useState<string>("");
  const [selectedMovSheet, setSelectedMovSheet] = useState<string>("");

  const [busy, setBusy] = useState(false);

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
      return;
    }
    try {
      const wb = await readWorkbook(file);
      setMovWb(wb);
      const sheets = getWorkbookSheets(wb);
      setMovSheets(sheets);
      const best = findBestMovSheet(wb);
      setSelectedMovSheet(best || sheets[0] || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al procesar el archivo contable.");
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
      const mov = parseMovSheet(mWb, selectedMovSheet);
      if (!dian.length) throw new Error(`No pude leer documentos en la hoja '${selectedDianSheet || "seleccionada"}' del reporte DIAN.`);
      if (!mov.length) throw new Error(`No pude leer movimientos en la hoja '${selectedMovSheet || "seleccionada"}' del archivo contable.`);
      setFiles(dian, mov, { dian: dianFile.name, mov: movFile.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al leer los archivos.");
    } finally {
      setBusy(false);
    }
  }

  async function loadDemo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/samples/julio-2026.json");
      if (!res.ok) throw new Error("No se pudo cargar el ejemplo.");
      const data = (await res.json()) as SampleBundle;
      setFiles(
        data.dian,
        data.mov,
        {
          dian: "REPORTE DIAN JUL 2026.xlsx",
          mov: "MOVIMIENTO JUL 2026.xlsx",
        },
        "Julio 2026",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el ejemplo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-6 sm:pt-10">
      <p className="mb-8 max-w-xl text-base leading-relaxed text-ink-muted">
        Plataforma corporativa de conciliación fiscal y auditoría contable. Cargue
        el reporte oficial de la DIAN y el extracto de movimiento de su software
        contable para identificar facturas de compra no causadas, registros duplicados,
        diferencias en importes e impuestos y cruces con notas crédito.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <DropCard
          label="Reporte Oficial DIAN"
          hint="Documentos electrónicos (.xlsx) · CUFE, Folio, Prefijo"
          file={dianFile}
          sheets={dianSheets}
          selectedSheet={selectedDianSheet}
          onSelectSheet={setSelectedDianSheet}
          onPick={() => dianRef.current?.click()}
        />
        <DropCard
          label="Movimiento Contable"
          hint="Software contable (.xlsx) · Comprobantes, NIT, Débitos"
          file={movFile}
          sheets={movSheets}
          selectedSheet={selectedMovSheet}
          onSelectSheet={setSelectedMovSheet}
          onPick={() => movRef.current?.click()}
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

      {error ? (
        <p className="mt-4 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={!dianFile || !movFile || busy}
          onClick={run}
          className={cn(
            "inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-teal px-5 text-sm font-semibold text-bg-elevated transition-opacity",
            "hover:bg-teal-deep disabled:cursor-not-allowed disabled:opacity-40",
          )}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Ejecutar Auditoría
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={loadDemo}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-line bg-bg-elevated px-5 text-sm font-medium text-ink hover:border-line-strong"
        >
          Cargar datos de demostración
        </button>
        <button
          type="button"
          onClick={() => setShowHistory(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-bg-elevated px-4 text-sm font-medium text-ink hover:border-line-strong hover:text-teal"
        >
          <Building2 className="size-4 text-teal" />
          Historial de Empresas
        </button>
      </div>

      <HistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        onSelectEntry={(entry) => loadHistorySession(entry)}
      />
    </div>
  );
}

function DropCard({
  label,
  hint,
  file,
  sheets,
  selectedSheet,
  onSelectSheet,
  onPick,
}: {
  label: string;
  hint: string;
  file: File | null;
  sheets?: string[];
  selectedSheet?: string;
  onSelectSheet?: (s: string) => void;
  onPick: () => void;
}) {
  return (
    <div className="flex min-h-36 flex-col justify-between rounded-xl border border-dashed border-line-strong bg-bg-elevated p-5 transition-colors hover:border-teal hover:bg-teal-soft/20">
      <button
        type="button"
        onClick={onPick}
        className="flex w-full flex-col items-start text-left"
      >
        <FileSpreadsheet className="mb-3 size-5 text-teal" />
        <span className="font-semibold text-ink">{label}</span>
        {file ? (
          <span className="mt-1 truncate text-sm text-teal">{file.name}</span>
        ) : (
          <span className="mt-1 text-sm text-ink-subtle">{hint}</span>
        )}
      </button>

      {file && sheets && sheets.length > 1 ? (
        <div className="mt-3 w-full border-t border-line/60 pt-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <TableProperties className="size-3.5 text-teal" />
            <span>Hoja de cálculo:</span>
          </div>
          <select
            value={selectedSheet}
            onChange={(e) => onSelectSheet?.(e.target.value)}
            className="mt-1.5 h-8 w-full rounded-md border border-line bg-bg px-2 text-xs font-medium text-ink outline-none focus:border-teal"
          >
            {sheets.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

