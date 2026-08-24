import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, ClipboardCheck } from "lucide-react";
import { useCargo } from "@/lib/use-cargo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/guia")({ component: GuiaPage });

function GuiaPage() {
  const { cargo, ficha, questions, modules } = useCargo();
  const guides = cargo.functionGuides;

  return (
    <div className="space-y-10">
      <header className="relative overflow-hidden rounded-xl border border-border bg-surface p-6 sm:p-8">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-rule" />
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          Guía del empleo · {ficha.nivel}
        </p>
        <h1 className="mt-2 max-w-xl font-display text-3xl font-semibold leading-[1.15]">
          {ficha.denominacion}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {cargo.processLabel}
          {ficha.codigo !== "—"
            ? ` · código ${ficha.codigo} grado ${ficha.grado}`
            : null}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink">
          {ficha.proposito}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/estudio">
              Estudiar módulos
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/cargo">Cambiar cargo</Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-semibold">Tú sí haces</h2>
          <ul className="mt-3 space-y-2">
            {cargo.rolBoundary.youDo.map((x) => (
              <li key={x} className="text-sm leading-relaxed">
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-semibold">Tú no haces</h2>
          <ul className="mt-3 space-y-2">
            {cargo.rolBoundary.youDont.map((x) => (
              <li key={x} className="text-sm leading-relaxed">
                {x}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <p className="rounded-md border-l-2 border-rule bg-paper px-4 py-3 text-sm leading-relaxed">
        {cargo.rolBoundary.vsOthers}
      </p>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Qué cae en el examen</h2>
        <ol className="space-y-2">
          {cargo.examFocus.map((x, i) => (
            <li key={x} className="flex gap-3 text-sm leading-relaxed">
              <span className="font-mono text-[11px] text-subtle">
                {String(i + 1).padStart(2, "0")}
              </span>
              {x}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-semibold">
            Cómo se resuelven las cosas
          </h2>
          <p className="mt-1 text-sm text-muted">
            Cada función con el procedimiento, el fallo típico y la jugada
            correcta para {cargo.shortLabel}.
          </p>
        </div>
        <ol className="space-y-3">
          {guides.map((g, i) => (
            <li
              key={`${g.functionTitle}-${i}`}
              className="rounded-xl border border-border bg-surface p-5"
            >
              <p className="font-mono text-[11px] text-subtle">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1 font-display text-lg font-semibold">
                {g.functionTitle}
              </h3>
              <p className="mt-2 text-sm leading-relaxed">{g.howToResolve}</p>
              {g.roleNote ? (
                <p className="mt-2 rounded-md bg-paper px-3 py-2 text-sm leading-relaxed">
                  En tu cargo: {g.roleNote}
                </p>
              ) : null}
              {g.steps.length > 0 ? (
                <ol className="mt-3 space-y-1">
                  {g.steps.map((s) => (
                    <li key={s} className="flex gap-2 text-sm leading-relaxed">
                      <span className="text-subtle">→</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-bad-soft px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-bad">
                    Fallo típico
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{g.typicalFail}</p>
                </div>
                <div className="rounded-lg bg-ok-soft px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-ok">
                    Jugada correcta
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{g.correctMove}</p>
                </div>
              </div>
              {g.relatedModuleIds[0] ? (
                <Link
                  to="/estudio/$slug"
                  params={{ slug: g.relatedModuleIds[0] }}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent"
                >
                  <BookOpen className="size-3.5" />
                  Abrir el módulo
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Funciones de la ficha</h2>
        <ol className="space-y-2">
          {ficha.funciones.map((f, i) => (
            <li
              key={i}
              className="rounded-xl border border-border bg-surface p-4 text-sm leading-relaxed"
            >
              <span className="font-mono text-[11px] text-subtle">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-1">{f}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-wrap gap-2">
        {ficha.competenciasFuncionales.map((c) => (
          <Badge key={c} variant="paper">
            {c}
          </Badge>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/practica">
            <ClipboardCheck className="size-4" />
            Practicar {questions.length} ítems de este cargo
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/ficha">Ficha completa</Link>
        </Button>
        <p className="w-full text-xs text-subtle">
          {modules.length} módulos alineados a este empleo.
        </p>
      </div>
    </div>
  );
}
