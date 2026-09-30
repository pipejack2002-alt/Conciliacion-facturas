import { memo } from "react";
import { Landmark, Sparkles, Trash2, Download } from "lucide-react";

interface BankHeaderBannerProps {
  modoVista: "homologado" | "universal";
  onSetModoVista: (mode: "homologado" | "universal") => void;
  hasData: boolean;
  onVaciar: () => void;
  isDemoMode: boolean;
  canLoadDemo: boolean;
  onCargarDemo: () => void;
  canExport: boolean;
  onExportarExcel: () => void;
}

export const BankHeaderBanner = memo(function BankHeaderBanner({
  modoVista,
  onSetModoVista,
  hasData,
  onVaciar,
  isDemoMode,
  canLoadDemo,
  onCargarDemo,
  canExport,
  onExportarExcel,
}: BankHeaderBannerProps) {
  return (
    <div className="space-y-4">
      {/* Selector de Modo: Homologado vs Universal */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-bg-surface border border-line rounded-2xl shadow-2xs">
        <div className="flex items-center gap-1.5 p-1 bg-bg-subtle rounded-xl">
          <button
            type="button"
            onClick={() => onSetModoVista("homologado")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
              modoVista === "homologado"
                ? "bg-teal text-white shadow-xs"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Landmark className="size-3.5" />
            <span>Bancos Homologados (Caja Social / Credicorp / Banistmo)</span>
          </button>
          <button
            type="button"
            onClick={() => onSetModoVista("universal")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer select-none ${
              modoVista === "universal"
                ? "bg-teal text-white shadow-xs font-bold"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Sparkles className="size-3.5" />
            <span>Conciliador Universal (Cualquier Banco · Excel / CSV / PDF)</span>
          </button>
        </div>
        <span className="text-[11px] text-ink-muted hidden md:inline-block pr-2">
          Modelos pre-validados con extracción automática para cuentas colombianas e internacionales
        </span>
      </div>

      {/* Banner Principal de Conciliación Bancaria */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-bg-surface via-bg-surface to-teal-soft/25 p-4 sm:p-5 shadow-xs">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded-lg bg-teal p-1.5 text-white shadow-xs">
              <Landmark className="size-5" />
            </span>
            <h1 className="font-display text-lg sm:text-xl font-bold text-ink">
              Módulo de Conciliación Bancaria y Tesorería
            </h1>
            <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-bold text-teal">
              PDF & Excel · Bancos & Fondos
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Cruce inteligente de extractos bancarios en PDF o Excel (Banco Caja Social, Credicorp Capital, Banistmo, Bancolombia, etc.) contra el libro auxiliar contable (Clase 11 y 1250).
          </p>
        </div>

        {/* Botones de acción alineados horizontalmente */}
        <div className="flex items-center gap-2 shrink-0 flex-nowrap">
          {hasData && (
            <button
              type="button"
              onClick={onVaciar}
              className="inline-flex items-center gap-1.5 rounded-xl border border-danger/30 bg-danger-bg px-3 py-2 text-xs font-semibold text-danger hover:bg-danger hover:text-white transition cursor-pointer shadow-2xs whitespace-nowrap"
              title="Vaciar extracto y movimientos cargados para dejar la plantilla en blanco"
            >
              <Trash2 className="size-3.5" />
              <span>Vaciar Datos</span>
            </button>
          )}

          {!isDemoMode && canLoadDemo && (
            <button
              type="button"
              onClick={onCargarDemo}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-teal hover:text-teal transition cursor-pointer shadow-2xs whitespace-nowrap"
              title="Cargar datos de ejemplo de extracto y contabilidad para demostración"
            >
              <Sparkles className="size-3.5 text-teal" />
              <span>Cargar Ejemplo</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExportarExcel}
            disabled={!canExport}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-deep transition cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap"
          >
            <Download className="size-3.5" />
            <span>Exportar Conciliación a Excel</span>
          </button>
        </div>
      </div>
    </div>
  );
});
