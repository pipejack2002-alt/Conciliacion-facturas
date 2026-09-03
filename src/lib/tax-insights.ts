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
    !/camara\s+de\s+comercio|c\.?\s*de\s*comercio/i.test(row.nombreContraparte) &&
    (/credicorp|banco|fiduciaria|fidu|bancolombia|davivienda|bbva|occidente|popular/i.test(row.nombreContraparte) ||
      /banco.*bogot[aá]|bco.*bogot[aá]/i.test(row.nombreContraparte) ||
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

  // C. Detección de naturaleza contable para movimientos de 'Solo libros'
  if (row.estado === "solo_siigo") {
    const textBlob = `${row.tipo} ${row.alerta} ${row.nombreContraparte} ${row.comprobantes.join(" ")}`.toLowerCase();

    // 1. Nómina y pagos laborales
    if (/n[oó]mina|laboral|sueldo|salario|cesant|prima|vacaci/i.test(textBlob)) {
      return {
        tipo: "redondeo",
        etiqueta: "Pasivo laboral / Nómina",
        detalle: "Movimiento de nómina de empleados o pagos laborales. No genera factura comercial ante la DIAN; su soporte es el documento de nómina electrónica.",
        probabilidad: "alta",
      };
    }

    // 2. Documentos Soporte (P 004 / P 005) pendientes de transmisión o validación en DIAN
    if (/^P\s*004|^P-004|^P\s*005|^P-005/i.test(row.numero) || row.tipo.toLowerCase().includes("soporte")) {
      return {
        tipo: "redondeo",
        etiqueta: "Doc. Soporte pendiente DIAN",
        detalle: `Comprobante de compra a persona no obligada (${row.numero}). Se encuentra contabilizado en libros pero aún no figura en el reporte DIAN del mes. Verifica si está pendiente de transmisión electrónica.`,
        probabilidad: "alta",
      };
    }

    // 3. Cámara de Comercio / Trámites Registrales Mercantiles
    if (/camara\s+de\s+comercio|c\.?\s*de\s*comercio/i.test(textBlob)) {
      return {
        tipo: "redondeo",
        etiqueta: "Cámara de Comercio / Registro",
        detalle: "Gasto legal por compra de certificados, trámites o registros mercantiles ante Cámara de Comercio. En libros se causa habitualmente en cuenta 5140 (Gastos legales).",
        probabilidad: "alta",
      };
    }

    // 4. Servicios Públicos Domiciliarios
    if (/caribemar|afinia|aire|enel|epm|gases|acueducto|energia|energ[ií]a|\belectrificadora\b|\belectrificaci[oó]n\b|servicio\s+el[eé]ctrico|telecomunic|claro|tigo/i.test(textBlob)) {
      return {
        tipo: "redondeo",
        etiqueta: "Servicio Público",
        detalle: "Gasto de servicios públicos domiciliarios o telecomunicaciones. Fiscalmente se respalda con la factura/recibo de servicios públicos como documento equivalente.",
        probabilidad: "alta",
      };
    }

    // 4. Seguridad Social y Parafiscales (PILA)
    if (/sura|sanitas|nueva eps|salud total|compensar|colsubsidio|cafam|comfama|porvenir|proteccion|colfondos|positiva|pila|parafiscal|seguridad social/i.test(textBlob)) {
      return {
        tipo: "redondeo",
        etiqueta: "Seguridad Social / PILA",
        detalle: "Aportes parafiscales y seguridad social (salud, pensión, ARL, caja de compensación). Su soporte oficial es la planilla PILA integrada, no factura comercial.",
        probabilidad: "alta",
      };
    }

    // 5. Tasas y Entidades Públicas Oficiales
    if (/tasa|p[uú]blica|anla|dian|alcald|gobernac|secretar[ií]a de hacienda|superintend/i.test(textBlob)) {
      return {
        tipo: "redondeo",
        etiqueta: "Tasa / Entidad Pública",
        detalle: "Pago oficial a entidad gubernamental o autoridad ambiental. Las tasas o licencias públicas no se soportan con factura comercial electrónica estándar.",
        probabilidad: "alta",
      };
    }

    // 6. Reembolsos de Caja Menor
    if (/caja menor|reembolso|legalizaci[oó]n|fondo fijo/i.test(textBlob)) {
      return {
        tipo: "redondeo",
        etiqueta: "Reembolso / Caja Menor",
        detalle: "Comprobante de legalización o reembolso de gastos menores. Ampara consumos menores autorizados internamente.",
        probabilidad: "media",
      };
    }

    // 7. Tercero con otras facturas en DIAN en el periodo
    if (row.linked && row.linked.length > 0) {
      return {
        tipo: "trm_diferencia",
        etiqueta: `Tiene ${row.linked.length} factura(s) en DIAN`,
        detalle: `Este tercero registra ${row.linked.length} factura(s) en el reporte DIAN del periodo con importes o fechas distintas. Revisa si corresponde a causaciones anticipadas o acumuladas.`,
        probabilidad: "media",
      };
    }

    return {
      tipo: "redondeo",
      etiqueta: "Solo en Libros",
      detalle: "Registro contable sin factura electrónica en el reporte DIAN del mes. Puedes investigarlo, registrar notas de auditoría o validarlo.",
      probabilidad: "media",
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
