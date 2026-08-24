import { CARGO_MODULES } from "@/data/cargo-modules";
import { CATALOG } from "@/data/cargos";
import { FLASHCARDS } from "@/data/flashcards";
import { MODULES } from "@/data/modules";
import { QUESTIONS } from "@/data/questions";
import { QUESTIONS_CARGOS } from "@/data/questions-cargos";
import type { CargoProfile, Flashcard, Module, Question } from "@/data/types";

const EXTRA_BY_ID = new Map(CARGO_MODULES.map((m) => [m.id, m]));

function adapt(text: string, cargo: CargoProfile): string {
  if (cargo.id === "analista-ii-cartera") return text;
  return text.replaceAll("Analista II", cargo.shortLabel);
}

function overlayFichaModule(base: Module, cargo: CargoProfile): Module {
  const f = cargo.ficha;
  return {
    ...base,
    title: `El cargo: ${f.denominacion} · ${cargo.processLabel}`,
    summary: f.proposito,
    why: `La prueba funcional del 2676 se construye sobre las funciones esenciales y el grado de responsabilidad de tu OPEC. Si respondes como otro empleo, fallas casos que parecen de sentido común.`,
    points: [
      {
        title: "Identificación",
        body: `${f.denominacion}, código ${f.codigo}, grado ${f.grado}, ${f.nivel}. ${f.proceso}. Subproceso: ${f.subproceso}. ${f.aplicacion}.`,
      },
      {
        title: "Propósito principal",
        body: f.proposito,
      },
      {
        title: "Lo que sí es tu rol",
        body: cargo.rolBoundary.youDo.join(" "),
      },
      {
        title: "Lo que no es tu rol",
        body: cargo.rolBoundary.youDont.join(" "),
      },
      {
        title: "Frente a otros empleos",
        body: cargo.rolBoundary.vsOthers,
      },
      {
        title: "Qué mide cada prueba (Anexo 2676)",
        body: "Funcionales: conocimientos del MERF (D.L. 927 art. 58). Comportamentales: diccionario DIAN (art. 59). Integridad: coherencia entre creencias y actuación por el bien común. Se califican de 0 a 100. Quien no pasa las eliminatorias queda fuera; las clasificatorias solo se publican a quien superó esas.",
      },
    ],
    examTips: cargo.examFocus,
    sources: [
      f.codigoFicha
        ? `Ficha ${f.codigoFicha}`
        : "Manual específico de funciones DIAN",
      "Acuerdo CNSC 21 de 2025 (Proceso DIAN 2676)",
      "Anexo técnico DIAN 2676, numeral 5",
    ],
  };
}

export function modulesForCargo(cargo: CargoProfile): Module[] {
  const ids = new Set(cargo.moduleIds);
  const fromCore = MODULES.filter((m) => ids.has(m.id)).map((m) => {
    const adapted: Module = {
      ...m,
      title: adapt(m.title, cargo),
      summary: adapt(m.summary, cargo),
      why: adapt(m.why, cargo),
      points: m.points.map((p) => ({
        title: p.title,
        body: adapt(p.body, cargo),
      })),
      examTips: m.examTips.map((t) => adapt(t, cargo)),
    };
    return m.id === "ficha-empleo" ? overlayFichaModule(adapted, cargo) : adapted;
  });
  const extras = [
    ...new Map(
      cargo.moduleIds
        .map((id) => EXTRA_BY_ID.get(id))
        .filter((m): m is Module => {
          if (!m) return false;
          return !fromCore.some((x) => x.id === m.id);
        })
        .map((m) => [m.id, m]),
    ).values(),
  ];
  return [...fromCore, ...extras];
}

export function questionsForCargo(cargo: CargoProfile): Question[] {
  const ids = new Set(cargo.moduleIds);
  const bank = [...QUESTIONS, ...QUESTIONS_CARGOS].filter((q) => ids.has(q.moduleId));
  const extra = cargo.questions ?? [];
  const seen = new Set(bank.map((q) => q.id));
  return [...bank, ...extra.filter((q) => !seen.has(q.id))];
}

export function flashcardsForCargo(cargo: CargoProfile): Flashcard[] {
  const ids = new Set(cargo.moduleIds);
  return FLASHCARDS.filter((c) => ids.has(c.moduleId));
}

export function getCargoModule(cargo: CargoProfile, id: string) {
  return modulesForCargo(cargo).find((m) => m.id === id);
}

export function defaultCargo(): CargoProfile {
  return CATALOG[0];
}
