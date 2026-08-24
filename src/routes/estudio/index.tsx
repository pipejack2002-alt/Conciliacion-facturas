import { createFileRoute, Link } from "@tanstack/react-router";
import { TRACKS, type TrackId } from "@/data/types";
import { useProgress } from "@/lib/progress-store";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCargo } from "@/lib/use-cargo";

export const Route = createFileRoute("/estudio/")({ component: EstudioIndex });

const ORDER: TrackId[] = ["funcional", "comportamental", "integridad"];

function EstudioIndex() {
  const read = useProgress((s) => s.readModules);
  const { cargo, modules, questions } = useCargo();
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          Biblioteca · {cargo.shortLabel}
        </p>
        <h1 className="font-display text-3xl font-semibold">Estudiar por módulos</h1>
        <p className="max-w-2xl text-sm text-muted">
          Lecciones alineadas a {cargo.ficha.denominacion} de {cargo.processLabel}.
          Cada una cierra con las claves que suelen caer y con cómo se resuelve
          el caso en tu grado.{" "}
          <Link to="/fuentes" className="text-accent underline-offset-2 hover:underline">
            Fuentes oficiales
          </Link>
          .
        </p>
      </header>

      {ORDER.map((track) => {
        const list = modules.filter((m) => m.track === track);
        if (list.length === 0) return null;
        const done = list.filter((m) => read[m.id]).length;
        return (
          <section key={track} className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">
                  {TRACKS[track].label}
                </h2>
                <p className="text-sm text-muted">{TRACKS[track].nature}</p>
              </div>
              <span className="text-xs tabular-nums text-muted">
                {done}/{list.length}
              </span>
            </div>
            <Progress value={list.length ? (done / list.length) * 100 : 0} />
            <ul className="grid gap-3 sm:grid-cols-2">
              {list.map((m) => {
                const n = questions.filter((q) => q.moduleId === m.id).length;
                const isRead = Boolean(read[m.id]);
                return (
                  <li key={m.id}>
                    <Link
                      to="/estudio/$slug"
                      params={{ slug: m.id }}
                      className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-subtle">
                          {m.number}
                        </span>
                        <Badge variant={isRead ? "ok" : "outline"}>
                          {isRead ? "Leído" : `${m.minutes} min`}
                        </Badge>
                      </div>
                      <h3 className="mt-3 font-display text-lg font-semibold leading-snug">
                        {m.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted">
                        {m.summary}
                      </p>
                      <p className="mt-3 text-[11px] uppercase tracking-[0.12em] text-subtle">
                        {n} preguntas asociadas
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
