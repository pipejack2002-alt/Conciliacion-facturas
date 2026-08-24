import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState, type DragEvent } from "react";
import {
  Briefcase,
  FileUp,
  LoaderCircle,
  Trash2,
  Check,
} from "lucide-react";
import { CATALOG } from "@/data/cargos";
import { CARGO_FAMILIES, type CargoFamily, type CargoProfile } from "@/data/types";
import { useCargoStore } from "@/lib/cargo-store";
import { buildCargoFromText, isUsefulCargo } from "@/lib/ficha-parser";
import { parseManual } from "@/lib/parse-manual";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cargo")({ component: CargoPage });

const FILTERS: { id: "todos" | CargoFamily; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "analista", label: "Analista" },
  { id: "gestor", label: "Gestor" },
  { id: "inspector", label: "Inspector" },
];

const MAX_BYTES = 8_000_000;

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function CargoPage() {
  const navigate = useNavigate();
  const selectedId = useCargoStore((s) => s.selectedId);
  const custom = useCargoStore((s) => s.customCargos);
  const select = useCargoStore((s) => s.select);
  const addCustom = useCargoStore((s) => s.addCustom);
  const removeCustom = useCargoStore((s) => s.removeCustom);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("todos");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Leyendo el manual y armando tu guía…");
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const catalog = CATALOG.filter(
    (c) => filter === "todos" || c.family === filter,
  );

  function pick(id: string) {
    select(id);
    void navigate({ to: "/guia" });
  }

  function saveAndOpen(cargo: CargoProfile) {
    addCustom(cargo);
    return navigate({ to: "/guia" });
  }

  async function runParse(
    kind: "pdf" | "image" | "text",
    filename: string,
    mime: string,
    data: string,
  ) {
    const res = await withTimeout(
      parseManual({ data: { kind, filename, mime, data } }),
      25000,
      "timeout",
    );
    if (!res.ok) {
      setError(res.error);
      return false;
    }
    await saveAndOpen(res.cargo);
    return true;
  }

  async function onFile(file: File | undefined) {
    if (!file || busy) return;
    if (file.size > MAX_BYTES) {
      setError("El archivo pesa de más. Usa un PDF o una foto de menos de 8 MB.");
      return;
    }
    const mime = file.type || "application/octet-stream";
    const isPdf =
      mime === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = mime.startsWith("image/");
    if (!isPdf && !isImage) {
      setError("Sube un PDF, una foto de la ficha, o pega el texto del manual.");
      return;
    }

    setBusy(true);
    setError(null);
    setFileName(file.name);
    try {
      if (isPdf) {
        setStatus("Leyendo el PDF y armando tu guía…");
        const data = await readBase64(file);
        await runParse("pdf", file.name, "application/pdf", data);
        return;
      }
      setStatus("Leyendo la foto de la ficha…");
      const dataUrl = await readDataUrl(file);
      await runParse("image", file.name, mime, dataUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        msg === "timeout"
          ? "Tardó demasiado. Prueba pegar el texto de la ficha (propósito y funciones)."
          : "No pude leer el archivo. Prueba de nuevo o pega el texto.",
      );
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onPaste() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus("Armando tu guía…");
    try {
      const cargo = buildCargoFromText(paste, "manual-pegado.txt");
      if (cargo && isUsefulCargo(cargo)) {
        await saveAndOpen(cargo);
        return;
      }
      await runParse("text", "manual-pegado.txt", "text/plain", paste);
    } catch {
      setError("No reconocí ese texto. Incluye denominación, propósito y funciones.");
    } finally {
      setBusy(false);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    void onFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          Concurso 2676
        </p>
        <h1 className="font-display text-3xl font-semibold">Elige tu cargo</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted">
          Analista, Gestor o Inspector no se estudian igual: cambia el verbo, la
          competencia y lo que el examen premia. Escoge el empleo o sube tu
          manual de funciones y te armo la guía, con cómo se resuelven los
          casos y en qué sueles fallar.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <FileUp className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">
              Sube tu manual de funciones
            </h2>
            <p className="mt-1 text-sm text-muted">
              PDF de la ficha (FT-TAH), foto nítida o el texto. Se lee aquí y
              se guarda en este dispositivo.
            </p>
            <label
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                "mt-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed bg-paper px-4 py-6 text-center",
                dragOver ? "border-accent" : "border-border",
                busy && "pointer-events-none opacity-80",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(e) => void onFile(e.target.files?.[0])}
              />
              {busy ? (
                <span className="inline-flex items-center gap-2 text-sm text-muted">
                  <LoaderCircle className="size-4 animate-spin" />
                  {status}
                </span>
              ) : (
                <>
                  <span className="text-sm font-medium">
                    {dragOver
                      ? "Suelta el PDF aquí"
                      : "Toca o arrastra el PDF o la foto"}
                  </span>
                  <span className="mt-1 text-xs text-subtle">
                    {fileName
                      ? fileName
                      : "Máximo 8 MB · ficha o manual"}
                  </span>
                </>
              )}
            </label>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm text-muted">
                Prefiero pegar el texto
              </summary>
              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                rows={7}
                className="mt-2 w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm leading-relaxed outline-none ring-accent/30 focus:ring-2"
                placeholder="Pega propósito, funciones esenciales y competencias de tu ficha…"
              />
              <Button
                className="mt-2"
                variant="secondary"
                disabled={busy || paste.trim().length < 80}
                onClick={() => void onPaste()}
              >
                Armar guía con este texto
              </Button>
            </details>
            {error ? (
              <p className="mt-3 rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {custom.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Tus manuales</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {custom.map((c) => (
              <CargoCard
                key={c.id}
                cargo={c}
                selected={c.id === selectedId}
                onSelect={() => pick(c.id)}
                onRemove={() => removeCustom(c.id)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">
            Cargos del 2676
          </h2>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "h-9 rounded-md px-3 text-sm",
                  filter === f.id
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:bg-paper",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {catalog.map((c) => (
            <CargoCard
              key={c.id}
              cargo={c}
              selected={c.id === selectedId}
              onSelect={() => pick(c.id)}
            />
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-subtle">
          Las fichas de catálogo reconstruyen empleos típicos del Manual
          Específico (Res. 0067 de 2024) y del Acuerdo 21 de 2025. Verifica
          código OPEC y grado en SIMO. Si tu empleo no está, sube el manual.
        </p>
      </section>
    </div>
  );
}

function CargoCard({
  cargo,
  selected,
  onSelect,
  onRemove,
}: {
  cargo: CargoProfile;
  selected: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const fam = CARGO_FAMILIES[cargo.family];
  return (
    <li>
      <div
        className={cn(
          "flex h-full flex-col rounded-xl border bg-surface p-5",
          selected ? "border-accent" : "border-border",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <Badge variant={selected ? "default" : "paper"}>{fam.label}</Badge>
          {selected ? (
            <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.12em] text-accent">
              <Check className="size-3.5" />
              Activo
            </span>
          ) : null}
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold leading-snug">
          {cargo.ficha.denominacion}
        </h3>
        <p className="mt-1 text-sm text-muted">{cargo.processLabel}</p>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-ink">
          {cargo.blurb}
        </p>
        <p className="mt-3 font-mono text-[11px] text-subtle">
          {cargo.ficha.codigo !== "—"
            ? `Código ${cargo.ficha.codigo} · Grado ${cargo.ficha.grado}`
            : cargo.ficha.nivel}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={onSelect}>
            <Briefcase className="size-4" />
            {selected ? "Abrir guía" : "Estudiar este"}
          </Button>
          {selected ? (
            <Button size="sm" variant="secondary" asChild>
              <Link to="/ficha">Ver ficha</Link>
            </Button>
          ) : null}
          {onRemove ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRemove}
              aria-label="Quitar manual"
            >
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function readBase64(file: File) {
  return readDataUrl(file).then((url) => url.split(",")[1] ?? "");
}
