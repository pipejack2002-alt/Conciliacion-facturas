import type { Question } from "./types";

export const QUESTIONS_CARGOS: Question[] = [
  {
    id: "g01",
    track: "funcional",
    moduleId: "rol-gestor",
    kind: "sjt",
    caseText:
      "En cartera hay un lote de 40 títulos próximos a prescribir. El Analista II del grupo te pide que ‘tú mismo diligencies las citaciones’ porque vas más rápido. Eres Gestor I de cartera.",
    stem: "La conducta más alineada con tu empleo es",
    choices: [
      { id: "a", text: "diligenciar tú las 40 citaciones para cumplir la meta personal." },
      { id: "b", text: "priorizar el lote, asignar al Analista, revisar calidad del expediente y controlar el término de prescripción con rastro en el sistema." },
      { id: "c", text: "archivar los de menor cuantía para no complicarse." },
      { id: "d", text: "firmar mandamientos en blanco ‘por si acaso se vencen hoy’." },
    ],
    correct: "b",
    explanation:
      "El Gestor coordina, prioriza y responde por el término. La ejecución del oficio de citación es del Analista. Mandamientos en blanco son vicio y falta grave.",
    source: "Manual de funciones · nivel profesional",
    difficulty: 2,
  },
  {
    id: "g02",
    track: "funcional",
    moduleId: "rol-gestor",
    kind: "sjt",
    caseText:
      "El jefe de división está en comisión. Un Analista te trae un mandamiento de pago listo. En tu ficha no aparece la competencia para librarlo; sí aparece proyectar y revisar.",
    stem: "Debes",
    choices: [
      { id: "a", text: "firmarlo tú, porque ‘alguien tiene que hacerlo’." },
      { id: "b", text: "dejarlo en el cajón hasta que vuelva el jefe, aunque prescriba." },
      { id: "c", text: "revisar el expediente y elevarlo a quien sí tiene competencia, dejando constancia del riesgo de prescripción." },
      { id: "d", text: "pedirle al Analista que lo firme con tu visto bueno verbal." },
    ],
    correct: "c",
    explanation:
      "Firmar sin competencia vicia el acto (falta de competencia, excepción 831). Dejar prescribir viola diligencia. Se revisa, se eleva y se deja rastro.",
    source: "E.T. art. 824 y 831 · principio de competencia",
    difficulty: 2,
  },
  {
    id: "g03",
    track: "funcional",
    moduleId: "rol-gestor",
    kind: "knowledge",
    stem: "En el concurso 2676, la diferencia típica de grado entre Analista II y Gestor I es",
    choices: [
      { id: "a", text: "el Analista es nivel profesional y el Gestor es técnico." },
      { id: "b", text: "el Analista es nivel técnico (ejecuta labores técnicas) y el Gestor es nivel profesional (coordina, proyecta y decide según competencia)." },
      { id: "c", text: "no hay diferencia de funciones, solo de salario." },
      { id: "d", text: "el Gestor no presenta prueba funcional." },
    ],
    correct: "b",
    explanation:
      "Analista II: código 202, nivel técnico. Gestor I: código 301, nivel profesional. La prueba funcional se arma sobre el grado de responsabilidad del empleo.",
    source: "OPEC 2676 · Manual de funciones",
    difficulty: 1,
  },
  {
    id: "g04",
    track: "funcional",
    moduleId: "rol-gestor",
    kind: "sjt",
    caseText:
      "Un Analista te entrega un proyecto de mandamiento. La cuenta corriente no está conciliada: el deudor alega un pago en EAR de hace 20 días.",
    stem: "Como Gestor, lo correcto es",
    choices: [
      { id: "a", text: "firmar igual para no perder el indicador de ‘actos proferidos’." },
      { id: "b", text: "devolver el expediente para conciliar con la EAR y depurar el título antes del acto." },
      { id: "c", text: "descontar de palabra el valor alegado, sin soporte." },
      { id: "d", text: "embargar preventivo mientras ‘se aclara’." },
    ],
    correct: "b",
    explanation:
      "Calidad del título y de la cuenta corriente es control profesional. Un pago no reportado se concilia; no se ignora ni se ‘descuenta de palabra’. Cautelar sin mandamiento/título limpio es trampa.",
    source: "E.T. arts. 801, 828 · función de depuración",
    difficulty: 2,
  },
  {
    id: "g05",
    track: "funcional",
    moduleId: "rol-gestor",
    kind: "sjt",
    caseText:
      "Eres Gestor II de cartera. El Analista clasificó mal un título: lo dejó en persuasivo y faltan 40 días para prescribir.",
    stem: "Tu decisión",
    choices: [
      { id: "a", text: "llamar al deudor una vez más ‘para no ser agresivos’." },
      { id: "b", text: "reorientar a coactivo, verificar título y competencia, y impulsar el mandamiento con prioridad de prescripción." },
      { id: "c", text: "sancionar al Analista en redes internas antes de tocar el expediente." },
      { id: "d", text: "esperar a que prescriba y luego pedir remisión masiva." },
    ],
    correct: "b",
    explanation:
      "El Gestor corrige la clasificación y protege el crédito. El persuasivo no es presupuesto legal ineludible cuando el título está listo y el término apremia. Prescripción por descuido es falta de diligencia.",
    source: "E.T. arts. 817 y 823 · rol del Gestor",
    difficulty: 2,
  },
  {
    id: "fs01",
    track: "funcional",
    moduleId: "fiscalizacion-determinacion",
    kind: "knowledge",
    stem: "Por regla general, antes de proferir una liquidación de revisión la administración debe",
    choices: [
      { id: "a", text: "librar mandamiento de pago." },
      { id: "b", text: "proferir requerimiento especial." },
      { id: "c", text: "decretar el remate de bienes." },
      { id: "d", text: "demandar ante lo contencioso." },
    ],
    correct: "b",
    explanation:
      "Arts. 703 y 704 E.T.: el requerimiento especial es el acto previo, por regla, a la liquidación de revisión. El mandamiento es de cobro, no de determinación.",
    source: "E.T. arts. 703-704",
    difficulty: 1,
  },
  {
    id: "fs02",
    track: "funcional",
    moduleId: "fiscalizacion-determinacion",
    kind: "knowledge",
    stem: "El término que tiene el contribuyente para responder el requerimiento especial es, en la regla del art. 707 E.T.,",
    choices: [
      { id: "a", text: "diez (10) días." },
      { id: "b", text: "quince (15) días." },
      { id: "c", text: "tres (3) meses." },
      { id: "d", text: "un (1) año." },
    ],
    correct: "c",
    explanation:
      "Art. 707: tres meses para responder el requerimiento especial. No se confunde con los 10 días de recursos del CPACA ni con los 15 de excepciones al mandamiento.",
    source: "E.T. art. 707",
    difficulty: 1,
  },
  {
    id: "fs03",
    track: "funcional",
    moduleId: "fiscalizacion-determinacion",
    kind: "knowledge",
    stem: "La liquidación de aforo (art. 717) procede, como regla, cuando",
    choices: [
      { id: "a", text: "el contribuyente declaró y la DIAN considera inexacta la declaración." },
      { id: "b", text: "el omiso fue emplazado para declarar y no presentó la declaración." },
      { id: "c", text: "hay un saldo a favor pedido en devolución." },
      { id: "d", text: "el deudor pidió facilidad de pago." },
    ],
    correct: "b",
    explanation:
      "Aforo = omiso emplazado que no declara. Inexactitud de quien sí declaró se determina por liquidación de revisión, precedida de requerimiento especial.",
    source: "E.T. arts. 715 y 717",
    difficulty: 2,
  },
  {
    id: "fs04",
    track: "funcional",
    moduleId: "fiscalizacion-determinacion",
    kind: "sjt",
    caseText:
      "Eres Gestor II de fiscalización. El Analista armó un expediente de inexactitud en renta. Te pide ‘liquidar ya’ porque el término de fiscalización apremia y ‘el requerimiento especial demora’.",
    stem: "Debes",
    choices: [
      { id: "a", text: "proferir la liquidación de revisión sin requerimiento, para no perder el término." },
      { id: "b", text: "proferir el requerimiento especial con hechos, pruebas y glosas, y controlar el término legal." },
      { id: "c", text: "llamar al contribuyente y pactar una corrección de palabra." },
      { id: "d", text: "pasar el caso a cobro coactivo aunque no hay acto de determinación." },
    ],
    correct: "b",
    explanation:
      "El apremio del término no elimina el requerimiento especial. Un acto viciado no salva la fiscalización. Cobro sin título de determinación (cuando se necesita) es poner la carreta delante.",
    source: "E.T. arts. 703, 704 y 713",
    difficulty: 2,
  },
  {
    id: "fs05",
    track: "funcional",
    moduleId: "control-extensivo",
    kind: "sjt",
    caseText:
      "En una campaña de omisos de IVA, un contribuyente pide que le adelantes si ‘ya le van a aforar’ y cómo maquillar la declaración.",
    stem: "La respuesta correcta del empleo es",
    choices: [
      { id: "a", text: "explicarle extraoficialmente cómo minimizar el aforo." },
      { id: "b", text: "orientarlo por el canal institucional sobre el emplazamiento y el deber de declarar, sin adelantar el acto ni diseñar su estrategia." },
      { id: "c", text: "decirle que ignore el emplazamiento." },
      { id: "d", text: "cobrarle una suma para ‘acelerar’ la respuesta." },
    ],
    correct: "b",
    explanation:
      "Orientar ≠ asesorar para eludir. Función de control extensivo y de servicio: mismo mensaje de la campaña, canal oficial, sin adelantar el sentido del acto.",
    source: "E.T. art. 715 · Código de Integridad",
    difficulty: 2,
  },
  {
    id: "in01",
    track: "funcional",
    moduleId: "inspeccion-visitas",
    kind: "sjt",
    caseText:
      "En una visita de IVA el representante legal te ofrece almuerzo y te pide ‘no anotar’ una caja menor sin soportes. Eres Inspector II.",
    stem: "Debes",
    choices: [
      { id: "a", text: "aceptar el almuerzo para no tensar la visita y omitir la caja." },
      { id: "b", text: "rechazar la dádiva, dejar constancia de los hechos en el acta y trasladar el hallazgo al expediente." },
      { id: "c", text: "liquidar el IVA en el predio a cambio de no reportar." },
      { id: "d", text: "guardar silencio y contarlo solo en un grupo de WhatsApp del equipo." },
    ],
    correct: "b",
    explanation:
      "El Inspector no negocia el tributo ni recibe dádivas. El acta recoge hechos. WhatsApp personal no es expediente. La determinación la hace el competente después.",
    source: "E.T. art. 779 · Código de Integridad v3",
    difficulty: 1,
  },
  {
    id: "in02",
    track: "funcional",
    moduleId: "inspeccion-visitas",
    kind: "knowledge",
    stem: "Durante la visita, el documento principal que deja rastro de lo ocurrido es",
    choices: [
      { id: "a", text: "un mensaje de voz al jefe." },
      { id: "b", text: "el acta de visita, con hechos, documentos y observaciones." },
      { id: "c", text: "la liquidación oficial firmada en el predio." },
      { id: "d", text: "un acuerdo de pago verbal." },
    ],
    correct: "b",
    explanation:
      "El acta es la prueba de la visita. La liquidación no se firma en el predio. Lo verbal sin rastro no sostiene el requerimiento.",
    source: "E.T. arts. 684 y 779",
    difficulty: 1,
  },
  {
    id: "in03",
    track: "funcional",
    moduleId: "inspeccion-visitas",
    kind: "sjt",
    caseText:
      "El acto que ordena la visita delimita el objeto a IVA del año 2023. En el archivo aparece un hallazgo fuerte de renta 2022.",
    stem: "Lo correcto es",
    choices: [
      { id: "a", text: "ampliar de hecho el objeto y llevarte toda la renta, sin nuevo acto." },
      { id: "b", text: "ignorar el hallazgo porque ‘no es IVA’." },
      { id: "c", text: "dejar constancia, no exceder el objeto de esta visita, e informar al competente para que, si procede, ordene la actuación de renta." },
      { id: "d", text: "avisar al contribuyente que esconda esa carpeta." },
    ],
    correct: "c",
    explanation:
      "Exceder el objeto vicia la prueba. Ocultar el hallazgo es falta. Se acta lo observado, se respeta el objeto y se escala para una actuación con competencia y objeto propios.",
    source: "Debido proceso · facultades 684 con objeto delimitado",
    difficulty: 2,
  },
  {
    id: "in04",
    track: "funcional",
    moduleId: "inspeccion-visitas",
    kind: "sjt",
    caseText:
      "El visitado se niega a firmar el acta y dice que ‘sin firma no vale’.",
    stem: "Debes",
    choices: [
      { id: "a", text: "romper el acta y volverte otro día." },
      { id: "b", text: "dejar constancia de la renuencia, firmar tú y los testigos que procedan, y conservar el acta." },
      { id: "c", text: "amenazar con embargo inmediato." },
      { id: "d", text: "aceptar que el acta no existe." },
    ],
    correct: "b",
    explanation:
      "La renuencia a firmar se consigna. El acta no desaparece porque el visitado no quiera suscribirla. Embargo es cobro, no visita.",
    source: "Práctica de actas de visita · debido proceso",
    difficulty: 2,
  },
  {
    id: "fs06",
    track: "funcional",
    moduleId: "fiscalizacion-determinacion",
    kind: "knowledge",
    stem: "El emplazamiento para corregir (art. 705 E.T.) es",
    choices: [
      { id: "a", text: "una liquidación oficial ejecutoriada." },
      { id: "b", text: "un acto de trámite que invita a corregir, no la liquidación ni el requerimiento especial." },
      { id: "c", text: "un mandamiento de pago." },
      { id: "d", text: "una sentencia." },
    ],
    correct: "b",
    explanation:
      "El 705 no determina ni reemplaza el 703. Es trámite. Confundirlo es el error más rentable para el examinador.",
    source: "E.T. art. 705",
    difficulty: 2,
  },
  {
    id: "g06",
    track: "funcional",
    moduleId: "rol-gestor",
    kind: "sjt",
    caseText:
      "Un contribuyente influyente te llama para que ‘le bajes la prioridad’ a su expediente de cobro. Tu Analista ya lo tiene clasificado por riesgo de prescripción.",
    stem: "Como Gestor",
    choices: [
      { id: "a", text: "reordenas el lote a su favor y pides reserva al Analista." },
      { id: "b", text: "mantienes el criterio objetivo (prescripción, cuantía, riesgo), dejas rastro de la gestión y no aceptas trato preferente." },
      { id: "c", text: "le pides al Analista que ‘desaparezca’ el expediente una semana." },
      { id: "d", text: "cierras el cobro por ‘razones de imagen institucional’." },
    ],
    correct: "b",
    explanation:
      "Justicia e imparcialidad (209 C.P. y Código de Integridad). El Gestor no vende la prioridad. Prescripción y cuantía mandan, no el apellido.",
    source: "Art. 209 C.P. · Justicia · rol profesional",
    difficulty: 2,
  },
];
