import { ShieldAlert, Clock, AlertTriangle, Copy, Scale, CheckCircle2, FileSpreadsheet, ArrowLeftRight } from "lucide-react";
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
    ...(t.crucesNc > 0
      ? [
          {
            label: "Cruces NC",
            value: String(t.crucesNc),
            hint: `${formatMoney(t.valorCrucesNc || 0)} compensado`,
            icon: ArrowLeftRight,
            highlight: true,
            tab: "cruce_nc" as TabId,
          },
        ]
      : []),
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
        items.length >= 8
          ? "sm:grid-cols-3 lg:grid-cols-8"
          : items.length === 7
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
              "group relative flex flex-col justify-between rounded-2xl border-2 p-3.5 sm:p-4 text-left transition-all duration-200 cursor-pointer overflow-hidden shadow-xs",
              isActive
                ? "border-teal bg-teal-soft/40 shadow-sm ring-2 ring-teal/30 -translate-y-0.5"
                : k.alert
                  ? "border-danger/40 bg-bg-surface hover:border-danger hover:bg-danger-bg/40 hover:-translate-y-0.5 hover:shadow-sm"
                  : k.highlight
                    ? "border-teal/30 bg-teal-soft/20 hover:border-teal hover:bg-teal-soft/30 hover:-translate-y-0.5 hover:shadow-sm"
                    : "border-line bg-bg-surface hover:border-teal/50 hover:bg-teal-soft/20 hover:-translate-y-0.5 hover:shadow-sm",
            )}
          >
            {/* Header del KPI con Icono y Alerta */}
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-ink-muted group-hover:text-ink transition-colors">
                {k.label}
              </span>
              <div className="relative">
                {k.alert && (
                  <span className="absolute -top-0.5 -right-0.5 flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-danger" />
                  </span>
                )}
                <Icon
                  className={cn(
                    "size-4 transition-colors",
                    isActive
                      ? "text-teal"
                      : k.alert
                        ? "text-danger"
                        : k.highlight
                          ? "text-teal"
                          : "text-ink-subtle group-hover:text-ink-muted",
                  )}
                />
              </div>
            </div>

            {/* Valor Principal */}
            <div
              className={cn(
                "mt-2 font-display text-2xl sm:text-3xl font-black tabular-nums tracking-tight",
                isActive
                  ? "text-teal-deep dark:text-teal"
                  : k.alert
                    ? "text-danger"
                    : "text-ink",
              )}
            >
              {k.value}
            </div>

            {/* Mini Barra de Progreso en Recibidos OK */}
            {k.tab === "conciliado" && (
              <div className="mt-1.5 w-full bg-line rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-ok h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, Math.max(0, t.pctRecibidos))}%` }}
                />
              </div>
            )}

            {/* Subtítulo / Monto */}
            <div
              className="mt-1 text-xs font-semibold text-ink-muted truncate"
              title={k.hint}
            >
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
