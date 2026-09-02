export type Grupo = "Emitido" | "Recibido";

export type DianDoc = {
  tipo: string;
  cufe: string;
  folio: string;
  prefijo: string;
  fechaEmision: string;
  fechaRecepcion: string;
  nitEmisor: string;
  nombreEmisor: string;
  nitReceptor: string;
  nombreReceptor: string;
  iva: number;
  total: number;
  estadoDian: string;
  grupo: string;
};

export type MovLine = {
  cuenta: string;
  cuentaNombre: string;
  comprobante: string;
  fecha: string;
  nit: string;
  nombre: string;
  descripcion: string;
  cruce: string;
  debito: number;
  credito: number;
  observacion: string;
  referencia?: string;
  origenSoftware?: string;
};

export type SoftwareProfileId =
  | "auto"
  | "siigo_pyme"
  | "siigo_nube"
  | "world_office"
  | "helisa"
  | "alegra"
  | "loggro"
  | "sap"
  | "custom";

export type ColumnKey =
  | "cuenta"
  | "cuentaNombre"
  | "comprobante"
  | "fecha"
  | "nit"
  | "nombre"
  | "descripcion"
  | "cruce"
  | "referencia"
  | "debito"
  | "credito"
  | "observacion";

export type ColumnMapping = Partial<Record<ColumnKey, number>>;

export type DetectedProfile = {
  id: SoftwareProfileId;
  label: string;
  confidence: number;
  headerRow: number;
  mapping: ColumnMapping;
  detectedHeaders: string[];
};

export type SampleBundle = {
  period: string;
  dian: DianDoc[];
  mov: MovLine[];
};

export type EstadoConciliacion =
  | "conciliado"
  | "totalizado"
  | "diferencia"
  | "pendiente"
  | "no_aplica"
  | "solo_siigo"
  | "duplicado"
  | "cruce_nc"
  | "posible_typo";

export type MovHit = {
  comprobante: string;
  fecha: string;
  nit: string;
  nombre: string;
  descripcion: string;
  cruce: string;
  cuenta: string;
  debito: number;
  credito: number;
};

export type LinkedDoc = {
  id: string;
  numero: string;
  tipo: string;
  total: number;
};

export type ConciliacionRow = {
  id: string;
  estado: EstadoConciliacion;
  grupo: Grupo | string;
  tipo: string;
  prefijo: string;
  folio: string;
  numero: string;
  cufe: string;
  fecha: string;
  nitContraparte: string;
  nombreContraparte: string;
  iva: number;
  totalDian: number;
  totalSiigo: number;
  diferencia: number;
  hits: MovHit[];
  comprobantes: string[];
  matchVia: string;
  prioridad: "audit" | "secundario";
  linked: LinkedDoc[];
  alerta: string;
};

export type OrphanMov = {
  id: string;
  comprobante: string;
  fecha: string;
  nit: string;
  nombre: string;
  descripcion: string;
  cruce: string;
  cuenta: string;
  debito: number;
  credito: number;
};

export type CruceNC = {
  id: string;
  nit: string;
  nombre: string;
  facturaId: string;
  facturaNumero: string;
  notaId: string;
  notaNumero: string;
  valor: number;
  facturaEstado: EstadoConciliacion;
  notaEstado: EstadoConciliacion;
};

export type CompanyInfo = {
  nit: string;
  nombre: string;
  dv?: string;
};

export type Totales = {
  documentos: number;
  recibidos: number;
  conciliados: number;
  totalizados: number;
  pendientes: number;
  pendientesRecibidos: number;
  diferencias: number;
  duplicados: number;
  crucesNc: number;
  noAplica: number;
  soloSiigo: number;
  valorDian: number;
  valorPendiente: number;
  valorPendienteRecibido: number;
  valorTotalizado: number;
  valorDiferencia: number;
  pctRecibidos: number;
  pctConciliado: number;
  cola: number;
  valorCola: number;
};

export type ConciliacionResult = {
  periodLabel: string;
  company: CompanyInfo;
  rows: ConciliacionRow[];
  orphans: OrphanMov[];
  cruzes: CruceNC[];
  totals: Totales;
  periodWarning?: string;
};

