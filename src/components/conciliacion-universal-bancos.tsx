import { useState, useMemo, useRef, useEffect, useCallback, Fragment } from "react";
import {
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
  BadgePercent,
  CreditCard,
  TrendingUp,
  Clock,
  Info,
  Layers,
  ChevronDown,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  History,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { formatMoneyExact, formatDate } from "@/lib/format";
import {
  conciliarBancos,
  extractLibroBancos,
  getAvailableBankAccounts,
  getBankExecutiveBreakdown,
  type BankExtractItem,
  type BankConciliacionResult,
  type BankConciliacionRow,
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

const SOFTWARE_NAMES: Record<string, string> = {
  siigo_pyme: "Siigo Pyme (Desktop)",
  siigo_nube: "Siigo Nube",
  world_office: "World Office",
  helisa: "Helisa (GW/NI)",
  alegra: "Alegra",
  sap_b1: "SAP Business One",
  novasoft: "Novasoft",
  monad: "Monad",
  custom: "Universal / Personalizado",
  auto: "Auto-Detección Inteligente",
};

interface ConciliacionUniversalBancosProps {
  movLines: MovLine[];
  externalClearTrigger?: number;
  onVaciar?: () => void;
  onHasDataChange?: (hasData: boolean) => void;
}

function getCleanDescription(r: BankConciliacionRow): string {
  if (r.esGmf) {
    return "GRAVAMEN MOVIMIENTOS FINANCIEROS (GMF 4×1000)";
  }
  if (r.descripcion && r.descripcion.includes(" ↔ ")) {
    return r.descripcion.split(" ↔ ")[0].trim();
  }
  return r.descripcion || "—";
}

export function ConciliacionUniversalBancosView({
  movLines,
  externalClearTrigger,
  onVaciar,
  onHasDataChange,
}: ConciliacionUniversalBancosProps) {
  // Estado del archivo de extracto
  const [extractPreview, setExtractPreview] = useState<UniversalExtractPreview | null>(null);
  const [selectedSubAccount, setSelectedSubAccount] = useState<string>("consolidado");
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
  const [isMovimientosVaciados, setIsMovimientosVaciados] = useState<boolean>(false);

  // Movimientos contables efectivos: si se vació explícitamente, retorna arreglo vacío
  const effectiveMovLines = useMemo(() => {
    if (isMovimientosVaciados) return [];
    if (customMovLines && customMovLines.length > 0) return customMovLines;
    if (customMovLines && customMovLines.length === 0) return [];
    if (movLines && movLines.length > 0) return movLines;
    return [];
  }, [isMovimientosVaciados, customMovLines, movLines]);

  // Cuentas de tesorería y bancos detectadas en libros
  const availableAccounts: DetectedBankAccount[] = useMemo(() => {
    return getAvailableBankAccounts(effectiveMovLines);
  }, [effectiveMovLines]);

  // Cuenta contable seleccionada
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("todas");
  const lastAutoDetectedKeyRef = useRef<string>("");

  // Saldos iniciales
  const [saldoInicialExtracto, setSaldoInicialExtracto] = useState<number>(0);
  const [saldoInicialLibros, setSaldoInicialLibros] = useState<number>(0);

  // Manejo formateado con separadores de miles y decimales para el Saldo Inicial
  const [saldoInputStr, setSaldoInputStr] = useState<string>(() =>
    formatMoneyExact(0).replace("$", "").trim()
  );

  useEffect(() => {
    setSaldoInputStr(formatMoneyExact(saldoInicialExtracto).replace("$", "").trim());
  }, [saldoInicialExtracto]);

  function handleSaldoChange(val: string) {
    setSaldoInputStr(val);
    const clean = val.replace(/\$/g, "").replace(/\s/g, "").trim();
    let num = 0;
    if (clean.includes(",") && clean.includes(".")) {
      num = parseFloat(clean.replace(/\./g, "").replace(",", ".")) || 0;
    } else if (clean.includes(",")) {
      num = parseFloat(clean.replace(",", ".")) || 0;
    } else {
      num = parseFloat(clean) || 0;
    }
    setSaldoInicialExtracto(num);
    setSaldoInicialLibros(num);
  }

  function handleSaldoBlur() {
    setSaldoInputStr(formatMoneyExact(saldoInicialExtracto).replace("$", "").trim());
  }

  const handleVaciarUniversal = useCallback(() => {
    setExtractPreview(null);
    setCustomExtractItems(null);
    setSelectedSubAccount("consolidado");
    setExtractFileName("");
    setColumnConfig(null);
    setCustomMovLines([]);
    setIsMovimientosVaciados(true);
    setCustomMovFileName("");
    setSaldoInicialExtracto(0);
    setSaldoInicialLibros(0);
    setSaldoInputStr("0,00");
    setShowColumnMapper(false);
    setExpandedRowId(null);
    lastAutoDetectedKeyRef.current = "";
    if (fileInputExtractRef.current) fileInputExtractRef.current.value = "";
    if (fileInputMovRef.current) fileInputMovRef.current.value = "";
    onVaciar?.();
  }, [onVaciar]);

  const handleReactivarSesionMov = useCallback(() => {
    setIsMovimientosVaciados(false);
    setCustomMovLines(null);
    setCustomMovFileName("");
  }, []);

  // Escuchar trigger de vaciado externo proveniente del banner principal
  useEffect(() => {
    if (externalClearTrigger && externalClearTrigger > 0) {
      handleVaciarUniversal();
    }
  }, [externalClearTrigger, handleVaciarUniversal]);

  // Fila expandida para auditoría detallada de comprobantes / lotes ACH
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedDescIds, setExpandedDescIds] = useState<Set<string>>(new Set());

  const toggleDesc = (id: string) => {
    setExpandedDescIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtros de tabla
  const [tabFilter, setTabFilter] = useState<"todas" | "conciliado" | "banco_pend" | "transito">("todas");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fileInputExtractRef = useRef<HTMLInputElement>(null);
  const fileInputMovRef = useRef<HTMLInputElement>(null);

  // Items de extracto activos según subcuenta seleccionada (si aplica)
  const effectiveExtractItems = useMemo<BankExtractItem[]>(() => {
    if (customExtractItems && customExtractItems.length > 0) return customExtractItems;
    if (extractPreview) {
      if (extractPreview.cuentasDisponibles && extractPreview.cuentasDisponibles.length > 0) {
        const sub =
          extractPreview.cuentasDisponibles.find((c) => c.id === selectedSubAccount) ||
          extractPreview.cuentasDisponibles[0];
        return sub.items;
      }
      if (extractPreview.items && extractPreview.items.length > 0) return extractPreview.items;
    }
    return [];
  }, [customExtractItems, extractPreview, selectedSubAccount]);

  // Auto-selección inteligente de cuenta contable según la entidad bancaria detectada (solo al cargar extracto nuevo)
  useEffect(() => {
    if (!extractPreview || availableAccounts.length === 0) return;

    const currentKey = `${extractPreview.fileName || ""}_${extractPreview.bancoId || ""}_${extractPreview.numeroCuenta || ""}_${extractPreview.items?.length || 0}`;
    if (lastAutoDetectedKeyRef.current === currentKey) return;
    lastAutoDetectedKeyRef.current = currentKey;

    const bName = (extractPreview.bancoDetectado || "").toLowerCase();
    const bId = extractPreview.bancoId || "";

    if (bId === "credicorp" || bName.includes("credicorp") || bName.includes("correval") || bName.includes("fonval") || bName.includes("cartera colectiva")) {
      const credAccounts = availableAccounts.filter(
        (a) =>
          a.cuenta.startsWith("12503511") ||
          a.cuenta.startsWith("12450541") ||
          a.cuenta.startsWith("1144") ||
          a.cuenta.startsWith("1125") ||
          /credicorp|correval|fonval|serfinco|fic\b|cartera\s*colectiva|fondo.*inversi/i.test(a.cuentaNombre)
      );
      if (credAccounts.length > 0) {
        // Ordenar por volumen de movimientos (la cuenta de mayor actividad primero)
        credAccounts.sort((a, b) => b.totalMovimientos - a.totalMovimientos);
        setCuentaSeleccionada(credAccounts[0].cuenta);
        return;
      }
    }

    if (bId === "banco_caja_social" || bName.includes("caja social") || bName.includes("bcsc") || bName.includes("colmena")) {
      const matchBcsc = availableAccounts.find(
        (a) => a.cuenta.startsWith("11100512") || /bcsc|colmena|caja\s*social/i.test(a.cuentaNombre)
      );
      if (matchBcsc) {
        setCuentaSeleccionada(matchBcsc.cuenta);
        return;
      }
    }

    if (bId === "bancolombia" || bName.includes("bancolombia")) {
      const matchBan = availableAccounts.find((a) => /bancolombia/i.test(a.cuentaNombre));
      if (matchBan) {
        setCuentaSeleccionada(matchBan.cuenta);
        return;
      }
    }

    if (bId === "davivienda" || bName.includes("davivienda")) {
      const matchDav = availableAccounts.find((a) => /davivienda/i.test(a.cuentaNombre));
      if (matchDav) {
        setCuentaSeleccionada(matchDav.cuenta);
        return;
      }
    }

    if (bId === "banistmo" || bName.includes("banistmo")) {
      const matchBan = availableAccounts.find((a) => /banistmo/i.test(a.cuentaNombre));
      if (matchBan) {
        setCuentaSeleccionada(matchBan.cuenta);
        return;
      }
    }

    if (availableAccounts.length === 1) {
      setCuentaSeleccionada(availableAccounts[0].cuenta);
    }
  }, [extractPreview, availableAccounts]);

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

  // Desglose ejecutivo de conceptos bancarios (GMF 4x1000, Comisiones, Rendimientos, Lotes ACH)
  const executiveBreakdown = useMemo(() => {
    return getBankExecutiveBreakdown(concilResult.rows);
  }, [concilResult.rows]);

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
      setIsMovimientosVaciados(false);

      if (preview.cuentasDisponibles && preview.cuentasDisponibles.length > 0) {
        const defaultSub = preview.cuentasDisponibles[0];
        setSelectedSubAccount(defaultSub.id);
        if (defaultSub.saldoInicial !== undefined) {
          setSaldoInicialExtracto(defaultSub.saldoInicial);
          setSaldoInicialLibros(defaultSub.saldoInicial);
        }
      } else if (preview.saldoInicial) {
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
      if (fileInputExtractRef.current) fileInputExtractRef.current.value = "";
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
        setIsMovimientosVaciados(false);
      } else {
        alert("No se detectaron movimientos contables en el archivo seleccionado.");
      }
    } catch (err) {
      console.error("Error al procesar archivo contable auxiliar:", err);
      alert("No se pudo leer el archivo Excel de movimientos contables.");
    } finally {
      setIsMovLoading(false);
      if (fileInputMovRef.current) fileInputMovRef.current.value = "";
      if (e.target) e.target.value = "";
    }
  }

  // Notificar al componente contenedor si hay datos en modo universal
  const hasUniversalData = useMemo(() => {
    return Boolean(
      effectiveExtractItems.length > 0 ||
      effectiveMovLines.length > 0 ||
      extractFileName !== "" ||
      customMovFileName !== "" ||
      extractPreview !== null
    );
  }, [effectiveExtractItems.length, effectiveMovLines.length, extractFileName, customMovFileName, extractPreview]);

  useEffect(() => {
    onHasDataChange?.(hasUniversalData);
  }, [hasUniversalData, onHasDataChange]);

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

  // Estado de ordenamiento
  const [sortField, setSortField] = useState<
    "estado" | "fecha" | "descripcion" | "referencia" | "montoBanco" | "montoLibros" | "diagnostico"
  >("fecha");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleToggleSort = (
    field: "estado" | "fecha" | "descripcion" | "referencia" | "montoBanco" | "montoLibros" | "diagnostico"
  ) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "montoBanco" || field === "montoLibros" ? "desc" : "asc");
    }
  };

  const rowsOrdenadas = useMemo(() => {
    const list = [...rowsFiltradas];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "estado": {
          const rank = (row: BankConciliacionRow) => {
            if (row.estado === "nota_debito_banco") return 1;
            if (row.estado === "nota_credito_banco") return 2;
            if (row.estado === "partida_en_transito_libros") return 3;
            return 4;
          };
          cmp = rank(a) - rank(b);
          break;
        }
        case "fecha": {
          cmp = (a.fecha || "").localeCompare(b.fecha || "");
          break;
        }
        case "descripcion": {
          cmp = (a.descripcion || "").localeCompare(b.descripcion || "", "es", { sensitivity: "base" });
          break;
        }
        case "referencia": {
          cmp = (a.referencia || "").localeCompare(b.referencia || "", "es", { numeric: true, sensitivity: "base" });
          break;
        }
        case "montoBanco": {
          cmp = (a.montoBanco || 0) - (b.montoBanco || 0);
          break;
        }
        case "montoLibros": {
          cmp = (a.montoLibros || 0) - (b.montoLibros || 0);
          break;
        }
        case "diagnostico": {
          cmp = (a.nota || "").localeCompare(b.nota || "", "es", { sensitivity: "base" });
          break;
        }
        default:
          cmp = 0;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rowsFiltradas, sortField, sortDirection]);

  // Exportar Estado Oficial de Conciliación Universal a Excel
  function exportarConciliacionUniversal() {
    const entidadNombre = extractPreview?.bancoDetectado || "Cualquier Entidad Financiera";

    const wsData = [
      ["ESTADO OFICIAL DE CONCILIACIÓN BANCARIA UNIVERSAL"],
      ["Entidad Financiera:", entidadNombre],
      ["Archivo Extracto:", extractFileName || "Extracto Bancario"],
      ["Cuenta Contable Conciliada:", cuentaSeleccionada === "todas" ? "Todas las cuentas de tesorería" : cuentaSeleccionada],
      ["Fecha de Emisión:", new Date().toLocaleDateString("es-CO")],
      [],
      ["ESTRUCTURA DE CONCILIACIÓN ARITMÉTICA (NORMA TÉCNICA NIIF / DIAN)"],
      ["Saldo Final según Extracto Bancario:", concilResult.summary.saldoExtracto],
      ["(+) Consignaciones en Tránsito:", concilResult.summary.consignacionesEnTransito],
      ["(-) Cheques y Giros pendientes de cobro:", -concilResult.summary.chequesEnTransito],
      ["(-) Notas Débito del Banco no registradas (4x1000 / Comisiones):", -concilResult.summary.notasDebitoNoRegistradas],
      ["(+) Notas Crédito del Banco no registradas (Rendimientos):", concilResult.summary.notasCreditoNoRegistradas],
      ["(=) Saldo Conciliado:", concilResult.summary.saldoConciliado],
      ["Saldo Final según Libros Contables:", concilResult.summary.saldoLibros],
      ["Diferencia de Cuadre:", concilResult.summary.diferenciaCuadre],
      [],
      ["DETALLE DE PARTIDAS Y AUDITORÍA DE COMPROBANTES"],
      ["Estado", "Fecha", "Descripción", "Referencia", "Tipo", "Monto Extracto", "Monto Libros", "Diagnóstico Contable", "Comprobantes / Lote Asociado"],
      ...concilResult.rows.map((r) => [
        r.estado,
        r.fecha,
        r.descripcion,
        r.referencia,
        r.tipo,
        r.montoBanco,
        r.montoLibros,
        r.nota,
        r.itemsLibrosLote
          ? r.itemsLibrosLote.map((c) => `${c.comprobante} ($${c.credito || c.debito})`).join("; ")
          : r.itemLibros
          ? `${r.itemLibros.comprobante || ""} - ${r.itemLibros.nombre || ""}`
          : "—",
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
      <div className="rounded-2xl border border-line bg-linear-to-r from-bg-surface via-bg-surface to-teal-soft/20 p-5 shadow-xs">
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
            {hasUniversalData && (
              <button
                type="button"
                onClick={handleVaciarUniversal}
                className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger-bg px-3.5 py-2 text-xs font-semibold text-danger hover:bg-danger hover:text-white transition cursor-pointer shadow-2xs"
                title="Vaciar extracto y movimientos cargados para dejar la plantilla en blanco"
              >
                <Trash2 className="size-3.5" />
                <span>Vaciar Datos</span>
              </button>
            )}

            <button
              type="button"
              onClick={exportarConciliacionUniversal}
              disabled={effectiveExtractItems.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-deep transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Download className="size-3.5" />
              <span>Exportar Conciliación a Excel</span>
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

                {/* Selector de Subcuentas / Portafolios cuando el extracto maneja múltiples saldos */}
                {extractPreview.cuentasDisponibles && extractPreview.cuentasDisponibles.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-line/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-ink flex items-center gap-1.5">
                        <Layers className="size-3.5 text-teal" />
                        Subcuenta / Portafolio a Conciliar:
                      </span>
                      <span className="text-[10px] text-teal font-semibold">
                        {extractPreview.cuentasDisponibles.length} portafolios detectados
                      </span>
                    </div>
                    <select
                      value={selectedSubAccount}
                      onChange={(e) => {
                        const newSubId = e.target.value;
                        setSelectedSubAccount(newSubId);
                        const chosen = extractPreview.cuentasDisponibles?.find((c) => c.id === newSubId);
                        if (chosen && chosen.saldoInicial !== undefined) {
                          setSaldoInicialExtracto(chosen.saldoInicial);
                          setSaldoInicialLibros(chosen.saldoInicial);
                        }
                      }}
                      className="w-full rounded-lg border border-teal/40 bg-teal-soft/10 px-2.5 py-1.5 text-xs font-bold text-ink focus:outline-teal"
                    >
                      {extractPreview.cuentasDisponibles.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.nombre} ({sub.items.length} movs · Saldo Fin: {formatMoneyExact(sub.saldoFinal)})
                        </option>
                      ))}
                    </select>
                    <div className="mt-1 text-[10px] text-ink-muted">
                      * El extracto maneja múltiples saldos y la suma total consolidada para cuadrar con cualquier cuenta.
                    </div>
                  </div>
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

            {effectiveMovLines.length > 0 && (
              <div className="flex items-center justify-between gap-1.5 mb-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-soft/60 px-2.5 py-0.5 text-[11px] font-bold text-teal">
                  <Sparkles className="size-3" />
                  Software: {SOFTWARE_NAMES[effectiveMovLines[0]?.origenSoftware || "auto"] || "Auto-Detección Universal"}
                </span>
                <span className="text-[10px] text-ink-muted">
                  {availableAccounts.length} cuentas de tesorería
                </span>
              </div>
            )}

            <p className="text-xs text-ink-muted mb-3">
              {movLines && movLines.length > 0 && !customMovLines
                ? "Utilizando los movimientos auxiliares cargados en la sesión activa. También puedes cargar otro archivo Excel si lo deseas."
                : "Carga el reporte auxiliar de movimientos contables exportado de tu ERP (Siigo, Helisa, World Office, CGUNO, SAP, Alegra, etc.)."}
            </p>

            {/* Selector de Cuenta Contable */}
            <div className="rounded-xl border border-line bg-bg-subtle/50 p-3 text-xs space-y-2 mb-3">
              {(() => {
                const credicorpAccounts = availableAccounts.filter(
                  (a) =>
                    a.cuenta.startsWith("12503511") ||
                    a.cuenta.startsWith("12450541") ||
                    a.cuenta.startsWith("1144") ||
                    a.cuenta.startsWith("1125") ||
                    /credicorp|correval|fonval|serfinco|fic\b|cartera\s*colectiva|fondo.*inversi/i.test(a.cuentaNombre)
                );
                const credicorpTotalMovs = credicorpAccounts.reduce(
                  (sum, a) => sum + a.totalMovimientos,
                  0
                );

                return (
                  <>
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
                        Todas las cuentas de tesorería y bancos ({effectiveMovLines.length} movs)
                      </option>
                      {credicorpAccounts.length > 1 && (
                        <option value="credicorp_all">
                          ⭐ Credicorp Capital - Ambas Cuentas ({credicorpAccounts.map((a) => a.cuenta).join(" + ")}) ({credicorpTotalMovs} registros)
                        </option>
                      )}
                      {availableAccounts.map((acc) => {
                        const isCredicorp = credicorpAccounts.some((c) => c.cuenta === acc.cuenta);
                        return (
                          <option key={acc.cuenta} value={acc.cuenta}>
                            {acc.cuenta} - {acc.cuentaNombre} ({acc.totalMovimientos} registros)
                            {isCredicorp ? " · [Credicorp Capital]" : ""}
                          </option>
                        );
                      })}
                    </select>

                    {cuentaSeleccionada !== "todas" && (
                      <div className="pt-1 flex items-center justify-between text-[11px] text-ink-muted">
                        <span>
                          {cuentaSeleccionada === "credicorp_all"
                            ? "Movimientos en cuentas Credicorp:"
                            : "Movimientos en esta cuenta:"}
                        </span>
                        <span className="font-mono font-bold text-ink">{librosBancos.length} líneas</span>
                      </div>
                    )}
                  </>
                );
              })()}
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
                (movLines && movLines.length > 0 && !isMovimientosVaciados
                  ? "Movimientos de la sesión activa"
                  : "Sin archivo")}
            </div>
            {isMovimientosVaciados && movLines && movLines.length > 0 && (
              <div className="mt-2 text-center">
                <button
                  type="button"
                  onClick={handleReactivarSesionMov}
                  className="text-[11px] text-teal font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer bg-teal-soft/30 px-2.5 py-1 rounded-lg"
                  title="Volver a asociar los movimientos del libro auxiliar de la sesión actual"
                >
                  <span>Reactivar movimientos de la sesión DIAN ({movLines.length})</span>
                </button>
              </div>
            )}
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
                onChange={(e) => handleUpdateColumnMapping({ valorMode: e.target.value as "separate" | "single" })}
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

      {/* Tarjeta de Resumen Aritmético y Estado de Cuadre */}
      {concilResult.rows.length > 0 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Panel A: Estado del Cuadre con Alto Contraste */}
            <div
              className={cn(
                "lg:col-span-4 rounded-2xl border-2 p-5 shadow-xs flex flex-col justify-between transition-all",
                concilResult.summary.cuadrado
                  ? "border-emerald-500/70 bg-linear-to-br from-emerald-50/90 via-white to-emerald-50/40 dark:from-emerald-950/60 dark:via-bg-surface dark:to-emerald-950/20 text-ink"
                  : "border-amber-500/70 bg-linear-to-br from-amber-50/90 via-white to-amber-50/40 dark:from-amber-950/60 dark:via-bg-surface dark:to-amber-950/20 text-ink"
              )}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-[11px] font-black uppercase tracking-wider",
                      concilResult.summary.cuadrado
                        ? "text-emerald-800 dark:text-emerald-400"
                        : "text-amber-800 dark:text-amber-400"
                    )}
                  >
                    Resultado de Conciliación
                  </span>
                  {concilResult.summary.cuadrado ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow-xs">
                      <CheckCircle2 className="size-3.5" />
                      {(concilResult.summary.consignacionesEnTransito === 0 && concilResult.summary.chequesEnTransito === 0 && concilResult.summary.notasDebitoNoRegistradas === 0 && concilResult.summary.notasCreditoNoRegistradas === 0 && Math.abs(concilResult.summary.saldoLibros - concilResult.summary.saldoExtracto) < 0.05)
                        ? "Cuadrado 100% (Sin Pendientes)"
                        : (concilResult.summary.soloRendimientos || ((concilResult.summary.notasCreditoRendimientos || 0) > 0 && (concilResult.summary.notasDebitoNoRegistradas || 0) === 0 && (concilResult.summary.chequesEnTransito || 0) === 0 && (concilResult.summary.consignacionesEnTransito || 0) === 0))
                        ? "Pendiente Causar Rendimientos"
                        : "Conciliado con Partidas Pendientes"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-xs font-black text-white shadow-xs">
                      <AlertCircle className="size-3.5" />
                      Con Diferencia
                    </span>
                  )}
                </div>

                <div className="mt-3.5">
                  <div
                    className={cn(
                      "font-display text-2xl sm:text-3xl font-black tracking-tight",
                      concilResult.summary.cuadrado
                        ? "text-emerald-950 dark:text-emerald-200"
                        : "text-amber-950 dark:text-amber-200"
                    )}
                  >
                    {concilResult.summary.cuadrado
                      ? (concilResult.summary.consignacionesEnTransito === 0 && concilResult.summary.chequesEnTransito === 0 && concilResult.summary.notasDebitoNoRegistradas === 0 && concilResult.summary.notasCreditoNoRegistradas === 0 && Math.abs(concilResult.summary.saldoLibros - concilResult.summary.saldoExtracto) < 0.05)
                        ? "CUADRADO PERFECTO (SIN PARTIDAS PENDIENTES)"
                        : (concilResult.summary.soloRendimientos || ((concilResult.summary.notasCreditoRendimientos || 0) > 0 && (concilResult.summary.notasDebitoNoRegistradas || 0) === 0 && (concilResult.summary.chequesEnTransito || 0) === 0 && (concilResult.summary.consignacionesEnTransito || 0) === 0))
                        ? `DIFERENCIA: ${formatMoneyExact(concilResult.summary.notasCreditoRendimientos || concilResult.summary.diferenciaExtractoLibros || 0)} (RENDIMIENTOS DEL PERIODO)`
                        : "CONCILIADO CON PARTIDAS PENDIENTES DE AJUSTE"
                      : `DIFERENCIA: ${formatMoneyExact(concilResult.summary.diferenciaCuadre)}`}
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 text-xs font-medium leading-relaxed",
                      concilResult.summary.cuadrado
                        ? "text-emerald-900/90 dark:text-emerald-300"
                        : "text-amber-900/90 dark:text-amber-300"
                    )}
                  >
                    {concilResult.summary.cuadrado
                      ? (concilResult.summary.consignacionesEnTransito === 0 && concilResult.summary.chequesEnTransito === 0 && concilResult.summary.notasDebitoNoRegistradas === 0 && concilResult.summary.notasCreditoNoRegistradas === 0 && Math.abs(concilResult.summary.saldoLibros - concilResult.summary.saldoExtracto) < 0.05)
                        ? "El saldo bancario coincide con el saldo de libros contables al 100% sin partidas pendientes ni ajustes requeridos."
                        : (concilResult.summary.soloRendimientos || ((concilResult.summary.notasCreditoRendimientos || 0) > 0 && (concilResult.summary.notasDebitoNoRegistradas || 0) === 0 && (concilResult.summary.chequesEnTransito || 0) === 0 && (concilResult.summary.consignacionesEnTransito || 0) === 0))
                        ? `Diferencia de ${formatMoneyExact(concilResult.summary.notasCreditoRendimientos || concilResult.summary.diferenciaExtractoLibros || 0)} que corresponde a los rendimientos del periodo que están en el extracto y aún no han sido registrados en libros contables (se causan al corte/siguiente mes).`
                        : "El saldo bancario ajustado cuadra con libros contables a través de las partidas conciliatorias identificadas (rendimientos, notas bancarias y partidas en tránsito)."
                      : "Existen partidas pendientes por conciliar o diferencias en el saldo inicial."}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3.5 border-t border-emerald-200/80 dark:border-emerald-800/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-ink font-semibold">
                  <span>Movimientos Conciliados:</span>
                  <span className="font-mono font-bold text-emerald-900 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                    {concilResult.summary.totalMovimientosBancoConciliados || concilResult.summary.totalConciliados} de {effectiveExtractItems.length} en extracto ({concilResult.summary.totalConciliados} partidas)
                  </span>
                </div>
                <div className="flex items-center justify-between text-ink font-semibold">
                  <span>Registros en Libros Analizados:</span>
                  <span className="font-mono font-bold text-emerald-900 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                    {librosBancos.length} movimientos
                  </span>
                </div>
              </div>
            </div>

            {/* Panel B: Cuadro Aritmético de Conciliación */}
            <div className="lg:col-span-8 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <h3 className="font-semibold text-sm text-ink flex items-center gap-1.5">
                  <DollarSign className="size-4 text-teal" />
                  Estado de Conciliación Bancaria Universal (DIAN / NIIF)
                </h3>

                {/* Ajuste manual de saldo inicial con formato de miles y decimales */}
                <div className="flex items-center gap-1.5 rounded-xl border border-line bg-bg-subtle/70 px-3 py-1.5 shadow-2xs">
                  <span className="text-ink-muted text-xs font-semibold whitespace-nowrap">Saldo Inicial:</span>
                  <span className="font-mono text-xs font-bold text-teal">$</span>
                  <input
                    type="text"
                    value={saldoInputStr}
                    onChange={(e) => handleSaldoChange(e.target.value)}
                    onBlur={handleSaldoBlur}
                    placeholder="0,00"
                    className="w-36 rounded-md bg-transparent px-1 font-mono text-right text-xs font-bold text-ink focus:outline-teal focus:bg-bg-surface transition"
                    title="Ingresa el saldo inicial del extracto con separadores de miles y decimales"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-line/60">
                  <span className="text-ink-muted">Saldo según Libros Contables:</span>
                  <span className="font-mono font-bold text-ink">
                    {formatMoneyExact(concilResult.summary.saldoLibros)}
                  </span>
                </div>

                <div className="py-1 border-b border-line/60 text-blue-600 dark:text-blue-400">
                  <div className="flex justify-between">
                    <span title="Abonos e ingresos registrados por el banco pendientes de causar en libros contables (ej. rendimientos financieros del mes)">
                      (+) Notas Crédito Banco (Rendimientos / Abonos):
                    </span>
                    <span className="font-mono font-bold">
                      +{formatMoneyExact(concilResult.summary.notasCreditoNoRegistradas)}
                    </span>
                  </div>
                  {concilResult.summary.notasCreditoNoRegistradas > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-ink-muted mt-0.5 font-normal">
                      <span>Rendimientos: <strong className="text-teal font-mono">{formatMoneyExact(concilResult.summary.notasCreditoRendimientos || 0)}</strong></span>
                      <span>•</span>
                      <span>Otros Abonos: <strong className="text-ink font-mono">{formatMoneyExact(concilResult.summary.notasCreditoOperativas || 0)}</strong></span>
                    </div>
                  )}
                </div>

                <div className="py-1 border-b border-line/60 text-amber-600 dark:text-amber-400">
                  <div className="flex justify-between">
                    <span title="Cargos y retiros efectuados por el banco que aún no se han registrado en libros contables (GMF 4x1000, comisiones bancarias)">
                      (-) Notas Débito Banco (Cargos no en Libros):
                    </span>
                    <span className="font-mono font-bold">
                      -{formatMoneyExact(concilResult.summary.notasDebitoNoRegistradas)}
                    </span>
                  </div>
                  {concilResult.summary.notasDebitoNoRegistradas > 0 && (
                    <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-ink-muted mt-0.5 font-normal">
                      <span>GMF 4×1000: <strong className="text-amber-700 dark:text-amber-300 font-mono">{formatMoneyExact(concilResult.summary.notasDebitoGmf || 0)}</strong></span>
                      <span>•</span>
                      <span>Comisiones: <strong className="text-blue-700 dark:text-blue-300 font-mono">{formatMoneyExact(concilResult.summary.notasDebitoComisiones || 0)}</strong></span>
                      <span>•</span>
                      <span>Pagos/Otros: <strong className="text-ink font-mono">{formatMoneyExact(concilResult.summary.notasDebitoOperativas || 0)}</strong></span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between py-1 border-b border-line/60 text-rose-600 dark:text-rose-400">
                  <span>(+) Cheques / Transferencias en Tránsito:</span>
                  <span className="font-mono font-bold">
                    +{formatMoneyExact(concilResult.summary.chequesEnTransito)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-line/60 text-emerald-600 dark:text-emerald-400">
                  <span>(-) Consignaciones en Tránsito:</span>
                  <span className="font-mono font-bold">
                    -{formatMoneyExact(concilResult.summary.consignacionesEnTransito)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-teal/40 bg-teal-soft/20 px-2 rounded font-semibold text-teal-deep dark:text-teal">
                  <span title="Saldo bancario resultante de conciliar libros con extracto (debe coincidir con el Saldo según Extracto Bancario)">
                    (=) Saldo Bancario Conciliado (según Extracto):
                  </span>
                  <span className="font-mono font-bold">
                    {formatMoneyExact(concilResult.summary.saldoConciliado)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Franja Ejecutiva de Conceptos Bancarios: GMF 4x1000, Comisiones, Rendimientos, Lotes ACH */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: GMF 4x1000 */}
            <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                    <BadgePercent className="size-4" />
                  </span>
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    GMF (4x1000)
                  </span>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-extrabold border",
                    executiveBreakdown.gmf.pendiente === 0 && executiveBreakdown.gmf.count > 0
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                      : executiveBreakdown.gmf.pendiente > 0
                      ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-bg-subtle text-ink-subtle border-line"
                  )}
                >
                  {executiveBreakdown.gmf.pendiente === 0 && executiveBreakdown.gmf.count > 0
                    ? "✓ 100% Contabilizado"
                    : executiveBreakdown.gmf.pendiente > 0
                    ? `⚠️ ${formatMoneyExact(executiveBreakdown.gmf.pendiente)} Pendiente`
                    : "Sin Movimientos"}
                </span>
              </div>
              <div className="font-mono text-lg font-black text-ink">
                {formatMoneyExact(executiveBreakdown.gmf.total)}
              </div>
              <div className="mt-1 text-[11px] text-ink-muted flex items-center justify-between">
                <span>{executiveBreakdown.gmf.count} cargos bancarios</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  Reg: {formatMoneyExact(executiveBreakdown.gmf.registrado)}
                </span>
              </div>
            </div>

            {/* Card 2: Comisiones Banco */}
            <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-blue-500/10 p-1.5 text-blue-600 dark:text-blue-400">
                    <CreditCard className="size-4" />
                  </span>
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    Comisiones Banco
                  </span>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-extrabold border",
                    executiveBreakdown.comisiones.pendiente === 0 && executiveBreakdown.comisiones.count > 0
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                      : executiveBreakdown.comisiones.pendiente > 0
                      ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-bg-subtle text-ink-subtle border-line"
                  )}
                >
                  {executiveBreakdown.comisiones.pendiente === 0 && executiveBreakdown.comisiones.count > 0
                    ? "✓ 100% Contabilizado"
                    : executiveBreakdown.comisiones.pendiente > 0
                    ? `⚠️ ${formatMoneyExact(executiveBreakdown.comisiones.pendiente)} Pendiente`
                    : "Sin Movimientos"}
                </span>
              </div>
              <div className="font-mono text-lg font-black text-ink">
                {formatMoneyExact(executiveBreakdown.comisiones.total)}
              </div>
              <div className="mt-1 text-[11px] text-ink-muted flex items-center justify-between">
                <span>{executiveBreakdown.comisiones.count} cargos y tarifas</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                  Reg: {formatMoneyExact(executiveBreakdown.comisiones.registrado)}
                </span>
              </div>
            </div>

            {/* Card 3: Rendimientos Financieros (Separado: Periodo Actual vs Periodo Anterior) */}
            <div
              className={cn(
                "rounded-2xl border bg-bg-surface p-4 shadow-2xs hover:shadow-xs transition flex flex-col justify-between",
                (executiveBreakdown.rendimientos.periodoAnterior?.count || 0) > 0
                  ? "border-teal/50 bg-linear-to-b from-teal-soft/10 via-bg-surface to-bg-surface"
                  : "border-line"
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-teal-500/10 p-1.5 text-teal">
                      <TrendingUp className="size-4" />
                    </span>
                    <span className="text-xs font-bold text-ink uppercase tracking-wider">
                      Rendimientos (+)
                    </span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-extrabold border",
                      (executiveBreakdown.rendimientos.periodoActual?.pendiente || 0) === 0 &&
                        (executiveBreakdown.rendimientos.periodoActual?.count || 0) > 0
                        ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                        : (executiveBreakdown.rendimientos.periodoActual?.pendiente || 0) > 0
                        ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
                        : "bg-bg-subtle text-ink-subtle border-line"
                    )}
                  >
                    {(executiveBreakdown.rendimientos.periodoActual?.pendiente || 0) === 0 &&
                    (executiveBreakdown.rendimientos.periodoActual?.count || 0) > 0
                      ? "✓ 100% Contabilizado"
                      : (executiveBreakdown.rendimientos.periodoActual?.pendiente || 0) > 0
                      ? `⚠️ ${formatMoneyExact(executiveBreakdown.rendimientos.periodoActual.pendiente)} Por Causar`
                      : "Sin Rendimientos"}
                  </span>
                </div>

                {/* Valor Principal: Rendimiento del Periodo Actual (Extracto) */}
                <div className="font-mono text-lg font-black text-teal">
                  +{formatMoneyExact(executiveBreakdown.rendimientos.periodoActual?.total || executiveBreakdown.rendimientos.total)}
                </div>
                <div className="text-[11px] text-ink-muted flex items-center justify-between mt-0.5">
                  <span>Periodo actual ({executiveBreakdown.rendimientos.periodoActual?.count || 0} abono)</span>
                  {(executiveBreakdown.rendimientos.periodoActual?.pendiente || 0) > 0 && (
                    <span className="text-amber-700 dark:text-amber-400 font-bold text-[10px]">
                      Falta causar: {formatMoneyExact(executiveBreakdown.rendimientos.periodoActual.pendiente)}
                    </span>
                  )}
                </div>

                {/* Desglose de Rendimientos Periodo Anterior (Libros) */}
                {(executiveBreakdown.rendimientos.periodoAnterior?.count || 0) > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-teal/20 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="flex items-center gap-1 text-teal">
                        <History className="size-3" />
                        Periodo Anterior (Libros):
                      </span>
                      <span className="font-mono font-bold text-ink">
                        +{formatMoneyExact(executiveBreakdown.rendimientos.periodoAnterior.total)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {executiveBreakdown.rendimientos.periodoAnterior.items.map((it, idx) => {
                        const val = it.montoBanco > 0 ? it.montoBanco : it.montoLibros;
                        const ctaName =
                          it.itemLibros?.cuentaNombre ||
                          it.itemLibros?.cuenta ||
                          it.referencia ||
                          "Rendimiento anterior";
                        const comp = it.itemLibros?.comprobante || `Subcuenta ${idx + 1}`;
                        return (
                          <div
                            key={it.id}
                            className="flex items-center justify-between text-[10px] bg-teal-soft/25 dark:bg-teal-soft/10 px-2 py-0.5 rounded border border-teal/15"
                          >
                            <span className="truncate max-w-[155px] text-ink font-medium" title={it.descripcion}>
                              • {comp}: {ctaName}
                            </span>
                            <span className="font-mono font-bold text-teal whitespace-nowrap">
                              +{formatMoneyExact(val)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-2 text-[10px] text-ink-muted flex items-center justify-between pt-1 border-t border-line/40">
                <span>
                  {(executiveBreakdown.rendimientos.periodoAnterior?.count || 0) > 0
                    ? "Separados por periodo"
                    : `${executiveBreakdown.rendimientos.count} abonos de intereses`}
                </span>
                <span className="font-semibold text-teal">
                  Total ambos: {formatMoneyExact(executiveBreakdown.rendimientos.totalConsolidadoAmbosPeriodos || executiveBreakdown.rendimientos.total)}
                </span>
              </div>
            </div>

            {/* Card 4: Lotes ACH y Pagos Masivos */}
            <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs transition">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-purple-500/10 p-1.5 text-purple-600 dark:text-purple-400">
                    <Layers className="size-4" />
                  </span>
                  <span className="text-xs font-bold text-ink uppercase tracking-wider">
                    Lotes ACH / Masivos
                  </span>
                </div>
                <span className="rounded-full bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 px-2 py-0.5 text-[10px] font-extrabold">
                  {executiveBreakdown.lotesAch.countLotes} Lotes Auditados
                </span>
              </div>
              <div className="font-mono text-lg font-black text-ink">
                {formatMoneyExact(executiveBreakdown.lotesAch.total)}
              </div>
              <div className="mt-1 text-[11px] text-ink-muted flex items-center justify-between">
                <span>{executiveBreakdown.lotesAch.countComprobantes} comprobantes agrupados</span>
                <span className="font-black text-emerald-700 dark:text-emerald-400">
                  Diferencia $0,00
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
                label: `Por Registrar (${concilResult.rows.filter((r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco").length})`,
              },
              {
                id: "transito",
                label: `En Tránsito (${concilResult.rows.filter((r) => r.estado === "partida_en_transito_libros").length})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTabFilter(tab.id as "todas" | "conciliado" | "banco_pend" | "transito")}
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

          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector de ordenamiento rápido */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-ink-muted flex items-center gap-1">
                <ArrowUpDown className="size-3 text-teal" /> Organizar:
              </span>
              <select
                value={sortField}
                onChange={(e) => {
                  const val = e.target.value as typeof sortField;
                  setSortField(val);
                  setSortDirection(val === "montoBanco" || val === "montoLibros" ? "desc" : "asc");
                }}
                className="rounded-lg border border-line bg-bg-surface px-2.5 py-1 text-xs font-semibold text-ink focus:outline-teal shadow-2xs cursor-pointer"
              >
                <option value="fecha">Fecha</option>
                <option value="estado">Estado</option>
                <option value="montoBanco">Monto Extracto</option>
                <option value="montoLibros">Monto Libros</option>
                <option value="descripcion">Descripción</option>
                <option value="referencia">Referencia</option>
                <option value="diagnostico">Diagnóstico</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg-surface hover:bg-bg-subtle px-2 py-1 text-xs font-bold text-ink cursor-pointer transition shadow-2xs"
                title={`Alternar dirección (actual: ${sortDirection === "asc" ? "Ascendente" : "Descendente"})`}
              >
                {sortDirection === "asc" ? (
                  <>
                    <ArrowUp className="size-3 text-teal font-black" />
                    <span className="text-[10px] font-extrabold uppercase">Asc</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="size-3 text-teal font-black" />
                    <span className="text-[10px] font-extrabold uppercase">Desc</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative w-full sm:w-56">
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
        </div>
      )}

      {/* Tabla Detallada de Partidas */}
      {concilResult.rows.length > 0 && (
        <div className="rounded-2xl border border-line bg-bg-surface overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs table-auto">
              <thead className="border-b border-line bg-bg-subtle/80 uppercase tracking-wider text-ink-subtle font-semibold select-none">
                <tr>
                  <th
                    onClick={() => handleToggleSort("estado")}
                    className="px-3.5 py-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap"
                    title="Ordenar por Estado"
                  >
                    <div className="flex items-center gap-1">
                      <span>Estado</span>
                      {sortField === "estado" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleSort("fecha")}
                    className="px-3.5 py-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap"
                    title="Ordenar por Fecha"
                  >
                    <div className="flex items-center gap-1">
                      <span>Fecha</span>
                      {sortField === "fecha" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleSort("descripcion")}
                    className="px-3.5 py-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group"
                    title="Ordenar por Descripción"
                  >
                    <div className="flex items-center gap-1">
                      <span>Descripción / Concepto</span>
                      {sortField === "descripcion" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleSort("referencia")}
                    className="px-3.5 py-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap"
                    title="Ordenar por Referencia / Documento"
                  >
                    <div className="flex items-center gap-1">
                      <span>Referencia</span>
                      {sortField === "referencia" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleSort("montoBanco")}
                    className="px-3.5 py-3 text-right cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap"
                    title="Ordenar por Monto de Extracto"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Monto Extracto</span>
                      {sortField === "montoBanco" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleSort("montoLibros")}
                    className="px-3.5 py-3 text-right cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap"
                    title="Ordenar por Monto en Libros"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Monto Libros</span>
                      {sortField === "montoLibros" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleToggleSort("diagnostico")}
                    className="px-3.5 py-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap"
                    title="Ordenar por Diagnóstico Contable"
                  >
                    <div className="flex items-center gap-1">
                      <span>Diagnóstico Contable</span>
                      {sortField === "diagnostico" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>
                  <th className="px-3.5 py-3 text-center whitespace-nowrap">
                    Auditoría / Asiento
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {rowsOrdenadas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-xs text-ink-muted">
                      No se encontraron partidas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  rowsOrdenadas.map((r) => {
                    const isExpanded = expandedRowId === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr
                          className={cn(
                            "hover:bg-bg-subtle/40 transition",
                            isExpanded && "bg-teal-soft/10"
                          )}
                        >
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border",
                                r.estado === "conciliado"
                                  ? r.esGmf
                                    ? "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 font-extrabold"
                                    : "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : r.esGmf
                                  ? "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 font-extrabold"
                                  : r.esComision
                                  ? "bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                                  : r.esRendimiento
                                  ? "bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300"
                                  : r.estado === "partida_en_transito_libros"
                                  ? "bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300"
                                  : "bg-rose-50 text-rose-950 border-rose-300 dark:bg-rose-950/40 dark:text-rose-200 font-extrabold"
                              )}
                            >
                              {r.estado === "conciliado"
                                ? r.itemsLibrosLote
                                  ? "Lote ACH"
                                  : r.esGmf
                                  ? "GMF 4x1000 Conciliado"
                                  : r.esRendimiento
                                  ? "Rendimiento Conciliado"
                                  : "Conciliado"
                                : r.esGmf
                                ? "GMF 4x1000"
                                : r.esComision
                                ? "Comisión Banco"
                                : r.esRendimiento
                                ? "Rendimiento"
                                : r.estado === "partida_en_transito_libros"
                                ? "En Tránsito"
                                : "Por Registrar"}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 font-mono text-ink-muted whitespace-nowrap">
                            {formatDate(r.fecha)}
                          </td>
                          <td
                          onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                          className="px-3.5 py-2.5 font-medium text-ink max-w-72 lg:max-w-80 cursor-pointer group"
                          title="Clic para abrir el detalle y asiento contable"
                        >
                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <div className="truncate group-hover:text-teal transition select-text flex items-center gap-1.5 min-w-0">
                              {r.esGmf && (
                                <span className="shrink-0 text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300">
                                  GMF 4x1000
                                </span>
                              )}
                              <span className="truncate" title={r.descripcion}>
                                {getCleanDescription(r)}
                              </span>
                            </div>
                            {r.itemsLibrosLote && (
                              <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-200">
                                {r.itemsLibrosLote.length} comps
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-ink-subtle whitespace-nowrap max-w-28 truncate" title={r.referencia}>
                            {r.referencia || "—"}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono font-semibold text-right text-ink whitespace-nowrap">
                            {r.montoBanco > 0 ? formatMoneyExact(r.montoBanco) : "—"}
                          </td>
                          <td className="px-3.5 py-2.5 font-mono font-semibold text-right text-ink whitespace-nowrap">
                            {r.montoLibros > 0 ? formatMoneyExact(r.montoLibros) : "—"}
                          </td>
                          <td className="px-3.5 py-2.5 text-ink-muted leading-tight max-w-64 lg:max-w-72">
                          <div className="text-xs leading-snug line-clamp-2 hover:line-clamp-none transition-all cursor-pointer whitespace-normal break-words" title={r.nota}>
                            {r.nota}
                          </div>
                        </td>
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            {r.itemsLibrosLote && r.itemsLibrosLote.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-950 border border-purple-300 dark:bg-purple-950/60 dark:hover:bg-purple-900 dark:text-purple-200 dark:border-purple-700 px-2.5 py-1 text-xs font-bold transition cursor-pointer shadow-2xs"
                                title="Rastrear los comprobantes contables agrupados en este lote"
                              >
                                <Layers className="size-3.5 text-purple-600" />
                                <span>Rastrear ({r.itemsLibrosLote.length})</span>
                                <ChevronDown className={cn("size-3 transition-transform duration-200", isExpanded && "rotate-180")} />
                              </button>
                            ) : r.itemLibros ? (
                              <button
                                type="button"
                                onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-bg-subtle hover:bg-teal-soft/60 text-ink hover:text-teal border border-line px-2.5 py-1 text-xs font-semibold transition cursor-pointer max-w-[150px]"
                                title="Rastrear comprobante contable en libros"
                              >
                                <FileText className="size-3.5 text-teal" />
                                <span className="truncate max-w-[85px]">{r.itemLibros.comprobante ? `Comp. ${r.itemLibros.comprobante}` : "Rastrear"}</span>
                                <ChevronDown className={cn("size-3 transition-transform duration-200", isExpanded && "rotate-180")} />
                              </button>
                            ) : r.estado === "partida_en_transito_libros" ? (
                              <button
                                type="button"
                                onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                              >
                                <Clock className="size-3.5 text-rose-600" />
                                <span>En Tránsito</span>
                                <ChevronDown className={cn("size-3 transition-transform duration-200", isExpanded && "rotate-180")} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setExpandedRowId(isExpanded ? null : r.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                              >
                                <Info className="size-3.5 text-amber-600" />
                                <span>Sugerencia PUC</span>
                                <ChevronDown className={cn("size-3 transition-transform duration-200", isExpanded && "rotate-180")} />
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Fila Expandida de Auditoría y Rastreo */}
                        {isExpanded && (
                          <tr className="bg-bg-subtle/50 border-b border-line animate-in fade-in duration-150">
                            <td colSpan={8} className="p-3.5">
                              {r.itemsLibrosLote && r.itemsLibrosLote.length > 0 ? (
                                <div className="rounded-xl border border-purple-300 bg-purple-50/50 dark:bg-purple-950/30 dark:border-purple-800 p-4 space-y-3 shadow-2xs">
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-purple-200 dark:border-purple-800 pb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-lg bg-purple-600 text-white p-1.5 shadow-2xs">
                                        <Layers className="size-4" />
                                      </span>
                                      <div>
                                        <div className="font-bold text-xs text-purple-950 dark:text-purple-200">
                                          Rastreo y Auditoría del Lote Bancario ({r.itemsLibrosLote.length} Comprobantes Contables Individuales)
                                        </div>
                                        <p className="text-[11px] text-purple-800 dark:text-purple-300">
                                          El extracto bancario consolidó un débito total de <strong>{formatMoneyExact(r.montoBanco)}</strong> que canceló individualmente cada uno de estos registros en libros contables.
                                        </p>
                                      </div>
                                    </div>
                                    <div className="font-mono text-xs font-extrabold text-purple-950 dark:text-purple-200 bg-purple-200/80 dark:bg-purple-900/60 px-3 py-1 rounded-lg border border-purple-300 dark:border-purple-700">
                                      Total Lote: {formatMoneyExact(r.itemsLibrosLote.reduce((a, b) => a + (r.tipo === "retiro" ? b.credito : b.debito), 0))} · Diferencia: $0,00
                                    </div>
                                  </div>

                                  <div className="overflow-x-auto rounded-lg border border-purple-200 dark:border-purple-800 bg-bg-surface">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-purple-100/60 dark:bg-purple-950/60 text-purple-950 dark:text-purple-200 font-semibold border-b border-purple-200 dark:border-purple-800">
                                        <tr>
                                          <th className="px-3 py-2">Comprobante</th>
                                          <th className="px-3 py-2">Fecha</th>
                                          <th className="px-3 py-2">Cuenta PUC</th>
                                          <th className="px-3 py-2">Tercero / Beneficiario</th>
                                          <th className="px-3 py-2">Detalle / Concepto en Libros</th>
                                          <th className="px-3 py-2">Cruce / Ref.</th>
                                          <th className="px-3 py-2 text-right">Monto Contabilizado</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-purple-100 dark:divide-purple-900/30">
                                        {r.itemsLibrosLote.map((c, cIdx) => (
                                          <tr key={[c.comprobante, c.fecha, cIdx].filter(Boolean).join("-")} className="hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition">
                                            <td className="px-3 py-2 font-mono font-bold text-purple-950 dark:text-purple-300">
                                              {c.comprobante || "—"}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-ink-muted">
                                              {formatDate(c.fecha)}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-ink-muted">
                                              {c.cuenta} <span className="text-[10px] text-ink-subtle">({c.cuentaNombre})</span>
                                            </td>
                                            <td className="px-3 py-2 text-ink">
                                              <span className="font-semibold">{c.nombre || "—"}</span>
                                              {c.nit && <span className="text-[10px] text-ink-subtle block font-mono">NIT: {c.nit}</span>}
                                            </td>
                                            <td className="px-3 py-2 text-ink-muted min-w-[180px] break-words whitespace-normal leading-relaxed" title={c.descripcion}>
                                              {c.descripcion}
                                            </td>
                                            <td className="px-3 py-2 font-mono text-ink-subtle">
                                              {c.cruce || c.referencia || "—"}
                                            </td>
                                            <td className="px-3 py-2 font-mono font-bold text-right text-ink">
                                              {formatMoneyExact(r.tipo === "retiro" ? c.credito : c.debito)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              ) : r.itemLibros ? (
                                <div className="rounded-xl border border-teal-300 bg-teal-50/40 dark:bg-teal-950/30 dark:border-teal-800 p-4 space-y-2 shadow-2xs">
                                  <div className="flex items-center justify-between border-b border-teal-200 dark:border-teal-800 pb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-lg bg-teal text-white p-1.5 shadow-2xs">
                                        <FileText className="size-4" />
                                      </span>
                                      <div className="font-bold text-xs text-teal-950 dark:text-teal-200">
                                        Rastreo de Comprobante Contable en Libros (Coincidencia 1 a 1)
                                      </div>
                                    </div>
                                    <span className="text-[11px] font-mono font-bold text-teal bg-teal-soft/80 px-2.5 py-0.5 rounded-md border border-teal/30">
                                      Diferencia: $0,00 · Conciliado
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
                                    <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                      <span className="text-ink-muted block text-[11px]">Comprobante Contable:</span>
                                      <span className="font-mono font-bold text-ink text-xs">{r.itemLibros.comprobante || "Sin número"}</span>
                                    </div>
                                    <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                      <span className="text-ink-muted block text-[11px]">Fecha en Libros:</span>
                                      <span className="font-mono font-bold text-ink text-xs">{formatDate(r.itemLibros.fecha)}</span>
                                    </div>
                                    <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                      <span className="text-ink-muted block text-[11px]">Cuenta PUC:</span>
                                      <span className="font-mono text-ink text-xs font-semibold">{r.itemLibros.cuenta} - {r.itemLibros.cuentaNombre}</span>
                                    </div>
                                    <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                      <span className="text-ink-muted block text-[11px]">Tercero / Beneficiario:</span>
                                      <span className="text-ink font-semibold text-xs">{r.itemLibros.nombre} {r.itemLibros.nit ? `(NIT: ${r.itemLibros.nit})` : ""}</span>
                                    </div>
                                    <div className="bg-bg-surface p-2 rounded-lg border border-line sm:col-span-2">
                                      <span className="text-ink-muted block text-[11px]">Glosa / Concepto en Libros:</span>
                                      <span className="text-ink text-xs">{r.itemLibros.descripcion}</span>
                                    </div>
                                    <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                      <span className="text-ink-muted block text-[11px]">Documento Fuente / Cruce:</span>
                                      <span className="font-mono text-ink text-xs">{r.itemLibros.cruce || r.itemLibros.referencia || "—"}</span>
                                    </div>
                                    <div className="bg-bg-surface p-2 rounded-lg border border-line">
                                      <span className="text-ink-muted block text-[11px]">Monto en Contabilidad:</span>
                                      <span className="font-mono font-bold text-teal text-xs">{formatMoneyExact(r.montoLibros)}</span>
                                    </div>
                                  </div>
                                </div>
                              ) : r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco" ? (
                                <div className="rounded-xl border border-amber-300 bg-amber-50/50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-xs space-y-2 shadow-2xs">
                                  <div className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                                    <AlertCircle className="size-4 text-amber-600" />
                                    <span>Instrucción Contable para Causación de Partida Pendiente</span>
                                  </div>
                                  <p className="text-amber-900 dark:text-amber-300">
                                    {r.nota}
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
                                    <div className="bg-bg-surface p-2 rounded border border-amber-200">
                                      <span className="text-ink-muted block">Cuenta Sugerida:</span>
                                      <span className="font-bold text-ink">
                                        {r.esGmf ? "511595 (GMF 4x1000)" : r.esComision ? "530515 (Comisiones Bancarias)" : r.esRendimiento ? "421005 (Rendimientos Financieros)" : "111005 (Bancos)"}
                                      </span>
                                    </div>
                                    <div className="bg-bg-surface p-2 rounded border border-amber-200">
                                      <span className="text-ink-muted block">Monto en Extracto:</span>
                                      <span className="font-bold text-amber-900">{formatMoneyExact(r.montoBanco)}</span>
                                    </div>
                                    <div className="bg-bg-surface p-2 rounded border border-amber-200">
                                      <span className="text-ink-muted block">Contrapartida:</span>
                                      <span className="font-bold text-ink">Cuenta Bancaria de Tesorería</span>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
