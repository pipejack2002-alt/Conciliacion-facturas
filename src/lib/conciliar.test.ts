import { describe, it } from "node:test";
import assert from "node:assert";
import { conciliar } from "./conciliar.ts";
import type { DianDoc, MovLine } from "./types.ts";

describe("Motor de Conciliación DIAN vs Libros (Multi-Empresa)", () => {
  it("debe conciliar correctamente documentos soporte con emisión P-005 y causación P-002 de forma agnóstica", () => {
    const dian: DianDoc[] = [
      {
        tipo: "Documento soporte con no obligados",
        cufe: "CUFE123456",
        folio: "3821",
        prefijo: "DSEC",
        fechaEmision: "2026-07-31",
        fechaRecepcion: "2026-07-31",
        nitEmisor: "900123456",
        nombreEmisor: "EMPRESA MODELO PRINCIPAL S.A.S.",
        nitReceptor: "60347569",
        nombreReceptor: "PROVEEDOR DE SERVICIOS EJEMPLO",
        iva: 0,
        total: 7984000,
        estadoDian: "Aceptado",
        grupo: "Emitido",
      },
    ];

    const mov: MovLine[] = [
      {
        cuenta: "51050601",
        cuentaNombre: "Sueldos",
        comprobante: "P 005 00000003821 001",
        fecha: "2026-07-31",
        nit: "60347569",
        nombre: "PROVEEDOR DE SERVICIOS EJEMPLO",
        descripcion: "SERV DE COMEDOR JULIO",
        cruce: "DSEC-3821",
        debito: 7984000,
        credito: 0,
        observacion: "",
      },
    ];

    const res = conciliar(dian, mov, "JUL 2026");
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.rows[0].totalDian, 7984000);
    assert.strictEqual(res.rows[0].diferencia, 0);
  });

  it("debe conciliar documentos soporte con emisión P-004 y causación P-001 de forma agnóstica", () => {
    const dian: DianDoc[] = [
      {
        tipo: "Documento soporte con no obligados",
        cufe: "CUFE-DSNE787",
        folio: "787",
        prefijo: "DSNE",
        fechaEmision: "2026-07-31",
        fechaRecepcion: "2026-07-31",
        nitEmisor: "900987654",
        nombreEmisor: "EMPRESA INDUSTRIAL DE PRUEBA S.A.S.",
        nitReceptor: "9540062",
        nombreReceptor: "CONSULTOR ASESOR EJEMPLO",
        iva: 0,
        total: 2000000,
        estadoDian: "Aceptado",
        grupo: "Emitido",
      },
    ];

    const mov: MovLine[] = [
      {
        cuenta: "73109501",
        cuentaNombre: "Honorarios SST",
        comprobante: "P 004 00000000787 001",
        fecha: "2026-07-31",
        nit: "9540062",
        nombre: "CONSULTOR ASESOR EJEMPLO",
        descripcion: "CC82 HONORARIOS ASESORIA SST",
        cruce: "DSNE-787",
        debito: 2000000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050101",
        cuentaNombre: "Proveedores",
        comprobante: "P 001 00000000155 001",
        fecha: "2026-07-31",
        nit: "9540062",
        nombre: "CONSULTOR ASESOR EJEMPLO",
        descripcion: "DSNE787 HONORARIOS ASESORIA SST",
        cruce: "P-004-00000000082-001",
        debito: 2000000,
        credito: 0,
        observacion: "",
      },
    ];

    const res = conciliar(dian, mov, "JUL 2026");
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.rows[0].comprobantes.length, 2);
    assert.strictEqual(res.totals.duplicados, 0);
  });

  it("debe excluir egresos bancarios (G) de los comprobantes de causación evitando duplicados falsos", () => {
    const dian: DianDoc[] = [
      {
        tipo: "Factura electrónica",
        cufe: "CUFE-CE1751",
        folio: "1751",
        prefijo: "CE",
        fechaEmision: "2026-07-15",
        fechaRecepcion: "2026-07-15",
        nitEmisor: "901047340",
        nombreEmisor: "CONSULTORES FINANCIEROS Y CONTABLES S.A.S.",
        nitReceptor: "900123456",
        nombreReceptor: "EMPRESA MODELO PRINCIPAL S.A.S.",
        iva: 95000,
        total: 595000,
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const mov: MovLine[] = [
      {
        cuenta: "51102501",
        cuentaNombre: "Honorarios",
        comprobante: "P 002 00000010432 001",
        fecha: "2026-07-15",
        nit: "901047340",
        nombre: "CONSULTORES FINANCIEROS Y CONTABLES S.A.S.",
        descripcion: "CE1751 HONORARIOS ASESORIA",
        cruce: "P-002-00000001751-001",
        debito: 500000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "24080326",
        cuentaNombre: "IVA Descontable",
        comprobante: "P 002 00000010432 002",
        fecha: "2026-07-15",
        nit: "901047340",
        nombre: "CONSULTORES FINANCIEROS Y CONTABLES S.A.S.",
        descripcion: "CE1751 HONORARIOS ASESORIA",
        cruce: "",
        debito: 95000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "11100501",
        cuentaNombre: "Bancos",
        comprobante: "G 001 00000009574 001",
        fecha: "2026-07-20",
        nit: "901047340",
        nombre: "CONSULTORES FINANCIEROS Y CONTABLES S.A.S.",
        descripcion: "PAGO CE1751",
        cruce: "P-002-00000001751-001",
        debito: 0,
        credito: 595000,
        observacion: "",
      },
    ];

    const res = conciliar(dian, mov, "JUL 2026");
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.rows[0].comprobantes.length, 1);
    assert.strictEqual(res.rows[0].comprobantes[0], "P 002 00000010432");
  });

  it("debe cruzar notas de crédito registradas con comprobantes U", () => {
    const dian: DianDoc[] = [
      {
        tipo: "Nota de crédito electrónica",
        cufe: "CUFE-NC260",
        folio: "260",
        prefijo: "NCAA",
        fechaEmision: "2026-07-08",
        fechaRecepcion: "2026-07-08",
        nitEmisor: "900245560",
        nombreEmisor: "EMPRESA DE SERVICIOS Y SEGURIDAD LTDA",
        nitReceptor: "900123456",
        nombreReceptor: "EMPRESA MODELO PRINCIPAL S.A.S.",
        iva: 380936,
        total: 20430175,
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const mov: MovLine[] = [
      {
        cuenta: "22050101",
        cuentaNombre: "Proveedores",
        comprobante: "U 001 00000000224 002",
        fecha: "2026-07-08",
        nit: "900245560",
        nombre: "EMPRESA DE SERVICIOS Y SEGURIDAD LTDA",
        descripcion: "NC NCAA260 AJUSTE FACTURA",
        cruce: "NCAA-260",
        debito: 0,
        credito: 20430175,
        observacion: "",
      },
    ];

    const res = conciliar(dian, mov, "JUL 2026");
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.rows[0].comprobantes[0], "U 001 00000000224");
  });

  it("debe detectar sugerencias tributarias de Retefuente, IVA y redondeo con getTaxInsight", async () => {
    const { getTaxInsight } = await import("./tax-insights.ts");

    // Caso 1: Redondeo de centavos
    const rowRedondeo = {
      id: "1",
      estado: "diferencia" as const,
      grupo: "Recibido",
      tipo: "Factura electrónica",
      prefijo: "FE",
      folio: "100",
      numero: "FE-100",
      cufe: "CUFE1",
      fecha: "2026-07-15",
      nitContraparte: "900123456",
      nombreContraparte: "PROVEEDOR MODELO S.A.S.",
      iva: 190000,
      totalDian: 1190000,
      totalSiigo: 1189950,
      diferencia: 50,
      hits: [],
      comprobantes: [],
      matchVia: "test",
      prioridad: "audit" as const,
      linked: [],
      alerta: "",
    };
    const insightRedondeo = getTaxInsight(rowRedondeo);
    assert.ok(insightRedondeo);
    assert.strictEqual(insightRedondeo.tipo, "redondeo");

    // Caso 2: Retefuente 2.5% sobre subtotal
    const rowRete = {
      ...rowRedondeo,
      totalDian: 10000000,
      iva: 0,
      totalSiigo: 9750000,
      diferencia: 250000,
    };
    const insightRete = getTaxInsight(rowRete);
    assert.ok(insightRete);
    assert.strictEqual(insightRete.tipo, "retefuente");
    assert.strictEqual(insightRete.tarifa, "2.5%");

    // Caso 3: Causación sin IVA (19%)
    const rowSinIva = {
      ...rowRedondeo,
      totalDian: 11900000,
      iva: 1900000,
      totalSiigo: 10000000,
      diferencia: 1900000,
    };
    const insightSinIva = getTaxInsight(rowSinIva);
    assert.ok(insightSinIva);
    assert.strictEqual(insightSinIva.tipo, "iva");
    assert.strictEqual(insightSinIva.tarifa, "19%");
  });

  it("debe dejar como pendiente (por registrar) facturas cuando en libros solo hay ajustes de rendimientos (PUC 12)", () => {
    const dianDocs: DianDoc[] = [
      {
        tipo: "Factura electrónica",
        cufe: "cufe-credicorp-12345",
        folio: "30340",
        prefijo: "FCBO",
        fechaEmision: "2026-07-15",
        fechaRecepcion: "2026-07-15",
        nitEmisor: "860068182",
        nombreEmisor: "CREDICORP CAPITAL COLOMBIA S.A.",
        nitReceptor: "800148462",
        nombreReceptor: "CI CARBONES DE SANTANDER S.A.S.",
        iva: 11915.28,
        total: 74627.28,
        estadoDian: "Aprobado",
        grupo: "Recibido",
      },
    ];

    // En libros solo hay un ajuste L 001 de rendimientos de junio con cuenta 12 y valor 59.895
    const movLines: MovLine[] = [
      {
        cuenta: "12450541",
        cuentaNombre: "SERFINCO CARTERA COLECTIVA",
        comprobante: "L 001 00000000118 006",
        fecha: "2026-07-01",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL COLOMBIA S.A",
        descripcion: "RENDIMIENTOS JUNIO",
        cruce: "",
        debito: 59895.42,
        credito: 0,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "JUL 2026");
    const row = res.rows[0];

    // La factura de julio de Credicorp NO está registrada, debe ser 'pendiente'
    assert.strictEqual(row.estado, "pendiente");
    assert.strictEqual(row.totalSiigo, 0);
    assert.strictEqual(row.diferencia, 74627.28);
  });
});
