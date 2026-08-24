import { createFileRoute, Link } from "@tanstack/react-router";
import { TRACKS, type TrackId } from "@/data/types";
import { useProgress, trackAccuracy } from "@/lib/progress-store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FailDiagnosis } from "@/components/fail-diagnosis";
import { useCargo } from "@/lib/use-cargo";

export const Route = createFileRoute("/progreso")({ component: ProgresoPage });

function ProgresoPage() {
  const answers = useProgress((s) => s.answers);
  const read = useProgress((s) => s.readModules);
  const sims = useProgress((s) => s.simulacros);
  const reset = useProgress((s) => s.reset);
  const { cargo, modules, questions } = useCargo();
  const ids = new Set(questions.map((q) => q.id));
  const answered = Object.keys(answers).filter((id) => ids.has(id)).length;
  const correct = Object.entries(answers).filter(
    ([id, a]) => ids.has(id) && a.correct,
  ).length;
  const missed = questions.filter((q) => answers[q.id] && !answers[q.id].correct);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          Seguimiento · {cargo.shortLabel}
        </p>
        <h1 className="font-display text-3xl font-semibold">Progreso</h1>
        <p className="text-sm text-muted">
          Se guarda en este dispositivo. El diagnóstico usa tu cargo activo.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Respondidas" value={`${answered}/${questions.length}`} />
        <Stat
          label="Acierto"
          value={answered ? `${Math.round((correct / answered) * 100)}%` : "—"}
        />
        <Stat
          label="Módulos leídos"
          value={`${modules.filter((m) => read[m.id]).length}/${modules.length}`}
        />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Por prueba</h2>
        {(Object.keys(TRACKS) as TrackId[]).map((id) => {
          const qs = questions.filter((q) => q.track === id);
          const st = trackAccuracy(
            answers,
            qs.map((q) => q.id),
          );
          return (
            <div key={id} className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-2 flex justify-between text-sm">
                <span>{TRACKS[id].label}</span>
                <span className="tabular-nums text-muted">
                  {st.answered}/{qs.length} · {st.pct}%
                </span>
              </div>
              <Progress value={qs.length ? (st.answered / qs.length) * 100 : 0} />
            </div>
          );
        })}
      </section>

      <FailDiagnosis missed={missed} cargo={cargo} />

      {missed.length > 0 ? (
        <Button asChild variant="secondary">
          <Link to="/practica/$bank" params={{ bank: "fallos" }}>
            Repasar {missed.length} fallos
          </Link>
        </Button>
      ) : null}

      {sims.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Simulacros</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {sims.map((s) => (
              <li key={s.id} className="flex justify-between px-4 py-3 text-sm">
                <span className="text-muted">
                  {new Date(s.at).toLocaleString("es-CO")}
                </span>
                <span className="tabular-nums">
                  {s.total}% {s.passed ? "· umbral funcional ok" : "· funcional bajo 70"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button variant="outline" onClick={() => reset()}>
        Borrar avance de este dispositivo
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
