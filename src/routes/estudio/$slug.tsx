import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck } from "lucide-react";
import { TRACKS } from "@/data/types";
import { topicForModule } from "@/data/topics";
import { useProgress } from "@/lib/progress-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCargo } from "@/lib/use-cargo";

export const Route = createFileRoute("/estudio/$slug")({
  component: ModulePage,
});

function ModulePage() {
  const { slug } = Route.useParams();
  const { cargo, modules, questions } = useCargo();
  const mod = modules.find((m) => m.id === slug);
  const markRead = useProgress((s) => s.markRead);

  useEffect(() => {
    if (mod) markRead(mod.id);
  }, [mod, markRead]);

  if (!mod) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-2xl font-semibold">Módulo no encontrado</h1>
        <p className="text-sm text-muted">
          Este tema no entra en {cargo.shortLabel}. Cambia de cargo o vuelve a la
          biblioteca.
        </p>
        <Link to="/estudio" className="text-sm text-accent">
          Volver a la biblioteca
        </Link>
      </div>
    );
  }

  const idx = modules.findIndex((m) => m.id === mod.id);
  const prev = modules[idx - 1];
  const next = modules[idx + 1];
  const nQ = questions.filter((q) => q.moduleId === mod.id).length;
  const topic = topicForModule(mod.id);
  const guide = cargo.functionGuides.find((g) =>
    g.relatedModuleIds.includes(mod.id),
  );

  return (
    <article className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          to="/estudio"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Biblioteca
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge variant="paper">{TRACKS[mod.track].short}</Badge>
          <Badge variant="outline">{mod.minutes} min</Badge>
          <span className="font-mono text-[11px] text-subtle">{mod.number}</span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-balance">
          {mod.title}
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">{mod.summary}</p>
      </div>

      {guide || topic ? (
        <section className="rounded-xl border-l-2 border-rule bg-paper px-5 py-4">
          <h2 className="font-display text-lg font-semibold">
            Cómo se resuelve en {cargo.shortLabel}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            {guide?.howToResolve ?? topic?.how}
          </p>
          {guide?.roleNote ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">{guide.roleNote}</p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">Por qué cae</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink">{mod.why}</p>
      </section>

      <ol className="space-y-4">
        {mod.points.map((p) => (
          <li key={p.title} className="rounded-xl border border-border bg-surface p-5">
            <h3 className="font-display text-lg font-semibold">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink">{p.body}</p>
          </li>
        ))}
      </ol>

      <section className="rounded-xl border-l-2 border-rule bg-paper px-5 py-4">
        <h2 className="font-display text-lg font-semibold">Claves de examen</h2>
        <ul className="mt-3 space-y-2">
          {mod.examTips.map((t) => (
            <li key={t} className="text-sm leading-relaxed text-ink">
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Fuentes</p>
        <ul className="mt-2 space-y-1">
          {mod.sources.map((s) => (
            <li key={s} className="text-sm text-muted">
              {s}
            </li>
          ))}
        </ul>
      </section>

      {nQ > 0 ? (
        <Button asChild>
          <Link to="/practica/$bank" params={{ bank: `mod-${mod.id}` }}>
            <ClipboardCheck className="size-4" />
            Practicar {nQ} preguntas de este módulo
          </Link>
        </Button>
      ) : null}

      <nav className="flex items-center justify-between gap-3 border-t border-border pt-4">
        {prev ? (
          <Link
            to="/estudio/$slug"
            params={{ slug: prev.id }}
            className="max-w-[45%] text-sm text-muted hover:text-ink"
          >
            <span className="flex items-center gap-1">
              <ArrowLeft className="size-4 shrink-0" />
              <span className="line-clamp-1">{prev.title}</span>
            </span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            to="/estudio/$slug"
            params={{ slug: next.id }}
            className="max-w-[45%] text-right text-sm text-muted hover:text-ink"
          >
            <span className="flex items-center justify-end gap-1">
              <span className="line-clamp-1">{next.title}</span>
              <ArrowRight className="size-4 shrink-0" />
            </span>
          </Link>
        ) : null}
      </nav>
    </article>
  );
}
