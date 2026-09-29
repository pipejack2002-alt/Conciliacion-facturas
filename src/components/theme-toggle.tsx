import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === "dark" ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro Ejecutivo"}
      aria-label="Alternar tema"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-teal hover:text-teal transition-all cursor-pointer shadow-2xs select-none",
        className
      )}
    >
      {theme === "dark" ? (
        <>
          <Sun className="size-3.5 text-amber-400 animate-in zoom-in duration-150" />
          <span className="hidden sm:inline">Claro</span>
        </>
      ) : (
        <>
          <Moon className="size-3.5 text-sky-600 animate-in zoom-in duration-150" />
          <span className="hidden sm:inline">Oscuro</span>
        </>
      )}
    </button>
  );
}
