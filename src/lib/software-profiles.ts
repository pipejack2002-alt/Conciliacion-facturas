import type { ColumnKey, ColumnMapping, DetectedProfile, SoftwareProfileId } from "./types.ts";

export interface SoftwareProfileDef {
  id: SoftwareProfileId;
  label: string;
  vendor: string;
  signatureKeywords: string[];
  expectedAliases: Record<ColumnKey, string[]>;
}

export function normText(s: unknown): string {
  if (s == null) return "";
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Diccionario Canónico Ponderado de Columnas Contables en Colombia */
export const CANONICAL_ALIASES: Record<ColumnKey, string[]> = {
  cuenta: [
    "cuenta",
    "cuenta contable",
    "codigo",
    "codigo cuenta",
    "cod cuenta",
    "cta",
    "cuenta de mayor",
    "cod. cuenta",
    "codigo contable",
  ],
  cuentaNombre: [
    "descripcion cuenta",
    "descrip cuenta",
    "nombre cuenta",
    "nombre de la cuenta",
    "descripción cuenta",
    "concepto cuenta",
    "nombre de cuenta",
    "titulo cuenta",
  ],
  comprobante: [
    "comprobante",
    "consecutivo",
    "nro comprobante",
    "numero comprobante",
    "tipo comprobante",
    "documento",
    "nro documento",
    "numero",
    "origen",
    "numero origen",
    "transaccion",
  ],
  fecha: [
    "fecha",
    "fecha elaboracion",
    "fecha de elaboracion",
    "fecha contable",
    "fecha contabilizacion",
    "fec doc",
    "fec. doc",
    "fecha emision",
    "fecha documento",
  ],
  nit: [
    "nit",
    "identificacion",
    "identificacion tercero",
    "id tercero",
    "cedula",
    "cédula",
    "doc tercero",
    "tercero nit",
    "numero identificacion",
    "socio de negocios",
    "cod. sn",
    "codigo sn",
  ],
  nombre: [
    "nombre",
    "nombre tercero",
    "razon social",
    "razón social",
    "tercero",
    "contacto",
    "beneficiario",
    "proveedor",
    "cliente",
    "nombre socio",
    "nombre de cuenta/sn",
  ],
  descripcion: [
    "descripcion",
    "descripción",
    "concepto",
    "detalle",
    "glosa",
    "detalle concepto",
    "comentarios",
    "nota",
  ],
  cruce: [
    "inventario-cruce-cheque",
    "cruce",
    "doc cruce",
    "documento cruce",
    "cartera cruce",
  ],
  referencia: [
    "documento de referencia",
    "doc referencia",
    "doc. referencia",
    "documento referencia",
    "doc fuente",
    "doc. fuente",
    "referencia",
    "factura proveedor",
    "factura de compra proveedor",
    "ref",
    "ref 1",
    "ref 2",
    "ref. 1",
    "ref. 2",
    "cheque / referencia",
    "cheque/referencia",
    "factura asociada",
    "doc externo",
    "documento externo",
  ],
  debito: [
    "debitos",
    "debito",
    "débitos",
    "débito",
    "valor debito",
    "importe debito",
    "cargos",
    "cargo",
    "mov debito",
    "debito cop",
  ],
  credito: [
    "creditos",
    "credito",
    "créditos",
    "crédito",
    "valor credito",
    "importe credito",
    "abonos",
    "abono",
    "mov credito",
    "credito cop",
  ],
  observacion: [
    "observacion",
    "observaciones",
    "observación",
    "notas",
    "anotaciones",
    "observacion 1",
  ],
};

export const SOFTWARE_PROFILES: Record<SoftwareProfileId, SoftwareProfileDef> = {
  auto: {
    id: "auto",
    label: "Auto-Detección Inteligente",
    vendor: "Universal",
    signatureKeywords: [],
    expectedAliases: CANONICAL_ALIASES,
  },
  siigo_pyme: {
    id: "siigo_pyme",
    label: "Siigo Pyme (Windows / Desktop)",
    vendor: "Siigo",
    signatureKeywords: [
      "siigo",
      "inventario-cruce-cheque",
      "movimiento cuentas - general",
      "saldo inicial",
      "cc scc",
      "saldo mov.",
    ],
    expectedAliases: {
      ...CANONICAL_ALIASES,
      cuenta: ["cuenta", "cuenta descripcion"],
      cuentaNombre: ["descripcion"],
      comprobante: ["comprobante"],
      cruce: ["inventario-cruce-cheque", "cruce"],
      observacion: ["observacion"],
    },
  },
  siigo_nube: {
    id: "siigo_nube",
    label: "Siigo Nube",
    vendor: "Siigo",
    signatureKeywords: [
      "fecha de elaboracion",
      "identificacion tercero",
      "factura de compra fc-",
      "factura de venta fv-",
      "factura de compra proveedor",
      "descripcion cuenta",
    ],
    expectedAliases: {
      ...CANONICAL_ALIASES,
      fecha: ["fecha de elaboracion", "fecha elaboracion", "fecha"],
      comprobante: ["comprobante", "tipo de comprobante"],
      nit: ["identificacion tercero", "identificacion", "nit"],
      nombre: ["nombre tercero", "tercero", "nombre"],
      referencia: ["factura de compra proveedor", "factura proveedor", "documento externo"],
    },
  },
  world_office: {
    id: "world_office",
    label: "World Office",
    vendor: "World Office Colombia",
    signatureKeywords: [
      "world office",
      "documento de referencia",
      "doc. fuente",
      "doc fuente",
      "tipo documento",
      "centro de costos",
    ],
    expectedAliases: {
      ...CANONICAL_ALIASES,
      comprobante: ["numero", "tipo documento", "documento"],
      referencia: ["documento de referencia", "doc. fuente", "doc fuente", "referencia"],
      descripcion: ["detalle", "concepto", "descripcion"],
      nit: ["identificacion", "nit", "tercero"],
      nombre: ["tercero", "razon social", "nombre"],
    },
  },
  helisa: {
    id: "helisa",
    label: "Helisa (GW / NI)",
    vendor: "PROASISTEMAS S.A. (Helisa)",
    signatureKeywords: [
      "helisa",
      "cheque / referencia",
      "cheque/referencia",
      "norma internacional",
      "proasistemas",
    ],
    expectedAliases: {
      ...CANONICAL_ALIASES,
      referencia: ["cheque / referencia", "cheque/referencia", "referencia"],
      comprobante: ["comprobante", "documento"],
      descripcion: ["concepto", "detalle"],
      nit: ["identificacion", "nit", "nombre"],
    },
  },
  alegra: {
    id: "alegra",
    label: "Alegra",
    vendor: "Alegra",
    signatureKeywords: [
      "alegra",
      "tipo de transaccion",
      "factura asociada",
      "numero de factura asociada",
      "contacto",
    ],
    expectedAliases: {
      ...CANONICAL_ALIASES,
      nombre: ["contacto", "nombre"],
      referencia: ["factura asociada", "numero de factura asociada", "factura proveedor"],
      comprobante: ["numero de comprobante", "numero", "comprobante"],
    },
  },
  loggro: {
    id: "loggro",
    label: "Loggro",
    vendor: "Loggro (PSL)",
    signatureKeywords: [
      "loggro",
      "tipo comprobante",
      "codigo cuenta",
      "consecutivo",
    ],
    expectedAliases: {
      ...CANONICAL_ALIASES,
      cuenta: ["codigo cuenta", "cuenta"],
      cuentaNombre: ["nombre cuenta", "descripcion cuenta"],
      comprobante: ["consecutivo", "tipo comprobante"],
      referencia: ["referencia", "doc externo"],
    },
  },
  sap: {
    id: "sap",
    label: "SAP Business One / ERP",
    vendor: "SAP",
    signatureKeywords: [
      "cuenta de mayor",
      "socio de negocios",
      "ref. 1",
      "ref. 2",
      "numero de transaccion",
    ],
    expectedAliases: {
      ...CANONICAL_ALIASES,
      cuenta: ["cuenta de mayor", "cuenta"],
      nit: ["socio de negocios", "cod. sn", "nit"],
      referencia: ["ref. 1", "ref. 2", "ref 1", "ref 2"],
      descripcion: ["comentarios", "descripcion", "concepto"],
      debito: ["importe debito", "debito"],
      credito: ["importe credito", "credito"],
    },
  },
  custom: {
    id: "custom",
    label: "Personalizado / Genérico",
    vendor: "Genérico",
    signatureKeywords: [],
    expectedAliases: CANONICAL_ALIASES,
  },
};

/**
 * Encuentra automáticamente la fila donde comienzan los encabezados de columnas.
 * Busca en las primeras 25 filas evaluando la densidad de términos contables.
 */
export function findHeaderRow(rows: unknown[][]): { rowIndex: number; headers: string[] } {
  if (!rows || !rows.length) return { rowIndex: 0, headers: [] };

  const coreKeywords = [
    "cuenta",
    "nit",
    "identificacion",
    "debito",
    "debitos",
    "credito",
    "creditos",
    "fecha",
    "comprobante",
    "tercero",
    "descripcion",
    "concepto",
    "detalle",
    "saldo",
  ];

  let bestRow = 0;
  let maxScore = -1;

  const maxScan = Math.min(rows.length, 25);
  for (let r = 0; r < maxScan; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row) || !row.length) continue;

    const rowTokens = row
      .map((c) => normText(c))
      .filter((c) => c.length > 1);

    if (rowTokens.length < 3) continue;

    let score = 0;
    for (const token of rowTokens) {
      for (const kw of coreKeywords) {
        if (token === kw || token.includes(kw)) {
          score += 2;
          break;
        }
      }
    }

    // Ponderación extra si tiene simultáneamente cuenta + debito/credito + nit/tercero
    const hasCuenta = rowTokens.some((t) => t.includes("cuenta") || t.includes("codigo"));
    const hasDinero = rowTokens.some((t) => t.includes("deb") || t.includes("cred") || t.includes("saldo"));
    const hasTercero = rowTokens.some((t) => t.includes("nit") || t.includes("ident") || t.includes("tercer") || t.includes("nombre"));

    if (hasCuenta && hasDinero) score += 3;
    if (hasTercero) score += 2;

    if (score > maxScore) {
      maxScore = score;
      bestRow = r;
    }
  }

  const rawHeaders = rows[bestRow] || [];
  const headers = rawHeaders.map((c) => String(c ?? "").trim());
  return { rowIndex: bestRow, headers };
}

/**
 * Busca el índice de columna que mejor coincide con la lista de alias.
 */
function findColIndex(headers: string[], aliases: string[], taken: Set<number>): number | undefined {
  const normHeaders = headers.map((h) => normText(h));

  // 1. Coincidencia Exacta
  for (const alias of aliases) {
    const na = normText(alias);
    for (let i = 0; i < normHeaders.length; i++) {
      if (taken.has(i)) continue;
      if (normHeaders[i] === na) return i;
    }
  }

  // 2. Coincidencia Parcial (Contains)
  for (const alias of aliases) {
    const na = normText(alias);
    if (na.length < 3) continue;
    for (let i = 0; i < normHeaders.length; i++) {
      if (taken.has(i)) continue;
      if (normHeaders[i].includes(na)) return i;
    }
  }

  return undefined;
}

/**
 * Construye el mapeo de columnas a partir de los encabezados y un perfil deseado.
 */
export function buildMappingFromHeaders(
  headers: string[],
  profileId: SoftwareProfileId = "auto",
): ColumnMapping {
  const profile = SOFTWARE_PROFILES[profileId] || SOFTWARE_PROFILES.auto;
  const aliasMap = profile.expectedAliases;

  const mapping: ColumnMapping = {};
  const taken = new Set<number>();

  // Orden de prioridad para no colisionar columnas
  const keysInPriorityOrder: ColumnKey[] = [
    "cuenta",
    "debito",
    "credito",
    "nit",
    "fecha",
    "referencia",
    "cruce",
    "comprobante",
    "cuentaNombre",
    "nombre",
    "descripcion",
    "observacion",
  ];

  for (const key of keysInPriorityOrder) {
    const aliases = aliasMap[key] || CANONICAL_ALIASES[key] || [];
    const idx = findColIndex(headers, aliases, taken);
    if (idx != null) {
      mapping[key] = idx;
      taken.add(idx);
    }
  }

  // Fallback especial para Siigo Pyme histórico si faltan cuentas o comprobantes
  if (profileId === "siigo_pyme" || headers.some((h) => normText(h).includes("inventario-cruce-cheque"))) {
    if (mapping.cuenta == null && headers.length > 1) mapping.cuenta = 1;
    if (mapping.cuentaNombre == null && headers.length > 2) mapping.cuentaNombre = 2;
    if (mapping.comprobante == null && headers.length > 4) mapping.comprobante = 4;
    if (mapping.fecha == null && headers.length > 5) mapping.fecha = 5;
    if (mapping.nit == null && headers.length > 6) mapping.nit = 6;
    if (mapping.nombre == null && headers.length > 7) mapping.nombre = 7;
    if (mapping.descripcion == null && headers.length > 8) mapping.descripcion = 8;
    if (mapping.cruce == null && headers.length > 9) mapping.cruce = 9;
    if (mapping.debito == null && headers.length > 12) mapping.debito = 12;
    if (mapping.credito == null && headers.length > 13) mapping.credito = 13;
    if (mapping.observacion == null && headers.length > 15) mapping.observacion = 15;
  }

  return mapping;
}

/**
 * Detecta automáticamente el perfil de software analizando el contenido y encabezados.
 */
export function detectSoftwareProfile(rows: unknown[][]): DetectedProfile {
  const { rowIndex, headers } = findHeaderRow(rows);

  // Unir las primeras 25 filas en un solo bloque de texto normalizado para análisis de firma
  const sampleScan = rows
    .slice(0, 25)
    .map((r) => (Array.isArray(r) ? r.map((c) => normText(c)).join(" ") : ""))
    .join(" ");

  let detectedId: SoftwareProfileId = "custom";
  let highestConfidence = 50;

  // Evaluar firmas de cada software
  for (const [id, def] of Object.entries(SOFTWARE_PROFILES) as [SoftwareProfileId, SoftwareProfileDef][]) {
    if (id === "auto" || id === "custom") continue;

    let matches = 0;
    for (const kw of def.signatureKeywords) {
      if (sampleScan.includes(normText(kw))) {
        matches++;
      }
    }

    if (matches > 0) {
      const conf = Math.min(99, 70 + matches * 10);
      if (conf > highestConfidence) {
        highestConfidence = conf;
        detectedId = id;
      }
    }
  }

  // Si no hubo firma explícita, revisar encabezados
  if (detectedId === "custom") {
    const joinedHeaders = headers.map((h) => normText(h)).join(" ");
    if (joinedHeaders.includes("documento de referencia") || joinedHeaders.includes("doc fuente")) {
      detectedId = "world_office";
      highestConfidence = 92;
    } else if (joinedHeaders.includes("inventario-cruce-cheque")) {
      detectedId = "siigo_pyme";
      highestConfidence = 96;
    } else if (joinedHeaders.includes("identificacion tercero") || joinedHeaders.includes("fecha de elaboracion")) {
      detectedId = "siigo_nube";
      highestConfidence = 90;
    } else if (joinedHeaders.includes("cheque / referencia") || joinedHeaders.includes("cheque/referencia")) {
      detectedId = "helisa";
      highestConfidence = 88;
    } else {
      // Perfil genérico
      highestConfidence = headers.length >= 6 ? 80 : 60;
    }
  }

  const mapping = buildMappingFromHeaders(headers, detectedId);

  return {
    id: detectedId,
    label: SOFTWARE_PROFILES[detectedId]?.label || "Personalizado",
    confidence: highestConfidence,
    headerRow: rowIndex,
    mapping,
    detectedHeaders: headers,
  };
}

const STORAGE_KEY_CUSTOM_MAPPINGS = "conciliador_custom_column_mappings_v1";

export function loadSavedCustomMappings(): Record<string, ColumnMapping> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_CUSTOM_MAPPINGS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveCustomMapping(profileName: string, mapping: ColumnMapping): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const saved = loadSavedCustomMappings();
    saved[profileName] = mapping;
    window.localStorage.setItem(STORAGE_KEY_CUSTOM_MAPPINGS, JSON.stringify(saved));
  } catch (err) {
    console.error("Error al guardar perfil de mapeo personalizado:", err);
  }
}
