import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { shuffle } from "@/data/questions";
import { useCargo } from "@/lib/use-cargo";

export const Route = createFileRoute("/tarjetas")({ component: TarjetasPage });

function TarjetasPage() {
  const { flashcards, cargo } = useCargo();
  const deck = useMemo(() => shuffle(flashcards, 2676), [flashcards]);
  const [i, setI] = useState(0);
  const [flip, setFlip] = useState(false);
  const card = deck[i];

  function go(delta: number) {
    setFlip(false);
    setI((n) => (n + delta + deck.length) % deck.length);
  }

  if (!card) {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <h1 className="font-display text-2xl font-semibold">Tarjetas</h1>
        <p className="text-sm text-muted">
          No hay tarjetas para {cargo.shortLabel} todavía.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          Memoria activa · {cargo.shortLabel}
        </p>
        <h1 className="font-display text-3xl font-semibold">Tarjetas</h1>
        <p className="text-sm text-muted">
          Artículos, plazos y valores que hay que tener en la punta de la lengua.
        </p>
      </header>

      <button
        type="button"
        onClick={() => setFlip((f) => !f)}
        className="flex min-h-56 w-full flex-col items-start rounded-xl border border-border bg-surface p-6 text-left"
      >
        <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
          {flip ? "Respuesta" : "Pregunta"} · {i + 1}/{deck.length}
        </p>
        <p className="mt-4 font-display text-xl font-semibold leading-snug">
          {flip ? card.back : card.front}
        </p>
      </button>

      <div className="flex justify-between gap-2">
        <Button variant="secondary" onClick={() => go(-1)}>
          Anterior
        </Button>
        <Button onClick={() => go(1)}>Siguiente</Button>
      </div>
    </div>
  );
}
