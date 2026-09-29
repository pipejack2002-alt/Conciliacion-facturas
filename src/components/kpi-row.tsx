import { ShieldAlert, Clock, AlertTriangle, Copy, Scale, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { formatMoney, formatPct } from "@/lib/format";
import type { ConciliacionResult } from "@/lib/types";
import { cn } from "@/lib/cn";
import type { TabId } from "@/lib/store";

export function KpiRow({
  result,
  currentTab,
  onSelectTab,
}: {
  result: ConciliacionResult;
  currentTab?: TabId;
  onSelectTab: (t: TabId) => void;
}) {
  const t = result.totals;
  const typoCount = result.rows.filter((r) => r.estado === "posible_typo").length;

  const items: {
    label: string;
    value: string;
    hint: string;
    icon: typeof ShieldAlert;
    alert?: boolean;
    highlight?: boolean;
    tab: TabId;
  }[] = [
    {
      label: "A revisar",
      value: String(t.cola),
      hint: t.cola === 0 ? "Sin pendientes" : formatMoney(t.valorCola),
      icon: ShieldAlert,
      alert: t.cola > 0,
      tab: "cola",
    },
    {
      label: "Por registrar",
      value: String(t.pendientesRecibidos),
      hint: formatMoney(t.valorPendienteRecibido),
      icon: Clock,
      alert: t.pendientesRecibidos > 0,
      tab: "pendiente",
    },
    ...(typoCount > 0
      ? [
          {
            label: "Revisar factura",
            value: String(typoCount),
            hint: "Posible error al digitar N°",
            icon: AlertTriangle,
            alert: true,
            tab: "posible_typo" as TabId,
          },
        ]
      : []),
    ...(t.totalizados > 0
      ? [
          {
            label: "Totalizados",
            value: String(t.totalizados),
            hint: `${formatMoney(t.valorTotalizado)} agrupado`,
            icon: FileSpreadsheet,
            highlight: true,
            tab: "totalizado" as TabId,
          },
        ]
      : []),
    {
      label: "Doble registro",
      value: String(t.duplicados),
      hint: t.duplicados === 0 ? "0 duplicados" : "2+ comprobantes",
      icon: Copy,
      alert: t.duplicados > 0,
      tab: "duplicado",
    },
    {
      label: "Diferencias",
      value: String(t.diferencias),
      hint: t.diferencias === 0 ? "$0 diferencia" : formatMoney(t.valorDiferencia),
      icon: Scale,
      alert: t.diferencias > 0,
      tab: "diferencia",
    },
    {
      label: "Recibidos OK",
      value: formatPct(t.pctRecibidos),
      hint: `${t.recibidos} compras · ${t.crucesNc} cruces`,
      icon: CheckCircle2,
      tab: "conciliado",
    },
  ];

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        items.length >= 7
          ? "sm:grid-cols-3 lg:grid-cols-7"
          : items.length === 6
            ? "sm:grid-cols-3 lg:grid-cols-6"
            : "sm:grid-cols-3 lg:grid-cols-5",
      )}
    >
      {items.map((k) => {
        const Icon = k.icon;
        const isActive = currentTab === k.tab;

        return (
          <button
            key={k.label}
            type="button"
            onClick={() => onSelectTab(k.tab)}
            className={cn(
              "group relative flex flex-col justify-between rounded-2xl border-2 p-4 text-left transition-all duration-200 cursor-pointer overflow-hidden shadow-xs",
              isActive
                ? "border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 shadow-sm ring-2 ring-teal-500/30 -translate-y-0.5"
                : k.alert
                  ? "border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 hover:border-red-500 hover:bg-red-50/30 dark:hover:bg-red-950/20 hover:-translate-y-0.5 hover:shadow-sm"
                  : "border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-teal-500/70 hover:bg-teal-50/20 dark:hover:bg-teal-950/20 hover:-translate-y-0.5 hover:shadow-sm",
            )}
          >
            {/* Header del KPI con Icono */}
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 group-hover:text-slate-950 dark:group-hover:text-white transition-colors">
                {k.label}
              </span>
              <Icon
                className={cn(
                  "size-4 transition-colors",
                  isActive
                    ? "text-teal"
                    : k.alert
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200",
                )}
              />
            </div>

            {/* Valor Principal */}
            <div
              className={cn(
                "mt-2 font-display text-2xl sm:text-3xl font-black tabular-nums tracking-tight",
                isActive
                  ? "text-teal-950 dark:text-teal-300"
                  : k.alert
                    ? "text-red-700 dark:text-red-400"
                    : "text-slate-950 dark:text-white",
              )}
            >
              {k.value}
            </div>

            {/* Subtítulo / Monto */}
            <div className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400 truncate" title={k.hint}>
              {k.hint}
            </div>

            {/* Active Glow Accent Bar */}
            {isActive && (
              <span className="absolute inset-x-0 bottom-0 h-1 bg-teal" />
            )}
          </button>
        );
      })}
    </div>
  );
}
