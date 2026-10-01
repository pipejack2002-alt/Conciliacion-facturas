import { useEffect, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { UploadPanel } from "@/components/upload-panel";
import { ResultBoard } from "@/components/result-board";
import { DashboardBi } from "@/components/dashboard-bi";
import { ConciliacionBancariaView } from "@/components/conciliacion-bancaria";
import { ThemeToggle } from "@/components/theme-toggle";
import { useConciliacion } from "@/lib/store";
import { TributoAuthGuardian, TributoUserBadge } from "@/components/tributo-auth-guardian";
import { ToastHost } from "@/components/audit-chrome";
import { FileCheck, BarChart3, Landmark } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/")({ component: ProtectedConciliadorApp });

import {
  type ActiveModuleId,
  STORAGE_ACTIVE_MODULE_KEY,
  getInitialActiveModule,
} from "@/lib/tab-persistence";

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
  const [activeModule, setActiveModuleState] = useState<ActiveModuleId>(getInitialActiveModule);

  const setActiveModule = useCallback((mod: ActiveModuleId) => {
    setActiveModuleState(mod);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_ACTIVE_MODULE_KEY, mod);
        const url = new URL(window.location.href);
        url.searchParams.set("modulo", mod);
        window.history.replaceState(null, "", url.toString());
      } catch {
        // Silently ignore
      }
    }
  }, []);

  // Sincronizar URL inicial para que F5 siempre tenga el parámetro
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        if (!url.searchParams.has("modulo")) {
          url.searchParams.set("modulo", activeModule);
          window.history.replaceState(null, "", url.toString());
        }
      } catch {
        // Silently ignore
      }
    }
  }, [activeModule]);

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
          {/* Logo y Nombre del Conciliador */}
          <div className="flex items-center gap-3">
            <AppLogo className="size-9 shrink-0 shadow-xs" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-sm sm:text-base tracking-tight text-ink">
                  Conciliador Fiscal & Bancario
                </span>
                <span className="rounded-md bg-teal-soft border border-teal/30 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal">
                  TributoApp
                </span>
              </div>
              <p className="text-[11px] text-ink-muted font-medium hidden sm:block">
                Cruce Inteligente de Facturas DIAN, Libros ERP y Bancos
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
        {/* Pestaña: Conciliador DIAN (Facturas vs Libros) */}
        <div className={activeModule === "dian" ? "block" : "hidden"}>
          {result ? <ResultBoard /> : <UploadPanel />}
        </div>

        {/* Pestaña: Dashboard BI */}
        <div className={activeModule === "dashboard_bi" ? "block" : "hidden"}>
          {result ? (
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
          )}
        </div>

        {/* Pestaña: Bancos (Conciliación Bancaria y Tesorería) */}
        <div className={activeModule === "bancos" ? "block" : "hidden"}>
          <ConciliacionBancariaView movLines={mov} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-bg-surface/50 py-3.5 px-4 sm:px-6 lg:px-8 text-xs text-ink-muted">
        <div className="mx-auto w-full max-w-[1600px] flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <span>
            © {new Date().getFullYear()} TributoApp S.A.S. · Conciliador Fiscal & Bancario
          </span>
          <span className="text-[11px] text-ink-subtle">
            Procesamiento seguro 100% en el navegador (Client-Side TLS 1.3)
          </span>
        </div>
      </footer>

      {/* Notificaciones Flotantes Globales */}
      <ToastHost />
    </div>
  );
}
