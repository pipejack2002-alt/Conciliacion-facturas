import { describe, it } from "node:test";
import assert from "node:assert";
import {
  detectUniversalBankColumns,
  parseUniversalBankRows,
  cleanMoneyNumber,
  normalizeUniversalDate,
} from "./conciliar-bancos-universal.ts";
import { getAvailableBankAccounts, extractLibroBancos } from "./conciliar-bancos.ts";

describe("Conciliador Universal de Bancos (Cualquier Banco)", () => {
  it("debe limpiar correctamente montos con formato latino y anglosajón", () => {
    assert.strictEqual(cleanMoneyNumber("$ 1.234.567,89"), 1234567.89);
    assert.strictEqual(cleanMoneyNumber("$ 1,234,567.89"), 1234567.89);
    assert.strictEqual(cleanMoneyNumber("-50,000.00"), -50000);
    assert.strictEqual(cleanMoneyNumber("(15.000,50)"), -15000.5);
  });

  it("debe normalizar fechas en múltiples formatos bancarios", () => {
    assert.strictEqual(normalizeUniversalDate("2026-08-15"), "2026-08-15");
    assert.strictEqual(normalizeUniversalDate("15/08/2026"), "2026-08-15");
    assert.strictEqual(normalizeUniversalDate("15-08-2026"), "2026-08-15");
    assert.strictEqual(normalizeUniversalDate("15/Ago/26"), "2026-08-15");
    assert.strictEqual(normalizeUniversalDate("AGO 04", "2026"), "2026-08-04");
  });

  it("debe auto-detectar columnas de extractos estilo Bancolombia / Davivienda / Bogotá", () => {
    const rawRows = [
      ["BANCOLOMBIA S.A. - EXTRACTO MENSUAL"],
      ["Cuenta: 123-456789-01"],
      [],
      ["Fecha", "Descripción", "Sucursal", "Documento", "Valor Débito", "Valor Crédito", "Saldo"],
      ["2026-08-01", "ABONO TRANSFERENCIA CLIENTE", "BOGOTA", "REF-001", "0", "15000000", "15000000"],
      ["2026-08-05", "PAGO PROVEEDOR QUIMICOS", "MEDELLIN", "CHEQ-500", "4200000", "0", "10800000"],
    ];

    const config = detectUniversalBankColumns(rawRows);
    assert.strictEqual(config.headerRow, 3);
    assert.strictEqual(config.fechaCol, 0);
    assert.strictEqual(config.descripcionCol, 1);
    assert.strictEqual(config.debitoCol, 4);
    assert.strictEqual(config.creditoCol, 5);

    const items = parseUniversalBankRows(rawRows, config);
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].credito, 15000000);
    assert.strictEqual(items[1].debito, 4200000);
  });

  it("debe procesar extractos con columna única de valor y signos (+ / -)", () => {
    const rawRows = [
      ["Fecha", "Concepto", "Referencia", "Valor Neto", "Saldo"],
      ["2026-08-01", "CONSIGNACION EN EFECTIVO", "001", "5000000", "5000000"],
      ["2026-08-03", "RETIRO CAJERO AUTOMATICO", "002", "-400000", "4600000"],
    ];

    const config = detectUniversalBankColumns(rawRows);
    assert.strictEqual(config.valorMode, "single");

    const items = parseUniversalBankRows(rawRows, config);
    assert.strictEqual(items.length, 2);
    assert.strictEqual(items[0].credito, 5000000);
    assert.strictEqual(items[1].debito, 400000);
  });

  it("debe detectar cuentas de cualquier software contable (PUC 11, FICs 1250, NIIF/IFRS 10)", () => {
    const movLines = [
      {
        cuenta: "101001",
        cuentaNombre: "EFECTIVO EN BANCOS NACIONALES NIIF",
        comprobante: "EG-100",
        fecha: "2026-08-01",
        debito: 0,
        credito: 500000,
      },
      {
        cuenta: "12503511",
        cuentaNombre: "CORREVAL - FONVAL (CREDICORP)",
        comprobante: "G-9648",
        fecha: "2026-08-02",
        debito: 0,
        credito: 165000000,
      },
      {
        cuenta: "11100512",
        cuentaNombre: "BANCO CAJA SOCIAL CTA 333",
        comprobante: "CE-50",
        fecha: "2026-08-03",
        debito: 1000000,
        credito: 0,
      },
      {
        cuenta: "CUSTOM_BANK_01",
        cuentaNombre: "CUENTA CORRIENTE ESPECIAL",
        comprobante: "OP-1",
        fecha: "2026-08-04",
        debito: 250000,
        credito: 0,
      },
    ];

    const accounts = getAvailableBankAccounts(movLines);
    assert.strictEqual(accounts.length, 4);
    assert.ok(accounts.some((a) => a.cuenta === "101001"));
    assert.ok(accounts.some((a) => a.cuenta === "12503511"));
    assert.ok(accounts.some((a) => a.cuenta === "11100512"));
    assert.ok(accounts.some((a) => a.cuenta === "CUSTOM_BANK_01"));

    const filtered = extractLibroBancos(movLines, "12503511");
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].credito, 165000000);
  });
});
