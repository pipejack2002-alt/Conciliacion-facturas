import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Briefcase, ClipboardCheck, Flag, Scale } from "lucide-react";
import { TRACKS, type TrackId } from "@/data/types";
import { examCountdown, useProgress, trackAccuracy } from "@/lib/progress-store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useCargo } from "@/lib/use-cargo";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const { days } = examCountdown();
  const answers = useProgress((s) => s.answers);
  const readModules = useProgress((s) => s.readModules);
  const { cargo, ficha, modules, questions } = useCargo();
  const readCount = modules.filter((m) => readModules[m.id]).length;
  const ids = new Set(questions.map((q) => q.id));
  const answered = Object.keys(answers).filter((id) => ids.has(id)).length;
  const correct = Object.entries(answers).filter(
    ([id, a]) => ids.has(id) && a.correct,
  ).length;
  const acc = answered ? Math.round((correct / answered) * 100) : 0;

  const nextModule = modules.find((m) => !readModules[m.id]) ?? modules[0];

  return (
    <div className="space-y-10">
      <section className="relative overflow-hidden rounded-xl border border-border bg-surface p-6 sm:p-8">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-rule" />
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
          Concurso DIAN 2676 · ingreso / carrera
        </p>
        <h1 className="mt-2 max-w-xl font-display text-3xl font-semibold leading-[1.15] text-balance sm:text-4xl">
          Prepárate el cargo, no un temario genérico.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          {ficha.denominacion}, código {ficha.codigo} grado {ficha.grado}.{" "}
          {cargo.processLabel}. Tres pruebas el mismo día: funcional
          (eliminatoria), comportamental e integridad.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/guia">
              Guía de este cargo
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/cargo">
              <Briefcase className="size-4" />
              Cambiar o subir manual
            </Link>
          </Button>
        </div>
        <dl className="mt-8 grid grid-cols-3 gap-3 border-t border-border pt-5">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.12em] text-muted">
              A noviembre
            </dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">{days}d</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.12em] text-muted">
              Banco
            </dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">
              {questions.length}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.12em] text-muted">
              Módulos
            </dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">
              {readCount}/{modules.length}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(TRACKS) as TrackId[]).map((id) => {
          const meta = TRACKS[id];
          const qs = questions.filter((q) => q.track === id);
          const stats = trackAccuracy(
            answers,
            qs.map((q) => q.id),
          );
          const Icon = id === "funcional" ? Scale : id === "integridad" ? Flag : ClipboardCheck;
          return (
            <Link
              key={id}
              to="/practica/$bank"
              params={{ bank: id }}
              className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/40"
            >
              <Icon className="size-5 text-accent" />
              <h2 className="mt-3 font-display text-lg font-semibold">{meta.label}</h2>
              <p className="mt-1 text-sm text-muted">{meta.blurb}</p>
              <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-subtle">
                {meta.nature}
              </p>
              <div className="mt-3">
                <div className="mb-1.5 flex justify-between text-xs text-muted">
                  <span>
                    {stats.answered}/{qs.length} ítems
                  </span>
                  <span className="tabular-nums">{stats.pct}%</span>
                </div>
                <Progress value={qs.length ? (stats.answered / qs.length) * 100 : 0} />
              </div>
            </Link>
          );
        })}
      </section>

      <section className="rounded-xl border border-border bg-paper px-5 py-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          Marco oficial
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink">
          Funcionales: conocimientos del MERF (D.L. 927 art. 58).
          Comportamentales: diccionario DIAN (art. 59). Integridad: coherencia
          de creencias y actuación por el bien común (Anexo técnico 2676).{" "}
          <Link to="/fuentes" className="font-medium text-accent underline-offset-2 hover:underline">
            Ver fuentes CNSC, DIAN y Función Pública
          </Link>
          .
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Siguiente lectura</p>
          <h2 className="mt-2 font-display text-2xl font-semibold">{nextModule?.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{nextModule?.summary}</p>
          {nextModule ? (
            <Button asChild className="mt-5" variant="secondary">
              <Link to="/estudio/$slug" params={{ slug: nextModule.id }}>
                <BookOpen className="size-4" />
                Estudiar {nextModule.minutes} min
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Tu avance</p>
          <p className="mt-2 font-display text-4xl font-semibold tabular-nums">{acc}%</p>
          <p className="text-sm text-muted">
            acierto sobre {answered} preguntas de este cargo
          </p>
          <Button asChild className="mt-5" variant="outline">
            <Link to="/progreso">Ver fallos y cómo se resuelven</Link>
          </Button>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-subtle">
        Material alineado a tu ficha, al{" "}
        <Link to="/fuentes" className="underline-offset-2 hover:underline">
          Anexo técnico DIAN 2676
        </Link>
        , Acuerdo CNSC 21 de 2025, Estatuto Tributario, Ley 1437 / 1755, D.L.
        927 de 2023 y Código de Integridad (Ley 2016). No es el cuestionario
        oficial de la CNSC (reserva, Ley 909 art. 31 num. 3). El formato
        (juicio situacional y Likert) sigue el de las pruebas escritas a cargo
        del operador.
      </p>
    </div>
  );
}
