import { ESTADO_LABEL } from "@/lib/conciliar";
import type { ConciliacionResult, ConciliacionRow, EstadoConciliacion } from "@/lib/types";

export function exportCsv(rows: ConciliacionRow[], result: ConciliacionResult, tab: string) {
  const dataRows = rows.length > 0 ? rows : result.rows.filter((r) => r.estado !== "no_aplica");
  const lines: string[][] =
    tab === "solo_siigo"
      ? [
          ["Comprobante", "Fecha", "NIT", "Nombre", "Descripcion", "Debito", "Credito"],
          ...result.orphans.map((o) => [
            o.comprobante,
            o.fecha,
            o.nit,
            o.nombre,
            o.descripcion,
            String(o.debito),
            String(o.credito),
          ]),
        ]
      : [
          [
            "Estado",
            "Grupo",
            "Tipo",
            "Numero",
            "Fecha",
            "NIT",
            "Contraparte",
            "Total DIAN",
            "Valor libros",
            "Diferencia",
            "Match",
            "Comprobantes",
            "Cruce NC",
            "CUFE",
            "Alerta",
          ],
          ...dataRows.map((r) => [
            ESTADO_LABEL[r.estado as EstadoConciliacion],
            r.grupo,
            r.tipo,
            r.numero,
            r.fecha,
            r.nitContraparte,
            r.nombreContraparte,
            String(r.totalDian),
            String(r.totalSiigo),
            String(r.diferencia),
            r.matchVia,
            r.comprobantes.join(" | "),
            r.linked.map((l) => l.numero).join(" | "),
            r.cufe,
            r.alerta,
          ]),
        ];
  const csv = lines.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "auditoria-dian.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
