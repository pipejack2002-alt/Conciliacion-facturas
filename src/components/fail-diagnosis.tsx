import { Link } from "@tanstack/react-router";
import { topicForModule } from "@/data/topics";
import type { CargoProfile, Question } from "@/data/types";
import { Badge } from "@/components/ui/badge";

export function FailDiagnosis({
  missed,
  cargo,
}: {
  missed: Question[];
  cargo: CargoProfile;
}) {
  if (missed.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-ok-soft px-4 py-3 text-sm text-ok">
        Sin fallos en este bloque. Sigue con un simulacro o con otro banco.
      </p>
    );
  }

  const byModule = new Map<string, Question[]>();
  for (const q of missed) {
    const list = byModule.get(q.moduleId) ?? [];
    list.push(q);
    byModule.set(q.moduleId, list);
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h2 className="font-display text-xl font-semibold">En qué fallaste</h2>
        <p className="text-sm text-muted">
          No es solo la clave: es cómo se resuelve en el procedimiento de{" "}
          {cargo.shortLabel}.
        </p>
      </header>
      <ul className="space-y-4">
        {[...byModule.entries()].map(([moduleId, qs]) => {
          const topic = topicForModule(moduleId);
          const guide = cargo.functionGuides.find((g) =>
            g.relatedModuleIds.includes(moduleId),
          );
          const title = guide?.functionTitle ?? topic?.title ?? moduleId;
          const how = guide?.howToResolve ?? topic?.how;
          const steps = guide?.steps?.length ? guide.steps : topic?.steps;
          const move = guide?.correctMove ?? topic?.correctMove;
          const role = guide?.roleNote;
          return (
            <li
              key={moduleId}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{title}</h3>
                <Badge variant="bad">{qs.length} fallo{qs.length === 1 ? "" : "s"}</Badge>
              </div>
              {how ? (
                <p className="mt-2 text-sm leading-relaxed text-ink">{how}</p>
              ) : null}
              {role ? (
                <p className="mt-2 rounded-md border-l-2 border-rule bg-paper px-3 py-2 text-sm leading-relaxed">
                  En tu cargo: {role}
                </p>
              ) : null}
              {steps && steps.length > 0 ? (
                <ol className="mt-3 space-y-1">
                  {steps.map((s) => (
                    <li key={s} className="flex gap-2 text-sm leading-relaxed">
                      <span className="font-mono text-[11px] text-subtle">→</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              {move ? (
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Jugada correcta: {move}
                </p>
              ) : null}
              <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-paper">
                {qs.slice(0, 4).map((q) => (
                  <li key={q.id} className="px-3 py-2.5 text-sm">
                    <p className="leading-snug">{q.stem}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">
                      {q.explanation}
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                to="/estudio/$slug"
                params={{ slug: moduleId }}
                className="mt-3 inline-flex text-sm text-accent underline-offset-2 hover:underline"
              >
                Estudiar este módulo
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
