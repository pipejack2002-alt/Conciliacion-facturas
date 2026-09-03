import { CheckCircle2, AlertCircle, Clock, BookOpen, ShieldCheck, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/format";
import type { ConciliacionResult } from "@/lib/types";
import type { TabId } from "@/lib/store";

interface Props {
  result: ConciliacionResult;
  currentTab: TabId;
  onSelectTab: (tab: TabId) => void;
}

export function ConciliationProgress({ result, currentTab, onSelectTab }: Props) {
  const { totals } = result;

  const totalOperativos = totals.documentos || 1;
  const conciliados = totals.conciliados || 0;
  const pendientes = totals.pendientesRecibidos || 0;
  const crucesNc = totals.crucesNc || 0;
  const soloSiigo = totals.soloSiigo || 0;

  // Porcentajes para la barra segmentada
  const pctConciliado = Math.round((conciliados / totalOperativos) * 100);
  const pctCruces = Math.round((crucesNc / totalOperativos) * 100);
  const pctPendientes = Math.round((pendientes / totalOperativos) * 100);
  const pctSoloSiigo = Math.max(0, 100 - pctConciliado - pctCruces - pctPendientes);

  const efectividadCompras = Math.round(totals.pctRecibidos * 100);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-gradient-to-b from-bg-surface to-bg-subtle/40 p-4 shadow-sm sm:p-5 transition-all">
      {/* Top Header con Badge Corporativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-soft text-teal font-bold text-sm shadow-xs">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-ink">
                Estado de Cobertura y Efectividad de Conciliación
              </h3>
              {totals.cola === 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-[11px] font-semibold text-ok border border-ok/20">
                  <ShieldCheck className="size-3" />
                  Auditoría al día
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-semibold text-warn border border-warn/20">
                  <AlertCircle className="size-3" />
                  {totals.cola} por revisar
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted">
              Cruce automático entre comprobantes contables y facturación electrónica DIAN
            </p>
          </div>
        </div>

        {/* Cifra de Efectividad */}
        <div className="flex items-baseline gap-2 self-start sm:self-auto">
          <span className="text-2xl font-extrabold tracking-tight text-teal">
            {efectividadCompras}%
          </span>
          <span className="text-xs font-medium text-ink-muted">
            de compras conciliadas
          </span>
        </div>
      </div>

      {/* Barra Segmentada Multicolor */}
      <div className="mt-2">
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-line/60 flex">
          {pctConciliado > 0 && (
            <div
              style={{ width: `${pctConciliado}%` }}
              className="h-full bg-ok transition-all duration-500 ease-out"
              title={`Conciliados OK: ${pctConciliado}%`}
            />
          )}
          {pctCruces > 0 && (
            <div
              style={{ width: `${pctCruces}%` }}
              className="h-full bg-info transition-all duration-500 ease-out"
              title={`Cruces NC: ${pctCruces}%`}
            />
          )}
          {pctPendientes > 0 && (
            <div
              style={{ width: `${pctPendientes}%` }}
              className="h-full bg-warn transition-all duration-500 ease-out"
              title={`Por registrar: ${pctPendientes}%`}
            />
          )}
          {pctSoloSiigo > 0 && (
            <div
              style={{ width: `${pctSoloSiigo}%` }}
              className="h-full bg-indigo-400 transition-all duration-500 ease-out"
              title={`Solo en libros: ${pctSoloSiigo}%`}
            />
          )}
        </div>
      </div>

      {/* Segment Pills Interactivas */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* 1. Conciliados OK */}
        <button
          type="button"
          onClick={() => onSelectTab("conciliado")}
          className={`group flex items-center justify-between rounded-lg border p-2.5 text-left transition-all ${
            currentTab === "conciliado"
              ? "border-ok bg-ok-bg/60 shadow-xs ring-1 ring-ok/30"
              : "border-line bg-bg-surface hover:border-ok/40 hover:bg-ok-bg/20"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-ok" />
            <div>
              <div className="text-[11px] font-semibold text-ink-muted group-hover:text-ink">
                Registrados OK
              </div>
              <div className="text-xs font-bold text-ink">
                {conciliados} docs
              </div>
            </div>
          </div>
          <span className="text-[11px] font-medium text-ok">
            {formatMoney(totals.valorDian - totals.valorPendienteRecibido)}
          </span>
        </button>

        {/* 2. Por Registrar */}
        <button
          type="button"
          onClick={() => onSelectTab("pendiente")}
          className={`group flex items-center justify-between rounded-lg border p-2.5 text-left transition-all ${
            currentTab === "pendiente"
              ? "border-warn bg-warn-bg/60 shadow-xs ring-1 ring-warn/30"
              : "border-line bg-bg-surface hover:border-warn/40 hover:bg-warn-bg/20"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-warn" />
            <div>
              <div className="text-[11px] font-semibold text-ink-muted group-hover:text-ink">
                Por Registrar
              </div>
              <div className="text-xs font-bold text-ink">
                {pendientes} docs
              </div>
            </div>
          </div>
          <span className="text-[11px] font-medium text-warn">
            {formatMoney(totals.valorPendienteRecibido)}
          </span>
        </button>

        {/* 3. Solo en Libros */}
        <button
          type="button"
          onClick={() => onSelectTab("solo_siigo")}
          className={`group flex items-center justify-between rounded-lg border p-2.5 text-left transition-all ${
            currentTab === "solo_siigo"
              ? "border-indigo-400 bg-indigo-50/60 shadow-xs ring-1 ring-indigo-300"
              : "border-line bg-bg-surface hover:border-indigo-300 hover:bg-indigo-50/20"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-indigo-500" />
            <div>
              <div className="text-[11px] font-semibold text-ink-muted group-hover:text-ink">
                Solo Libros
              </div>
              <div className="text-xs font-bold text-ink">
                {soloSiigo} reg.
              </div>
            </div>
          </div>
          <span className="text-[11px] font-medium text-indigo-600">
            Auxiliares
          </span>
        </button>

        {/* 4. En Cola / Riesgo */}
        <button
          type="button"
          onClick={() => onSelectTab("cola")}
          className={`group flex items-center justify-between rounded-lg border p-2.5 text-left transition-all ${
            currentTab === "cola"
              ? "border-teal bg-teal-soft/40 shadow-xs ring-1 ring-teal/30"
              : "border-line bg-bg-surface hover:border-teal/40 hover:bg-teal-soft/20"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`flex size-2 rounded-full ${totals.cola === 0 ? "bg-ok" : "bg-danger"}`} />
            <div>
              <div className="text-[11px] font-semibold text-ink-muted group-hover:text-ink">
                En Cola
              </div>
              <div className="text-xs font-bold text-ink">
                {totals.cola === 0 ? "0 alertas" : `${totals.cola} alertas`}
              </div>
            </div>
          </div>
          <span className={`text-[11px] font-medium ${totals.cola === 0 ? "text-ok" : "text-danger"}`}>
            {totals.cola === 0 ? "Al día" : formatMoney(totals.valorCola)}
          </span>
        </button>
      </div>
    </div>
  );
}
