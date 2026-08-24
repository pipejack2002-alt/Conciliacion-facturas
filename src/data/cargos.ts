import { FICHA } from "./ficha";
import { MODULES } from "./modules";
import type { CargoFamily, CargoProfile, FunctionGuide } from "./types";
import { TOPICS } from "./topics";

const ALL_MODULE_IDS = MODULES.map((m) => m.id);

export const SHARED_MODULE_IDS = [
  "cpaca",
  "constitucion-funcion",
  "sistema-tributario",
  "mipg-archivo",
  "servicio-pqrsf",
  "comportamiento-etico",
  "comunicacion-equipo",
  "codigo-integridad",
  "valores-cinco",
] as const;

const CARTERA_MODULE_IDS = [
  "ficha-empleo",
  "cobro-persuasivo",
  "cobro-coactivo",
  "medidas-cautelares",
  "devoluciones-compensaciones",
  "recaudo-ear",
  "control-extensivo",
  "procesos-concursales",
  ...SHARED_MODULE_IDS,
] as const;

function guidesFromTopics(
  moduleIds: string[],
  roleNotes: Record<string, string>,
): FunctionGuide[] {
  return moduleIds
    .map((id) => TOPICS.find((t) => t.moduleId === id))
    .filter((t): t is (typeof TOPICS)[number] => Boolean(t))
    .map((t) => ({
      topicId: t.id,
      functionTitle: t.title,
      howToResolve: t.how,
      steps: t.steps,
      typicalFail: t.trap,
      correctMove: t.correctMove,
      source: t.source,
      relatedModuleIds: [t.moduleId],
      roleNote: roleNotes[t.moduleId],
    }));
}

const analistaCarteraNotes: Record<string, string> = {
  "ficha-empleo":
    "Eres Analista II, nivel técnico: ejecutas labores técnicas. No diseñas la política ni firmas como Gestor.",
  "cobro-persuasivo":
    "Tú clasificas, contactas y registras. No decretas cautelares ni ‘perdonas’.",
  "cobro-coactivo":
    "Verificas expediente y proyectas. El mandamiento lo libra quien tenga competencia; tú impulsas el trámite.",
  "medidas-cautelares":
    "Apoyas la investigación de bienes y el registro. No ‘negocias’ el alzamiento.",
  "devoluciones-compensaciones":
    "Apoyas el trámite y la cuenta corriente. No giras por fuera del procedimiento.",
  "recaudo-ear":
    "Concilias reportes y corriges recibos. Nunca recibes efectivo.",
  "control-extensivo":
    "Orientas frente al requerimiento de campaña. No adelantas el acto.",
  "procesos-concursales":
    "Detectas el concurso y reportas. No sigues el remate como si nada.",
};

const gestorCarteraNotes: Record<string, string> = {
  "ficha-empleo":
    "Nivel profesional: priorizas, revisas calidad, proyectas o suscribes según competencia y respondes por términos.",
  "cobro-persuasivo":
    "Defines el lote y el momento de pasar a coactivo. El Analista ejecuta el contacto.",
  "cobro-coactivo":
    "Revisas título y competencia. Libras o elevas el mandamiento. Controlas prescripción.",
  "medidas-cautelares":
    "Decides, según competencia, el embargo preventivo simultáneo o previo al mandamiento. No en persuasivo.",
  "devoluciones-compensaciones":
    "Resuelves o proyectas el acto de devolución/rechazo/compensación. Primero depurar.",
  "recaudo-ear":
    "Exiges conciliación antes de firmar un cobro con pago alegado.",
  "control-extensivo":
    "Diriges la campaña y el criterio único de orientación. No asesorías privadas.",
  "procesos-concursales":
    "Reorientas el cobro y presentas la acreencia. No condonas.",
  "rol-gestor":
    "Asigna, revisa, deja instrucción escrita. No firmes sin competencia ni hagas el oficio del Analista para lucirte.",
};

const analistaFiscalNotes: Record<string, string> = {
  "ficha-empleo":
    "Analista II de fiscalización: armas el expediente, cruces y proyectos. No profieres la liquidación.",
  "fiscalizacion-determinacion":
    "Preparas hechos, pruebas y glosas del requerimiento. El Gestor decide el acto.",
  "control-extensivo":
    "Ejecutas cruces masivos y emplazamientos de campaña, con el mismo mensaje.",
  "inspeccion-visitas":
    "Si te asignan apoyo de visita, registras. No determinas en el predio.",
};

const gestorFiscalNotes: Record<string, string> = {
  "ficha-empleo":
    "Gestor de fiscalización: decides el programa del expediente y proyectas o suscribes el requerimiento y la liquidación según competencia.",
  "fiscalizacion-determinacion":
    "No saltes el requerimiento especial. Controla el término de respuesta (3 meses) y el de liquidar.",
  "control-extensivo":
    "El emplazamiento 705 no te ahorra el 703 cuando va revisión.",
  "rol-gestor":
    "Calidad del expediente antes del acto. El Analista arma; tú glosas y decides.",
};

const inspectorNotes: Record<string, string> = {
  "ficha-empleo":
    "Inspector: pruebas y hechos. No liquidas ni cobras en la visita.",
  "inspeccion-visitas":
    "Identifícate, respeta el objeto, acta los hechos, rechaza dádivas, traslada.",
  "fiscalizacion-determinacion":
    "Tu acta alimenta el requerimiento. No adelantes la liquidación.",
  "control-extensivo":
    "Si la visita nace de un programa masivo, no improvises un objeto distinto.",
};

export const DEFAULT_CARGO_ID = "analista-ii-cartera";

export const CATALOG: CargoProfile[] = [
  {
    id: DEFAULT_CARGO_ID,
    family: "analista",
    shortLabel: "Analista II",
    processLabel: "Cartera, recaudo y devoluciones",
    blurb:
      "Nivel técnico. Ejecutas clasificación de cartera, recaudo, devoluciones y cobro hasta el coactivo.",
    ficha: {
      formato: FICHA.formato,
      denominacion: FICHA.denominacion,
      codigo: FICHA.codigo,
      grado: FICHA.grado,
      nivel: FICHA.nivel,
      tipoEmpleo: FICHA.tipoEmpleo,
      codigoFicha: FICHA.codigoFicha,
      proceso: FICHA.proceso,
      subproceso: FICHA.subproceso,
      aplicacion: FICHA.aplicacion,
      proposito: FICHA.proposito,
      funciones: [...FICHA.funciones],
      estudios: FICHA.estudios,
      nbc: [...FICHA.nbc],
      experiencia: FICHA.experiencia,
      equivalencias: FICHA.equivalencias,
      competenciasFuncionales: [...FICHA.competenciasFuncionales],
      competenciasComportamentales: FICHA.competenciasComportamentales.map((c) => ({
        ...c,
      })),
      competenciasBasicas: [...FICHA.competenciasBasicas],
    },
    rolBoundary: {
      youDo: [
        "Clasificar, priorizar y verificar expedientes de cartera.",
        "Apoyar devoluciones, compensaciones y conciliación con EAR.",
        "Actualizar cuenta corriente y corregir inconsistencias.",
        "Impulsar cobro persuasivo y proyectar piezas del coactivo.",
        "Orientar por el canal institucional frente a un requerimiento de control.",
      ],
      youDont: [
        "Firmar mandamientos o liquidaciones si tu grado no tiene competencia.",
        "Decretar embargos en etapa persuasiva.",
        "Recibir dinero o ‘arreglar’ un saldo a mano.",
        "Asesorar la estrategia fiscal del contribuyente.",
      ],
      vsOthers:
        "El Gestor prioriza, revisa y decide el acto. El Inspector visita y acta. Tú ejecutas la técnica del expediente de cartera.",
    },
    examFocus: [
      "Mandamiento, títulos 828, excepciones 15 días, prescripción 5 años.",
      "Cautelares previa o simultáneas al mandamiento, nunca en persuasivo.",
      "Devolución 850 vs compensación 815 y cuenta corriente.",
      "CPACA 15/10/30 y recursos 10 días.",
      "Ético nivel 4 en Likert.",
    ],
    functionGuides: guidesFromTopics([...CARTERA_MODULE_IDS], analistaCarteraNotes),
    moduleIds: [...ALL_MODULE_IDS],
  },
  {
    id: "gestor-i-cartera",
    family: "gestor",
    shortLabel: "Gestor I",
    processLabel: "Cartera, recaudo y devoluciones",
    blurb:
      "Nivel profesional. Coordina al equipo técnico, controla términos y proyecta actos de recaudo.",
    ficha: {
      denominacion: "Gestor I",
      codigo: "301",
      grado: "01",
      nivel: "Nivel Profesional",
      tipoEmpleo: "Carrera Administrativa",
      proceso: "MISIONAL: Cumplimiento de obligaciones tributarias",
      subproceso: "Administración de cartera, Recaudo-Devoluciones",
      aplicacion: "Niveles Central y Seccional",
      proposito:
        "Gestionar la cartera, el recaudo y las devoluciones de competencia de la entidad, coordinando la operación técnica y proyectando los actos que correspondan, de acuerdo con la normativa, la delegación y el grado de responsabilidad del empleo.",
      funciones: [
        "Priorizar y asignar la cartera según cuantía, antigüedad y riesgo de prescripción.",
        "Revisar la calidad de expedientes, títulos ejecutivos y cuenta corriente antes del acto.",
        "Proyectar y, según competencia, impulsar mandamientos, facilidades y levantamientos de cautelares.",
        "Dirigir la conciliación con EAR y la depuración de saldos.",
        "Resolver o proyectar trámites de devolución y compensación con control previo.",
        "Hacer seguimiento a términos de cobro, excepciones y recursos.",
        "Orientar al equipo de Analistas y unificar criterio de campaña.",
        "Reportar al superior los casos de concurso, prescripción inminente o conflicto de interés.",
        "Las funciones comunes de planta y las que asigne la autoridad competente.",
      ],
      estudios:
        "Título profesional en NBC de Administración, Contaduría, Derecho, Economía o ingenierías administrativa, de sistemas o industrial.",
      nbc: [
        "Administración",
        "Contaduría Pública",
        "Derecho y afines",
        "Economía",
        "Ingeniería Administrativa y afines",
        "Ingeniería de Sistemas, Telemática y afines",
        "Ingeniería Industrial y afines",
      ],
      experiencia: "Sin experiencia o la que señale la OPEC específica.",
      equivalencias: true,
      competenciasFuncionales: [
        "Cobro coactivo",
        "Cobro persuasivo",
        "Medidas cautelares",
        "Devoluciones y compensaciones",
        "Técnicas administrativas para recaudar",
        "Procesos concursales",
      ],
      competenciasComportamentales: [
        { nombre: "Comportamiento ético", nivel: 4 },
        { nombre: "Orientación al logro", nivel: 3 },
        { nombre: "Comunicación efectiva", nivel: 3 },
        { nombre: "Trabajo en equipo", nivel: 3 },
      ],
    },
    rolBoundary: {
      youDo: [
        "Priorizar lotes y asignar al Analista.",
        "Revisar título y cuenta corriente antes del acto.",
        "Proyectar mandamiento, facilidad o rechazo de devolución.",
        "Controlar prescripción y excepciones.",
        "Unificar el criterio del grupo.",
      ],
      youDont: [
        "Firmar un acto sin competencia ni delegación.",
        "Hacer tú todas las citaciones para ‘cumplir la meta personal’.",
        "Dar trato preferente a un NIT influyente.",
        "Dejar prescribir porque el Analista ‘se atrasó’ sin seguimiento.",
      ],
      vsOthers:
        "El Analista ejecuta la técnica. Tú decides el rumbo del expediente y respondes por el término. El jefe de división define la política de la seccional.",
    },
    examFocus: [
      "Competencia para firmar vs. proyectar.",
      "Prescripción: el Gestor no puede ‘no enterarse’.",
      "Calidad del título y conciliación EAR antes del mandamiento.",
      "Mismos saberes de cobro que el Analista, con verbo de decisión.",
      "Ético 4 + logro y comunicación en 3.",
    ],
    functionGuides: guidesFromTopics(
      [...CARTERA_MODULE_IDS, "rol-gestor"],
      gestorCarteraNotes,
    ),
    moduleIds: [...CARTERA_MODULE_IDS, "rol-gestor"],
  },
  {
    id: "gestor-ii-cartera",
    family: "gestor",
    shortLabel: "Gestor II",
    processLabel: "Cartera, recaudo y devoluciones",
    blurb:
      "Mayor complejidad y cuantía. Dirige Analistas, suscribe más actos y responde por la meta de recaudo con debido proceso.",
    ficha: {
      denominacion: "Gestor II",
      codigo: "302",
      grado: "02",
      nivel: "Nivel Profesional",
      tipoEmpleo: "Carrera Administrativa",
      proceso: "MISIONAL: Cumplimiento de obligaciones tributarias",
      subproceso: "Administración de cartera, Recaudo-Devoluciones",
      aplicacion: "Niveles Central y Seccional",
      proposito:
        "Dirigir técnicamente la gestión de cartera, recaudo y devoluciones de mayor complejidad, adoptando o proyectando los actos de competencia del empleo y asegurando la calidad, el recaudo y el debido proceso.",
      funciones: [
        "Liderar la priorización de la cartera de mayor cuantía y riesgo.",
        "Suscribir o proyectar mandamientos, resoluciones de excepciones, facilidades y actos de devolución según delegación.",
        "Resolver, en su grado, controversias de cuenta corriente y de EAR.",
        "Coordinar la relación con procesos de fiscalización cuando el título nace de una liquidación oficial.",
        "Asegurar que las cautelares se decreten en el momento legal y se levanten solo por causa.",
        "Hacer seguimiento a concursos, sucesiones y acreencias fiscales.",
        "Evaluar la calidad del trabajo del equipo técnico y devolver expedientes incompletos.",
        "Las funciones comunes de planta y las que asigne la autoridad competente.",
      ],
      estudios:
        "Título profesional en NBC de Administración, Contaduría, Derecho, Economía o ingenierías afines. La OPEC puede exigir experiencia.",
      nbc: [
        "Administración",
        "Contaduría Pública",
        "Derecho y afines",
        "Economía",
        "Ingeniería Administrativa y afines",
        "Ingeniería de Sistemas, Telemática y afines",
        "Ingeniería Industrial y afines",
      ],
      experiencia: "La que señale la OPEC (habitualmente un año o más).",
      equivalencias: true,
      competenciasFuncionales: [
        "Cobro coactivo",
        "Medidas cautelares",
        "Devoluciones y compensaciones",
        "Procesos concursales",
        "Control de términos y calidad del acto",
      ],
      competenciasComportamentales: [
        { nombre: "Comportamiento ético", nivel: 4 },
        { nombre: "Orientación al logro", nivel: 3 },
        { nombre: "Comunicación efectiva", nivel: 3 },
        { nombre: "Trabajo en equipo", nivel: 3 },
        { nombre: "Adaptabilidad", nivel: 3 },
      ],
    },
    rolBoundary: {
      youDo: [
        "Decidir el acto en expedientes de mayor cuantía.",
        "Resolver excepciones o proyectar la resolución.",
        "Coordinar fiscalización y cobro cuando el título es una liquidación oficial.",
        "Devolver al Analista un expediente incompleto, con observación.",
      ],
      youDont: [
        "Sacrificar el debido proceso por el indicador de recaudo.",
        "Levantar un embargo ‘de favor’.",
        "Usar la meta para atropellar una excepción válida.",
      ],
      vsOthers:
        "Más decisión que el Gestor I y el Analista. Sigue sin ser el Subdirector: la competencia escrita manda.",
    },
    examFocus: [
      "Excepciones al mandamiento y cuándo prosperan.",
      "Cautelares excesivas vs. inembargabilidad.",
      "Concurso (Ley 1116) y reorientación del cobro.",
      "Justicia: mismo procedimiento al grande y al pequeño.",
    ],
    functionGuides: guidesFromTopics(
      [...CARTERA_MODULE_IDS, "rol-gestor"],
      gestorCarteraNotes,
    ),
    moduleIds: [...CARTERA_MODULE_IDS, "rol-gestor"],
  },
  {
    id: "analista-ii-fiscalizacion",
    family: "analista",
    shortLabel: "Analista II",
    processLabel: "Fiscalización tributaria",
    blurb:
      "Armas el expediente de inexactos y omisos: cruces, emplazamientos y proyectos de requerimiento.",
    ficha: {
      denominacion: "Analista II",
      codigo: "202",
      grado: "02",
      nivel: "Nivel Técnico",
      tipoEmpleo: "Carrera Administrativa",
      proceso: "MISIONAL: Fiscalización tributaria",
      subproceso: "Control extensivo y apoyo a la determinación",
      aplicacion: "Niveles Central y Seccional",
      proposito:
        "Ejecutar labores técnicas de apoyo a la fiscalización y al control de obligaciones tributarias, conforme a la normativa, los sistemas institucionales y el grado de responsabilidad del empleo.",
      funciones: [
        "Adelantar cruces de información exógena, RUT y declaraciones.",
        "Preparar emplazamientos para declarar o corregir en programas masivos.",
        "Armar el expediente de inexactitud: hechos, papeles de trabajo y pruebas.",
        "Proyectar piezas del requerimiento especial para revisión del Gestor.",
        "Apoyar visitas en lo documental, sin determinar el tributo.",
        "Orientar al obligado por el canal institucional frente a la campaña.",
        "Actualizar el sistema de fiscalización y la trazabilidad del caso.",
        "Las funciones comunes de planta.",
      ],
      estudios:
        "Técnico profesional, tecnológico o tres años de profesional en NBC de Administración, Contaduría, Derecho, Economía o ingenierías afines.",
      nbc: [
        "Administración",
        "Contaduría Pública",
        "Derecho y afines",
        "Economía",
        "Ingeniería Administrativa y afines",
        "Ingeniería de Sistemas, Telemática y afines",
        "Ingeniería Industrial y afines",
      ],
      experiencia: "Un (1) año de experiencia laboral, o la que señale la OPEC.",
      equivalencias: true,
      competenciasFuncionales: [
        "Control extensivo de obligaciones",
        "Fiscalización y determinación (apoyo)",
        "Papeles de trabajo y prueba",
        "Sistemas de información de fiscalización",
      ],
      competenciasComportamentales: [
        { nombre: "Comportamiento ético", nivel: 4 },
        { nombre: "Comunicación efectiva", nivel: 2 },
        { nombre: "Adaptabilidad", nivel: 2 },
        { nombre: "Trabajo en equipo", nivel: 2 },
      ],
    },
    rolBoundary: {
      youDo: [
        "Cruzar datos y armar papeles de trabajo.",
        "Proyectar emplazamientos y piezas del 703.",
        "Mantener el sistema al día.",
        "Orientar con el mensaje de la campaña.",
      ],
      youDont: [
        "Proferir la liquidación de revisión o de aforo.",
        "Asesorar cómo ‘maquillar’ la declaración.",
        "Saltar el requerimiento especial ‘porque no hay tiempo’.",
      ],
      vsOthers:
        "El Gestor decide el acto de determinación. El Inspector visita. Tú construyes el expediente técnico.",
    },
    examFocus: [
      "Requerimiento especial 703 vs emplazamiento 705 vs aforo 717.",
      "Tres meses para responder el 703 (art. 707).",
      "Omiso vs inexacto: cadenas distintas.",
      "CPACA, Constitución y MIPG (gestión pública de todos los cargos).",
    ],
    functionGuides: guidesFromTopics(
      [
        "ficha-empleo",
        "fiscalizacion-determinacion",
        "control-extensivo",
        "inspeccion-visitas",
        ...SHARED_MODULE_IDS,
      ],
      analistaFiscalNotes,
    ),
    moduleIds: [
      "ficha-empleo",
      "fiscalizacion-determinacion",
      "control-extensivo",
      "inspeccion-visitas",
      "devoluciones-compensaciones",
      "sistema-tributario",
      ...SHARED_MODULE_IDS,
    ],
  },
  {
    id: "gestor-ii-fiscalizacion",
    family: "gestor",
    shortLabel: "Gestor II",
    processLabel: "Fiscalización tributaria",
    blurb:
      "Determina: requerimiento especial, liquidación de revisión o aforo, según competencia y término.",
    ficha: {
      denominacion: "Gestor II",
      codigo: "302",
      grado: "02",
      nivel: "Nivel Profesional",
      tipoEmpleo: "Carrera Administrativa",
      proceso: "MISIONAL: Fiscalización tributaria",
      subproceso: "Determinación oficial y programas de control",
      aplicacion: "Niveles Central y Seccional",
      proposito:
        "Adelantar la fiscalización y la determinación oficial de obligaciones tributarias, proyectando o suscribiendo los actos de competencia del empleo y asegurando el debido proceso.",
      funciones: [
        "Dirigir el programa del expediente: inexacto u omiso.",
        "Proferir o proyectar el requerimiento especial con hechos, pruebas y glosas.",
        "Evaluar la respuesta del contribuyente (art. 707) y liquidar de revisión en término.",
        "Proferir o proyectar emplazamientos para declarar y liquidaciones de aforo.",
        "Ordenar o coordinar visitas con objeto delimitado.",
        "Garantizar reserva tributaria y cadena de pruebas.",
        "Trasladar el acto ejecutoriado a cobro cuando haya suma líquida.",
        "Las funciones comunes de planta.",
      ],
      estudios:
        "Título profesional en NBC de Administración, Contaduría, Derecho, Economía o ingenierías afines.",
      nbc: [
        "Administración",
        "Contaduría Pública",
        "Derecho y afines",
        "Economía",
        "Ingeniería Administrativa y afines",
        "Ingeniería de Sistemas, Telemática y afines",
        "Ingeniería Industrial y afines",
      ],
      experiencia: "La que señale la OPEC.",
      equivalencias: true,
      competenciasFuncionales: [
        "Determinación oficial",
        "Requerimiento especial y liquidación de revisión",
        "Aforo de omisos",
        "Control de términos de fiscalización",
        "Dirección de visitas",
      ],
      competenciasComportamentales: [
        { nombre: "Comportamiento ético", nivel: 4 },
        { nombre: "Orientación al logro", nivel: 3 },
        { nombre: "Comunicación efectiva", nivel: 3 },
        { nombre: "Trabajo en equipo", nivel: 3 },
      ],
    },
    rolBoundary: {
      youDo: [
        "Decidir si el caso es revisión o aforo.",
        "Proferir el 703 con hechos y pruebas.",
        "Liquidar después de la respuesta o del silencio, en término.",
        "Ordenar la visita con objeto claro.",
      ],
      youDont: [
        "Liquidar de revisión sin requerimiento especial (regla general).",
        "Usar aforo contra quien sí declaró.",
        "Pactar de palabra una corrección a cambio de no actuar.",
      ],
      vsOthers:
        "El Analista arma el cruce. El Inspector acta la visita. Tú determinas. El cobro llega cuando el acto está ejecutoriado.",
    },
    examFocus: [
      "Cadena de revisión (703 → 707 → 713) vs cadena de omiso (715 → 717).",
      "Contenido del requerimiento especial (704).",
      "El acto ejecutoriado es título 828-2.",
      "Reserva y conflicto de interés.",
    ],
    functionGuides: guidesFromTopics(
      [
        "ficha-empleo",
        "rol-gestor",
        "fiscalizacion-determinacion",
        "control-extensivo",
        "inspeccion-visitas",
        ...SHARED_MODULE_IDS,
      ],
      { ...gestorFiscalNotes, ...gestorCarteraNotes },
    ),
    moduleIds: [
      "ficha-empleo",
      "rol-gestor",
      "fiscalizacion-determinacion",
      "control-extensivo",
      "inspeccion-visitas",
      "cobro-coactivo",
      "sistema-tributario",
      ...SHARED_MODULE_IDS,
    ],
  },
  {
    id: "inspector-ii-fiscalizacion",
    family: "inspector",
    shortLabel: "Inspector II",
    processLabel: "Fiscalización tributaria",
    blurb:
      "Practica visitas, recoge pruebas y deja actas. No determina el tributo en el predio.",
    ficha: {
      denominacion: "Inspector II",
      codigo: "302",
      grado: "02",
      nivel: "Nivel Profesional",
      tipoEmpleo: "Carrera Administrativa",
      proceso: "MISIONAL: Fiscalización tributaria",
      subproceso: "Inspección, visita y material probatorio",
      aplicacion: "Niveles Central y Seccional",
      proposito:
        "Practicar inspecciones, visitas y demás diligencias de prueba en la fiscalización tributaria, dejando constancia fidedigna de los hechos, de acuerdo con la normativa y el objeto del acto que ordena la diligencia.",
      funciones: [
        "Practicar visitas e inspecciones con identificación y objeto delimitado.",
        "Recoger documentos, testimonios y otras pruebas con cadena de custodia.",
        "Elaborar actas que relaten hechos, no acuerdos de recaudo.",
        "Informar hallazgos al Gestor o al competente para el requerimiento.",
        "Guardar reserva de la información tributaria.",
        "Rechazar dádivas y reportar presiones indebidas.",
        "Las funciones comunes de planta.",
      ],
      estudios:
        "Título profesional en NBC de Administración, Contaduría, Derecho, Economía o ingenierías afines.",
      nbc: [
        "Administración",
        "Contaduría Pública",
        "Derecho y afines",
        "Economía",
        "Ingeniería Administrativa y afines",
        "Ingeniería de Sistemas, Telemática y afines",
        "Ingeniería Industrial y afines",
      ],
      experiencia: "La que señale la OPEC.",
      equivalencias: true,
      competenciasFuncionales: [
        "Visitas e inspecciones",
        "Material probatorio",
        "Actas de diligencia",
        "Facultades de fiscalización (apoyo)",
      ],
      competenciasComportamentales: [
        { nombre: "Comportamiento ético", nivel: 4 },
        { nombre: "Diligencia / orientación al detalle", nivel: 3 },
        { nombre: "Comunicación efectiva", nivel: 3 },
        { nombre: "Adaptabilidad", nivel: 2 },
      ],
    },
    rolBoundary: {
      youDo: [
        "Identificarte y delimitar el objeto.",
        "Actar hechos y documentos.",
        "Custodiar la prueba.",
        "Trasladar el informe al que determina.",
      ],
      youDont: [
        "Liquidar o ‘cerrar’ el caso en el predio.",
        "Recibir almuerzo, dinero o favores del visitado.",
        "Exceder el objeto del acto que ordena la visita.",
        "Omitir un hallazgo porque el visitado lo pidió.",
      ],
      vsOthers:
        "No eres el Gestor que determina ni el Analista de escritorio. Eres la prueba en terreno. Sin acta sólida, el 703 se cae.",
    },
    examFocus: [
      "Acta: hechos, renuencia a firmar, objeto delimitado.",
      "Dádiva = rechazo + rastro.",
      "La liquidación no se firma en la visita.",
      "Reserva tributaria.",
      "Cadena 684 → visita → 703 → 713 (tu eslabón es la visita).",
    ],
    functionGuides: guidesFromTopics(
      [
        "ficha-empleo",
        "inspeccion-visitas",
        "fiscalizacion-determinacion",
        "control-extensivo",
        ...SHARED_MODULE_IDS,
      ],
      inspectorNotes,
    ),
    moduleIds: [
      "ficha-empleo",
      "inspeccion-visitas",
      "fiscalizacion-determinacion",
      "control-extensivo",
      "sistema-tributario",
      ...SHARED_MODULE_IDS,
    ],
  },
];

export const ALLOWED_MODULE_IDS = [
  ...ALL_MODULE_IDS,
  "rol-gestor",
  "fiscalizacion-determinacion",
  "inspeccion-visitas",
];

export function catalogCargo(id: string): CargoProfile | undefined {
  return CATALOG.find((c) => c.id === id);
}

export function familyLabel(family: CargoFamily) {
  if (family === "analista") return "Analista";
  if (family === "gestor") return "Gestor";
  if (family === "inspector") return "Inspector";
  if (family === "facilitador") return "Facilitador";
  return "Otro";
}
