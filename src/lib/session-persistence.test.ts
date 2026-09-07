// Configurar indicador de entorno de prueba antes de cargar dependencias
(globalThis as any).__TEST_ENV__ = true;

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Mock minimal de Storage
class StorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}
(globalThis as any).localStorage = new StorageMock();
(globalThis as any).sessionStorage = new StorageMock();

import {
  useConciliacion,
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
} from "./store.ts";
import { saveHistoryEntry } from "./history-store.ts";
import type { ConciliacionResult } from "./types.ts";

const mockResult: ConciliacionResult = {
  company: { nit: "900999888", nombre: "Empresa Test SAS" },
  periodLabel: "Agosto 2026",
  rows: [
    {
      id: "row-1",
      estado: "pendiente",
      grupo: "Recibido",
      tipo: "Factura electrónica",
      prefijo: "FE",
      folio: "101",
      numero: "FE-101",
      nitContraparte: "800111222",
      nombreContraparte: "Proveedor A",
      fecha: "2026-08-15",
      totalDian: 150000,
      totalSiigo: 0,
      diferencia: 150000,
      iva: 28500,
      cufe: "cufe123",
      prioridad: "audit",
      alerta: "",
      hits: [],
      linked: [],
      comprobantes: [],
      matchVia: "",
    },
  ],
  totals: {
    documentos: 1,
    recibidos: 1,
    conciliados: 0,
    totalizados: 0,
    pendientes: 1,
    pendientesRecibidos: 1,
    diferencias: 0,
    duplicados: 0,
    crucesNc: 0,
    noAplica: 0,
    soloSiigo: 0,
    valorDian: 150000,
    valorPendiente: 150000,
    valorPendienteRecibido: 150000,
    valorTotalizado: 0,
    valorDiferencia: 0,
    pctRecibidos: 100,
    pctConciliado: 0,
    cola: 1,
    valorCola: 150000,
  },
  orphans: [],
  cruzes: [],
};

describe("Persistencia de Sesión Activa (Evitar pérdida en F5 / Actualizar)", () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
    (globalThis as any).sessionStorage.clear();
    useConciliacion.getState().reset();
  });

  it("debe retornar null cuando no hay sesión activa ni historial", () => {
    const active = loadActiveSession();
    assert.equal(active, null);
  });

  it("debe guardar y cargar una sesión activa explícitamente", () => {
    saveActiveSession({
      result: mockResult,
      dianName: "Dian_Agosto.xlsx",
      movName: "Libro_Agosto.xlsx",
      reviews: {},
      tab: "pendiente",
      sort: "fecha",
      sortDirection: "desc",
      columnFilters: { proveedor: "Proveedor A" },
      groupByProveedor: true,
      hideRevisados: false,
    });

    const loaded = loadActiveSession();
    assert.ok(loaded);
    assert.equal(loaded?.dianName, "Dian_Agosto.xlsx");
    assert.equal(loaded?.tab, "pendiente");
    assert.equal(loaded?.sort, "fecha");
    assert.equal(loaded?.sortDirection, "desc");
    assert.equal(loaded?.groupByProveedor, true);
    assert.equal(loaded?.result?.company.nit, "900999888");
  });

  it("debe limpiar la sesión activa y marcarla como descartada al invocar reset()", () => {
    saveActiveSession({
      result: mockResult,
      dianName: "Dian.xlsx",
      movName: "Libro.xlsx",
      reviews: {},
    });

    assert.ok(loadActiveSession() !== null);

    // Usuario hace clic en "Nueva auditoría"
    useConciliacion.getState().reset();

    // Debe retornar null porque el usuario descartó explícitamente la sesión
    assert.equal(loadActiveSession(), null);
    assert.equal(useConciliacion.getState().result, null);
  });

  it("debe persistir automáticamente al cargar sesión desde historial", () => {
    const entry = {
      id: "hist-1",
      timestamp: Date.now(),
      company: mockResult.company,
      periodLabel: "Agosto 2026",
      dianName: "Dian_Historial.xlsx",
      movName: "Libro_Historial.xlsx",
      totals: mockResult.totals,
      result: mockResult,
      reviews: {},
    };

    useConciliacion.getState().loadHistorySession(entry);

    const active = loadActiveSession();
    assert.ok(active);
    assert.equal(active.dianName, "Dian_Historial.xlsx");
    assert.equal(active.result?.company.nit, "900999888");
  });

  it("debe persistir cambios de tab, sort, filtros y agrupamiento", () => {
    // Cargar sesión inicial
    useConciliacion.getState().loadHistorySession({
      id: "hist-1",
      timestamp: Date.now(),
      company: mockResult.company,
      periodLabel: "Agosto 2026",
      dianName: "Dian.xlsx",
      movName: "Libro.xlsx",
      totals: mockResult.totals,
      result: mockResult,
      reviews: {},
    });

    // Mutaciones del usuario
    useConciliacion.getState().setTab("pendiente");
    useConciliacion.getState().setSort("fecha", "asc");
    useConciliacion.getState().setColumnFilter("proveedor", "Proveedor A");
    useConciliacion.getState().toggleGroup();

    // Verificar en localStorage
    const saved = loadActiveSession();
    assert.equal(saved?.tab, "pendiente");
    assert.equal(saved?.sort, "fecha");
    assert.equal(saved?.sortDirection, "asc");
    assert.equal(saved?.columnFilters?.proveedor, "Proveedor A");
    assert.equal(saved?.groupByProveedor, true);
  });

  it("debe restaurar sesión activa al invocar restoreActiveSession()", () => {
    saveActiveSession({
      result: mockResult,
      dianName: "Dian_Restored.xlsx",
      movName: "Libro_Restored.xlsx",
      reviews: {},
      tab: "diferencia",
      sort: "dian",
      sortDirection: "desc",
    });

    // Estado en blanco previo a la restauración
    useConciliacion.setState({ result: null, dianName: "", movName: "" });
    assert.equal(useConciliacion.getState().result, null);

    const ok = useConciliacion.getState().restoreActiveSession();
    assert.equal(ok, true);

    const state = useConciliacion.getState();
    assert.equal(state.result?.company.nit, "900999888");
    assert.equal(state.dianName, "Dian_Restored.xlsx");
    assert.equal(state.tab, "diferencia");
    assert.equal(state.sort, "dian");
    assert.equal(state.sortDirection, "desc");
  });

  it("debe recurrir al historial reciente si no hay sesión activa guardada y no fue descartada", () => {
    (globalThis as any).localStorage.removeItem("conciliacion_session_dismissed_v1");
    (globalThis as any).sessionStorage.removeItem("conciliacion_session_dismissed_v1");

    saveHistoryEntry(mockResult, "Dian_Fallback.xlsx", "Libro_Fallback.xlsx");

    // Limpiar sólo la clave de sesión activa (simulando versión previa a esta mejora)
    (globalThis as any).localStorage.removeItem("conciliacion_active_session_v1");

    const fallbackSession = loadActiveSession();
    assert.ok(fallbackSession);
    assert.equal(fallbackSession.result?.company.nit, "900999888");
    assert.equal(fallbackSession.dianName, "Dian_Fallback.xlsx");
  });

  it("debe actualizar el movimiento y re-conciliar exitosamente aunque dian esté vacío en memoria", async () => {
    // Simular estado tras recargar página (F5): result existe pero dian y mov son []
    useConciliacion.setState({
      result: mockResult,
      dian: [],
      mov: [],
      dianName: "REPORTE DIAN CDS JUL 2026.xlsx",
      movName: "MOV CDS JUL 2026.xlsx",
    });

    assert.equal(useConciliacion.getState().dian.length, 0);

    // Nuevo movimiento que contiene la factura FE-101 que estaba pendiente
    const updatedMov = [
      {
        cuenta: "220505",
        cuentaNombre: "Proveedores",
        comprobante: "FC-10",
        fecha: "2026-08-15",
        nit: "800111222",
        nombre: "Proveedor A",
        descripcion: "Causacion Factura FE-101",
        cruce: "FE-101",
        referencia: "FE-101",
        debito: 0,
        credito: 150000,
        observacion: "",
      },
    ];

    await useConciliacion.getState().replaceMov(updatedMov, "MOV CDS JUL 2026 ACTUALIZADO.xlsx");

    const state = useConciliacion.getState();
    assert.equal(state.movName, "MOV CDS JUL 2026 ACTUALIZADO.xlsx");
    assert.ok(state.result);
    // La factura FE-101 que estaba pendiente ahora debe estar conciliada
    const row = state.result.rows.find((r) => r.numero === "FE-101");
    assert.ok(row, "Debe existir la fila FE-101");
    assert.equal(row.estado, "conciliado");
    assert.equal(state.result.totals.pendientesRecibidos, 0);
    assert.equal(state.result.totals.conciliados, 1);
  });
});
