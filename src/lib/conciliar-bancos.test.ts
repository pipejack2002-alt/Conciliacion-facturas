import { describe, it } from "node:test";
import assert from "node:assert";
import {
  conciliarBancos,
  extractLibroBancos,
  getAvailableBankAccounts,
  type BankExtractItem,
} from "./conciliar-bancos.ts";
import type { MovLine } from "./types.ts";

describe("Motor de Conciliación Bancaria Automática (Extracto Bancario vs Cuenta 11)", () => {
  it("debe conciliar correctamente movimientos por número de referencia y valor exacto", () => {
    const extracto: BankExtractItem[] = [
      {
        id: "b1",
        fecha: "2026-07-05",
        descripcion: "PAGO PROVEEDOR TRANSFERENCIA",
        referencia: "TRANS-8842",
        debito: 4500000,
        credito: 0,
      },
    ];

    const libros: MovLine[] = [
      {
        cuenta: "11100501",
        cuentaNombre: "BANCOLOMBIA CORRIENTE",
        comprobante: "E 001 100",
        fecha: "2026-07-05",
        nit: "900123456",
        nombre: "PROVEEDOR INDUSTRIAL S.A.S.",
        descripcion: "PAGO FACTURA TRANS-8842",
        cruce: "TRANS-8842",
        referencia: "TRANS-8842",
        debito: 0,
        credito: 4500000, // Salida en libros
        observacion: "",
      },
    ];

    const res = conciliarBancos(extracto, libros, 10000000, 10000000);
    assert.strictEqual(res.summary.totalConciliados, 1);
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.summary.cuadrado, true);
    assert.strictEqual(res.summary.diferenciaCuadre, 0);
  });

  it("debe detectar automáticamente cargos de GMF (4x1000) y comisiones bancarias en extracto", () => {
    const extracto: BankExtractItem[] = [
      {
        id: "gmf-1",
        fecha: "2026-07-15",
        descripcion: "GRAVAMEN MOVIMIENTO FINANCIERO GMF 4X1000",
        referencia: "GMF-0715",
        debito: 36000,
        credito: 0,
      },
      {
        id: "com-1",
        fecha: "2026-07-31",
        descripcion: "CUOTA DE MANEJO CUENTA CORRIENTE + IVA",
        referencia: "CM-0731",
        debito: 75000,
        credito: 0,
      },
      {
        id: "rend-1",
        fecha: "2026-07-31",
        descripcion: "RENDIMIENTO FINANCIERO LIQUIDACION MENSUAL",
        referencia: "REND-0731",
        debito: 0,
        credito: 14200,
      },
    ];

    const libros: MovLine[] = []; // No se han registrado aún en contabilidad

    const res = conciliarBancos(extracto, libros);
    assert.strictEqual(res.summary.notasDebitoNoRegistradas, 36000 + 75000);
    assert.strictEqual(res.summary.notasCreditoNoRegistradas, 14200);

    const rowGmf = res.rows.find((r) => r.esGmf);
    assert.ok(rowGmf);
    assert.strictEqual(rowGmf.estado, "nota_debito_banco");
    assert.ok(rowGmf.nota.includes("4x1000"));

    const rowCom = res.rows.find((r) => r.esComision);
    assert.ok(rowCom);
    assert.strictEqual(rowCom.estado, "nota_debito_banco");

    const rowRend = res.rows.find((r) => r.esRendimiento);
    assert.ok(rowRend);
    assert.strictEqual(rowRend.estado, "nota_credito_banco");
  });

  it("debe identificar cheques o giros girados en libros no cobrados (Partidas en Tránsito)", () => {
    const extracto: BankExtractItem[] = []; // El banco aún no lo paga
    const libros: MovLine[] = [
      {
        cuenta: "11100501",
        cuentaNombre: "BANCOLOMBIA",
        comprobante: "G 002 45",
        fecha: "2026-07-29",
        nit: "800999888",
        nombre: "SERVICIOS TECNICOS",
        descripcion: "CHEQUE 45902 PENDIENTE COBRO",
        cruce: "CH-45902",
        referencia: "45902",
        debito: 0,
        credito: 2800000,
        observacion: "",
      },
    ];

    const res = conciliarBancos(extracto, libros);
    assert.strictEqual(res.summary.chequesEnTransito, 2800000);
    assert.strictEqual(res.rows[0].estado, "partida_en_transito_libros");
    assert.ok(res.rows[0].nota.includes("en Tránsito"));
  });

  it("debe filtrar correctamente cuentas contables de bancos (1110, 1120, 1105) con extractLibroBancos", () => {
    const mov: MovLine[] = [
      {
        cuenta: "11100501",
        cuentaNombre: "BANCO BOGOTA",
        comprobante: "E 01",
        fecha: "2026-07-01",
        nit: "1",
        nombre: "A",
        descripcion: "",
        cruce: "",
        debito: 100,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 01",
        fecha: "2026-07-01",
        nit: "2",
        nombre: "B",
        descripcion: "",
        cruce: "",
        debito: 0,
        credito: 100,
        observacion: "",
      },
      {
        cuenta: "11050501",
        cuentaNombre: "CAJA GENERAL",
        comprobante: "R 01",
        fecha: "2026-07-01",
        nit: "3",
        nombre: "C",
        descripcion: "",
        cruce: "",
        debito: 50,
        credito: 0,
        observacion: "",
      },
    ];

    const bancos = extractLibroBancos(mov);
    assert.strictEqual(bancos.length, 2);
    assert.ok(bancos.every((b) => b.cuenta.startsWith("11")));
  });

  it("debe conciliar lotes ACH de 1 débito bancario contra N comprobantes individuales de libros", () => {
    const extracto: BankExtractItem[] = [
      {
        id: "lote-ach-1",
        fecha: "2026-08-04",
        descripcion: "DEBITO AUTORIZADO POR ACH LOTE 0001",
        referencia: "0001",
        debito: 2500000,
        credito: 0,
      },
    ];

    const libros: MovLine[] = [
      {
        cuenta: "11100501",
        cuentaNombre: "BANCO COLMENA BCSC",
        comprobante: "G 002 101",
        fecha: "2026-08-04",
        nit: "100",
        nombre: "EMPLEADO 1",
        descripcion: "PAGO NOMINA",
        cruce: "",
        referencia: "",
        debito: 0,
        credito: 1000000,
        observacion: "",
      },
      {
        cuenta: "11100501",
        cuentaNombre: "BANCO COLMENA BCSC",
        comprobante: "G 002 102",
        fecha: "2026-08-04",
        nit: "101",
        nombre: "EMPLEADO 2",
        descripcion: "PAGO NOMINA",
        cruce: "",
        referencia: "",
        debito: 0,
        credito: 1500000,
        observacion: "",
      },
    ];

    const res = conciliarBancos(extracto, libros, 5000000, 5000000);
    assert.strictEqual(res.summary.totalConciliados, 1);
    assert.strictEqual(res.summary.cuadrado, true);
    assert.strictEqual(res.summary.diferenciaCuadre, 0);
    assert.ok(res.rows[0].nota.includes("Lote ACH"));
    assert.strictEqual(res.rows[0].itemsLibrosLote?.length, 2);
  });

  it("debe detectar cuentas de bancos y de fondos de inversión / carteras colectivas (Clase 1250)", () => {
    const mov: MovLine[] = [
      {
        cuenta: "11100512",
        cuentaNombre: "BANCO COLMENA BCSC",
        comprobante: "G 01",
        fecha: "2026-08-01",
        nit: "1",
        nombre: "A",
        descripcion: "",
        cruce: "",
        debito: 100,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "12503511",
        cuentaNombre: "CREDICORP CAPITAL - FONVAL",
        comprobante: "R 01",
        fecha: "2026-08-01",
        nit: "2",
        nombre: "B",
        descripcion: "",
        cruce: "",
        debito: 500,
        credito: 200,
        observacion: "",
      },
      {
        cuenta: "41350501",
        cuentaNombre: "VENTAS COMERCIALES",
        comprobante: "F 01",
        fecha: "2026-08-01",
        nit: "3",
        nombre: "C",
        descripcion: "",
        cruce: "",
        debito: 0,
        credito: 400,
        observacion: "",
      },
    ];

    const bancos = extractLibroBancos(mov);
    assert.strictEqual(bancos.length, 2);

    const cuentas = getAvailableBankAccounts(mov);
    assert.strictEqual(cuentas.length, 2);
    assert.strictEqual(cuentas[0].cuenta, "11100512");
    assert.strictEqual(cuentas[1].cuenta, "12503511");
  });
});

