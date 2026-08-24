import { ESTADO_LABEL } from "@/lib/conciliar";
import type { EstadoConciliacion } from "@/lib/types";
import { cn } from "@/lib/cn";

const styles: Record<EstadoConciliacion, string> = {
  conciliado: "bg-ok-bg text-ok",
  totalizado: "bg-teal-subtle text-teal border border-teal/30",
  diferencia: "bg-warn-bg text-warn",
  pendiente: "bg-danger-bg text-danger",
  duplicado: "bg-warn-bg text-warn",
  no_aplica: "bg-bg-subtle text-ink-subtle",
  solo_siigo: "bg-info-bg text-info",
  cruce_nc: "bg-info-bg text-info",
  posible_typo: "bg-warn-bg text-warn",
};


export function BadgeEstado({ estado }: { estado: EstadoConciliacion }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        styles[estado],
      )}
    >
      {ESTADO_LABEL[estado]}
    </span>
  );
}
