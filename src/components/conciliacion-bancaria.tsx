import { useState, useMemo, useEffect, useRef } from "react";
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
} from "lucide-react";
import { formatMoney, formatMoneyExact, formatDate } from "@/lib/format";
import {
  conciliarBancos,
  extractLibroBancos,
  getAvailableBankAccounts,
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

  // Estado de extracto bancario cargado
  const [extractoMeta, setExtractoMeta] = useState<ParsedBankExtractResult | null>(null);
  const [extractoItems, setExtractoItems] = useState<BankExtractItem[]>(DEMO_EXTRACTO);
  const [selectedSubAccount, setSelectedSubAccount] = useState<string>("default");
  const [extractoFileName, setExtractoFileName] = useState<string>("Extracto de Demostración");
  const [isExtractoLoading, setIsExtractoLoading] = useState<boolean>(false);

  // Estado de libros contables (permite usar los de la sesión o cargar un Excel específico de bancos)
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

  // Cuenta contable seleccionada para la conciliación
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("todas");

  // Saldos iniciales
  const [saldoInicialExtracto, setSaldoInicialExtracto] = useState<number>(15000000);
  const [saldoInicialLibros, setSaldoInicialLibros] = useState<number>(15000000);

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

  // Libros efectivos: si no hay libros en sesión, proveer demostración
  const librosEfectivos = useMemo(() => {
    if (librosBancos.length > 0) return librosBancos;
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
  }, [librosBancos]);

  // Ejecución del motor de conciliación bancaria
  const concilResult: BankConciliacionResult = useMemo(() => {
    return conciliarBancos(
      extractoItems,
      librosEfectivos,
      saldoInicialExtracto,
      saldoInicialLibros
    );
  }, [extractoItems, librosEfectivos, saldoInicialExtracto, saldoInicialLibros]);

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

  // Exportar Cédula de Conciliación Bancaria a Excel
  function exportarCedulaBancaria() {
    const entidadNombre = extractoMeta
      ? `${extractoMeta.bancoNombre} ${extractoMeta.numeroCuenta ? `(${extractoMeta.numeroCuenta})` : ""}`
      : "ENTIDAD BANCARIA";

    const wsData = [
      ["CÉDULA DE CONCILIACIÓN BANCARIA MENSUAL"],
      ["Entidad Financiera:", entidadNombre],
      ["Periodo / Fecha de Corte:", extractoMeta?.periodo || new Date().toLocaleDateString("es-CO")],
      ["Cuenta Contable Conciliada:", cuentaSeleccionada === "todas" ? "Todas las cuentas de tesorería" : cuentaSeleccionada],
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-bg-surface via-bg-surface to-teal-soft/25 p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-lg bg-teal p-1.5 text-white shadow-xs">
              <Landmark className="size-5" />
            </span>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-ink">
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

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={exportarCedulaBancaria}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-deep transition cursor-pointer shadow-xs"
          >
            <Download className="size-3.5" />
            <span>Exportar Cédula Excel</span>
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

      {/* Tarjeta de Resumen Arimético y Estado de Cuadre */}
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
                  ? "El saldo bancario ajustado coincide con el saldo de libros contables al 100% sin partidas huérfanas."
                  : "Existen partidas pendientes por identificar, cheques en tránsito o notas bancarias pendientes de registro."}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-current/20 space-y-1 text-xs font-medium">
            <div className="flex items-center justify-between">
              <span>Movimientos Conciliados:</span>
              <span className="font-bold">
                {concilResult.summary.totalConciliados} de {extractoItems.length} en extracto
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Registros en Libros Analizados:</span>
              <span className="font-bold">{librosEfectivos.length} movimientos</span>
            </div>
          </div>
        </div>

        {/* Panel B: Cuadro Aritmético de Conciliación */}
        <div className="lg:col-span-8 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-semibold text-sm text-ink flex items-center gap-1.5">
              <DollarSign className="size-4 text-teal" />
              Cédula de Conciliación Bancaria (Estructura DIAN / NIIF)
            </h3>

            {/* Ajuste manual de saldo inicial si es necesario */}
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

      {/* Tabla Detallada de Partidas de Conciliación Bancaria */}
      <div className="rounded-2xl border border-line bg-bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs table-auto">
            <thead className="border-b border-line bg-bg-subtle/80 uppercase tracking-wider text-ink-subtle font-semibold">
              <tr>
                <th className="px-3.5 py-3">Estado</th>
                <th className="px-3.5 py-3">Fecha</th>
                <th className="px-3.5 py-3">Descripción / Concepto</th>
                <th className="px-3.5 py-3">Referencia / Comprobante</th>
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
    </div>
  );
}
