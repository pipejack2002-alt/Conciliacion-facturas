import { memo } from "react";
import { FileText, FileSpreadsheet, Upload, RefreshCw } from "lucide-react";
import { formatMoneyExact } from "@/lib/format";
import type { ParsedBankExtractResult } from "@/lib/parse-bank-extract";
import type { DetectedBankAccount } from "@/lib/conciliar-bancos";

interface BankUploadCardsProps {
  extractoMeta: ParsedBankExtractResult | null;
  extractoItemsCount: number;
  selectedSubAccount: string;
  onSelectSubAccount: (val: string) => void;
  isExtractoLoading: boolean;
  extractoFileName: string;
  fileInputExtractoRef: React.RefObject<HTMLInputElement | null>;
  onUploadExtracto: (e: React.ChangeEvent<HTMLInputElement>) => void;

  effectiveMovLinesCount: number;
  availableAccounts: DetectedBankAccount[];
  cuentaSeleccionada: string;
  onSelectCuenta: (val: string) => void;
  librosEfectivosCount: number;
  librosBancosCount: number;
  isMovLoading: boolean;
  customMovFileName: string;
  hasSessionMovLines: boolean;
  isMovimientosVaciados?: boolean;
  movLinesCount?: number;
  onReactivarSesionMov?: () => void;
  fileInputMovRef: React.RefObject<HTMLInputElement | null>;
  onUploadMov: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const BankUploadCards = memo(function BankUploadCards({
  extractoMeta,
  extractoItemsCount,
  selectedSubAccount,
  onSelectSubAccount,
  isExtractoLoading,
  extractoFileName,
  fileInputExtractoRef,
  onUploadExtracto,

  effectiveMovLinesCount,
  availableAccounts,
  cuentaSeleccionada,
  onSelectCuenta,
  librosEfectivosCount,
  librosBancosCount,
  isMovLoading,
  customMovFileName,
  hasSessionMovLines,
  isMovimientosVaciados,
  movLinesCount,
  onReactivarSesionMov,
  fileInputMovRef,
  onUploadMov,
}: BankUploadCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Tarjeta 1: Carga de Extracto Bancario (PDF o Excel) */}
      <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-teal-soft p-1.5 text-teal">
                <FileText className="size-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-ink">
                1. Extracto Bancario (PDF o Excel)
              </span>
            </div>
            {extractoMeta ? (
              <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                {extractoMeta.bancoNombre}
              </span>
            ) : (
              <span className="rounded-full bg-bg-subtle text-ink-subtle px-2 py-0.5 text-[10px] font-medium">
                PDF / XLSX / CSV
              </span>
            )}
          </div>

          <p className="text-xs text-ink-muted mb-3">
            Sube el extracto bancario emitido por la entidad financiera. Compatible con Banco Caja Social, Credicorp Capital, Banistmo, Bancolombia, Davivienda y formatos universales.
          </p>

          {extractoMeta && (
            <div className="rounded-xl border border-line bg-bg-subtle/50 p-3 text-xs space-y-1.5 mb-3">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Entidad:</span>
                <span className="font-semibold text-ink">{extractoMeta.bancoNombre}</span>
              </div>
              {extractoMeta.numeroCuenta && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">No. de Cuenta:</span>
                  <span className="font-mono font-medium text-ink">{extractoMeta.numeroCuenta}</span>
                </div>
              )}
              {extractoMeta.periodo && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Periodo:</span>
                  <span className="text-ink">{extractoMeta.periodo}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1 border-t border-line/60">
                <span className="text-ink-muted">Partidas en Extracto:</span>
                <span className="font-bold text-teal">{extractoItemsCount} movimientos</span>
              </div>

              {/* Si el extracto tiene múltiples subcuentas o portafolios */}
              {extractoMeta.cuentasDisponibles && extractoMeta.cuentasDisponibles.length > 1 && (
                <div className="pt-2 border-t border-line/60">
                  <label className="block text-[11px] font-bold text-ink mb-1">
                    Portafolio / Sección a Conciliar:
                  </label>
                  <select
                    value={selectedSubAccount}
                    onChange={(e) => onSelectSubAccount(e.target.value)}
                    className="w-full rounded-lg border border-line bg-bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink focus:outline-teal"
                  >
                    {extractoMeta.cuentasDisponibles.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.nombre} ({sub.items.length} movs · Saldo: {formatMoneyExact(sub.saldoFinal)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <input
            ref={fileInputExtractoRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv"
            onChange={onUploadExtracto}
            className="hidden"
          />
          <button
            type="button"
            disabled={isExtractoLoading}
            onClick={() => fileInputExtractoRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-teal/60 bg-teal-soft/20 py-2.5 px-3 text-xs font-semibold text-teal hover:bg-teal-soft/40 transition cursor-pointer"
          >
            {isExtractoLoading ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Procesando extracto...</span>
              </>
            ) : (
              <>
                <Upload className="size-3.5" />
                <span>
                  {extractoMeta ? "Reemplazar Extracto (PDF o Excel)" : "Subir Extracto Bancario (PDF / Excel)"}
                </span>
              </>
            )}
          </button>
          <div className="mt-1 text-[11px] text-center text-ink-subtle truncate">
            {extractoFileName || "Ningún archivo seleccionado"}
          </div>
        </div>
      </div>

      {/* Tarjeta 2: Carga de Movimiento Auxiliar Contable (Excel) */}
      <div className="rounded-2xl border border-line bg-bg-surface p-4 shadow-2xs flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-teal-soft p-1.5 text-teal">
                <FileSpreadsheet className="size-4" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-ink">
                2. Movimiento Contable (Excel)
              </span>
            </div>
            {effectiveMovLinesCount > 0 ? (
              <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                {effectiveMovLinesCount} registros
              </span>
            ) : (
              <span className="rounded-full bg-bg-subtle text-ink-subtle px-2 py-0.5 text-[10px] font-medium">
                Pendiente
              </span>
            )}
          </div>

          <p className="text-xs text-ink-muted mb-3">
            {hasSessionMovLines
              ? "Utilizando los movimientos auxiliares cargados en la sesión activa. También puedes cargar un archivo Excel independiente si lo requieres."
              : "Carga el reporte auxiliar de movimientos contables exportado de tu ERP (Siigo, Helisa, World Office, CGUNO, etc.)."}
          </p>

          {/* Selector de Cuenta Contable */}
          {(() => {
            const credicorpAccounts = availableAccounts.filter(
              (a) =>
                a.cuenta.startsWith("12503511") ||
                a.cuenta.startsWith("12450541") ||
                /credicorp|correval|fonval|serfinco/i.test(a.cuentaNombre)
            );
            const credicorpTotalMovs = credicorpAccounts.reduce(
              (sum, a) => sum + a.totalMovimientos,
              0
            );

            return (
              <div className="rounded-xl border border-line bg-bg-subtle/50 p-3 text-xs space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">Cuenta Contable a Conciliar:</span>
                  <span className="text-[11px] text-ink-muted">
                    {availableAccounts.length} cuentas de tesorería detectadas
                  </span>
                </div>

                <select
                  value={cuentaSeleccionada}
                  onChange={(e) => onSelectCuenta(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink focus:outline-teal"
                >
                  <option value="todas">
                    Todas las cuentas de bancos y tesorería ({librosEfectivosCount} movs)
                  </option>
                  {credicorpAccounts.length > 1 && (
                    <option value="credicorp_all">
                      ⭐ Credicorp Capital - Ambas Cuentas ({credicorpAccounts.map((a) => a.cuenta).join(" + ")}) ({credicorpTotalMovs} registros)
                    </option>
                  )}
                  {availableAccounts.map((acc) => {
                    const isCredicorp = credicorpAccounts.some((c) => c.cuenta === acc.cuenta);
                    return (
                      <option key={acc.cuenta} value={acc.cuenta}>
                        {acc.cuenta} - {acc.cuentaNombre} ({acc.totalMovimientos} registros)
                        {isCredicorp ? " · [Credicorp Capital]" : ""}
                      </option>
                    );
                  })}
                </select>

                {cuentaSeleccionada !== "todas" && (
                  <div className="pt-1 flex items-center justify-between text-[11px] text-ink-muted">
                    <span>
                      {cuentaSeleccionada === "credicorp_all"
                        ? "Movimientos en cuentas Credicorp:"
                        : "Movimientos en esta cuenta:"}
                    </span>
                    <span className="font-mono font-bold text-ink">{librosBancosCount} líneas</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div>
          <input
            ref={fileInputMovRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onUploadMov}
            className="hidden"
          />
          <button
            type="button"
            disabled={isMovLoading}
            onClick={() => fileInputMovRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-teal/60 bg-teal-soft/20 py-2.5 px-3 text-xs font-semibold text-teal hover:bg-teal-soft/40 transition cursor-pointer"
          >
            {isMovLoading ? (
              <>
                <RefreshCw className="size-3.5 animate-spin" />
                <span>Procesando archivo contable...</span>
              </>
            ) : (
              <>
                <Upload className="size-3.5" />
                <span>
                  {effectiveMovLinesCount > 0
                    ? "Cargar otro Excel de Movimientos Contables"
                    : "Subir Archivo Excel de Movimientos"}
                </span>
              </>
            )}
          </button>
          <div className="mt-1 text-[11px] text-center text-ink-subtle truncate">
            {customMovFileName ||
              (hasSessionMovLines ? "Movimientos de la sesión activa" : "Sin archivo")}
          </div>
          {isMovimientosVaciados && movLinesCount && movLinesCount > 0 && onReactivarSesionMov && (
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={onReactivarSesionMov}
                className="text-[11px] text-teal font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer bg-teal-soft/30 px-2.5 py-1 rounded-lg"
                title="Volver a asociar los movimientos del libro auxiliar de la sesión actual"
              >
                <span>Reactivar movimientos de la sesión DIAN ({movLinesCount})</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
