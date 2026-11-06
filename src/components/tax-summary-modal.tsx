import { useState } from "react";
import {
  X,
  FileText,
  CheckCircle2,
  Percent,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Maximize2,
  Minimize2,
  AlertTriangle,
  ShieldCheck,
  FileSpreadsheet,
  Printer,
} from "lucide-react";
import * as XLSX from "xlsx";
import { formatMoney } from "@/lib/format";
import { isContado } from "@/lib/tax-insights";
import type { ConciliacionResult } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  result: ConciliacionResult;
}

export function TaxSummaryModal({ open, onClose, result }: Props) {
  const [isMaximized, setIsMaximized] = useState(false);

  if (!open) return null;

  const { rows, company, periodLabel } = result;

  // 1. Facturas Recibidas (Compras y Gastos operativos en DIAN)
  const recibidas = rows.filter(
    (r) => r.grupo === "Recibido" && r.estado !== "no_aplica" && r.estado !== "solo_siigo" && r.totalDian > 0,
  );
  const totalIvaDianRecibidas = recibidas.reduce((s, r) => s + (r.iva || 0), 0);
  const totalBaseDianRecibidas = recibidas.reduce((s, r) => s + Math.max(0, r.totalDian - (r.iva || 0)), 0);
  const totalFacturadoDian = recibidas.reduce((s, r) => s + r.totalDian, 0);

  // Separación de IVA causado en libros vs IVA en riesgo (facturas pendientes de causar)
  const recibidasCausadas = recibidas.filter(
    (r) => r.estado === "conciliado" || r.estado === "totalizado" || r.estado === "cruce_nc",
  );
  const recibidasPendientes = recibidas.filter(
    (r) => r.estado === "pendiente" || r.estado === "posible_typo" || r.estado === "diferencia",
  );
  const ivaSoportadoLibros = recibidasCausadas.reduce((s, r) => s + (r.iva || 0), 0);
  const ivaEnRiesgoPendiente = recibidasPendientes.reduce((s, r) => s + (r.iva || 0), 0);

  // Clasificación por tarifa de IVA para el Formulario 300 DIAN
  let baseGravada19 = 0;
  let ivaGravado19 = 0;
  let baseGravada5 = 0;
  let ivaGravado5 = 0;
  let baseExcluida = 0;

  for (const r of recibidas) {
    const iva = r.iva || 0;
    const base = Math.max(0, r.totalDian - iva);
    if (iva <= 0) {
      baseExcluida += r.totalDian;
    } else {
      const rate = base > 0 ? iva / base : 0.19;
      if (rate <= 0.08) {
        baseGravada5 += base;
        ivaGravado5 += iva;
      } else {
        baseGravada19 += base;
        ivaGravado19 += iva;
      }
    }
  }

  // 2. Facturas Emitidas (Ventas / Ingresos)
  const emitidas = rows.filter(
    (r) => r.grupo === "Emitido" && r.estado !== "no_aplica" && r.totalDian > 0,
  );
  const totalIvaEmitidas = emitidas.reduce((s, r) => s + (r.iva || 0), 0);
  const totalBaseEmitidas = emitidas.reduce((s, r) => s + Math.max(0, r.totalDian - (r.iva || 0)), 0);

  // 3. Diagnóstico Art. 771-2 E.T. y Resolución DIAN 000085 (Contado vs Crédito)
  const pendientesContado = recibidasPendientes.filter((r) => isContado(r));
  const pendientesCredito = recibidasPendientes.filter((r) => !isContado(r));
  const montoPendienteContado = pendientesContado.reduce((s, r) => s + r.totalDian, 0);
  const montoRiesgoRadian = pendientesCredito.reduce((s, r) => s + r.totalDian, 0);

  // Estimación referencial Formulario 350 (Retención en la Fuente)
  const baseGravadaTotal = baseGravada19 + baseGravada5;
  const estReteFuenteCompras = baseGravadaTotal * 0.025;
  const estReteIva15 = totalIvaDianRecibidas * 0.15;

  function exportBorradorTributarioExcel() {
    const wb = XLSX.utils.book_new();
    const sheetData = [
      ["SIMULADOR Y BORRADOR DE CONCILIACIÓN TRIBUTARIA DIAN (FORMULARIO 300 / 350)"],
      ["Empresa:", company.nombre || "Empresa Auditada", "NIT:", company.nit || "S/N"],
      ["Período:", periodLabel || "Actual", "Fecha de emisión:", new Date().toLocaleDateString("es-CO")],
      [],
      ["1. BORRADOR REFERENCIAL FORMULARIO 300 (DECLARACIÓN DE IVA)", "BASE GRAVABLE (COP)", "IVA (COP)"],
      ["Compras nacionales gravadas a tarifa del 5%", Math.round(baseGravada5), Math.round(ivaGravado5)],
      ["Compras nacionales gravadas a tarifa general (19%)", Math.round(baseGravada19), Math.round(ivaGravado19)],
      ["Compras de bienes y servicios excluidos / exentos / no gravados (0%)", Math.round(baseExcluida), 0],
      ["TOTAL COMPRAS Y ADQUISICIONES EN DIAN", Math.round(totalBaseDianRecibidas), Math.round(totalIvaDianRecibidas)],
      ["Ingresos por operaciones gravadas / Ventas emitidas en DIAN", Math.round(totalBaseEmitidas), Math.round(totalIvaEmitidas)],
      [],
      ["2. CONCILIACIÓN DE IVA DESCONTABLE (DIAN VS. LIBROS CONTABLES)", "DOCUMENTOS", "VALOR IVA (COP)"],
      ["IVA Descontable ya causado y soportado en libros contables", recibidasCausadas.length, Math.round(ivaSoportadoLibros)],
      ["IVA en Riesgo (Facturas en DIAN pendientes de causar en libros)", recibidasPendientes.length, Math.round(ivaEnRiesgoPendiente)],
      ["TOTAL IVA FACTURADO POR PROVEEDORES EN DIAN", recibidas.length, Math.round(totalIvaDianRecibidas)],
      [],
      ["3. CONTROL NORMATIVO ART. 771-2 E.T. Y RES. 000085 (RADIAN)", "FACTURAS", "MONTO TOTAL (COP)"],
      ["Facturas de Contado pendientes de causar (Exentas de eventos RADIAN)", pendientesContado.length, Math.round(montoPendienteContado)],
      ["Facturas a Crédito sin causar / en verificación de acuses RADIAN", pendientesCredito.length, Math.round(montoRiesgoRadian)],
      [],
      ["4. ESTIMACIÓN REFERENCIAL FORMULARIO 350 (RETENCIÓN EN LA FUENTE)", "BASE ESTIMADA", "RETENCIÓN REF."],
      ["Retención en la fuente compras generales (Ref. 2.5%)", Math.round(baseGravadaTotal), Math.round(estReteFuenteCompras)],
      ["Retención de IVA aplicable por agentes de retención (Ref. 15% IVA)", Math.round(totalIvaDianRecibidas), Math.round(estReteIva15)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [{ wch: 62 }, { wch: 24 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws, "Borrador_F300_F350");

    const cleanNit = (company.nit || "EMP").replace(/\D/g, "");
    XLSX.writeFile(wb, `Borrador_Tributario_DIAN_F300_F350_${cleanNit}.xlsx`);
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200 ${
        isMaximized ? "p-1 sm:p-2" : "p-3 sm:p-6"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`relative flex flex-col w-full transition-all duration-200 overflow-hidden rounded-2xl border border-line bg-bg-surface shadow-2xl ${
          isMaximized
            ? "h-[98vh] max-w-[99vw]"
            : "max-h-[95vh] max-w-5xl xl:max-w-6xl 2xl:max-w-7xl"
        }`}
      >
        {/* Header */}
        <div className="no-print flex items-center justify-between border-b border-line px-6 py-4 bg-bg-elevated">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal/10 text-teal">
              <Percent className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-ink">
                Simulador Tributario DIAN · Formulario 300 (IVA) & 350
              </h2>
              <p className="text-xs text-ink-muted">
                {company.nombre} (NIT: {company.nit}) · {periodLabel || "Período actual"} · Control Art. 771-2 E.T.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportBorradorTributarioExcel}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-teal hover:text-teal transition cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="size-4 text-ok" />
              <span className="hidden sm:inline">Exportar Excel</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-line-strong transition cursor-pointer shadow-2xs"
            >
              <Printer className="size-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="rounded-lg p-2 text-ink-muted hover:bg-bg-subtle hover:text-ink transition cursor-pointer"
              title={isMaximized ? "Restaurar tamaño normal" : "Maximizar a pantalla completa"}
            >
              {isMaximized ? <Minimize2 className="size-4.5" /> : <Maximize2 className="size-4.5" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-ink-muted hover:bg-bg-subtle hover:text-ink transition cursor-pointer"
              title="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 [scrollbar-width:thin]">
          {/* Top Comparison Cards: IVA Total, IVA Causado en Libros, IVA en Riesgo, IVA Generado */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* IVA Descontable Total DIAN */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  <ArrowDownLeft className="h-4 w-4" /> IVA Compras DIAN
                </span>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  {recibidas.length} docs
                </span>
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-ink">
                {formatMoney(totalIvaDianRecibidas)}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Total IVA facturado electrónicamente en DIAN (19% + 5%).
              </p>
            </div>

            {/* IVA Ya Causado en Libros */}
            <div className="rounded-xl border border-teal/30 bg-teal-soft/20 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal">
                  <CheckCircle2 className="h-4 w-4" /> IVA Soportado en Libros
                </span>
                <span className="rounded bg-teal/20 px-2 py-0.5 text-[11px] font-bold text-teal">
                  {recibidasCausadas.length} causadas
                </span>
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-teal">
                {formatMoney(ivaSoportadoLibros)}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                IVA descontable ya contabilizado y conciliado en el ERP.
              </p>
            </div>

            {/* IVA en Riesgo (Facturas Pendientes de Causar) */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> IVA por Recuperar
                </span>
                <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                  {recibidasPendientes.length} en cola
                </span>
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-amber-700 dark:text-amber-400">
                {formatMoney(ivaEnRiesgoPendiente)}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                IVA en facturas DIAN pendientes de registrar antes de declarar.
              </p>
            </div>

            {/* IVA Generado (Ventas) */}
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  <ArrowUpRight className="h-4 w-4" /> IVA Generado (Ventas)
                </span>
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                  {emitidas.length} emitidas
                </span>
              </div>
              <p className="mt-2 font-mono text-2xl font-black text-ink">
                {formatMoney(totalIvaEmitidas)}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Base gravable emitida: {formatMoney(totalBaseEmitidas)}.
              </p>
            </div>
          </div>

          {/* Formulario 300 DIAN Draft */}
          <div className="rounded-xl border border-line bg-bg-elevated p-5">
            <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-teal" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
                  Borrador Referencial de Renglones · Formulario 300 (IVA)
                </h3>
              </div>
              <span className="text-xs font-mono text-ink-muted">Cifras en Pesos (COP)</span>
            </div>

            <div className="mt-4 divide-y divide-line text-sm">
              <div className="flex justify-between py-2.5">
                <span className="text-ink-muted">
                  Compras nacionales de bienes y servicios gravados a tarifa del 5%
                </span>
                <span className="font-mono font-semibold text-ink">
                  {formatMoney(baseGravada5)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-ink-muted">
                  Compras nacionales de bienes y servicios gravados a tarifa general (19%)
                </span>
                <span className="font-mono font-semibold text-ink">
                  {formatMoney(baseGravada19)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-ink-muted">
                  Compras de bienes y servicios excluidos, exentos y no gravados (0%)
                </span>
                <span className="font-mono font-semibold text-ink">
                  {formatMoney(baseExcluida)}
                </span>
              </div>
              <div className="flex justify-between py-2.5 bg-bg-subtle/40 px-2 rounded">
                <span className="font-bold text-ink">
                  Total Compras y Adquisiciones Brutas del Período (Base + IVA)
                </span>
                <span className="font-mono font-black text-ink">
                  {formatMoney(totalFacturadoDian)}
                </span>
              </div>
              {ivaGravado5 > 0 && (
                <div className="flex justify-between py-2.5 px-2">
                  <span className="text-teal font-medium">
                    Impuesto descontable por compras a la tarifa del 5%
                  </span>
                  <span className="font-mono font-semibold text-teal">
                    {formatMoney(ivaGravado5)}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-2.5 px-2">
                <span className="text-teal font-medium">
                  Impuesto descontable por compras a la tarifa general del 19%
                </span>
                <span className="font-mono font-semibold text-teal">
                  {formatMoney(ivaGravado19)}
                </span>
              </div>
              <div className="flex justify-between py-3 bg-teal-soft/30 px-3 rounded-lg font-bold border border-teal/30 mt-2">
                <span className="text-teal">
                  TOTAL IMPUESTO DESCONTABLE FACTURADO EN DIAN (19% + 5%)
                </span>
                <span className="font-mono text-base text-teal">
                  {formatMoney(totalIvaDianRecibidas)}
                </span>
              </div>
            </div>
          </div>

          {/* Semáforo Normativo Art. 771-2 E.T. (Contado vs Crédito RADIAN) y Formulario 350 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Control Art. 771-2 E.T. */}
            <div className="rounded-xl border border-line bg-bg-elevated p-5">
              <div className="flex items-center gap-2 border-b border-line pb-3">
                <ShieldCheck className="h-4 w-4 text-teal" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
                  Control Art. 771-2 E.T. & Res. 000085 (RADIAN)
                </h3>
              </div>
              <div className="mt-3 space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <div>
                    <p className="font-bold text-emerald-800 dark:text-emerald-300">
                      Facturas de Contado en Cola ({pendientesContado.length})
                    </p>
                    <p className="text-ink-muted mt-0.5">
                      Exentas de eventos RADIAN. Deducibles al causar en libros.
                    </p>
                  </div>
                  <span className="font-mono text-sm font-black text-emerald-700 dark:text-emerald-400">
                    {formatMoney(montoPendienteContado)}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/5 p-3">
                  <div>
                    <p className="font-bold text-rose-800 dark:text-rose-300">
                      Facturas a Crédito por Revisar Acuses ({pendientesCredito.length})
                    </p>
                    <p className="text-ink-muted mt-0.5">
                      Requieren eventos de acuse de recibo en DIAN para deducibilidad.
                    </p>
                  </div>
                  <span className="font-mono text-sm font-black text-rose-700 dark:text-rose-400">
                    {formatMoney(montoRiesgoRadian)}
                  </span>
                </div>
              </div>
            </div>

            {/* Formulario 350 Estimator */}
            <div className="rounded-xl border border-line bg-bg-elevated p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-line pb-3">
                  <FileText className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-ink">
                    Estimación Referencial · Formulario 350 (ReteFuente)
                  </h3>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                  <div className="rounded-lg border border-line bg-bg-surface p-3">
                    <p className="text-xs text-ink-muted">Base Gravable Sujeta a Retención:</p>
                    <p className="mt-1 font-mono text-lg font-bold text-ink">{formatMoney(baseGravadaTotal)}</p>
                  </div>
                  <div className="rounded-lg border border-line bg-bg-surface p-3">
                    <p className="text-xs text-ink-muted">ReteFuente Estimada (Ref. 2.5%):</p>
                    <p className="mt-1 font-mono text-lg font-bold text-amber-600 dark:text-amber-400">
                      {formatMoney(estReteFuenteCompras)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-ink-muted leading-relaxed">
                Nota: Los valores reales del Formulario 350 dependen de las tarifas específicas practicadas en los comprobantes de causación (1%, 2.5%, 3.5%, 4%, 10%, 11%) en las cuentas PUC 2365 y 2367.
              </p>
            </div>
          </div>

          {/* Tax Audit Recommendation Alert */}
          <div className="flex items-start gap-3 rounded-xl border border-teal/30 bg-teal-soft/30 p-3.5 text-xs text-ink">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-teal mt-0.5" />
            <div>
              <span className="font-bold text-teal">Control Tributario Preventivo: </span>
              El cruce electrónico verifica que el 100% del IVA descontable declarado en el Formulario 300 esté respaldado con factura electrónica validada en el servidor de la DIAN, previniendo sanciones por inexactitud (Art. 647 E.T.).
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="no-print flex items-center justify-between border-t border-line px-6 py-3.5 bg-bg-elevated">
          <span className="text-xs text-ink-muted">
            Borrador calculado automáticamente sobre {recibidas.length} documentos recibidos y {emitidas.length} emitidos
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-white shadow hover:bg-teal-deep transition cursor-pointer"
          >
            Cerrar Simulador Fiscal
          </button>
        </div>
      </div>
    </div>
  );
}
