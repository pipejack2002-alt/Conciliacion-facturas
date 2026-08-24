import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SIMULACRO } from "@/data/questions";
import { useProgress } from "@/lib/progress-store";
import { useCargo } from "@/lib/use-cargo";
import { formatPuntaje } from "@/lib/cnsc-score";
import { clearExamSession, loadExamSession } from "@/components/cnsc-exam";

export const Route = createFileRoute("/simulacro/")({ component: SimulacroHome });

function SimulacroHome() {
  const history = useProgress((s) => s.simulacros);
  const { cargo, ficha } = useCargo();
  const [pending, setPending] = useState<ReturnType<typeof loadExamSession>>(
    null,
  );
  useEffect(() => {
    setPending(loadExamSession());
  }, []);
  const total =
    SIMULACRO.funcional + SIMULACRO.comportamental + SIMULACRO.integridad;
  const pendingTimed = pending?.remainingMs != null;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          Proceso de selección DIAN 2676
        </p>
        <h1 className="font-display text-3xl font-semibold">
          Simulador de pruebas escritas CNSC
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Réplica de la jornada: un cuadernillo, una hoja de respuestas y tres
          pruebas el mismo día, para {ficha.denominacion} ({ficha.codigo}-
          {ficha.grado}). El cuestionario real es reserva de la CNSC; este
          ensayo usa el banco de tu cargo y las reglas del Anexo técnico.
        </p>
      </header>

      {pending && pending.cargoId === cargo.id ? (
        <div className="rounded-xl border border-accent/40 bg-paper px-5 py-4">
          <p className="text-sm font-medium">Tiene una jornada en curso.</p>
          <p className="mt-1 text-sm text-muted">
            Puede retomarla o anularla y empezar otra.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/simulacro/examen" search={{ reloj: pendingTimed }}>
                Continuar {pendingTimed ? "con tiempo" : "sin tiempo"}
              </Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                clearExamSession();
                setPending(null);
              }}
            >
              Anular
            </Button>
          </div>
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">Instructivo</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
          <li>
            {total} preguntas: {SIMULACRO.funcional} funcionales,{" "}
            {SIMULACRO.comportamental} comportamentales y {SIMULACRO.integridad}{" "}
            de integridad, en ese orden.
          </li>
          <li>
            Tiempo de jornada: {SIMULACRO.minutes} minutos. Al vencerse, se
            entrega sola.
          </li>
          <li>
            Puede ir atrás, marcar para revisar y usar la hoja de respuestas.
            No hay clave hasta entregar.
          </li>
          <li>
            Calificación 0,00 a 100,00 con dos decimales{" "}
            <em>truncados</em>, como el Anexo. La funcional es eliminatoria
            (corte de ensayo: {SIMULACRO.passFuncional}).
          </li>
          <li>
            En blanco = incorrecta. No consulte normas ni este cuaderno en otra
            pestaña si quiere el ensayo limpio.
          </li>
        </ol>
      </section>

      <ol className="space-y-3">
        <Step
          n="01"
          title={`Competencias funcionales · ${SIMULACRO.funcional} ítems`}
          body="Eliminatoria. Conocimientos del MERF de su empleo (D.L. 927 art. 58): juicio situacional y conocimiento."
        />
        <Step
          n="02"
          title={`Competencias comportamentales · ${SIMULACRO.comportamental} ítems`}
          body="Clasificatoria. Diccionario de competencias DIAN (art. 59). Likert y situaciones."
        />
        <Step
          n="03"
          title={`Prueba de integridad · ${SIMULACRO.integridad} ítems`}
          body="Clasificatoria. Coherencia de creencias y actuación por el bien común. Código de Integridad (Ley 2016)."
        />
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/simulacro/examen"
          search={{ reloj: true }}
          className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/50"
        >
          <Clock className="size-5 text-accent" />
          <h2 className="mt-3 font-display text-lg font-semibold">
            Con tiempo
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Jornada CNSC: {SIMULACRO.minutes} minutos. El reloj corre y al
            vencer se entrega sola.
          </p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-accent">
            Iniciar cronometrada
          </p>
        </Link>
        <Link
          to="/simulacro/examen"
          search={{ reloj: false }}
          className="group rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/50"
        >
          <Flag className="size-5 text-accent" />
          <h2 className="mt-3 font-display text-lg font-semibold">
            Sin tiempo
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Mismo cuadernillo y hoja de respuestas, sin reloj. Para estudiar
            con calma.
          </p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-accent">
            Iniciar ensayo
          </p>
        </Link>
      </div>

      {history.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold">
            Jornadas anteriores
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-sm text-muted">
                  {new Date(h.at).toLocaleDateString("es-CO", {
                    day: "2-digit",
                    month: "short",
                  })}
                  {h.passed ? "" : " · no superó funcional"}
                </span>
                <span className="tabular-nums text-sm">
                  {formatPuntaje(h.total)} · F {formatPuntaje(h.funcional)} · C{" "}
                  {formatPuntaje(h.comportamental)} · I{" "}
                  {formatPuntaje(h.integridad)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-subtle">
        Anexo técnico DIAN 2676, numeral 5, y Acuerdo 21 de 2025, artículo 17.
        Material de entrenamiento, no el cuadernillo de la CNSC.
      </p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="rounded-xl border border-border bg-surface p-5">
      <p className="font-mono text-[11px] text-subtle">{n}</p>
      <h2 className="mt-1 font-display text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </li>
  );
}
