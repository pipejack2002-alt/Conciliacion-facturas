import type { ConciliacionRow } from "./types.ts";
import { formatMoney } from "./format.ts";

export interface TaxInsight {
  tipo: "redondeo" | "retefuente" | "iva" | "reteiva" | "reteica" | "posible_duplicado" | "trm_diferencia" | "comision_bancaria";
  etiqueta: string;
  detalle: string;
  tarifa?: string;
  probabilidad: "alta" | "media";
}

/**
 * Analiza una fila para identificar si corresponde a deducciones tributarias (Retefuente, IVA, ReteICA),
 * redondeo, ajuste por TRM de moneda extranjera o comisiones bancarias pendientes de causar en L.
 */
export function getTaxInsight(row: ConciliacionRow): TaxInsight | null {
  // A. Detección de ajuste por TRM / Moneda extranjera (e.g. Seguros Bolívar)
  if (row.alerta && /trm/i.test(row.alerta)) {
    const linkedItem = row.linked?.[0];
    const diffTrm = linkedItem ? Math.abs(row.totalDian - linkedItem.total) : 0;
    return {
      tipo: "trm_diferencia",
      etiqueta: diffTrm > 0 ? `Ajuste TRM (${formatMoney(diffTrm)})` : "Ajuste TRM",
      detalle: `${row.alerta} ${diffTrm > 0 ? `Diferencia de ${formatMoney(diffTrm)} a registrar en cuenta de diferencia en cambio (PUC 530525 / 421020).` : ""}`.trim(),
      probabilidad: "alta",
    };
  }

  // B. Detección de comisiones bancarias / fiduciarias pendientes de causar en Nota L
  if (
    row.estado === "pendiente" &&
    (/credicorp|banco|fiduciaria|fidu|bancolombia|davivienda|bbva|occidente|popular|bogota/i.test(row.nombreContraparte) ||
      /comisi[oó]n|tarifa|transferencia/i.test(row.tipo) ||
      /comisi[oó]n/i.test(row.alerta))
  ) {
    return {
      tipo: "comision_bancaria",
      etiqueta: "Comisión bancaria",
      detalle: `Factura de comisiones bancarias con IVA (${formatMoney(row.totalDian)}). Se causa habitualmente mediante nota contable / ajuste de extracto debitando gastos financieros (PUC 530515), ya sea registrando el total con IVA como mayor valor del gasto o discriminando el IVA descontable (PUC 2408).`,
      probabilidad: "alta",
    };
  }

  if (row.estado !== "diferencia" && row.estado !== "totalizado") {
    return null;
  }

  const diff = Math.abs(row.diferencia);
  if (diff === 0) return null;

  const totalDian = Math.abs(row.totalDian);
  const totalSiigo = Math.abs(row.totalSiigo);
  if (totalDian === 0) return null;

  // 1. Detección de redondeo de centavos o pesos menores (hasta ±$100 COP)
  if (diff <= 100) {
    return {
      tipo: "redondeo",
      etiqueta: `Redondeo (±${formatMoney(diff)})`,
      detalle: `La diferencia es de solo ${formatMoney(diff)} pesos, atribuible a redondeo en decimales de facturación.`,
      probabilidad: "alta",
    };
  }

  // 2. Base gravable estimada (sin IVA)
  const baseGravable = row.iva > 0 ? totalDian - row.iva : totalDian / 1.19;

  // 3. Causación sobre base antes de IVA (19%)
  const ivaEstimado19 = totalDian - totalDian / 1.19;
  if (Math.abs(diff - ivaEstimado19) <= 1000 || Math.abs(totalSiigo - totalDian / 1.19) <= 1000) {
    return {
      tipo: "iva",
      tarifa: "19%",
      etiqueta: "Causación sin IVA (19%)",
      detalle: `El valor registrado en libros (${formatMoney(totalSiigo)}) coincide con el subtotal antes de IVA del 19% (${formatMoney(totalDian / 1.19)}).`,
      probabilidad: "alta",
    };
  }

  // IVA 5%
  const ivaEstimado5 = totalDian - totalDian / 1.05;
  if (Math.abs(diff - ivaEstimado5) <= 1000 || Math.abs(totalSiigo - totalDian / 1.05) <= 1000) {
    return {
      tipo: "iva",
      tarifa: "5%",
      etiqueta: "Causación sin IVA (5%)",
      detalle: `El valor registrado coincide con la base gravable con tarifa del 5% de IVA.`,
      probabilidad: "alta",
    };
  }

  // 4. ReteIVA (15% sobre el valor del IVA)
  if (row.iva > 0) {
    const reteIva15 = row.iva * 0.15;
    if (Math.abs(diff - reteIva15) <= 500) {
      return {
        tipo: "reteiva",
        tarifa: "15% del IVA",
        etiqueta: "ReteIVA 15%",
        detalle: `La diferencia (${formatMoney(diff)}) coincide con la retención de IVA del 15% aplicada sobre ${formatMoney(row.iva)}.`,
        probabilidad: "alta",
      };
    }
  }

  // 5. Retenciones en la Fuente (Retefuente sobre base gravable)
  const TARIFAS_RETEFUENTE = [
    { tarifa: "2.5%", pct: 0.025, desc: "Compras generales declarantes (2.5%)" },
    { tarifa: "3.5%", pct: 0.035, desc: "Compras no declarantes / Servicios generales (3.5%)" },
    { tarifa: "4.0%", pct: 0.04, desc: "Servicios generales / Arrendamientos (4.0%)" },
    { tarifa: "1.0%", pct: 0.01, desc: "Combustibles / Transporte de carga (1.0%)" },
    { tarifa: "6.0%", pct: 0.06, desc: "Arrendamiento de bienes inmuebles (6.0%)" },
    { tarifa: "11.0%", pct: 0.11, desc: "Honorarios y comisiones declarantes (11.0%)" },
    { tarifa: "10.0%", pct: 0.1, desc: "Honorarios no declarantes (10.0%)" },
  ];

  for (const { tarifa, pct, desc } of TARIFAS_RETEFUENTE) {
    const retencionEstimada = baseGravable * pct;
    const retencionSobreTotal = totalDian * pct;
    if (Math.abs(diff - retencionEstimada) <= 800 || Math.abs(diff - retencionSobreTotal) <= 800) {
      return {
        tipo: "retefuente",
        tarifa,
        etiqueta: `Retefuente ${tarifa}`,
        detalle: `La diferencia (${formatMoney(diff)}) coincide con un descuento de ${desc} sobre la base estimada de ${formatMoney(baseGravable)}.`,
        probabilidad: "alta",
      };
    }
  }

  // 6. ReteICA Municipal
  const TARIFAS_RETEICA = [
    { tarifa: "9.66‰", pct: 0.00966, desc: "ReteICA Servicios / Comercio (9.66 por mil)" },
    { tarifa: "4.14‰", pct: 0.00414, desc: "ReteICA Industrial (4.14 por mil)" },
    { tarifa: "11.04‰", pct: 0.01104, desc: "ReteICA Actividades Especiales (11.04 por mil)" },
  ];

  for (const { tarifa, pct, desc } of TARIFAS_RETEICA) {
    const reteIcaEstimado = baseGravable * pct;
    if (Math.abs(diff - reteIcaEstimado) <= 500) {
      return {
        tipo: "reteica",
        tarifa,
        etiqueta: `ReteICA ${tarifa}`,
        detalle: `La diferencia (${formatMoney(diff)}) coincide con la retención de ICA (${desc}).`,
        probabilidad: "media",
      };
    }
  }

  return null;
}
