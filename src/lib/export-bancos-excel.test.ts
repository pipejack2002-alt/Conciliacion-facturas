import test from "node:test";
import assert from "node:assert/strict";
import {
  exportConciliacionBancariaXlsx,
  exportAsientoAjusteBancario,
} from "./export-bancos-excel.ts";
import type { BankConciliacionResult, BankConciliacionRow } from "./conciliar-bancos.ts";
import type { MovLine } from "./types.ts";

test("Exportador Prémium de Conciliación Bancaria y Asientos de Ajuste", async (t) => {
  const mockRows: BankConciliacionRow[] = [
    {
      id: "row_1",
      estado: "conciliado",
      fecha: "2026-07-02",
      descripcion: "PAGO FACTURA 4012",
      referencia: "TRANS-4012",
      tipo: "retiro",
      montoBanco: 12500000,
      montoLibros: 12500000,
      diferencia: 0,
      esGmf: false,
      esComision: false,
      esRendimiento: false,
      itemLibros: {
        cuenta: "111005",
        cuentaNombre: "Banco Caja Social",
        comprobante: "EG-101",
        fecha: "2026-07-02",
        nit: "900123456",
        nombre: "PROVEEDOR ABC SAS",
        descripcion: "Pago Factura 4012",
        cruce: "FACT-4012",
        debito: 0,
        credito: 12500000,
        observacion: "",
      },
      nota: "Conciliado exacto con Egreso EG-101",
    },
    {
      id: "row_2",
      estado: "nota_debito_banco",
      fecha: "2026-07-15",
      descripcion: "GRAVAMEN MOVIMIENTO FINANCIERO GMF 4X1000",
      referencia: "GMF-0715",
      tipo: "retiro",
      montoBanco: 50000,
      montoLibros: 0,
      diferencia: 50000,
      esGmf: true,
      esComision: false,
      esRendimiento: false,
      nota: "Débito en extracto no registrado en libros",
    },
    {
      id: "row_3",
      estado: "nota_credito_banco",
      fecha: "2026-07-31",
      descripcion: "RENDIMIENTO FINANCIERO CUENTA DE AHORROS",
      referencia: "REND-0731",
      tipo: "consignacion",
      montoBanco: 15400,
      montoLibros: 0,
      diferencia: -15400,
      esGmf: false,
      esComision: false,
      esRendimiento: true,
      nota: "Abono de rendimientos financieros no causado",
    },
    {
      id: "row_4",
      estado: "partida_en_transito_libros",
      fecha: "2026-07-28",
      descripcion: "PAGO CHEQUE 5510",
      referencia: "5510",
      tipo: "retiro",
      montoBanco: 0,
      montoLibros: 3200000,
      diferencia: -3200000,
      esGmf: false,
      esComision: false,
      esRendimiento: false,
      itemLibros: {
        cuenta: "111005",
        cuentaNombre: "Banco Caja Social",
        comprobante: "CH-5510",
        fecha: "2026-07-28",
        nit: "800999111",
        nombre: "ARRENDAMIENTOS SAS",
        descripcion: "Pago arriendo",
        cruce: "CH-5510",
        debito: 0,
        credito: 3200000,
        observacion: "",
      },
      nota: "Cheque girado en libros no cobrado en banco",
    },
  ];

  const mockResult: BankConciliacionResult = {
    rows: mockRows,
    summary: {
      saldoExtracto: 20000000,
      saldoLibros: 23165400,
      consignacionesEnTransito: 0,
      chequesEnTransito: 3200000,
      notasDebitoNoRegistradas: 50000,
      notasCreditoNoRegistradas: 15400,
      saldoConciliado: 23165400,
      diferenciaCuadre: 0,
      cuadrado: true,
      totalItemsBanco: 3,
      totalItemsLibros: 2,
      totalConciliados: 1,
    },
    cuentasBancosDetectadas: ["111005"],
  };

  const mockAllMovLines: MovLine[] = [
    {
      cuenta: "220505",
      cuentaNombre: "Proveedores Nacionales",
      comprobante: "EG-101",
      fecha: "2026-07-02",
      nit: "900123456",
      nombre: "PROVEEDOR ABC SAS",
      descripcion: "Pago Factura 4012",
      cruce: "FACT-4012",
      debito: 12500000,
      credito: 0,
      observacion: "",
    },
    {
      cuenta: "111005",
      cuentaNombre: "Banco Caja Social",
      comprobante: "EG-101",
      fecha: "2026-07-02",
      nit: "900123456",
      nombre: "PROVEEDOR ABC SAS",
      descripcion: "Pago Factura 4012",
      cruce: "FACT-4012",
      debito: 0,
      credito: 12500000,
      observacion: "",
    },
  ];

  await t.test("debe generar estructura de conciliación bancaria sin errores", () => {
    assert.doesNotThrow(() => {
      exportConciliacionBancariaXlsx(
        mockResult,
        {
          bancoNombre: "Banco Caja Social",
          numeroCuenta: "24001234567",
          periodo: "Julio 2026",
          cuentaContable: "111005",
        },
        mockAllMovLines
      );
    });
  });

  await t.test("debe exportar comprobante de ajuste bancario para software contable", () => {
    assert.doesNotThrow(() => {
      exportAsientoAjusteBancario(mockRows, "Banco Caja Social", "111005");
    });
  });

  await t.test("debe verificar que las líneas contables de un comprobante tienen partida doble", () => {
    const linesOfVoucher = mockAllMovLines.filter((m) => m.comprobante === "EG-101");
    const totalDeb = linesOfVoucher.reduce((a, b) => a + b.debito, 0);
    const totalCred = linesOfVoucher.reduce((a, b) => a + b.credito, 0);
    assert.equal(totalDeb, 12500000);
    assert.equal(totalCred, 12500000);
    assert.equal(totalDeb - totalCred, 0);
  });

  // Limpieza de archivos generados por la prueba en entorno Node
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const files = fs.readdirSync(process.cwd());
    for (const f of files) {
      if (f.startsWith("Conciliacion_Bancaria_Oficial") || f.startsWith("Asiento_Ajuste_Bancario")) {
        fs.unlinkSync(path.join(process.cwd(), f));
      }
    }
  } catch {
    // Silently ignore
  }
});
