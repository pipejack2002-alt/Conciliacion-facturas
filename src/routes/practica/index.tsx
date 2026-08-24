import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TRACKS, type TrackId } from "@/data/types";
import { useProgress, trackAccuracy } from "@/lib/progress-store";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useCargo } from "@/lib/use-cargo";
import {
  clearPracticeSession,
  loadPracticeSession,
} from "@/lib/quiz-session";

export const Route = createFileRoute("/practica/")({ component: PracticaIndex });

function PracticaIndex() {
  const answers = useProgress((s) => s.answers);
  const { cargo, modules, questions, flashcards } = useCargo();
  const [pending, setPending] = useState<ReturnType<typeof loadPracticeSession>>(
    null,
  );
  useEffect(() => {
    const s = loadPracticeSession();
    setPending(s && s.cargoId === cargo.id ? s : null);
  }, [cargo.id]);
  const qIds = new Set(questions.map((q) => q.id));
  const missed = Object.entries(answers)
    .filter(([id, v]) => qIds.has(id) && !v.correct)
    .map(([id]) => id);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          Banco de ítems · {cargo.shortLabel}
        </p>
        <h1 className="font-display text-3xl font-semibold">Practicar</h1>
        <p className="max-w-2xl text-sm text-muted">
          Juicio situacional y conocimiento para la funcional; Likert y dilemas
          para comportamental e integridad. Cada ítem trae clave, y al fallar
          ves cómo se resuelve en tu cargo.
        </p>
      </header>

      {pending ? (
        <div className="rounded-xl border border-accent/40 bg-paper px-5 py-4">
          <p className="text-sm font-medium">
            Cuestionario a medias: {pending.title}
          </p>
          <p className="mt-1 text-sm text-muted">
            Pregunta {pending.index + 1} de {pending.ids.length}. Si cierras y
            vuelves, retomas aquí.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/practica/$bank" params={{ bank: pending.bank }}>
                Continuar
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                clearPracticeSession();
                setPending(null);
              }}
            >
              Empezar de cero
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(TRACKS) as TrackId[]).map((id) => {
          const qs = questions.filter((q) => q.track === id);
          const st = trackAccuracy(
            answers,
            qs.map((q) => q.id),
          );
          return (
            <Link
              key={id}
              to="/practica/$bank"
              params={{ bank: id }}
              className="rounded-xl border border-border bg-surface p-5 hover:border-accent/40"
            >
              <h2 className="font-display text-lg font-semibold">{TRACKS[id].label}</h2>
              <p className="mt-1 text-sm text-muted">{qs.length} preguntas</p>
              <div className="mt-3">
                <div className="mb-1.5 flex justify-between text-xs text-muted">
                  <span>
                    {st.answered} hechas · {st.correct} bien
                  </span>
                  <span className="tabular-nums">{st.pct}%</span>
                </div>
                <Progress value={st.pct} />
              </div>
            </Link>
          );
        })}
        <Link
          to="/practica/$bank"
          params={{ bank: "mixto" }}
          className="rounded-xl border border-border bg-surface p-5 hover:border-accent/40"
        >
          <h2 className="font-display text-lg font-semibold">Mixto aleatorio</h2>
          <p className="mt-1 text-sm text-muted">
            20 ítems de los tres bloques, como calentamiento de jornada.
          </p>
        </Link>
        <Link
          to="/practica/$bank"
          params={{ bank: "fallos" }}
          className="rounded-xl border border-border bg-surface p-5 hover:border-accent/40"
        >
          <h2 className="font-display text-lg font-semibold">Repasar fallos</h2>
          <p className="mt-1 text-sm text-muted">
            {missed.length} preguntas de este cargo que has fallado. El banco se
            vacía cuando las aciertas.
          </p>
        </Link>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Por módulo</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/tarjetas">{flashcards.length} tarjetas</Link>
          </Button>
        </div>
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {modules.map((m) => {
            const qs = questions.filter((q) => q.moduleId === m.id);
            if (!qs.length) return null;
            return (
              <li key={m.id}>
                <Link
                  to="/practica/$bank"
                  params={{ bank: `mod-${m.id}` }}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-paper"
                >
                  <span className="text-sm">
                    <span className="font-mono text-[11px] text-subtle mr-2">
                      {m.number}
                    </span>
                    {m.title}
                  </span>
                  <span className="tabular-nums text-xs text-muted">{qs.length}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
