import { createServerFn } from "@tanstack/react-start";
import { ALLOWED_MODULE_IDS } from "@/data/cargos";
import type { CargoFamily, CargoProfile, Question } from "@/data/types";
import { buildCargoFromText, isUsefulCargo } from "@/lib/ficha-parser";
import { extractPdfText } from "@/lib/extract-pdf";

export interface ParseManualInput {
  kind: "pdf" | "image" | "text";
  filename: string;
  mime: string;
  data: string;
}

export type ParseManualResult =
  | { ok: true; cargo: CargoProfile }
  | { ok: false; error: string };

const FAMILY: CargoFamily[] = [
  "analista",
  "gestor",
  "inspector",
  "facilitador",
  "otro",
];

function asFamily(v: unknown): CargoFamily {
  return FAMILY.includes(v as CargoFamily) ? (v as CargoFamily) : "otro";
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function strs(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x)).filter(Boolean);
}

function clip(s: string, n: number) {
  return s.length <= n ? s : s.slice(0, n);
}

async function pdfToText(base64: string): Promise<string> {
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  return extractPdfText(bytes);
}

function parseQuestions(raw: unknown, cargoId: string): Question[] {
  if (!Array.isArray(raw)) return [];
  const out: Question[] = [];
  raw.slice(0, 8).forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const q = item as Record<string, unknown>;
    const choicesRaw = Array.isArray(q.choices) ? q.choices : [];
    const choices = choicesRaw
      .map((c, idx) => {
        if (c && typeof c === "object") {
          const row = c as Record<string, unknown>;
          return {
            id: str(row.id, String.fromCharCode(97 + idx)),
            text: str(row.text),
          };
        }
        return { id: String.fromCharCode(97 + idx), text: str(c) };
      })
      .filter((c) => c.text)
      .slice(0, 4);
    if (choices.length < 2) return;
    const correct = str(q.correct, choices[0].id);
    const moduleHint = str(q.moduleHint, "ficha-empleo");
    const moduleId = ALLOWED_MODULE_IDS.includes(moduleHint)
      ? moduleHint
      : "ficha-empleo";
    const kind = str(q.kind, "sjt");
    out.push({
      id: `c-${cargoId}-${i + 1}`,
      track: "funcional",
      moduleId,
      kind:
        kind === "knowledge" || kind === "likert" || kind === "dilemma"
          ? kind
          : "sjt",
      caseText: str(q.caseText) || undefined,
      stem: str(q.stem, "Según el manual de funciones, lo correcto es"),
      choices,
      correct: choices.some((c) => c.id === correct) ? correct : choices[0].id,
      explanation: str(q.explanation, "Revisa la función esencial del empleo."),
      source: str(q.source, "Manual de funciones del empleo"),
      difficulty: 2,
    });
  });
  return out;
}

function toCargo(parsed: Record<string, unknown>, filename: string): CargoProfile {
  const fichaRaw =
    parsed.ficha && typeof parsed.ficha === "object"
      ? (parsed.ficha as Record<string, unknown>)
      : parsed;
  const family = asFamily(parsed.family);
  const denominacion = str(fichaRaw.denominacion, "Empleo según manual");
  const shortLabel = str(
    parsed.shortLabel,
    denominacion.split("·")[0]?.trim() || denominacion,
  );
  const id = `custom-${Date.now().toString(36)}`;
  const moduleIds = strs(parsed.moduleIds).filter((m) =>
    ALLOWED_MODULE_IDS.includes(m),
  );
  const fallbackModules = [
    "ficha-empleo",
    ...["cpaca", "constitucion-funcion", "sistema-tributario", "mipg-archivo", "servicio-pqrsf", "comportamiento-etico", "comunicacion-equipo", "codigo-integridad", "valores-cinco"],
  ];
  const guidesRaw = Array.isArray(parsed.functionGuides)
    ? parsed.functionGuides
    : [];
  const rol =
    parsed.rolBoundary && typeof parsed.rolBoundary === "object"
      ? (parsed.rolBoundary as Record<string, unknown>)
      : {};
  const comps = Array.isArray(fichaRaw.competenciasComportamentales)
    ? fichaRaw.competenciasComportamentales
        .map((c) => {
          if (c && typeof c === "object") {
            const row = c as Record<string, unknown>;
            return {
              nombre: str(row.nombre),
              nivel: Number(row.nivel) || 2,
            };
          }
          return { nombre: str(c), nivel: 2 };
        })
        .filter((c) => c.nombre)
    : [{ nombre: "Comportamiento ético", nivel: 4 }];

  return {
    id,
    family,
    shortLabel,
    processLabel: str(
      parsed.processLabel || fichaRaw.subproceso,
      str(fichaRaw.proceso, "Proceso misional"),
    ),
    blurb: str(parsed.blurb, clip(str(fichaRaw.proposito, "Guía según tu manual."), 180)),
    custom: true,
    ficha: {
      denominacion,
      codigo: str(fichaRaw.codigo, "—"),
      grado: str(fichaRaw.grado, "—"),
      nivel: str(
        fichaRaw.nivel,
        family === "analista" ? "Nivel Técnico" : "Nivel Profesional",
      ),
      tipoEmpleo: str(fichaRaw.tipoEmpleo, "Carrera Administrativa"),
      codigoFicha: str(fichaRaw.codigoFicha) || undefined,
      proceso: str(fichaRaw.proceso, "Proceso misional DIAN"),
      subproceso: str(fichaRaw.subproceso, "Según manual"),
      aplicacion: str(fichaRaw.aplicacion, "Niveles Central y Seccional"),
      proposito: str(fichaRaw.proposito, "Según el manual de funciones cargado."),
      funciones: strs(fichaRaw.funciones).slice(0, 12),
      estudios: str(fichaRaw.estudios, "Los que señale el manual / la OPEC."),
      nbc: strs(fichaRaw.nbc),
      experiencia: str(fichaRaw.experiencia, "La que señale la OPEC."),
      equivalencias: Boolean(fichaRaw.equivalencias),
      competenciasFuncionales: strs(fichaRaw.competenciasFuncionales).slice(0, 12),
      competenciasComportamentales: comps,
    },
    rolBoundary: {
      youDo: strs(rol.youDo).slice(0, 8),
      youDont: strs(rol.youDont).slice(0, 8),
      vsOthers: str(
        rol.vsOthers,
        "Actúa solo en el grado de responsabilidad de tu ficha.",
      ),
    },
    examFocus: strs(parsed.examFocus).slice(0, 8),
    functionGuides: guidesRaw.slice(0, 10).map((g, i) => {
      const row = g && typeof g === "object" ? (g as Record<string, unknown>) : {};
      const related = strs(row.relatedModuleIds).filter((m) =>
        ALLOWED_MODULE_IDS.includes(m),
      );
      return {
        functionTitle: str(row.functionTitle, `Función ${i + 1}`),
        howToResolve: str(
          row.howToResolve,
          "Sigue el procedimiento escrito y tu competencia.",
        ),
        steps: strs(row.steps).slice(0, 6),
        typicalFail: str(
          row.typicalFail,
          "Actuar como otro empleo o saltarse el procedimiento.",
        ),
        correctMove: str(
          row.correctMove,
          "Procedimiento + competencia + rastro institucional.",
        ),
        source: str(row.source, filename),
        relatedModuleIds: related.length ? related : ["ficha-empleo"],
        roleNote: str(row.roleNote) || undefined,
      };
    }),
    moduleIds: moduleIds.length ? [...new Set(moduleIds)] : fallbackModules,
    questions: parseQuestions(parsed.questions, id),
  };
}

const SYSTEM = `Eres un tutor del concurso DIAN 2676 (CNSC, Acuerdo 21 de 2025). Extraes un empleo del Manual de funciones o ficha FT-TAH y armas una guía de estudio.
Responde SOLO JSON válido, sin markdown, con esta forma:
{
  "family": "analista"|"gestor"|"inspector"|"facilitador"|"otro",
  "shortLabel": "Analista II",
  "processLabel": "subproceso corto",
  "blurb": "una frase",
  "ficha": {
    "denominacion": "", "codigo": "", "grado": "", "nivel": "",
    "tipoEmpleo": "Carrera Administrativa", "codigoFicha": "",
    "proceso": "", "subproceso": "", "aplicacion": "",
    "proposito": "", "funciones": [""], "estudios": "",
    "nbc": [""], "experiencia": "", "equivalencias": true,
    "competenciasFuncionales": [""],
    "competenciasComportamentales": [{"nombre":"","nivel":4}]
  },
  "rolBoundary": { "youDo": [""], "youDont": [""], "vsOthers": "" },
  "examFocus": [""],
  "moduleIds": ["ficha-empleo"],
  "functionGuides": [{
    "functionTitle": "",
    "howToResolve": "cómo se resuelve el caso en el procedimiento real",
    "steps": ["paso"],
    "typicalFail": "",
    "correctMove": "",
    "source": "",
    "relatedModuleIds": ["ficha-empleo"],
    "roleNote": "qué hace ESTE empleo en esa función"
  }],
  "questions": [{
    "kind": "sjt",
    "caseText": "",
    "stem": "",
    "choices": [{"id":"a","text":""},{"id":"b","text":""},{"id":"c","text":""},{"id":"d","text":""}],
    "correct": "b",
    "explanation": "",
    "source": "",
    "moduleHint": "ficha-empleo"
  }]
}
Módulos permitidos en moduleIds, relatedModuleIds y moduleHint:
${ALLOWED_MODULE_IDS.join(", ")}
Reglas:
- Analista = nivel técnico, ejecuta. Gestor = profesional, decide/coordina. Inspector = pruebas/visitas.
- 5 a 8 functionGuides. Cada una debe explicar CÓMO SE RESUELVE (pasos del procedimiento, no teoría vacía).
- 6 a 8 preguntas SJT o knowledge, una sola correcta, distractores plausibles de examen.
- Si el documento es parcial, infiere con honestidad y no inventes códigos OPEC falsos: usa "—" si no está.
- Español de Colombia, tono de cuaderno de estudio.`;

async function chatJson(
  userContent:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >,
  timeoutMs = 14000,
): Promise<Record<string, unknown> | null> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fromHeuristic(text: string, filename: string): CargoProfile | null {
  try {
    const cargo = buildCargoFromText(text, filename);
    if (cargo && isUsefulCargo(cargo)) return cargo;
    return null;
  } catch {
    return null;
  }
}

export const parseManual = createServerFn({ method: "POST" })
  .validator((input: ParseManualInput) => input)
  .handler(async ({ data }): Promise<ParseManualResult> => {
    try {
      if (data.kind === "text") {
        const text = clip(data.data.trim(), 40000);
        if (text.length < 80) {
          return { ok: false, error: "Pega más texto del manual o de la ficha." };
        }
        const local = fromHeuristic(text, data.filename);
        if (local) return { ok: true, cargo: local };
        const parsed = await chatJson(
          `Manual o ficha del empleo (texto). Archivo: ${data.filename}\n\n${text}`,
        );
        if (parsed) return { ok: true, cargo: toCargo(parsed, data.filename) };
        return {
          ok: false,
          error:
            "No reconocí la ficha en ese texto. Incluye denominación, propósito y funciones esenciales.",
        };
      }

      if (data.kind === "image") {
        if (!process.env.XAI_API_KEY) {
          return {
            ok: false,
            error:
              "No pude leer esa foto. Sube el PDF de la ficha o pega el texto.",
          };
        }
        const url = data.data.startsWith("data:")
          ? data.data
          : `data:${data.mime};base64,${data.data}`;
        const parsed = await chatJson(
          [
            {
              type: "text",
              text: `Esta imagen es un manual de funciones o ficha de empleo DIAN (${data.filename}). Extrae el cargo y arma la guía.`,
            },
            { type: "image_url", image_url: { url } },
          ],
          18000,
        );
        if (parsed) {
          const cargo = toCargo(parsed, data.filename);
          if (isUsefulCargo(cargo) || cargo.ficha.funciones.length > 0) {
            return { ok: true, cargo };
          }
        }
        return {
          ok: false,
          error:
            "No pude leer esa foto con nitidez. Sube el PDF o pega propósito y funciones.",
        };
      }

      const text = clip(await pdfToText(data.data), 40000);
      if (text.replace(/\s/g, "").length < 40) {
        return {
          ok: false,
          error:
            "Ese PDF no tiene texto seleccionable (parece un escaneo). Prueba una foto nítida o pega el texto de la ficha.",
        };
      }
      const local = fromHeuristic(text, data.filename);
      if (local) return { ok: true, cargo: local };
      const parsed = await chatJson(
        `PDF de manual de funciones / ficha. Archivo: ${data.filename}\n\n${text}`,
      );
      if (parsed) return { ok: true, cargo: toCargo(parsed, data.filename) };
      return {
        ok: false,
        error:
          "Leí el PDF pero no reconocí la ficha. Pega denominación, propósito y funciones esenciales.",
      };
    } catch (err) {
      console.error("[parse-manual]", err);
      return {
        ok: false,
        error:
          "No pude armar la guía con ese archivo. Prueba otro PDF, una foto nítida o pega el texto.",
      };
    }
  });
