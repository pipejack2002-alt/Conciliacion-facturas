import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { formatMoneyExact } from "@/lib/format";
import {
  conciliarBancos,
  extractLibroBancos,
  getAvailableBankAccounts,
  getBankExecutiveBreakdown,
  type BankExtractItem,
  type BankConciliacionResult,
  type DetectedBankAccount,
} from "@/lib/conciliar-bancos";
import { parseBankExtractFile, type ParsedBankExtractResult } from "@/lib/parse-bank-extract";
import { readWorkbook, parseMovSheet } from "@/lib/parse-excel";
import type { MovLine } from "@/lib/types";
import * as XLSX from "xlsx";
import { ConciliacionUniversalBancosView } from "./conciliacion-universal-bancos";
import { BankHeaderBanner } from "./bancos/bank-header-banner";
import { BankUploadCards } from "./bancos/bank-upload-cards";
import { BankSummaryCards } from "./bancos/bank-summary-cards";
import { BankPendingMovements } from "./bancos/bank-pending-movements";
import { BankExecutiveCards } from "./bancos/bank-executive-cards";
import { BankTable } from "./bancos/bank-table";

// Extracto de demostración inicial preconfigurado (solo bajo demanda al hacer clic en Cargar Ejemplo)
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

  // Control de modo demo vs plantilla en blanco
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Estado de extracto bancario cargado
  const [extractoMeta, setExtractoMeta] = useState<ParsedBankExtractResult | null>(null);
  const [extractoItems, setExtractoItems] = useState<BankExtractItem[]>([]);
  const [selectedSubAccount, setSelectedSubAccount] = useState<string>("default");
  const [extractoFileName, setExtractoFileName] = useState<string>("");
  const [isExtractoLoading, setIsExtractoLoading] = useState<boolean>(false);

  // Estado de libros contables
  const [customMovLines, setCustomMovLines] = useState<MovLine[] | null>(null);
  const [customMovFileName, setCustomMovFileName] = useState<string>("");
  const [isMovLoading, setIsMovLoading] = useState<boolean>(false);

  // Saldos iniciales
  const [saldoInicialExtracto, setSaldoInicialExtracto] = useState<number>(0);
  const [saldoInicialLibros, setSaldoInicialLibros] = useState<number>(0);
  const [saldoInputStr, setSaldoInputStr] = useState<string>(() =>
    formatMoneyExact(0).replace("$", "").trim()
  );

  // Filtros de tabla
  const [tabFilter, setTabFilter] = useState<"todas" | "conciliado" | "banco_pend" | "transito">("todas");

  const fileInputExtractoRef = useRef<HTMLInputElement>(null);
  const fileInputMovRef = useRef<HTMLInputElement>(null);

  const handleVaciarBancos = useCallback(() => {
    setIsDemoMode(false);
    setExtractoItems([]);
    setExtractoMeta(null);
    setExtractoFileName("");
    setCustomMovLines([]);
    setCustomMovFileName("");
    setSaldoInicialExtracto(0);
    setSaldoInicialLibros(0);
    setSaldoInputStr("0,00");
  }, []);

  const handleCargarDemo = useCallback(() => {
    setIsDemoMode(true);
    setExtractoItems(DEMO_EXTRACTO);
    setExtractoMeta(null);
    setExtractoFileName("Extracto de Demostración");
    setCustomMovLines(null);
    setCustomMovFileName("");
    setSaldoInicialExtracto(15000000);
    setSaldoInicialLibros(15000000);
    setSaldoInputStr(formatMoneyExact(15000000).replace("$", "").trim());
  }, []);

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
  const lastAutoDetectedKeyRef = useRef<string>("");

  useEffect(() => {
    setSaldoInputStr(formatMoneyExact(saldoInicialExtracto).replace("$", "").trim());
  }, [saldoInicialExtracto]);

  const handleSaldoChange = useCallback((val: string) => {
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
  }, []);

  const handleSaldoBlur = useCallback(() => {
    setSaldoInputStr(formatMoneyExact(saldoInicialExtracto).replace("$", "").trim());
  }, [saldoInicialExtracto]);

  // Auto-seleccionar cuenta contable inteligente SOLO cuando se carga un nuevo extracto
  useEffect(() => {
    if (!extractoMeta || availableAccounts.length === 0) return;

    const currentKey = `${extractoMeta.bancoId || ""}_${extractoMeta.numeroCuenta || ""}_${extractoMeta.periodo || ""}_${extractoMeta.items?.length || 0}`;
    if (lastAutoDetectedKeyRef.current === currentKey) return;
    lastAutoDetectedKeyRef.current = currentKey;

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
      const credAccounts = availableAccounts.filter(
        (a) =>
          a.cuenta.startsWith("12503511") ||
          a.cuenta.startsWith("12450541") ||
          /credicorp|correval|fonval|serfinco|fic/i.test(a.cuentaNombre)
      );
      if (credAccounts.length > 0) {
        // Ordenar por volumen de movimientos (la cuenta principal de mayor actividad primero)
        credAccounts.sort((a, b) => b.totalMovimientos - a.totalMovimientos);
        setCuentaSeleccionada(credAccounts[0].cuenta);
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

    if (availableAccounts.length === 1) {
      setCuentaSeleccionada(availableAccounts[0].cuenta);
    }
  }, [extractoMeta, availableAccounts]);

  // Actualizar items de extracto cuando cambia la subcuenta seleccionada
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

  // Libros efectivos: si no hay libros en sesión, proveer demostración solo si isDemoMode está activo
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
        comprobante: "CE 002 8842",
        fecha: "2026-07-05",
        nit: "800111222",
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
        comprobante: "CH 003 5510",
        fecha: "2026-07-20",
        nit: "900333222",
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

  // Conteos por estado para los tabs
  const tabCounts = useMemo(() => ({
    todas: concilResult.rows.length,
    conciliado: concilResult.summary.totalConciliados,
    banco_pend: concilResult.rows.filter(
      (r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco"
    ).length,
    transito: concilResult.rows.filter(
      (r) => r.estado === "partida_en_transito_libros"
    ).length,
  }), [concilResult.rows, concilResult.summary.totalConciliados]);

  // Manejador de carga de archivo de Extracto Bancario
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
      alert(err.message || "Error al procesar el archivo del extracto bancario.");
    } finally {
      setIsExtractoLoading(false);
      if (e.target) e.target.value = "";
    }
  }

  // Manejador de carga de archivo de Movimiento Contable (Excel)
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
  const exportarConciliacionBancaria = useCallback(() => {
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
  }, [extractoMeta, cuentaSeleccionada, concilResult]);

  if (modoVista === "universal") {
    return (
      <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-2 sm:px-6 lg:px-8 animate-in fade-in duration-200">
        <BankHeaderBanner
          modoVista={modoVista}
          onSetModoVista={setModoVista}
          hasData={false}
          onVaciar={handleVaciarBancos}
          isDemoMode={isDemoMode}
          canLoadDemo={false}
          onCargarDemo={handleCargarDemo}
          canExport={false}
          onExportarExcel={exportarConciliacionBancaria}
        />
        <ConciliacionUniversalBancosView movLines={effectiveMovLines} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-2 sm:px-6 lg:px-8 animate-in fade-in duration-200">
      {/* 1. Header Banner & Modos */}
      <BankHeaderBanner
        modoVista={modoVista}
        onSetModoVista={setModoVista}
        hasData={extractoItems.length > 0 || effectiveMovLines.length > 0}
        onVaciar={handleVaciarBancos}
        isDemoMode={isDemoMode}
        canLoadDemo={extractoItems.length === 0}
        onCargarDemo={handleCargarDemo}
        canExport={concilResult.rows.length > 0}
        onExportarExcel={exportarConciliacionBancaria}
      />

      {/* 2. Zona Dual de Carga de Archivos */}
      <BankUploadCards
        extractoMeta={extractoMeta}
        extractoItemsCount={extractoItems.length}
        selectedSubAccount={selectedSubAccount}
        onSelectSubAccount={setSelectedSubAccount}
        isExtractoLoading={isExtractoLoading}
        extractoFileName={extractoFileName}
        fileInputExtractoRef={fileInputExtractoRef}
        onUploadExtracto={handleUploadExtracto}
        effectiveMovLinesCount={effectiveMovLines.length}
        availableAccounts={availableAccounts}
        cuentaSeleccionada={cuentaSeleccionada}
        onSelectCuenta={setCuentaSeleccionada}
        librosEfectivosCount={librosEfectivos.length}
        librosBancosCount={librosBancos.length}
        isMovLoading={isMovLoading}
        customMovFileName={customMovFileName}
        hasSessionMovLines={Boolean(movLines && movLines.length > 0 && !customMovLines)}
        fileInputMovRef={fileInputMovRef}
        onUploadMov={handleUploadMov}
      />

      {/* 3. Tarjeta de Resumen Aritmético y Estado de Cuadre */}
      <BankSummaryCards
        extractoItemsCount={extractoItems.length}
        summary={concilResult.summary}
        librosEfectivosCount={librosEfectivos.length}
        saldoInputStr={saldoInputStr}
        onSaldoChange={handleSaldoChange}
        onSaldoBlur={handleSaldoBlur}
      />

      {/* 4. Movimientos Pendientes de Registro Contable (Partidas Conciliatorias) */}
      <BankPendingMovements
        rows={concilResult.rows}
        summary={concilResult.summary}
        cuentaContable={cuentaSeleccionada}
        bancoNombre={extractoMeta?.bancoNombre}
      />

      {/* 5. Franja Ejecutiva de Conceptos Bancarios */}
      <BankExecutiveCards breakdown={executiveBreakdown} />

      {/* 5. Tabla Detallada con Pestañas, Búsqueda Debounced y Paginación */}
      <BankTable
        rows={concilResult.rows}
        tabFilter={tabFilter}
        onSetTabFilter={setTabFilter}
        counts={tabCounts}
        extractoItemsCount={extractoItems.length}
        effectiveMovLinesCount={effectiveMovLines.length}
        onCargarDemo={handleCargarDemo}
      />
    </div>
  );
}
