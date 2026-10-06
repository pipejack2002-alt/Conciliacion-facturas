import { describe, it } from "node:test";
import assert from "node:assert";
import { parseExcelBankExtract } from "./parse-bank-extract.ts";
import * as XLSX from "xlsx";

describe("Extractor Inteligente de Extractos Bancarios", () => {
  it("debe procesar extractos en Excel/CSV extrayendo débitos, créditos y referencias", () => {
    const data = [
      ["BANCO DEMO S.A. - EXTRACTO MENSUAL"],
      ["Cuenta:", "987654321"],
      [],
      ["Fecha", "Descripción", "Referencia", "Retiro / Débito", "Depósito / Crédito", "Saldo"],
      ["2026-08-01", "SALDO INICIAL", "", 0, 0, 10000000],
      ["2026-08-05", "TRANSFERENCIA CLIENTE", "TR-100", 0, 2500000, 12500000],
      ["2026-08-10", "PAGO PROVEEDOR SERVICIOS", "EG-200", 1200000, 0, 1130000],
      ["2026-08-15", "GRAVAMEN MOVIMIENTO FINANCIERO GMF", "GMF-01", 4800, 0, 1125200],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Extracto");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const result = parseExcelBankExtract(buf);
    assert.strictEqual(result.items.length, 3);
    assert.strictEqual(result.totalCreditos, 2500000);
    assert.strictEqual(result.totalDebitos, 1204800);
    assert.strictEqual(result.items[0].referencia, "TR-100");
    assert.strictEqual(result.items[1].debito, 1200000);
    assert.strictEqual(result.items[2].debito, 4800);
  });

  it("debe procesar extractos en Excel con encabezados con tildes (Débito, Crédito) y miles con puntos", () => {
    const data = [
      ["Fecha", "Descripción", "Referencia", "Débito", "Crédito", "Saldo"],
      ["2026-08-05", "ABONO CLIENTE", "TR-555", 0, "1.500.000", "1.500.000"],
      ["2026-08-10", "PAGO SERVICIO ENERGIA", "FAC-999", "500.000", 0, "1.000.000"],
      ["2026-08-15", "COMISION BANCARIA", "COM-1", "18.000", 0, "982.000"],
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Extracto");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const result = parseExcelBankExtract(buf);
    assert.strictEqual(result.items.length, 3);
    assert.strictEqual(result.items[0].credito, 1500000);
    assert.strictEqual(result.items[1].debito, 500000);
    assert.strictEqual(result.items[2].debito, 18000);
    assert.strictEqual(result.totalCreditos, 1500000);
    assert.strictEqual(result.totalDebitos, 518000);
  });

  it("debe convertir fechas seriales numéricas de Excel (ej. 45540) a formato ISO YYYY-MM-DD", () => {
    const data = [
      ["Fecha", "Concepto", "Comprobante", "Retiros", "Depósitos"],
      [45540, "RETIRO CAJERO", "001", 200000, 0], // 2024-09-05
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const result = parseExcelBankExtract(buf);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].fecha, "2024-09-05");
    assert.strictEqual(result.items[0].debito, 200000);
  });
});
