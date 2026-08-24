import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  LayoutGrid,
  X,
} from "lucide-react";
import type { Question, TrackId } from "@/data/types";
import { TRACKS } from "@/data/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FailDiagnosis } from "@/components/fail-diagnosis";
import { useCargo } from "@/lib/use-cargo";
import { useProgress } from "@/lib/progress-store";
import { SIMULACRO } from "@/data/questions";
import { formatPuntaje, trunc100 } from "@/lib/cnsc-score";
import {
  clearExamSession,
  loadExamSession,
  saveExamSession,
  type ExamSession,
} from "@/lib/quiz-session";

export { loadExamSession, clearExamSession };

export interface ExamFinish {
  funcional: number;
  comportamental: number;
  integridad: number;
  total: number;
  passed: boolean;
  missed: string[];
}

function scoreTracks(questions: Question[], answers: Record<string, string>) {
  const by: Record<TrackId, { correct: number; total: number }> = {
    funcional: { correct: 0, total: 0 },
    comportamental: { correct: 0, total: 0 },
    integridad: { correct: 0, total: 0 },
  };
  const missed: string[] = [];
  for (const q of questions) {
    by[q.track].total += 1;
    if (answers[q.id] === q.correct) by[q.track].correct += 1;
    else missed.push(q.id);
  }
  const funcional = trunc100(by.funcional.correct, by.funcional.total);
  const comportamental = trunc100(
    by.comportamental.correct,
    by.comportamental.total,
  );
  const integridad = trunc100(by.integridad.correct, by.integridad.total);
  const total = trunc100(
    Object.values(by).reduce((a, b) => a + b.correct, 0),
    questions.length,
  );
  return {
    funcional,
    comportamental,
    integridad,
    total,
    passed: funcional >= SIMULACRO.passFuncional,
    missed,
    by,
  };
}

export function CnscExam({
  booklet,
  cargoId,
  timed,
  onFinish,
}: {
  booklet: Question[];
  cargoId: string;
  timed: boolean;
  onFinish: (result: ExamFinish) => void;
}) {
  const { cargo } = useCargo();
  const recordAnswer = useProgress((s) => s.recordAnswer);
  const finished = useRef(false);

  const initial = useMemo(() => {
    const prev = loadExamSession();
    if (prev && prev.cargoId === cargoId && prev.ids.length === booklet.length) {
      return prev;
    }
    const s: ExamSession = {
      v: 1,
      cargoId,
      ids: booklet.map((q) => q.id),
      answers: {},
      flagged: [],
      index: 0,
      startedAt: Date.now(),
      remainingMs: timed ? SIMULACRO.minutes * 60_000 : null,
    };
    saveExamSession(s);
    return s;
  }, [booklet, cargoId, timed]);

  const [index, setIndex] = useState(initial.index);
  const [answers, setAnswers] = useState<Record<string, string>>(initial.answers);
  const [flagged, setFlagged] = useState<string[]>(initial.flagged);
  const [remainingMs, setRemainingMs] = useState<number | null>(
    initial.remainingMs ?? null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof scoreTracks> | null>(
    null,
  );

  useEffect(() => {
    saveExamSession({
      v: 1,
      cargoId,
      ids: booklet.map((q) => q.id),
      answers,
      flagged,
      index,
      startedAt: initial.startedAt,
      remainingMs,
    });
  }, [answers, flagged, index, remainingMs, booklet, cargoId, initial.startedAt]);

  useEffect(() => {
    if (remainingMs == null || done) return;
    const t0 = Date.now();
    const start = remainingMs;
    const id = window.setInterval(() => {
      setRemainingMs(Math.max(0, start - (Date.now() - t0)));
    }, 1000);
    return () => window.clearInterval(id);
    // Restart the interval only when the exam opens or remaining is reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, remainingMs == null]);

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!done) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [done]);

  const expired = remainingMs === 0;

  const closeExam = useCallback(
    (ans: Record<string, string>) => {
      if (finished.current) return;
      finished.current = true;
      const scored = scoreTracks(booklet, ans);
      for (const q of booklet) {
        const choice = ans[q.id];
        if (choice) recordAnswer(q.id, choice, choice === q.correct);
      }
      onFinish({
        funcional: scored.funcional,
        comportamental: scored.comportamental,
        integridad: scored.integridad,
        total: scored.total,
        passed: scored.passed,
        missed: scored.missed,
      });
      clearExamSession();
      setResult(scored);
      setDone(true);
    },
    [booklet, onFinish, recordAnswer],
  );

  useEffect(() => {
    if (expired && !done) closeExam(answers);
  }, [expired, done, answers, closeExam]);

  const q = booklet[index];
  const total = booklet.length;
  const answeredN = Object.keys(answers).length;
  const blank = total - answeredN;

  if (!q && !done) {
    return <p className="text-muted">No hay ítems para este cargo.</p>;
  }

  if (done && result) {
    const missedQs = booklet.filter((item) => result.missed.includes(item.id));
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
            Resultados · pruebas escritas
          </p>
          <h1 className="font-display text-3xl font-semibold">
            {result.passed
              ? "Superó la eliminatoria"
              : "No alcanza el mínimo de la funcional"}
          </h1>
          <p className="text-sm leading-relaxed text-muted">
            Escala 0,00 a 100,00, dos decimales truncados (Anexo técnico 2676).
            El ponderado oficial lo fija el artículo 17 del Acuerdo 21; aquí se
            reporta cada prueba por separado.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          <ScoreCard
            label="Funcional · eliminatoria"
            value={result.funcional}
            hint={
              result.passed
                ? `Mínimo de referencia ${SIMULACRO.passFuncional}. Continúa.`
                : `Mínimo de referencia ${SIMULACRO.passFuncional}. Quedaría excluido.`
            }
            tone={result.passed ? "ok" : "bad"}
          />
          <ScoreCard
            label="Promedio de las tres"
            value={result.total}
            hint={`${result.by.funcional.correct + result.by.comportamental.correct + result.by.integridad.correct}/${total} aciertos`}
          />
        </div>

        <ul className="space-y-2">
          {(
            [
              ["funcional", result.funcional, result.by.funcional],
              ["comportamental", result.comportamental, result.by.comportamental],
              ["integridad", result.integridad, result.by.integridad],
            ] as const
          ).map(([track, score, bag]) => (
            <li
              key={track}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium">{TRACKS[track].label}</p>
                <p className="text-xs text-muted">{TRACKS[track].nature}</p>
              </div>
              <p className="font-display text-2xl font-semibold tabular-nums">
                {formatPuntaje(score)}
                <span className="ml-2 text-sm font-sans font-normal text-muted">
                  {bag.correct}/{bag.total}
                </span>
              </p>
            </li>
          ))}
        </ul>

        <p className="text-xs leading-relaxed text-subtle">
          Solo se publicarían las clasificatorias si superó las eliminatorias
          (Anexo, numeral 5). El 70 es el corte de entrenamiento; el mínimo
          oficial está en el Acuerdo 21, artículo 17, y SIMO.
        </p>

        <FailDiagnosis missed={missedQs} cargo={cargo} />

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/simulacro">Nueva jornada</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/practica/$bank" params={{ bank: "fallos" }}>
              Repasar fallos
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const letterOf = (i: number) => String.fromCharCode(65 + i);
  const selected = answers[q.id];
  const isFlagged = flagged.includes(q.id);
  const section = TRACKS[q.track];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2.5">
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
          {section.short} · {index + 1}/{total}
        </p>
        <div className="flex items-center gap-3">
          {remainingMs !== null ? (
            <p
              className={cn(
                "flex items-center gap-1.5 font-mono text-sm tabular-nums",
                remainingMs <= 5 * 60_000 && "text-bad",
                remainingMs > 5 * 60_000 &&
                  remainingMs <= 15 * 60_000 &&
                  "text-accent",
              )}
            >
              <Clock className="size-3.5" />
              {fmtTime(remainingMs)}
            </p>
          ) : (
            <p className="text-xs text-muted">Sin reloj</p>
          )}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink"
          >
            <LayoutGrid className="size-3.5" />
            Hoja
          </button>
        </div>
      </div>

      <article className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <p className="font-mono text-[11px] text-subtle">
          Pregunta {index + 1} de {total} · {section.label}
        </p>
        {q.caseText ? (
          <div className="mt-3 rounded-md border-l-2 border-rule bg-paper px-4 py-3">
            <p className="text-sm leading-relaxed">{q.caseText}</p>
          </div>
        ) : null}
        <h2 className="mt-4 font-display text-xl font-semibold leading-snug">
          {q.stem}
        </h2>
        <ul className="mt-5 grid gap-2">
          {q.choices.map((c, i) => {
            const on = selected === c.id;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [q.id]: c.id }))
                  }
                  className={cn(
                    "flex min-h-12 w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left text-sm",
                    on
                      ? "border-accent bg-paper"
                      : "border-border bg-raised hover:border-accent/40 hover:bg-paper",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold",
                      on
                        ? "border-accent text-accent"
                        : "border-border text-muted",
                    )}
                  >
                    {letterOf(i)}
                  </span>
                  <span className="leading-snug">{c.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </article>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFlagged((f) =>
                f.includes(q.id) ? f.filter((id) => id !== q.id) : [...f, q.id],
              )
            }
          >
            <Flag className={cn("size-4", isFlagged && "text-accent")} />
            {isFlagged ? "Marcada" : "Marcar"}
          </Button>
        </div>
        {index + 1 >= total ? (
          <Button onClick={() => setConfirmOpen(true)}>Finalizar prueba</Button>
        ) : (
          <Button onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}>
            Siguiente
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
      <p className="text-xs tabular-nums text-subtle">
        Respondidas {answeredN}/{total}
        {blank ? ` · en blanco ${blank}` : ""}
        {flagged.length ? ` · marcadas ${flagged.length}` : ""}
        . Si cierras, al volver retomas esta pregunta.
      </p>

      {sheetOpen ? (
        <Sheet
          booklet={booklet}
          answers={answers}
          flagged={flagged}
          index={index}
          onJump={(i) => {
            setIndex(i);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
          onFinish={() => {
            setSheetOpen(false);
            setConfirmOpen(true);
          }}
        />
      ) : null}

      {confirmOpen ? (
        <Confirm
          blank={blank}
          flagged={flagged.length}
          total={total}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            closeExam(answers);
          }}
        />
      ) : null}
    </div>
  );
}

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function ScoreCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display text-3xl font-semibold tabular-nums",
          tone === "ok" && "text-ok",
          tone === "bad" && "text-bad",
        )}
      >
        {formatPuntaje(value)}
      </p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Sheet({
  booklet,
  answers,
  flagged,
  index,
  onJump,
  onClose,
  onFinish,
}: {
  booklet: Question[];
  answers: Record<string, string>;
  flagged: string[];
  index: number;
  onJump: (i: number) => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-6">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-auto rounded-t-xl border border-border bg-bg p-5 sm:rounded-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            Hoja de respuestas
          </h2>
          <button type="button" onClick={onClose} className="text-muted">
            <X className="size-5" />
          </button>
        </div>
        {(["funcional", "comportamental", "integridad"] as TrackId[]).map(
          (track) => {
            const items = booklet
              .map((q, i) => ({ q, i }))
              .filter((x) => x.q.track === track);
            if (!items.length) return null;
            return (
              <section key={track} className="mb-4">
                <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-muted">
                  {TRACKS[track].short}
                </p>
                <div className="grid grid-cols-8 gap-1.5">
                  {items.map(({ q, i }) => {
                    const filled = Boolean(answers[q.id]);
                    const mark = flagged.includes(q.id);
                    const current = i === index;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => onJump(i)}
                        className={cn(
                          "flex h-9 items-center justify-center rounded-md border text-xs tabular-nums",
                          current && "ring-2 ring-accent",
                          filled
                            ? "border-accent bg-accent text-accent-fg"
                            : "border-border bg-surface",
                          mark && !filled && "border-accent bg-paper",
                        )}
                      >
                        {i + 1}
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          },
        )}
        <Button className="mt-2 w-full" onClick={onFinish}>
          Finalizar prueba
        </Button>
      </div>
    </div>
  );
}

function Confirm({
  blank,
  flagged,
  total,
  onCancel,
  onConfirm,
}: {
  blank: number;
  flagged: number;
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-bg p-6">
        <h2 className="font-display text-xl font-semibold">
          Entregar hoja de respuestas
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {blank
            ? `Tiene ${blank} de ${total} en blanco. En la CNSC esas se califican como incorrectas.`
            : `Las ${total} preguntas tienen respuesta.`}
          {flagged ? ` ${flagged} marcadas para revisar.` : ""} No podrá volver
          atrás.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Seguir
          </Button>
          <Button onClick={onConfirm}>Entregar</Button>
        </div>
      </div>
    </div>
  );
}
