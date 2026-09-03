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
              "group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer overflow-hidden",
              isActive
                ? "border-teal bg-teal-soft/20 shadow-sm ring-2 ring-teal/30 -translate-y-0.5"
                : k.alert
                  ? "border-danger/30 bg-bg-elevated hover:border-danger/60 hover:bg-danger-bg/20 hover:-translate-y-0.5 hover:shadow-xs"
                  : "border-line bg-bg-elevated hover:border-teal/40 hover:bg-bg-subtle/40 hover:-translate-y-0.5 hover:shadow-xs",
            )}
          >
            {/* Header del KPI con Icono */}
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle group-hover:text-ink-muted transition-colors">
                {k.label}
              </span>
              <Icon
                className={cn(
                  "size-3.5 transition-colors",
                  isActive
                    ? "text-teal"
                    : k.alert
                      ? "text-danger"
                      : "text-ink-subtle group-hover:text-ink-muted",
                )}
              />
            </div>

            {/* Valor Principal */}
            <div
              className={cn(
                "mt-2 font-display text-2xl font-bold tabular-nums tracking-tight",
                isActive
                  ? "text-teal-deep"
                  : k.alert
                    ? "text-danger"
                    : "text-ink",
              )}
            >
              {k.value}
            </div>

            {/* Subtítulo / Monto */}
            <div className="mt-1 text-xs text-ink-muted truncate" title={k.hint}>
              {k.hint}
            </div>

            {/* Active Glow Accent Bar */}
            {isActive && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-teal" />
            )}
          </button>
        );
      })}
    </div>
  );
}
