import type { Module } from "./types";

export const CARGO_MODULES: Module[] = [
  {
    id: "rol-gestor",
    track: "funcional",
    number: "18",
    title: "El Gestor: decidir en el grado profesional",
    minutes: 14,
    summary:
      "En el 2676 el Gestor es nivel profesional. No ‘hace de Analista con mejor sueldo’: prioriza, revisa calidad, proyecta o suscribe actos según competencia y responde por los términos.",
    why: "El juicio situacional de Gestor se pierde cuando eliges la opción de ejecutar el oficio tú mismo o la de firmar como si fueras el Subdirector. El examen premia el grado de responsabilidad del empleo.",
    points: [
      {
        title: "Verbos del nivel profesional",
        body: "Coordinar, proyectar, revisar, decidir, suscribir cuando hay competencia o delegación, orientar al equipo técnico, controlar prescripción y calidad del dato. El Analista apoya, verifica y tramita. El Inspector practica pruebas. No los mezcles.",
      },
      {
        title: "Competencia y delegación",
        body: "Un acto (mandamiento, requerimiento especial, liquidación) lo firma quien tenga competencia en el manual y en el acto de delegación. Si no la tienes, proyectas y elevas. Firmar ‘porque el jefe está en reunión’ es vicio de incompetencia (excepción 831 y nulidad).",
      },
      {
        title: "Control de términos",
        body: "El Gestor responde porque un título no prescriba (817), porque el requerimiento especial se profiera a tiempo, porque las excepciones se resuelvan. Eso no se delega en el olvido del Analista: se asigna, se hace seguimiento y se deja rastro.",
      },
      {
        title: "Calidad antes del acto",
        body: "Antes de firmar o de elevar: título ejecutivo existente, notificación previa en regla, cuenta corriente depurada, expediente completo. Devolver al Analista con observación escrita no es falta de equipo: es el control del profesional.",
      },
      {
        title: "Relación con el Analista y el Inspector",
        body: "Asignas lotes, fijas prioridad (cuantía, prescripción, riesgo) y no retienes información. No haces el trabajo operativo para lucirte ni ignoras un hallazgo de visita porque ‘daña la meta’.",
      },
    ],
    examTips: [
      "Si el caso dice Gestor y una opción es ‘diligenciar el oficio de citación’, suele ser pobre: eso lo ejecuta el Analista bajo tu instrucción.",
      "Si la opción es ‘firmar el mandamiento’ y el caso no acredita tu competencia, es incorrecta.",
      "La mejor respuesta combina: procedimiento + competencia + rastro en el sistema.",
    ],
    sources: [
      "Manual específico de funciones DIAN, nivel profesional",
      "Resolución 0067 de 2024",
      "Acuerdo CNSC 21 de 2025",
    ],
  },
  {
    id: "fiscalizacion-determinacion",
    track: "funcional",
    number: "19",
    title: "Fiscalización y determinación oficial",
    minutes: 20,
    summary:
      "La fiscalización investiga (art. 684). La determinación oficial —liquidación de revisión o de aforo— es el acto que fija el tributo. Por regla, a la revisión le precede el requerimiento especial.",
    why: "En OPEC de fiscalización este es el corazón de la prueba funcional. El error clásico es liquidar de una vez o confundir emplazamiento, requerimiento especial y liquidación.",
    points: [
      {
        title: "Facultades — art. 684",
        body: "Investigar, inspeccionar, exigir información, practicar visitas y examinar documentos. Amplias, pero con reserva tributaria y debido proceso. No son un cheque en blanco para hostigar.",
      },
      {
        title: "Requerimiento especial — arts. 703 y 704",
        body: "Acto previo, por regla, a la liquidación de revisión. Debe contener los hechos, las pruebas y las glosas, y proponer las modificaciones a la declaración. Sin él, la revisión suele viciarse.",
      },
      {
        title: "Respuesta — art. 707",
        body: "El contribuyente tiene tres (3) meses para responder. Puede aceptar, aceptar en parte o desvirtuar. El silencio no impide liquidar; tampoco es confesión automática de todo.",
      },
      {
        title: "Liquidación de revisión — arts. 702 y 713",
        body: "Acto de determinación por inexactitud. Se profiere en el término legal después de la respuesta o del vencimiento. Ejecutoriada, es título ejecutivo (828-2) y alimenta el cobro.",
      },
      {
        title: "Aforo — art. 717",
        body: "Para omisos: primero emplazamiento para declarar (715). Si no declaran, aforo. No uses aforo contra quien sí declaró (ahí va revisión) ni revisión contra quien no ha declarado (ahí va aforo).",
      },
      {
        title: "Emplazamiento para corregir — art. 705",
        body: "Acto de trámite que invita a corregir. No reemplaza el requerimiento especial ni es liquidación. Útil en control extensivo y como paso previo en algunos programas.",
      },
    ],
    examTips: [
      "Cadena de revisión: investigación → requerimiento especial → 3 meses → liquidación de revisión.",
      "Cadena de omiso: emplazamiento para declarar → aforo.",
      "El Gestor de fiscalización decide y proyecta el acto; el Analista arma el expediente y los cruces; el Inspector visita y acta.",
    ],
    sources: [
      "Estatuto Tributario arts. 684, 702 a 720",
      "Decreto 1625 de 2016 (procedimientos)",
    ],
  },
  {
    id: "inspeccion-visitas",
    track: "funcional",
    number: "20",
    title: "Visitas, actas y material probatorio",
    minutes: 14,
    summary:
      "La visita es una facultad de fiscalización. El Inspector se identifica, delimita el objeto, recoge prueba y deja acta. Los hechos del acta alimentan el requerimiento; no son todavía la liquidación.",
    why: "En cargos de Inspector el SJT se arma sobre el acta, la reserva, la cadena de custodia y la tentación de ‘arreglar’ con el visitado.",
    points: [
      {
        title: "Inicio de la visita",
        body: "Identificación del servidor, exhibición del acto que la ordena, objeto y alcance. El visitado tiene derecho a que le expliquen el propósito. No se ‘entra de paisano’ ni se excede el objeto.",
      },
      {
        title: "El acta",
        body: "Relata hechos, documentos exhibidos, pretensiones de las partes y observaciones. Es prueba. No es un ensayo de recaudo ni un acuerdo de pago. Lo que no quedó en el acta, cuesta demostrarlo después.",
      },
      {
        title: "Pruebas y reserva",
        body: "Documentos, declaraciones, inspección. Cadena de custodia. La información tributaria es reservada: no se comenta con el vecino del predio ni se manda por WhatsApp personal.",
      },
      {
        title: "Límite del Inspector",
        body: "No determina el tributo en el predio, no condona, no recibe dinero, no promete que ‘eso no va para liquidación’. Traslada el informe al Gestor o al competente para el requerimiento.",
      },
      {
        title: "Hallazgo incómodo",
        body: "Si aparece un hecho que el visitado pide ‘dejar por fuera’, se acta. Omitirlo es falta e integridad. Diligencia no es complicidad.",
      },
    ],
    examTips: [
      "En SJT de visita, la opción correcta deja rastro, respeta el objeto y no negocia el tributo.",
      "Exceder el objeto de la visita vicia la prueba.",
      "El acta se firma; si el visitado se niega, se deja constancia.",
    ],
    sources: [
      "E.T. arts. 684 y 779 y concordantes",
      "Procedimientos de visita e inspección DIAN",
      "Código de Integridad v3",
    ],
  },
];
