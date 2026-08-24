import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { QuizEngine } from "@/components/quiz-engine";
import { shuffle } from "@/data/questions";
import { TRACKS, type TrackId } from "@/data/types";
import { useProgress } from "@/lib/progress-store";
import { useCargo } from "@/lib/use-cargo";
import { loadPracticeSession } from "@/lib/quiz-session";

export const Route = createFileRoute("/practica/$bank")({
  component: PracticaBank,
});

function PracticaBank() {
  const { bank } = Route.useParams();
  const answers = useProgress((s) => s.answers);
  const { questions: all, modules, cargo } = useCargo();

  const { questions, title } = useMemo(() => {
    const byTrack = (t: TrackId) => all.filter((q) => q.track === t);
    const saved = loadPracticeSession();
    const restore =
      saved && saved.cargoId === cargo.id && saved.bank === bank ? saved : null;

    const build = () => {
      if (bank === "funcional" || bank === "comportamental" || bank === "integridad") {
        return {
          questions: shuffle(byTrack(bank as TrackId), bank),
          title: TRACKS[bank as TrackId].label,
        };
      }
      if (bank === "mixto") {
        const f = shuffle(byTrack("funcional"), "mix-f").slice(0, 8);
        const c = shuffle(byTrack("comportamental"), "mix-c").slice(0, 6);
        const i = shuffle(byTrack("integridad"), "mix-i").slice(0, 6);
        return { questions: [...f, ...c, ...i], title: "Mixto aleatorio" };
      }
      if (bank === "fallos") {
        const ids = Object.entries(answers)
          .filter(([, v]) => !v.correct)
          .map(([id]) => id);
        return {
          questions: all.filter((q) => ids.includes(q.id)),
          title: "Repaso de fallos",
        };
      }
      if (bank.startsWith("mod-")) {
        const id = bank.slice(4);
        const mod = modules.find((m) => m.id === id);
        return {
          questions: shuffle(
            all.filter((q) => q.moduleId === id),
            id,
          ),
          title: mod?.title ?? "Módulo",
        };
      }
      return { questions: [] as typeof all, title: "Banco" };
    };

    if (restore) {
      const map = new Map(all.map((q) => [q.id, q]));
      const restored = restore.ids
        .map((id) => map.get(id))
        .filter((q): q is NonNullable<typeof q> => Boolean(q));
      if (restored.length === restore.ids.length && restored.length > 0) {
        return { questions: restored, title: restore.title };
      }
    }
    return build();
  }, [bank, answers, all, modules, cargo.id]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        to="/practica"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Bancos
      </Link>
      <QuizEngine
        questions={questions}
        mode="practice"
        title={title}
        bank={bank}
      />
    </div>
  );
}
