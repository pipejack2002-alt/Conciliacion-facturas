import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { CnscExam, loadExamSession } from "@/components/cnsc-exam";
import { shuffle, SIMULACRO } from "@/data/questions";
import { useProgress } from "@/lib/progress-store";
import { useCargo } from "@/lib/use-cargo";
import type { Question, TrackId } from "@/data/types";

export const Route = createFileRoute("/simulacro/examen")({
  validateSearch: (s: Record<string, unknown>) => {
    const v = s.reloj;
    const timed = !(v === false || v === "false" || v === "0" || v === 0);
    return { reloj: timed };
  },
  component: SimulacroExamen,
});

function assemble(all: Question[], seed: number) {
  const take = (track: TrackId, n: number, extra: number) =>
    shuffle(
      all.filter((q) => q.track === track),
      seed + extra,
    ).slice(0, n);
  return [
    ...take("funcional", SIMULACRO.funcional, 0),
    ...take("comportamental", SIMULACRO.comportamental, 11),
    ...take("integridad", SIMULACRO.integridad, 23),
  ];
}

function SimulacroExamen() {
  const { reloj } = Route.useSearch();
  const add = useProgress((s) => s.addSimulacro);
  const { cargo, questions: all } = useCargo();

  const booklet = useMemo(() => {
    const prev = loadExamSession();
    if (prev && prev.cargoId === cargo.id) {
      const map = new Map(all.map((q) => [q.id, q]));
      const restored = prev.ids
        .map((id) => map.get(id))
        .filter((q): q is Question => Boolean(q));
      if (restored.length === prev.ids.length && restored.length > 0) {
        return restored;
      }
    }
    return assemble(all, Date.now());
  }, [all, cargo.id]);

  return (
    <CnscExam
      booklet={booklet}
      cargoId={cargo.id}
      timed={reloj}
      onFinish={(result) => {
        add({
          funcional: result.funcional,
          comportamental: result.comportamental,
          integridad: result.integridad,
          total: result.total,
          passed: result.passed,
        });
      }}
    />
  );
}
