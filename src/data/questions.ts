import type { Question, TrackId } from "./types";
import { QUESTIONS_FUNCIONALES } from "./questions-funcionales";
import { QUESTIONS_COMPORTAMENTALES } from "./questions-comportamentales";
import { QUESTIONS_INTEGRIDAD } from "./questions-integridad";
import { QUESTIONS_OFICIALES } from "./questions-oficiales";

export const QUESTIONS: Question[] = [
  ...QUESTIONS_FUNCIONALES,
  ...QUESTIONS_COMPORTAMENTALES,
  ...QUESTIONS_INTEGRIDAD,
  ...QUESTIONS_OFICIALES,
];

export function questionsByTrack(track: TrackId) {
  return QUESTIONS.filter((q) => q.track === track);
}

export function questionsByModule(moduleId: string) {
  return QUESTIONS.filter((q) => q.moduleId === moduleId);
}

export function getQuestion(id: string) {
  return QUESTIONS.find((q) => q.id === id);
}

function seedFrom(input: string | number) {
  if (typeof input === "number") return Math.abs(input) || 2676;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) || 2676;
}

export function shuffle<T>(items: T[], seed: string | number = 2676): T[] {
  const arr = [...items];
  let s = seedFrom(seed) % 2147483646;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const SIMULACRO = {
  funcional: 40,
  comportamental: 20,
  integridad: 20,
  minutes: 180,
  passFuncional: 70,
} as const;
