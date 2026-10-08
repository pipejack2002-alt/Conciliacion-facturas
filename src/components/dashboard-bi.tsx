import { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  PieChart as PieIcon,
  BarChart3,
  Building,
  DollarSign,
  Receipt,
  Award,
  Trash2,
  Landmark,
  BookOpen,
  FileCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Wallet,
  BadgePercent,
  CreditCard,
  History,
} from "lucide-react";
import { formatMoney, formatMoneyExact, formatDate, formatPct } from "@/lib/format";
import type { ConciliacionResult, MovLine, DianDoc } from "@/lib/types";
import { useConciliacion } from "@/lib/store";
import {
  conciliarBancos,
  extractLibroBancos,
  getBankExecutiveBreakdown,
  type BankExtractItem,
  type BankConciliacionResult,
} from "@/lib/conciliar-bancos";
import {
  loadStoredBankSession,
  getInitialBankSessionSync,
  type StoredBankSession,
} from "@/lib/bank-cache";
import { cn } from "@/lib/cn";

const COLORS_PIE = ["#0f766e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#64748b"];
const COLORS_PUC: Record<string, string> = {
  "1": "#0f766e", // Activo (Teal)
  "2": "#3b82f6", // Pasivo (Azul)
  "3": "#8b5cf6", // Patrimonio (Púrpura)
  "4": "#10b981", // Ingreso (Esmeralda)
  "5": "#f59e0b", // Gastos (Ámbar)
  "6": "#ef4444", // Costos (Rojo)
  "default": "#64748b",
};

interface DashboardBiProps {
  result?: ConciliacionResult | null;
  movLines?: MovLine[];
  onNavigate?: (module: "dian" | "bancos" | "dashboard_bi") => void;
}

export function DashboardBi({
  result: propResult,
  movLines: propMovLines,
  onNavigate,
}: DashboardBiProps) {
  const storeResult = useConciliacion((s) => s.result);
  const storeMov = useConciliacion((s) => s.mov);
  const reset = useConciliacion((s) => s.reset);

  const result = propResult ?? storeResult;
  const storeOrPropMov = propMovLines && propMovLines.length > 0 ? propMovLines : storeMov;

  // Estado para la sesión bancaria (síncrono inicial para evitar layout shifts y re-renders tardíos)
  const [bankSession, setBankSession] = useState<StoredBankSession | null>(() => getInitialBankSessionSync());
  const [isBankLoading, setIsBankLoading] = useState(false);

  // Selector de Pestaña Interna del BI
  const [activeTab, setActiveTab] = useState<"resumen_360" | "bancos" | "contabilidad" | "dian">("resumen_360");

  // Cargar sesión bancaria persistida desde IndexedDB con protección contra loops
  useEffect(() => {
    let isMounted = true;
    async function loadBank() {
      try {
        const session = await loadStoredBankSession();
        if (isMounted && session) {
          setBankSession((prev) => {
            if (!prev) return session;
            if (
              (session.extractoItems?.length || 0) !== (prev.extractoItems?.length || 0) ||
              (session.customMovLines?.length || 0) !== (prev.customMovLines?.length || 0)
            ) {
              return session;
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn("Error cargando sesión bancaria para Dashboard BI:", err);
      } finally {
        if (isMounted) setIsBankLoading(false);
      }
    }
    void loadBank();
    return () => {
      isMounted = false;
    };
  }, []);

  // Movimientos contables efectivos
  const effectiveMov: MovLine[] = useMemo(() => {
    if (storeOrPropMov && storeOrPropMov.length > 0) return storeOrPropMov;
    if (bankSession?.customMovLines && bankSession.customMovLines.length > 0) return bankSession.customMovLines;
    return [];
  }, [storeOrPropMov, bankSession?.customMovLines]);

  // Extracto bancario efectivo
  const effectiveExtracto: BankExtractItem[] = useMemo(() => {
    return bankSession?.extractoItems || [];
  }, [bankSession?.extractoItems]);

  // Conciliación bancaria viva calculada para el BI
  const bankConcilResult: BankConciliacionResult | null = useMemo(() => {
    if (effectiveExtracto.length === 0) return null;
    try {
      const saldoIni = bankSession?.saldoInicialExtracto || 0;
      const treasuryMov = extractLibroBancos(effectiveMov, bankSession?.cuentaSeleccionada || "todas");
      return conciliarBancos(effectiveExtracto, treasuryMov, saldoIni, saldoIni);
    } catch (e) {
      console.warn("Fallo al calcular conciliación bancaria en Dashboard BI:", e);
      return null;
    }
  }, [effectiveExtracto, effectiveMov, bankSession?.saldoInicialExtracto, bankSession?.cuentaSeleccionada]);

  const bankExecutive = useMemo(() => {
    if (!bankConcilResult) return null;
    return getBankExecutiveBreakdown(bankConcilResult.rows);
  }, [bankConcilResult]);

  // =========================================================================
  // 1. ANÁLISIS DE FACTURACIÓN DIAN E IVA
  // =========================================================================
  const comprasRows = useMemo(() => {
    if (!result?.rows) return [];
    return result.rows.filter(
      (r) => r.grupo === "Recibido" && r.totalDian > 0 && r.estado !== "no_aplica"
    );
  }, [result?.rows]);

  const dianKpis = useMemo(() => {
    const totalCompras = comprasRows.reduce((acc, r) => acc + r.totalDian, 0);
    const totalIva = comprasRows.reduce((acc, r) => acc + (r.iva || 0), 0);
    const totalProveedores = new Set(comprasRows.map((r) => r.nitContraparte)).size;
    const ticketPromedio = comprasRows.length > 0 ? totalCompras / comprasRows.length : 0;
    const conciliadasCount = comprasRows.filter((r) => r.estado === "conciliado").length;
    const tasaCobertura = comprasRows.length > 0 ? ((conciliadasCount / comprasRows.length) * 100).toFixed(1) : "0";

    return {
      totalCompras,
      totalIva,
      totalProveedores,
      ticketPromedio,
      totalDocs: comprasRows.length,
      conciliadasCount,
      tasaCobertura,
    };
  }, [comprasRows]);

  const dataTarifasIva = useMemo(() => {
    let gravada19 = 0;
    let gravada5 = 0;
    let exenta = 0;
    let otras = 0;

    let count19 = 0;
    let count5 = 0;
    let count0 = 0;
    let countOtras = 0;

    for (const r of comprasRows) {
      if (!r.iva || r.iva === 0) {
        exenta += r.totalDian;
        count0++;
      } else {
        const base = r.totalDian - r.iva;
        const rate = base > 0 ? r.iva / base : 0;
        if (Math.abs(rate - 0.19) <= 0.025) {
          gravada19 += r.totalDian;
          count19++;
        } else if (Math.abs(rate - 0.05) <= 0.015) {
          gravada5 += r.totalDian;
          count5++;
        } else {
          otras += r.totalDian;
          countOtras++;
        }
      }
    }

    const total = gravada19 + gravada5 + exenta + otras || 1;

    return [
      { name: "Gravadas 19%", value: Math.round(gravada19), count: count19, pct: ((gravada19 / total) * 100).toFixed(1) },
      { name: "Gravadas 5%", value: Math.round(gravada5), count: count5, pct: ((gravada5 / total) * 100).toFixed(1) },
      { name: "Exentas / Excluidas (0%)", value: Math.round(exenta), count: count0, pct: ((exenta / total) * 100).toFixed(1) },
      ...(otras > 0 ? [{ name: "Otras Tarifas", value: Math.round(otras), count: countOtras, pct: ((otras / total) * 100).toFixed(1) }] : []),
    ];
  }, [comprasRows]);

  const dataTopProveedoresDian = useMemo(() => {
    const map = new Map<string, { nit: string; nombre: string; total: number; iva: number; docs: number }>();

    for (const r of comprasRows) {
      const nit = r.nitContraparte || "S/N";
      const key = `${nit}_${r.nombreContraparte}`;
      const curr = map.get(key) || {
        nit,
        nombre: r.nombreContraparte || "Proveedor sin nombre",
        total: 0,
        iva: 0,
        docs: 0,
      };
      curr.total += r.totalDian;
      curr.iva += r.iva || 0;
      curr.docs += 1;
      map.set(key, curr);
    }

    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        shortName: item.nombre.length > 20 ? item.nombre.slice(0, 18) + "…" : item.nombre,
      }));
  }, [comprasRows]);

  const dataTendenciaDian = useMemo(() => {
    const map = new Map<string, { fecha: string; total: number; iva: number }>();

    for (const r of comprasRows) {
      const fecha = r.fecha ? r.fecha.slice(0, 10) : "Sin fecha";
      const curr = map.get(fecha) || { fecha, total: 0, iva: 0 };
      curr.total += r.totalDian;
      curr.iva += r.iva || 0;
      map.set(fecha, curr);
    }

    const sorted = Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
    let acumIva = 0;
    return sorted.map((d) => {
      acumIva += d.iva;
      return {
        ...d,
        ivaAcumulado: Math.round(acumIva),
        fechaCorta: d.fecha.slice(5),
      };
    });
  }, [comprasRows]);

  // =========================================================================
  // 2. ANÁLISIS DE LIBROS CONTABLES (AUXILIAR ERP)
  // =========================================================================
  const contabilidadKpis = useMemo(() => {
    if (effectiveMov.length === 0) {
      return {
        totalDebitos: 0,
        totalCreditos: 0,
        diferenciaPartidaDoble: 0,
        cuadrado: true,
        totalMovs: 0,
        totalTerceros: 0,
        totalCuentas: 0,
      };
    }

    let deb = 0;
    let cred = 0;
    const tercerosSet = new Set<string>();
    const cuentasSet = new Set<string>();

    for (const m of effectiveMov) {
      deb += m.debito || 0;
      cred += m.credito || 0;
      if (m.nit || m.nombre) tercerosSet.add(m.nit || m.nombre);
      if (m.cuenta) cuentasSet.add(m.cuenta);
    }

    const diff = Math.abs(deb - cred);
    const cuadrado = diff < 0.05;

    return {
      totalDebitos: deb,
      totalCreditos: cred,
      diferenciaPartidaDoble: diff,
      cuadrado,
      totalMovs: effectiveMov.length,
      totalTerceros: tercerosSet.size,
      totalCuentas: cuentasSet.size,
    };
  }, [effectiveMov]);

  // Desglose por Clase PUC (1 Activo, 2 Pasivo, 3 Patrimonio, 4 Ingreso, 5 Gasto, 6 Costo)
  const dataClasesPuc = useMemo(() => {
    if (effectiveMov.length === 0) return [];
    const clasesMap: Record<string, { debito: number; credito: number; count: number; label: string }> = {
      "1": { debito: 0, credito: 0, count: 0, label: "Activos & Tesorería (1)" },
      "2": { debito: 0, credito: 0, count: 0, label: "Pasivos & Proveedores (2)" },
      "3": { debito: 0, credito: 0, count: 0, label: "Patrimonio (3)" },
      "4": { debito: 0, credito: 0, count: 0, label: "Ingresos (4)" },
      "5": { debito: 0, credito: 0, count: 0, label: "Gastos Operativos & Fin (5)" },
      "6": { debito: 0, credito: 0, count: 0, label: "Costos de Ventas (6)" },
    };

    for (const m of effectiveMov) {
      const c = (m.cuenta || "").trim().charAt(0);
      if (clasesMap[c]) {
        clasesMap[c].debito += m.debito || 0;
        clasesMap[c].credito += m.credito || 0;
        clasesMap[c].count += 1;
      }
    }

    return Object.entries(clasesMap)
      .filter(([_, d]) => d.count > 0)
      .map(([k, d]) => ({
        clase: k,
        label: d.label,
        debito: Math.round(d.debito),
        credito: Math.round(d.credito),
        totalMovimiento: Math.round(d.debito + d.credito),
        count: d.count,
        color: COLORS_PUC[k] || COLORS_PUC.default,
      }));
  }, [effectiveMov]);

  // Top 10 Terceros en Contabilidad
  const dataTopTercerosContables = useMemo(() => {
    if (effectiveMov.length === 0) return [];
    const map = new Map<string, { nit: string; nombre: string; debito: number; credito: number; docs: number }>();

    for (const m of effectiveMov) {
      const nit = m.nit || "SIN_NIT";
      const key = `${nit}_${m.nombre || "SIN_NOMBRE"}`;
      const curr = map.get(key) || {
        nit: m.nit || "—",
        nombre: m.nombre || m.cuentaNombre || "Tercero sin nombre",
        debito: 0,
        credito: 0,
        docs: 0,
      };
      curr.debito += m.debito || 0;
      curr.credito += m.credito || 0;
      curr.docs += 1;
      map.set(key, curr);
    }

    return Array.from(map.values())
      .map((t) => ({
        ...t,
        volumenTotal: t.debito + t.credito,
        saldoNeto: t.debito - t.credito,
        shortName: t.nombre.length > 20 ? t.nombre.slice(0, 18) + "…" : t.nombre,
      }))
      .sort((a, b) => b.volumenTotal - a.volumenTotal)
      .slice(0, 10);
  }, [effectiveMov]);

  // Desglose por Tipo de Comprobante Contable (G, RC, L, FC, etc.)
  const dataComprobantesTipos = useMemo(() => {
    if (effectiveMov.length === 0) return [];
    const map = new Map<string, { count: number; total: number; label: string }>();

    for (const m of effectiveMov) {
      const rawComp = (m.comprobante || "").trim().toUpperCase();
      let tipo = "OTRO";
      let label = "Otros Comprobantes";

      if (/^G|^CE|^OP/.test(rawComp)) {
        tipo = "EGRESO";
        label = "Comprobantes de Egreso / Pagos (G/CE)";
      } else if (/^RC|^CI/.test(rawComp)) {
        tipo = "INGRESO";
        label = "Recibos de Caja / Ingresos (RC)";
      } else if (/^L|^CD|^NC|^AJ/.test(rawComp)) {
        tipo = "DIARIO";
        label = "Notas de Ajuste / Diario (L/CD)";
      } else if (/^FC|^P|^CP/.test(rawComp)) {
        tipo = "COMPRAS";
        label = "Facturas de Compra / Causación";
      }

      const curr = map.get(tipo) || { count: 0, total: 0, label };
      curr.count += 1;
      curr.total += (m.debito || 0) + (m.credito || 0);
      map.set(tipo, curr);
    }

    return Array.from(map.entries()).map(([tipo, val]) => ({
      tipo,
      name: val.label,
      count: val.count,
      total: Math.round(val.total),
    }));
  }, [effectiveMov]);

  // =========================================================================
  // 3. ANÁLISIS DE TESORERÍA Y EXTRACTO BANCARIO
  // =========================================================================
  const bancoKpis = useMemo(() => {
    if (effectiveExtracto.length === 0) {
      return {
        hasBank: false,
        bancoNombre: "Sin extracto",
        cuenta: "—",
        saldoInicial: 0,
        saldoFinal: 0,
        totalAbonos: 0,
        totalRetiros: 0,
        flujoNeto: 0,
        totalPartidas: 0,
      };
    }

    const totalAbonos = effectiveExtracto.reduce((acc, it) => acc + (it.credito || 0), 0);
    const totalRetiros = effectiveExtracto.reduce((acc, it) => acc + (it.debito || 0), 0);
    const saldoIni = bankSession?.saldoInicialExtracto || 0;
    const meta = bankSession?.extractoMeta;
    const saldoFin = meta?.saldoFinal || saldoIni + totalAbonos - totalRetiros;

    return {
      hasBank: true,
      bancoNombre: meta?.bancoNombre || meta?.bancoId || "Entidad Bancaria",
      cuenta: meta?.numeroCuenta || "Principal",
      saldoInicial: saldoIni,
      saldoFinal: saldoFin,
      totalAbonos,
      totalRetiros,
      flujoNeto: totalAbonos - totalRetiros,
      totalPartidas: effectiveExtracto.length,
    };
  }, [effectiveExtracto, bankSession]);

  // Tendencia de Flujo Diario Bancario
  const dataFlujoBancarioDiario = useMemo(() => {
    if (effectiveExtracto.length === 0) return [];
    const map = new Map<string, { fecha: string; abonos: number; retiros: number }>();

    for (const it of effectiveExtracto) {
      const f = it.fecha ? it.fecha.slice(0, 10) : "Sin fecha";
      const curr = map.get(f) || { fecha: f, abonos: 0, retiros: 0 };
      curr.abonos += it.credito || 0;
      curr.retiros += it.debito || 0;
      map.set(f, curr);
    }

    return Array.from(map.values())
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((d) => ({
        ...d,
        fechaCorta: d.fecha.slice(5),
        neto: d.abonos - d.retiros,
      }));
  }, [effectiveExtracto]);

  // Top Movimientos del Extracto
  const dataTopMovimientosBancarios = useMemo(() => {
    if (effectiveExtracto.length === 0) return [];
    return [...effectiveExtracto]
      .sort((a, b) => Math.max(b.debito, b.credito) - Math.max(a.debito, a.credito))
      .slice(0, 8);
  }, [effectiveExtracto]);

  // =========================================================================
  // 4. ESTADO GLOBAL / RESUMEN 360° (TRIANGULACIÓN FINANCIERA)
  // =========================================================================
  const hasDian = comprasRows.length > 0;
  const hasMov = effectiveMov.length > 0;
  const hasBank = effectiveExtracto.length > 0;
  const hasAnyData = hasDian || hasMov || hasBank;

  // Matriz de magnitudes de triangulación financiera (renderizado nativo 100% fluido y libre de loops de ResizeObserver)
  const dataTriangulacion = useMemo(() => {
    const comprasVal = hasDian ? dianKpis.totalCompras : 0;
    const librosVal = hasMov ? contabilidadKpis.totalDebitos : 0;
    const salidasBancoVal = hasBank ? bancoKpis.totalRetiros : 0;
    const entradasBancoVal = hasBank ? bancoKpis.totalAbonos : 0;

    const maxVal = Math.max(comprasVal, librosVal, salidasBancoVal, entradasBancoVal, 1);

    return [
      {
        id: "dian",
        name: "Compras Facturadas DIAN",
        tipo: "Fiscal",
        monto: comprasVal,
        colorBg: "bg-purple-600",
        colorBadge: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
        pctOfMax: Math.round((comprasVal / maxVal) * 100),
        desc: hasDian ? `${dianKpis.totalDocs} facturas electrónicas recibidas` : "Sin facturas DIAN cargadas",
        icon: Receipt,
      },
      {
        id: "libros",
        name: "Débitos en Libros ERP",
        tipo: "Contabilidad Oficial",
        monto: librosVal,
        colorBg: "bg-teal",
        colorBadge: "bg-teal-soft text-teal border-teal/30",
        pctOfMax: Math.round((librosVal / maxVal) * 100),
        desc: hasMov ? `${contabilidadKpis.totalMovs} asientos en libros (${contabilidadKpis.totalCuentas} cuentas)` : "Sin auxiliar contable cargado",
        icon: BookOpen,
      },
      {
        id: "salidas_banco",
        name: "Salidas Bancarias (Egresos)",
        tipo: "Flujo Real de Caja",
        monto: salidasBancoVal,
        colorBg: "bg-amber-500",
        colorBadge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
        pctOfMax: Math.round((salidasBancoVal / maxVal) * 100),
        desc: hasBank ? `Pagos a terceros y cargos en ${bancoKpis.bancoNombre}` : "Sin extracto bancario cargado",
        icon: Landmark,
      },
      {
        id: "entradas_banco",
        name: "Entradas Bancarias (Ingresos)",
        tipo: "Flujo Real de Caja",
        monto: entradasBancoVal,
        colorBg: "bg-emerald-600",
        colorBadge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
        pctOfMax: Math.round((entradasBancoVal / maxVal) * 100),
        desc: hasBank ? `Abonos y transferencias en ${bancoKpis.bancoNombre}` : "Sin extracto bancario cargado",
        icon: Landmark,
      },
    ];
  }, [hasDian, dianKpis, hasMov, contabilidadKpis, hasBank, bancoKpis]);

  const [isClientMounted, setIsClientMounted] = useState(false);
  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  if (!isClientMounted) {
    return (
      <div className="mx-auto w-full max-w-[1600px] p-12 text-center text-ink-muted">
        <div className="inline-block size-6 animate-spin rounded-full border-2 border-teal border-t-transparent mb-2" />
        <p className="text-xs">Cargando Centro de Inteligencia Financiera...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-2 sm:px-6 lg:px-8 animate-in fade-in duration-200">
      {/* Banner Superior Ejecutivo Multi-Fuente */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-2xl border border-line bg-linear-to-r from-bg-surface via-bg-surface to-teal-soft/20 p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="rounded-xl bg-teal p-2 text-white shadow-xs">
              <BarChart3 className="size-5" />
            </span>
            <h1 className="font-display text-xl sm:text-2xl font-black text-ink tracking-tight">
              Dashboard de Inteligencia Financiera & Contable
            </h1>
            <span className="rounded-full bg-teal-soft border border-teal/30 px-2.5 py-0.5 text-xs font-black text-teal uppercase tracking-wider">
              BI 360°
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted leading-relaxed">
            Visión ejecutiva consolidada: Facturación electrónica DIAN, auxiliar contable de libros y flujo real de tesorería bancaria.
          </p>

          {/* Badges de Fuentes Activas */}
          <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold border",
                hasDian
                  ? "bg-teal-soft/40 border-teal/30 text-teal dark:text-teal-300"
                  : "bg-bg-subtle border-line text-ink-subtle"
              )}
            >
              <FileCheck className="size-3.5" />
              <span>
                DIAN: {hasDian ? `${dianKpis.totalDocs} facturas (${formatMoney(dianKpis.totalCompras)})` : "Sin cargar"}
              </span>
            </span>

            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold border",
                hasMov
                  ? "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
                  : "bg-bg-subtle border-line text-ink-subtle"
              )}
            >
              <BookOpen className="size-3.5" />
              <span>
                Libros ERP: {hasMov ? `${contabilidadKpis.totalMovs} movs (${formatMoney(contabilidadKpis.totalDebitos)})` : "Sin cargar"}
              </span>
            </span>

            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-semibold border",
                hasBank
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                  : "bg-bg-subtle border-line text-ink-subtle"
              )}
            >
              <Landmark className="size-3.5" />
              <span>
                Bancos: {hasBank ? `${bancoKpis.bancoNombre} (${bancoKpis.totalPartidas} partidas)` : "Sin extracto"}
              </span>
            </span>
          </div>
        </div>

        {/* Acciones Derecha */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-danger/30 bg-danger-bg px-3.5 text-xs font-semibold text-danger hover:bg-danger hover:text-white transition shadow-2xs cursor-pointer"
            title="Vaciar datos y reiniciar sesión"
          >
            <Trash2 className="size-3.5" />
            <span>Vaciar Sesión</span>
          </button>
        </div>
      </div>

      {/* Selector de Pestañas de Inteligencia Financiera */}
      <div className="flex items-center gap-1.5 border-b border-line pb-3 overflow-x-auto">
        {[
          { id: "resumen_360", label: "Resumen Ejecutivo 360°", icon: Scale },
          { id: "bancos", label: "Tesorería & Flujo Bancario", icon: Landmark, count: hasBank ? bancoKpis.totalPartidas : undefined },
          { id: "contabilidad", label: "Libros & Contabilidad ERP", icon: BookOpen, count: hasMov ? contabilidadKpis.totalMovs : undefined },
          { id: "dian", label: "Facturación DIAN & IVA", icon: Receipt, count: hasDian ? dianKpis.totalDocs : undefined },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer select-none whitespace-nowrap",
                isActive
                  ? "bg-teal text-white shadow-xs font-black"
                  : "bg-bg-surface text-ink-muted hover:bg-bg-subtle hover:text-ink border border-line"
              )}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-extrabold",
                    isActive ? "bg-white/20 text-white" : "bg-bg-subtle text-ink-muted"
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Si no hay datos en ninguna fuente */}
      {!hasAnyData && !isBankLoading && (
        <div className="rounded-2xl border border-line bg-bg-surface p-12 text-center shadow-xs">
          <BarChart3 className="size-14 text-ink-subtle mx-auto mb-3 opacity-50" />
          <h2 className="text-lg font-bold text-ink">Centro de Inteligencia Financiera</h2>
          <p className="text-xs text-ink-muted max-w-lg mx-auto mt-1 mb-6 leading-relaxed">
            Para visualizar las métricas y gráficos gerenciales, carga al menos una de las fuentes financieras disponibles (Facturas DIAN, Auxiliar Contable ERP o Extracto Bancario).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div
              onClick={() => onNavigate?.("dian")}
              className="rounded-xl border border-line p-4 bg-bg-subtle/50 hover:bg-teal-soft/20 hover:border-teal/40 transition cursor-pointer"
            >
              <FileCheck className="size-5 text-teal mb-2" />
              <h3 className="text-xs font-bold text-ink">1. Facturación DIAN</h3>
              <p className="text-[11px] text-ink-muted mt-1">Sube el reporte de compras DIAN para auditar IVA descontable.</p>
            </div>
            <div
              onClick={() => onNavigate?.("bancos")}
              className="rounded-xl border border-line p-4 bg-bg-subtle/50 hover:bg-amber-500/20 hover:border-amber-500/40 transition cursor-pointer"
            >
              <Landmark className="size-5 text-amber-600 mb-2" />
              <h3 className="text-xs font-bold text-ink">2. Extracto Bancario</h3>
              <p className="text-[11px] text-ink-muted mt-1">Sube PDF o Excel bancario para analizar flujo y GMF.</p>
            </div>
            <div
              onClick={() => onNavigate?.("dian")}
              className="rounded-xl border border-line p-4 bg-bg-subtle/50 hover:bg-blue-500/20 hover:border-blue-500/40 transition cursor-pointer"
            >
              <BookOpen className="size-5 text-blue-600 mb-2" />
              <h3 className="text-xs font-bold text-ink">3. Libros Auxiliares</h3>
              <p className="text-[11px] text-ink-muted mt-1">Carga el auxiliar contable para auditar partida doble y PUC.</p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 1: RESUMEN EJECUTIVO 360°                                            */}
      {/* ========================================================================= */}
      {hasAnyData && activeTab === "resumen_360" && (
        <div className="space-y-6">
          {/* 4 Hero Cards Principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Saldo Disponible en Bancos */}
            <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-ink-subtle">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Tesorería & Bancos</span>
                  <Landmark className="size-4 text-teal" />
                </div>
                <div className="mt-2 font-display text-2xl font-black text-ink tracking-tight">
                  {hasBank ? formatMoney(bancoKpis.saldoFinal) : "—"}
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {hasBank ? `Saldo disponible (${bancoKpis.bancoNombre})` : "Sin extracto bancario"}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-line/40 flex items-center justify-between text-[11px] text-ink-muted">
                <span>Entradas: +{formatMoney(bancoKpis.totalAbonos)}</span>
                <span className="text-rose-600 dark:text-rose-400 font-semibold">Salidas: -{formatMoney(bancoKpis.totalRetiros)}</span>
              </div>
            </div>

            {/* Card 2: Movimientos en Libros & Partida Doble */}
            <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-ink-subtle">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Partida Doble ERP</span>
                  <Scale className="size-4 text-blue-600" />
                </div>
                <div className="mt-2 font-display text-2xl font-black text-ink tracking-tight">
                  {hasMov ? formatMoney(contabilidadKpis.totalDebitos) : "—"}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs">
                  {hasMov ? (
                    contabilidadKpis.cuadrado ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="size-3.5" /> Partida doble cuadrada ($0,00)
                      </span>
                    ) : (
                      <span className="text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1">
                        <AlertTriangle className="size-3.5" /> Dif: {formatMoney(contabilidadKpis.diferenciaPartidaDoble)}
                      </span>
                    )
                  ) : (
                    <span className="text-ink-muted">Sin auxiliar contable</span>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-line/40 flex items-center justify-between text-[11px] text-ink-muted">
                <span>{contabilidadKpis.totalMovs} asientos en libros</span>
                <span className="font-semibold text-ink">{contabilidadKpis.totalCuentas} cuentas activas</span>
              </div>
            </div>

            {/* Card 3: Compras Facturadas DIAN */}
            <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-ink-subtle">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Facturación DIAN</span>
                  <Receipt className="size-4 text-purple-600" />
                </div>
                <div className="mt-2 font-display text-2xl font-black text-ink tracking-tight">
                  {hasDian ? formatMoney(dianKpis.totalCompras) : "—"}
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {hasDian ? `${dianKpis.totalDocs} facturas electrónicas recibidas` : "Sin facturas DIAN"}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-line/40 flex items-center justify-between text-[11px] text-ink-muted">
                <span>{dianKpis.totalProveedores} proveedores</span>
                <span className="font-semibold text-teal">{dianKpis.tasaCobertura}% causadas en libros</span>
              </div>
            </div>

            {/* Card 4: IVA Descontable Total */}
            <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-ink-subtle">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">IVA Descontable</span>
                  <Award className="size-4 text-teal" />
                </div>
                <div className="mt-2 font-display text-2xl font-black text-teal tracking-tight">
                  {hasDian ? formatMoney(dianKpis.totalIva) : "—"}
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {hasDian ? "Crédito fiscal potencial (Formulario 300)" : "Sin IVA calculado"}
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-line/40 flex items-center justify-between text-[11px] text-ink-muted">
                <span>GMF Banco: {hasBank && bankExecutive ? formatMoney(bankExecutive.gmf.total) : "$0"}</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  Rete: {hasBank && bankExecutive ? formatMoney(bankExecutive.retenciones.total) : "$0"}
                </span>
              </div>
            </div>
          </div>

          {/* Gráfico Comparativo: Triangulación Financiera */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 min-w-0 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                      <Scale className="size-4 text-teal" />
                      <span>Triangulación Financiera: DIAN vs Libros vs Tesorería</span>
                    </h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Comparativa de magnitud proporcional entre lo facturado fiscalmente, lo causado en libros y el flujo real bancario.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 py-2">
                  {dataTriangulacion.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={cn("p-1 rounded-md border", item.colorBadge)}>
                              <Icon className="size-3.5" />
                            </span>
                            <span className="font-bold text-ink">{item.name}</span>
                            <span className="text-[10px] text-ink-muted hidden sm:inline">({item.desc})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sm text-ink">
                              {formatMoney(item.monto)}
                            </span>
                            <span className="text-[10px] font-mono text-ink-muted w-10 text-right">
                              {item.pctOfMax}%
                            </span>
                          </div>
                        </div>
                        {/* Barra de Magnitud Proporcional */}
                        <div className="h-3 w-full rounded-full bg-bg-subtle overflow-hidden border border-line/60">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", item.colorBg)}
                            style={{ width: `${Math.max(item.pctOfMax, item.monto > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Insight Ejecutivo al pie */}
              <div className="mt-4 pt-3 border-t border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px] text-ink-muted">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-teal shrink-0" />
                  <span>
                    {hasDian && hasMov
                      ? `Tasa de correlación: ${dianKpis.tasaCobertura}% de compras DIAN tienen trazabilidad en libros.`
                      : "Carga las fuentes financieras para obtener correlaciones cruzadas automáticas."}
                  </span>
                </span>
                <span className="font-medium text-ink-subtle">
                  Escala normalizada al mayor valor transado
                </span>
              </div>
            </div>

            {/* Panel de Semáforos y Control de Salud Financiera */}
            <div className="lg:col-span-4 min-w-0 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-ink flex items-center gap-2 mb-1">
                  <ShieldCheck className="size-4 text-teal" />
                  <span>Control de Salud Financiera</span>
                </h3>
                <p className="text-xs text-ink-muted mb-4">
                  Estado de cuadre y cumplimiento de reglas contables y fiscales.
                </p>

                <div className="space-y-3 text-xs">
                  {/* Semáforo 1: Partida Doble */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-line bg-bg-subtle/50">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0",
                          hasMov && contabilidadKpis.cuadrado ? "bg-emerald-500" : hasMov ? "bg-amber-500" : "bg-slate-300"
                        )}
                      />
                      <div>
                        <div className="font-semibold text-ink">Partida Doble Contable</div>
                        <div className="text-[11px] text-ink-muted">
                          {hasMov
                            ? contabilidadKpis.cuadrado
                              ? "Cuadre exacto al centavo ($0,00)"
                              : `Descuadre: ${formatMoney(contabilidadKpis.diferenciaPartidaDoble)}`
                            : "Sin libros cargados"}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-ink">
                      {hasMov && contabilidadKpis.cuadrado ? "100%" : "—"}
                    </span>
                  </div>

                  {/* Semáforo 2: Conciliación Bancaria */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-line bg-bg-subtle/50">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0",
                          hasBank && bankConcilResult?.summary.cuadrado ? "bg-emerald-500" : hasBank ? "bg-amber-500" : "bg-slate-300"
                        )}
                      />
                      <div>
                        <div className="font-semibold text-ink">Conciliación Bancaria</div>
                        <div className="text-[11px] text-ink-muted">
                          {hasBank
                            ? bankConcilResult?.summary.cuadrado
                              ? "Saldo conciliado coincide con extracto"
                              : `Diferencia de cuadre: ${formatMoney(bankConcilResult?.summary.diferenciaCuadre || 0)}`
                            : "Sin extracto cargado"}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-ink">
                      {hasBank && bankConcilResult ? `${bankConcilResult.summary.totalConciliados}/${bankConcilResult.summary.totalItemsBanco}` : "—"}
                    </span>
                  </div>

                  {/* Semáforo 3: Cobertura DIAN */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl border border-line bg-bg-subtle/50">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0",
                          hasDian && Number(dianKpis.tasaCobertura) >= 80 ? "bg-emerald-500" : hasDian ? "bg-amber-500" : "bg-slate-300"
                        )}
                      />
                      <div>
                        <div className="font-semibold text-ink">Cobertura Fiscal DIAN</div>
                        <div className="text-[11px] text-ink-muted">
                          {hasDian ? `${dianKpis.conciliadasCount} de ${dianKpis.totalDocs} facturas causadas` : "Sin facturas DIAN"}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono font-bold text-ink">
                      {hasDian ? `${dianKpis.tasaCobertura}%` : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-line text-[11px] text-ink-muted">
                Para profundizar en cualquiera de las 3 áreas, utiliza las pestañas superiores.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: TESORERÍA, BANCOS & FLUJO DE CAJA                                */}
      {/* ========================================================================= */}
      {activeTab === "bancos" && (
        <div className="space-y-6">
          {!hasBank ? (
            <div className="rounded-2xl border border-line bg-bg-surface p-8 text-center shadow-xs">
              <Landmark className="size-12 text-ink-subtle mx-auto mb-2 opacity-50" />
              <h3 className="font-bold text-base text-ink">No hay extracto bancario cargado en esta sesión</h3>
              <p className="text-xs text-ink-muted max-w-md mx-auto mt-1 mb-4">
                Sube tu extracto en PDF o Excel en la pestaña de Bancos para desbloquear las métricas de tesorería, GMF, comisiones y flujo de efectivo.
              </p>
              <button
                type="button"
                onClick={() => onNavigate?.("bancos")}
                className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-deep transition cursor-pointer"
              >
                <Landmark className="size-4" />
                <span>Ir al Módulo de Bancos</span>
              </button>
            </div>
          ) : (
            <>
              {/* Tarjetas de Tesorería */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Saldo Inicial Extracto</span>
                  <div className="mt-2 font-display text-2xl font-black text-ink tracking-tight">
                    {formatMoney(bancoKpis.saldoInicial)}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">Al corte inicial del periodo</p>
                </div>

                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total Abonos (Entradas)</span>
                  <div className="mt-2 font-display text-2xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
                    +{formatMoney(bancoKpis.totalAbonos)}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">Depósitos, transferencias y rendimientos</p>
                </div>

                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Total Retiros (Salidas)</span>
                  <div className="mt-2 font-display text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                    -{formatMoney(bancoKpis.totalRetiros)}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">Pagos a proveedores, ACH, GMF y retenciones</p>
                </div>

                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Saldo Final Extracto</span>
                  <div className="mt-2 font-display text-2xl font-black text-ink tracking-tight">
                    {formatMoney(bancoKpis.saldoFinal)}
                  </div>
                  <div className="mt-1 text-xs flex items-center gap-1 font-semibold">
                    {bancoKpis.flujoNeto >= 0 ? (
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
                        <ArrowUpRight className="size-3.5" /> Variación neta: +{formatMoney(bancoKpis.flujoNeto)}
                      </span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400 flex items-center gap-0.5">
                        <ArrowDownRight className="size-3.5" /> Variación neta: {formatMoney(bancoKpis.flujoNeto)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Fricciones Bancarias e Impuestos (GMF, Comisiones, Rendimientos, Retenciones) */}
              {bankExecutive && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="rounded-xl border border-line bg-bg-surface p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">GMF (4×1000)</span>
                    <div className="font-mono text-lg font-black text-ink mt-1">
                      {formatMoney(bankExecutive.gmf.total)}
                    </div>
                    <span className="text-[10px] text-ink-muted block mt-0.5">
                      {bankExecutive.gmf.count} cargos · {bankExecutive.gmf.pendiente === 0 ? "✓ Contabilizado" : "⚠️ Pendiente"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-line bg-bg-surface p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Comisiones Banco</span>
                    <div className="font-mono text-lg font-black text-ink mt-1">
                      {formatMoney(bankExecutive.comisiones.total)}
                    </div>
                    <span className="text-[10px] text-ink-muted block mt-0.5">
                      {bankExecutive.comisiones.count} cargos y tarifas
                    </span>
                  </div>

                  <div className="rounded-xl border border-line bg-bg-surface p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-teal uppercase tracking-wider">Rendimientos (+)</span>
                    <div className="font-mono text-lg font-black text-teal mt-1">
                      +{formatMoney(bankExecutive.rendimientos.total)}
                    </div>
                    <span className="text-[10px] text-ink-muted block mt-0.5">
                      {bankExecutive.rendimientos.pendiente > 0 ? "⚠️ Pendiente de causar" : "✓ Contabilizado"}
                    </span>
                  </div>

                  <div className="rounded-xl border border-line bg-bg-surface p-3.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Retención en Fuente (-)</span>
                    <div className="font-mono text-lg font-black text-rose-600 mt-1">
                      -{formatMoney(bankExecutive.retenciones.total)}
                    </div>
                    <span className="text-[10px] text-ink-muted block mt-0.5">
                      {bankExecutive.retenciones.count} retenciones deducidas
                    </span>
                  </div>
                </div>
              )}

              {/* Gráfico de Flujo Diario Bancario */}
              <div className="rounded-2xl border border-line bg-bg-surface p-5 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-sm text-ink flex items-center gap-2">
                      <TrendingUp className="size-4 text-teal" />
                      <span>Evolución Diaria de Entradas y Salidas en el Banco</span>
                    </h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Cronología de movimientos débitos y créditos en el extracto de {bancoKpis.bancoNombre}.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <span className="size-2.5 rounded-full bg-emerald-600" /> Abonos (Entradas)
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-600">
                      <span className="size-2.5 rounded-full bg-rose-600" /> Retiros (Salidas)
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={250} minWidth={0} debounce={50}>
                    <BarChart data={dataFlujoBancarioDiario} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis dataKey="fechaCorta" tick={{ fontSize: 11, fill: "var(--color-ink-subtle)" }} />
                      <YAxis
                        tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`}
                        tick={{ fontSize: 11, fill: "var(--color-ink-subtle)" }}
                      />
                      <Tooltip
                        formatter={(val: number, name: string) => [
                          formatMoney(val),
                          name === "abonos" ? "Abonos / Entradas" : "Retiros / Salidas",
                        ]}
                        labelFormatter={(label) => `Fecha: ${label}`}
                        contentStyle={{
                          backgroundColor: "var(--color-bg-elevated)",
                          borderColor: "var(--color-line)",
                          borderRadius: "10px",
                          fontSize: "12px",
                          color: "var(--color-ink)",
                        }}
                      />
                      <Bar dataKey="abonos" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      <Bar dataKey="retiros" fill="#f43f5e" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Operaciones Bancarias de Mayor Valor */}
              <div className="rounded-2xl border border-line bg-bg-surface p-5 shadow-xs">
                <h3 className="font-bold text-sm text-ink mb-3">Movimientos de Mayor Cuantía en Extracto</h3>
                <div className="divide-y divide-line/60 rounded-xl border border-line overflow-hidden">
                  {dataTopMovimientosBancarios.map((it) => (
                    <div key={it.id} className="p-3 text-xs flex items-center justify-between bg-bg-surface hover:bg-bg-subtle/50 transition">
                      <div>
                        <div className="font-bold text-ink">{it.descripcion}</div>
                        <div className="text-[11px] text-ink-muted flex items-center gap-2 mt-0.5">
                          <span>Fecha: {formatDate(it.fecha)}</span>
                          <span>Ref: {it.referencia || "—"}</span>
                        </div>
                      </div>
                      <div className="font-mono font-black text-sm text-right">
                        {it.credito > 0 ? (
                          <span className="text-emerald-700 dark:text-emerald-400">+{formatMoney(it.credito)}</span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400">-{formatMoney(it.debito)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: LIBROS & CONTABILIDAD ERP                                        */}
      {/* ========================================================================= */}
      {activeTab === "contabilidad" && (
        <div className="space-y-6">
          {!hasMov ? (
            <div className="rounded-2xl border border-line bg-bg-surface p-8 text-center shadow-xs">
              <BookOpen className="size-12 text-ink-subtle mx-auto mb-2 opacity-50" />
              <h3 className="font-bold text-base text-ink">No hay movimientos contables cargados</h3>
              <p className="text-xs text-ink-muted max-w-md mx-auto mt-1 mb-4">
                Carga tu archivo Excel auxiliar contable (exportado de Siigo, World Office, Helisa, Alegra, SAP, etc.) para ver el análisis de partida doble y PUC.
              </p>
              <button
                type="button"
                onClick={() => onNavigate?.("dian")}
                className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-deep transition cursor-pointer"
              >
                <BookOpen className="size-4" />
                <span>Cargar Auxiliar Contable</span>
              </button>
            </div>
          ) : (
            <>
              {/* Tarjetas de Contabilidad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Total Débitos en Libros</span>
                  <div className="mt-2 font-display text-2xl font-black text-ink tracking-tight">
                    {formatMoney(contabilidadKpis.totalDebitos)}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">Suma total de cargos débito</p>
                </div>

                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Total Créditos en Libros</span>
                  <div className="mt-2 font-display text-2xl font-black text-ink tracking-tight">
                    {formatMoney(contabilidadKpis.totalCreditos)}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">Suma total de abonos crédito</p>
                </div>

                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Estado de Partida Doble</span>
                  <div className="mt-2 font-display text-2xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
                    {contabilidadKpis.cuadrado ? "$0,00" : formatMoney(contabilidadKpis.diferenciaPartidaDoble)}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {contabilidadKpis.cuadrado ? "✓ Asientos cuadrados al centavo" : "⚠️ Diferencia en el auxiliar"}
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Dimensión del Auxiliar</span>
                  <div className="mt-2 font-display text-2xl font-black text-ink tracking-tight">
                    {contabilidadKpis.totalMovs}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {contabilidadKpis.totalTerceros} terceros en {contabilidadKpis.totalCuentas} cuentas contables
                  </p>
                </div>
              </div>

              {/* Gráficos de Clases PUC y Tipos de Comprobante */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Gráfico: Distribución por Clases del PUC */}
                <div className="lg:col-span-7 min-w-0 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs">
                  <h3 className="font-bold text-sm text-ink mb-1">Distribución de Movimiento por Clases PUC</h3>
                  <p className="text-xs text-ink-muted mb-4">
                    Volumen transaccional (Débitos + Créditos) clasificado por la clase del plan de cuentas.
                  </p>
                  <div className="h-64 w-full min-w-0 overflow-hidden">
                    <ResponsiveContainer width="100%" height={250} minWidth={0} debounce={50}>
                      <BarChart data={dataClasesPuc} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="clase" tick={{ fontSize: 11, fill: "var(--color-ink)" }} />
                        <YAxis
                          tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`}
                          tick={{ fontSize: 11, fill: "var(--color-ink-subtle)" }}
                        />
                        <Tooltip
                          formatter={(val: number) => [formatMoney(val), "Monto Total"]}
                          labelFormatter={(clase) => `Clase PUC: ${clase}`}
                          contentStyle={{
                            backgroundColor: "var(--color-bg-elevated)",
                            borderColor: "var(--color-line)",
                            borderRadius: "10px",
                            fontSize: "12px",
                            color: "var(--color-ink)",
                          }}
                        />
                        <Bar dataKey="totalMovimiento" fill="#0f766e" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-line text-[11px] text-ink-muted">
                    {dataClasesPuc.map((c) => (
                      <div key={c.clase} className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="truncate">{c.label}: <strong>{c.count}</strong></span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Donut: Comprobantes Contables */}
                <div className="lg:col-span-5 min-w-0 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-ink mb-1">Tipos de Comprobante Contable</h3>
                    <p className="text-xs text-ink-muted mb-2">
                      Proporción de asientos por tipo de documento contable.
                    </p>
                    <div className="h-56 w-full min-w-0 overflow-hidden">
                      <ResponsiveContainer width="100%" height={220} minWidth={0} debounce={50}>
                        <PieChart>
                          <Pie
                            data={dataComprobantesTipos}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="total"
                            isAnimationActive={false}
                          >
                            {dataComprobantesTipos.map((_, idx) => (
                              <Cell key={`cell-${idx}`} fill={COLORS_PIE[idx % COLORS_PIE.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val: number) => [formatMoney(val), "Valor Total"]}
                            contentStyle={{
                              backgroundColor: "var(--color-bg-elevated)",
                              borderColor: "var(--color-line)",
                              borderRadius: "10px",
                              fontSize: "12px",
                              color: "var(--color-ink)",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="space-y-1 pt-2 border-t border-line text-xs">
                    {dataComprobantesTipos.map((item, idx) => (
                      <div key={item.tipo} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS_PIE[idx % COLORS_PIE.length] }} />
                          <span className="text-ink truncate">{item.name}</span>
                        </div>
                        <span className="font-mono text-ink-muted text-[11px] shrink-0">{item.count} movs</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top 10 Terceros Contables */}
              <div className="rounded-2xl border border-line bg-bg-surface p-5 shadow-xs min-w-0">
                <h3 className="font-bold text-sm text-ink mb-1">Top 10 Terceros por Volumen Contable</h3>
                <p className="text-xs text-ink-muted mb-4">
                  Proveedores, entidades financieras y terceros con mayor movimiento en el auxiliar contable.
                </p>
                <div className="h-72 w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={280} minWidth={0} debounce={50}>
                    <BarChart data={dataTopTercerosContables} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                      <XAxis
                        type="number"
                        tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`}
                        tick={{ fontSize: 11, fill: "var(--color-ink-subtle)" }}
                      />
                      <YAxis type="category" dataKey="shortName" tick={{ fontSize: 10, fill: "var(--color-ink)" }} width={120} />
                      <Tooltip
                        formatter={(val: number) => [formatMoney(val), "Volumen Total"]}
                        contentStyle={{
                          backgroundColor: "var(--color-bg-elevated)",
                          borderColor: "var(--color-line)",
                          borderRadius: "10px",
                          fontSize: "12px",
                          color: "var(--color-ink)",
                        }}
                      />
                      <Bar dataKey="volumenTotal" fill="#0f766e" radius={[0, 6, 6, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 4: FACTURACIÓN DIAN & IVA                                           */}
      {/* ========================================================================= */}
      {activeTab === "dian" && (
        <div className="space-y-6">
          {!hasDian ? (
            <div className="rounded-2xl border border-line bg-bg-surface p-8 text-center shadow-xs">
              <Receipt className="size-12 text-ink-subtle mx-auto mb-2 opacity-50" />
              <h3 className="font-bold text-base text-ink">No hay facturas DIAN cargadas</h3>
              <p className="text-xs text-ink-muted max-w-md mx-auto mt-1 mb-4">
                Sube el archivo Excel exportado de la DIAN para calcular el IVA descontable, las tarifas y la concentración de proveedores.
              </p>
              <button
                type="button"
                onClick={() => onNavigate?.("dian")}
                className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-deep transition cursor-pointer"
              >
                <FileCheck className="size-4" />
                <span>Cargar Archivo DIAN</span>
              </button>
            </div>
          ) : (
            <>
              {/* Grid de 4 KPIs DIAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <div className="flex items-center justify-between text-ink-subtle">
                    <span className="text-xs font-semibold uppercase tracking-wider">Compras Totales DIAN</span>
                    <DollarSign className="size-4 text-teal" />
                  </div>
                  <div className="mt-2 font-display text-2xl font-bold text-ink tracking-tight">
                    {formatMoney(dianKpis.totalCompras)}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {dianKpis.totalDocs} facturas electrónicas recibidas
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <div className="flex items-center justify-between text-ink-subtle">
                    <span className="text-xs font-semibold uppercase tracking-wider">IVA Descontable Total</span>
                    <Receipt className="size-4 text-blue-600" />
                  </div>
                  <div className="mt-2 font-display text-2xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">
                    {formatMoney(dianKpis.totalIva)}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Crédito fiscal potencial para Formulario 300
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <div className="flex items-center justify-between text-ink-subtle">
                    <span className="text-xs font-semibold uppercase tracking-wider">Proveedores Activos</span>
                    <Building className="size-4 text-amber-500" />
                  </div>
                  <div className="mt-2 font-display text-2xl font-bold text-ink tracking-tight">
                    {dianKpis.totalProveedores}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    Ticket promedio: {formatMoney(dianKpis.ticketPromedio)}
                  </p>
                </div>

                <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
                  <div className="flex items-center justify-between text-ink-subtle">
                    <span className="text-xs font-semibold uppercase tracking-wider">Tasa de Cobertura</span>
                    <Award className="size-4 text-purple-600" />
                  </div>
                  <div className="mt-2 font-display text-2xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">
                    {dianKpis.tasaCobertura}%
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {dianKpis.conciliadasCount} facturas causadas en libros
                  </p>
                </div>
              </div>

              {/* Gráficos de Tarifas de IVA y Top Proveedores */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 min-w-0 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                      <PieIcon className="size-4 text-teal" />
                      <span>Compras por Tarifa de IVA</span>
                    </h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Proporción de compras gravadas al 19%, 5% y exentas/excluidas.
                    </p>
                    <div className="h-64 w-full my-3 min-w-0 overflow-hidden">
                      <ResponsiveContainer width="100%" height={250} minWidth={0} debounce={50}>
                        <PieChart>
                          <Pie
                            data={dataTarifasIva}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={88}
                            paddingAngle={3}
                            dataKey="value"
                            isAnimationActive={false}
                          >
                            {dataTarifasIva.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val: number) => [formatMoney(val), "Monto Total"]}
                            contentStyle={{
                              backgroundColor: "var(--color-bg-elevated)",
                              borderColor: "var(--color-line)",
                              borderRadius: "10px",
                              fontSize: "12px",
                              color: "var(--color-ink)",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line text-xs">
                    {dataTarifasIva.map((item, idx) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span className="size-3 rounded-full shrink-0" style={{ backgroundColor: COLORS_PIE[idx % COLORS_PIE.length] }} />
                        <div className="truncate">
                          <span className="font-medium text-ink block truncate">{item.name}</span>
                          <span className="text-[11px] text-ink-muted">{item.pct}% ({item.count} docs)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="lg:col-span-7 min-w-0 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                      <BarChart3 className="size-4 text-teal" />
                      <span>Top 10 Proveedores por Facturación DIAN</span>
                    </h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Terceros con mayor volumen facturado en el período analizado.
                    </p>
                    <div className="h-72 w-full my-3 min-w-0 overflow-hidden">
                      <ResponsiveContainer width="100%" height={280} minWidth={0} debounce={50}>
                        <BarChart data={dataTopProveedoresDian} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                          <XAxis
                            type="number"
                            tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`}
                            tick={{ fontSize: 11, fill: "var(--color-ink-subtle)" }}
                          />
                          <YAxis type="category" dataKey="shortName" tick={{ fontSize: 10, fill: "var(--color-ink)" }} width={120} />
                          <Tooltip
                            formatter={(val: number) => [formatMoney(val), "Total Compra"]}
                            labelFormatter={(name) => `Proveedor: ${name}`}
                            contentStyle={{
                              backgroundColor: "var(--color-bg-elevated)",
                              borderColor: "var(--color-line)",
                              borderRadius: "10px",
                              fontSize: "12px",
                              color: "var(--color-ink)",
                            }}
                          />
                          <Bar dataKey="total" fill="#0f766e" radius={[0, 6, 6, 0]} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="text-[11px] text-ink-muted flex items-center justify-between pt-2 border-t border-line">
                    <span>Ranking ordenado por valor bruto total.</span>
                    <span className="font-semibold text-teal">{dataTopProveedoresDian.length} proveedores</span>
                  </div>
                </div>
              </div>

              {/* Tendencia Diaria de Compras e IVA */}
              <div className="rounded-2xl border border-line bg-bg-surface p-5 shadow-xs min-w-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="font-semibold text-sm text-ink flex items-center gap-2">
                      <TrendingUp className="size-4 text-teal" />
                      <span>Evolución Diaria de Compras e IVA Descontable Acumulado</span>
                    </h3>
                    <p className="text-xs text-ink-muted mt-0.5">
                      Ritmo de compras diarias y acumulación progresiva del IVA descontable.
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    <span className="flex items-center gap-1.5 text-teal">
                      <span className="size-2.5 rounded-full bg-teal" /> Compras Diarias
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-600">
                      <span className="size-2.5 rounded-full bg-blue-600" /> IVA Acumulado
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height={250} minWidth={0} debounce={50}>
                    <AreaChart data={dataTendenciaDian} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorIva" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                      <XAxis dataKey="fechaCorta" tick={{ fontSize: 11, fill: "var(--color-ink-subtle)" }} />
                      <YAxis
                        tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`}
                        tick={{ fontSize: 11, fill: "var(--color-ink-subtle)" }}
                      />
                      <Tooltip
                        formatter={(val: number, name: string) => [
                          formatMoney(val),
                          name === "total" ? "Compra del Día" : "IVA Acumulado",
                        ]}
                        labelFormatter={(label) => `Fecha: ${label}`}
                        contentStyle={{
                          backgroundColor: "var(--color-bg-elevated)",
                          borderColor: "var(--color-line)",
                          borderRadius: "10px",
                          fontSize: "12px",
                          color: "var(--color-ink)",
                        }}
                      />
                      <Area type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" isAnimationActive={false} />
                      <Area type="monotone" dataKey="ivaAcumulado" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorIva)" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
