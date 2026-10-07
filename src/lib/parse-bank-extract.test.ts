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

  it("debe detectar archivos de imagen y PDFs correctamente con isImageFile e isPdfFile", async () => {
    const { isImageFile, isPdfFile } = await import("./ocr-extractor.ts");
    assert.strictEqual(isImageFile("extracto.png"), true);
    assert.strictEqual(isImageFile("foto.jpg"), true);
    assert.strictEqual(isImageFile("escaneo.jpeg"), true);
    assert.strictEqual(isImageFile("recibo.webp"), true);
    assert.strictEqual(isImageFile("documento.pdf"), false);
    assert.strictEqual(isImageFile("extracto.xlsx"), false);

    assert.strictEqual(isPdfFile("extracto.pdf"), true);
    assert.strictEqual(isPdfFile("extracto.PDF"), true);
    assert.strictEqual(isPdfFile("imagen.png"), false);
  });

  it("debe procesar extracto de Banco Caja Social vía OCR extrayendo exactamente 30 partidas y totales exactos", async () => {
    const { parseBancoCajaSocial, parseTextBankExtract } = await import("./parse-bank-extract.ts");
    const page1 = `
Periodo del Informe
Cuenta Corriente 1 de Septiembre a 30 de Septiembre de 2026
0136 Detalle de Productos
Fecha Transacción Documento Lugar Valor Transacción Saldo Disponible Saldo Total
SEP 04 | CREDITO TRANSFERENCIA 89764801 INTERNET 5,000,000.00 12,472,980.73 12,472,980.73
SEP 04 | DEBITO POR PAGOS PSE 6263395 INTERNET -8,608,100.00 3,864,880.73 3,864,880.73
Pago de Seguridad Social 626263395
SEP 04 | DEBITO POR PAGOS PSE 6317358 INTERNET -946,600.00 2,918,280.73 2,918,280.73
DVZ231 626317358
SEP 07 | TRANSFERENCIA OTRA ENTIDA 25538000 ACH 6,930,000.00 9,848,280.73 9,848,280.73
SEP 08 | DEBITO POR PAGOS PSE 6738044 INTERNET -24,200.00 9,824,080.73 9,824,080.73
SEP 08 | DEBITO AUTORIZADO POR ACH 08407059 ACH -775,000.00 9,049,080.73 9,049,080.73
DEBITO POR LOTE 0084000
SEP 10 | TRANSFERENCIA OTRA ENTIDA 26186420 ACH 13,000,000.00 22,049.,080.73 22,049,080.73
SEP 11 DEBITO AUTORIZADO POR ACH 08514849 ACH -8,584,100.50 13,464,980.23 13,464,980.23
Pag. 1 de 2
`;
    const page2 = `
Continuación Cuenta Corriente
Fecha Transacción Documento Lugar Valor Transacción Saldo Disponible Saldo Total
SEP 11 DEBITO POR PAGOS PSE 5634814 INTERNET -344,807.00 13,120,173.23 13,120,173.23
SEP 11 | DEBITO POR PAGOS PSE 5646377 INTERNET -1,274,000.00 11,846,173.23 11,846,173.23
: SEP 11 TRANSFERENCIA OTRA ENTIDA 26474410 ACH 5,184,111.00 17,030,284.23 17,030,284.23
2 SEP 14 | DEBITO POR PAGOS PSE 1815484 INTERNET -941,000.00 16,089,284.23 16,089,284.23
Pago Declaracion 651815484
É SEP 15 TRANSFERENCIA OTRA ENTIDA 27083613 ACH 2,938,850.00 19,028,134.23 19,028,134.23
SEP 16 | DEBITO POR PAGOS PSE 8986635 INTERNET -2,195,000.00 16,833,134.23 16,833,134.23
SEP 16 | CREDITO TRANSFERENCIA 31269311 INTERNET 6,000,000.00 22,833,134.23 22,833,134.23
SEP 16 | DEBITO POR PAGOS PSE 9493071 INTERNET -21,073,000.00 1,760,134.23 1,760,134.23
a SEP 17 | TRANSFERENCIA OTRA ENTIDA 27439121 ACH 2,964,900.00 4,725,034.23 4,725,034.23
E SEP 17 | DEBITO AUTORIZADO POR ACH 08772318 ACH -2,819,329.50 1,905,704.73 1.905,704.73
ra SEP 17 | CREDITO TRANSFERENCIA 81589737 INTERNET 1,000,000.00 2,905,704.73 2,905,704.73
Ei SEP 17 | DEBITO AUTORIZADO POR ACH 08772836 ACH -2,270,352.00 635,352.73 635,352.73
== SEP 18 | CREDITO TRANSFERENCIA 33177967 INTERNET 7,000,000.00 7,635,352.73 7,635,352.73
E SEP 18 | DEBITO AUTORIZADO POR ACH 08809311 ACH -7,218,750.00 416,602.73 416,602.73
Z SEP 18 | COMIS. CONVENIO DE PAGO BE EM 962 BAR GE -8,224.00 408,378.73 408,378.73
5 SEP 22 | ABONO NOMINA Y O PROVEEDO 28044333 ACH 435,000.00 843,378.73 843,378.73
SEP 23 | DEBITO AUTORIZADO POR ACH 08926260 ACH 450,765.00 392,613.73 392,613.73
SEP 24 | TRANSFERENCIA OTRA ENTIDA 28445817 ACH 10,000,000.00 10,392,613.73 10,392,613.73
SEP 25 | ABONO NOMINA Y O PROVEEDO 28625218 ACH 4,731,000.00 15,123,613.73 15.123,613.73
SEP 30 | DEBITO POR PAGOS PSE 6959177 INTERNET -4,132,950.00 10,990,663.73 10,990,663.73
SEP 30 | GRAVAMEN MOVS FINANCIEROS 12345678 BE EM 962 BAR GE -246,669.00 10,743,994.73 10,743,994.73
SEP 30 | IVA SOBRE COMISIONES 12345678 BE EM 962 BAR GE -1,563.00 10,742,431.73 10,742,431.73
Pag. 2 de 2
`;
    const res = parseBancoCajaSocial([page1, page2]);
    assert.strictEqual(res.bancoId, "banco_caja_social");
    assert.strictEqual(res.items.length, 30);
    assert.strictEqual(res.totalDebitos, 61914410);
    assert.strictEqual(res.totalCreditos, 65183861);
    assert.strictEqual(res.saldoFinal, 10742431.73);

    // Verificar enrutador genérico parseTextBankExtract
    const resRouter = parseTextBankExtract([`Banco Caja Social`, page1, page2]);
    assert.strictEqual(resRouter.bancoId, "banco_caja_social");
    assert.strictEqual(resRouter.items.length, 30);
  });
});

