import type { Module, TrackId } from "./types";

export const MODULES: Module[] = [
  {
    id: "ficha-empleo",
    track: "funcional",
    number: "01",
    title: "El cargo: Analista II de cartera",
    minutes: 12,
    summary:
      "La ficha FT-TAH-1824 define el empleo al que te presentaste. La prueba funcional mide si sabes hacer exactamente esto: clasificar cartera, apoyar recaudo y devoluciones, actualizar cuenta corriente y adelantar cobro hasta la extinción o el coactivo.",
    why: "En el examen de Areandina las preguntas de juicio situacional se construyen sobre las funciones esenciales y las competencias funcionales de la OPEC. Si no internalizas la ficha, fallas casos que parecen de ‘sentido común’.",
    points: [
      {
        title: "Identificación",
        body: "Analista II, código 202, grado 02, nivel técnico, carrera administrativa. Proceso misional de cumplimiento de obligaciones tributarias; subproceso Administración de cartera, Recaudo-Devoluciones. Aplica en niveles central y seccional.",
      },
      {
        title: "Propósito principal",
        body: "Ejecutar labores técnicas en la gestión de Cumplimiento de Obligaciones Tributarias, según políticas gubernamentales e institucionales, directrices de nivel central y la normativa vigente. No diseñas la política: la ejecutas con criterio técnico.",
      },
      {
        title: "Diez funciones que sí caen",
        body: "Clasificar y priorizar cartera; verificar expedientes; devoluciones y compensaciones; asistir a las Entidades Autorizadas para Recaudar; actualizar cuenta corriente y corregir inconsistencias de declaraciones y recibos; cobro hasta extinción, remisión o coactivo; unificar la realidad fiscal del contribuyente; orientar frente a requerimientos; apoyar sistemas de cartera y recaudo; funciones comunes de planta.",
      },
      {
        title: "Competencias funcionales del empleo",
        body: "Cobro coactivo, cobro persuasivo, medidas cautelares, procesos concursales, técnicas administrativas para recaudar, control extensivo de obligaciones, devoluciones y compensaciones. Cada una tiene módulo propio en este cuaderno.",
      },
      {
        title: "Requisitos",
        body: "Técnico profesional, tecnológico o tres años de profesional en NBC de Administración, Contaduría, Derecho, Economía o ingenierías administrativa, de sistemas o industrial. Un año de experiencia laboral. Aplican equivalencias de la entidad.",
      },
    ],
    examTips: [
      "Si el caso pide ‘el Analista II’, responde con la función de ejecución técnica, no con la de un Gestor o un Jefe de división.",
      "Prioriza el procedimiento escrito, el sistema institucional y la competencia territorial. Nunca improvises un atajo ‘para servir al ciudadano’ que rompa el debido proceso.",
      "Cobro persuasivo va antes del coactivo, salvo que el caso diga que ya se agotó o que hay título ejecutivo listo para mandamiento.",
    ],
    sources: [
      "Ficha FT-TAH-1824, Resolución 0067 de 2024",
      "Acuerdo CNSC 21 de 2025 (Proceso DIAN 2676)",
      "Anexo técnico DIAN 2676, numeral 5 · D.L. 927 arts. 58 y 59",
    ],
  },
  {
    id: "cobro-persuasivo",
    track: "funcional",
    number: "02",
    title: "Cobro persuasivo",
    minutes: 14,
    summary:
      "Instancia previa, no jurisdiccional, en la que la DIAN invita al deudor a pagar, acordar facilidad o depurar la obligación. No hay mandamiento, ni embargo, ni secuestro. Es recaudo eficiente y barato.",
    why: "La ficha pone el cobro persuasivo como competencia funcional. En SJT, el error típico es saltar al coactivo o decretar medidas cautelares en esta etapa.",
    points: [
      {
        title: "Qué es y qué no es",
        body: "Es gestión de recaudo: llamadas, oficios, mensajes, visitas, campañas, facilidades de pago. No es procedimiento de cobro coactivo (arts. 823 y ss. E.T.). Durante el persuasivo no se pueden decretar embargos ni secuestros.",
      },
      {
        title: "Objetivo",
        body: "Obtener el pago voluntario, un acuerdo de pago con garantía, o detectar que la obligación no es exigible (pago previo, prescripción, título inexistente, saldo mal liquidado). Depurar antes de gastar el aparato coactivo.",
      },
      {
        title: "Facilidad de pago",
        body: "El art. 814 y 841 del E.T. permiten convenios de pago. Suele exigirse garantía suficiente. El acuerdo de pago es excepción frente al mandamiento (art. 831-2) si ya hay coactivo.",
      },
      {
        title: "Paso al coactivo",
        body: "Si el deudor no paga ni acuerda, y existe título ejecutivo (art. 828), el funcionario competente libra mandamiento de pago. El persuasivo no es presupuesto legal ineludible del coactivo, pero sí es la práctica institucional y lo que la ficha espera del Analista II.",
      },
      {
        title: "Rol del Analista II",
        body: "Clasificar y priorizar la cartera (cuantía, antigüedad, riesgo de prescripción), verificar el expediente, contactar, registrar gestiones en el sistema y dejar trazabilidad. No ‘perdona’ deudas: propone remisión o depuración según competencia.",
      },
    ],
    examTips: [
      "Si el caso está en persuasivo y una opción dice ‘decretar embargo preventivo’, es incorrecta.",
      "Documenta cada contacto. La gestión sin registro no interrumpe términos ni sirve como prueba.",
      "Prioriza obligaciones cercanas a prescribir (5 años, art. 817 E.T.).",
    ],
    sources: [
      "Estatuto Tributario, Título VIII (cobro) y art. 814",
      "Ficha FT-TAH-1824, competencia Cobro persuasivo",
      "Ley 1066 de 2006 (normalización de cartera pública)",
    ],
  },
  {
    id: "cobro-coactivo",
    track: "funcional",
    number: "03",
    title: "Cobro coactivo",
    minutes: 22,
    summary:
      "Procedimiento administrativo especial (arts. 823 y ss. E.T.) con el que la DIAN hace efectivos créditos fiscales sin acudir al juez. El acto de arranque es el mandamiento de pago. El deudor se defiende por excepciones, no por reposición ordinaria.",
    why: "Es la competencia funcional más densa del cargo. Casi todo simulacro serio incluye mandamiento, títulos, excepciones, prescripción y relación con las cautelares.",
    points: [
      {
        title: "Fundamento y competencia",
        body: "Art. 823 E.T.: para el cobro coactivo de impuestos, anticipos, retenciones, intereses y sanciones de competencia de la DIAN se sigue el procedimiento de los artículos siguientes. Art. 824: funcionarios competentes según delegación. Es un privilegio de autoejecución de la administración.",
      },
      {
        title: "Mandamiento de pago — art. 826",
        body: "El funcionario produce el mandamiento ordenando cancelar las obligaciones pendientes más intereses. Se notifica personalmente, previa citación para comparecer en diez (10) días. Si no comparece, se notifica por correo. Igual a herederos y deudores solidarios. Un mismo mandamiento puede cubrir varios títulos del mismo deudor.",
      },
      {
        title: "Títulos ejecutivos — art. 828",
        body: "Prestan mérito ejecutivo: (1) liquidaciones privadas y correcciones, desde el vencimiento para su cancelación; (2) liquidaciones oficiales ejecutoriadas; (3) demás actos ejecutoriados que fijen sumas líquidas a favor del fisco; (4) garantías y cauciones, desde la ejecutoria del acto que declare el incumplimiento; (5) sentencias y decisiones jurisdiccionales ejecutoriadas sobre esos tributos. Parágrafo: basta certificación del Administrador sobre existencia y valor.",
      },
      {
        title: "Excepciones — arts. 830 y 831",
        body: "Contra el mandamiento proceden excepciones, no el recurso de reposición del CPACA. El deudor las propone en los quince (15) días siguientes a la notificación. Taxativas: pago efectivo; acuerdo de pago; falta de ejecutoria del título; pérdida de ejecutoria por revocación o suspensión provisional; demanda de restablecimiento o revisión ante lo contencioso; prescripción de la acción de cobro; falta de título o incompetencia de quien lo profirió. Para solidarios, además: calidad de deudor solidario e indebida tasación.",
      },
      {
        title: "Prescripción — art. 817",
        body: "La acción de cobro prescribe en cinco (5) años contados desde: (1) vencimiento del término para declarar, si la declaración fue oportuna; (2) fecha de presentación, si fue extemporánea; (3) fecha de la declaración de corrección, respecto de mayores valores; (4) ejecutoria del acto de determinación o discusión. La decreta el Administrador de oficio o a petición. La interrupción (art. 818) ocurre, entre otros, con la notificación del mandamiento y con las facilidades de pago.",
      },
      {
        title: "Acumulación y terminación",
        body: "Art. 825: se pueden acumular varios procesos del mismo deudor. El proceso termina por pago, compensación, prescripción decretada, remisión, revocación del título, o porque prosperan excepciones. El remate es la fase final sobre bienes embargados y secuestrados.",
      },
    ],
    examTips: [
      "No confundas recurso de reposición (CPACA) con excepciones al mandamiento (art. 831). En cobro coactivo rige el E.T.",
      "El mandamiento no se notifica ‘en estrados’ ni ‘por aviso’ como primera opción: citación 10 días y, si no hay comparecencia, correo.",
      "Una declaración privada impagada sí es título, desde el vencimiento para pagar, no desde que la DIAN la ‘aprueba’.",
      "Demandar el acto de determinación es excepción, pero no paraliza automáticamente todo si no hay suspensión. Lee el caso.",
    ],
    sources: [
      "Estatuto Tributario arts. 817, 818, 823 a 847",
      "Ley 1066 de 2006",
      "Ficha FT-TAH-1824, competencia Cobro coactivo",
    ],
  },
  {
    id: "medidas-cautelares",
    track: "funcional",
    number: "04",
    title: "Medidas cautelares",
    minutes: 16,
    summary:
      "Embargo y secuestro para asegurar el recaudo. Pueden ser preventivas: el art. 837 permite decretarlas previa o simultáneamente con el mandamiento de pago. No existen en el cobro persuasivo.",
    why: "Competencia funcional expresa del Analista II. El examen pregunta cuándo proceden, qué se puede embargar y cuándo se levantan.",
    points: [
      {
        title: "Preventivas — art. 837",
        body: "Previa o simultáneamente con el mandamiento, el funcionario puede decretar embargo y secuestro preventivo de bienes del deudor cuya propiedad se haya establecido. Sirven para evitar la insolvencia sobrevenida mientras se notifica y se discuten excepciones.",
      },
      {
        title: "Embargo, secuestro, remate",
        body: "Embargo: afectación jurídica del bien (arts. 838 y 839). Debe registrarse (art. 839-1) en oficina de instrumentos, tránsito, etc. Secuestro: desapoderamiento material (art. 839-2), con reglas del proceso civil. Remate: venta en pública subasta (art. 839-3) para satisfacer el crédito.",
      },
      {
        title: "Límites e inembargabilidad",
        body: "No se embarga más de lo necesario para cubrir la deuda, intereses y costas. Hay bienes inembargables (salario mínimo vital, algunos depósitos hasta tope legal, bienes de uso público). El art. 837-1 y normas laborales fijan porciones inembargables de salarios y cuentas.",
      },
      {
        title: "Levantamiento",
        body: "Se levantan cuando hay pago, cuando se otorga facilidad de pago con mejor garantía (art. 841), cuando prosperan excepciones, cuando el embargo es excesivo, o cuando termina el proceso sin embargo de remanentes. El Analista II verifica, no ‘negocia informalmente’ el alzamiento.",
      },
      {
        title: "Investigación de bienes — art. 836",
        body: "La administración puede investigar bienes del deudor, pedir información a entidades financieras, registros y terceros. El Analista apoya esa pesquisa en sistemas y oficios.",
      },
    ],
    examTips: [
      "‘Previa o simultánea al mandamiento’ es la frase exacta del 837. Memorízala.",
      "Si el caso está en persuasivo, las cautelares no proceden.",
      "Embargo no es remate. Hay secuencia: investigar, embargar, secuestrar, avaluar, rematar.",
    ],
    sources: [
      "Estatuto Tributario arts. 836 a 841",
      "Código General del Proceso (embargo, secuestro y remate, en lo compatible)",
    ],
  },
  {
    id: "devoluciones-compensaciones",
    track: "funcional",
    number: "05",
    title: "Devoluciones y compensaciones",
    minutes: 16,
    summary:
      "El contribuyente con saldo a favor puede pedir devolución (art. 850) o compensación contra deudas (art. 815). El Analista II apoya el trámite, verifica consistencia de la cuenta corriente y no ‘paga de caja’ por fuera del procedimiento.",
    why: "Es subproceso explícito de la OPEC. Caen plazos, requisitos, rechazo, compensación oficiosa y relación con el cobro.",
    points: [
      {
        title: "Devolución — art. 850 E.T.",
        body: "Quienes liquiden saldos a favor en sus declaraciones pueden solicitar devolución. El término general de la administración para devolver es de cincuenta (50) días; para retenciones en la fuente, treinta (30) días, según el régimen vigente del Título X. En IVA hay reglas especiales y, en algunos casos, devolución automática o con garantía.",
      },
      {
        title: "Compensación — art. 815",
        body: "Los contribuyentes o responsables pueden imputar saldos a favor a deudas de periodos posteriores o compensar con deudas exigibles. La DIAN también puede compensar de oficio cuando hay deuda en cobro y saldo a favor, unificando la realidad fiscal —función 7 de la ficha.",
      },
      {
        title: "Control previo",
        body: "Antes de devolver se cruza información: inconsistencias de la declaración, inexactitudes, investigaciones en curso, deudas. El rechazo o la modificación se motivan (arts. 854 y 855). Pedir garantía no es hostigar: es una facultad legal en ciertos supuestos.",
      },
      {
        title: "Cuenta corriente",
        body: "El saldo a favor y la deuda viven en la cuenta corriente del contribuyente. Corregir inconsistencias de declaraciones, recibos y reprocesar saldos es función esencial del Analista II. Sin cuenta corriente sana no hay devolución limpia ni cobro limpio.",
      },
      {
        title: "Relación con el cobro",
        body: "Un saldo a favor no ‘borra’ solo una deuda de otro concepto si no se tramita compensación. Tampoco se devuelve si hay título ejecutivo impago, salvo que se compense. El caso de examen suele mezclar ambas caras.",
      },
    ],
    examTips: [
      "No devuelvas si hay inconsistencia abierta: primero depurar.",
      "Compensación oficiosa es correcta cuando hay deuda exigibles vs. saldo a favor verificable.",
      "El ciudadano no ‘tiene derecho a que le giren mañana’: hay término legal y control.",
    ],
    sources: [
      "Estatuto Tributario arts. 815, 850 a 857",
      "Decreto 1625 de 2016 (procedimientos de devolución)",
      "Ficha FT-TAH-1824, funciones 2, 4, 5 y 7",
    ],
  },
  {
    id: "recaudo-ear",
    track: "funcional",
    number: "06",
    title: "Recaudo, EAR y cuenta corriente",
    minutes: 12,
    summary:
      "Los tributos nacionales se recaudan a través de bancos y Entidades Autorizadas para Recaudar (EAR). El Analista asiste esa operación, corrige recibos y mantiene la cuenta corriente contributiva.",
    why: "Función 3 de la ficha. Preguntas sobre dónde se paga, qué pasa con un recibo mal imputado y cómo se actualiza el saldo.",
    points: [
      {
        title: "Recaudo — art. 801 E.T.",
        body: "El recaudo de los impuestos nacionales se hace por los bancos y demás entidades autorizadas. La DIAN no es caja de efectivo para el público. Los recibos oficiales (formulario 490 y equivalentes electrónicos) son el soporte de pago.",
      },
      {
        title: "EAR",
        body: "Entidades Autorizadas para Recaudar: establecimientos de crédito y otros habilitados por resolución. Reciben, reportan y trasladan. El Analista II asiste técnica y operativamente: conciliaciones, rechazos, archivos planos, inconsistencias de reportes.",
      },
      {
        title: "Cuenta corriente",
        body: "Registro de débitos (declaraciones, liquidaciones, sanciones, intereses) y créditos (pagos, compensaciones, devoluciones, condonaciones). Actualizarla y reprocesar saldos es el corazón operativo del cargo.",
      },
      {
        title: "Inconsistencias típicas",
        body: "NIT errado, periodo mal grabado, formulario equivocado, pago en banco no reportado, doble imputación. El procedimiento es corregir con soporte, no ‘ajustar a mano’ el saldo para cuadrar una meta.",
      },
      {
        title: "Declarar no es pagar",
        body: "La liquidación privada es título desde el vencimiento para cancelar (828-1). Una declaración presentada sin pago alimenta la cartera. El recibo de pago es el que acredita la extinción por pago.",
      },
    ],
    examTips: [
      "Si el ciudadano pagó en banco y el saldo sigue en deuda, primero conciliar con la EAR, no librar mandamiento a ciegas.",
      "No recibas dinero en efectivo ‘para colaborar’.",
    ],
    sources: [
      "Estatuto Tributario art. 801 y ss.",
      "Resoluciones DIAN de autorización de recaudadores",
      "Ficha FT-TAH-1824, funciones 3, 4 y 5",
    ],
  },
  {
    id: "control-extensivo",
    track: "funcional",
    number: "07",
    title: "Control extensivo de obligaciones",
    minutes: 12,
    summary:
      "Control masivo y estandarizado sobre el cumplimiento formal y sustancial: cruces, emplazamientos, liquidaciones de aforo, campañas. Distinto de la fiscalización intensiva de un expediente singular.",
    why: "Competencia funcional del empleo. El Analista orienta al contribuyente frente a requerimientos de control y unifica la realidad fiscal.",
    points: [
      {
        title: "Facultad de fiscalización — art. 684",
        body: "La DIAN tiene amplias facultades de investigación, inspección y control. El control extensivo usa datos masivos (información exógena, RUT, medios magnéticos) para detectar omisos e inexactos.",
      },
      {
        title: "Emplazamientos",
        body: "Emplazamiento para corregir (art. 705) y emplazamiento para declarar (art. 715). Son actos de trámite que abren la puerta a sanción y a liquidación, no son todavía la liquidación oficial.",
      },
      {
        title: "Liquidación de aforo — art. 717",
        body: "Si el omiso no declara tras el emplazamiento, la administración puede determinar mediante aforo. Ese acto, ejecutoriado, es título ejecutivo (828-2).",
      },
      {
        title: "Orientación al obligado",
        body: "Función 8: explicar por los canales institucionales los pasos frente a un requerimiento o una campaña. Orientar no es asesorar para evadir ni adelantar el sentido del acto.",
      },
      {
        title: "Unificación de la realidad fiscal",
        body: "Función 7: cruzar lo que el sistema dice que debe con lo que realmente existe (pagos no imputados, declaraciones corrección, procesos de devolución). El control extensivo sin depuración produce cobros infundados.",
      },
    ],
    examTips: [
      "No trates un emplazamiento como si ya fuera liquidación oficial.",
      "La respuesta al contribuyente se da por el canal oficial, con el mismo mensaje para todos los de la campaña.",
    ],
    sources: [
      "Estatuto Tributario arts. 684, 705, 715, 717",
      "Ficha FT-TAH-1824, funciones 7 y 8 y competencia Control extensivo",
    ],
  },
  {
    id: "procesos-concursales",
    track: "funcional",
    number: "08",
    title: "Procesos concursales e insolvencia",
    minutes: 12,
    summary:
      "Cuando el deudor entra a reorganización o liquidación (Ley 1116 de 2006) o a insolvencia de persona natural no comerciante, el cobro coactivo se ve afectado. La DIAN se hace parte como acreedor fiscal.",
    why: "Competencia funcional expresa. El error de examen es seguir embargando como si no existiera el concurso.",
    points: [
      {
        title: "Ley 1116 de 2006",
        body: "Régimen de insolvencia empresarial: reorganización y liquidación judicial. La admisión al proceso impide, como regla, iniciar o continuar ejecuciones y cobros coactivos sobre el patrimonio del deudor.",
      },
      {
        title: "Créditos fiscales",
        body: "Las obligaciones tributarias se califican y graduán en el concurso. Hay tratamiento especial para retenciones y recursos de terceros. El Analista ayuda a presentar la acreencia con títulos, intereses y medidas.",
      },
      {
        title: "Sucesiones y liquidaciones",
        body: "El E.T. prevé intervención de la DIAN en sucesiones (art. 843 y concordantes) para proteger el crédito fiscal. No se ‘perdona’ porque el deudor murió: se cobra a la masa o a herederos, con el debido proceso.",
      },
      {
        title: "Qué hace el Analista II",
        body: "Detectar el concurso, suspender o reorientar el cobro según la norma, reportar al área competente, actualizar la cuenta corriente y no levantar cautelares ‘de favor’ si la ley no lo ordena.",
      },
    ],
    examTips: [
      "Admisión a reorganización ≠ condonación. Es un cambio de escenario procesal.",
      "Si el caso menciona Ley 1116, descarta seguir el remate ordinario.",
    ],
    sources: [
      "Ley 1116 de 2006",
      "Estatuto Tributario art. 843 y ss.",
      "Ficha FT-TAH-1824, competencia Procesos concursales",
    ],
  },
  {
    id: "cpaca",
    track: "funcional",
    number: "09",
    title: "CPACA: petición, actos y recursos",
    minutes: 18,
    summary:
      "La ficha exige Ley 1437 de 2011, Título I y Título III capítulos I, V a VIII: principios, derecho de petición, notificación de actos, recursos, silencio y revocación. Es el esqueleto de toda actuación administrativa, incluido el cobro cuando el E.T. no regula el punto.",
    why: "Caída segura en gestión pública. Los plazos de petición y el catálogo de recursos se preguntan de memoria y en SJT.",
    points: [
      {
        title: "Principios — art. 3",
        body: "Debido proceso, igualdad, imparcialidad, buena fe, moralidad, participación, responsabilidad, transparencia, publicidad, coordinación, eficacia, economía y celeridad. Art. 209 de la Constitución los replica para la función administrativa.",
      },
      {
        title: "Derechos y deberes — arts. 5 y 6",
        body: "El ciudadano tiene derecho a conocer actuaciones, obtener copias, ser oído y recibir respuesta. Debe actuar de buena fe, entregar información cierta y no abusiva. El servidor no puede exigir más de lo previsto en la ley.",
      },
      {
        title: "Derecho de petición — cap. I (Ley 1755 de 2015)",
        body: "Términos: 15 días para peticiones generales en interés particular o general; 10 días para petición de documentos e información; 30 días para consultas. El silencio, cuando opera, se regula en el cap. VII. Una petición anónima se tramita si es posible, salvo las que la ley exija identificar.",
      },
      {
        title: "Notificación — cap. V",
        body: "Los actos que afectan al administrado se notifican personalmente, por aviso, por medios electrónicos autorizados, etc. Un acto no notificado no produce efectos plenos. En cobro coactivo, el 826 E.T. desplaza estas reglas para el mandamiento.",
      },
      {
        title: "Recursos — cap. VI, arts. 74 a 82",
        body: "Reposición (ante el mismo funcionario), apelación (ante el inmediato superior) y queja (si se rechaza la apelación). Se interponen dentro de los diez (10) días siguientes a la notificación, por escrito y con los requisitos del 77. No todos los actos son recurribles: los de trámite, por regla, no.",
      },
      {
        title: "Silencio y revocación — caps. VII y VIII",
        body: "El silencio administrativo negativo es la regla; el positivo, la excepción legal. La revocación directa (arts. 93-97) procede por manifiesta oposición a la Constitución o la ley, por ilegitimidad, o cuando no está conforme con el interés público o social. No se usa para ‘arreglarle el problema a un amigo’.",
      },
    ],
    examTips: [
      "Memoriza 15 / 10 / 30. Es de las preguntas más repetidas en concursos.",
      "Recursos: 10 días. Excepciones al mandamiento: 15 días. No los mezcles.",
      "Petición anónima: se recibe y se tramita si el contenido lo permite; no se archiva solo por ser anónima.",
    ],
    sources: [
      "Ley 1437 de 2011 (CPACA), Títulos I y III caps. I, V-VIII",
      "Ley 1755 de 2015 (derecho de petición)",
      "Constitución Política arts. 23 y 209",
    ],
  },
  {
    id: "constitucion-funcion",
    track: "funcional",
    number: "10",
    title: "Constitución y función pública",
    minutes: 14,
    summary:
      "Estado social de derecho, derechos fundamentales, estructura del poder público y principios de la función administrativa. Más los principios tributarios de los arts. 95.9, 338 y 363.",
    why: "Núcleo de ‘gestión pública’ que la infografía del concurso anuncia para la prueba funcional de todos los cargos.",
    points: [
      {
        title: "Arts. 1 a 13",
        body: "Colombia es un Estado social de derecho, unitario, descentralizado. Primacía de los derechos inalienables. Soberanía popular. Prevalencia del interés general. Derecho a la igualdad y no discriminación. El 13 es base de la justicia como valor de integridad.",
      },
      {
        title: "Estructura del Estado",
        body: "Ramas legislativa, ejecutiva y judicial (art. 113) y órganos autónomos (Contraloría, Procuraduría, Defensoría, Banco de la República, CNSC, etc.). La DIAN es Unidad Administrativa Especial del orden nacional, adscrita al Ministerio de Hacienda.",
      },
      {
        title: "Función pública — arts. 122 a 125 y 209",
        body: "Nadie puede desempeñar cargo público sin juramento de cumplir la Constitución. El empleo público es de carrera, con excepciones. Art. 209: la función administrativa sirve al interés general y se desarrolla con igualdad, moralidad, eficacia, economía, celeridad, imparcialidad y publicidad. Art. 210: entes descentralizados.",
      },
      {
        title: "Deber de contribuir — 95.9",
        body: "Es deber de la persona y del ciudadano contribuir al financiamiento de los gastos e inversiones del Estado dentro de conceptos de justicia y equidad.",
      },
      {
        title: "Poder tributario — 338 y 363",
        body: "En tiempo de paz, solo Congreso, asambleas y concejos imponen contribuciones. La norma debe fijar sujetos, hecho, base y tarifa. El sistema tributario se funda en equidad, eficiencia y progresividad. Las leyes tributarias no se aplican con retroactividad en perjuicio.",
      },
    ],
    examTips: [
      "338 = legalidad tributaria (elementos del tributo). 363 = equidad, eficiencia, progresividad.",
      "Carrera administrativa: mérito. El concurso 2676 existe por el art. 125 y el sistema específico DIAN.",
    ],
    sources: [
      "Constitución Política de Colombia",
      "Ley 909 de 2004 y sistema específico de carrera DIAN",
    ],
  },
  {
    id: "sistema-tributario",
    track: "funcional",
    number: "11",
    title: "Sistema tributario y teoría de la imposición",
    minutes: 16,
    summary:
      "Impuesto, tasa y contribución; elementos del tributo; clasificación; introducción al sistema tributario, aduanero y cambiario que administra la DIAN.",
    why: "La ficha lista ‘teoría de la imposición’ e ‘introducción al sistema tributario, aduanero y cambiario’ como competencias básicas. Caen definiciones y distinciones.",
    points: [
      {
        title: "Tributo: tres especies",
        body: "Impuesto: prestación unilateral, sin contraprestación directa (renta, IVA, GMF). Tasa: retribuye un servicio divisible (un peaje, un arancel de trámite). Contribución: beneficia a un grupo determinado (contribución de valorización, parafiscales). La DIAN administra sobre todo impuestos nacionales, aduanas y cambios.",
      },
      {
        title: "Elementos esenciales",
        body: "Sujeto activo (el Estado / DIAN), sujeto pasivo (contribuyente o responsable), hecho generador, base gravable y tarifa. Sin ellos, no hay tributo (art. 338 C.P.). Exenciones y exclusiones son beneficios que deben estar en la ley.",
      },
      {
        title: "Clasificaciones útiles",
        body: "Directos (renta) vs. indirectos (IVA). Personales vs. reales. Internos vs. aduaneros. Ordinarios vs. extraordinarios. Nacionales vs. territoriales. El Analista II de esta OPEC vive en los nacionales administrados por la DIAN.",
      },
      {
        title: "Principios",
        body: "Legalidad, igualdad, equidad, eficiencia, progresividad, irretroactividad, certeza. Capacidad contributiva. No confiscatoriedad. El recaudo eficiente no autoriza a violar el debido proceso.",
      },
      {
        title: "Tres sistemas que administra la DIAN",
        body: "Tributario interno (E.T. y Decreto 1625). Aduanero (Decreto 1165 de 2019 y normas de aduanas). Cambiario (régimen de cambios internacionales, en lo de su competencia). Esta OPEC es de obligaciones tributarias, no de aduana, pero la introducción al trípode sí es competencia básica.",
      },
      {
        title: "Evasión, elusión, contrabando",
        body: "Evasión: incumplir la obligación con dolo o culpa, ocultando o mintiendo. Elusión: usar formas jurídicas artificiosas para evitar el hecho generador sin violar literalmente la norma (abuso del derecho / art. 869 E.T. y normas antiabuso). Contrabando: introducir o extraer mercancías evadiendo el control aduanero (Ley 1762 de 2015 y Código Penal). Transparencia: Ley 1712 de 2014.",
      },
    ],
    examTips: [
      "IVA no es tasa. Impuesto de renta no es contribución. Distínguelos con la contraprestación.",
      "Elusión no es lo mismo que evasión: una juega con la forma legal; la otra incumple.",
    ],
    sources: [
      "Constitución arts. 338 y 363",
      "Estatuto Tributario (estructura general)",
      "Ley 1712 de 2014; Ley 1762 de 2015",
    ],
  },
  {
    id: "mipg-archivo",
    track: "funcional",
    number: "12",
    title: "MIPG, archivo y herramientas",
    minutes: 12,
    summary:
      "Modelo Integrado de Planeación y Gestión, Ley General de Archivos y el uso de sistemas institucionales. El Analista II no ‘guarda papeles en el cajón’ ni trabaja por fuera del aplicativo.",
    why: "Competencias básicas 8, 9 y 10 de la ficha. Hay SJT clásicos de radicación, clasificación documental y MIPG.",
    points: [
      {
        title: "MIPG — Decreto 1499 de 2017",
        body: "Articula el quehacer de la administración pública. Siete dimensiones: Talento humano (corazón); Direccionamiento estratégico y planeación; Gestión con valores para resultados; Evaluación de resultados; Información y comunicación; Gestión del conocimiento y la innovación; Control interno. Opera a través de políticas de gestión y desempeño.",
      },
      {
        title: "Gestión documental — Ley 594 de 2000",
        body: "Los documentos públicos se radican, clasifican, retienen y disponen según Tablas de Retención Documental. El expediente de cobro es un archivo de gestión con valor legal. No se fragmenta, no se lleva a casa, no se altera.",
      },
      {
        title: "Radicación",
        body: "Toda comunicación oficial que entra o sale se radica. Una petición anónima se radica. Asignar consecutivo y clasificar no es ‘responder de fondo’: es el primer acto de trámite.",
      },
      {
        title: "Herramientas informáticas",
        body: "El Analista trabaja en los sistemas corporativos de cartera y recaudo (función 9): permisos, calidad del dato, no compartir claves, no extraer bases a USB personal. La información tributaria es reservada.",
      },
    ],
    examTips: [
      "Primera acción ante un documento que entra: radicar, no ‘llevárselo al jefe amigo’.",
      "Talento humano es el corazón de MIPG. No lo olvides si preguntan la dimensión central.",
    ],
    sources: [
      "Decreto 1499 de 2017 (MIPG)",
      "Ley 594 de 2000",
      "Política de gestión documental DIAN",
    ],
  },
  {
    id: "servicio-pqrsf",
    track: "funcional",
    number: "13",
    title: "Servicio al ciudadano y PQRSF",
    minutes: 10,
    summary:
      "Política de servicio, atributos de la atención y el sistema de Peticiones, Quejas, Reclamos, Sugerencias y Felicitaciones. El Analista orienta, no improvisa beneficios.",
    why: "Competencias 13, 14 y 6 (orientación al usuario). Cruza con petición (CPACA) y con integridad (trato digno).",
    points: [
      {
        title: "Atributos del servicio DIAN",
        body: "Amable, respetuoso, oportuno, confiable, claro. Trato de ‘señor/señora’ y nombre. Nada de diminutivos condescendientes. Lenguaje institucional, no jerga interna inexplicada.",
      },
      {
        title: "PQRSF",
        body: "Petición: solicitud de trámite o información. Queja: conducta de un servidor. Reclamo: inconformidad con un servicio. Sugerencia: propuesta de mejora. Felicitación: reconocimiento. Cada una tiene canal y plazo. No se ‘arreglan en el pasillo’.",
      },
      {
        title: "Orientación vs. asesoría privada",
        body: "Explicar pasos de un requerimiento o una campaña es función 8. Delinear la estrategia fiscal del contribuyente, o adelantar el sentido de un acto, no lo es. El límite es la igualdad de trato.",
      },
      {
        title: "Ciudadano alterado",
        body: "Escuchar, no personalizar, informar el procedimiento y, si hay amenaza, activar protocolo de seguridad. Nunca devolver el insulto ni ‘castigar’ el trámite.",
      },
    ],
    examTips: [
      "En SJT de atención, la mejor respuesta siempre combina respeto + procedimiento + registro.",
      "Una queja contra un compañero se tramita por el canal, no se oculta ‘por el equipo’.",
    ],
    sources: [
      "Política de Servicio a la Ciudadanía DIAN",
      "CPACA arts. 5, 7 y 13 y ss.",
      "Ley 1437 y Ley 1755",
    ],
  },
  {
    id: "comportamiento-etico",
    track: "comportamental",
    number: "14",
    title: "Comportamiento ético · nivel 4",
    minutes: 14,
    summary:
      "La ficha exige nivel 4: no basta con ‘cumplir las normas’. Eres referente, identificas presiones indebidas, reportas irregularidades y sostienes el criterio cuando el entorno empuja a mirar para otro lado.",
    why: "Es la competencia comportamental con el nivel más alto del empleo (4). La prueba Likert premia conductas de referente, no de cumplimiento mínimo.",
    points: [
      {
        title: "Definición DIAN",
        body: "Capacidad de actuar con integridad, honestidad, transparencia y consistencia entre el discurso y los hechos, alineado al Código de Integridad y a la Constitución. Incluye el manejo de conflictos de interés.",
      },
      {
        title: "Niveles (lectura de examen)",
        body: "Nivel 1: conoce y cumple lo básico. Nivel 2: aplica criterio ético en el trabajo diario. Nivel 3: promueve el comportamiento ético en el equipo. Nivel 4: es referente, se aparta cuando hay interés, denuncia, resiste presión de pares, de jefes o de contribuyentes.",
      },
      {
        title: "Conductas de nivel 4",
        body: "Rechaza dádivas de cualquier cuantía. Declara y se aparta del expediente de un familiar, socio o amigo. Reporta al jefe y al canal de integridad una irregularidad, aunque involucre a un compañero ‘eficiente’. No usa la base de datos para consultar el NIT de un conocido.",
      },
      {
        title: "Lo que la Likert califica mal",
        body: "‘Lo hablo primero con él para no dañar el clima’. ‘Es una botella de vino, no pasa nada’. ‘El jefe pidió priorizar a ese NIT, yo obedezco sin dejar rastro’. ‘Todos cruzamos la información por WhatsApp personal’.",
      },
    ],
    examTips: [
      "En Likert, si la afirmación es claramente ética, la clave suele ser ‘Totalmente de acuerdo’. Si es un atajo dudoso, ‘Totalmente en desacuerdo’. Evita el centro.",
      "Nivel 4 no es agresivo: es firme y canaliza por el procedimiento.",
    ],
    sources: [
      "Diccionario de Competencias Laborales Conductuales DIAN",
      "Ficha FT-TAH-1824 (nivel 4)",
      "Código de Integridad DIAN CG-TAH-0002 v3",
    ],
  },
  {
    id: "comunicacion-equipo",
    track: "comportamental",
    number: "15",
    title: "Comunicación, equipo y adaptabilidad",
    minutes: 12,
    summary:
      "Las otras tres competencias de la ficha están en nivel 2: comunicar con claridad, colaborar y ajustarse al cambio. Suficiente para el trabajo técnico de seccional, no son liderazgo gerencial.",
    why: "La prueba comportamental del 2676 se arma sobre el diccionario. Si respondes como ‘jefe que decide solo’ o como ‘el que no comparte para verse imprescindible’, pierdes.",
    points: [
      {
        title: "Comunicación efectiva · nivel 2",
        body: "Expresa ideas de forma clara, escucha, verifica comprensión, adapta el lenguaje al ciudadano y al compañero, usa los canales institucionales (correo, sistema, acta). No retiene información operativa. No expone datos reservados en un pasillo.",
      },
      {
        title: "Trabajo en equipo · nivel 2",
        body: "Comparte avances de cartera, cubre un turno cuando el procedimiento lo permite, no se atribuye el trabajo ajeno, pide ayuda a tiempo, no sabotajea la meta del grupo para lucirse. El equipo es la seccional y el proceso, no ‘mi círculo’.",
      },
      {
        title: "Adaptabilidad · nivel 2",
        body: "Acepta un nuevo aplicativo, un cambio de campaña de cobro o una reorganización de expedientes sin bloquear. Propone ajustes viables. No es resistencia pasiva (‘eso no servía en el sistema viejo’) ni entusiasmo vacío que ignora el control.",
      },
      {
        title: "Orientación al logro y al ciudadano",
        body: "Aunque no tienen nivel asignado en el recuadro de la segunda hoja, están en las competencias básicas. Logro = cumplir metas de recaudo y de calidad del dato, no ‘cualquier cifra’. Ciudadano = trámite correcto, no favor.",
      },
    ],
    examTips: [
      "Nivel 2 no exige que ‘inspires a la dirección’. Exige que entregues, informes y te ajustes.",
      "Si el caso enfrenta meta vs. debido proceso, gana el debido proceso (y el ético de nivel 4).",
    ],
    sources: [
      "Diccionario de Competencias Laborales Conductuales DIAN",
      "Ficha FT-TAH-1824",
    ],
  },
  {
    id: "codigo-integridad",
    track: "integridad",
    number: "16",
    title: "Código de Integridad versión 3",
    minutes: 16,
    summary:
      "La prueba de integridad se construye sobre el Código de Integridad DIAN CG-TAH-0002 versión 3 (diciembre 2024), alineado a la Ley 2016 de 2020 y al Código de Integridad del servicio público: Honestidad, Respeto, Compromiso, Diligencia y Justicia.",
    why: "La infografía oficial del 2676 lo dice: integridad = Código v3. La metodología, como en el concurso anterior de Areandina, es Likert y dilemas.",
    points: [
      {
        title: "Marco",
        body: "Ley 2016 de 2020 adopta el Código de Integridad del Servicio Público. La DIAN lo aterriza en su código interno (CG-TAH-0002 v3) y en el Código de Buen Gobierno. No es un afiche: es el criterio con el que se puntúa tu examen y tu periodo de prueba.",
      },
      {
        title: "Los cinco valores",
        body: "Honestidad: verdad y rechazo al beneficio indebido. Respeto: dignidad de toda persona. Compromiso: el interés general por encima del propio. Diligencia: cumplir con calidad y a tiempo. Justicia: decisiones objetivas, sin favoritismos.",
      },
      {
        title: "Lo que hago / lo que no hago",
        body: "Cada valor tiene conductas observables. El examen las traduce a afirmaciones. Estudia ambas columnas: la clave a menudo es reconocer el ‘no hago’ disfrazado de practicidad.",
      },
      {
        title: "Conflicto de interés",
        body: "Cuando el asunto involucra un interés particular (propio, familiar, de socio o de quien te presiona), te apartas, lo declaras y no intervienes. El Código y la Ley 1437 / 1474 lo exigen. En la ficha, ‘me aparto del conocimiento, definición, regulación, supervisión…’.",
      },
      {
        title: "Información reservada",
        body: "La información tributaria es reservada. Consultar, extraer, comentar o usar datos de un NIT sin competencia funcional es falta grave, además de posible delito. WhatsApp personal no es expediente.",
      },
    ],
    examTips: [
      "Ante un dilema, elige la conducta que protege el interés general, deja rastro institucional y se aparta del beneficio propio.",
      "‘Nadie se va a enterar’ es siempre la trampa.",
    ],
    sources: [
      "Código de Integridad DIAN CG-TAH-0002 versión 3",
      "Ley 2016 de 2020",
      "Código de Integridad DAFP (cinco valores)",
      "Ley 1474 de 2011 (Estatuto anticorrupción)",
    ],
  },
  {
    id: "valores-cinco",
    track: "integridad",
    number: "17",
    title: "Los cinco valores, en conducta",
    minutes: 16,
    summary:
      "Traducción de Honestidad, Respeto, Compromiso, Diligencia y Justicia a gestos cotidianos de un Analista II de cartera. Esto es lo que puntúa la Likert.",
    why: "Si solo memorizas los nombres de los valores, fallas las afirmaciones. Hay que saber qué se hace y qué no se hace en ventanilla, en el aplicativo y en el grupo de cobro.",
    points: [
      {
        title: "Honestidad",
        body: "Lo que hago: digo la verdad sobre un saldo, un plazo, un error mío; denuncio el soborno; no prometo lo que el procedimiento no da. Lo que no hago: usar el cargo para un trámite propio o de un familiar; recibir regalos, almuerzos o ‘detalles’ de un deudor; alterar un reporte de recaudo.",
      },
      {
        title: "Respeto",
        body: "Lo que hago: trato digno, incluyente, sin burla por el analfabetismo digital o por el acento; escucho al ciudadano airado. Lo que no hago: apodos, trato diferenciado por vestimenta, comentarios sobre la declaración de alguien en la cafetería.",
      },
      {
        title: "Compromiso",
        body: "Lo que hago: priorizo el interés general, me preparo para la jornada, asumo el expediente que me toca. Lo que no hago: llegar sistemáticamente tarde a las campañas de cobro; abandonar un lote de cartera porque ‘está difícil’; filtrar a un periodista datos de un caso mediático.",
      },
      {
        title: "Diligencia",
        body: "Lo que hago: cumplo términos de petición y de excepciones, actualizo la cuenta corriente, no dejo prescribir una obligación por descuido (art. 817). Lo que no hago: postergar el mandamiento hasta que prescriba; subir expedientes incompletos para ‘cuadrar cifra’.",
      },
      {
        title: "Justicia",
        body: "Lo que hago: aplico el mismo procedimiento al deudor grande y al pequeño; fundamento con el E.T., no con simpatía. Lo que no hago: agilizar la devolución del amigo del jefe; embargar ‘para enseñarle’ a quien me reclamó; ignorar una excepción válida porque el recaudo apremia.",
      },
    ],
    examTips: [
      "Una misma situación puede tocar dos valores. Elige la opción que cubre el valor principal sin romper el otro.",
      "Diligencia no justifica atropellar debido proceso: eso sería injusticia.",
    ],
    sources: [
      "Código de Integridad del Servicio Público (DAFP)",
      "Código de Integridad DIAN v3",
    ],
  },
];

export function modulesByTrack(track: TrackId) {
  return MODULES.filter((m) => m.track === track);
}

export function getModule(id: string) {
  return MODULES.find((m) => m.id === id);
}
