import { useMemo } from "react";
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
} from "recharts";
import {
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
  Building,
  DollarSign,
  Receipt,
  Award,
  Trash2,
} from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { ConciliacionResult } from "@/lib/types";
import { useConciliacion } from "@/lib/store";

const COLORS_PIE = ["#0f766e", "#3b82f6", "#64748b", "#f59e0b", "#8b5cf6"];

export function DashboardBi({ result }: { result: ConciliacionResult }) {
  const reset = useConciliacion((s) => s.reset);
  
  // 1. Filtrar filas relevantes de compras recibidas
  const comprasRows = useMemo(() => {
    return result.rows.filter(
      (r) => r.grupo === "Recibido" && r.totalDian > 0 && r.estado !== "no_aplica"
    );
  }, [result.rows]);

  // 2. Desglose de Tarifas de IVA (19%, 5%, 0% Exentas/Excluidas)
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

  // 3. Top 10 Proveedores por volumen de compras
  const dataTopProveedores = useMemo(() => {
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

    const arr = Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((item) => ({
        ...item,
        shortName: item.nombre.length > 18 ? item.nombre.slice(0, 16) + "…" : item.nombre,
      }));

    return arr;
  }, [comprasRows]);

  // 4. Tendencia Cronológica (Compras por fecha e IVA Acumulado)
  const dataTendencia = useMemo(() => {
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
        totalFormatted: formatMoney(d.total),
        ivaFormatted: formatMoney(d.iva),
        fechaCorta: d.fecha.slice(5), // MM-DD
      };
    });
  }, [comprasRows]);

  // 5. KPIs Gerenciales
  const kpis = useMemo(() => {
    const totalCompras = comprasRows.reduce((acc, r) => acc + r.totalDian, 0);
    const totalIva = comprasRows.reduce((acc, r) => acc + (r.iva || 0), 0);
    const totalProveedores = new Set(comprasRows.map((r) => r.nitContraparte)).size;
    const ticketPromedio = comprasRows.length > 0 ? totalCompras / comprasRows.length : 0;
    const top3Monto = dataTopProveedores.slice(0, 3).reduce((acc, p) => acc + p.total, 0);
    const concentracionTop3 = totalCompras > 0 ? ((top3Monto / totalCompras) * 100).toFixed(1) : "0";

    return {
      totalCompras,
      totalIva,
      totalProveedores,
      ticketPromedio,
      concentracionTop3,
      totalDocs: comprasRows.length,
    };
  }, [comprasRows, dataTopProveedores]);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-2 sm:px-6 lg:px-8 animate-in fade-in duration-200">
      {/* Banner Superior Ejecutivo */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-bg-surface via-bg-surface to-teal-soft/20 p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-teal p-1.5 text-white shadow-xs">
              <BarChart3 className="size-5" />
            </span>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-ink">
              Dashboard de Inteligencia Financiera e IVA
            </h1>
            <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-bold text-teal">
              BI Ejecutivo
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Análisis volumétrico de facturación electrónica, concentración de proveedores y control de IVA descontable.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-danger/30 bg-danger-bg px-3.5 text-xs font-semibold text-danger hover:bg-danger hover:text-white transition shadow-2xs cursor-pointer"
            title="Vaciar datos y volver a cargar archivos"
          >
            <Trash2 className="size-3.5" />
            <span>Vaciar Datos</span>
          </button>
        </div>
      </div>

      {/* Grid de 4 KPIs Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-ink-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">Compras Totales DIAN</span>
            <DollarSign className="size-4 text-teal" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-ink tracking-tight">
            {formatMoney(kpis.totalCompras)}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            {kpis.totalDocs} facturas electrónicas recibidas
          </p>
        </div>

        <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-ink-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">IVA Descontable Total</span>
            <Receipt className="size-4 text-blue-600" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-blue-600 dark:text-blue-400 tracking-tight">
            {formatMoney(kpis.totalIva)}
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
            {kpis.totalProveedores}
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Ticket promedio: {formatMoney(kpis.ticketPromedio)}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-ink-subtle">
            <span className="text-xs font-semibold uppercase tracking-wider">Concentración Top 3</span>
            <Award className="size-4 text-purple-600" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-purple-600 dark:text-purple-400 tracking-tight">
            {kpis.concentracionTop3}%
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Del volumen total en los 3 mayores proveedores
          </p>
        </div>
      </div>

      {/* Fila Central de Gráficos: Donut de Tarifas + Barras Top 10 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gráfico 1: Pastel de Compras por Tarifa de IVA */}
        <div className="lg:col-span-5 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PieIcon className="size-4 text-teal" />
                <h3 className="font-semibold text-sm text-ink">Compras por Tarifa de IVA</h3>
              </div>
              <span className="text-[11px] text-ink-subtle">Bases gravables</span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Proporción de compras gravadas al 19%, 5% y exentas/excluidas.
            </p>
          </div>

          <div className="h-64 w-full my-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataTarifasIva}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="value"
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

          {/* Leyenda personalizada */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-line text-xs">
            {dataTarifasIva.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: COLORS_PIE[idx % COLORS_PIE.length] }}
                />
                <div className="truncate">
                  <span className="font-medium text-ink block truncate">{item.name}</span>
                  <span className="text-[11px] text-ink-muted">
                    {item.pct}% ({item.count} docs)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gráfico 2: Top 10 Proveedores por Facturación */}
        <div className="lg:col-span-7 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-teal" />
                <h3 className="font-semibold text-sm text-ink">Top 10 Proveedores por Volumen de Compra</h3>
              </div>
              <span className="text-[11px] text-ink-subtle">Total facturado</span>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Terceros con mayor impacto financiero en el período analizado.
            </p>
          </div>

          <div className="h-72 w-full my-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dataTopProveedores}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis
                  type="number"
                  tickFormatter={(val) => `$${(val / 1000000).toFixed(0)}M`}
                  tick={{ fontSize: 11, fill: "var(--color-ink-subtle)" }}
                />
                <YAxis
                  type="category"
                  dataKey="shortName"
                  tick={{ fontSize: 10, fill: "var(--color-ink)" }}
                  width={110}
                />
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
                <Bar dataKey="total" fill="#0f766e" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-[11px] text-ink-muted flex items-center justify-between pt-2 border-t border-line">
            <span>Pasa el cursor sobre cada barra para ver NIT y facturas emitidas.</span>
            <span className="font-semibold text-teal">{dataTopProveedores.length} proveedores en el ranking</span>
          </div>
        </div>
      </div>

      {/* Gráfico 3: Tendencia Cronológica de Compras e IVA Descontable */}
      <div className="rounded-2xl border border-line bg-bg-surface p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-teal" />
              <h3 className="font-semibold text-sm text-ink">Evolución Diaria de Compras e IVA Descontable Acumulado</h3>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              Ritmo de compras diarias y acumulación progresiva del IVA descontable en el período.
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

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dataTendencia} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
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
              <Area type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" />
              <Area type="monotone" dataKey="ivaAcumulado" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorIva)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
