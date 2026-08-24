export type TrackId = "funcional" | "comportamental" | "integridad";

export type QuestionKind = "sjt" | "knowledge" | "likert" | "dilemma";

export type Difficulty = 1 | 2 | 3;

export type CargoFamily =
  | "analista"
  | "gestor"
  | "inspector"
  | "facilitador"
  | "otro";

export interface Choice {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  track: TrackId;
  moduleId: string;
  kind: QuestionKind;
  caseText?: string;
  stem: string;
  choices: Choice[];
  correct: string;
  explanation: string;
  source?: string;
  difficulty: Difficulty;
}

export interface KeyPoint {
  title: string;
  body: string;
}

export interface Module {
  id: string;
  track: TrackId;
  number: string;
  title: string;
  minutes: number;
  summary: string;
  why: string;
  points: KeyPoint[];
  examTips: string[];
  sources: string[];
}

export interface Flashcard {
  id: string;
  moduleId: string;
  track: TrackId;
  front: string;
  back: string;
}

export interface TopicGuide {
  id: string;
  title: string;
  how: string;
  steps: string[];
  trap: string;
  correctMove: string;
  source: string;
  moduleId: string;
}

export interface CargoFicha {
  formato?: string;
  denominacion: string;
  codigo: string;
  grado: string;
  nivel: string;
  tipoEmpleo: string;
  codigoFicha?: string;
  proceso: string;
  subproceso: string;
  aplicacion: string;
  proposito: string;
  funciones: string[];
  estudios: string;
  nbc: string[];
  experiencia: string;
  equivalencias: boolean;
  competenciasFuncionales: string[];
  competenciasComportamentales: { nombre: string; nivel: number }[];
  competenciasBasicas?: string[];
}

export interface FunctionGuide {
  topicId?: string;
  functionTitle: string;
  howToResolve: string;
  steps: string[];
  typicalFail: string;
  correctMove: string;
  source: string;
  relatedModuleIds: string[];
  roleNote?: string;
}

export interface CargoProfile {
  id: string;
  family: CargoFamily;
  shortLabel: string;
  processLabel: string;
  blurb: string;
  custom?: boolean;
  ficha: CargoFicha;
  rolBoundary: {
    youDo: string[];
    youDont: string[];
    vsOthers: string;
  };
  examFocus: string[];
  functionGuides: FunctionGuide[];
  moduleIds: string[];
  questions?: Question[];
}

export const TRACKS: Record<
  TrackId,
  { label: string; short: string; blurb: string; nature: string }
> = {
  funcional: {
    label: "Prueba funcional",
    short: "Funcional",
    blurb:
      "Conocimientos del MERF de tu empleo (D.L. 927 art. 58). Eliminatoria.",
    nature: "Eliminatoria · conocimientos y juicio situacional",
  },
  comportamental: {
    label: "Prueba comportamental",
    short: "Comportamental",
    blurb:
      "Diccionario de competencias DIAN (D.L. 927 art. 59). Clasificatoria.",
    nature: "Clasificatoria · Likert y situaciones",
  },
  integridad: {
    label: "Prueba de integridad",
    short: "Integridad",
    blurb:
      "Coherencia de creencias y actuación por el bien común (Anexo 2676). Clasificatoria.",
    nature: "Clasificatoria · dilemas y valores",
  },
};

export const CARGO_FAMILIES: Record<
  CargoFamily,
  { label: string; levelHint: string }
> = {
  analista: {
    label: "Analista",
    levelHint: "Nivel técnico · ejecuta y verifica",
  },
  gestor: {
    label: "Gestor",
    levelHint: "Nivel profesional · decide y coordina",
  },
  inspector: {
    label: "Inspector",
    levelHint: "Nivel profesional · prueba y verifica en terreno",
  },
  facilitador: {
    label: "Facilitador",
    levelHint: "Nivel asistencial · apoya la operación",
  },
  otro: { label: "Otro empleo", levelHint: "Según tu manual" },
};
