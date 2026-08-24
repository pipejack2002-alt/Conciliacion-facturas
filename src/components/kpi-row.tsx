import { formatMoney, formatPct } from "@/lib/format";
import type { ConciliacionResult } from "@/lib/types";
import { cn } from "@/lib/cn";
import type { TabId } from "@/lib/store";

export function KpiRow({
  result,
  onSelectTab,
}: {
  result: ConciliacionResult;
  onSelectTab: (t: TabId) => void;
}) {
  const t = result.totals;
  const typoCount = result.rows.filter((r) => r.estado === "posible_typo").length;
  const items: { label: string; value: string; hint: string; alert?: boolean; highlight?: boolean; tab: TabId }[] = [
    {
      label: "A revisar",
      value: String(t.cola),
      hint: formatMoney(t.valorCola),
      alert: t.cola > 0,
      tab: "cola",
    },
    {
      label: "Por registrar",
      value: String(t.pendientesRecibidos),
      hint: formatMoney(t.valorPendienteRecibido),
      alert: t.pendientesRecibidos > 0,
      tab: "pendiente",
    },
    ...(typoCount > 0
      ? [
          {
            label: "Revisar folio",
            value: String(typoCount),
            hint: "Posible error al digitar folio",
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
            highlight: true,
            tab: "totalizado" as TabId,
          },
        ]
      : []),
    {
      label: "Doble registro",
      value: String(t.duplicados),
      hint: "Mismo documento en 2+ comprobantes",
      alert: t.duplicados > 0,
      tab: "duplicado",
    },
    {
      label: "Diferencias",
      value: String(t.diferencias),
      hint: formatMoney(t.valorDiferencia),
      alert: t.diferencias > 0,
      tab: "diferencia",
    },
    {
      label: "Recibidos OK",
      value: formatPct(t.pctRecibidos),
      hint: `${t.recibidos} compras · ${t.crucesNc} cruces NC`,
      tab: "conciliado",
    },
  ];
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3",
        items.length >= 7 ? "sm:grid-cols-3 lg:grid-cols-7" : items.length === 6 ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-3 lg:grid-cols-5",
      )}
    >

      {items.map((k) => (
        <button
          key={k.label}
          type="button"
          onClick={() => onSelectTab(k.tab)}
          className={cn(
            "rounded-xl border bg-bg-elevated px-4 py-4 text-left",
            k.alert ? "border-danger/40" : "border-line",
          )}
        >
          <div className="text-xs font-medium uppercase tracking-wider text-ink-subtle">
            {k.label}
          </div>
          <div
            className={cn(
              "mt-1 font-display text-2xl font-semibold tabular-nums",
              k.alert ? "text-danger" : "text-ink",
            )}
          >
            {k.value}
          </div>
          <div className="mt-1 text-xs text-ink-muted">{k.hint}</div>
        </button>
      ))}
    </div>
  );
}
