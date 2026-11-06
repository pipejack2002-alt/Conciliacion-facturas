import type { ConciliacionRow, MovLine } from "./types.ts";
import type { BankConciliacionRow } from "./conciliar-bancos.ts";
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

export interface BankEntityInfo {
  nit: string;
  nombre: string;
  esFondoInversion: boolean;
}

export interface BankPucSuggestion {
  cuentaBanco: string;
  nombreCuentaBanco: string;
  nitBanco: string;
  nombreBanco: string;
  cuentaContrapartida: string;
  nombreContrapartida: string;
  nitTercero: string;
  nombreTercero: string;
  cuentaDebito: string;
  nombreDebito: string;
  nitDebito: string;
  terceroDebito: string;
  cuentaCredito: string;
  nombreCredito: string;
  nitCredito: string;
  terceroCredito: string;
  naturalezaLabel: string;
  origen: "historial_tercero" | "regla_fisc_bancaria" | "regla_operativa" | "estandar";
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

/**
 * Resuelve el NIT oficial y la razón social de la entidad financiera o comisionista en Colombia.
 */
export function resolveBankEntityInfo(bancoNombre = "Banco"): BankEntityInfo {
  const b = (bancoNombre || "").toLowerCase();

  if (/caja\s*social|bcsc|colmena/i.test(b)) {
    return { nit: "860007335", nombre: "BANCO CAJA SOCIAL S.A.", esFondoInversion: false };
  }
  if (/credicorp|correval|fonval/i.test(b)) {
    return { nit: "900520484", nombre: "CREDICORP CAPITAL COLOMBIA S.A.", esFondoInversion: true };
  }
  if (/davivienda/i.test(b)) {
    return { nit: "860034313", nombre: "BANCO DAVIVIENDA S.A.", esFondoInversion: false };
  }
  if (/bogot[aá]/i.test(b)) {
    return { nit: "860002964", nombre: "BANCO DE BOGOTÁ S.A.", esFondoInversion: false };
  }
  if (/bbva/i.test(b)) {
    return { nit: "860003020", nombre: "BBVA COLOMBIA S.A.", esFondoInversion: false };
  }
  if (/occidente/i.test(b)) {
    return { nit: "890300279", nombre: "BANCO DE OCCIDENTE S.A.", esFondoInversion: false };
  }
  if (/popular/i.test(b)) {
    return { nit: "860007738", nombre: "BANCO POPULAR S.A.", esFondoInversion: false };
  }
  if (/ita[uú]|corpbanca/i.test(b)) {
    return { nit: "890903937", nombre: "BANCO ITAÚ CORPBANCA COLOMBIA S.A.", esFondoInversion: false };
  }
  if (/colpatria|scotiabank/i.test(b)) {
    return { nit: "860034594", nombre: "SCOTIABANK COLPATRIA S.A.", esFondoInversion: false };
  }
  if (/av\s*villas/i.test(b)) {
    return { nit: "860035827", nombre: "BANCO COMERCIAL AV VILLAS S.A.", esFondoInversion: false };
  }
  if (/agrario/i.test(b)) {
    return { nit: "800037800", nombre: "BANCO AGRARIO DE COLOMBIA S.A.", esFondoInversion: false };
  }
  if (/bancoomeva/i.test(b)) {
    return { nit: "900406150", nombre: "BANCOOMEVA S.A.", esFondoInversion: false };
  }
  if (/banistmo/i.test(b)) {
    return { nit: "800000001", nombre: "BANISTMO S.A.", esFondoInversion: false };
  }
  if (/bancolombia/i.test(b)) {
    return { nit: "890903938", nombre: "BANCOLOMBIA S.A.", esFondoInversion: false };
  }

  return {
    nit: "890903938",
    nombre: (bancoNombre || "ENTIDAD BANCARIA").toUpperCase(),
    esFondoInversion: /fiducia|fondo|fic\b|cartera/i.test(b),
  };
}

/**
 * Infiere la cuenta PUC de tesorería, la contrapartida contable (Gasto, Retención, Ingreso, Pasivo o Cartera)
 * y los NITs reales del banco y tercero para cualquier movimiento bancario pendiente de causar en el ERP.
 */
export function inferBankPucForRow(
  row: Pick<
    BankConciliacionRow,
    "estado" | "tipo" | "descripcion" | "nota" | "esGmf" | "esComision" | "esRendimiento" | "esRetencion" | "itemLibros"
  >,
  bancoNombre = "Banco",
  cuentaContable = "11100501",
  movLines: MovLine[] = [],
): BankPucSuggestion {
  const bankInfo = resolveBankEntityInfo(bancoNombre);
  const rawCta = (cuentaContable || "").trim();

  // 1. Resolver código y nombre real de la cuenta contable de Bancos / Fondos de Inversión
  let cuentaBanco = "11100501";
  let nombreCuentaBanco = bankInfo.esFondoInversion
    ? `Fondos de Inversión / Cartera Colectiva (${bancoNombre})`
    : `Bancos Moneda Nacional (${bancoNombre})`;

  if (rawCta && rawCta !== "todas" && rawCta !== "credicorp_all") {
    cuentaBanco = rawCta.split(",")[0].trim();
    const matchedLine = movLines.find((m) => (m.cuenta || "").trim() === cuentaBanco && (m.cuentaNombre || "").trim().length > 2);
    if (matchedLine?.cuentaNombre) {
      nombreCuentaBanco = matchedLine.cuentaNombre.trim();
    } else if (/^(1250|1245|1144|1125)/.test(cuentaBanco)) {
      nombreCuentaBanco = `Encargos Fiduciarios / Fondos de Inversión (${bancoNombre})`;
    }
  } else if (rawCta === "credicorp_all" || bankInfo.esFondoInversion) {
    const ficLine = movLines.find((m) => /^(1250|1245|1144|1125)/.test((m.cuenta || "").trim()));
    cuentaBanco = ficLine ? ficLine.cuenta.trim() : "12503511";
    nombreCuentaBanco = ficLine?.cuentaNombre?.trim() || `Fondos de Inversión / Cartera Colectiva (${bancoNombre})`;
  } else {
    const bankLine = movLines.find((m) => /^(1110|1120|1105)/.test((m.cuenta || "").trim()));
    if (bankLine) {
      cuentaBanco = bankLine.cuenta.trim();
      if (bankLine.cuentaNombre?.trim()) nombreCuentaBanco = bankLine.cuentaNombre.trim();
    }
  }

  const isDebitNote = row.estado === "nota_debito_banco" || (row.estado !== "nota_credito_banco" && row.tipo === "retiro");
  const text = `${row.descripcion || ""} ${row.nota || ""}`.toLowerCase();

  let cuentaContrapartida = "53059501";
  let nombreContrapartida = "Otros Gastos Bancarios y Financieros";
  let nitTercero = bankInfo.nit;
  let nombreTercero = bankInfo.nombre;
  let naturalezaLabel = "Gasto Bancario / Nota Débito";
  let origen: BankPucSuggestion["origen"] = "estandar";

  if (isDebitNote) {
    if (row.esGmf) {
      cuentaContrapartida = "51159501";
      nombreContrapartida = "Gravamen a los Movimientos Financieros (GMF 4x1000)";
      nitTercero = "800197268";
      nombreTercero = "DIAN - DIRECCIÓN DE IMPUESTOS Y ADUANAS NACIONALES";
      naturalezaLabel = "GMF 4×1000 Deducible";
      origen = "regla_fisc_bancaria";
    } else if (row.esRetencion) {
      cuentaContrapartida = "13551501";
      nombreContrapartida = "Anticipo Retención en la Fuente - Rendimientos Financieros (7%)";
      nitTercero = "800197268";
      nombreTercero = "DIAN - DIRECCIÓN DE IMPUESTOS Y ADUANAS NACIONALES";
      naturalezaLabel = "Retención en la Fuente (7% Rendimientos)";
      origen = "regla_fisc_bancaria";
    } else if (row.esComision) {
      cuentaContrapartida = "53051501";
      nombreContrapartida = "Gastos Financieros - Comisiones y Cuotas de Manejo";
      nitTercero = bankInfo.nit;
      nombreTercero = bankInfo.nombre;
      naturalezaLabel = "Comisión / Servicio Bancario";
      origen = "regla_fisc_bancaria";
    } else if (/pila\b|soi\b|aportes?\s+en\s+l[ií]nea|mi\s*planilla|arus|asopagos|seguridad\s+social|eps\b|afp\b|arl\b|caja\s+de\s+compensaci/i.test(text)) {
      cuentaContrapartida = "23700501";
      nombreContrapartida = "Retenciones y Aportes de Nómina - Seguridad Social (PILA)";
      nitTercero = bankInfo.nit;
      nombreTercero = "OPERADOR PILA / APORTES SEGURIDAD SOCIAL";
      naturalezaLabel = "Pago Seguridad Social / PILA";
      origen = "regla_operativa";
    } else if (/n[oó]mina|salario|sueldo|quincena|cesant[ií]a|prima\s+de\s+servicios|liquidaci[oó]n\s+laboral/i.test(text)) {
      cuentaContrapartida = "25050501";
      nombreContrapartida = "Salarios y Prestaciones Sociales por Pagar";
      nitTercero = bankInfo.nit;
      nombreTercero = "NÓMINA POR PAGAR EMPLEADOS";
      naturalezaLabel = "Pago de Nómina / Salarios";
      origen = "regla_operativa";
    } else if (/dian\b|impuesto|iva\b|retefuente|retenci[oó]n\s+dian|ica\b|industria\s+y\s+comercio|predial/i.test(text)) {
      cuentaContrapartida = "24040501";
      nombreContrapartida = "Impuestos, Gravámenes y Tasas por Pagar";
      nitTercero = "800197268";
      nombreTercero = "DIAN - DIRECCIÓN DE IMPUESTOS Y ADUANAS NACIONALES";
      naturalezaLabel = "Pago de Impuestos / Obligación Tributaria";
      origen = "regla_operativa";
    } else if (/energ[ií]a|acueducto|epm|enel|afinia|air-?e|claro|movistar|tigo|etb|gas\s+natural|servicio\s+p[uú]blico/i.test(text)) {
      cuentaContrapartida = "51353001";
      nombreContrapartida = "Servicios Públicos y Telecomunicaciones";
      nitTercero = bankInfo.nit;
      nombreTercero = "EMPRESA DE SERVICIOS PÚBLICOS";
      naturalezaLabel = "Débito Automático Servicios Públicos";
      origen = "regla_operativa";
    } else if (/inter[eé]s\s+sobregiro|inter[eé]s\s+mora|intereses\s+cr[eé]dito|obligaci[oó]n\s+financiera|cuota\s+cr[eé]dito|pagar[eé]|leasing/i.test(text)) {
      cuentaContrapartida = "21051001";
      nombreContrapartida = "Obligaciones Financieras - Bancos Nacionales";
      nitTercero = bankInfo.nit;
      nombreTercero = bankInfo.nombre;
      naturalezaLabel = "Abono Obligación Financiera";
      origen = "regla_operativa";
    } else if (/transf|pago\s+prov|proveed|ach\b|pse\b|giro|cheque/i.test(text)) {
      cuentaContrapartida = "22050501";
      nombreContrapartida = "Cuentas por Pagar - Proveedores Nacionales";
      nitTercero = row.itemLibros?.nit || "222222222";
      nombreTercero = row.itemLibros?.nombre || "PROVEEDOR NACIONAL POR IDENTIFICAR";
      naturalezaLabel = "Pago a Proveedores / Giro ACH";
      origen = "regla_operativa";
    }
  } else {
    // Nota Crédito Bancaria / Consignación
    if (row.esRendimiento) {
      cuentaContrapartida = "42100502";
      nombreContrapartida = "Ingresos Financieros - Intereses y Rendimientos Bancarios";
      nitTercero = bankInfo.nit;
      nombreTercero = bankInfo.nombre;
      naturalezaLabel = "Rendimientos Financieros";
      origen = "regla_fisc_bancaria";
    } else if (/desembolso|pr[eé]stamo|cr[eé]dito\s+bancario/i.test(text)) {
      cuentaContrapartida = "21051001";
      nombreContrapartida = "Obligaciones Financieras - Desembolsos Bancarios";
      nitTercero = bankInfo.nit;
      nombreTercero = bankInfo.nombre;
      naturalezaLabel = "Desembolso Obligación Financiera";
      origen = "regla_operativa";
    } else if (/reintegro|devoluci[oó]n\s+gmf|reverso|anulaci[oó]n\s+comisi[oó]n/i.test(text)) {
      cuentaContrapartida = "42950501";
      nombreContrapartida = "Aprovechamientos y Reintegros Bancarios";
      nitTercero = bankInfo.nit;
      nombreTercero = bankInfo.nombre;
      naturalezaLabel = "Reintegro / Reverso Bancario";
      origen = "regla_operativa";
    } else {
      cuentaContrapartida = "13050501";
      nombreContrapartida = "Clientes Nacionales / Recaudos por Identificar";
      nitTercero = row.itemLibros?.nit || "222222222";
      nombreTercero = row.itemLibros?.nombre || "CLIENTES VARIOS / RECAUDO POR IDENTIFICAR";
      naturalezaLabel = "Recaudo Clientes / Abono en Cuenta";
      origen = "regla_operativa";
    }
  }

  return {
    cuentaBanco,
    nombreCuentaBanco,
    nitBanco: bankInfo.nit,
    nombreBanco: bankInfo.nombre,
    cuentaContrapartida,
    nombreContrapartida,
    nitTercero,
    nombreTercero,
    cuentaDebito: isDebitNote ? cuentaContrapartida : cuentaBanco,
    nombreDebito: isDebitNote ? nombreContrapartida : nombreCuentaBanco,
    nitDebito: isDebitNote ? nitTercero : bankInfo.nit,
    terceroDebito: isDebitNote ? nombreTercero : bankInfo.nombre,
    cuentaCredito: isDebitNote ? cuentaBanco : cuentaContrapartida,
    nombreCredito: isDebitNote ? nombreCuentaBanco : nombreContrapartida,
    nitCredito: isDebitNote ? bankInfo.nit : nitTercero,
    terceroCredito: isDebitNote ? bankInfo.nombre : nombreTercero,
    naturalezaLabel,
    origen,
  };
}


