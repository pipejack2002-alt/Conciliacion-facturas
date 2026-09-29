import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UploadPanel } from "@/components/upload-panel";
import { ResultBoard } from "@/components/result-board";
import { DashboardBi } from "@/components/dashboard-bi";
import { ConciliacionBancariaView } from "@/components/conciliacion-bancaria";
import { ThemeToggle } from "@/components/theme-toggle";
import { useConciliacion } from "@/lib/store";
import { TributoAuthGuardian, TributoUserBadge } from "@/components/tributo-auth-guardian";
import { ToastHost } from "@/components/audit-chrome";
import { ShieldCheck, FileCheck, BarChart3, Landmark } from "lucide-react";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/")({ component: ProtectedConciliadorApp });

function ProtectedConciliadorApp() {
  return (
    <TributoAuthGuardian>
      <ConciliadorApp />
    </TributoAuthGuardian>
  );
}

function ConciliadorApp() {
  const result = useConciliacion((s) => s.result);
  const mov = useConciliacion((s) => s.mov);
  const restoreActiveSession = useConciliacion((s) => s.restoreActiveSession);
  const [activeModule, setActiveModule] = useState<"dian" | "dashboard_bi" | "bancos">("dian");

  useEffect(() => {
    if (!result) {
      restoreActiveSession();
    }
  }, [result, restoreActiveSession]);

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col selection:bg-teal-soft selection:text-teal-deep">
      {/* Header Corporativo Ejecutivo */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg-surface/95 backdrop-blur-md px-4 py-3 sm:px-6 lg:px-8 shadow-xs">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Logo y Nombre de la Suite */}
          <div className="flex items-center gap-3">
            <div className="flex size-9.5 items-center justify-center rounded-xl bg-gradient-to-br from-teal-700 to-emerald-700 text-white shadow-xs">
              <ShieldCheck className="size-5.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-tight text-ink">
                  Suite Financiera DIAN & Bancos
                </span>
                <span className="rounded-md bg-teal-soft border border-teal/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal">
                  TributoApp
                </span>
              </div>
              <p className="text-[11px] text-ink-muted font-medium hidden sm:block">
                Conciliación DIAN, Business Intelligence y Conciliación Bancaria NIIF
              </p>
            </div>
          </div>

          {/* Selector de Módulos (Tabs Principales de la Suite) */}
          <div className="flex items-center gap-1 rounded-xl border border-line bg-bg-subtle/80 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveModule("dian")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none",
                activeModule === "dian"
                  ? "bg-teal text-white shadow-xs font-black"
                  : "text-ink-muted hover:text-ink hover:bg-bg-surface"
              )}
            >
              <FileCheck className="size-3.5" />
              <span>Conciliador DIAN</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModule("dashboard_bi")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none",
                activeModule === "dashboard_bi"
                  ? "bg-teal text-white shadow-xs font-black"
                  : "text-ink-muted hover:text-ink hover:bg-bg-surface"
              )}
            >
              <BarChart3 className="size-3.5" />
              <span>Dashboard BI</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModule("bancos")}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none",
                activeModule === "bancos"
                  ? "bg-teal text-white shadow-xs font-black"
                  : "text-ink-muted hover:text-ink hover:bg-bg-surface"
              )}
            >
              <Landmark className="size-3.5" />
              <span>Bancos</span>
            </button>
          </div>

          {/* Acciones Derecha: Modo Oscuro, User Badge, Link */}
          <div className="flex items-center gap-2 text-xs">
            {/* Toggle de Modo Oscuro Ejecutivo */}
            <ThemeToggle />

            {/* Badge de usuario / sesión verificada */}
            <TributoUserBadge />

            <a
              href="https://www.tributoapp.me"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-elevated px-3 py-1.5 font-medium text-ink-muted hover:border-teal hover:text-teal transition"
            >
              <span>TributoApp.me</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 py-4 sm:py-6">
        {activeModule === "dashboard_bi" ? (
          result ? (
            <DashboardBi result={result} />
          ) : (
            <div className="mx-auto max-w-lg text-center py-16 px-4">
              <BarChart3 className="size-12 text-ink-subtle mx-auto mb-3 opacity-60" />
              <h2 className="text-lg font-bold text-ink">Dashboard BI de Compras e IVA</h2>
              <p className="text-xs text-ink-muted mt-1 mb-5">
                Carga un archivo de la DIAN y tus libros contables para generar automáticamente los gráficos gerenciales de compras e IVA.
              </p>
              <button
                type="button"
                onClick={() => setActiveModule("dian")}
                className="inline-flex items-center gap-2 rounded-xl bg-teal px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-deep transition cursor-pointer"
              >
                <FileCheck className="size-4" />
                Ir a Cargar Archivos DIAN
              </button>
            </div>
          )
        ) : activeModule === "bancos" ? (
          <ConciliacionBancariaView movLines={mov} />
        ) : result ? (
          <ResultBoard />
        ) : (
          <UploadPanel />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-bg-surface/50 py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-ink-muted">
        <div className="mx-auto w-full max-w-[1600px] flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            © {new Date().getFullYear()} TributoApp S.A.S. · Suite Financiera y Tributaria DIAN Colombia
          </span>
          <span className="text-[11px] text-ink-subtle">
            Compatible con Siigo, Helisa, World Office, CGUNO, Bancolombia, Davivienda y extractos bancarios
          </span>
        </div>
      </footer>

      {/* Notificaciones Flotantes Globales */}
      <ToastHost />
    </div>
  );
}
