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
  saveStoredBankSession,
  getInitialBankSessionSync,
  loadStoredBankSession,
  clearStoredBankSession,
  BANK_SESSION_STORAGE_KEY,
  BANK_DISMISSED_KEY,
} from "./bank-cache.ts";
import type { BankExtractItem } from "./conciliar-bancos.ts";
import type { MovLine } from "./types.ts";

describe("Persistencia de Sesión Bancaria (Evitar pérdida en F5 / Recarga)", () => {
  beforeEach(() => {
    (globalThis as any).localStorage.clear();
    (globalThis as any).sessionStorage.clear();
  });

  it("debe retornar null cuando no hay sesión bancaria guardada", () => {
    const session = getInitialBankSessionSync();
    assert.equal(session, null);
  });

  it("debe guardar y cargar una sesión bancaria activa de forma síncrona", async () => {
    const mockExtracto: BankExtractItem[] = [
      {
        id: "b1",
        fecha: "2026-08-13",
        descripcion: "TRANSF BCSC LOTES ACH",
        referencia: "000009000008",
        debito: 3208172.87,
        credito: 0,
      },
    ];

    const mockMov: MovLine[] = [
      {
        cuenta: "11100512",
        cuentaNombre: "BANCO COLMENA BCSC",
        comprobante: "G 002 00000002755 003",
        fecha: "2026-08-13",
        nit: "12345678",
        nombre: "ALEXANDER VILLA URUETA",
        descripcion: "PAGO NOMINA",
        cruce: "000009000008",
        debito: 0,
        credito: 303511,
        observacion: "",
      },
      {
        cuenta: "11100512",
        cuentaNombre: "BANCO COLMENA BCSC",
        comprobante: "G 002 00000002756 002",
        fecha: "2026-08-13",
        nit: "12345678",
        nombre: "ALEXANDER VILLA URUETA",
        descripcion: "PAGO SEGUNDO CONCEPTO",
        cruce: "000009000008",
        debito: 0,
        credito: 721441,
        observacion: "",
      },
    ];

    await saveStoredBankSession({
      extractoItems: mockExtracto,
      extractoMeta: null,
      extractoFileName: "extracto_agosto_colmena.xlsx",
      selectedSubAccount: "default",
      customMovLines: mockMov,
      customMovFileName: "auxiliar_bancos_agosto.xlsx",
      saldoInicialExtracto: 25000000,
      saldoInicialLibros: 25000000,
      cuentaSeleccionada: "11100512",
      isDemoMode: false,
      tabFilter: "todas",
    });

    const syncLoaded = getInitialBankSessionSync();
    assert.ok(syncLoaded !== null);
    assert.equal(syncLoaded.extractoItems.length, 1);
    assert.equal(syncLoaded.extractoFileName, "extracto_agosto_colmena.xlsx");
    assert.equal(syncLoaded.customMovLines?.length, 2);
    assert.equal(syncLoaded.customMovFileName, "auxiliar_bancos_agosto.xlsx");
    assert.equal(syncLoaded.saldoInicialExtracto, 25000000);
    assert.equal(syncLoaded.cuentaSeleccionada, "11100512");
    assert.equal(syncLoaded.isDemoMode, false);

    const asyncLoaded = await loadStoredBankSession();
    assert.ok(asyncLoaded !== null);
    assert.equal(asyncLoaded.extractoFileName, "extracto_agosto_colmena.xlsx");
    assert.equal(asyncLoaded.saldoInicialExtracto, 25000000);
  });

  it("debe limpiar la sesión y marcarla como descartada al invocar clearStoredBankSession", async () => {
    await saveStoredBankSession({
      extractoItems: [{ id: "b1", fecha: "2026-08-01", descripcion: "TEST", referencia: "REF123", debito: 100, credito: 0 }],
      extractoMeta: null,
      extractoFileName: "test.xlsx",
      selectedSubAccount: "default",
      customMovLines: null,
      customMovFileName: "",
      saldoInicialExtracto: 50000,
      saldoInicialLibros: 50000,
      cuentaSeleccionada: "todas",
      isDemoMode: false,
      tabFilter: "todas",
    });

    assert.ok(getInitialBankSessionSync() !== null);

    await clearStoredBankSession();

    assert.equal((globalThis as any).localStorage.getItem(BANK_SESSION_STORAGE_KEY), null);
    assert.equal((globalThis as any).localStorage.getItem(BANK_DISMISSED_KEY), "true");
    assert.equal((globalThis as any).sessionStorage.getItem(BANK_DISMISSED_KEY), "true");

    assert.equal(getInitialBankSessionSync(), null);
    assert.equal(await loadStoredBankSession(), null);
  });

  it("debe respetar el modo de demostración guardado", async () => {
    await saveStoredBankSession({
      extractoItems: [],
      extractoMeta: null,
      extractoFileName: "Extracto de Demostración",
      selectedSubAccount: "default",
      customMovLines: null,
      customMovFileName: "",
      saldoInicialExtracto: 15000000,
      saldoInicialLibros: 15000000,
      cuentaSeleccionada: "todas",
      isDemoMode: true,
      tabFilter: "conciliado",
    });

    const loaded = getInitialBankSessionSync();
    assert.ok(loaded !== null);
    assert.equal(loaded.isDemoMode, true);
    assert.equal(loaded.saldoInicialExtracto, 15000000);
    assert.equal(loaded.tabFilter, "conciliado");
  });
});
