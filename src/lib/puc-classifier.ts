import type { ConciliacionRow, MovLine } from "./types.ts";
import { digitsOnly } from "./format.ts";

export interface PucAccountSuggestion {
  cuentaGasto: string;
  nombreGasto: string;
  cuentaIva: string;
  nombreIva: string;
  cuentaPasivo: string;
  nombrePasivo: string;
  origen: "historial_tercero" | "regla_comercial" | "estandar";
}

function nitBase(nit: string): string {
  const d = digitsOnly(nit || "");
  return d.length >= 10 ? d.slice(0, 9) : d;
}

/**
 * Infiere la cuenta PUC de gasto/costo, IVA descontable y pasivo más adecuada
 * para causar una factura recibida en la DIAN:
 * 1. Si el mismo proveedor (NIT) ya tiene causaciones previas en el auxiliar contable (`movLines`),
 *    reutiliza la cuenta de gasto/costo/inventario que el contador ya usa para ese tercero.
 * 2. Si no existe en el auxiliar, aplica heurísticas del Plan Único de Cuentas (PUC Colombia)
 *    según la actividad comercial del proveedor o tipo de documento.
 */
export function inferPucAccountForRow(
  row: Pick<ConciliacionRow, "nitContraparte" | "nombreContraparte" | "tipo" | "alerta">,
  movLines: MovLine[] = [],
): PucAccountSuggestion {
  const defaultIva = {
    cuentaIva: "24080326",
    nombreIva: "IVA Descontable en Compras y Servicios",
  };
  const defaultPasivo = {
    cuentaPasivo: "22050101",
    nombrePasivo: "Proveedores Nacionales",
  };

  // 1. Buscar en el historial contable del mismo proveedor (NIT) dentro del libro auxiliar cargado
  const targetNit = nitBase(row.nitContraparte || "");
  if (targetNit && targetNit.length >= 5 && movLines.length > 0) {
    const accountFreq = new Map<string, { count: number; nombre: string }>();
    let customPasivo: { cuenta: string; nombre: string } | null = null;
    let customIva: { cuenta: string; nombre: string } | null = null;

    for (const m of movLines) {
      if (nitBase(m.nit) !== targetNit) continue;
      const cta = (m.cuenta || "").trim();
      if (!cta) continue;

      if (/^(5|6|7|14|15|17)/.test(cta) && !/^2408/.test(cta)) {
        const cur = accountFreq.get(cta) || {
          count: 0,
          nombre: m.cuentaNombre || m.descripcion || "Gasto / Costo del Proveedor",
        };
        cur.count += 1;
        if (m.cuentaNombre && m.cuentaNombre.length > 3) {
          cur.nombre = m.cuentaNombre;
        }
        accountFreq.set(cta, cur);
      } else if (/^2408/.test(cta) && !customIva) {
        customIva = {
          cuenta: cta,
          nombre: m.cuentaNombre || defaultIva.nombreIva,
        };
      } else if (/^(2205|2335)/.test(cta) && !customPasivo) {
        customPasivo = {
          cuenta: cta,
          nombre: m.cuentaNombre || defaultPasivo.nombrePasivo,
        };
      }
    }

    if (accountFreq.size > 0) {
      const [bestCuenta, bestInfo] = [...accountFreq.entries()].sort((a, b) => b[1].count - a[1].count)[0];
      return {
        cuentaGasto: bestCuenta,
        nombreGasto: bestInfo.nombre,
        cuentaIva: customIva?.cuenta || defaultIva.cuentaIva,
        nombreIva: customIva?.nombre || defaultIva.nombreIva,
        cuentaPasivo: customPasivo?.cuenta || defaultPasivo.cuentaPasivo,
        nombrePasivo: customPasivo?.nombre || defaultPasivo.nombrePasivo,
        origen: "historial_tercero",
      };
    }
  }

  // 2. Clasificación inteligente por naturaleza comercial del proveedor (PUC Colombia)
  const text = `${row.nombreContraparte || ""} ${row.tipo || ""} ${row.alerta || ""}`.toLowerCase();

  if (/credicorp|banco|fiduciaria|fidu|bancolombia|davivienda|bbva|occidente|popular|bogot[aá]|comisi[oó]n\s+banc/i.test(text) && !/camara\s+de\s+comercio/i.test(text)) {
    return {
      cuentaGasto: "53051501",
      nombreGasto: "Gastos Financieros - Comisiones Bancarias",
      ...defaultIva,
      cuentaPasivo: "23350501",
      nombrePasivo: "Costos y Gastos por Pagar - Financieros",
      origen: "regla_comercial",
    };
  }

  if (/camara\s+de\s+comercio|c\.?\s*de\s*comercio|notar[ií]a|registro\s+mercantil/i.test(text)) {
    return {
      cuentaGasto: "51401001",
      nombreGasto: "Gastos Legales - Registro Mercantil y Trámites",
      ...defaultIva,
      ...defaultPasivo,
      origen: "regla_comercial",
    };
  }

  if (/masser|terpel|biomax|esso|mobil|texaco|primax|combustible|gasolina|estacion\s+de\s+servicio|distracom|zeuss/i.test(text)) {
    return {
      cuentaGasto: "51953501",
      nombreGasto: "Combustibles y Lubricantes",
      ...defaultIva,
      ...defaultPasivo,
      origen: "regla_comercial",
    };
  }

  if (/colvanes|servientrega|interrapidisimo|envia|coordinadora|deprisa|transporte|flete|log[ií]stica|mensajer[ií]a/i.test(text)) {
    return {
      cuentaGasto: "51355001",
      nombreGasto: "Transporte, Fletes y Acarreos",
      ...defaultIva,
      cuentaPasivo: "23354501",
      nombrePasivo: "Costos y Gastos por Pagar - Transportes",
      origen: "regla_comercial",
    };
  }

  if (/caribemar|afinia|air-?\s*e|enel|epm|gases|acueducto|energ[ií]a|vatia|triple\s+a|electrificadora|claro|tigo|movistar|etb|une\b|telecom/i.test(text)) {
    return {
      cuentaGasto: "51353001",
      nombreGasto: "Servicios Públicos y Telecomunicaciones",
      ...defaultIva,
      cuentaPasivo: "23355001",
      nombrePasivo: "Costos y Gastos por Pagar - Servicios Públicos",
      origen: "regla_comercial",
    };
  }

  if (/sodimac|homecenter|easy|ferreter|mantenimiento|reparaci|extintor|serviford|automotriz|taller|repuesto/i.test(text)) {
    return {
      cuentaGasto: "51451001",
      nombreGasto: "Mantenimiento y Reparaciones",
      ...defaultIva,
      ...defaultPasivo,
      origen: "regla_comercial",
    };
  }

  if (/seguro|bol[ií]var|sura|allianz|mapfre|liberty|previsora|axa\s+colpatria|p[oó]liza/i.test(text)) {
    return {
      cuentaGasto: "51302501",
      nombreGasto: "Seguros y Pólizas",
      ...defaultIva,
      cuentaPasivo: "23355501",
      nombrePasivo: "Costos y Gastos por Pagar - Seguros",
      origen: "regla_comercial",
    };
  }

  if (/restaurante|casino|cafeter|crepes|corral|alimento|catering/i.test(text)) {
    return {
      cuentaGasto: "51956001",
      nombreGasto: "Casino y Restaurante",
      ...defaultIva,
      ...defaultPasivo,
      origen: "regla_comercial",
    };
  }

  if (/panamericana|papeler[ií]a|tauro|offi|suministro|aseo|cafeter[ií]a/i.test(text)) {
    return {
      cuentaGasto: "51953001",
      nombreGasto: "Útiles, Papelería y Elementos de Aseo",
      ...defaultIva,
      ...defaultPasivo,
      origen: "regla_comercial",
    };
  }

  if (/abogado|consultor|asesor|auditor|revisor|contador|jur[ií]dic|honorario/i.test(text)) {
    return {
      cuentaGasto: "51102501",
      nombreGasto: "Honorarios y Asesorías Profesionales",
      ...defaultIva,
      cuentaPasivo: "23352501",
      nombrePasivo: "Costos y Gastos por Pagar - Honorarios",
      origen: "regla_comercial",
    };
  }

  return {
    cuentaGasto: "51359501",
    nombreGasto: "Gastos y Servicios Diversos",
    ...defaultIva,
    ...defaultPasivo,
    origen: "estandar",
  };
}

