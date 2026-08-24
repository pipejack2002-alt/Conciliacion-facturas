import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, CircleHelp, Flag, X } from "lucide-react";
import type { Question } from "@/data/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useProgress } from "@/lib/progress-store";
import { TRACKS } from "@/data/types";
import { FailDiagnosis } from "@/components/fail-diagnosis";
import { useCargo } from "@/lib/use-cargo";
import {
  clearPracticeSession,
  loadPracticeSession,
  savePracticeSession,
} from "@/lib/quiz-session";

type Mode = "practice" | "exam";

export interface QuizFinish {
  total: number;
  correct: number;
  byTrack: Record<string, { total: number; correct: number }>;
  missed: string[];
}

function tally(questions: Question[], log: Record<string, string>): QuizFinish {
  const byTrack: QuizFinish["byTrack"] = {};
  let correct = 0;
  const missed: string[] = [];
  for (const item of questions) {
    const choice = log[item.id];
    const ok = choice === item.correct;
    if (ok) correct += 1;
    else missed.push(item.id);
    const bucket = byTrack[item.track] ?? { total: 0, correct: 0 };
    bucket.total += 1;
    if (ok) bucket.correct += 1;
    byTrack[item.track] = bucket;
  }
  return { total: questions.length, correct, byTrack, missed };
}

export function QuizEngine({
  questions,
  mode,
  title,
  bank,
  onFinish,
}: {
  questions: Question[];
  mode: Mode;
  title: string;
  bank?: string;
  onFinish?: (result: QuizFinish) => void;
}) {
  const recordAnswer = useProgress((s) => s.recordAnswer);
  const { cargo } = useCargo();
  const saved = useMemo(() => {
    if (mode !== "practice" || !bank) return null;
    const s = loadPracticeSession();
    if (!s || s.cargoId !== cargo.id || s.bank !== bank) return null;
    if (s.ids.length !== questions.length) return null;
    if (s.ids.some((id, i) => questions[i]?.id !== id)) return null;
    return s;
  }, [mode, bank, cargo.id, questions]);

  const [index, setIndex] = useState(saved?.index ?? 0);
  const [picked, setPicked] = useState<string | null>(saved?.picked ?? null);
  const [revealed, setRevealed] = useState(saved?.revealed ?? false);
  const [log, setLog] = useState<Record<string, string>>(saved?.log ?? {});
  const [done, setDone] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    if (mode !== "practice" || !bank || done || questions.length === 0) return;
    savePracticeSession({
      v: 1,
      cargoId: cargo.id,
      bank,
      title,
      ids: questions.map((q) => q.id),
      log,
      index,
      picked,
      revealed,
    });
  }, [mode, bank, cargo.id, title, questions, log, index, picked, revealed, done]);

  const q = questions[index];
  const total = questions.length;
  const answeredCount = Object.keys(log).length;
  const pct = total ? Math.round(((done ? total : index) / total) * 100) : 0;
  const result = useMemo(() => tally(questions, log), [questions, log]);

  function commit(choice: string) {
    if (!q || picked) return;
    setPicked(choice);
    const ok = choice === q.correct;
    setLog((prev) => ({ ...prev, [q.id]: choice }));
    recordAnswer(q.id, choice, ok);
    if (mode === "practice") setRevealed(true);
  }

  function next() {
    if (!q) return;
    const nextLog = picked ? { ...log, [q.id]: picked } : log;
    if (index + 1 >= total) {
      if (!finished.current) {
        finished.current = true;
        onFinish?.(tally(questions, nextLog));
      }
      setLog(nextLog);
      setDone(true);
      if (mode === "practice") clearPracticeSession();
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
    setRevealed(false);
  }

  if (total === 0) {
    return <p className="text-muted">No hay preguntas en este banco todavía.</p>;
  }

  if (done) {
    const score = result.total
      ? Math.round((result.correct / result.total) * 100)
      : 0;
    const missedQs = questions.filter((item) => result.missed.includes(item.id));
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
            Resultado
          </p>
          <h1 className="font-display text-3xl font-semibold">{title}</h1>
        </header>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Puntaje" value={`${score}%`} />
          <Stat label="Correctas" value={`${result.correct}/${result.total}`} />
          <Stat
            label="Fallidas"
            value={`${result.missed.length}`}
            tone={result.missed.length ? "bad" : "ok"}
          />
        </div>
        <ul className="space-y-2">
          {Object.entries(result.byTrack).map(([track, v]) => {
            const p = v.total ? Math.round((v.correct / v.total) * 100) : 0;
            const meta = TRACKS[track as keyof typeof TRACKS];
            return (
              <li
                key={track}
                className="rounded-lg border border-border bg-surface p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{meta?.label ?? track}</span>
                  <span className="tabular-nums text-sm text-muted">
                    {v.correct}/{v.total} · {p}%
                  </span>
                </div>
                <Progress value={p} />
              </li>
            );
          })}
        </ul>
        {mode === "exam" && result.byTrack.funcional ? (
          <p className="rounded-lg border border-border bg-paper px-4 py-3 text-sm text-muted">
            La funcional es eliminatoria. Referencia de corte: 70/100. Tu bloque
            funcional:{" "}
            <strong className="text-ink">
              {Math.round(
                (result.byTrack.funcional.correct /
                  result.byTrack.funcional.total) *
                  100,
              )}
              %
            </strong>
            .
          </p>
        ) : null}
        <FailDiagnosis missed={missedQs} cargo={cargo} />
      </div>
    );
  }

  const showKey = mode === "practice" && revealed;
  const isLikert = q.kind === "likert";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{title}</p>
        <p className="tabular-nums text-sm text-muted">
          {index + 1} / {total}
        </p>
      </div>
      <Progress value={pct} />

      <article className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="paper">{TRACKS[q.track].short}</Badge>
          <Badge variant="outline">{labelKind(q.kind)}</Badge>
          {q.source ? (
            <span className="text-[11px] text-subtle">{q.source}</span>
          ) : null}
        </div>

        {q.caseText ? (
          <div className="mb-4 rounded-md border-l-2 border-rule bg-paper px-4 py-3">
            <p className="mb-1 text-[11px] uppercase tracking-[0.14em] text-muted">
              Caso
            </p>
            <p className="text-sm leading-relaxed text-ink">{q.caseText}</p>
          </div>
        ) : null}

        <h2 className="font-display text-xl font-semibold leading-snug text-balance">
          {q.stem}
        </h2>

        <ul className={cn("mt-5 grid gap-2", isLikert && "sm:grid-cols-2")}>
          {q.choices.map((c, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const selected = picked === c.id;
            const isCorrect = c.id === q.correct;
            const state = !showKey
              ? selected
                ? "picked"
                : "idle"
              : isCorrect
                ? "ok"
                : selected
                  ? "bad"
                  : "idle";
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => commit(c.id)}
                  disabled={Boolean(picked) && mode === "practice"}
                  className={cn(
                    "flex min-h-12 w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left text-sm transition-colors",
                    state === "idle" &&
                      "border-border bg-raised hover:border-accent/40 hover:bg-paper",
                    state === "picked" && "border-accent bg-paper",
                    state === "ok" && "border-ok bg-ok-soft",
                    state === "bad" && "border-bad bg-bad-soft",
                    mode === "exam" && picked && !selected && "opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold uppercase",
                      state === "ok" && "border-ok text-ok",
                      state === "bad" && "border-bad text-bad",
                      state === "picked" && "border-accent text-accent",
                      state === "idle" && "border-border text-muted",
                    )}
                  >
                    {showKey && isCorrect ? (
                      <Check className="size-3.5" />
                    ) : showKey && selected ? (
                      <X className="size-3.5" />
                    ) : (
                      letter
                    )}
                  </span>
                  <span className="leading-snug">{c.text}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {showKey ? (
          <div className="mt-5 rounded-md bg-paper px-4 py-3">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-muted">
              <CircleHelp className="size-3.5" />
              Clave
            </p>
            <p className="text-sm leading-relaxed text-ink">{q.explanation}</p>
          </div>
        ) : null}
      </article>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs tabular-nums text-subtle">Respondidas {answeredCount}</p>
        <Button
          onClick={next}
          disabled={mode === "practice" ? !revealed : !picked}
        >
          {index + 1 >= total ? (
            <>
              <Flag className="size-4" />
              Ver resultado
            </>
          ) : (
            <>
              Siguiente
              <ChevronRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-3xl font-semibold tabular-nums",
          tone === "ok" && "text-ok",
          tone === "bad" && "text-bad",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function labelKind(kind: Question["kind"]) {
  if (kind === "sjt") return "Juicio situacional";
  if (kind === "likert") return "Escala Likert";
  if (kind === "dilemma") return "Dilema";
  return "Conocimiento";
}
