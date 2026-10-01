import { useState, useMemo, useEffect } from "react";
import {
  X,
  FileText,
  Layers,
  Download,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Scale,
  Sparkles,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { formatMoneyExact, formatDate } from "@/lib/format";
import type { BankConciliacionRow } from "@/lib/conciliar-bancos";
import type { MovLine } from "@/lib/types";
import { exportAsientoAjusteBancario } from "@/lib/export-bancos-excel";
import { resolveVoucherFullEntry, type ResolvedVoucherLine } from "@/lib/voucher-entry-resolver";

interface Props {
  open: boolean;
  onClose: () => void;
  row: BankConciliacionRow | null;
  allMovLines: MovLine[];
  cuentaContable?: string;
  bancoNombre?: string;
  initialComprobante?: string;
}

export function AsientoContableModal({
  open,
  onClose,
  row,
  allMovLines,
  cuentaContable = "111005",
  bancoNombre = "Banco",
  initialComprobante,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [selectedCompTab, setSelectedCompTab] = useState<string>("");
  const [isMaximized, setIsMaximized] = useState(false);

  // Comprobante solicitado prioritario (pasado por prop o en row.itemLibros)
  const targetComp = useMemo(() => {
    return (initialComprobante || row?.itemLibros?.comprobante || "").trim();
  }, [initialComprobante, row?.itemLibros?.comprobante]);

  // Obtener lista de comprobantes asociados al movimiento
  const comprobantesList = useMemo(() => {
    if (!row) return [];
    if (row.itemsLibrosLote && row.itemsLibrosLote.length > 0) {
      const setComps = new Set<string>();
      row.itemsLibrosLote.forEach((it) => {
        if (it.comprobante) setComps.add(it.comprobante.trim());
      });
      return Array.from(setComps);
    }
    if (row.itemLibros?.comprobante) {
      return [row.itemLibros.comprobante.trim()];
    }
    return [];
  }, [row]);

  // Sincronizar comprobante seleccionado al abrir o cambiar de fila/comprobante
  useEffect(() => {
    if (open) {
      if (targetComp) {
        const exact = comprobantesList.find((c) => c === targetComp);
        const match = exact || comprobantesList.find((c) => c.toLowerCase() === targetComp.toLowerCase());
        setSelectedCompTab(match || targetComp);
      } else if (comprobantesList.length > 0) {
        setSelectedCompTab(comprobantesList[0]);
      }
    } else {
      setSelectedCompTab("");
    }
  }, [open, targetComp, comprobantesList]);

  // Comprobante actualmente activo
  const activeComprobante = useMemo(() => {
    if (selectedCompTab) {
      const exact = comprobantesList.find((c) => c === selectedCompTab);
      if (exact) return exact;
      const match = comprobantesList.find((c) => c.toLowerCase() === selectedCompTab.toLowerCase());
      if (match) return match;
      if (comprobantesList.length === 0) return selectedCompTab;
    }
    if (targetComp) {
      const exact = comprobantesList.find((c) => c === targetComp);
      if (exact) return exact;
      const match = comprobantesList.find((c) => c.toLowerCase() === targetComp.toLowerCase());
      if (match) return match;
      if (comprobantesList.length === 0) return targetComp;
    }
    return comprobantesList[0] || "";
  }, [selectedCompTab, targetComp, comprobantesList]);

  // Obtener la línea de referencia actual para el comprobante
  const currentLine = useMemo(() => {
    if (!activeComprobante) return row?.itemLibros || null;

    if (row?.itemLibros && (row.itemLibros.comprobante || "").trim().toLowerCase() === activeComprobante.toLowerCase()) {
      return row.itemLibros;
    }
    if (row?.itemsLibrosLote && row.itemsLibrosLote.length > 0) {
      const matchInLote = row.itemsLibrosLote.find(
        (m) => (m.comprobante || "").trim().toLowerCase() === activeComprobante.toLowerCase()
      );
      if (matchInLote) return matchInLote;
      return row.itemsLibrosLote[0];
    }
    return row?.itemLibros || null;
  }, [row, activeComprobante]);

  // Resolver comprobante contable completo y su contrapartida (con partida doble cuadrada)
  const resolvedVoucher = useMemo(() => {
    return resolveVoucherFullEntry(activeComprobante, currentLine, allMovLines, row);
  }, [activeComprobante, currentLine, allMovLines, row]);

  const displayLines: ResolvedVoucherLine[] = resolvedVoucher.lines;
  const totalDebitos = resolvedVoucher.totalDebito;
  const totalCreditos = resolvedVoucher.totalCredito;
  const balanceDiferencia = Math.abs(totalDebitos - totalCreditos);
  const isPartidaDobleCuadrada = resolvedVoucher.isPartidaDobleCuadrada;

  if (!open || !row) return null;

  const isBankNote =
    row.estado === "nota_debito_banco" || row.estado === "nota_credito_banco";

  const handleCopySuggestion = () => {
    let text = "";
    if (isBankNote) {
      const ctaSugerida = row.esGmf
        ? "51159501 (GMF 4x1000)"
        : row.esComision
        ? "53051501 (Comisiones Bancarias)"
        : row.esRendimiento
        ? "42100502 (Rendimientos Financieros)"
        : "53059501 (Gastos Bancarios)";
      text = `Asiento Sugerido para: ${row.descripcion} (${formatMoneyExact(row.montoBanco)})\n` +
        `Débito: ${row.estado === "nota_debito_banco" ? ctaSugerida : cuentaContable} - ${formatMoneyExact(row.montoBanco)}\n` +
        `Crédito: ${row.estado === "nota_debito_banco" ? cuentaContable : ctaSugerida} - ${formatMoneyExact(row.montoBanco)}`;
    } else {
      text = `Comprobante: ${activeComprobante}\n` +
        displayLines
          .map(
            (l) =>
              `${l.cuenta} ${l.cuentaNombre} | ${l.nombre} | Deb: ${formatMoneyExact(l.debito)} | Cred: ${formatMoneyExact(l.credito)}`
          )
          .join("\n");
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 ${
        isMaximized ? "p-1 sm:p-2" : "p-2 sm:p-4 lg:p-6"
      }`}
    >
      <div
        className={`relative w-full overflow-hidden rounded-2xl border border-line bg-bg-surface shadow-2xl flex flex-col transition-all duration-200 ${
          isMaximized
            ? "h-[98vh] max-w-[99vw]"
            : "max-h-[95vh] max-w-[96vw] xl:max-w-7xl 2xl:max-w-[1550px]"
        }`}
      >
        {/* Encabezado del Modal */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5 sm:px-6 sm:py-4 bg-bg-elevated shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isBankNote
                  ? "bg-amber-500/10 text-amber-600"
                  : "bg-teal/10 text-teal"
              }`}
            >
              {isBankNote ? <Sparkles className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-ink truncate">
                  {isBankNote
                    ? "Asiento Contable Sugerido (Partida Pendiente en Libros)"
                    : `Auditoría del Asiento Contable · Comprobante ${activeComprobante || row.referencia || "Contable"}`}
                </h2>
                {isBankNote && (
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 shrink-0">
                    Falta en Libros
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-muted truncate">
                {isBankNote
                  ? "Instrucción de causación y registro contable para cuadrar el libro auxiliar con el extracto"
                  : "Desglose completo de todas las cuentas débitos y créditos registradas en este comprobante"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopySuggestion}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-surface px-2.5 py-1.5 sm:px-3 text-xs font-semibold text-ink hover:text-teal hover:border-teal transition cursor-pointer shadow-2xs"
              title="Copiar detalle del asiento contable"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              <span className="hidden sm:inline">{copied ? "¡Copiado!" : "Copiar"}</span>
            </button>

            {isBankNote && (
              <button
                type="button"
                onClick={() => exportAsientoAjusteBancario([row], bancoNombre, cuentaContable)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-2.5 py-1.5 sm:px-3 text-xs font-semibold text-white hover:bg-teal-deep transition shadow-xs cursor-pointer"
              >
                <Download className="size-3.5" />
                <span className="hidden sm:inline">Descargar Asiento (.xlsx)</span>
              </button>
            )}

            {/* Botón de Maximizar / Restaurar Pantalla Completa */}
            <button
              type="button"
              onClick={() => setIsMaximized((prev) => !prev)}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink transition cursor-pointer"
              title={isMaximized ? "Restaurar tamaño normal" : "Maximizar pantalla completa"}
            >
              {isMaximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-ink-muted hover:bg-bg-subtle hover:text-ink transition cursor-pointer"
              title="Cerrar modal"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Selector de Comprobantes si es un Lote ACH */}
        {comprobantesList.length > 1 && (
          <div className="border-b border-line bg-bg-subtle/50 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2 text-xs shrink-0">
            <span className="text-[11px] font-bold text-ink-muted shrink-0 flex items-center gap-1.5">
              <Layers className="size-3.5 text-purple-600" />
              Comprobantes en Lote ({comprobantesList.length}):
            </span>
            <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto py-0.5 scrollbar-thin [scrollbar-width:thin] [scrollbar-color:rgba(147,51,234,0.3)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-purple-500/30 hover:[&::-webkit-scrollbar-thumb]:bg-purple-500/60 [&::-webkit-scrollbar-thumb]:rounded-full">
              {comprobantesList.map((comp) => (
                <button
                  key={comp}
                  type="button"
                  onClick={() => setSelectedCompTab(comp)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer whitespace-nowrap shrink-0 leading-normal inline-flex items-center gap-1.5 ${
                    activeComprobante === comp
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-bg-surface text-ink-muted hover:text-ink hover:border-purple-300 border border-line"
                  }`}
                >
                  <FileText className="size-3 shrink-0 opacity-70" />
                  <span>{comp}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contenido Central */}
        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 text-ink flex-1">
          {/* Tarjeta de Metadatos del Movimiento Bancario */}
          <div className="rounded-xl border border-line bg-bg-subtle/40 p-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <span className="text-ink-muted block text-[11px]">Fecha Movimiento:</span>
                <span className="font-mono font-bold text-ink">{formatDate(row.fecha)}</span>
              </div>
              <div>
                <span className="text-ink-muted block text-[11px]">Monto en Extracto:</span>
                <span className="font-mono font-bold text-ink">
                  {row.montoBanco > 0 ? formatMoneyExact(row.montoBanco) : "—"}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block text-[11px]">Monto en Libros:</span>
                <span className="font-mono font-bold text-teal">
                  {row.montoLibros > 0 ? formatMoneyExact(row.montoLibros) : "—"}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block text-[11px]">Referencia / Folio:</span>
                <span className="font-mono font-bold text-ink">{row.referencia || "—"}</span>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 pt-2 border-t border-line/60">
                <span className="text-ink-muted block text-[11px]">Descripción del Movimiento:</span>
                <span className="font-semibold text-ink">{row.descripcion}</span>
              </div>
            </div>
          </div>

          {/* CASO A: PARTIDA PENDIENTE EN BANCOS (NOTA DÉBITO O CRÉDITO) */}
          {isBankNote ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-300 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-xs space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-950 dark:text-amber-200">
                  <AlertCircle className="size-4 text-amber-600" />
                  <span>Diagnóstico Contable y Causa de la Diferencia</span>
                </div>
                <p className="text-amber-900 dark:text-amber-300 leading-relaxed">
                  {row.nota}
                </p>
                <div className="text-[11px] text-amber-800 dark:text-amber-400 font-medium">
                  Para que el libro contable de tesorería cuadre al 100% con el saldo de {bancoNombre}, debes causar este comprobante de ajuste en tu software contable.
                </div>
              </div>

              {/* Asiento Sugerido Estructurado */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-ink flex items-center gap-1.5">
                    <Scale className="size-3.5 text-teal" />
                    Asiento Contable Sugerido (Partida Doble NIIF)
                  </h3>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                    Partida Doble Balanceada
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-line bg-bg-surface scrollbar-thin [scrollbar-width:thin] [scrollbar-color:rgba(217,119,6,0.3)_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-bg-subtle/50 [&::-webkit-scrollbar-thumb]:bg-amber-500/30 hover:[&::-webkit-scrollbar-thumb]:bg-amber-500/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-bg-subtle text-ink-muted font-bold border-b border-line">
                      <tr>
                        <th className="px-3.5 py-2.5 w-32 shrink-0">Código PUC</th>
                        <th className="px-3.5 py-2.5 min-w-[160px]">Nombre de la Cuenta</th>
                        <th className="px-3.5 py-2.5 min-w-[160px]">Tercero / Razón Social</th>
                        <th className="px-3.5 py-2.5 min-w-[200px]">Concepto Contable</th>
                        <th className="px-3.5 py-2.5 text-right whitespace-nowrap w-36">Débito (COP)</th>
                        <th className="px-3.5 py-2.5 text-right whitespace-nowrap w-36">Crédito (COP)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {row.estado === "nota_debito_banco" ? (
                        <>
                          <tr className="hover:bg-bg-subtle/50 transition">
                            <td className="px-3.5 py-2.5 font-mono font-bold text-teal">
                              {row.esGmf ? "51159501" : row.esComision ? "53051501" : "53059501"}
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-ink">
                              {row.esGmf
                                ? "Gravamen a los Movimientos Financieros (GMF 4x1000)"
                                : row.esComision
                                ? "Comisiones y Servicios Bancarios"
                                : "Gastos Bancarios y Financieros Varios"}
                            </td>
                            <td className="px-3.5 py-2.5 text-ink-muted">
                              {row.esGmf ? "DIAN - DIRECCION DE IMPUESTOS" : bancoNombre}
                            </td>
                            <td className="px-3.5 py-2.5 text-ink-muted">{row.descripcion}</td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-right text-ink whitespace-nowrap">
                              {formatMoneyExact(row.montoBanco)}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-right text-ink-subtle whitespace-nowrap">—</td>
                          </tr>
                          <tr className="hover:bg-bg-subtle/50 transition">
                            <td className="px-3.5 py-2.5 font-mono font-bold text-teal">{cuentaContable}</td>
                            <td className="px-3.5 py-2.5 font-medium text-ink">
                              Bancos Moneda Nacional ({bancoNombre})
                            </td>
                            <td className="px-3.5 py-2.5 text-ink-muted">{bancoNombre}</td>
                            <td className="px-3.5 py-2.5 text-ink-muted">Cargo bancario extracto</td>
                            <td className="px-3.5 py-2.5 font-mono text-right text-ink-subtle whitespace-nowrap">—</td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-right text-ink whitespace-nowrap">
                              {formatMoneyExact(row.montoBanco)}
                            </td>
                          </tr>
                        </>
                      ) : (
                        <>
                          <tr className="hover:bg-bg-subtle/50 transition">
                            <td className="px-3.5 py-2.5 font-mono font-bold text-teal">{cuentaContable}</td>
                            <td className="px-3.5 py-2.5 font-medium text-ink">
                              Bancos Moneda Nacional ({bancoNombre})
                            </td>
                            <td className="px-3.5 py-2.5 text-ink-muted">{bancoNombre}</td>
                            <td className="px-3.5 py-2.5 text-ink-muted">Abono bancario extracto</td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-right text-ink whitespace-nowrap">
                              {formatMoneyExact(row.montoBanco)}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-right text-ink-subtle whitespace-nowrap">—</td>
                          </tr>
                          <tr className="hover:bg-bg-subtle/50 transition">
                            <td className="px-3.5 py-2.5 font-mono font-bold text-teal">
                              {row.esRendimiento ? "42100502" : "13050501"}
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-ink">
                              {row.esRendimiento
                                ? "Intereses y Rendimientos Financieros Cuentas"
                                : "Clientes Nacionales / Anticipos Pendientes"}
                            </td>
                            <td className="px-3.5 py-2.5 text-ink-muted">
                              {row.esRendimiento ? bancoNombre : "Clientes Varios"}
                            </td>
                            <td className="px-3.5 py-2.5 text-ink-muted">{row.descripcion}</td>
                            <td className="px-3.5 py-2.5 font-mono text-right text-ink-subtle whitespace-nowrap">—</td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-right text-ink whitespace-nowrap">
                              {formatMoneyExact(row.montoBanco)}
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                    <tfoot className="bg-bg-subtle/80 font-bold border-t border-line">
                      <tr>
                        <td colSpan={4} className="px-3.5 py-2 text-right text-ink-muted whitespace-nowrap">
                          Sumas Iguales:
                        </td>
                        <td className="px-3.5 py-2 font-mono text-right text-ink font-bold whitespace-nowrap">
                          {formatMoneyExact(row.montoBanco)}
                        </td>
                        <td className="px-3.5 py-2 font-mono text-right text-ink font-bold whitespace-nowrap">
                          {formatMoneyExact(row.montoBanco)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            /* CASO B: ASIENTO CONTABLE REGISTRADO EN LIBROS (CONCILIADO O EN TRÁNSITO) */
            <div className="space-y-4">
              {/* Resumen Ejecutivo de la Contrapartida Contable */}
              {resolvedVoucher.contrapartidaResumen && (
                <div className="rounded-xl bg-teal-50/80 dark:bg-teal-950/40 p-3.5 border border-teal-200 dark:border-teal-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-start sm:items-center gap-2.5 text-teal-950 dark:text-teal-200">
                    <span className="rounded-lg bg-teal text-white p-1 shrink-0 mt-0.5 sm:mt-0 shadow-2xs">
                      <Scale className="size-4" />
                    </span>
                    <div>
                      <div className="font-extrabold text-xs text-teal-950 dark:text-teal-100">
                        {resolvedVoucher.contrapartidaResumen.descripcionCruce}
                      </div>
                      <p className="text-[11px] text-teal-800 dark:text-teal-300">
                        {resolvedVoucher.contrapartidaResumen.esDeducida
                          ? "Contrapartida contable vinculada automáticamente a partir del beneficiario, concepto y cruce del comprobante."
                          : "Líneas de contrapartida verificadas directamente en el libro auxiliar de la contabilidad."}
                      </p>
                    </div>
                  </div>
                  {isPartidaDobleCuadrada && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-300 px-3 py-1 text-xs font-bold shrink-0 self-start sm:self-auto shadow-2xs">
                      <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      Partida Doble Cuadrada ({formatMoneyExact(totalDebitos)})
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black uppercase tracking-wider text-ink">
                    Líneas Contables del Comprobante ({displayLines.length} registros)
                  </h3>
                  {row.estado === "partida_en_transito_libros" ? (
                    <span className="rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.5 text-[10px] font-bold">
                      Partida en Tránsito (En Libros pero no en Banco)
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                      Conciliado contra Extracto
                    </span>
                  )}
                </div>

                {isPartidaDobleCuadrada && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    Sumas Iguales Débitos = Créditos
                  </span>
                )}
              </div>

              {displayLines.length === 0 ? (
                <div className="rounded-xl border border-line bg-bg-subtle/50 p-6 text-center text-xs text-ink-muted">
                  No se encontraron líneas auxiliares adicionales para el comprobante {activeComprobante}.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line bg-bg-surface scrollbar-thin [scrollbar-width:thin] [scrollbar-color:rgba(15,118,110,0.3)_transparent] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-bg-subtle/50 [&::-webkit-scrollbar-thumb]:bg-teal/30 hover:[&::-webkit-scrollbar-thumb]:bg-teal/60 [&::-webkit-scrollbar-thumb]:rounded-full">
                  <table className="w-full min-w-[850px] text-left text-xs">
                    <thead className="bg-bg-subtle text-ink-muted font-bold border-b border-line">
                      <tr>
                        <th className="px-3.5 py-2.5 w-32 shrink-0">Cuenta PUC</th>
                        <th className="px-3.5 py-2.5 min-w-[150px]">Nombre Cuenta</th>
                        <th className="px-3.5 py-2.5 min-w-[160px]">Tercero / NIT</th>
                        <th className="px-3.5 py-2.5 min-w-[200px]">Glosa / Concepto</th>
                        <th className="px-3.5 py-2.5 w-36">Cruce / Ref</th>
                        <th className="px-3.5 py-2.5 text-right whitespace-nowrap w-36">Débito (COP)</th>
                        <th className="px-3.5 py-2.5 text-right whitespace-nowrap w-36">Crédito (COP)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {displayLines.map((line, idx) => {
                        const isTreasury = /^(11|1250)/.test(line.cuenta.trim());
                        return (
                          <tr
                            key={[line.cuenta, line.debito, line.credito, idx].join("-")}
                            className={`transition hover:bg-bg-subtle/50 ${
                              isTreasury ? "bg-teal-50/40 dark:bg-teal-950/20 font-semibold" : ""
                            }`}
                          >
                            <td className="px-3.5 py-2.5 font-mono text-ink whitespace-nowrap">
                              <span className={isTreasury ? "text-teal font-bold" : ""}>
                                {line.cuenta}
                              </span>
                              {line.esContrapartidaDeducida && (
                                <span className="block text-[10px] text-teal font-medium">
                                  (Contrapartida Cruce)
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-ink max-w-64 truncate" title={line.cuentaNombre}>
                              {line.cuentaNombre}
                            </td>
                            <td className="px-3.5 py-2.5 text-ink max-w-64 truncate" title={line.nombre}>
                              <span>{line.nombre || "—"}</span>
                              {line.nit && (
                                <span className="block text-[10px] text-ink-subtle font-mono">
                                  NIT: {line.nit}
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-ink-muted max-w-80 truncate" title={line.descripcion}>
                              {line.descripcion}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-ink-subtle whitespace-nowrap">
                              {line.cruce || line.referencia || "—"}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-right text-ink whitespace-nowrap w-36">
                              {line.debito > 0 ? formatMoneyExact(line.debito) : "—"}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-right text-ink whitespace-nowrap w-36">
                              {line.credito > 0 ? formatMoneyExact(line.credito) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-bg-subtle/80 font-bold border-t border-line text-xs">
                      <tr>
                        <td colSpan={5} className="px-3.5 py-2.5 text-right text-ink-muted whitespace-nowrap">
                          Sumas Iguales del Comprobante:
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-right text-ink whitespace-nowrap font-bold">
                          {formatMoneyExact(totalDebitos)}
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-right text-ink whitespace-nowrap font-bold">
                          {formatMoneyExact(totalCreditos)}
                        </td>
                      </tr>
                      {balanceDiferencia > 0.05 && (
                        <tr className="bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200">
                          <td colSpan={5} className="px-3.5 py-1.5 text-right text-[11px] whitespace-nowrap">
                            Diferencia entre débitos y créditos en este extracto de libro:
                          </td>
                          <td colSpan={2} className="px-3.5 py-1.5 font-mono text-right text-[11px] font-bold whitespace-nowrap">
                            {formatMoneyExact(balanceDiferencia)}
                          </td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
