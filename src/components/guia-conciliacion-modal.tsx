import { useState } from "react";
import {
  X,
  BookOpen,
  FileSpreadsheet,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  HelpCircle,
  Building2,
  FileText,
  Table,
} from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GuiaConciliacionModal({ open, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<"dian" | "contable" | "reglas" | "tips">("dian");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-bg-surface shadow-2xl flex flex-col">
        {/* Header del Modal */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-gradient-to-r from-bg-surface to-bg-subtle/50">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-teal text-white shadow-md shadow-teal/30">
              <BookOpen className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-ink">
                  Guía Oficial de Conciliación Fiscal
                </h2>
                <span className="rounded-md bg-teal-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-deep">
                  TributoApp
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Paso a paso para preparar y exportar sus archivos DIAN y contables
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Barra de Pestañas / Navegación */}
        <div className="flex border-b border-line bg-bg-subtle/40 px-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("dian")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition shrink-0 ${
              activeTab === "dian"
                ? "border-teal text-teal font-bold"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <FileSpreadsheet className="size-4" />
            <span>1. Reporte DIAN</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("contable")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition shrink-0 ${
              activeTab === "contable"
                ? "border-teal text-teal font-bold"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <Layers className="size-4" />
            <span>2. Movimiento Contable</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reglas")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition shrink-0 ${
              activeTab === "reglas"
                ? "border-teal text-teal font-bold"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <Sparkles className="size-4" />
            <span>3. Motor de Cruce y Reglas</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tips")}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-semibold transition shrink-0 ${
              activeTab === "tips"
                ? "border-teal text-teal font-bold"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            <ShieldCheck className="size-4" />
            <span>4. Tips y Buenas Prácticas</span>
          </button>
        </div>

        {/* Contenido Dinámico según la Pestaña */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-ink-muted">
          {activeTab === "dian" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="rounded-xl bg-teal-soft/40 border border-teal/20 p-4">
                <h4 className="font-bold text-ink flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-teal" />
                  ¿Cómo descargar el reporte oficial desde el portal de la DIAN?
                </h4>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  Inicie sesión en el portal de Facturación Electrónica de la DIAN (o Radian) de su empresa o cliente.
                </p>
              </div>

              <ol className="list-decimal list-inside space-y-3 text-xs sm:text-sm">
                <li className="pl-1">
                  <strong className="text-ink">Acceda al menú principal:</strong> Ingrese a la sección <span className="font-mono bg-bg-subtle px-1.5 py-0.5 rounded border border-line">Documentos Recibidos</span>.
                </li>
                <li className="pl-1">
                  <strong className="text-ink">Filtre por rango de fechas:</strong> Seleccione el mes o período fiscal a conciliar (ejemplo: 01 al 31 de Julio).
                </li>
                <li className="pl-1">
                  <strong className="text-ink">Descargue el archivo Excel:</strong> Haga clic en el botón <span className="font-semibold text-teal">Descargar Excel (.xlsx)</span>.
                </li>
                <li className="pl-1">
                  <strong className="text-ink">Cargue sin modificar:</strong> Puede arrastrar el archivo original directamente al Conciliador; nuestro motor detecta automáticamente los encabezados.
                </li>
              </ol>

              <div className="rounded-xl border border-line bg-bg-surface p-4">
                <h5 className="font-semibold text-ink text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Table className="size-3.5 text-teal" />
                  Columnas DIAN reconocidas automáticamente:
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ CUFE / UUID</span>
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ Prefijo y Folio</span>
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ NIT / Emisor</span>
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ Tipo Documento</span>
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ Valor Total / Bruto</span>
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ IVA e Impuestos</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "contable" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="rounded-xl bg-teal-soft/40 border border-teal/20 p-4">
                <h4 className="font-bold text-ink flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-teal" />
                  Extracto de Software Contable (Siigo, Helisa, World Office, CGUNO, etc.)
                </h4>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  Exporte el libro auxiliar de compras, gastos o cuentas por pagar (cuentas 14, 51, 52, 22, 23).
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-3.5 rounded-xl border border-line bg-bg-surface">
                  <h5 className="font-bold text-ink text-xs mb-1 flex items-center gap-2">
                    <Building2 className="size-4 text-teal" />
                    Instrucciones para Siigo Nube / Pyme:
                  </h5>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Reportes &gt; Contables &gt; Movimiento por Cuenta / Auxiliar de Terceros. Seleccione el mes y exporte a Excel detallando comprobante, número, NIT y valores.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-line bg-bg-surface">
                  <h5 className="font-bold text-ink text-xs mb-1 flex items-center gap-2">
                    <Building2 className="size-4 text-teal" />
                    Instrucciones para Helisa / World Office / CGUNO:
                  </h5>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Generar el informe auxiliar de cuentas por pagar / compras del período con detalle de comprobante causación (P, F, FC, DS) y notas crédito (NC, U).
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-bg-surface p-4">
                <h5 className="font-semibold text-ink text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Table className="size-3.5 text-teal" />
                  Datos clave del movimiento contable:
                </h5>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ Comprobante (P, F, U)</span>
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ Número / Factura</span>
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ NIT / Tercero</span>
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ Débitos / Créditos</span>
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ Fecha Causación</span>
                  <span className="p-2 rounded bg-bg-subtle border border-line/60">✓ Descripción / Detalle</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "reglas" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="rounded-xl bg-teal-soft/40 border border-teal/20 p-4">
                <h4 className="font-bold text-ink flex items-center gap-2 text-sm">
                  <Sparkles className="size-4 text-teal" />
                  ¿Cómo funciona el motor de cruce agnóstico y multi-empresa?
                </h4>
                <p className="mt-1 text-xs text-ink-muted leading-relaxed">
                  El motor aplica 5 capas de inteligencia algorítmica para garantizar 0 falsos duplicados y conciliar hasta con diferencias de comprobante.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-line bg-bg-surface">
                  <strong className="text-ink block mb-1">1. Cruce Documento Soporte y Causación:</strong>
                  <span className="text-ink-muted leading-relaxed">
                    Soporta comprobantes de emisión y causación con prefijos o consecutivos personalizados (ej. P-005 vs P-002 o P-004 vs P-001 de forma automática y agnóstica).
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-line bg-bg-surface">
                  <strong className="text-ink block mb-1">2. Exclusión de Egresos (G):</strong>
                  <span className="text-ink-muted leading-relaxed">
                    Filtra automáticamente los pagos y egresos de banco para evitar registrar doble causación.
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-line bg-bg-surface">
                  <strong className="text-ink block mb-1">3. Cruce de Notas Crédito (NC / U):</strong>
                  <span className="text-ink-muted leading-relaxed">
                    Asocia notas crédito electrónicas DIAN con comprobantes U o notas contables de ajuste.
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-line bg-bg-surface">
                  <strong className="text-ink block mb-1">4. Dictámenes Tributarios:</strong>
                  <span className="text-ink-muted leading-relaxed">
                    Calcula y audita si las diferencias provienen de Retefuente (2.5%, 3.5%, 4%), IVA descontable o redondeo.
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tips" && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-ok-bg border border-ok/20 text-ok">
                  <CheckCircle2 className="size-5 shrink-0 mt-0.5 text-ok" />
                  <div>
                    <strong className="block text-ink font-semibold">Descarga directa de plantillas y actas:</strong>
                    <span className="text-ink-muted text-xs">
                      Una vez conciliado, podrá exportar el informe auditado a Excel con fórmulas vivas y plantillas listas para importar en Siigo.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-teal-soft/30 border border-teal/20">
                  <ShieldCheck className="size-5 shrink-0 mt-0.5 text-teal" />
                  <div>
                    <strong className="block text-ink font-semibold">Seguridad y Privacidad Garantizada:</strong>
                    <span className="text-ink-muted text-xs">
                      El procesamiento se realiza 100% en el navegador (Web Client-Side). Ningún dato contable ni documento tributario se sube a servidores externos.
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-bg-subtle border border-line">
                  <Building2 className="size-5 shrink-0 mt-0.5 text-ink-muted" />
                  <div>
                    <strong className="block text-ink font-semibold">Historial Multi-Empresa Automático:</strong>
                    <span className="text-ink-muted text-xs">
                      Cada conciliación queda respaldada en el historial local de su navegador, permitiendo alternar entre empresas o meses al instante.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer del Modal */}
        <div className="border-t border-line bg-bg-subtle/50 px-6 py-3.5 flex items-center justify-between">
          <span className="text-xs text-ink-subtle">
            TributoApp S.A.S. · Conciliación Electrónica Colombia
          </span>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-teal px-5 py-2 text-xs font-bold text-white hover:bg-teal-deep transition shadow-sm"
          >
            Entendido, ir a conciliar
          </button>
        </div>
      </div>
    </div>
  );
}
