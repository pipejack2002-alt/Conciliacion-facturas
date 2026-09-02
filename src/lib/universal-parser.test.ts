import { describe, it } from "node:test";
import assert from "node:assert";
import { conciliar } from "./conciliar.ts";
import { detectSoftwareProfile, buildMappingFromHeaders } from "./software-profiles.ts";
import type { DianDoc, MovLine } from "./types.ts";

describe("Motor Universal de Conciliación Multi-Software (World Office, Siigo Nube, Helisa, Alegra)", () => {
  it("debe conciliar correctamente movimientos de World Office usando columna de referencia (Doc. Fuente)", () => {
    const dian: DianDoc[] = [
      {
        tipo: "Factura electrónica de venta",
        cufe: "CUFE-WO-123",
        folio: "9821",
        prefijo: "FAC",
        fechaEmision: "2026-07-15",
        fechaRecepcion: "2026-07-15",
        nitEmisor: "900555666",
        nombreEmisor: "PROVEEDOR WORLD OFFICE S.A.S.",
        nitReceptor: "900123456",
        nombreReceptor: "EMPRESA CLIENTE S.A.S.",
        iva: 190000,
        total: 1190000,
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const mov: MovLine[] = [
      {
        cuenta: "51050601",
        cuentaNombre: "Suministros y materiales",
        comprobante: "CD-000045", // Comprobante interno diario de World Office
        fecha: "2026-07-15",
        nit: "900555666",
        nombre: "PROVEEDOR WORLD OFFICE S.A.S.",
        descripcion: "COMPRA MATERIAL DE OFICINA MES JULIO",
        cruce: "",
        referencia: "FAC-9821", // Documento de Referencia en World Office
        debito: 1190000,
        credito: 0,
        observacion: "",
        origenSoftware: "world_office",
      },
    ];

    const res = conciliar(dian, mov, "JUL 2026");
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.rows[0].numero, "FAC-9821");
    assert.strictEqual(res.rows[0].totalDian, 1190000);
    assert.strictEqual(res.rows[0].diferencia, 0);
  });

  it("debe conciliar movimientos de Siigo Nube con comprobantes tipo FC-1 y factura externa", () => {
    const dian: DianDoc[] = [
      {
        tipo: "Factura electrónica de venta",
        cufe: "CUFE-SN-456",
        folio: "4521",
        prefijo: "SETT",
        fechaEmision: "2026-07-20",
        fechaRecepcion: "2026-07-20",
        nitEmisor: "800111222",
        nombreEmisor: "DISTRIBUIDORA NUBE COLOMBIA S.A.S.",
        nitReceptor: "900123456",
        nombreReceptor: "EMPRESA CLIENTE S.A.S.",
        iva: 95000,
        total: 595000,
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const mov: MovLine[] = [
      {
        cuenta: "14350501",
        cuentaNombre: "Mercancías no fabricadas",
        comprobante: "FC-1-105", // Comprobante Siigo Nube
        fecha: "2026-07-20",
        nit: "800111222",
        nombre: "DISTRIBUIDORA NUBE COLOMBIA S.A.S.",
        descripcion: "COMPRA PRODUCTOS COMERCIALES",
        cruce: "",
        referencia: "SETT4521",
        debito: 595000,
        credito: 0,
        observacion: "",
        origenSoftware: "siigo_nube",
      },
    ];

    const res = conciliar(dian, mov, "JUL 2026");
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.rows[0].diferencia, 0);
  });

  it("debe conciliar movimientos de Helisa con comprobantes numéricos 01 y cheque/referencia", () => {
    const dian: DianDoc[] = [
      {
        tipo: "Factura electrónica de venta",
        cufe: "CUFE-HEL-789",
        folio: "1045",
        prefijo: "FE",
        fechaEmision: "2026-07-10",
        fechaRecepcion: "2026-07-10",
        nitEmisor: "700333444",
        nombreEmisor: "SERVICIOS TECNICOS HELISA SAS",
        nitReceptor: "900123456",
        nombreReceptor: "EMPRESA CLIENTE S.A.S.",
        iva: 0,
        total: 2500000,
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const mov: MovLine[] = [
      {
        cuenta: "22050501",
        cuentaNombre: "Proveedores nacionales",
        comprobante: "01-000240", // Helisa Comprobante
        fecha: "2026-07-10",
        nit: "700333444",
        nombre: "SERVICIOS TECNICOS HELISA SAS",
        descripcion: "CAUSACION MANTENIMIENTO PLANTA",
        cruce: "",
        referencia: "FE-1045", // Cheque / Referencia
        debito: 2500000,
        credito: 0,
        observacion: "",
        origenSoftware: "helisa",
      },
    ];

    const res = conciliar(dian, mov, "JUL 2026");
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.rows[0].diferencia, 0);
  });
});

describe("Detección Automática de Software y Mapeo de Columnas", () => {
  it("debe detectar World Office por sus firmas de cabecera", () => {
    const sampleRows = [
      ["World Office Colombia S.A.S. - Libro Auxiliar"],
      ["Empresa Ejemplo NIT 900123456"],
      [],
      ["Fecha", "Tipo Documento", "Número", "Documento de Referencia", "Identificación", "Tercero", "Cuenta", "Detalle", "Débito", "Crédito"],
      ["2026-07-15", "FC", "45", "FAC-9821", "900555666", "PROVEEDOR WO", "510506", "COMPRA", 1000, 0],
    ];

    const detected = detectSoftwareProfile(sampleRows);
    assert.strictEqual(detected.id, "world_office");
    assert.strictEqual(detected.headerRow, 3);
    assert.strictEqual(detected.mapping.referencia, 3);
    assert.strictEqual(detected.mapping.nit, 4);
    assert.strictEqual(detected.mapping.nombre, 5);
    assert.strictEqual(detected.mapping.cuenta, 6);
    assert.strictEqual(detected.mapping.descripcion, 7);
    assert.strictEqual(detected.mapping.debito, 8);
    assert.strictEqual(detected.mapping.credito, 9);
  });

  it("debe detectar Siigo Pyme por INVENTARIO-CRUCE-CHEQUE", () => {
    const sampleRows = [
      ["Siigo - EMPRESA S.A.S."],
      ["MOVIMIENTO CUENTAS - GENERAL"],
      [],
      [],
      [],
      [],
      ["CUENTA DESCRIPCION", "CUENTA", "DESCRIPCION", "SALDO INICIAL", "COMPROBANTE", "FECHA", "NIT", "NOMBRE", "DESCRIPCION", "INVENTARIO-CRUCE-CHEQUE", "BASE", "CC SCC", "DEBITOS", "CREDITOS", "SALDO MOV.", "OBSERVACION"],
    ];

    const detected = detectSoftwareProfile(sampleRows);
    assert.strictEqual(detected.id, "siigo_pyme");
    assert.strictEqual(detected.headerRow, 6);
    assert.strictEqual(detected.mapping.comprobante, 4);
    assert.strictEqual(detected.mapping.nit, 6);
    assert.strictEqual(detected.mapping.cruce, 9);
    assert.strictEqual(detected.mapping.debito, 12);
    assert.strictEqual(detected.mapping.credito, 13);
  });

  it("debe mapear correctamente un Excel con nombres de columna libres o genéricos", () => {
    const headers = ["Cód. Cuenta", "Fecha Doc", "Nro Transacción", "Cédula / NIT", "Razón Social", "Concepto del Gasto", "Doc. Fuente", "Importe Débito", "Importe Crédito"];
    const mapping = buildMappingFromHeaders(headers, "custom");

    assert.strictEqual(mapping.cuenta, 0);
    assert.strictEqual(mapping.fecha, 1);
    assert.strictEqual(mapping.comprobante, 2);
    assert.strictEqual(mapping.nit, 3);
    assert.strictEqual(mapping.nombre, 4);
    assert.strictEqual(mapping.descripcion, 5);
    assert.strictEqual(mapping.referencia, 6);
    assert.strictEqual(mapping.debito, 7);
    assert.strictEqual(mapping.credito, 8);
  });
});
