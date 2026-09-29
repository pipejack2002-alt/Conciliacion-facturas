import { useState, useMemo } from "react";
import {
  Landmark,
  CheckCircle2,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  Download,
  Filter,
  Sparkles,
  Upload,
  Receipt,
  DollarSign,
  Layers,
} from "lucide-react";
import { formatMoney, formatMoneyExact, formatDate } from "@/lib/format";
import {
  conciliarBancos,
  extractLibroBancos,
  type BankExtractItem,
  type BankConciliacionResult,
  type EstadoConciliacionBancaria,
} from "@/lib/conciliar-bancos";
import type { MovLine } from "@/lib/types";
import { cn } from "@/lib/cn";
import * as XLSX from "xlsx";

// Extracto de demostración preconfigurado (Bancolombia) para cuando el usuario no sube archivo externo
const DEMO_EXTRACTO: BankExtractItem[] = [
  { id: "b1", fecha: "2026-07-02", descripcion: "ABONO TRANSFERENCIA CLIENTE FACT 4012", referencia: "TRANS-4012", debito: 0, credito: 12500000 },
  { id: "b2", fecha: "2026-07-05", descripcion: "PAGO PROVEEDOR SUMINISTROS TRANS-8842", referencia: "TRANS-8842", debito: 4500000, credito: 0 },
  { id: "b3", fecha: "2026-07-15", descripcion: "GRAVAMEN MOVIMIENTO FINANCIERO GMF 4X1000", referencia: "GMF-0715", debito: 18000, credito: 0 },
  { id: "b4", fecha: "2026-07-20", descripcion: "PAGO ARRENDAMIENTO OFICINA CH-5510", referencia: "5510", debito: 3200000, credito: 0 },
  { id: "b5", fecha: "2026-07-31", descripcion: "CUOTA DE MANEJO Y COMISION TRANSACCIONAL", referencia: "COM-0731", debito: 68500, credito: 0 },
  { id: "b6", fecha: "2026-07-31", descripcion: "RENDIMIENTO FINANCIERO CUENTA DE AHORROS", referencia: "REND-0731", debito: 0, credito: 24350 },
];

export function ConciliacionBancariaView({ movLines }: { movLines: MovLine[] }) {
  const [extractoItems, setExtractoItems] = useState<BankExtractItem[]>(DEMO_EXTRACTO);
  const [cuentaSeleccionada, setCuentaSeleccionada] = useState<string>("todas");
  const [tabFilter, setTabFilter] = useState<"todas" | "conciliado" | "banco_pend" | "transito">("todas");
  const [saldoInicialExtracto, setSaldoInicialExtracto] = useState<number>(15000000);
  const [saldoInicialLibros, setSaldoInicialLibros] = useState<number>(15000000);

  // Filtrar movimientos de libros por cuentas de bancos (1110 / 1120 / 1105)
  const librosBancos = useMemo(() => {
    return extractLibroBancos(
      movLines,
      cuentaSeleccionada === "todas" ? undefined : cuentaSeleccionada
    );
  }, [movLines, cuentaSeleccionada]);

  // Si no hay libros en la sesión actual, generar movimientos espejo de muestra para demostración
  const librosEfectivos = useMemo(() => {
    if (librosBancos.length > 0) return librosBancos;
    return [
      {
        cuenta: "11100501",
        cuentaNombre: "BANCOLOMBIA CORRIENTE",
        comprobante: "RC 001 4012",
        fecha: "2026-07-02",
        nit: "900555666",
        nombre: "CLIENTE COMERCIAL S.A.S.",
        descripcion: "ABONO TRANSFERENCIA CLIENTE FACT 4012",
        cruce: "TRANS-4012",
        debito: 12500000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "11100501",
        cuentaNombre: "BANCOLOMBIA CORRIENTE",
        comprobante: "EG 001 8842",
        fecha: "2026-07-05",
        nit: "900123456",
        nombre: "PROVEEDOR INDUSTRIAL S.A.S.",
        descripcion: "PAGO PROVEEDOR SUMINISTROS TRANS-8842",
        cruce: "TRANS-8842",
        debito: 0,
        credito: 4500000,
        observacion: "",
      },
      {
        cuenta: "11100501",
        cuentaNombre: "BANCOLOMBIA CORRIENTE",
        comprobante: "EG 001 5510",
        fecha: "2026-07-20",
        nit: "800111222",
        nombre: "INMOBILIARIA DEL VALLE",
        descripcion: "PAGO ARRENDAMIENTO OFICINA CH-5510",
        cruce: "5510",
        debito: 0,
        credito: 3200000,
        observacion: "",
      },
      {
        cuenta: "11100501",
        cuentaNombre: "BANCOLOMBIA CORRIENTE",
        comprobante: "EG 001 9912",
        fecha: "2026-07-29",
        nit: "800333444",
        nombre: "PAPELERIA Y SUMINISTROS",
        descripcion: "CHEQUE 9912 GIRADO PENDIENTE COBRO",
        cruce: "9912",
        debito: 0,
        credito: 1450000,
        observacion: "",
      },
    ];
  }, [librosBancos]);

  // Ejecutar el motor de conciliación bancaria
  const concilResult: BankConciliacionResult = useMemo(() => {
    return conciliarBancos(
      extractoItems,
      librosEfectivos,
      saldoInicialExtracto,
      saldoInicialLibros
    );
  }, [extractoItems, librosEfectivos, saldoInicialExtracto, saldoInicialLibros]);

  // Filas filtradas por tab
  const rowsFiltradas = useMemo(() => {
    if (tabFilter === "conciliado") {
      return concilResult.rows.filter((r) => r.estado === "conciliado");
    }
    if (tabFilter === "banco_pend") {
      return concilResult.rows.filter(
        (r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco"
      );
    }
    if (tabFilter === "transito") {
      return concilResult.rows.filter((r) => r.estado === "partida_en_transito_libros");
    }
    return concilResult.rows;
  }, [concilResult.rows, tabFilter]);

  // Manejo de carga de archivo de Extracto Bancario
  function handleUploadExtracto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const parsed: BankExtractItem[] = [];
        let headerIdx = -1;

        for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
          const rowText = (rawRows[i] || []).join(" ").toLowerCase();
          if (rowText.includes("fecha") && (rowText.includes("debito") || rowText.includes("retiro") || rowText.includes("valor") || rowText.includes("credito"))) {
            headerIdx = i;
            break;
          }
        }

        if (headerIdx === -1) headerIdx = 0;

        for (let r = headerIdx + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.length === 0) continue;

          const f = String(row[0] || "").trim();
          const desc = String(row[1] || "").trim();
          const ref = String(row[2] || "").trim();
          const deb = Math.abs(parseFloat(String(row[3] || "0").replace(/[^0-9.-]/g, "")) || 0);
          const cred = Math.abs(parseFloat(String(row[4] || "0").replace(/[^0-9.-]/g, "")) || 0);

          if (deb > 0 || cred > 0) {
            parsed.push({
              id: `ext_${r}`,
              fecha: f,
              descripcion: desc,
              referencia: ref,
              debito: deb,
              credito: cred,
            });
          }
        }

        if (parsed.length > 0) {
          setExtractoItems(parsed);
        }
      } catch (err) {
        alert("No se pudo leer el archivo de extracto bancario. Verifique que sea un Excel o CSV válido.");
      }
    };
    reader.readAsBinaryString(file);
  }

  // Exportar Cédula de Conciliación Bancaria a Excel
  function exportarCedulaBancaria() {
    const wsData = [
      ["CÉDULA DE CONCILIACIÓN BANCARIA MENSUAL"],
      ["Entidad Bancaria:", "BANCOLOMBIA / CUENTA CORRIENTE"],
      ["Fecha de Corte:", new Date().toLocaleDateString("es-CO")],
      [],
      ["ESTRUCTURA DE CONCILIACIÓN ARITMÉTICA"],
      ["Saldo Final según Extracto Bancario:", concilResult.summary.saldoExtracto],
      ["(+) Consignaciones en Tránsito:", concilResult.summary.consignacionesEnTransito],
      ["(-) Cheques y Giros pendientes de cobro:", -concilResult.summary.chequesEnTransito],
      ["(-) Notas Débito del Banco no registradas (4x1000 / Comisiones):", -concilResult.summary.notasDebitoNoRegistradas],
      ["(+) Notas Crédito del Banco no registradas (Rendimientos):", concilResult.summary.notasCreditoNoRegistradas],
      ["(=) Saldo Conciliado:", concilResult.summary.saldoConciliado],
      ["Saldo Final según Libros Contables:", concilResult.summary.saldoLibros],
      ["Diferencia de Cuadre:", concilResult.summary.diferenciaCuadre],
      [],
      ["DETALLE DE PARTIDAS Y MOVIMIENTOS"],
      ["Estado", "Fecha", "Descripción", "Referencia", "Tipo", "Monto Banco", "Monto Libros", "Nota Contable"],
      ...concilResult.rows.map((r) => [
        r.estado,
        r.fecha,
        r.descripcion,
        r.referencia,
        r.tipo,
        r.montoBanco,
        r.montoLibros,
        r.nota,
      ]),
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Conciliación Bancaria");
    XLSX.writeFile(wb, "conciliacion-bancaria.xlsx");
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-2 sm:px-6 lg:px-8 animate-in fade-in duration-200">
      {/* Banner Principal de Conciliación Bancaria */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-line bg-gradient-to-r from-bg-surface via-bg-surface to-teal-soft/25 p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-teal p-1.5 text-white shadow-xs">
              <Landmark className="size-5" />
            </span>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-ink">
              Módulo de Conciliación Bancaria
            </h1>
            <span className="rounded-full bg-teal-soft px-2.5 py-0.5 text-xs font-bold text-teal">
              Extracto vs Cuenta 11
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-ink-muted">
            Cruce automático de extractos bancarios (Bancolombia, Davivienda, etc.) contra el libro auxiliar de bancos (1110/1120/1105).
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-bg-surface px-3 py-2 text-xs font-semibold text-ink-muted hover:border-teal hover:text-teal transition cursor-pointer shadow-xs">
            <Upload className="size-3.5 text-teal" />
            <span>Cargar Extracto Bancario</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleUploadExtracto}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={exportarCedulaBancaria}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-xs font-semibold text-white hover:bg-teal-deep transition cursor-pointer shadow-xs"
          >
            <Download className="size-3.5" />
            <span>Exportar Cédula Excel</span>
          </button>
        </div>
      </div>

      {/* Tarjeta de Resumen Arimético y Estado de Cuadre */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Panel A: Estado del Cuadre */}
        <div
          className={cn(
            "lg:col-span-4 rounded-2xl border p-5 shadow-xs flex flex-col justify-between",
            concilResult.summary.cuadrado
              ? "border-emerald-300 bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200"
              : "border-rose-300 bg-rose-50/70 dark:bg-rose-950/20 text-rose-950 dark:text-rose-200"
          )}
        >
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider">Estado de la Conciliación</span>
              {concilResult.summary.cuadrado ? (
                <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertCircle className="size-5 text-rose-600 dark:text-rose-400" />
              )}
            </div>

            <div className="mt-3">
              <div className="font-display text-3xl font-extrabold tracking-tight">
                {concilResult.summary.cuadrado
                  ? "CUADRADO PERFECTO"
                  : `DIFERENCIA: ${formatMoney(concilResult.summary.diferenciaCuadre)}`}
              </div>
              <p className="mt-1 text-xs opacity-90">
                {concilResult.summary.cuadrado
                  ? "El saldo bancario ajustado coincide con el saldo de libros contables al 100%."
                  : "Existen partidas pendientes por conciliar o diferencias en el saldo inicial."}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-current/20 flex items-center justify-between text-xs font-semibold">
            <span>Movimientos Conciliados:</span>
            <span>
              {concilResult.summary.totalConciliados} de {concilResult.rows.length}
            </span>
          </div>
        </div>

        {/* Panel B: Cuadro Aritmético de Conciliación */}
        <div className="lg:col-span-8 rounded-2xl border border-line bg-bg-surface p-5 shadow-xs">
          <h3 className="font-semibold text-sm text-ink mb-3 flex items-center gap-1.5">
            <DollarSign className="size-4 text-teal" />
            Cédula de Conciliación Bancaria (Estructura DIAN / NIIF)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-line/60">
              <span className="text-ink-muted">Saldo según Extracto Bancario:</span>
              <span className="font-mono font-bold text-ink">{formatMoneyExact(concilResult.summary.saldoExtracto)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-line/60 text-emerald-600 dark:text-emerald-400">
              <span>(+) Consignaciones en Tránsito:</span>
              <span className="font-mono font-bold">{formatMoneyExact(concilResult.summary.consignacionesEnTransito)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-line/60 text-rose-600 dark:text-rose-400">
              <span>(-) Cheques / Giros en Tránsito:</span>
              <span className="font-mono font-bold">-{formatMoneyExact(concilResult.summary.chequesEnTransito)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-line/60 text-amber-600 dark:text-amber-400">
              <span>(-) Notas Débito Banco (4x1000 / Comisiones):</span>
              <span className="font-mono font-bold">-{formatMoneyExact(concilResult.summary.notasDebitoNoRegistradas)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-line/60 text-blue-600 dark:text-blue-400">
              <span>(+) Notas Crédito Banco (Rendimientos):</span>
              <span className="font-mono font-bold">+{formatMoneyExact(concilResult.summary.notasCreditoNoRegistradas)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-teal/40 bg-teal-soft/20 px-2 rounded font-semibold text-teal-deep dark:text-teal">
              <span>(=) Saldo Bancario Conciliado:</span>
              <span className="font-mono font-bold">{formatMoneyExact(concilResult.summary.saldoConciliado)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Filtros de Pestañas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { id: "todas", label: `Todos (${concilResult.rows.length})` },
            { id: "conciliado", label: `Conciliados (${concilResult.summary.totalConciliados})` },
            {
              id: "banco_pend",
              label: `Notas Banco: 4x1000 / Comisiones (${concilResult.rows.filter((r) => r.estado === "nota_debito_banco" || r.estado === "nota_credito_banco").length})`,
            },
            {
              id: "transito",
              label: `Partidas en Tránsito (${concilResult.rows.filter((r) => r.estado === "partida_en_transito_libros").length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTabFilter(tab.id as any)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer",
                tabFilter === tab.id
                  ? "bg-teal text-white shadow-xs"
                  : "bg-bg-surface text-ink-muted hover:bg-bg-subtle hover:text-ink border border-line"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-ink-subtle">
          Mostrando {rowsFiltradas.length} partidas bancarias
        </div>
      </div>

      {/* Tabla Detallada de Partidas de Conciliación Bancaria */}
      <div className="rounded-2xl border border-line bg-bg-surface overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs table-auto">
            <thead className="border-b border-line bg-bg-subtle/80 uppercase tracking-wider text-ink-subtle font-semibold">
              <tr>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5">Descripción / Concepto</th>
                <th className="px-3 py-2.5">Referencia</th>
                <th className="px-3 py-2.5 text-right">Monto Extracto</th>
                <th className="px-3 py-2.5 text-right">Monto Libros</th>
                <th className="px-3 py-2.5">Diagnóstico Contable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rowsFiltradas.map((r) => (
                <tr key={r.id} className="hover:bg-bg-subtle/40 transition">
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border",
                        r.estado === "conciliado"
                          ? "bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                          : r.esGmf
                          ? "bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 font-extrabold"
                          : r.esComision
                          ? "bg-blue-100 text-blue-950 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                          : r.estado === "partida_en_transito_libros"
                          ? "bg-purple-100 text-purple-950 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300"
                          : "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200"
                      )}
                    >
                      {r.estado === "conciliado"
                        ? "Conciliado"
                        : r.esGmf
                        ? "GMF 4x1000"
                        : r.esComision
                        ? "Comisión Banco"
                        : r.esRendimiento
                        ? "Rendimiento"
                        : "En Tránsito"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-ink-muted whitespace-nowrap">
                    {formatDate(r.fecha)}
                  </td>
                  <td className="px-3 py-2.5 font-medium text-ink max-w-[280px] truncate" title={r.descripcion}>
                    {r.descripcion}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-ink-subtle">
                    {r.referencia || "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-right text-ink">
                    {r.montoBanco > 0 ? formatMoneyExact(r.montoBanco) : "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-right text-ink">
                    {r.montoLibros > 0 ? formatMoneyExact(r.montoLibros) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-ink-muted leading-tight max-w-[320px]">
                    {r.nota}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
