import type { TopicGuide } from "./types";

/** Cómo se resuelve cada tema en el procedimiento real — diagnóstico de fallos. */
export const TOPICS: TopicGuide[] = [
  {
    id: "ficha-empleo",
    moduleId: "ficha-empleo",
    title: "Identificar el empleo y actuar en su grado",
    how: "Lee la ficha: propósito, funciones esenciales y grado de responsabilidad. En el caso, responde como ese empleo, no como el jefe ni como un cargo de otro proceso.",
    steps: [
      "Identifica denominación, código, grado y nivel.",
      "Marca si la función es ejecutar, proyectar, decidir o controlar.",
      "Descarta opciones que firmen actos o definan política si tu grado no lo permite.",
      "Aplica el procedimiento escrito y el sistema institucional.",
    ],
    trap: "Responder con ‘sentido común’ o con el rol de un Gestor / Jefe de división cuando el caso pide Analista, o al revés.",
    correctMove:
      "Quédate en el verbo de tu ficha: apoyar, verificar, tramitar (Analista); proyectar, coordinar, decidir según competencia (Gestor); practicar pruebas (Inspector).",
    source: "Manual específico de funciones · Resolución 0067 de 2024",
  },
  {
    id: "cobro-persuasivo",
    moduleId: "cobro-persuasivo",
    title: "Cobro persuasivo",
    how: "Invita al pago o a la facilidad, depura el título y deja trazabilidad. No hay mandamiento ni cautelares en esta etapa.",
    steps: [
      "Clasifica y prioriza (cuantía, antigüedad, riesgo de prescripción).",
      "Verifica expediente, título y cuenta corriente.",
      "Contacta por canales institucionales y registra cada gestión.",
      "Si no paga ni acuerda y hay título ejecutivo, pasa el caso al coactivo competente.",
    ],
    trap: "Decretar embargo ‘para presionar’ o archivar porque el deudor no contestó.",
    correctMove:
      "Persuadir, documentar y depurar. El silencio del deudor no extingue el crédito.",
    source: "E.T. art. 814 y práctica de recaudo · Ley 1066 de 2006",
  },
  {
    id: "cobro-coactivo",
    moduleId: "cobro-coactivo",
    title: "Cobro coactivo",
    how: "Con título ejecutivo (art. 828) el funcionario competente libra mandamiento de pago (art. 826). El deudor se defiende por excepciones (15 días), no por reposición del CPACA.",
    steps: [
      "Confirma título ejecutivo y competencia.",
      "Libra o proyecta el mandamiento: pagar obligación + intereses.",
      "Notifica: citación 10 días y, si no comparece, correo.",
      "Si hay excepciones (15 días), resuélvelas; si no, sigue ejecución, cautelares y remate.",
    ],
    trap: "Mezclar los 10 días del CPACA con los 15 de excepciones, o notificar ‘por aviso’ de entrada.",
    correctMove:
      "Mandamiento → notificación 826 → excepciones 831 en 15 días. El remate es el final, no el primer acto.",
    source: "E.T. arts. 817, 818, 823 a 847",
  },
  {
    id: "medidas-cautelares",
    moduleId: "medidas-cautelares",
    title: "Medidas cautelares",
    how: "Embargo y secuestro para asegurar el recaudo. Pueden ser preventivas: previa o simultáneas al mandamiento (art. 837). No existen en el persuasivo.",
    steps: [
      "Confirma que hay (o se libra) mandamiento; si estás en persuasivo, no cauteles.",
      "Investiga bienes (art. 836).",
      "Decreta embargo (registro) y, si procede, secuestro.",
      "No embargues de más ni bienes inembargables. Levanta solo por causa legal.",
    ],
    trap: "Embargar en persuasivo o saltar del embargo al remate sin secuencia.",
    correctMove:
      "Frase exacta del 837: ‘previa o simultáneamente con el mandamiento’. Luego: investigar → embargar → secuestrar → avalúo → remate.",
    source: "E.T. arts. 836 a 841",
  },
  {
    id: "devoluciones-compensaciones",
    moduleId: "devoluciones-compensaciones",
    title: "Devoluciones y compensaciones",
    how: "Saldo a favor verificado: devolución (850) o compensación (815). Primero depura cuenta corriente e inconsistencias; no gires ‘de caja’.",
    steps: [
      "Verifica el saldo a favor y cruza deudas, investigaciones e inconsistencias.",
      "Si hay deuda exigible, compensa (oficiosa cuando proceda).",
      "Si procede devolución, aplica el término y, si la ley lo pide, garantía.",
      "Motiva rechazo o modificación (854-855).",
    ],
    trap: "Devolver con inconsistencia abierta o creer que un saldo ‘borra solo’ otra deuda.",
    correctMove:
      "Depurar → compensar si hay deuda → devolver el remanente. El ciudadano no tiene derecho a giro inmediato.",
    source: "E.T. arts. 815, 850 a 857",
  },
  {
    id: "recaudo-ear",
    moduleId: "recaudo-ear",
    title: "Recaudo, EAR y cuenta corriente",
    how: "El pago de impuestos nacionales se hace en bancos y EAR (art. 801). El empleo concilia reportes, corrige recibos y actualiza la cuenta corriente. Nunca recibe efectivo.",
    steps: [
      "Identifica el recibo oficial y el reporte de la EAR.",
      "Si el ciudadano pagó y el saldo sigue, concilia antes de cobrar.",
      "Corrige NIT, periodo o formulario con soporte.",
      "Reprocesa el saldo en el sistema corporativo.",
    ],
    trap: "Librar mandamiento a ciegas o recibir dinero ‘para colaborar’.",
    correctMove:
      "Declarar no es pagar. El recibo acredita la extinción. Conciliar con la EAR es el primer paso si hay pago alegado.",
    source: "E.T. art. 801 y ss.",
  },
  {
    id: "control-extensivo",
    moduleId: "control-extensivo",
    title: "Control extensivo de obligaciones",
    how: "Control masivo con cruces de información: emplazar para declarar o corregir, orientar por el canal, unificar la realidad fiscal. El emplazamiento no es todavía la liquidación.",
    steps: [
      "Cruza exógena, RUT y declaraciones.",
      "Emplaza (705 corregir / 715 declarar) si hay omiso o inexacto masivo.",
      "Orienta por el canal institucional, con el mismo mensaje de la campaña.",
      "Si no hay respuesta, escala a aforo o al área de fiscalización intensiva según competencia.",
    ],
    trap: "Tratar el emplazamiento como liquidación oficial o ‘asesorar’ la estrategia fiscal del NIT.",
    correctMove:
      "Emplazamiento = acto de trámite. Liquidación / aforo = acto de determinación. Orienta, no patrocines.",
    source: "E.T. arts. 684, 705, 715, 717",
  },
  {
    id: "procesos-concursales",
    moduleId: "procesos-concursales",
    title: "Procesos concursales",
    how: "Si hay reorganización o liquidación (Ley 1116), el cobro coactivo sobre el patrimonio se reorienta: la DIAN se hace parte como acreedora. No es condonación.",
    steps: [
      "Detecta la admisión al concurso.",
      "Suspende o reorienta ejecuciones según la ley.",
      "Presenta la acreencia con títulos e intereses.",
      "No levantes cautelares ‘de favor’ si la ley no lo ordena.",
    ],
    trap: "Seguir el remate ordinario o ‘perdonar’ porque el deudor quebró o murió.",
    correctMove:
      "Cambio de escenario procesal, no extinción automática. Cobra a la masa, a herederos o en el concurso.",
    source: "Ley 1116 de 2006 · E.T. art. 843 y ss.",
  },
  {
    id: "cpaca",
    moduleId: "cpaca",
    title: "CPACA: petición, actos y recursos",
    how: "Petición 15/10/30. Recursos de reposición, apelación y queja en 10 días. En cobro coactivo el E.T. desplaza el CPACA para el mandamiento.",
    steps: [
      "Clasifica el escrito: petición, recurso o excepción.",
      "Aplica el término correcto (15 general, 10 documentos, 30 consultas; 10 recursos; 15 excepciones al mandamiento).",
      "Notifica el acto que afecta al administrado.",
      "No uses revocación directa para ‘arreglarle el problema a un amigo’.",
    ],
    trap: "Mezclar 10 días de recursos con 15 de excepciones, o archivar una petición anónima solo por ser anónima.",
    correctMove:
      "Memoriza 15 / 10 / 30 y 10 días de recursos. Anónima se tramita si el contenido lo permite.",
    source: "Ley 1437 de 2011 · Ley 1755 de 2015",
  },
  {
    id: "constitucion-funcion",
    moduleId: "constitucion-funcion",
    title: "Constitución y función pública",
    how: "Art. 209: igualdad, moralidad, eficacia, economía, celeridad, imparcialidad y publicidad. Art. 338 legalidad tributaria. Art. 363 equidad, eficiencia y progresividad.",
    steps: [
      "Si preguntan principios de la función administrativa → 209.",
      "Si preguntan elementos del tributo → 338.",
      "Si preguntan sistema tributario → 363.",
      "Carrera = mérito (125). Contribuir es deber (95.9).",
    ],
    trap: "Confundir 338 (legalidad / elementos) con 363 (principios del sistema).",
    correctMove: "338 = sujetos, hecho, base, tarifa. 363 = equidad, eficiencia, progresividad.",
    source: "Constitución Política",
  },
  {
    id: "sistema-tributario",
    moduleId: "sistema-tributario",
    title: "Sistema tributario y teoría de la imposición",
    how: "Impuesto sin contraprestación directa; tasa retribuye un servicio divisible; contribución beneficia a un grupo. Evasión incumple; elusión artificia la forma; contrabando evade el control aduanero.",
    steps: [
      "Clasifica el tributo por la contraprestación.",
      "Verifica los cinco elementos (338).",
      "Distingue evasión / elusión / contrabando.",
      "Sitúa el caso en tributario interno, aduanero o cambiario.",
    ],
    trap: "Llamar tasa al IVA o evasión a un artificio elusivo.",
    correctMove: "IVA es impuesto. Elusión se combate con normas antiabuso, no con el tipo penal de evasión.",
    source: "C.P. 338 y 363 · E.T. · Ley 1712 y 1762",
  },
  {
    id: "mipg-archivo",
    moduleId: "mipg-archivo",
    title: "MIPG, archivo y herramientas",
    how: "Todo documento que entra se radica. El expediente vive en el sistema y en las TRD. Talento humano es el corazón del MIPG (7 dimensiones).",
    steps: [
      "Radica (consecutivo y clasificación).",
      "Trabaja en el aplicativo corporativo; no USB personal ni WhatsApp.",
      "Respeta reserva tributaria.",
      "No fragmentes el expediente ni te lo lleves a casa.",
    ],
    trap: "‘Llevárselo al jefe amigo’ sin radicar, o compartir clave.",
    correctMove: "Primera acción: radicar. Información tributaria = reservada.",
    source: "Decreto 1499 de 2017 · Ley 594 de 2000",
  },
  {
    id: "servicio-pqrsf",
    moduleId: "servicio-pqrsf",
    title: "Servicio al ciudadano y PQRSF",
    how: "Orientar con respeto + procedimiento + registro. Queja es conducta del servidor; reclamo es el servicio. No se arregla en el pasillo.",
    steps: [
      "Escucha y trata con dignidad.",
      "Clasifica P, Q, R, S o F.",
      "Informa el canal y el plazo.",
      "Registra. No adelantes el sentido del acto ni improvises un beneficio.",
    ],
    trap: "Asesorar en privado o ‘castigar’ el trámite de quien reclamó.",
    correctMove: "La mejor respuesta de examen combina respeto, procedimiento y rastro institucional.",
    source: "Política de servicio DIAN · CPACA",
  },
  {
    id: "comportamiento-etico",
    moduleId: "comportamiento-etico",
    title: "Comportamiento ético",
    how: "Nivel 4: referente. Te apartas, reportas y resistes presión. Dádiva de cualquier cuantía se rechaza.",
    steps: [
      "Identifica el conflicto de interés.",
      "Decláralo y apártate del expediente.",
      "Reporta la irregularidad por el canal, aunque involucre a un compañero.",
      "No consultes el NIT de un conocido ‘por curiosidad’.",
    ],
    trap: "‘Lo hablo primero con él para no dañar el clima’ o ‘es solo una botella de vino’.",
    correctMove:
      "En Likert, ética clara → totalmente de acuerdo; atajo dudoso → totalmente en desacuerdo. Evita el centro.",
    source: "Diccionario de competencias DIAN · Código de Integridad v3",
  },
  {
    id: "comunicacion-equipo",
    moduleId: "comunicacion-equipo",
    title: "Comunicación, equipo y adaptabilidad",
    how: "Nivel 2: entrega, informa y se ajusta. No es liderazgo gerencial ni retener información para verse imprescindible.",
    steps: [
      "Comunica por el canal institucional.",
      "Comparte avances del proceso.",
      "Acepta el cambio de aplicativo o de campaña.",
      "Si meta vs. debido proceso, gana el debido proceso.",
    ],
    trap: "Responder como jefe que decide solo, o como quien no comparte.",
    correctMove: "Colabora y documenta. El equipo es el proceso, no tu círculo.",
    source: "Diccionario de competencias conductuales DIAN",
  },
  {
    id: "codigo-integridad",
    moduleId: "codigo-integridad",
    title: "Código de Integridad v3",
    how: "Cinco valores: honestidad, respeto, compromiso, diligencia y justicia. Gana el interés general con rastro institucional, sin beneficio propio.",
    steps: [
      "Nombra el valor principal del dilema.",
      "Elige la conducta observable del ‘lo que hago’.",
      "Descarta el atajo ‘nadie se entera’.",
      "Aparta el conflicto de interés.",
    ],
    trap: "Memorizar los nombres y fallar la conducta.",
    correctMove: "Estudia ambas columnas: lo que hago / lo que no hago.",
    source: "CG-TAH-0002 v3 · Ley 2016 de 2020",
  },
  {
    id: "valores-cinco",
    moduleId: "valores-cinco",
    title: "Los cinco valores en conducta",
    how: "Honestidad: verdad y cero dádiva. Respeto: trato digno. Compromiso: interés general. Diligencia: términos y calidad. Justicia: mismo procedimiento, sin favoritismos.",
    steps: [
      "Identifica el valor que el caso pone en juego.",
      "No uses diligencia para atropellar el debido proceso (eso es injusticia).",
      "No agilices el NIT del amigo del jefe.",
      "No dejes prescribir por descuido.",
    ],
    trap: "Elegir la opción ‘práctica’ que rompe justicia u honestidad.",
    correctMove: "Si dos valores chocan, cubre el principal sin romper el otro.",
    source: "Código de Integridad DAFP y DIAN v3",
  },
  {
    id: "rol-gestor",
    moduleId: "rol-gestor",
    title: "Rol del Gestor (nivel profesional)",
    how: "El Gestor coordina, proyecta y, según competencia, decide y suscribe. No se queda en la ejecución de un Analista ni usurpa al jefe de división.",
    steps: [
      "Asigna y prioriza la carga del equipo técnico.",
      "Revisa calidad del expediente antes del acto.",
      "Proyecta o firma según el grado y la delegación.",
      "Controla términos (prescripción, respuesta, recursos).",
    ],
    trap: "Hacer tú el oficio operativo y no dejar rastro de la decisión, o firmar sin competencia.",
    correctMove:
      "Decide con fundamento, deja instrucción escrita y responde por el término. El Analista ejecuta lo asignado.",
    source: "Manual de funciones · nivel profesional DIAN",
  },
  {
    id: "fiscalizacion-determinacion",
    moduleId: "fiscalizacion-determinacion",
    title: "Fiscalización y determinación",
    how: "Antes de una liquidación de revisión, por regla, hay requerimiento especial (703). El contribuyente responde en tres meses (707). El emplazamiento no sustituye al requerimiento especial.",
    steps: [
      "Investiga con facultades del 684.",
      "Si hay inexactitud, profiere requerimiento especial (703-704).",
      "Espera la respuesta (3 meses) o el silencio.",
      "Liquida de revisión en el término legal, notifica y abre la vía de recursos.",
    ],
    trap: "Liquidar de una vez ‘para no perder el año’ o tratar el emplazamiento 705 como si ya fuera liquidación.",
    correctMove:
      "Requerimiento especial → respuesta o silencio → liquidación de revisión. El aforo (717) es para omisos emplazados a declarar.",
    source: "E.T. arts. 684, 702 a 720",
  },
  {
    id: "inspeccion-visitas",
    moduleId: "inspeccion-visitas",
    title: "Inspección, visita y pruebas",
    how: "El Inspector practica la visita, recoge pruebas y deja acta. No determina el tributo ni ‘negocia’ hallazgos. El Gestor o el competente determina.",
    steps: [
      "Identifícate, exhibe el acto que ordena la visita y el objeto.",
      "Recoge documentos y testimonios con cadena de custodia.",
      "Deja constancia en acta: hechos, no opiniones de recaudo.",
      "Traslado al área que determina. No ocultes un hallazgo para ‘cuadrar’ con el visitado.",
    ],
    trap: "Adelantar la liquidación en la visita o aceptar que ‘eso se arregla después’ sin actarlo.",
    correctMove:
      "Hechos en el acta, reserva de la información, informe al competente. La determinación no se firma en el predio.",
    source: "E.T. arts. 684, 779 y ss. · procedimiento de visita DIAN",
  },
];

export const TOPIC_BY_MODULE: Record<string, TopicGuide> = Object.fromEntries(
  TOPICS.map((t) => [t.moduleId, t]),
);

export function topicForModule(moduleId: string): TopicGuide | undefined {
  return TOPIC_BY_MODULE[moduleId];
}
