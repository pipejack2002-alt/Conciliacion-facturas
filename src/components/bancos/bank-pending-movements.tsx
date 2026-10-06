import { memo, useMemo, useState } from "react";
import {
  ClipboardCheck,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  Sparkles,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { formatMoneyExact, formatDate } from "@/lib/format";
import type { BankConciliacionRow, BankConciliacionSummary } from "@/lib/conciliar-bancos";
import type { MovLine } from "@/lib/types";
import { exportAsientoAjusteBancario } from "@/lib/export-bancos-excel";
import { AsientoContableModal } from "./asiento-contable-modal";
import { cn } from "@/lib/cn";
import * as XLSX from "xlsx";

export type BankPendingSortField =
  | "fecha"
  | "origen"
  | "naturaleza"
  | "descripcion"
  | "referencia"
  | "valor"
  | "asiento";

export type BankPendingSortDirection = "asc" | "desc";

interface BankPendingMovementsProps {
  rows: BankConciliacionRow[];
  summary: BankConciliacionSummary;
  cuentaContable?: string;
  bancoNombre?: string;
  allMovLines?: MovLine[];
}

export const BankPendingMovements = memo(function BankPendingMovements({
  rows,
  summary,
  cuentaContable,
  bancoNombre = "Banco",
  allMovLines = [],
}: BankPendingMovementsProps) {
  const [modalRow, setModalRow] = useState<BankConciliacionRow | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "rendimientos" | "abonos" | "cargos" | "transito">("todos");
  const [sortField, setSortField] = useState<BankPendingSortField>("fecha");
  const [sortDirection, setSortDirection] = useState<BankPendingSortDirection>("desc");

  // Filtrar exclusivamente partidas pendientes de registro en libros o partidas en tránsito
  const pendingRows = useMemo(() => {
    return rows.filter(
      (r) =>
        r.estado === "nota_credito_banco" ||
        r.estado === "nota_debito_banco" ||
        r.estado === "partida_en_transito_libros"
    );
  }, [rows]);

  const rendimientosPendientes = useMemo(() => {
    return pendingRows.filter((r) => r.estado === "nota_credito_banco" && r.esRendimiento);
  }, [pendingRows]);

  const otrosAbonosPendientes = useMemo(() => {
    return pendingRows.filter((r) => r.estado === "nota_credito_banco" && !r.esRendimiento);
  }, [pendingRows]);

  const cargosPendientes = useMemo(() => {
    return pendingRows.filter((r) => r.estado === "nota_debito_banco");
  }, [pendingRows]);

  const chequesTransito = useMemo(() => {
    return pendingRows.filter((r) => r.estado === "partida_en_transito_libros" && r.tipo === "retiro");
  }, [pendingRows]);

  const consignacionesTransito = useMemo(() => {
    return pendingRows.filter((r) => r.estado === "partida_en_transito_libros" && r.tipo === "consignacion");
  }, [pendingRows]);

  const displayedRows = useMemo(() => {
    if (filtroTipo === "rendimientos") return rendimientosPendientes;
    if (filtroTipo === "abonos") return otrosAbonosPendientes;
    if (filtroTipo === "cargos") return cargosPendientes;
    if (filtroTipo === "transito") return [...chequesTransito, ...consignacionesTransito];
    return pendingRows;
  }, [filtroTipo, pendingRows, rendimientosPendientes, otrosAbonosPendientes, cargosPendientes, chequesTransito, consignacionesTransito]);

  const handleToggleSort = (field: BankPendingSortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      // Para valor exacto, primer clic organiza de menor a mayor (asc); para fecha desc; para otros asc
      setSortDirection(field === "valor" ? "asc" : field === "fecha" ? "desc" : "asc");
    }
  };

  const handleSelectSort = (field: BankPendingSortField) => {
    setSortField(field);
    setSortDirection(field === "valor" ? "asc" : field === "fecha" ? "desc" : "asc");
  };

  // Ordenamiento interactivo de las partidas pendientes
  const sortedDisplayedRows = useMemo(() => {
    const list = [...displayedRows];

    const getNaturalezaText = (r: BankConciliacionRow) => {
      if (r.estado === "nota_credito_banco") {
        return r.esRendimiento ? "Rendimiento Financiero" : "Nota Crédito (Abono)";
      }
      if (r.estado === "nota_debito_banco") {
        if (r.esGmf) return "Gravamen al Movimiento Financiero GMF";
        if (r.esComision) return "Comisión Bancaria";
        return "Nota Débito (Cargo)";
      }
      return r.tipo === "retiro" ? "Cheque / Giro en Tránsito" : "Consignación en Tránsito";
    };

    const getAsientoText = (r: BankConciliacionRow) => {
      if (r.estado === "nota_credito_banco") {
        return r.esRendimiento ? "125035 Rendimientos 421005" : "111005 Bancos 130505 Clientes";
      }
      if (r.estado === "nota_debito_banco") {
        if (r.esGmf) return "511595 GMF 111005 Bancos";
        if (r.esComision) return "530515 Comisiones 111005 Bancos";
        return "530595 Gastos Bancarios 2205 Proveedores 111005 Bancos";
      }
      return "Ya registrado en libros";
    };

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "fecha": {
          cmp = (a.fecha || "").localeCompare(b.fecha || "");
          break;
        }
        case "origen": {
          const oA = a.estado === "partida_en_transito_libros" ? "Libros Contables" : "Extracto Bancario";
          const oB = b.estado === "partida_en_transito_libros" ? "Libros Contables" : "Extracto Bancario";
          cmp = oA.localeCompare(oB, "es");
          break;
        }
        case "naturaleza": {
          cmp = getNaturalezaText(a).localeCompare(getNaturalezaText(b), "es");
          break;
        }
        case "descripcion": {
          cmp = (a.descripcion || "").localeCompare(b.descripcion || "", "es", { sensitivity: "base" });
          break;
        }
        case "referencia": {
          cmp = (a.referencia || "").localeCompare(b.referencia || "", "es", { numeric: true, sensitivity: "base" });
          break;
        }
        case "valor": {
          const valA = a.montoBanco > 0 ? a.montoBanco : a.montoLibros;
          const valB = b.montoBanco > 0 ? b.montoBanco : b.montoLibros;
          cmp = valA - valB;
          break;
        }
        case "asiento": {
          cmp = getAsientoText(a).localeCompare(getAsientoText(b), "es");
          break;
        }
        default:
          cmp = 0;
      }

      if (cmp === 0) {
        cmp = (b.montoBanco || 0) - (a.montoBanco || 0);
      }

      return sortDirection === "asc" ? cmp : -cmp;
    });

    return list;
  }, [displayedRows, sortField, sortDirection]);

  function handleExportPendingExcel() {
    if (pendingRows.length === 0) return;

    const data = pendingRows.map((r, idx) => {
      let origen = "Extracto Bancario";
      let naturaleza = "Nota Crédito (Abono)";
      let efecto = "Suma al saldo de libros (+)";
      let asientoDebito = "111005 (Bancos)";
      let asientoCredito = "130505 (Clientes)";

      if (r.estado === "nota_credito_banco") {
        if (r.esRendimiento) {
          naturaleza = "Rendimientos Financieros";
          asientoDebito = cuentaContable || "125035 / 111005 (Bancos/Fondos)";
          asientoCredito = "42100502 (Intereses y Rendimientos Financieros)";
        } else {
          naturaleza = "Abono / Transferencia Bancaria no causada";
          asientoDebito = cuentaContable || "111005 (Bancos)";
          asientoCredito = "130505 (Clientes / Anticipos)";
        }
      } else if (r.estado === "nota_debito_banco") {
        efecto = "Resta al saldo de libros (-)";
        if (r.esGmf) {
          naturaleza = "Gravamen al Movimiento Financiero (GMF 4x1000)";
          asientoDebito = "51159501 (GMF Deducible) / 51159502 (No Deducible)";
          asientoCredito = cuentaContable || "111005 (Bancos)";
        } else if (r.esComision) {
          naturaleza = "Comisiones y Gastos Bancarios con IVA";
          asientoDebito = "530515 (Comisiones) + 2408 (IVA Descontable)";
          asientoCredito = cuentaContable || "111005 (Bancos)";
        } else {
          naturaleza = "Cargo bancario no registrado";
          asientoDebito = "530595 (Otros Gastos Financieros) / 2205 (Proveedores)";
          asientoCredito = cuentaContable || "111005 (Bancos)";
        }
      } else if (r.estado === "partida_en_transito_libros") {
        origen = "Libros Contables";
        if (r.tipo === "retiro") {
          naturaleza = "Cheque / Giro en Tránsito";
          efecto = "Suma al conciliar extracto (+)";
          asientoDebito = "Ya registrado en libros";
          asientoCredito = "Pendiente cobro en banco";
        } else {
          naturaleza = "Consignación en Tránsito";
          efecto = "Resta al conciliar extracto (-)";
          asientoDebito = "Ya registrado en libros";
          asientoCredito = "Pendiente canje en banco";
        }
      }

      const valor = r.montoBanco > 0 ? r.montoBanco : r.montoLibros;

      return {
        "Ítem": idx + 1,
        "Fecha": r.fecha,
        "Origen": origen,
        "Naturaleza": naturaleza,
        "Descripción del Movimiento": r.descripcion,
        "Referencia / Documento": r.referencia || "—",
        "Valor": valor,
        "Efecto en Conciliación": efecto,
        "Cuenta Débito Sugerida": asientoDebito,
        "Cuenta Crédito Sugerida": asientoCredito,
        "Nota Explicativa": r.nota,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Partidas Pendientes");
    XLSX.writeFile(wb, `Partidas_Pendientes_Conciliacion_${bancoNombre || "Bancos"}.xlsx`);
  }

  return (
    <div className="rounded-2xl border border-line bg-bg-surface p-5 shadow-xs space-y-4">
      {/* Encabezado de la Sección */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-line">
        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-teal-soft/60 p-2.5 text-teal">
            <ClipboardCheck className="size-5" />
          </span>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-ink flex items-center gap-2">
              Movimientos Pendientes de Registro Contable (Partidas Conciliatorias)
              <span className="rounded-full bg-teal-soft/80 text-teal-deep dark:text-teal px-2 py-0.5 text-xs font-mono font-bold">
                {pendingRows.length} partidas
              </span>
            </h3>
            <p className="text-xs text-ink-muted">
              Partidas del extracto pendientes de causar en contabilidad o cheques/consignaciones en tránsito que justifican la diferencia.
            </p>
          </div>
        </div>

        {pendingRows.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {(cargosPendientes.length > 0 || rendimientosPendientes.length > 0) && (
              <button
                type="button"
                onClick={() => exportAsientoAjusteBancario(rows, bancoNombre, cuentaContable)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-teal/40 bg-teal-soft/60 px-3 py-2 text-xs font-bold text-teal hover:bg-teal hover:text-white transition shadow-2xs cursor-pointer whitespace-nowrap"
                title="Descargar comprobante de diario listo para importar en Siigo / World Office / Helisa"
              >
                <FileText className="size-3.5" />
                <span>Asiento ERP (.xlsx)</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportPendingExcel}
              className="inline-flex items-center gap-2 rounded-xl bg-teal px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-deep transition shadow-xs cursor-pointer whitespace-nowrap"
              title="Descargar plantilla Excel con la lista de causaciones y ajustes contables recomendados"
            >
              <Download className="size-3.5" />
              <span>Exportar Partidas Pendientes</span>
            </button>
          </div>
        )}
      </div>

      {/* Contenido Principal: Tabla Detallada o Mensaje de Cuadre */}
      {pendingRows.length === 0 ? (
        <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/50 dark:bg-emerald-950/30 p-6 text-center">
          <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
          <h4 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
            ¡Sin Partidas Pendientes de Registro!
          </h4>
          <p className="text-xs text-emerald-900/80 dark:text-emerald-300 mt-1 max-w-xl mx-auto">
            El 100% de los movimientos del extracto bancario y de los libros contables se encuentran plenamente conciliados. No se requieren comprobantes ni notas de ajuste contable para este periodo.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Barra de Filtros por Tipo de Partida y Cifras Resumen Compactas */}
          <div className="flex items-center justify-between flex-wrap gap-2.5">
            {/* Pestañas de Filtro */}
            <div className="inline-flex rounded-xl bg-bg-subtle p-0.5 border border-line text-xs font-bold flex-wrap gap-0.5">
              <button
                type="button"
                onClick={() => setFiltroTipo("todos")}
                className={cn(
                  "px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                  filtroTipo === "todos"
                    ? "bg-bg-surface text-ink shadow-2xs border border-line"
                    : "text-ink-muted hover:text-ink"
                )}
              >
                <span>Todas</span>
                <span className="font-mono text-[10px] rounded-full px-1.5 py-0.2 bg-bg-subtle border border-line">
                  {pendingRows.length}
                </span>
              </button>

              {rendimientosPendientes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroTipo("rendimientos")}
                  className={cn(
                    "px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                    filtroTipo === "rendimientos"
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 shadow-2xs border border-emerald-300 dark:border-emerald-700"
                      : "text-ink-muted hover:text-emerald-700 dark:hover:text-emerald-300"
                  )}
                >
                  <Sparkles className="size-3 text-emerald-600" />
                  <span>Rendimientos por Causar</span>
                  <span className="font-mono text-[10px] rounded-full px-1.5 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                    {rendimientosPendientes.length}
                  </span>
                </button>
              )}

              {otrosAbonosPendientes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroTipo("abonos")}
                  className={cn(
                    "px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                    filtroTipo === "abonos"
                      ? "bg-teal-soft/80 text-teal-deep dark:text-teal shadow-2xs border border-teal/40"
                      : "text-ink-muted hover:text-teal"
                  )}
                >
                  <ArrowUpRight className="size-3 text-teal" />
                  <span>Otros Abonos</span>
                  <span className="font-mono text-[10px] rounded-full px-1.5 py-0.2 bg-teal-soft text-teal-deep dark:text-teal">
                    {otrosAbonosPendientes.length}
                  </span>
                </button>
              )}

              {cargosPendientes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFiltroTipo("cargos")}
                  className={cn(
                    "px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                    filtroTipo === "cargos"
                      ? "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 shadow-2xs border border-rose-300 dark:border-rose-700"
                      : "text-ink-muted hover:text-rose-700 dark:hover:text-rose-300"
                  )}
                >
                  <ArrowDownLeft className="size-3 text-rose-600" />
                  <span>Cargos / GMF / Comisiones</span>
                  <span className="font-mono text-[10px] rounded-full px-1.5 py-0.2 bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                    {cargosPendientes.length}
                  </span>
                </button>
              )}

              {(chequesTransito.length > 0 || consignacionesTransito.length > 0) && (
                <button
                  type="button"
                  onClick={() => setFiltroTipo("transito")}
                  className={cn(
                    "px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1.5",
                    filtroTipo === "transito"
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 shadow-2xs border border-blue-300 dark:border-blue-700"
                      : "text-ink-muted hover:text-blue-700 dark:hover:text-blue-300"
                  )}
                >
                  <Clock className="size-3 text-blue-600" />
                  <span>En Tránsito</span>
                  <span className="font-mono text-[10px] rounded-full px-1.5 py-0.2 bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">
                    {chequesTransito.length + consignacionesTransito.length}
                  </span>
                </button>
              )}
            </div>

            {/* Badges de Cifras Resumen Compactas */}
            <div className="flex items-center gap-2 text-xs flex-wrap font-mono">
              {summary.notasCreditoNoRegistradas > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40 font-bold">
                  <span className="text-[10px] font-sans font-semibold">Abonos por Causar:</span>
                  +{formatMoneyExact(summary.notasCreditoNoRegistradas)}
                </span>
              )}
              {summary.notasDebitoNoRegistradas > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-300/40 font-bold">
                  <span className="text-[10px] font-sans font-semibold">Cargos por Registrar:</span>
                  -{formatMoneyExact(summary.notasDebitoNoRegistradas)}
                </span>
              )}
              {(summary.chequesEnTransito > 0 || summary.consignacionesEnTransito > 0) && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-bg-subtle text-ink border border-line font-bold">
                  <span className="text-[10px] font-sans font-semibold">En Tránsito:</span>
                  +{formatMoneyExact(summary.chequesEnTransito)} / -{formatMoneyExact(summary.consignacionesEnTransito)}
                </span>
              )}
            </div>
          </div>

          {/* Sub-barra de Conteo y Selector de Ordenamiento */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-ink-muted">
            <div className="flex items-center gap-2">
              <span>
                Mostrando <strong>{sortedDisplayedRows.length}</strong> de{" "}
                <strong>{pendingRows.length}</strong> partidas pendientes
              </span>
            </div>

            {/* Selector de ordenamiento interactivo (menor a mayor / asc / desc) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-ink-muted flex items-center gap-1">
                <ArrowUpDown className="size-3 text-teal" /> Organizar por:
              </span>
              <select
                value={sortField}
                onChange={(e) => handleSelectSort(e.target.value as BankPendingSortField)}
                className="rounded-lg border border-line bg-bg-surface px-2.5 py-1 text-xs font-semibold text-ink focus:outline-teal shadow-2xs cursor-pointer"
              >
                <option value="fecha">Fecha</option>
                <option value="origen">Origen</option>
                <option value="naturaleza">Naturaleza / Concepto</option>
                <option value="descripcion">Descripción</option>
                <option value="referencia">Referencia</option>
                <option value="valor">Valor Exacto</option>
                <option value="asiento">Asiento Contable Sugerido (PUC)</option>
              </select>
              <button
                type="button"
                onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg-surface hover:bg-bg-subtle px-2 py-1 text-xs font-bold text-ink cursor-pointer transition shadow-2xs"
                title={`Alternar dirección de orden (actual: ${sortDirection === "asc" ? "Menor a Mayor / Ascendente" : "Mayor a Menor / Descendente"})`}
              >
                {sortDirection === "asc" ? (
                  <>
                    <ArrowUp className="size-3 text-teal font-black" />
                    <span className="text-[10px] font-extrabold uppercase">Menor a Mayor (ASC)</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="size-3 text-teal font-black" />
                    <span className="text-[10px] font-extrabold uppercase">Mayor a Menor (DESC)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-line bg-bg-subtle text-ink-muted font-bold text-[11px] uppercase tracking-wider select-none">
                  {/* 1. Fecha */}
                  <th
                    onClick={() => handleToggleSort("fecha")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap"
                    title="Clic para ordenar por Fecha"
                  >
                    <div className="flex items-center gap-1">
                      <span>Fecha</span>
                      {sortField === "fecha" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>

                  {/* 2. Origen */}
                  <th
                    onClick={() => handleToggleSort("origen")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap"
                    title="Clic para ordenar por Origen"
                  >
                    <div className="flex items-center gap-1">
                      <span>Origen</span>
                      {sortField === "origen" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>

                  {/* 3. Naturaleza */}
                  <th
                    onClick={() => handleToggleSort("naturaleza")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap"
                    title="Clic para ordenar por Naturaleza / Concepto"
                  >
                    <div className="flex items-center gap-1">
                      <span>Naturaleza / Concepto</span>
                      {sortField === "naturaleza" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>

                  {/* 4. Descripción */}
                  <th
                    onClick={() => handleToggleSort("descripcion")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group"
                    title="Clic para ordenar por Descripción en Movimiento"
                  >
                    <div className="flex items-center gap-1">
                      <span>Descripción en Movimiento</span>
                      {sortField === "descripcion" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>

                  {/* 5. Referencia */}
                  <th
                    onClick={() => handleToggleSort("referencia")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap"
                    title="Clic para ordenar por Referencia"
                  >
                    <div className="flex items-center gap-1">
                      <span>Referencia</span>
                      {sortField === "referencia" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>

                  {/* 6. Valor Exacto */}
                  <th
                    onClick={() => handleToggleSort("valor")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group whitespace-nowrap text-right"
                    title="Clic para ordenar por Valor Exacto (de menor a mayor o viceversa)"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Valor Exacto</span>
                      {sortField === "valor" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>

                  {/* 7. Asiento Contable Sugerido (PUC) */}
                  <th
                    onClick={() => handleToggleSort("asiento")}
                    className="py-2.5 px-3 cursor-pointer hover:bg-bg-surface hover:text-ink transition group"
                    title="Clic para ordenar por Asiento Contable Sugerido (PUC)"
                  >
                    <div className="flex items-center gap-1">
                      <span>Asiento Contable Sugerido (PUC)</span>
                      {sortField === "asiento" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 text-teal" />
                        ) : (
                          <ArrowDown className="size-3.5 text-teal" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-25 group-hover:opacity-75 transition" />
                      )}
                    </div>
                  </th>

                  {/* 8. Acción */}
                  <th className="py-2.5 px-3 text-center whitespace-nowrap">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {sortedDisplayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-xs text-ink-muted">
                      No hay partidas pendientes en la categoría seleccionada.
                    </td>
                  </tr>
                ) : (
                  sortedDisplayedRows.map((r) => {
                const isNotaCredito = r.estado === "nota_credito_banco";
                const isNotaDebito = r.estado === "nota_debito_banco";
                const isTransito = r.estado === "partida_en_transito_libros";
                const valor = r.montoBanco > 0 ? r.montoBanco : r.montoLibros;

                return (
                  <tr
                    key={r.id}
                    className={cn(
                      "hover:bg-bg-subtle/50 transition",
                      isNotaCredito && "bg-emerald-50/20 dark:bg-emerald-950/10",
                      isNotaDebito && "bg-rose-50/20 dark:bg-rose-950/10"
                    )}
                  >
                    {/* 1. Fecha */}
                    <td className="py-2.5 px-3 font-mono font-bold text-ink whitespace-nowrap">
                      {formatDate(r.fecha)}
                    </td>

                    {/* 2. Origen */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {isTransito ? (
                        <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold">
                          Libros Contables
                        </span>
                      ) : (
                        <span className="rounded-full bg-teal-soft text-teal-deep dark:text-teal px-2 py-0.5 text-[10px] font-bold">
                          Extracto Bancario
                        </span>
                      )}
                    </td>

                    {/* 3. Naturaleza */}
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {isNotaCredito ? (
                        r.esRendimiento ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-extrabold">
                            <Sparkles className="size-3 text-emerald-600" />
                            Rendimiento Financiero
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-bold">
                            Nota Crédito (Abono)
                          </span>
                        )
                      ) : isNotaDebito ? (
                        r.esGmf ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">
                            GMF (4×1000)
                          </span>
                        ) : r.esComision ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold">
                            Comisión Bancaria
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300 px-2 py-0.5 text-[10px] font-bold">
                            Nota Débito (Cargo)
                          </span>
                        )
                      ) : r.tipo === "retiro" ? (
                        <span className="rounded-md bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-300 px-2 py-0.5 text-[10px] font-bold">
                          Cheque / Giro en Tránsito
                        </span>
                      ) : (
                        <span className="rounded-md bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 px-2 py-0.5 text-[10px] font-bold">
                          Consignación en Tránsito
                        </span>
                      )}
                    </td>

                    {/* 4. Descripción */}
                    <td className="py-2.5 px-3 max-w-[280px]">
                      <div className="font-semibold text-ink truncate" title={r.descripcion}>
                        {r.descripcion}
                      </div>
                      <div className="text-[10px] text-ink-muted truncate" title={r.nota}>
                        {r.nota}
                      </div>
                    </td>

                    {/* 5. Referencia */}
                    <td className="py-2.5 px-3 font-mono text-[11px] text-ink-muted whitespace-nowrap">
                      {r.referencia || "—"}
                    </td>

                    {/* 6. Valor Exacto */}
                    <td className="py-2.5 px-3 text-right font-mono font-black whitespace-nowrap">
                      <span
                        className={cn(
                          isNotaCredito && "text-emerald-700 dark:text-emerald-400",
                          isNotaDebito && "text-rose-700 dark:text-rose-400",
                          isTransito && "text-ink"
                        )}
                      >
                        {isNotaCredito ? "+" : isNotaDebito ? "-" : ""}
                        {formatMoneyExact(valor)}
                      </span>
                    </td>

                    {/* 7. Asiento Contable Sugerido */}
                    <td className="py-2.5 px-3 text-[11px]">
                      {isNotaCredito && r.esRendimiento && (
                        <div className="space-y-0.5">
                          <div className="font-bold text-teal flex items-center gap-1">
                            <span>Débito: {cuentaContable || "125035 / 111005"} (Bancos/Fondos)</span>
                          </div>
                          <div className="text-ink-muted">
                            Crédito: <strong className="font-mono text-ink">42100502</strong> (Intereses y Rendimientos Financieros)
                          </div>
                        </div>
                      )}

                      {isNotaCredito && !r.esRendimiento && (
                        <div className="space-y-0.5">
                          <div className="font-bold text-teal">
                            Débito: {cuentaContable || "111005"} (Bancos)
                          </div>
                          <div className="text-ink-muted">
                            Crédito: <strong className="font-mono text-ink">130505</strong> (Abono de Clientes / Deudores)
                          </div>
                        </div>
                      )}

                      {isNotaDebito && r.esGmf && (
                        <div className="space-y-0.5">
                          <div className="font-bold text-amber-700 dark:text-amber-400">
                            Débito: 51159501 (GMF 4×1000 Deducible)
                          </div>
                          <div className="text-ink-muted">
                            Crédito: {cuentaContable || "111005"} (Bancos)
                          </div>
                        </div>
                      )}

                      {isNotaDebito && r.esComision && (
                        <div className="space-y-0.5">
                          <div className="font-bold text-blue-700 dark:text-blue-400">
                            Débito: 530515 (Comisiones) + 2408 (IVA)
                          </div>
                          <div className="text-ink-muted">
                            Crédito: {cuentaContable || "111005"} (Bancos)
                          </div>
                        </div>
                      )}

                      {isNotaDebito && !r.esGmf && !r.esComision && (
                        <div className="space-y-0.5">
                          <div className="font-bold text-rose-700 dark:text-rose-400">
                            Débito: 530595 (Gastos Bancarios) / 2205 (Proveedores)
                          </div>
                          <div className="text-ink-muted">
                            Crédito: {cuentaContable || "111005"} (Bancos)
                          </div>
                        </div>
                      )}

                      {isTransito && (
                        <div className="text-ink-muted italic">
                          {r.tipo === "retiro"
                            ? "Ya causado en libros. Pendiente débito bancario al cobro del beneficiario."
                            : "Ya causado en libros. Pendiente canje y acreditación bancaria."}
                        </div>
                      )}
                    </td>

                    {/* 8. Acción: Ver Asiento Contable */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setModalRow(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-line bg-bg-surface px-2.5 py-1 text-xs font-semibold text-ink hover:text-teal hover:border-teal transition cursor-pointer shadow-2xs"
                        title={isTransito ? "Ver todas las cuentas del comprobante contable" : "Ver asiento sugerido para causar en el ERP"}
                      >
                        <FileText className="size-3.5 text-teal" />
                        <span>{isTransito ? "Ver Comprobante" : "Ver Asiento"}</span>
                      </button>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </div>
    )}

      {/* Modal de Asiento Contable */}
      {modalRow && (
        <AsientoContableModal
          open={Boolean(modalRow)}
          onClose={() => setModalRow(null)}
          row={modalRow}
          allMovLines={allMovLines}
          cuentaContable={cuentaContable}
          bancoNombre={bancoNombre}
          initialComprobante={modalRow.itemLibros?.comprobante}
        />
      )}
    </div>
  );
});
