import { ALLOWED_MODULE_IDS, SHARED_MODULE_IDS } from "@/data/cargos";
import { TOPICS } from "@/data/topics";
import type {
  CargoFamily,
  CargoProfile,
  FunctionGuide,
  Question,
} from "@/data/types";

const FUNCTION_START =
  /^(Brindar|Apoyar|Asistir|Aplicar|Tramitar|Adelantar|Prestar|Orientar|Ejecutar|Dirigir|Coordinar|Liderar|Realizar|Verificar|Proyectar|Suscribir|Controlar|Gestionar|Analizar|Identificar|Participar|Supervisar|Revisar|Formular|Adoptar|Impartir|Evaluar|Hacer|Elaborar|Expedir|Notificar|Liquidar|Determinar|Practicar|Inspeccionar|Visitar|Promover|Implementar|Contribuir|Las se[nñ]aladas|Las dem[aá]s)\b/i;

const SKIP_HEADERS =
  /^(Funciones|Superior|Prop[oó]sito|Identificaci[oó]n|Requisitos|Ubicaci[oó]n|Dependencia|Tipo de|DESCRIPCI[OÓ]N|Versi[oó]n|Proceso|Subproceso|C[oó]digo|Estudios|NBC|Equivalencias|Competencias|CONTROL|Denominaci[oó]n|Aplicaci[oó]n|Desde|Hasta|A[nñ]o)/i;

const MODULE_HINTS: { re: RegExp; id: string }[] = [
  { re: /cobro persuasivo|persuasiv/i, id: "cobro-persuasivo" },
  { re: /cobro coactivo|mandamiento|coactiv/i, id: "cobro-coactivo" },
  { re: /cautelar|embargo|secuestro/i, id: "medidas-cautelares" },
  { re: /devoluci[oó]n|compensaci/i, id: "devoluciones-compensaciones" },
  {
    re: /entidades autorizadas|recaud|cuenta corriente|recibo de pago|\bEAR\b/i,
    id: "recaudo-ear",
  },
  {
    re: /control extensivo|emplazamiento|requerimiento de control|campa[nñ]as realizadas/i,
    id: "control-extensivo",
  },
  { re: /concursal|insolvencia|ley 1116/i, id: "procesos-concursales" },
  {
    re: /fiscalizaci[oó]n|liquidaci[oó]n oficial|requerimiento especial|determinaci[oó]n/i,
    id: "fiscalizacion-determinacion",
  },
  {
    re: /inspecci[oó]n|visita de|acta de visita|pruebas en terreno/i,
    id: "inspeccion-visitas",
  },
  { re: /\bcpaca\b|petici[oó]n|ley 1437|ley 1755/i, id: "cpaca" },
  { re: /constituci[oó]n pol[ií]tica|art[ií]culo 209|m[eé]rito/i, id: "constitucion-funcion" },
  { re: /sistema tributario|teor[ií]a de la imposici[oó]n|evasi[oó]n/i, id: "sistema-tributario" },
  { re: /\bmipg\b|gesti[oó]n documental|archivo/i, id: "mipg-archivo" },
  { re: /\bpqrsf\b|servicio al ciudadano/i, id: "servicio-pqrsf" },
];

const KNOWN_COMPS = [
  "Comportamiento ético",
  "Adaptabilidad",
  "Comunicación efectiva",
  "Trabajo en equipo",
  "Orientación al logro",
  "Orientación al usuario y al ciudadano",
];

function clean(s: string) {
  return s.replace(/\s+/g, " ").replace(/\s+([.,;:])/g, "$1").trim();
}

function clip(s: string, n: number) {
  const t = clean(s);
  return t.length <= n ? t : `${t.slice(0, n - 1).trim()}…`;
}

function snippet(fn: string) {
  const t = clean(fn);
  const first = t.split(/,(?=\s)/)[0];
  if (first.length >= 32 && first.length <= 120) {
    return first.endsWith(".") ? first : `${first}.`;
  }
  return clip(t, 130);
}

function asFamily(denominacion: string, nivel: string, text: string): CargoFamily {
  const blob = `${denominacion} ${nivel} ${text.slice(0, 1500)}`;
  if (/inspector/i.test(blob)) return "inspector";
  if (/facilitador|auxiliar|asistencial/i.test(blob)) return "facilitador";
  if (/\bgestor/i.test(blob)) return "gestor";
  if (/analista/i.test(blob)) return "analista";
  if (/nivel profesional/i.test(nivel)) return "gestor";
  if (/nivel t[eé]cnico/i.test(nivel)) return "analista";
  return "otro";
}

function extractDenominacion(text: string): string {
  const a = text.match(
    /empleo:\s*([A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜü0-9. ]{2,48}?)(?:\s+C[oó]d|\s+C[oó]digo|\s+Grado)/i,
  );
  if (a?.[1]) return clean(a[1]);
  const b = text.match(
    /Denominaci[oó]n(?:\s+del\s+empleo)?[:\s]+([A-ZÁÉÍÓÚÑÜ][^\n]{2,48})/i,
  );
  if (b?.[1]) return clean(b[1].replace(/\s+C[oó]d.*$/i, ""));
  const c = text.match(
    /\b(Analista(?:\s+[IVX]+)?|Gestor(?:\s+[IVX]+)?|Inspector(?:\s+[IVX]+)?|Facilitador(?:\s+[IVX]+)?)\b/i,
  );
  return c ? clean(c[1]) : "";
}

function extractCodigoGrado(text: string): { codigo: string; grado: string } {
  const labeled = text.match(
    /C[oó]d(?:igo)?[:\s]*(\d{2,4})[^\d]{0,12}Grado[:\s]*(\d{1,2})/i,
  );
  if (labeled) {
    return { codigo: labeled[1], grado: labeled[2].padStart(2, "0") };
  }
  const pair = text.match(/\b([1234]\d{2})\s+(0[1-9]|[1-9]\d)\b/);
  if (pair) return { codigo: pair[1], grado: pair[2] };
  return { codigo: "—", grado: "—" };
}

function extractNivel(text: string): string {
  const a = text.match(/Nivel Jer[aá]rquico:\s*(Nivel\s+[A-Za-záéíóúñ]+)/i);
  if (a?.[1]) return clean(a[1]);
  const b = text.match(/Nivel\s+(T[eé]cnico|Profesional|Asistencial)/i);
  return b ? `Nivel ${b[1]}` : "";
}

function extractProposito(text: string): string {
  const idx = text.search(/Prop[oó]sito principal/i);
  const slice =
    idx >= 0 ? text.slice(idx).replace(/Prop[oó]sito principal/i, "") : text;
  const m = slice.match(
    /\s*((?:Ejecutar|Dirigir|Realizar|Coordinar|Liderar|Adelantar|Apoyar)[\s\S]{50,500}?\.)/,
  );
  return m ? clean(m[1]) : "";
}

function extractFunctions(text: string): string[] {
  const start = text.search(/Funciones esenciales/i);
  const end = text.search(
    /Requisitos del empleo|N[uú]cleos B[aá]sicos|Competencias Funcionales\b/i,
  );
  const chunk =
    start >= 0
      ? text.slice(start, end > start ? end : undefined)
      : text;
  const lines = chunk
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const merged: string[] = [];
  for (const line of lines) {
    if (
      merged.length &&
      !FUNCTION_START.test(line) &&
      !SKIP_HEADERS.test(line)
    ) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${line}`;
    } else {
      merged.push(line);
    }
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of merged) {
    const item = clean(p);
    if (item.length < 55) continue;
    if (!FUNCTION_START.test(item)) continue;
    if (/^Ejecutar labores t[eé]cnicas en la gesti[oó]n del proceso/i.test(item)) {
      continue;
    }
    const key = item.slice(0, 52).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 12);
}

function extractFuncionales(text: string): string[] {
  const known = [
    "Control extensivo de obligaciones",
    "Devoluciones y compensaciones",
    "Cobro coactivo",
    "Cobro persuasivo",
    "Medidas cautelares",
    "Procesos concursales",
    "Técnicas administrativas para recaudar",
    "Fiscalización y determinación",
    "Inspección y visitas",
  ];
  const found = known.filter((k) => new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text));
  if (found.length) return found;

  const block = text.match(
    /Competencias Funcionales(?!\s+Básicas)\s+([\s\S]+?)Competencias Comportamentales(?!\s+Básicas)/i,
  );
  const chunk = block?.[1] ?? "";
  const parts = chunk
    .split(/[.\n]/)
    .map((s) => clean(s.replace(/^Nombre Nivel.*$/i, "")))
    .filter((s) => s.length > 6 && s.length < 80 && !/^(Nombre|Nivel)$/i.test(s));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out.slice(0, 12);
}

function extractComportamentales(text: string): { nombre: string; nivel: number }[] {
  const found: { nombre: string; nivel: number }[] = [];
  for (const nombre of KNOWN_COMPS) {
    const re = new RegExp(
      nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s+([1-4])",
      "i",
    );
    const m = text.match(re);
    if (m) found.push({ nombre, nivel: Number(m[1]) });
  }
  if (found.length) return found;
  return [{ nombre: "Comportamiento ético", nivel: 4 }];
}

function extractNbc(text: string): string[] {
  const out: string[] = [];
  const re = /NBC:\s*([A-ZÁÉÍÓÚÑÜa-záéíóúñü ,/-]+?)(?=\s*NBC:|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = clean(m[1])
      .replace(/\s+NBC$/i, "")
      .toLocaleLowerCase("es")
      .replace(/(^|[\s/,-])(\S)/g, (_, a, b) => a + b.toLocaleUpperCase("es"));
    if (raw.length > 3) out.push(raw);
  }
  return [...new Set(out)].slice(0, 10);
}

function extractEstudios(text: string): string {
  const m = text.match(
    /Estudios\s+([\s\S]{40,500}?)(?:N[uú]cleos B[aá]sicos|NBC:|Equivalencias|Tipo de experiencia)/i,
  );
  return m ? clean(m[1]) : "";
}

function extractExperiencia(text: string): string {
  const m = text.match(
    /(?:Tipo de experiencia[^\n]*:\s*)?([^\n]{8,90}experiencia[^\n.]{0,40})/i,
  );
  return m ? clean(m[1]) : "";
}

function matchModules(blob: string): string[] {
  const ids = new Set<string>(["ficha-empleo"]);
  for (const hint of MODULE_HINTS) {
    if (hint.re.test(blob) && ALLOWED_MODULE_IDS.includes(hint.id)) {
      ids.add(hint.id);
    }
  }
  for (const id of SHARED_MODULE_IDS) ids.add(id);
  return [...ids];
}

function roleNote(family: CargoFamily, moduleId?: string): string {
  if (family === "gestor") {
    return "Tú priorizas, revisas y decides o proyectas según competencia. El Analista ejecuta la técnica.";
  }
  if (family === "inspector") {
    return "Tú pruebas y actas hechos. No liquidas ni cobras en la visita.";
  }
  if (moduleId === "cobro-coactivo") {
    return "Tú verificas expediente y proyectas. El mandamiento lo libra quien tenga competencia.";
  }
  return "Ejecutas la función de la ficha. No firmes actos ni definas política si tu grado no lo permite.";
}

function boundaries(
  family: CargoFamily,
  shortLabel: string,
  processLabel: string,
  funciones: string[],
): CargoProfile["rolBoundary"] {
  const snippets = funciones.slice(0, 3).map((f) => snippet(f));
  if (family === "gestor") {
    return {
      youDo: [
        "Priorizar, asignar y controlar términos del equipo técnico.",
        "Proyectar o suscribir actos según tu competencia y delegación.",
        ...snippets,
      ].slice(0, 5),
      youDont: [
        "Firmar un acto sin competencia ni delegación.",
        "Hacer tú todas las tareas del Analista para ‘cumplir la meta personal’.",
        "Dar trato preferente a un NIT influyente.",
        "Dejar prescribir un expediente sin seguimiento.",
      ],
      vsOthers: `${shortLabel} (${processLabel}): decides el rumbo del expediente. El Analista ejecuta la técnica. El Inspector visita y acta.`,
    };
  }
  if (family === "inspector") {
    return {
      youDo: [
        "Identificarte, delimitar el objeto y actar los hechos de la visita.",
        "Recoger pruebas con cadena de custodia y trasladarlas al expediente.",
        ...snippets,
      ].slice(0, 5),
      youDont: [
        "Liquidar, embargar o ‘cerrar el caso’ en el predio.",
        "Aceptar dádivas, almuerzos o ‘datos extraoficiales’ del visitado.",
        "Ampliar el objeto de la visita por curiosidad.",
      ],
      vsOthers: `${shortLabel}: pruebas y hechos. El Gestor determina. El Analista arma el expediente en sede.`,
    };
  }
  return {
    youDo: [
      "Ejecutar las funciones esenciales con el procedimiento y el sistema institucional.",
      ...snippets,
    ].slice(0, 5),
    youDont: [
      "Firmar mandamientos, liquidaciones o resoluciones si tu grado no tiene competencia.",
      "Improvisar un criterio distinto al del nivel central.",
      "Atender un trámite oficial por canal personal (WhatsApp, correo propio).",
      "Asesorar la estrategia fiscal del obligado.",
    ],
    vsOthers: `${shortLabel} (${processLabel}): ejecutas la técnica. El Gestor prioriza y decide el acto. El Inspector practica pruebas en terreno.`,
  };
}

function examFocus(family: CargoFamily, moduleIds: string[]): string[] {
  const out = [
    "Quédate en el verbo de tu ficha: no respondas como otro empleo.",
    "CPACA: petición 15/10/30; recursos 10 días. En cobro coactivo mandan los arts. 823 y ss. del E.T.",
    "Integridad: canal institucional, reserva tributaria, cero dádivas.",
  ];
  if (moduleIds.includes("cobro-coactivo")) {
    out.push(
      "Mandamiento (826), títulos 828, excepciones 15 días, prescripción 5 años.",
    );
  }
  if (moduleIds.includes("medidas-cautelares")) {
    out.push("Cautelares previa o simultáneas al mandamiento; nunca en persuasivo.");
  }
  if (moduleIds.includes("devoluciones-compensaciones")) {
    out.push("Devolución 850 vs compensación 815: primero depurar cuenta corriente.");
  }
  if (moduleIds.includes("fiscalizacion-determinacion")) {
    out.push("Requerimiento especial (703) antes de liquidar. Término de respuesta: 3 meses.");
  }
  if (moduleIds.includes("inspeccion-visitas")) {
    out.push("Visita: identifícate, objeto, acta, no liquidas en el predio.");
  }
  if (family === "gestor") {
    out.push("Competencia para firmar vs proyectar. El Gestor responde por el término.");
  }
  if (family === "analista") {
    out.push("Comportamiento ético en nivel 4 en Likert. Tú apoyas; no decides el acto.");
  }
  return out.slice(0, 8);
}

function guidesFromFunctions(
  funciones: string[],
  family: CargoFamily,
  filename: string,
): FunctionGuide[] {
  if (!funciones.length) {
    return TOPICS.filter((t) =>
      ["ficha-empleo", "cpaca", "codigo-integridad"].includes(t.moduleId),
    ).map((t) => ({
      functionTitle: t.title,
      howToResolve: t.how,
      steps: t.steps,
      typicalFail: t.trap,
      correctMove: t.correctMove,
      source: t.source,
      relatedModuleIds: [t.moduleId],
      roleNote: roleNote(family, t.moduleId),
    }));
  }
  const used = new Set<string>();
  const fromFn = funciones.slice(0, 10).map((fn) => {
    const related = matchModules(fn).filter((id) => id !== "ficha-empleo");
    const topic = TOPICS.find(
      (t) => related.includes(t.moduleId) && !used.has(t.moduleId),
    );
    if (topic) used.add(topic.moduleId);
    const title = clip(fn.replace(/\s+de acuerdo con[\s\S]+$/i, ""), 120);
    return {
      functionTitle: title.length > 28 ? title : clip(fn, 120),
      howToResolve:
        topic?.how ??
        "Aplica el procedimiento escrito, el grado de responsabilidad de tu ficha y deja rastro en el sistema corporativo.",
      steps: topic?.steps ?? [
        "Lee la función y el grado de responsabilidad.",
        "Abre el procedimiento y el expediente en el sistema.",
        "Ejecuta solo lo que tu ficha permite.",
        "Escala por escrito lo que exceda tu competencia.",
      ],
      typicalFail:
        topic?.trap ??
        "Actuar como otro empleo o saltarse el procedimiento para ‘agilizar’.",
      correctMove:
        topic?.correctMove ?? "Procedimiento + competencia + rastro institucional.",
      source: filename,
      relatedModuleIds: related.length ? related.slice(0, 3) : ["ficha-empleo"],
      roleNote: roleNote(family, related[0]),
    };
  });
  return fromFn;
}

function questionsFromManual(
  cargoId: string,
  family: CargoFamily,
  shortLabel: string,
  funciones: string[],
): Question[] {
  const first = funciones[0]
    ? clip(funciones[0], 180)
    : "la función esencial de tu ficha";
  const roleCorrect =
    family === "gestor"
      ? "Priorizar, revisar calidad y proyectar o suscribir según competencia, con instrucción escrita."
      : family === "inspector"
        ? "Identificarte, delimitar el objeto, actar los hechos y trasladar las pruebas al expediente."
        : "Ejecutarla según el procedimiento, la competencia de tu grado y dejar rastro en el sistema.";
  const roleWrong =
    family === "gestor"
      ? "Hacer tú todas las citaciones del Analista para lucirte, sin dejar instrucción."
      : family === "inspector"
        ? "Liquidar o embargar en el predio ‘para cerrar el caso’."
        : "Firmar el acto definitivo (mandamiento, liquidación) aunque tu ficha no te dé competencia.";

  const qs: Question[] = [
    {
      id: `c-${cargoId}-1`,
      track: "funcional",
      moduleId: "ficha-empleo",
      kind: "sjt",
      caseText: `Eres ${shortLabel}. Te asignan esta función: «${first}». Un compañero te dice que ‘es más práctico’ resolverlo por fuera del procedimiento.`,
      stem: "Lo correcto es",
      choices: [
        { id: "a", text: roleCorrect },
        { id: "b", text: roleWrong },
        {
          id: "c",
          text: "Atenderlo por WhatsApp personal para ser más ágil y después radicar si hay queja.",
        },
        {
          id: "d",
          text: "Archivarlo porque no aparece como ‘función principal’ en tu cabeza.",
        },
      ],
      correct: "a",
      explanation: `La prueba funcional premia el verbo de tu ficha (${shortLabel}) y el procedimiento institucional. Improvisar, firmar de más o usar canal personal es el distractor típico.`,
      source: "Manual de funciones del empleo",
      difficulty: 2,
    },
    {
      id: `c-${cargoId}-2`,
      track: "funcional",
      moduleId: "cpaca",
      kind: "knowledge",
      stem: "Una petición de un ciudadano sobre un trámite de tu proceso. Término general de respuesta en el CPACA:",
      choices: [
        { id: "a", text: "5 días hábiles." },
        { id: "b", text: "15 días hábiles, salvo norma especial." },
        { id: "c", text: "30 días calendario, siempre." },
        { id: "d", text: "No hay término si la petición es anónima." },
      ],
      correct: "b",
      explanation:
        "Ley 1755: 15 días (general), 10 (documentos) y 30 (consultas). Anónima se tramita si el contenido lo permite.",
      source: "Ley 1755 de 2015 · Ley 1437 de 2011",
      difficulty: 1,
    },
    {
      id: `c-${cargoId}-3`,
      track: "integridad",
      moduleId: "codigo-integridad",
      kind: "dilemma",
      caseText:
        "Un usuario conocido te ofrece ‘un detalle’ y pide que su expediente salga primero. Tu jefe está en reunión.",
      stem: "Qué haces",
      choices: [
        {
          id: "a",
          text: "Aceptas el detalle ‘pequeño’ y priorizas, total nadie se entera.",
        },
        {
          id: "b",
          text: "Rechazas el detalle, dejas constancia y sigues el turno y el procedimiento.",
        },
        {
          id: "c",
          text: "Le dices que te escriba al celular para ‘revisarlo en la noche’.",
        },
        {
          id: "d",
          text: "Se lo pasas a un compañero para no ensuciarte, sin registrar nada.",
        },
      ],
      correct: "b",
      explanation:
        "Honestidad y respeto: cero dádivas, cero canal paralelo, rastro institucional. Trasladar en silencio no borra el conflicto.",
      source: "Código de Integridad DIAN v3",
      difficulty: 2,
    },
  ];

  if (funciones.length > 1) {
    qs.push({
      id: `c-${cargoId}-4`,
      track: "funcional",
      moduleId: "ficha-empleo",
      kind: "sjt",
      caseText: `Otra función de tu empleo: «${clip(funciones[1], 180)}». El obligado insiste en una excepción ‘de sentido común’.`,
      stem: "La respuesta de examen es",
      choices: [
        {
          id: "a",
          text: "Aplicar la normativa, el procedimiento y el grado de responsabilidad; si no es tu competencia, elevar.",
        },
        {
          id: "b",
          text: "Ceder porque el usuario ‘tiene razón humana’.",
        },
        {
          id: "c",
          text: "Inventar un acto nuevo para quedar bien con la seccional.",
        },
        {
          id: "d",
          text: "Decirle que vuelva cuando esté el jefe, sin radicar el escrito.",
        },
      ],
      correct: "a",
      explanation:
        "Norma + procedimiento + competencia. El sentido común no deroga el Estatuto ni el CPACA.",
      source: "Manual de funciones del empleo",
      difficulty: 2,
    });
  }

  return qs;
}

export function isUsefulCargo(cargo: CargoProfile): boolean {
  const f = cargo.ficha;
  const named = f.denominacion.length > 3 && f.denominacion !== "Empleo según manual";
  return named && (f.funciones.length >= 2 || f.proposito.length > 50);
}

export function buildCargoFromText(
  raw: string,
  filename = "manual.pdf",
): CargoProfile | null {
  const text = raw.replace(/\u0000/g, " ").replace(/\r/g, "");
  if (text.replace(/\s/g, "").length < 40) return null;

  const denominacion = extractDenominacion(text) || "Empleo según manual";
  const { codigo, grado } = extractCodigoGrado(text);
  const nivel = extractNivel(text);
  const family = asFamily(denominacion, nivel, text);
  const proposito = extractProposito(text);
  const funciones = extractFunctions(text);
  const funcionales = extractFuncionales(text);
  const comportamentales = extractComportamentales(text);
  const nbc = extractNbc(text);
  const estudios = extractEstudios(text);
  const experiencia = extractExperiencia(text);
  const codigoFicha = text.match(/CT-[A-Z]{2}-\d{3,5}/)?.[0];
  const procesoMatch = text.match(
    /MISIONAL:\s*([^\n]+?)(?:\s+Aplicaci[oó]n|$)/i,
  );
  const proceso = procesoMatch
    ? `MISIONAL: ${clean(procesoMatch[1].replace(/\s+Aplicaci[oó]n[\s\S]*$/i, ""))}`
    : "Proceso misional DIAN";
  const subMatch = text.match(
    /Aplicaci[oó]n de la Ficha[^\n]*\n([A-ZÁÉÍÓÚÑa-záéíóúñ][^\n]{8,90})/,
  );
  const subproceso = subMatch
    ? clean(subMatch[1])
    : clean(
        text.match(/Administraci[oó]n de cartera[^\n]*/i)?.[0] ?? "Según manual",
      );
  const aplicacion = /Niveles Central y Seccional/i.test(text)
    ? "Niveles Central y Seccional"
    : "Según ficha";
  const tipoEmpleo = /Carrera Administrativa/i.test(text)
    ? "Carrera Administrativa"
    : "Carrera Administrativa";

  const blob = [
    denominacion,
    proposito,
    funciones.join(" "),
    funcionales.join(" "),
    text,
  ].join("\n");
  let moduleIds = matchModules(blob);
  if (family === "gestor" && ALLOWED_MODULE_IDS.includes("rol-gestor")) {
    moduleIds = [...new Set([...moduleIds, "rol-gestor"])];
  }
  if (family === "inspector" && ALLOWED_MODULE_IDS.includes("inspeccion-visitas")) {
    moduleIds = [...new Set([...moduleIds, "inspeccion-visitas"])];
  }

  const shortLabel = denominacion.split("·")[0]?.trim() || denominacion;
  const processLabel = subproceso.length > 4 ? clip(subproceso, 72) : clip(proceso, 72);
  const id = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const cargo: CargoProfile = {
    id,
    family,
    shortLabel,
    processLabel,
    blurb: clip(proposito || `Guía según el manual de ${shortLabel}.`, 180),
    custom: true,
    ficha: {
      denominacion,
      codigo,
      grado,
      nivel:
        nivel ||
        (family === "analista"
          ? "Nivel Técnico"
          : family === "gestor" || family === "inspector"
            ? "Nivel Profesional"
            : "Según manual"),
      tipoEmpleo,
      codigoFicha,
      proceso,
      subproceso,
      aplicacion,
      proposito: proposito || "Según el manual de funciones cargado.",
      funciones,
      estudios: estudios || "Los que señale el manual / la OPEC.",
      nbc,
      experiencia: experiencia || "La que señale la OPEC.",
      equivalencias: /equivalencias definidas|aplican las equivalencias/i.test(text),
      competenciasFuncionales: funcionales,
      competenciasComportamentales: comportamentales,
    },
    rolBoundary: boundaries(family, shortLabel, processLabel, funciones),
    examFocus: examFocus(family, moduleIds),
    functionGuides: guidesFromFunctions(funciones, family, filename),
    moduleIds,
    questions: questionsFromManual(id, family, shortLabel, funciones),
  };

  if (!isUsefulCargo(cargo)) return null;
  return cargo;
}
