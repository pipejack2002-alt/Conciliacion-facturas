import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TrackId } from "@/data/types";

export interface AnswerRecord {
  choice: string;
  correct: boolean;
  at: number;
}

export interface SimulacroRecord {
  id: string;
  at: number;
  funcional: number;
  comportamental: number;
  integridad: number;
  total: number;
  passed: boolean;
}

interface ProgressState {
  answers: Record<string, AnswerRecord>;
  readModules: Record<string, number>;
  bookmarks: string[];
  simulacros: SimulacroRecord[];
  recordAnswer: (id: string, choice: string, correct: boolean) => void;
  markRead: (moduleId: string) => void;
  toggleBookmark: (id: string) => void;
  addSimulacro: (row: Omit<SimulacroRecord, "id" | "at">) => void;
  reset: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      answers: {},
      readModules: {},
      bookmarks: [],
      simulacros: [],
      recordAnswer: (id, choice, correct) =>
        set({
          answers: {
            ...get().answers,
            [id]: { choice, correct, at: Date.now() },
          },
        }),
      markRead: (moduleId) =>
        set({
          readModules: { ...get().readModules, [moduleId]: Date.now() },
        }),
      toggleBookmark: (id) => {
        const has = get().bookmarks.includes(id);
        set({
          bookmarks: has
            ? get().bookmarks.filter((b) => b !== id)
            : [...get().bookmarks, id],
        });
      },
      addSimulacro: (row) =>
        set({
          simulacros: [
            {
              ...row,
              id: `sim-${Date.now()}`,
              at: Date.now(),
            },
            ...get().simulacros,
          ].slice(0, 12),
        }),
      reset: () =>
        set({ answers: {}, readModules: {}, bookmarks: [], simulacros: [] }),
    }),
    { name: "cuaderno-2676-progress", skipHydration: true },
  ),
);

export function trackAccuracy(
  answers: Record<string, AnswerRecord>,
  ids: string[],
) {
  const subset = ids.filter((id) => answers[id]);
  if (subset.length === 0) return { answered: 0, correct: 0, pct: 0 };
  const correct = subset.filter((id) => answers[id].correct).length;
  return {
    answered: subset.length,
    correct,
    pct: Math.round((correct / subset.length) * 100),
  };
}

export function examCountdown() {
  const target = Date.UTC(2026, 10, 1, 13, 0, 0);
  const now = Date.now();
  const diff = Math.max(0, target - now);
  const days = Math.floor(diff / 86400000);
  return { days, targetLabel: "noviembre 2026" };
}

export const TRACK_ORDER: TrackId[] = [
  "funcional",
  "comportamental",
  "integridad",
];
