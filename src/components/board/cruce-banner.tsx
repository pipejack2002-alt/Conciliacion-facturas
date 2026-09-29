import type { ConciliacionResult } from "@/lib/types";

export function CruceBanner({ cruzes }: { cruzes: ConciliacionResult["cruzes"] }) {
  if (!cruzes || cruzes.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-info/30 bg-info-bg px-4 py-3 text-sm text-info">
      {cruzes.length} cruce{cruzes.length === 1 ? "" : "s"} factura + nota crédito del mismo NIT y valor.
      Si ambas están pendientes, el neto puede ser cero; igual conviene revisar si deben contabilizarse.
    </div>
  );
}
