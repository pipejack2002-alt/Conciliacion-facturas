import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractVoucherRoot,
  findVoucherLinesInMov,
  resolveVoucherFullEntry,
} from "./voucher-entry-resolver.ts";
import type { MovLine } from "./types.ts";

describe("Voucher Entry Resolver (Asiento Contable Completo y Contrapartida)", () => {
  describe("extractVoucherRoot", () => {
    it("debe extraer la raíz eliminando el índice de secuencia numérico al final", () => {
      assert.equal(extractVoucherRoot("G 002 00000002743 002"), "g 002 00000002743");
      assert.equal(extractVoucherRoot("G 002 00000002743 001"), "g 002 00000002743");
      assert.equal(extractVoucherRoot("CE-00124-02"), "ce-00124");
      assert.equal(extractVoucherRoot("L 007 00000000067 010"), "l 007 00000000067");
    });
  });

  describe("findVoucherLinesInMov", () => {
    const mockLedger: MovLine[] = [
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES NACIONALES",
        comprobante: "G 002 00000002743 001",
        fecha: "2026-08-04",
        nit: "900123456",
        nombre: "ALEXANDER VILLA URUETA",
        descripcion: "PAGO FACTURA PROVEEDOR 000000000008",
        cruce: "000000000008",
        observacion: "",
        debito: 1067671,
        credito: 0,
      },
      {
        cuenta: "11100512",
        cuentaNombre: "BANCO COLMENA BCSC",
        comprobante: "G 002 00000002743 002",
        fecha: "2026-08-04",
        nit: "900123456",
        nombre: "ALEXANDER VILLA URUETA",
        descripcion: "DEBITO ACH LOTE 0007068610",
        cruce: "000000000008",
        observacion: "",
        debito: 0,
        credito: 1067671,
      },
    ];

    it("debe encontrar ambas líneas del comprobante aunque tengan secuencias 001 y 002", () => {
      const lines = findVoucherLinesInMov("G 002 00000002743 002", mockLedger);
      assert.equal(lines.length, 2);
      assert.equal(lines[0].cuenta, "22050501");
      assert.equal(lines[1].cuenta, "11100512");
    });
  });

  describe("resolveVoucherFullEntry", () => {
    it("debe resolver contrapartida deducida a cuenta 220505 cuando solo se cargó el auxiliar de bancos", () => {
      const bankOnlyLine: MovLine = {
        cuenta: "11100512",
        cuentaNombre: "BANCO COLMENA BCSC",
        comprobante: "G 002 00000002743 002",
        fecha: "2026-08-04",
        nit: "900123456",
        nombre: "ALEXANDER VILLA URUETA",
        descripcion: "DEBITO AUTORIZADO POR ACH",
        cruce: "000000000008",
        observacion: "",
        debito: 0,
        credito: 1067671,
      };

      const resolved = resolveVoucherFullEntry(
        "G 002 00000002743 002",
        bankOnlyLine,
        [bankOnlyLine]
      );

      assert.equal(resolved.isPartidaDobleCuadrada, true);
      assert.equal(resolved.totalDebito, 1067671);
      assert.equal(resolved.totalCredito, 1067671);
      assert.equal(resolved.lines.length, 2);
      assert.equal(resolved.contrapartidaResumen.tipo, "proveedor");
      assert.equal(resolved.contrapartidaResumen.cuenta, "220505");
      assert.ok(resolved.contrapartidaResumen.descripcionCruce.includes("ALEXANDER VILLA URUETA"));
      assert.ok(resolved.contrapartidaResumen.descripcionCruce.includes("220505"));
    });

    it("debe resolver contrapartida a cuenta 511570 (GMF 4x1000) para comprobante L de gravamen bancario", () => {
      const gmfLine: MovLine = {
        cuenta: "11100512",
        cuentaNombre: "BANCO COLMENA BCSC",
        comprobante: "L 007 00000000067 010",
        fecha: "2026-08-31",
        nit: "",
        nombre: "",
        descripcion: "GMF AGOSTO 2026",
        cruce: "",
        observacion: "",
        debito: 0,
        credito: 209544,
      };

      const resolved = resolveVoucherFullEntry(
        "L 007 00000000067 010",
        gmfLine,
        [gmfLine]
      );

      assert.equal(resolved.isPartidaDobleCuadrada, true);
      assert.equal(resolved.totalDebito, 209544);
      assert.equal(resolved.totalCredito, 209544);
      assert.equal(resolved.contrapartidaResumen.tipo, "gmf");
      assert.equal(resolved.contrapartidaResumen.cuenta, "511570");
      assert.ok(resolved.contrapartidaResumen.descripcionCruce.includes("511570"));
    });
  });
});
