import { useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BookOpen,
  Briefcase,
  ClipboardCheck,
  Flag,
  Home,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProgress } from "@/lib/progress-store";
import { useCargoStore } from "@/lib/cargo-store";
import { useCargo } from "@/lib/use-cargo";

const NAV = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/estudio", label: "Estudiar", icon: BookOpen },
  { to: "/practica", label: "Practicar", icon: ClipboardCheck },
  { to: "/simulacro", label: "Simulacro", icon: Flag },
  { to: "/progreso", label: "Progreso", icon: Layers },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const examMode = pathname.startsWith("/simulacro/examen");
  const { cargo } = useCargo();

  useEffect(() => {
    void useProgress.persist.rehydrate();
    void useCargoStore.persist.rehydrate();
  }, []);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="pointer-events-none fixed inset-y-0 left-0 hidden w-1.5 bg-rule lg:block" />
      {examMode ? (
        <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/90 backdrop-blur-md">
          <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-4">
            <p className="font-display text-sm font-semibold">
              Pruebas escritas · DIAN 2676
            </p>
            <Link
              to="/simulacro"
              className="text-xs text-muted hover:text-ink"
            >
              Salir
            </Link>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-30 border-b border-border/80 bg-bg/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 lg:h-16 lg:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-sm border border-border bg-surface">
              <span className="font-display text-[13px] font-semibold tracking-tight text-ink">
                26
              </span>
            </span>
            <span className="min-w-0">
              <span className="block font-display text-[15px] font-semibold leading-none tracking-tight">
                Cuaderno 2676
              </span>
              <span className="mt-0.5 block truncate text-[11px] uppercase tracking-[0.14em] text-muted">
                {cargo.shortLabel} · {cargo.processLabel}
              </span>
            </span>
          </Link>
          <Link
            to="/fuentes"
            className={cn(
              "hidden items-center rounded-md px-3 py-2 text-sm text-muted hover:bg-paper hover:text-ink sm:inline-flex",
              pathname.startsWith("/fuentes") && "bg-paper text-ink",
            )}
          >
            Fuentes
          </Link>
          <Link
            to="/cargo"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted hover:bg-paper hover:text-ink",
              (pathname.startsWith("/cargo") ||
                pathname.startsWith("/guia") ||
                pathname.startsWith("/ficha")) &&
                "bg-paper text-ink",
            )}
          >
            <Briefcase className="size-4" />
            Cargo
          </Link>
        </div>
      </header>
      )}

      {examMode ? (
        <main className="mx-auto max-w-3xl px-4 pb-8 pt-4">{children}</main>
      ) : (
        <>
      <div className="mx-auto flex max-w-6xl gap-0 lg:px-6">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-52 shrink-0 py-8 pr-6 lg:block">
          <nav className="flex flex-col gap-1">
            {NAV.map((item) => {
              const active =
                item.to === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex h-11 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
                    active
                      ? "bg-accent text-accent-fg"
                      : "text-muted hover:bg-paper hover:text-ink",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              to="/guia"
              className={cn(
                "flex h-11 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
                pathname.startsWith("/guia")
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-paper hover:text-ink",
              )}
            >
              <BookOpen className="size-4" />
              Guía del cargo
            </Link>
            <Link
              to="/cargo"
              className={cn(
                "flex h-11 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
                pathname.startsWith("/cargo")
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-paper hover:text-ink",
              )}
            >
              <Briefcase className="size-4" />
              Cambiar cargo
            </Link>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-28 pt-6 lg:px-0 lg:pb-16 lg:pt-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => {
            const active =
              item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                    active ? "text-accent" : "text-muted",
                  )}
                >
                  <Icon className={cn("size-5", active && "text-accent")} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
        </>
      )}
    </div>
  );
}
