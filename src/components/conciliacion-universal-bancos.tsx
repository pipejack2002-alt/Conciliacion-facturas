import { useState, useMemo, useRef } from "react";
import {
  Landmark,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Upload,
  DollarSign,
  FileText,
  Search,
  RefreshCw,
  Sparkles,
  SlidersHorizontal,
  Table,
} from "lucide-react";
import { formatMoney, formatMoneyExact, formatDate } from "@/lib/format";
import {
  conciliarBancos,
  extractLibroBancos,
  getAvailableBankAccounts,
  type BankExtractItem,
  type BankConciliacionResult,
  type DetectedBankAccount,
} from "@/lib/conciliar-bancos";
import {
  processUniversalExtractFile,
  parseUniversalBankRows,
  type UniversalColumnMapping,
  type UniversalExtractPreview,
} from "@/lib/conciliar-bancos-universal";
import { readWorkbook, parseMovSheet } from "@/lib/parse-excel";
import type { MovLine } from "@/lib/types";
import { cn } from "@/lib/cn";
import * as XLSX from "xlsx";

export function ConciliacionUniversalBancosView({ movLines }: { movLines: MovLine[] }) {
  // Estado del archivo de extracto
  const [extractPreview, setExtractPreview] = useState<UniversalExtractPreview | null>(null);
  const [customExtractItems, setCustomExtractItems] = useState<BankExtractItem[] | null>(null);
  const [extractFileName, setExtractFileName] = useState<string>("");
  const [isExtractLoading, setIsExtractLoading] = useState<boolean>(false);
  const [showColumnMapper, setShowColumnMapper] = useState<boolean>(false);

  // Mapeo actual de columnas (para Excel/CSV)
  const [columnConfig, setColumnConfig] = useState<UniversalColumnMapping | null>(null);

  // Estado de libros contables
  const [customMovLines, setCustomMovLines] = useState<MovLine[] | null>(null);
  const [customMovFileName, setCustomMovFileName] = useState<string>("");
  const [isMovLoading, setIsMovLoading] = useState<boolean>(false);

  // Movimientos contables efectivos
  const effectiveMovLines = useMemo(() => {
    if (customMovLines && customMovLines.length > 0) return customMovLines;
    if (movLines && movLines.length > 0) return movLines;
    return [];
  }, [customMovLines, movLines]);

  // Cuentas de tesorería y bancos detectadas en libros
  const availableAccounts: DetectedBankAccount[] = useMemo(() => {
    return getAvailableBankAccounts(effectiveMovLines);
  }, [effectiveMovLines]);

  // Cuenta contable seleccionada
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("todas");

  // Saldos iniciales
  const [saldoInicialExtracto, setSaldoInicialExtracto] = useState<number>(0);
  const [saldoInicialLibros, setSaldoInicialLibros] = useState<number>(0);

  // Filtros de tabla
  const [tabFilter, setTabFilter] = useState<"todas" | "conciliado" | "banco_pend" | "transito">("todas");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fileInputExtractRef = useRef<HTMLInputElement>(null);
  const fileInputMovRef = useRef<HTMLInputElement>(null);

  // Items de extracto activos
  const effectiveExtractItems = useMemo<BankExtractItem[]>(() => {
    if (customExtractItems && customExtractItems.length > 0) return customExtractItems;
    if (extractPreview && extractPreview.items.length > 0) return extractPreview.items;
    return [];
  }, [customExtractItems, extractPreview]);

  // Movimientos de libros filtrados
  const librosBancos = useMemo(() => {
    return extractLibroBancos(
      effectiveMovLines,
      cuentaSeleccionada === "todas" ? undefined : cuentaSeleccionada
    );
  }, [effectiveMovLines, cuentaSeleccionada]);

  // Ejecución del motor de conciliación universal
  const concilResult: BankConciliacionResult = useMemo(() => {
    if (effectiveExtractItems.length === 0 && librosBancos.length === 0) {
      return {
        rows: [],
        summary: {
          saldoExtracto: 0,
          saldoLibros: 0,
          consignacionesEnTransito: 0,
          chequesEnTransito: 0,
          notasDebitoNoRegistradas: 0,
          notasCreditoNoRegistradas: 0,
          saldoConciliado: 0,
          diferenciaCuadre: 0,
          cuadrado: true,
          totalItemsBanco: 0,
          totalItemsLibros: 0,
          totalConciliados: 0,
        },
        cuentasBancosDetectadas: [],
      };
    }

    return conciliarBancos(
      effectiveExtractItems,
      librosBancos,
      saldoInicialExtracto,
      saldoInicialLibros
    );
  }, [effectiveExtractItems, librosBancos, saldoInicialExtracto, saldoInicialLibros]);

  // Manejo de carga de extracto universal (PDF, Excel, CSV)
  async function handleUploadExtract(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractLoading(true);
    setExtractFileName(file.name);

    try {
      const preview = await processUniversalExtractFile(file);
      setExtractPreview(preview);
      setColumnConfig(preview.config);
      setCustomExtractItems(null);

      if (preview.saldoInicial) {
        setSaldoInicialExtracto(preview.saldoInicial);
        setSaldoInicialLibros(preview.saldoInicial);
      }

      // Si es Excel o CSV, sugerir mapeador si no está seguro
      if (preview.fileType !== "pdf") {
        setShowColumnMapper(true);
      } else {
        setShowColumnMapper(false);
      }
    } catch (err) {
      console.error("Error al procesar archivo de extracto universal:", err);
      alert(
        "No se pudo procesar el archivo de extracto bancario. Verifique que sea un PDF legible o un archivo Excel/CSV."
      );
    } finally {
      setIsExtractLoading(false);
      if (e.target) e.target.value = "";
    }
  }

  // Re-procesar filas de Excel cuando el usuario cambia el mapeo de columnas manualmente
  function handleUpdateColumnMapping(updatedConfig: Partial<UniversalColumnMapping>) {
    if (!columnConfig || !extractPreview || !extractPreview.rawRowsSample) return;

    const newConfig = { ...columnConfig, ...updatedConfig };
    setColumnConfig(newConfig);

    // Si tenemos las filas en memoria o el archivo cargado
    if (extractPreview.fileType !== "pdf") {
      // Re-parsear
      const newItems = parseUniversalBankRows(
        [extractPreview.headers, ...extractPreview.rawRowsSample],
        { ...newConfig, headerRow: 0 }
      );
      if (newItems.length > 0) {
        setCustomExtractItems(newItems);
      }
    }
  }

  // Manejo de carga de movimiento contable auxiliar (Excel)
  async function handleUploadMov(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsMovLoading(true);
    setCustomMovFileName(file.name);

    try {
      const wb = await readWorkbook(file);
      const parsed = parseMovSheet(wb);

      if (parsed.length > 0) {
        setCustomMovLines(parsed);
      } else {
        alert("No se detectaron movimientos contables en el archivo seleccionado.");
      }
    } catch (err) {
      console.error("Error al procesar archivo contable auxiliar:", err);
      alert("No se pudo leer el archivo Excel de movimientos contables.");
    } finally {
      setIsMovLoading(false);
      if (e.target) e.target.value = "";
    }
  }

  // Filas filtradas por tab y por texto de búsqueda
  const rowsFiltradas = useMemo(() => {
    let list = concilResult.rows;

    if (tabFilter === "conciliado") {
      list = list.filter((r) => r.estado === "conciliado");
    } else if (tabFilter === "banco_pend") {
      list = list.filter(
        (r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco"
      );
    } else if (tabFilter === "transito") {
      list = list.filter((r) => r.estado === "partida_en_transito_libros");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.descripcion.toLowerCase().includes(q) ||
          r.referencia.toLowerCase().includes(q) ||
          r.fecha.includes(q) ||
          String(r.montoBanco).includes(q) ||
          String(r.montoLibros).includes(q) ||
          r.nota.toLowerCase().includes(q)
      );
    }

    return list;
  }, [concilResult.rows, tabFilter, searchQuery]);

  // Exportar Cédula de Conciliación Universal a Excel
  function exportarCedulaUniversal() {
    const entidadNombre = extractPreview?.bancoDetectado || "Cualquier Entidad Financiera";

    const wsData = [
      ["CÉDULA DE CONCILIACIÓN BANCARIA UNIVERSAL"],
      ["Entidad Financiera:", entidadNombre],
      ["Archivo Extracto:", extractFileName || "Extracto Bancario"],
      ["Cuenta Contable Conciliada:", cuentaSeleccionada === "todas" ? "Todas las cuentas de tesorería" : cuentaSeleccionada],
      ["Fecha de Emisión Cédula:", new Date().toLocaleDateString("es-CO")],
      [],
      ["ESTRUCTURA DE CONCILIACIÓN ARITMÉTICA"],
      ["Saldo Final según Extracto Bancario:", concilResult.summary.saldoExtracto],
      ["(+) Consignaciones en Tránsito:", concilResult.summary.consignacionesEnTransito],
      ["(-) Cheques y Giros pendientes de cobro:", -concilResult.summary.chequesEnTransito],
      ["(-) Notas Débito del Banco no registradas (4x1000 / Comisiones):", -concilResult.summary.notasDebitoNoRegistradas],
      ["(+) Notas Crédito del Banco no registradas (Rendimientos):", concilResult.summary.notasCreditoNoRegistradas],
      ["(=) Saldo Conciliado:", concilResult.summary.saldoConciliado],
      ["Saldo Final según Libros Contables:", concilResult.summary.saldoLibros],
      ["Diferencia de Cuadre:", concilResult.summary.diferenciaCuadre],
      [],
      ["DETALLE DE PARTIDAS Y MOVIMIENTOS"],
      ["Estado", "Fecha", "Descripción", "Referencia", "Tipo", "Monto Extracto", "Monto Libros", "Diagnóstico Contable"],
      ...concilResult.rows.map((r) => [
        r.estado,
        r.fecha,
        r.descripcion,
        r.referencia,
        r.tipo,
        r.montoBanco,
        r.montoLibros,
        r.nota,
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Conciliación Universal");
    XLSX.writeFile(wb, "conciliacion-bancaria-universal.xlsx");
  }

  return (
    <div className="space-y-6">
      {/* Banner de Conciliación Universal */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-bg-surface via-bg-surface to-teal-soft/20 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-lg bg-teal p-1.5 text-white shadow-xs">
                <Sparkles className="size-5" />
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-ink">
                Conciliador Universal de Bancos & Tesorería
              </h2>
              <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-bold text-teal">
                Cualquier Banco · Cualquier Formato
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-ink-muted">
              Motor universal adaptable a extractos de cualquier entidad bancaria en Colombia (Bancolombia, Davivienda, Bogotá, BBVA, Occidente, Itaú, Colpatria, etc.) y movimientos de cualquier software contable.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={exportarCedulaUniversal}
              disabled={effectiveExtractItems.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-deep transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download className="size-3.5" />
              <span>Exportar Cédula Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Zona de Carga Dual Universal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tarjeta 1: Extracto de Cualquier Banco (PDF, Excel o CSV) */}
        <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-teal-soft p-1.5 text-teal">
                  <FileText className="size-4" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-ink">
                  1. Extracto Bancario (Cualquier Banco)
                </span>
              </div>
              {extractPreview ? (
                <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                  {extractPreview.bancoDetectado}
                </span>
              ) : (
                <span className="rounded-full bg-bg-subtle text-ink-subtle px-2 py-0.5 text-[10px] font-medium">
                  PDF / Excel / CSV
                </span>
              )}
            </div>

            <p className="text-xs text-ink-muted mb-3">
              Arrastra o sube el extracto de tu banco en PDF, Excel o CSV. El motor detectará automáticamente las columnas y la estructura.
            </p>

            {extractPreview && (
              <div className="rounded-xl border border-line bg-bg-subtle/50 p-3 text-xs space-y-1.5 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Entidad / Formato:</span>
                  <span className="font-semibold text-ink">{extractPreview.bancoDetectado}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Tipo de Archivo:</span>
                  <span className="font-mono uppercase text-teal font-bold">{extractPreview.fileType}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-line/60">
                  <span className="text-ink-muted">Partidas Extraídas:</span>
                  <span className="font-bold text-teal">{effectiveExtractItems.length} movimientos</span>
                </div>

                {extractPreview.fileType !== "pdf" && (
                  <button
                    type="button"
                    onClick={() => setShowColumnMapper(!showColumnMapper)}
                    className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-teal hover:underline cursor-pointer"
                  >
                    <SlidersHorizontal className="size-3" />
                    <span>{showColumnMapper ? "Ocultar Mapeador de Columnas" : "Ajustar Mapeo de Columnas"}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <input
              ref={fileInputExtractRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleUploadExtract}
              className="hidden"
            />
            <button
              type="button"
              disabled={isExtractLoading}
              onClick={() => fileInputExtractRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-teal/60 bg-teal-soft/20 py-2.5 px-3 text-xs font-semibold text-teal hover:bg-teal-soft/40 transition cursor-pointer"
            >
              {isExtractLoading ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Analizando extracto bancario...</span>
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  <span>
                    {extractPreview
                      ? "Cargar Otro Extracto Bancario"
                      : "Subir Extracto Bancario (PDF / Excel / CSV)"}
                  </span>
                </>
              )}
            </button>
            <div className="mt-1 text-[11px] text-center text-ink-subtle truncate">
              {extractFileName || "Ningún archivo cargado"}
            </div>
          </div>
        </div>

        {/* Tarjeta 2: Movimiento Contable Auxiliar */}
        <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-teal-soft p-1.5 text-teal">
                  <FileSpreadsheet className="size-4" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-ink">
                  2. Movimiento Contable Auxiliar
                </span>
              </div>
              {effectiveMovLines.length > 0 ? (
                <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                  {effectiveMovLines.length} registros
                </span>
              ) : (
                <span className="rounded-full bg-bg-subtle text-ink-subtle px-2 py-0.5 text-[10px] font-medium">
                  Pendiente
                </span>
              )}
            </div>

            <p className="text-xs text-ink-muted mb-3">
              {movLines && movLines.length > 0 && !customMovLines
                ? "Utilizando los movimientos auxiliares cargados en la sesión activa. También puedes cargar otro archivo Excel si lo deseas."
                : "Carga el reporte auxiliar de movimientos contables exportado de tu ERP (Siigo, Helisa, World Office, CGUNO, SAP, Alegra, etc.)."}
            </p>

            {/* Selector de Cuenta Contable */}
            <div className="rounded-xl border border-line bg-bg-subtle/50 p-3 text-xs space-y-2 mb-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">Cuenta a Conciliar:</span>
                <span className="text-[11px] text-ink-muted">
                  {availableAccounts.length} cuentas de tesorería detectadas
                </span>
              </div>

              <select
                value={cuentaSeleccionada}
                onChange={(e) => setCuentaSeleccionada(e.target.value)}
                className="w-full rounded-lg border border-line bg-bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink focus:outline-teal"
              >
                <option value="todas">
                  Todas las cuentas de tesorería y bancos ({librosBancos.length} movs)
                </option>
                {availableAccounts.map((acc) => (
                  <option key={acc.cuenta} value={acc.cuenta}>
                    {acc.cuenta} - {acc.cuentaNombre} ({acc.totalMovimientos} registros)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <input
              ref={fileInputMovRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUploadMov}
              className="hidden"
            />
            <button
              type="button"
              disabled={isMovLoading}
              onClick={() => fileInputMovRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-teal/60 bg-teal-soft/20 py-2.5 px-3 text-xs font-semibold text-teal hover:bg-teal-soft/40 transition cursor-pointer"
            >
              {isMovLoading ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Procesando archivo contable...</span>
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  <span>
                    {effectiveMovLines.length > 0
                      ? "Cargar Otro Excel Contable"
                      : "Subir Archivo Excel Contable"}
                  </span>
                </>
              )}
            </button>
            <div className="mt-1 text-[11px] text-center text-ink-subtle truncate">
              {customMovFileName ||
                (movLines && movLines.length > 0 ? "Movimientos de la sesión activa" : "Sin archivo")}
            </div>
          </div>
        </div>
      </div>

      {/* Asistente Visual de Mapeo de Columnas (para Excel o CSV con columnas personalizadas) */}
      {showColumnMapper && extractPreview && extractPreview.headers.length > 0 && columnConfig && (
        <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Table className="size-4 text-teal" />
              <h3 className="font-semibold text-xs text-ink uppercase tracking-wider">
                Mapeador Visual de Columnas del Extracto
              </h3>
            </div>
            <span className="text-xs text-ink-muted">
              Asigna qué columna del archivo corresponde a cada campo
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-1">Columna Fecha:</label>
              <select
                value={columnConfig.fechaCol}
                onChange={(e) => handleUpdateColumnMapping({ fechaCol: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-line bg-bg-subtle px-2 py-1.5 text-xs text-ink"
              >
                {extractPreview.headers.map((h, idx) => (
                  <option key={idx} value={idx}>
                    Col {idx + 1}: {h || `(Sin título ${idx + 1})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-1">Columna Concepto:</label>
              <select
                value={columnConfig.descripcionCol}
                onChange={(e) => handleUpdateColumnMapping({ descripcionCol: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-line bg-bg-subtle px-2 py-1.5 text-xs text-ink"
              >
                {extractPreview.headers.map((h, idx) => (
                  <option key={idx} value={idx}>
                    Col {idx + 1}: {h || `(Sin título ${idx + 1})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-1">Columna Referencia:</label>
              <select
                value={columnConfig.referenciaCol}
                onChange={(e) => handleUpdateColumnMapping({ referenciaCol: parseInt(e.target.value) })}
                className="w-full rounded-lg border border-line bg-bg-subtle px-2 py-1.5 text-xs text-ink"
              >
                {extractPreview.headers.map((h, idx) => (
                  <option key={idx} value={idx}>
                    Col {idx + 1}: {h || `(Sin título ${idx + 1})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-ink-muted mb-1">Modo de Valores:</label>
              <select
                value={columnConfig.valorMode}
                onChange={(e) => handleUpdateColumnMapping({ valorMode: e.target.value as any })}
                className="w-full rounded-lg border border-line bg-bg-subtle px-2 py-1.5 text-xs font-semibold text-ink"
              >
                <option value="separate">Débito y Crédito separados</option>
                <option value="single">Columna Única (+ / -)</option>
              </select>
            </div>

            {columnConfig.valorMode === "separate" ? (
              <>
                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Débitos / Retiros:</label>
                  <select
                    value={columnConfig.debitoCol ?? -1}
                    onChange={(e) => handleUpdateColumnMapping({ debitoCol: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-line bg-bg-subtle px-2 py-1.5 text-xs text-ink"
                  >
                    {extractPreview.headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Sin título ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-ink-muted mb-1">Créditos / Abonos:</label>
                  <select
                    value={columnConfig.creditoCol ?? -1}
                    onChange={(e) => handleUpdateColumnMapping({ creditoCol: parseInt(e.target.value) })}
                    className="w-full rounded-lg border border-line bg-bg-subtle px-2 py-1.5 text-xs text-ink"
                  >
                    {extractPreview.headers.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Sin título ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[11px] font-medium text-ink-muted mb-1">Columna Valor Neto:</label>
                <select
                  value={columnConfig.valorCol ?? -1}
                  onChange={(e) => handleUpdateColumnMapping({ valorCol: parseInt(e.target.value) })}
                  className="w-full rounded-lg border border-line bg-bg-subtle px-2 py-1.5 text-xs text-ink"
                >
                  {extractPreview.headers.map((h, idx) => (
                    <option key={idx} value={idx}>
                      Col {idx + 1}: {h || `(Sin título ${idx + 1})`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tarjeta de Resumen Arimético y Estado de Cuadre */}
      {concilResult.rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Panel A: Estado del Cuadre */}
          <div
            className={cn(
              "lg:col-span-4 rounded-2xl border p-5 shadow-xs flex flex-col justify-between transition-all",
              concilResult.summary.cuadrado
                ? "border-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/25 text-emerald-950 dark:text-emerald-200"
                : "border-amber-300 bg-amber-50/80 dark:bg-amber-950/25 text-amber-950 dark:text-amber-200"
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Resultado de Conciliación
                </span>
                {concilResult.summary.cuadrado ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-200/80 dark:bg-emerald-900/60 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="size-3.5" />
                    Cuadrado
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-amber-200/80 dark:bg-amber-900/60 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <AlertCircle className="size-3.5" />
                    Con Diferencia
                  </span>
                )}
              </div>

              <div className="mt-3">
                <div className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
                  {concilResult.summary.cuadrado
                    ? "CUADRADO PERFECTO"
                    : `DIFERENCIA: ${formatMoney(concilResult.summary.diferenciaCuadre)}`}
                </div>
                <p className="mt-1 text-xs opacity-90 leading-relaxed">
                  {concilResult.summary.cuadrado
                    ? "El saldo bancario ajustado coincide con el saldo de libros contables al 100%."
                    : "Existen partidas pendientes por conciliar o diferencias en el saldo inicial."}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-current/20 space-y-1 text-xs font-medium">
              <div className="flex items-center justify-between">
                <span>Movimientos Conciliados:</span>
                <span className="font-bold">
                  {concilResult.summary.totalConciliados} de {effectiveExtractItems.length} en extracto
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Registros en Libros Analizados:</span>
                <span className="font-bold">{librosBancos.length} movimientos</span>
              </div>
            </div>
          </div>

          {/* Panel B: Cuadro Aritmético de Conciliación */}
          <div className="lg:col-span-8 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className="font-semibold text-sm text-ink flex items-center gap-1.5">
                <DollarSign className="size-4 text-teal" />
                Cédula de Conciliación Bancaria Universal (DIAN / NIIF)
              </h3>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink-muted">Saldo Inicial:</span>
                <input
                  type="number"
                  value={saldoInicialExtracto}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setSaldoInicialExtracto(val);
                    setSaldoInicialLibros(val);
                  }}
                  className="w-32 rounded-lg border border-line bg-bg-subtle/80 px-2 py-1 font-mono text-right text-xs font-bold text-ink focus:outline-teal"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-line/60">
                <span className="text-ink-muted">Saldo Final según Extracto:</span>
                <span className="font-mono font-bold text-ink">
                  {formatMoneyExact(concilResult.summary.saldoExtracto)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-line/60 text-emerald-600 dark:text-emerald-400">
                <span>(+) Consignaciones en Tránsito:</span>
                <span className="font-mono font-bold">
                  {formatMoneyExact(concilResult.summary.consignacionesEnTransito)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-line/60 text-rose-600 dark:text-rose-400">
                <span>(-) Cheques / Transferencias en Tránsito:</span>
                <span className="font-mono font-bold">
                  -{formatMoneyExact(concilResult.summary.chequesEnTransito)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-line/60 text-amber-600 dark:text-amber-400">
                <span>(-) Notas Débito Banco (4x1000 / Comisiones):</span>
                <span className="font-mono font-bold">
                  -{formatMoneyExact(concilResult.summary.notasDebitoNoRegistradas)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-line/60 text-blue-600 dark:text-blue-400">
                <span>(+) Notas Crédito Banco (Rendimientos):</span>
                <span className="font-mono font-bold">
                  +{formatMoneyExact(concilResult.summary.notasCreditoNoRegistradas)}
                </span>
              </div>

              <div className="flex justify-between py-1 border-b border-teal/40 bg-teal-soft/20 px-2 rounded font-semibold text-teal-deep dark:text-teal">
                <span>(=) Saldo Bancario Conciliado:</span>
                <span className="font-mono font-bold">
                  {formatMoneyExact(concilResult.summary.saldoConciliado)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Filtros de Pestañas y Buscador */}
      {concilResult.rows.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "todas", label: `Todos (${concilResult.rows.length})` },
              { id: "conciliado", label: `Conciliados (${concilResult.summary.totalConciliados})` },
              {
                id: "banco_pend",
                label: `Notas Banco (${concilResult.rows.filter((r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco").length})`,
              },
              {
                id: "transito",
                label: `En Tránsito (${concilResult.rows.filter((r) => r.estado === "partida_en_transito_libros").length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTabFilter(tab.id as any)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer select-none",
                  tabFilter === tab.id
                    ? "bg-teal text-white shadow-xs font-bold"
                    : "bg-bg-surface text-ink-muted hover:bg-bg-subtle hover:text-ink border border-line"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-muted" />
            <input
              type="text"
              placeholder="Buscar por detalle, valor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-line bg-bg-surface pl-8 pr-3 py-1.5 text-xs text-ink focus:outline-teal shadow-2xs"
            />
          </div>
        </div>
      )}

      {/* Tabla Detallada de Partidas */}
      {concilResult.rows.length > 0 && (
        <div className="rounded-2xl border border-line bg-bg-surface overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs table-auto">
              <thead className="border-b border-line bg-bg-subtle/80 uppercase tracking-wider text-ink-subtle font-semibold">
                <tr>
                  <th className="px-3.5 py-3">Estado</th>
                  <th className="px-3.5 py-3">Fecha</th>
                  <th className="px-3.5 py-3">Descripción / Concepto</th>
                  <th className="px-3.5 py-3">Referencia / Doc</th>
                  <th className="px-3.5 py-3 text-right">Monto Extracto</th>
                  <th className="px-3.5 py-3 text-right">Monto Libros</th>
                  <th className="px-3.5 py-3">Diagnóstico Contable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {rowsFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-xs text-ink-muted">
                      No se encontraron partidas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  rowsFiltradas.map((r) => (
                    <tr key={r.id} className="hover:bg-bg-subtle/40 transition">
                      <td className="px-3.5 py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border",
                            r.estado === "conciliado"
                              ? "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : r.esGmf
                              ? "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 font-extrabold"
                              : r.esComision
                              ? "bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                              : r.esRendimiento
                              ? "bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300"
                              : r.estado === "partida_en_transito_libros"
                              ? "bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300"
                              : "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200"
                          )}
                        >
                          {r.estado === "conciliado"
                            ? r.itemsLibrosLote
                              ? "Lote ACH"
                              : "Conciliado"
                            : r.esGmf
                            ? "GMF 4x1000"
                            : r.esComision
                            ? "Comisión Banco"
                            : r.esRendimiento
                            ? "Rendimiento"
                            : "En Tránsito"}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-ink-muted whitespace-nowrap">
                        {formatDate(r.fecha)}
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-ink max-w-[320px] truncate" title={r.descripcion}>
                        {r.descripcion}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-ink-subtle whitespace-nowrap">
                        {r.referencia || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-semibold text-right text-ink whitespace-nowrap">
                        {r.montoBanco > 0 ? formatMoneyExact(r.montoBanco) : "—"}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono font-semibold text-right text-ink whitespace-nowrap">
                        {r.montoLibros > 0 ? formatMoneyExact(r.montoLibros) : "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-ink-muted leading-tight max-w-[360px]">
                        {r.nota}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
