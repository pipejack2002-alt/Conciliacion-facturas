import { createFileRoute } from "@tanstack/react-router";
import { UploadPanel } from "@/components/upload-panel";
import { ResultBoard } from "@/components/result-board";
import { useConciliacion } from "@/lib/store";
import { ArrowLeft, Building2, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({ component: ConciliadorApp });

function ConciliadorApp() {
  const result = useConciliacion((s) => s.result);

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-teal-soft selection:text-teal-deep">
      {/* Header Corporativo */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg-surface/90 backdrop-blur-md px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-teal text-bg-elevated shadow-sm">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base tracking-tight text-ink">
                  Conciliador DIAN
                </span>
                <span className="rounded-md bg-teal-soft/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal">
                  TributoApp
                </span>
              </div>
              <p className="text-[11px] text-ink-muted hidden sm:block">
                Auditoría tributaria y cruce automático vs. Libros Contables
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <a
              href="https://www.tributoapp.me"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-3 py-1.5 font-medium text-ink-muted hover:border-teal hover:text-teal transition"
            >
              <span>Ir a TributoApp.me</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-6 sm:py-8">
        {result ? <ResultBoard /> : <UploadPanel />}
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-bg-surface/50 py-4 px-4 text-center text-xs text-ink-muted">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} TributoApp S.A.S. · Conciliación Electrónica DIAN Colombia
          </span>
          <span className="text-[11px] text-ink-subtle">
            Compatible con Siigo, Helisa, World Office, CGUNO y libros auxiliares de Excel
          </span>
        </div>
      </footer>
    </div>
  );
}
