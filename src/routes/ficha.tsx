import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCargo } from "@/lib/use-cargo";

export const Route = createFileRoute("/ficha")({ component: FichaPage });

function FichaPage() {
  const { cargo, ficha } = useCargo();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          {ficha.formato ? `${ficha.formato} · ` : null}
          {cargo.custom ? "Manual cargado" : "Ficha de estudio"}
        </p>
        <h1 className="font-display text-3xl font-semibold">
          {ficha.denominacion}
        </h1>
        <p className="text-sm text-muted">
          Código {ficha.codigo} · Grado {ficha.grado} · {ficha.nivel} ·{" "}
          {ficha.tipoEmpleo}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {ficha.codigoFicha ? <Badge variant="paper">{ficha.codigoFicha}</Badge> : null}
          <Badge variant="outline">{ficha.aplicacion}</Badge>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button asChild size="sm">
            <Link to="/guia">Guía de este cargo</Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link to="/cargo">Cambiar cargo</Link>
          </Button>
        </div>
      </header>

      <dl className="grid gap-4 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2">
        <Item label="Proceso" value={ficha.proceso} />
        <Item label="Subproceso" value={ficha.subproceso} />
        <Item label="Estudios" value={ficha.estudios} />
        <Item label="Experiencia" value={ficha.experiencia} />
      </dl>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Propósito principal</h2>
        <p className="text-sm leading-relaxed text-ink">{ficha.proposito}</p>
      </section>

      <section className="rounded-xl border-l-2 border-rule bg-paper px-5 py-4">
        <h2 className="font-display text-lg font-semibold">Tu grado de responsabilidad</h2>
        <p className="mt-2 text-sm leading-relaxed">{cargo.rolBoundary.vsOthers}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Funciones esenciales</h2>
        <ol className="space-y-3">
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

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">
          Competencias funcionales
        </h2>
        <ul className="flex flex-wrap gap-2">
          {ficha.competenciasFuncionales.map((c) => (
            <li key={c}>
              <Badge variant="paper">{c}</Badge>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">
          Competencias comportamentales
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {ficha.competenciasComportamentales.map((c) => (
            <li
              key={c.nombre}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-sm"
            >
              <span>{c.nombre}</span>
              <span className="font-mono text-xs text-muted">Nivel {c.nivel}</span>
            </li>
          ))}
        </ul>
      </section>

      {ficha.nbc.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">NBC aceptados</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ficha.nbc.map((n) => (
              <li key={n} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                {n}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ficha.competenciasBasicas && ficha.competenciasBasicas.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-semibold">
            Competencias básicas de la ficha
          </h2>
          <ol className="space-y-1 text-sm text-ink">
            {ficha.competenciasBasicas.map((c, i) => (
              <li key={c} className="flex gap-3">
                <span className="font-mono text-[11px] text-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {c}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="text-xs text-subtle">
        Fuente de estudio: Manual Específico de Requisitos y Funciones DIAN
        (Resolución 0067 de 2024) y, si cargaste un archivo, tu documento.
        Equivalencias: {ficha.equivalencias ? "sí" : "no o no constan"}. Verifica
        la OPEC en SIMO.
      </p>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed">{value}</dd>
    </div>
  );
}
