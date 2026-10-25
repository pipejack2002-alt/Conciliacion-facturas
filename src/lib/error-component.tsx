import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : "An unexpected error occurred. Try reloading the page.";

  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400">
        {message}
      </p>
    </main>
  );
}

export function AppNotFoundComponent() {
  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      }
    >
      <h1 className="text-xl font-bold">Página no encontrada (404)</h1>
      <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        La ruta solicitada no existe o ha sido reubicada.
      </p>
      <a
        href="/"
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-deep transition"
      >
        Volver al inicio
      </a>
    </main>
  );
}
