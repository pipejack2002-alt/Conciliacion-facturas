// Configurar indicador de entorno de prueba antes de cargar dependencias
(globalThis as any).__TEST_ENV__ = true;

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  getActiveUserKey,
  getScopedStorageKey,
  getHistoryEntries,
  saveHistoryEntry,
  deleteHistoryEntry,
  clearAllHistory,
  type HistoryEntry,
} from "./history-store.ts";
import type { ConciliacionResult } from "./types.ts";

// Mock minimal de localStorage para el entorno de test Node.js
class LocalStorageMock {
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

// Configurar window.localStorage en globalThis si no existe
if (typeof (globalThis as any).window === "undefined") {
  (globalThis as any).window = globalThis;
}
(globalThis as any).localStorage = new LocalStorageMock();

const mockTotalsA: any = {
  documentos: 10,
  recibidos: 10,
  conciliados: 8,
  totalizados: 0,
  pendientes: 2,
  pendientesRecibidos: 2,
  diferencias: 0,
  duplicados: 0,
  crucesNc: 0,
  noAplica: 0,
  soloSiigo: 0,
  valorDian: 5000000,
  valorPendiente: 500000,
  valorPendienteRecibido: 500000,
  valorTotalizado: 0,
  valorDiferencia: 0,
  pctRecibidos: 100,
  pctConciliado: 80,
  cola: 2,
  valorCola: 500000,
};

const mockResultCompanyA: ConciliacionResult = {
  company: { nit: "900123456", nombre: "EMPRESA ALFA S.A.S." },
  periodLabel: "AGO 2026",
  rows: [],
  orphans: [],
  cruzes: [],
  totals: mockTotalsA,
};

const mockTotalsB: any = {
  documentos: 5,
  recibidos: 5,
  conciliados: 5,
  totalizados: 0,
  pendientes: 0,
  pendientesRecibidos: 0,
  diferencias: 0,
  duplicados: 0,
  crucesNc: 0,
  noAplica: 0,
  soloSiigo: 0,
  valorDian: 2000000,
  valorPendiente: 0,
  valorPendienteRecibido: 0,
  valorTotalizado: 0,
  valorDiferencia: 0,
  pctRecibidos: 100,
  pctConciliado: 100,
  cola: 0,
  valorCola: 0,
};

const mockResultCompanyB: ConciliacionResult = {
  company: { nit: "800987654", nombre: "BETA COMERCIAL LTDA" },
  periodLabel: "JUL 2026",
  rows: [],
  orphans: [],
  cruzes: [],
  totals: mockTotalsB,
};

describe("Historial Multi-Usuario con Aislamiento y Sincronización", () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
  });

  test("debe generar claves de almacenamiento aisladas y sanitizadas por usuario", () => {
    const keyAdmin = getScopedStorageKey("admin@tributoapp.me");
    const keyAux = getScopedStorageKey("auxiliar@empresa.com");

    assert.equal(keyAdmin, "conciliacion_dian_history_admin_tributoapp.me");
    assert.equal(keyAux, "conciliacion_dian_history_auxiliar_empresa.com");
    assert.notEqual(keyAdmin, keyAux);
  });

  test("debe aislar estrictamente las sesiones guardadas entre dos usuarios distintos", () => {
    const userAdmin = "admin@tributoapp.me";
    const userAuxiliar = "auxiliar@empresa.com";

    // 1. Guardar sesión con Admin
    saveHistoryEntry(mockResultCompanyA, "DIAN_ALFA.xlsx", "MOV_ALFA.xlsx", undefined, userAdmin);

    // 2. Guardar sesión diferente con Auxiliar
    saveHistoryEntry(mockResultCompanyB, "DIAN_BETA.xlsx", "MOV_BETA.xlsx", undefined, userAuxiliar);

    // 3. Verificar que Admin solo ve ALFA
    const adminEntries = getHistoryEntries(userAdmin);
    assert.equal(adminEntries.length, 1);
    assert.equal(adminEntries[0].company.nit, "900123456");
    assert.equal(adminEntries[0].company.nombre, "EMPRESA ALFA S.A.S.");

    // 4. Verificar que Auxiliar solo ve BETA
    const auxEntries = getHistoryEntries(userAuxiliar);
    assert.equal(auxEntries.length, 1);
    assert.equal(auxEntries[0].company.nit, "800987654");
    assert.equal(auxEntries[0].company.nombre, "BETA COMERCIAL LTDA");

    // 5. Un tercer usuario nuevo no debe ver el historial de ninguno de los dos
    const userContador = "contador@externo.co";
    const contadorEntries = getHistoryEntries(userContador);
    assert.equal(contadorEntries.length, 0);
  });

  test("debe eliminar sesiones de un usuario sin afectar las de otros usuarios", () => {
    const userAdmin = "admin@tributoapp.me";
    const userAuxiliar = "auxiliar@empresa.com";

    saveHistoryEntry(mockResultCompanyA, "DIAN_ALFA.xlsx", "MOV_ALFA.xlsx", undefined, userAdmin);
    saveHistoryEntry(mockResultCompanyB, "DIAN_BETA.xlsx", "MOV_BETA.xlsx", undefined, userAuxiliar);

    const adminEntriesBefore = getHistoryEntries(userAdmin);
    assert.equal(adminEntriesBefore.length, 1);
    const entryId = adminEntriesBefore[0].id;

    // Eliminar la entrada de Admin
    deleteHistoryEntry(entryId, userAdmin);

    // Admin ahora tiene 0 entradas
    assert.equal(getHistoryEntries(userAdmin).length, 0);

    // Auxiliar sigue teniendo intacta su sesión
    const auxEntries = getHistoryEntries(userAuxiliar);
    assert.equal(auxEntries.length, 1);
    assert.equal(auxEntries[0].company.nit, "800987654");
  });

  test("debe vaciar el historial únicamente del usuario que lo solicita", () => {
    const userAdmin = "admin@tributoapp.me";
    const userAuxiliar = "auxiliar@empresa.com";

    saveHistoryEntry(mockResultCompanyA, "DIAN_ALFA.xlsx", "MOV_ALFA.xlsx", undefined, userAdmin);
    saveHistoryEntry(mockResultCompanyB, "DIAN_BETA.xlsx", "MOV_BETA.xlsx", undefined, userAuxiliar);

    // Vaciar historial de Admin
    clearAllHistory(userAdmin);

    assert.equal(getHistoryEntries(userAdmin).length, 0);
    assert.equal(getHistoryEntries(userAuxiliar).length, 1);
  });

  test("debe migrar de forma transparente sesiones preexistentes (legacy) al primer inicio de sesión del usuario", () => {
    const legacyKey = "conciliacion_dian_history_v1";
    const legacyData: HistoryEntry[] = [
      {
        id: "LEGACY_1",
        timestamp: 1600000000,
        company: { nit: "999888777", nombre: "EMPRESA LEGACY" },
        periodLabel: "JUN 2026",
        dianName: "DIAN_LEGACY.xlsx",
        movName: "MOV_LEGACY.xlsx",
        totals: mockResultCompanyA.totals,
        result: mockResultCompanyA,
      },
    ];

    (globalThis as any).localStorage.setItem(legacyKey, JSON.stringify(legacyData));

    // El usuario se loguea por primera vez
    const userNuevo = "nuevo_usuario@tributoapp.me";
    const entries = getHistoryEntries(userNuevo);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].company.nombre, "EMPRESA LEGACY");

    // Verificar que quedó grabado en su partición propia
    const scopedKey = getScopedStorageKey(userNuevo);
    const savedInScoped = JSON.parse((globalThis as any).localStorage.getItem(scopedKey)!);
    assert.equal(savedInScoped.length, 1);
    assert.equal(savedInScoped[0].id, "LEGACY_1");
  });
});
