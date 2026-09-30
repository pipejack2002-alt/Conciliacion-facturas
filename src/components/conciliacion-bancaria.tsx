import { useState, useMemo, useEffect, useRef, Fragment } from "react";
import {
  Landmark,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Upload,
  DollarSign,
  Layers,
  FileText,
  Search,
  RefreshCw,
  Sparkles,
  ArrowRightLeft,
  ChevronDown,
  BadgePercent,
  CreditCard,
  TrendingUp,
  Clock,
  Info,
  Trash2,
} from "lucide-react";
import { formatMoney, formatMoneyExact, formatDate } from "@/lib/format";
import {
  conciliarBancos,
  extractLibroBancos,
  getAvailableBankAccounts,
  getBankExecutiveBreakdown,
  type BankExtractItem,
  type BankConciliacionResult,
  type EstadoConciliacionBancaria,
  type DetectedBankAccount,
} from "@/lib/conciliar-bancos";
import {
  parseBankExtractFile,
  type ParsedBankExtractResult,
  type BankSubAccount,
} from "@/lib/parse-bank-extract";
import { readWorkbook, parseMovSheet } from "@/lib/parse-excel";
import type { MovLine } from "@/lib/types";
import { cn } from "@/lib/cn";
import * as XLSX from "xlsx";
import { ConciliacionUniversalBancosView } from "./conciliacion-universal-bancos";

// Extracto de demostración inicial preconfigurado
const DEMO_EXTRACTO: BankExtractItem[] = [
  { id: "b1", fecha: "2026-07-02", descripcion: "ABONO TRANSFERENCIA CLIENTE FACT 4012", referencia: "TRANS-4012", debito: 0, credito: 12500000 },
  { id: "b2", fecha: "2026-07-05", descripcion: "PAGO PROVEEDOR SUMINISTROS TRANS-8842", referencia: "TRANS-8842", debito: 4500000, credito: 0 },
  { id: "b3", fecha: "2026-07-15", descripcion: "GRAVAMEN MOVIMIENTO FINANCIERO GMF 4X1000", referencia: "GMF-0715", debito: 18000, credito: 0 },
  { id: "b4", fecha: "2026-07-20", descripcion: "PAGO ARRENDAMIENTO OFICINA CH-5510", referencia: "5510", debito: 3200000, credito: 0 },
  { id: "b5", fecha: "2026-07-31", descripcion: "CUOTA DE MANEJO Y COMISION TRANSACCIONAL", referencia: "COM-0731", debito: 68500, credito: 0 },
  { id: "b6", fecha: "2026-07-31", descripcion: "RENDIMIENTO FINANCIERO CUENTA DE AHORROS", referencia: "REND-0731", debito: 0, credito: 24350 },
];

export function ConciliacionBancariaView({ movLines }: { movLines: MovLine[] }) {
  // Selector de Modo: Homologados (Caja Social, Credicorp, Banistmo) vs Universal (Cualquier Banco)
  const [modoVista, setModoVista] = useState<"homologado" | "universal">("homologado");

  // Control de modo demo vs plantilla en blanco (inicia en blanco para no mostrar datos precargados)
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Estado de extracto bancario cargado
  const [extractoMeta, setExtractoMeta] = useState<ParsedBankExtractResult | null>(null);
  const [extractoItems, setExtractoItems] = useState<BankExtractItem[]>([]);
  const [selectedSubAccount, setSelectedSubAccount] = useState<string>("default");
  const [extractoFileName, setExtractoFileName] = useState<string>("");
  const [isExtractoLoading, setIsExtractoLoading] = useState<boolean>(false);

  // Estado de libros contables (permite usar los de la sesión o cargar un Excel específico de bancos)
  const [customMovLines, setCustomMovLines] = useState<MovLine[] | null>(null);
  const [customMovFileName, setCustomMovFileName] = useState<string>("");
  const [isMovLoading, setIsMovLoading] = useState<boolean>(false);

  function handleVaciarBancos() {
    setIsDemoMode(false);
    setExtractoItems([]);
    setExtractoMeta(null);
    setExtractoFileName("");
    setCustomMovLines([]);
    setCustomMovFileName("");
    setSaldoInicialExtracto(0);
    setSaldoInicialLibros(0);
    setSaldoInputStr("0,00");
  }

  function handleCargarDemo() {
    setIsDemoMode(true);
    setExtractoItems(DEMO_EXTRACTO);
    setExtractoMeta(null);
    setExtractoFileName("Extracto de Demostración");
    setCustomMovLines(null);
    setCustomMovFileName("");
    setSaldoInicialExtracto(15000000);
    setSaldoInicialLibros(15000000);
    setSaldoInputStr(formatMoneyExact(15000000).replace("$", "").trim());
  }

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

  // Cuenta contable seleccionada para la conciliación
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("todas");

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

  // Fila expandida para auditoría detallada de comprobantes / lotes ACH
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Filtros de tabla
  const [tabFilter, setTabFilter] = useState<"todas" | "conciliado" | "banco_pend" | "transito">("todas");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const fileInputExtractoRef = useRef<HTMLInputElement>(null);
  const fileInputMovRef = useRef<HTMLInputElement>(null);

  // Auto-seleccionar cuenta contable cuando se carga un extracto bancario específico
  useEffect(() => {
    if (!extractoMeta || availableAccounts.length === 0) return;

    if (extractoMeta.bancoId === "banco_caja_social") {
      const matchBcsc = availableAccounts.find(
        (a) =>
          a.cuenta.startsWith("11100512") ||
          /bcsc|colmena|caja\s*social/i.test(a.cuentaNombre)
      );
      if (matchBcsc) {
        setCuentaSeleccionada(matchBcsc.cuenta);
        return;
      }
    }

    if (extractoMeta.bancoId === "credicorp") {
      const matchCred = availableAccounts.find(
        (a) =>
          a.cuenta.startsWith("12503511") ||
          /credicorp|correval|fonval|fic/i.test(a.cuentaNombre)
      );
      if (matchCred) {
        setCuentaSeleccionada(matchCred.cuenta);
        return;
      }
    }

    if (extractoMeta.bancoId === "banistmo") {
      const matchBan = availableAccounts.find(
        (a) => /banistmo|panam[aá]/i.test(a.cuentaNombre)
      );
      if (matchBan) {
        setCuentaSeleccionada(matchBan.cuenta);
        return;
      }
    }

    if (cuentaSeleccionada === "todas" && availableAccounts.length === 1) {
      setCuentaSeleccionada(availableAccounts[0].cuenta);
    }
  }, [extractoMeta, availableAccounts]);

  // Actualizar items de extracto cuando cambia la subcuenta seleccionada (ej. Credicorp Portafolio vs FIC vs Admin)
  useEffect(() => {
    if (!extractoMeta) return;

    if (extractoMeta.cuentasDisponibles && extractoMeta.cuentasDisponibles.length > 0) {
      const chosen =
        extractoMeta.cuentasDisponibles.find((c) => c.id === selectedSubAccount) ||
        extractoMeta.cuentasDisponibles[0];

      setExtractoItems(chosen.items);
      if (chosen.saldoInicial !== undefined) {
        setSaldoInicialExtracto(chosen.saldoInicial);
        setSaldoInicialLibros(chosen.saldoInicial);
      }
    } else {
      setExtractoItems(extractoMeta.items);
      if (extractoMeta.saldoInicial !== undefined) {
        setSaldoInicialExtracto(extractoMeta.saldoInicial);
        setSaldoInicialLibros(extractoMeta.saldoInicial);
      }
    }
  }, [extractoMeta, selectedSubAccount]);

  // Filtrar movimientos de libros por la cuenta seleccionada
  const librosBancos = useMemo(() => {
    return extractLibroBancos(
      effectiveMovLines,
      cuentaSeleccionada === "todas" ? undefined : cuentaSeleccionada
    );
  }, [effectiveMovLines, cuentaSeleccionada]);

  // Libros efectivos: si no hay libros en sesión, proveer demostración si isDemoMode está activo
  const librosEfectivos = useMemo(() => {
    if (librosBancos.length > 0) return librosBancos;
    if (!isDemoMode) return [];
    return [
      {
        cuenta: "11100501",
        cuentaNombre: "BANCOLOMBIA CORRIENTE",
        comprobante: "RC 001 4012",
        fecha: "2026-07-02",
        nit: "900555666",
        nombre: "CLIENTE COMERCIAL S.A.S.",
        descripcion: "ABONO TRANSFERENCIA CLIENTE FACT 4012",
        cruce: "TRANS-4012",
        debito: 12500000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "11100501",
        cuentaNombre: "BANCOLOMBIA CORRIENTE",
        comprobante: "EG 001 8842",
        fecha: "2026-07-05",
        nit: "900123456",
        nombre: "PROVEEDOR INDUSTRIAL S.A.S.",
        descripcion: "PAGO PROVEEDOR SUMINISTROS TRANS-8842",
        cruce: "TRANS-8842",
        debito: 0,
        credito: 4500000,
        observacion: "",
      },
      {
        cuenta: "11100501",
        cuentaNombre: "BANCOLOMBIA CORRIENTE",
        comprobante: "EG 001 5510",
        fecha: "2026-07-20",
        nit: "800111222",
        nombre: "INMOBILIARIA DEL VALLE",
        descripcion: "PAGO ARRENDAMIENTO OFICINA CH-5510",
        cruce: "5510",
        debito: 0,
        credito: 3200000,
        observacion: "",
      },
      {
        cuenta: "11100501",
        cuentaNombre: "BANCOLOMBIA CORRIENTE",
        comprobante: "EG 001 9912",
        fecha: "2026-07-29",
        nit: "800333444",
        nombre: "PAPELERIA Y SUMINISTROS",
        descripcion: "CHEQUE 9912 GIRADO PENDIENTE COBRO",
        cruce: "9912",
        debito: 0,
        credito: 1450000,
        observacion: "",
      },
    ];
  }, [librosBancos, isDemoMode]);

  // Ejecución del motor de conciliación bancaria
  const concilResult: BankConciliacionResult = useMemo(() => {
    return conciliarBancos(
      extractoItems,
      librosEfectivos,
      saldoInicialExtracto,
      saldoInicialLibros
    );
  }, [extractoItems, librosEfectivos, saldoInicialExtracto, saldoInicialLibros]);

  // Desglose ejecutivo de conceptos bancarios (GMF 4x1000, Comisiones, Rendimientos, Lotes ACH)
  const executiveBreakdown = useMemo(() => {
    return getBankExecutiveBreakdown(concilResult.rows);
  }, [concilResult.rows]);

  // Filas filtradas por tab y por búsqueda de texto
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

  // Manejador de carga de archivo de Extracto Bancario (PDF o Excel)
  async function handleUploadExtracto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtractoLoading(true);
    setExtractoFileName(file.name);

    try {
      const parsed = await parseBankExtractFile(file);
      setExtractoMeta(parsed);

      if (parsed.cuentasDisponibles && parsed.cuentasDisponibles.length > 0) {
        setSelectedSubAccount(parsed.cuentasDisponibles[0].id);
        setExtractoItems(parsed.cuentasDisponibles[0].items);
        if (parsed.cuentasDisponibles[0].saldoInicial !== undefined) {
          setSaldoInicialExtracto(parsed.cuentasDisponibles[0].saldoInicial);
          setSaldoInicialLibros(parsed.cuentasDisponibles[0].saldoInicial);
        }
      } else {
        setExtractoItems(parsed.items);
        if (parsed.saldoInicial !== undefined) {
          setSaldoInicialExtracto(parsed.saldoInicial);
          setSaldoInicialLibros(parsed.saldoInicial);
        }
      }
      setIsDemoMode(false);
    } catch (err: any) {
      console.error("Error al procesar extracto bancario:", err);
      alert(
        "No se pudo procesar el extracto bancario. Asegúrese de que sea un archivo PDF legible o un archivo Excel/CSV con columnas de fecha y valores."
      );
    } finally {
      setIsExtractoLoading(false);
      if (e.target) e.target.value = "";
    }
  }

  // Manejador de carga de archivo de Movimiento Contable Auxiliar (Excel)
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
        setIsDemoMode(false);
      } else {
        alert("No se detectaron movimientos contables en el archivo Excel seleccionado.");
      }
    } catch (err: any) {
      console.error("Error al procesar libro contable:", err);
      alert("No se pudo leer el archivo Excel de movimientos contables.");
    } finally {
      setIsMovLoading(false);
      if (e.target) e.target.value = "";
    }
  }

  // Exportar Estado Oficial de Conciliación Bancaria a Excel
  function exportarConciliacionBancaria() {
    const entidadNombre = extractoMeta
      ? `${extractoMeta.bancoNombre} ${extractoMeta.numeroCuenta ? `(${extractoMeta.numeroCuenta})` : ""}`
      : "ENTIDAD BANCARIA";

    const wsData = [
      ["ESTADO OFICIAL DE CONCILIACIÓN BANCARIA MENSUAL"],
      ["Entidad Financiera:", entidadNombre],
      ["Periodo / Fecha de Corte:", extractoMeta?.periodo || new Date().toLocaleDateString("es-CO")],
      ["Cuenta Contable Conciliada:", cuentaSeleccionada === "todas" ? "Todas las cuentas de tesorería" : cuentaSeleccionada],
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
    XLSX.utils.book_append_sheet(wb, ws, "Conciliación Bancaria");
    XLSX.writeFile(wb, `conciliacion-bancaria-${extractoMeta?.bancoId || "banco"}.xlsx`);
  }

  if (modoVista === "universal") {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-2 sm:px-6 lg:px-8 animate-in fade-in duration-200">
        {/* Selector de Modo: Homologado vs Universal */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-bg-surface border border-line rounded-2xl shadow-2xs">
          <div className="flex items-center gap-1.5 p-1 bg-bg-subtle rounded-xl">
            <button
              type="button"
              onClick={() => setModoVista("homologado")}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-ink-muted hover:text-ink transition cursor-pointer"
            >
              <Landmark className="size-3.5" />
              <span>Bancos Homologados (Caja Social / Credicorp / Banistmo)</span>
            </button>
            <button
              type="button"
              onClick={() => setModoVista("universal")}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-teal text-white shadow-xs transition cursor-pointer"
            >
              <Sparkles className="size-3.5" />
              <span>Conciliador Universal (Cualquier Banco · Excel / CSV / PDF)</span>
            </button>
          </div>
          <span className="text-[11px] text-ink-muted hidden md:inline-block pr-2">
            Mapeo inteligente y adaptable a cualquier estructura de extracto bancario
          </span>
        </div>

        <ConciliacionUniversalBancosView movLines={effectiveMovLines} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-2 sm:px-6 lg:px-8 animate-in fade-in duration-200">
      {/* Selector de Modo: Homologado vs Universal */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-bg-surface border border-line rounded-2xl shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-bg-subtle rounded-xl">
          <button
            type="button"
            onClick={() => setModoVista("homologado")}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-teal text-white shadow-xs transition cursor-pointer"
          >
            <Landmark className="size-3.5" />
            <span>Bancos Homologados (Caja Social / Credicorp / Banistmo)</span>
          </button>
          <button
            type="button"
            onClick={() => setModoVista("universal")}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-ink-muted hover:text-ink transition cursor-pointer"
          >
            <Sparkles className="size-3.5" />
            <span>Conciliador Universal (Cualquier Banco · Excel / CSV / PDF)</span>
          </button>
        </div>
        <span className="text-[11px] text-ink-muted hidden md:inline-block pr-2">
          Modelos pre-validados con extracción automática para cuentas colombianas e internacionales
        </span>
      </div>

      {/* Banner Principal de Conciliación Bancaria */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-bg-surface via-bg-surface to-teal-soft/25 p-4 sm:p-5 shadow-xs">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-lg bg-teal p-1.5 text-white shadow-xs">
              <Landmark className="size-5" />
            </span>
            <h1 className="font-display text-lg sm:text-xl font-bold text-ink">
              Módulo de Conciliación Bancaria y Tesorería
            </h1>
            <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-bold text-teal">
              PDF & Excel · Bancos & Fondos
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Cruce inteligente de extractos bancarios en PDF o Excel (Banco Caja Social, Credicorp Capital, Banistmo, Bancolombia, etc.) contra el libro auxiliar contable (Clase 11 y 1250).
          </p>
        </div>

        {/* Botones alineados estrictamente uno al lado de otro */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          {(extractoItems.length > 0 || effectiveMovLines.length > 0) && (
            <button
              type="button"
              onClick={handleVaciarBancos}
              className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger-bg px-3 py-2 text-xs font-semibold text-danger hover:bg-danger hover:text-white transition cursor-pointer shadow-2xs whitespace-nowrap"
              title="Vaciar extracto y movimientos cargados para dejar la plantilla en blanco"
            >
              <Trash2 className="size-3.5" />
              <span>Vaciar Datos</span>
            </button>
          )}

          {!isDemoMode && extractoItems.length === 0 && (
            <button
              type="button"
              onClick={handleCargarDemo}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-teal hover:text-teal transition cursor-pointer shadow-2xs whitespace-nowrap"
              title="Cargar datos de ejemplo de extracto y contabilidad para demostración"
            >
              <Sparkles className="size-3.5 text-teal" />
              <span>Cargar Ejemplo</span>
            </button>
          )}

          <button
            type="button"
            onClick={exportarConciliacionBancaria}
            disabled={concilResult.rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-deep transition cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="size-3.5" />
            <span>Exportar Conciliación a Excel</span>
          </button>
        </div>
      </div>

      {/* Panel Superior: Zona Dual de Carga de Archivos (Extracto PDF y Movimiento Excel) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tarjeta 1: Carga de Extracto Bancario (PDF o Excel) */}
        <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-teal-soft p-1.5 text-teal">
                  <FileText className="size-4" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-ink">
                  1. Extracto Bancario (PDF o Excel)
                </span>
              </div>
              {extractoMeta ? (
                <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                  {extractoMeta.bancoNombre}
                </span>
              ) : (
                <span className="rounded-full bg-bg-subtle text-ink-subtle px-2 py-0.5 text-[10px] font-medium">
                  PDF / XLSX / CSV
                </span>
              )}
            </div>

            <p className="text-xs text-ink-muted mb-3">
              Sube el extracto bancario emitido por la entidad financiera. Compatible con Banco Caja Social, Credicorp Capital, Banistmo, Bancolombia, Davivienda y formatos universales.
            </p>

            {extractoMeta && (
              <div className="rounded-xl border border-line bg-bg-subtle/50 p-3 text-xs space-y-1.5 mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Entidad:</span>
                  <span className="font-semibold text-ink">{extractoMeta.bancoNombre}</span>
                </div>
                {extractoMeta.numeroCuenta && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">No. de Cuenta:</span>
                    <span className="font-mono font-medium text-ink">{extractoMeta.numeroCuenta}</span>
                  </div>
                )}
                {extractoMeta.periodo && (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-muted">Periodo:</span>
                    <span className="text-ink">{extractoMeta.periodo}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-line/60">
                  <span className="text-ink-muted">Partidas en Extracto:</span>
                  <span className="font-bold text-teal">{extractoItems.length} movimientos</span>
                </div>

                {/* Si el extracto tiene múltiples subcuentas o portafolios (ej. Credicorp Alta Liquidez / Admin / Consolidado) */}
                {extractoMeta.cuentasDisponibles && extractoMeta.cuentasDisponibles.length > 1 && (
                  <div className="pt-2 border-t border-line/60">
                    <label className="block text-[11px] font-bold text-ink mb-1">
                      Portafolio / Sección a Conciliar:
                    </label>
                    <select
                      value={selectedSubAccount}
                      onChange={(e) => setSelectedSubAccount(e.target.value)}
                      className="w-full rounded-lg border border-line bg-bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink focus:outline-teal"
                    >
                      {extractoMeta.cuentasDisponibles.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.nombre} ({sub.items.length} movs · Saldo: {formatMoney(sub.saldoFinal)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <input
              ref={fileInputExtractoRef}
              type="file"
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleUploadExtracto}
              className="hidden"
            />
            <button
              type="button"
              disabled={isExtractoLoading}
              onClick={() => fileInputExtractoRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-teal/60 bg-teal-soft/20 py-2.5 px-3 text-xs font-semibold text-teal hover:bg-teal-soft/40 transition cursor-pointer"
            >
              {isExtractoLoading ? (
                <>
                  <RefreshCw className="size-3.5 animate-spin" />
                  <span>Procesando extracto...</span>
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  <span>
                    {extractoMeta ? "Reemplazar Extracto (PDF o Excel)" : "Subir Extracto Bancario (PDF / Excel)"}
                  </span>
                </>
              )}
            </button>
            <div className="mt-1 text-[11px] text-center text-ink-subtle truncate">
              {extractoFileName}
            </div>
          </div>
        </div>

        {/* Tarjeta 2: Carga de Movimiento Auxiliar Contable (Excel) */}
        <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-teal-soft p-1.5 text-teal">
                  <FileSpreadsheet className="size-4" />
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-ink">
                  2. Movimiento Contable (Excel)
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
                ? "Utilizando los movimientos auxiliares cargados en la sesión activa. También puedes cargar un archivo Excel independiente si lo requieres."
                : "Carga el reporte auxiliar de movimientos contables exportado de tu ERP (Siigo, Helisa, World Office, CGUNO, etc.)."}
            </p>

            {/* Selector de Cuenta Contable */}
            <div className="rounded-xl border border-line bg-bg-subtle/50 p-3 text-xs space-y-2 mb-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-ink">Cuenta Contable a Conciliar:</span>
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
                  Todas las cuentas de bancos y tesorería ({librosEfectivos.length} movs)
                </option>
                {availableAccounts.map((acc) => (
                  <option key={acc.cuenta} value={acc.cuenta}>
                    {acc.cuenta} - {acc.cuentaNombre} ({acc.totalMovimientos} registros)
                  </option>
                ))}
              </select>

              {cuentaSeleccionada !== "todas" && (
                <div className="pt-1 flex items-center justify-between text-[11px] text-ink-muted">
                  <span>Movimientos en esta cuenta:</span>
                  <span className="font-mono font-bold text-ink">{librosBancos.length} líneas</span>
                </div>
              )}
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
                      ? "Cargar otro Excel de Movimientos Contables"
                      : "Subir Archivo Excel de Movimientos"}
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

      {/* Tarjeta de Resumen Aritmético y Estado de Cuadre */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Panel A: Estado del Cuadre con Alto Contraste */}
        <div
          className={cn(
            "lg:col-span-4 rounded-2xl border-2 p-5 shadow-xs flex flex-col justify-between transition-all",
            extractoItems.length === 0
              ? "border-line bg-bg-surface text-ink"
              : concilResult.summary.cuadrado
              ? "border-emerald-500/70 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 dark:from-emerald-950/60 dark:via-bg-surface dark:to-emerald-950/20 text-ink"
              : "border-amber-500/70 bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40 dark:from-amber-950/60 dark:via-bg-surface dark:to-amber-950/20 text-ink"
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "text-[11px] font-black uppercase tracking-wider",
                  extractoItems.length === 0
                    ? "text-ink-muted"
                    : concilResult.summary.cuadrado
                    ? "text-emerald-800 dark:text-emerald-400"
                    : "text-amber-800 dark:text-amber-400"
                )}
              >
                Resultado de Conciliación
              </span>
              {extractoItems.length === 0 ? (
                <span className="flex items-center gap-1.5 rounded-full bg-bg-subtle border border-line px-3 py-1 text-xs font-bold text-ink-muted shadow-2xs">
                  Sin Extracto
                </span>
              ) : concilResult.summary.cuadrado ? (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-black text-white shadow-xs">
                  <CheckCircle2 className="size-3.5" />
                  Cuadrado 100%
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
                  extractoItems.length === 0
                    ? "text-ink"
                    : concilResult.summary.cuadrado
                    ? "text-emerald-950 dark:text-emerald-200"
                    : "text-amber-950 dark:text-amber-200"
                )}
              >
                {extractoItems.length === 0
                  ? "LISTO PARA CONCILIAR"
                  : concilResult.summary.cuadrado
                  ? "CUADRADO PERFECTO"
                  : `DIFERENCIA: ${formatMoney(concilResult.summary.diferenciaCuadre)}`}
              </div>
              <p
                className={cn(
                  "mt-1.5 text-xs font-medium leading-relaxed",
                  extractoItems.length === 0
                    ? "text-ink-muted"
                    : concilResult.summary.cuadrado
                    ? "text-emerald-900/90 dark:text-emerald-300"
                    : "text-amber-900/90 dark:text-amber-300"
                )}
              >
                {extractoItems.length === 0
                  ? "Carga tu extracto bancario en PDF o Excel arriba para realizar el cruce automático con tus libros auxiliares."
                  : concilResult.summary.cuadrado
                  ? "El saldo bancario ajustado coincide con el saldo de libros contables al 100% sin partidas huérfanas."
                  : "Existen partidas pendientes por identificar, cheques en tránsito o notas bancarias pendientes de registro."}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-line space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-ink font-semibold">
              <span>Movimientos Conciliados:</span>
              <span className="font-mono font-bold text-ink bg-bg-subtle border border-line px-2 py-0.5 rounded-md">
                {concilResult.summary.totalConciliados} de {extractoItems.length} en extracto
              </span>
            </div>
            <div className="flex items-center justify-between text-ink font-semibold">
              <span>Registros en Libros Analizados:</span>
              <span className="font-mono font-bold text-ink bg-bg-subtle border border-line px-2 py-0.5 rounded-md">
                {librosEfectivos.length} movimientos
              </span>
            </div>
          </div>
        </div>

        {/* Panel B: Cuadro Aritmético de Conciliación */}
        <div className="lg:col-span-8 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-semibold text-sm text-ink flex items-center gap-1.5">
              <DollarSign className="size-4 text-teal" />
              Estado de Conciliación Bancaria (Norma Técnica NIIF / DIAN)
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
                title="Ingresa el saldo inicial del extracto bancario con separadores de miles y decimales"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-line/60">
              <span className="text-ink-muted">Saldo Final según Extracto Bancario:</span>
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
              <span>(-) Notas Débito Banco (4×1000 / Comisiones):</span>
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
                GMF (4×1000)
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

        {/* Card 3: Rendimientos Financieros */}
        <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs hover:shadow-xs transition">
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
                executiveBreakdown.rendimientos.pendiente === 0 && executiveBreakdown.rendimientos.count > 0
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                  : executiveBreakdown.rendimientos.pendiente > 0
                  ? "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-300"
                  : "bg-bg-subtle text-ink-subtle border-line"
              )}
            >
              {executiveBreakdown.rendimientos.pendiente === 0 && executiveBreakdown.rendimientos.count > 0
                ? "✓ 100% Contabilizado"
                : executiveBreakdown.rendimientos.pendiente > 0
                ? `⚠️ ${formatMoneyExact(executiveBreakdown.rendimientos.pendiente)} Por Causar`
                : "Sin Rendimientos"}
            </span>
          </div>
          <div className="font-mono text-lg font-black text-teal">
            +{formatMoneyExact(executiveBreakdown.rendimientos.total)}
          </div>
          <div className="mt-1 text-[11px] text-ink-muted flex items-center justify-between">
            <span>{executiveBreakdown.rendimientos.count} abonos de intereses</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
              Reg: {formatMoneyExact(executiveBreakdown.rendimientos.registrado)}
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

      {/* Barra de Filtros de Pestañas y Buscador */}
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

        {/* Buscador de partidas */}
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

      {/* Tabla Detallada de Partidas de Conciliación Bancaria con Rastreo y Auditoría */}
      <div className="rounded-2xl border border-line bg-bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs table-auto">
            <thead className="border-b border-line bg-bg-subtle/80 uppercase tracking-wider text-ink-subtle font-semibold">
              <tr>
                <th className="px-3.5 py-3">Estado</th>
                <th className="px-3.5 py-3">Fecha</th>
                <th className="px-3.5 py-3">Descripción / Concepto</th>
                <th className="px-3.5 py-3">Referencia</th>
                <th className="px-3.5 py-3 text-right">Monto Extracto</th>
                <th className="px-3.5 py-3 text-right">Monto Libros</th>
                <th className="px-3.5 py-3">Diagnóstico Contable</th>
                <th className="px-3.5 py-3 text-center">Auditoría / Rastrear</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rowsFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-xs text-ink-muted">
                    {extractoItems.length === 0 && effectiveMovLines.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Landmark className="size-8 text-teal opacity-60" />
                        <p className="font-bold text-ink text-sm">Plantilla en blanco lista para conciliar</p>
                        <p className="text-ink-muted max-w-md">
                          Sube tu extracto bancario (PDF o Excel) y tu auxiliar de movimientos contables arriba para conciliar en segundos.
                        </p>
                        <button
                          type="button"
                          onClick={handleCargarDemo}
                          className="mt-1 inline-flex items-center gap-1.5 rounded-xl border border-teal/40 bg-teal-soft px-3.5 py-1.5 text-xs font-bold text-teal hover:bg-teal hover:text-white transition cursor-pointer"
                        >
                          <Sparkles className="size-3.5" />
                          <span>Cargar datos de demostración</span>
                        </button>
                      </div>
                    ) : (
                      "No se encontraron partidas con los filtros seleccionados."
                    )}
                  </td>
                </tr>
              ) : (
                rowsFiltradas.map((r) => {
                  const isExpanded = expandedRowId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr className="hover:bg-bg-subtle/40 transition">
                        <td className="px-3.5 py-2.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-black border shadow-2xs",
                              r.estado === "conciliado"
                                ? r.itemsLibrosLote
                                  ? "bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-700"
                                  : "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700"
                                : r.esGmf
                                ? "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700 font-extrabold"
                                : r.esComision
                                ? "bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-700 font-extrabold"
                                : r.esRendimiento
                                ? "bg-teal-100 text-teal-950 border-teal-300 dark:bg-teal-950/80 dark:text-teal-200 dark:border-teal-700 font-extrabold"
                                : r.estado === "partida_en_transito_libros"
                                ? "bg-rose-100 text-rose-950 border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700 font-extrabold"
                                : "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100"
                            )}
                          >
                            <span
                              className={cn(
                                "inline-block size-1.5 rounded-full",
                                r.estado === "conciliado"
                                  ? r.itemsLibrosLote
                                    ? "bg-purple-600 dark:bg-purple-400"
                                    : "bg-emerald-600 dark:bg-emerald-400"
                                  : r.esGmf
                                  ? "bg-amber-600 dark:bg-amber-400"
                                  : r.esComision
                                  ? "bg-blue-600 dark:bg-blue-400"
                                  : r.esRendimiento
                                  ? "bg-teal-600 dark:bg-teal-400"
                                  : "bg-rose-600 dark:bg-rose-400"
                              )}
                            />
                            {r.estado === "conciliado"
                              ? r.itemsLibrosLote
                                ? `Lote ACH (${r.itemsLibrosLote.length})`
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
                        <td className="px-3.5 py-2.5 font-mono font-bold text-right text-ink whitespace-nowrap">
                          {r.montoBanco > 0 ? formatMoneyExact(r.montoBanco) : "—"}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono font-bold text-right text-ink whitespace-nowrap">
                          {r.montoLibros > 0 ? formatMoneyExact(r.montoLibros) : "—"}
                        </td>
                        <td className="px-3.5 py-2.5 text-ink-muted leading-tight max-w-[320px]">
                          {r.nota}
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
                              className="inline-flex items-center gap-1.5 rounded-lg bg-bg-subtle hover:bg-teal-soft/60 text-ink hover:text-teal border border-line px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                              title="Rastrear comprobante contable en libros"
                            >
                              <FileText className="size-3.5 text-teal" />
                              <span>{r.itemLibros.comprobante ? `Comp. ${r.itemLibros.comprobante}` : "Rastrear"}</span>
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
                                        <tr key={cIdx} className="hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition">
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
                                          <td className="px-3 py-2 text-ink-muted max-w-[260px] truncate" title={c.descripcion}>
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
    </div>
  );
}
