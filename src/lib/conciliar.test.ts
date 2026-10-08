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

    // Caso 4: Semáforo de Riesgo Fiscal RADIAN / Art. 771-2 E.T. (Factura comercial a crédito sin acuses)
    const rowRiesgoRadian = {
      ...rowRedondeo,
      estado: "pendiente" as const,
      totalDian: 8500000,
      totalSiigo: 0,
      diferencia: 8500000,
      nombreContraparte: "DISTRIBUIDORA INDUSTRIAL S.A.S.",
    };
    const insightRadian = getTaxInsight(rowRiesgoRadian);
    assert.ok(insightRadian);
    assert.strictEqual(insightRadian.tipo, "riesgo_fiscal_radian");
    assert.ok(insightRadian.detalle.includes("Art. 771-2"));

    // Caso 5: Exclusión de facturas de CONTADO (Art. 771-2 E.T. y Res. 000085 DIAN)
    // Factura con forma de pago explícita "Contado" o código "1"
    const rowContadoExplicito = {
      ...rowRedondeo,
      estado: "pendiente" as const,
      totalDian: 3200000,
      totalSiigo: 0,
      diferencia: 3200000,
      formaPago: "Contado",
      nombreContraparte: "SUMINISTROS Y TECNOLOGÍA S.A.S.",
    };
    const insightContado = getTaxInsight(rowContadoExplicito);
    assert.ok(insightContado);
    assert.notStrictEqual(insightContado.tipo, "riesgo_fiscal_radian");
    assert.strictEqual(insightContado.etiqueta, "Contado (No requiere acuses)");
    assert.ok(insightContado.detalle.includes("NO requiere acuses"));

    // Caso 6: Proveedor intrínseco de combustible / caja menor
    const rowCombustible = {
      ...rowRedondeo,
      estado: "pendiente" as const,
      totalDian: 450000,
      totalSiigo: 0,
      diferencia: 450000,
      nombreContraparte: "ORGANIZACION TERPEL S.A.",
    };
    const insightCombustible = getTaxInsight(rowCombustible);
    assert.ok(insightCombustible);
    assert.notStrictEqual(insightCombustible.tipo, "riesgo_fiscal_radian");
    assert.strictEqual(insightCombustible.etiqueta, "Gasto de Combustible");

    // Caso 7: Proveedor intrínseco de retail/mostrador de contado (Exito, D1, Ara, Cruz Verde)
    const rowRetail = {
      ...rowRedondeo,
      estado: "pendiente" as const,
      totalDian: 210000,
      totalSiigo: 0,
      diferencia: 210000,
      nombreContraparte: "ALMACENES EXITO S.A.",
    };
    const insightRetail = getTaxInsight(rowRetail);
    assert.ok(insightRetail);
    assert.notStrictEqual(insightRetail.tipo, "riesgo_fiscal_radian");
    assert.strictEqual(insightRetail.etiqueta, "Contado (No requiere acuses)");
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

  it("debe conciliar comisiones bancarias registradas en comprobante L con cuenta 530515 por el total con IVA", () => {
    const dianDocs: DianDoc[] = [
      {
        tipo: "Factura electrónica",
        cufe: "cufe-comision-banco",
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

    const movLines: MovLine[] = [
      {
        cuenta: "53051501",
        cuentaNombre: "COMISIONES BANCARIAS",
        comprobante: "L 001 00000000120 001",
        fecha: "2026-07-15",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL COLOMBIA S.A",
        descripcion: "COMISION BANCARIA CON IVA TRANSFERENCIAS",
        cruce: "",
        debito: 74627.28,
        credito: 0,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "JUL 2026");
    const row = res.rows[0];

    assert.strictEqual(row.estado, "conciliado");
    assert.strictEqual(row.totalSiigo, 74627.28);
    assert.strictEqual(row.diferencia, 0);
  });

  it("debe conciliar comisiones bancarias con IVA discriminado en comprobantes multilínea (ej. World Office N 001)", () => {
    const dianDocs: DianDoc[] = [
      {
        tipo: "Factura electrónica",
        cufe: "cufe-comision-wo",
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

    const movLines: MovLine[] = [
      {
        cuenta: "53051501",
        cuentaNombre: "COMISIONES",
        comprobante: "N 001 00000000045 001",
        fecha: "2026-07-15",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL COLOMBIA S.A",
        descripcion: "COMISION BANCARIA TRASLADOS",
        cruce: "",
        debito: 62712,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "24080315",
        cuentaNombre: "IVA DESCONTABLE SERVICIOS",
        comprobante: "N 001 00000000045 002",
        fecha: "2026-07-15",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL COLOMBIA S.A",
        descripcion: "IVA COMISION BANCARIA",
        cruce: "",
        debito: 11915.28,
        credito: 0,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "JUL 2026");
    const row = res.rows[0];

    assert.strictEqual(row.estado, "conciliado");
    assert.strictEqual(row.totalSiigo, 74627.28);
    assert.strictEqual(row.diferencia, 0);
    assert.ok(row.matchVia.includes("IVA discriminado"));
  });

  it("debe detectar ajuste por TRM entre Nota Crédito que anula causación previa y Factura re-emitida", () => {
    const dianDocs: DianDoc[] = [
      {
        tipo: "Nota de crédito electrónica",
        cufe: "cufe-nc-bolivar",
        folio: "17098534",
        prefijo: "NCPO",
        fechaEmision: "2026-07-25",
        fechaRecepcion: "2026-07-25",
        nitEmisor: "860002503",
        nombreEmisor: "COMPANIA DE SEGUROS BOLIVAR S.A.",
        nitReceptor: "800148462",
        nombreReceptor: "CI CARBONES DE SANTANDER S.A.S.",
        iva: 1797276,
        total: 37742786,
        estadoDian: "Aprobado",
        grupo: "Recibido",
      },
      {
        tipo: "Factura electrónica",
        cufe: "cufe-pol-bolivar",
        folio: "16729397",
        prefijo: "POL",
        fechaEmision: "2026-07-29",
        fechaRecepcion: "2026-07-29",
        nitEmisor: "860002503",
        nombreEmisor: "COMPANIA DE SEGUROS BOLIVAR S.A.",
        nitReceptor: "800148462",
        nombreReceptor: "CI CARBONES DE SANTANDER S.A.S.",
        iva: 1692762,
        total: 35548000,
        estadoDian: "Aprobado",
        grupo: "Recibido",
      },
    ];

    const movLines: MovLine[] = [
      {
        cuenta: "22050101",
        cuentaNombre: "NACIONALES",
        comprobante: "P 002 00000010406 003",
        fecha: "2026-07-01",
        nit: "860002503",
        nombre: "COMPAÑIA DE SEGUROS BOLIVAR S.A.",
        descripcion: "COMPAÑIA DE SEGUROS BOLIVAR S.A.",
        cruce: "P-002-00016555166-001",
        debito: 0,
        credito: 37742785.5,
        observacion: "",
      },
      {
        cuenta: "22050101",
        cuentaNombre: "NACIONALES",
        comprobante: "G 001 00000009577 001",
        fecha: "2026-07-24",
        nit: "860002503",
        nombre: "COMPAÑIA DE SEGUROS BOLIVAR S.A.",
        descripcion: "PAG POL-16555166 USD 10.376",
        cruce: "P-002-00016555166-001",
        debito: 37742785.5,
        credito: 0,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "JUL 2026");
    const ncRow = res.rows.find((r) => r.numero.includes("17098534"))!;
    const polRow = res.rows.find((r) => r.numero.includes("16729397"))!;

    assert.strictEqual(ncRow.estado, "cruce_nc");
    assert.strictEqual(polRow.estado, "pendiente");
    assert.strictEqual(ncRow.linked.length, 1);
    assert.strictEqual(ncRow.linked[0].numero, "POL-16729397");
    assert.strictEqual(polRow.linked.length, 1);
    assert.strictEqual(polRow.linked[0].numero, "NCPO-17098534");
  });

  it("debe conciliar facturas que cruzan con anticipos sin marcarlas como duplicadas", () => {
    const dianDocs: DianDoc[] = [
      {
        grupo: "Recibido",
        tipo: "Factura electrónica",
        prefijo: "FV",
        folio: "1118",
        cufe: "CUFE1118",
        fechaEmision: "2026-07-28",
        fechaRecepcion: "2026-07-28",
        nitEmisor: "901234567",
        nombreEmisor: "PROVEEDOR MANTENIMIENTO SAS",
        nitReceptor: "900562357",
        nombreReceptor: "EMPRESA RECEPTORA SAS",
        estadoDian: "Aceptado",
        iva: 335294,
        total: 2100000,
      },
    ];

    const movLines: MovLine[] = [
      // Comprobante 1: Causación de la factura cruzada contra anticipo previo
      {
        cuenta: "73454001",
        cuentaNombre: "MANTENIMIENTO",
        comprobante: "P 002 00000010469 001",
        fecha: "2026-07-28",
        nit: "901234567",
        nombre: "PROVEEDOR MANTENIMIENTO SAS",
        descripcion: "FV1118 REPARACION AC",
        cruce: "",
        debito: 1764706,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "24080326",
        cuentaNombre: "IVA DESCONTABLE",
        comprobante: "P 002 00000010469 002",
        fecha: "2026-07-28",
        nit: "901234567",
        nombre: "PROVEEDOR MANTENIMIENTO SAS",
        descripcion: "FV1118 REPARACION AC",
        cruce: "",
        debito: 335294,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "13300508",
        cuentaNombre: "ANTICIPOS A PROVEEDORES",
        comprobante: "P 002 00000010469 006",
        fecha: "2026-07-28",
        nit: "901234567",
        nombre: "PROVEEDOR MANTENIMIENTO SAS",
        descripcion: "FV1118 REPARACION AC",
        cruce: "P-002-00000010429-001",
        debito: 0,
        credito: 1957059,
        observacion: "",
      },
      // Comprobante 2: El anticipo previo
      {
        cuenta: "13300508",
        cuentaNombre: "ANTICIPOS A PROVEEDORES",
        comprobante: "P 002 00000010429 001",
        fecha: "2026-07-15",
        nit: "901234567",
        nombre: "PROVEEDOR MANTENIMIENTO SAS",
        descripcion: "ANT4413 REPARACION AC",
        cruce: "P-002-00000010429-001",
        debito: 1957059,
        credito: 0,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "JUL 2026");
    assert.strictEqual(res.rows.length, 1);
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.notStrictEqual(res.rows[0].estado, "duplicado");
  });

  it("debe totalizar compras en bloque del mismo día cuando se registran acumuladas en libros", () => {
    const dianDocs: DianDoc[] = [
      {
        grupo: "Recibido",
        tipo: "Factura electrónica",
        prefijo: "VRT",
        folio: "101",
        cufe: "CUFE101",
        fechaEmision: "2026-07-22",
        fechaRecepcion: "2026-07-22",
        nitEmisor: "890102010",
        nombreEmisor: "CAMARA DE COMERCIO DE BARRANQUILLA",
        nitReceptor: "900562357",
        nombreReceptor: "EMPRESA RECEPTORA SAS",
        estadoDian: "Aceptado",
        iva: 0,
        total: 12100,
      },
      {
        grupo: "Recibido",
        tipo: "Factura electrónica",
        prefijo: "VRT",
        folio: "102",
        cufe: "CUFE102",
        fechaEmision: "2026-07-22",
        fechaRecepcion: "2026-07-22",
        nitEmisor: "890102010",
        nombreEmisor: "CAMARA DE COMERCIO DE BARRANQUILLA",
        nitReceptor: "900562357",
        nombreReceptor: "EMPRESA RECEPTORA SAS",
        estadoDian: "Aceptado",
        iva: 0,
        total: 12100,
      },
      {
        grupo: "Recibido",
        tipo: "Factura electrónica",
        prefijo: "VRT",
        folio: "103",
        cufe: "CUFE103",
        fechaEmision: "2026-07-22",
        fechaRecepcion: "2026-07-22",
        nitEmisor: "890102010",
        nombreEmisor: "CAMARA DE COMERCIO DE BARRANQUILLA",
        nitReceptor: "900562357",
        nombreReceptor: "EMPRESA RECEPTORA SAS",
        estadoDian: "Aceptado",
        iva: 0,
        total: 12100,
      },
    ];

    const movLines: MovLine[] = [
      // Comprobante que registra el total acumulado de las 3 compras del día ($36.300)
      {
        cuenta: "51409501",
        cuentaNombre: "GASTOS LEGALES",
        comprobante: "P 002 00000010438 001",
        fecha: "2026-07-22",
        nit: "890102010",
        nombre: "CAMARA DE COMERCIO DE BARRANQUILLA",
        descripcion: "COMPRA DE CERTIFICADOS JULIO 2026",
        cruce: "",
        debito: 36300,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050101",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 002 00000010438 002",
        fecha: "2026-07-22",
        nit: "890102010",
        nombre: "CAMARA DE COMERCIO DE BARRANQUILLA",
        descripcion: "CAMARA DE COMERCIO DE BARRANQUILLA",
        cruce: "P-002-00000202607-001",
        debito: 0,
        credito: 36300,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "JUL 2026");
    assert.strictEqual(res.rows.length, 3);
    assert.strictEqual(res.rows[0].estado, "totalizado");
    assert.strictEqual(res.rows[1].estado, "totalizado");
    assert.strictEqual(res.rows[2].estado, "totalizado");
    assert.strictEqual(res.totals.soloSiigo, 0);
  });

  it("no debe sugerir comisión bancaria a la Cámara de Comercio de Bogotá", async () => {
    const { getTaxInsight } = await import("./tax-insights.ts");
    const rowCCB = {
      id: "ccb-1",
      estado: "pendiente" as const,
      grupo: "Recibido",
      tipo: "Factura electrónica",
      prefijo: "TV43",
      folio: "10894267",
      numero: "TV43-10894267",
      cufe: "CUFECCB",
      fecha: "2026-07-22",
      nitContraparte: "860007322",
      nombreContraparte: "CAMARA DE COMERCIO DE BOGOTA",
      iva: 0,
      totalDian: 72600,
      totalSiigo: 0,
      diferencia: 72600,
      hits: [],
      comprobantes: [],
      matchVia: "",
      prioridad: "audit" as const,
      linked: [],
      alerta: "",
    };

    const insight = getTaxInsight(rowCCB);
    assert.strictEqual(insight?.tipo !== "comision_bancaria", true);
  });

  it("debe conciliar documentos soporte independientes del mismo proveedor y mismo valor sin marcarlos como duplicados", () => {
    const dianDocs: DianDoc[] = [
      {
        grupo: "Emitido",
        tipo: "Documento soporte con no obligados",
        prefijo: "DSET",
        folio: "1260",
        cufe: "CUFE1260",
        fechaEmision: "2026-08-05",
        fechaRecepcion: "2026-08-05",
        nitEmisor: "901260460",
        nombreEmisor: "EMPRESA S.A.S.",
        nitReceptor: "8738279",
        nombreReceptor: "RAUL ROCHA FONSECA",
        estadoDian: "Aceptado",
        iva: 0,
        total: 2639000,
      },
      {
        grupo: "Emitido",
        tipo: "Documento soporte con no obligados",
        prefijo: "DSET",
        folio: "1259",
        cufe: "CUFE1259",
        fechaEmision: "2026-08-05",
        fechaRecepcion: "2026-08-05",
        nitEmisor: "901260460",
        nombreEmisor: "EMPRESA S.A.S.",
        nitReceptor: "8738279",
        nombreReceptor: "RAUL ROCHA FONSECA",
        estadoDian: "Aceptado",
        iva: 0,
        total: 2639000,
      },
    ];

    const movLines: MovLine[] = [
      // DSET 1260
      {
        cuenta: "73451501",
        cuentaNombre: "MANTENIMIENTO",
        comprobante: "P 003 00000001260 001",
        fecha: "2026-08-05",
        nit: "8738279",
        nombre: "RAUL ROCHA FONSECA",
        descripcion: "CC20260805 OC1320 REPARACION DE MOTOR",
        cruce: "",
        debito: 2639000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 003 00000001260 002",
        fecha: "2026-08-05",
        nit: "8738279",
        nombre: "RAUL ROCHA FONSECA",
        descripcion: "RAUL ROCHA FONSECA",
        cruce: "P-003-00020260805-001",
        debito: 0,
        credito: 2639000,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 002 00000002872 001",
        fecha: "2026-08-05",
        nit: "8738279",
        nombre: "RAUL ROCHA FONSECA",
        descripcion: "DSET1260 OC1320 REPARACION DE MOTOR",
        cruce: "P-003-00020260805-001",
        debito: 2639000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "23652501",
        cuentaNombre: "RETEFUENTE",
        comprobante: "P 002 00000002872 002",
        fecha: "2026-08-05",
        nit: "8738279",
        nombre: "RAUL ROCHA FONSECA",
        descripcion: "DSET1260 OC1320 REPARACION DE MOTOR",
        cruce: "",
        debito: 0,
        credito: 105560,
        observacion: "",
      },
      // DSET 1259
      {
        cuenta: "73451501",
        cuentaNombre: "MANTENIMIENTO",
        comprobante: "P 003 00000001259 001",
        fecha: "2026-08-05",
        nit: "8738279",
        nombre: "RAUL ROCHA FONSECA",
        descripcion: "CC20260805 OC1319 REPARACION DE MOTOR",
        cruce: "",
        debito: 2639000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 003 00000001259 002",
        fecha: "2026-08-05",
        nit: "8738279",
        nombre: "RAUL ROCHA FONSECA",
        descripcion: "RAUL ROCHA FONSECA",
        cruce: "P-003-00020260805-001",
        debito: 0,
        credito: 2639000,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 002 00000002871 001",
        fecha: "2026-08-05",
        nit: "8738279",
        nombre: "RAUL ROCHA FONSECA",
        descripcion: "DSET1238 OC1319 REPARACION DE MOTOR",
        cruce: "P-003-00020260805-001",
        debito: 2639000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 002 00000002871 004",
        fecha: "2026-08-05",
        nit: "8738279",
        nombre: "RAUL ROCHA FONSECA",
        descripcion: "RAUL ROCHA FONSECA",
        cruce: "P-002-00000001259-001",
        debito: 0,
        credito: 2500452.5,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "AGO 2026");
    const d1260 = res.rows.find((r) => r.numero === "DSET-1260")!;
    const d1259 = res.rows.find((r) => r.numero === "DSET-1259")!;

    assert.strictEqual(d1260.estado, "conciliado");
    assert.strictEqual(d1259.estado, "conciliado");
    assert.strictEqual(res.totals.duplicados, 0);
  });

  it("no debe cruzar facturas DIAN con pagos (2205 débito) o anticipos sin causación de gasto dejándolas pendientes", () => {
    const dianDocs: DianDoc[] = [
      {
        grupo: "Recibido",
        tipo: "Factura electrónica",
        prefijo: "93",
        folio: "281656",
        cufe: "CUFE-SIIGO-281656",
        fechaEmision: "2026-08-15",
        fechaRecepcion: "2026-08-15",
        nitEmisor: "830048145",
        nombreEmisor: "SIIGO S.A.S.",
        nitReceptor: "901260460",
        nombreReceptor: "EMPRESA S.A.S.",
        estadoDian: "Aceptado",
        iva: 86400,
        total: 541100,
      },
    ];

    const movLines: MovLine[] = [
      // Anticipo
      {
        cuenta: "13300508",
        cuentaNombre: "ANTICIPOS",
        comprobante: "P 002 00000002876 001",
        fecha: "2026-08-10",
        nit: "830048145",
        nombre: "SIIGO S.A.",
        descripcion: "ANT1104 COMPRA DOCUMENTOS ELECTRONICOS",
        cruce: "P-002-00000002876-001",
        debito: 541100,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 002 00000002876 002",
        fecha: "2026-08-10",
        nit: "830048145",
        nombre: "SIIGO S.A.",
        descripcion: "SIIGO S.A.",
        cruce: "P-002-00000001104-001",
        debito: 0,
        credito: 541100,
        observacion: "",
      },
      // Pago bancario
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "G 002 00000002760 001",
        fecha: "2026-08-10",
        nit: "830048145",
        nombre: "SIIGO S.A.",
        descripcion: "PAG COMPRA DOCS ELECTRONICO - SIIGO S.A",
        cruce: "P-002-00000001104-001",
        debito: 541100,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "11100512",
        cuentaNombre: "BANCOS",
        comprobante: "G 002 00000002760 002",
        fecha: "2026-08-10",
        nit: "830048145",
        nombre: "SIIGO S.A.",
        descripcion: "SIIGO S.A.",
        cruce: "",
        debito: 0,
        credito: 541100,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "AGO 2026");
    const siigoRow = res.rows.find((r) => r.folio === "281656")!;

    assert.strictEqual(siigoRow.estado, "pendiente");
    assert.strictEqual(siigoRow.comprobantes.length, 0);
  });

  it("no debe mostrar eventos Application response como facturas en las alertas de Solo Libros", () => {
    const dianDocs: DianDoc[] = [
      {
        grupo: "Emitido",
        tipo: "Application response",
        prefijo: "",
        folio: "HFYF11935212",
        cufe: "CUFE-EVENTO-1",
        fechaEmision: "2026-08-05",
        fechaRecepcion: "2026-08-05",
        nitEmisor: "901260460",
        nombreEmisor: "EMPRESA S.A.S.",
        nitReceptor: "900414976",
        nombreReceptor: "EMPAQUETADURA E INYECCION DIESEL",
        estadoDian: "Aprobado",
        iva: 0,
        total: 0,
      },
    ];

    const movLines: MovLine[] = [
      {
        cuenta: "13300508",
        cuentaNombre: "ANTICIPOS",
        comprobante: "P 002 00000002874 001",
        fecha: "2026-08-05",
        nit: "900414976",
        nombre: "EMPAQUETADURA E INYECCION DIESEL",
        descripcion: "ANT1102 OC1293 SERVICIO EVALUACION",
        cruce: "P-002-00000002874-001",
        debito: 7211750,
        credito: 0,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "AGO 2026");
    const soloRow = res.rows.find((r) => r.estado === "solo_siigo")!;

    assert.strictEqual(soloRow.linked.length, 0);
    assert.strictEqual(soloRow.alerta.includes("HFYF11935212"), false);
  });

  it("debe asignar cruce_nc a facturas que anulan con Nota Crédito y no cruzarlas erróneamente con egresos G como typos", () => {
    const nitRectificadora = "900046161";
    const dianDocs: DianDoc[] = [
      // Factura FV-1723
      {
        grupo: "Recibido",
        tipo: "Factura electrónica",
        prefijo: "FV",
        folio: "1723",
        cufe: "CUFE-FV-1723",
        fechaEmision: "2026-09-02",
        fechaRecepcion: "2026-09-02",
        nitEmisor: nitRectificadora,
        nombreEmisor: "RECTIFICADORA UNIVERSAL DE LA COSTA S.A.S.",
        nitReceptor: "901260460",
        nombreReceptor: "EMPRESA S.A.S.",
        estadoDian: "Aceptado",
        iva: 801610,
        total: 5020610,
      },
      // Nota Crédito NCE-44 que anula FV-1723
      {
        grupo: "Recibido",
        tipo: "Nota crédito",
        prefijo: "NCE",
        folio: "44",
        cufe: "CUFE-NCE-44",
        fechaEmision: "2026-09-02",
        fechaRecepcion: "2026-09-02",
        nitEmisor: nitRectificadora,
        nombreEmisor: "RECTIFICADORA UNIVERSAL DE LA COSTA S.A.S.",
        nitReceptor: "901260460",
        nombreReceptor: "EMPRESA S.A.S.",
        estadoDian: "Aceptado",
        iva: 801610,
        total: 5020610,
      },
      // Factura FV-1724
      {
        grupo: "Recibido",
        tipo: "Factura electrónica",
        prefijo: "FV",
        folio: "1724",
        cufe: "CUFE-FV-1724",
        fechaEmision: "2026-09-02",
        fechaRecepcion: "2026-09-02",
        nitEmisor: nitRectificadora,
        nombreEmisor: "RECTIFICADORA UNIVERSAL DE LA COSTA S.A.S.",
        nitReceptor: "901260460",
        nombreReceptor: "EMPRESA S.A.S.",
        estadoDian: "Aceptado",
        iva: 612370,
        total: 3835370,
      },
      // Nota Crédito NCE-45 que anula FV-1724
      {
        grupo: "Recibido",
        tipo: "Nota crédito",
        prefijo: "NCE",
        folio: "45",
        cufe: "CUFE-NCE-45",
        fechaEmision: "2026-09-02",
        fechaRecepcion: "2026-09-02",
        nitEmisor: nitRectificadora,
        nombreEmisor: "RECTIFICADORA UNIVERSAL DE LA COSTA S.A.S.",
        nitReceptor: "901260460",
        nombreReceptor: "EMPRESA S.A.S.",
        estadoDian: "Aceptado",
        iva: 612370,
        total: 3835370,
      },
    ];

    const movLines: MovLine[] = [
      // Comprobante de Egreso (G) pagando una factura vieja FV-1716
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES NACIONALES",
        comprobante: "G 001 00000003420 001",
        fecha: "2026-09-03",
        nit: nitRectificadora,
        nombre: "RECTIFICADORA UNIVERSAL DE LA COSTA S.A.S.",
        descripcion: "ABONO FACTURA FV-1716",
        cruce: "FV-1716",
        debito: 4863950,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "11100512",
        cuentaNombre: "BANCOLOMBIA",
        comprobante: "G 001 00000003420 002",
        fecha: "2026-09-03",
        nit: nitRectificadora,
        nombre: "RECTIFICADORA UNIVERSAL DE LA COSTA S.A.S.",
        descripcion: "RECTIFICADORA UNIVERSAL",
        cruce: "",
        debito: 0,
        credito: 4863950,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "SEP 2026");
    const row1723 = res.rows.find((r) => r.numero === "FV-1723")!;
    const row1724 = res.rows.find((r) => r.numero === "FV-1724")!;

    // No deben ser posible_typo ni cruzar con el egreso G
    assert.notStrictEqual(row1723.estado, "posible_typo");
    assert.strictEqual(row1723.estado, "cruce_nc");
    assert.strictEqual(row1723.linked[0]?.numero, "NCE-44");
    assert.strictEqual(row1723.comprobantes.includes("G 001 00000003420"), false);

    assert.notStrictEqual(row1724.estado, "posible_typo");
    assert.strictEqual(row1724.estado, "cruce_nc");
    assert.strictEqual(row1724.linked[0]?.numero, "NCE-45");
  });

  it("debe detectar error de digitación (posible_typo / Revisar factura) cuando el auxiliar se equivoca en un dígito al causar la compra", () => {
    const nitProveedor = "901333444";
    const dianDocs: DianDoc[] = [
      {
        grupo: "Recibido",
        tipo: "Factura electrónica",
        prefijo: "FE",
        folio: "5021",
        cufe: "CUFE-FE-5021",
        fechaEmision: "2026-09-10",
        fechaRecepcion: "2026-09-10",
        nitEmisor: nitProveedor,
        nombreEmisor: "REPUESTOS Y MOTORES S.A.S.",
        nitReceptor: "901260460",
        nombreReceptor: "EMPRESA S.A.S.",
        estadoDian: "Aceptado",
        iva: 190000,
        total: 1190000,
      },
    ];

    // En libros causaron la compra (P 001) con costo (cuenta 5135) pero digitaron FE-5022 por error
    const movLines: MovLine[] = [
      {
        cuenta: "51350501",
        cuentaNombre: "MANTENIMIENTO Y REPARACIONES",
        comprobante: "P 001 00000008890 001",
        fecha: "2026-09-11",
        nit: nitProveedor,
        nombre: "REPUESTOS Y MOTORES S.A.S.",
        descripcion: "CAUSACION FACTURA FE-5022 REPUESTOS",
        cruce: "FE-5022",
        debito: 1000000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "24080101",
        cuentaNombre: "IVA DESCONTABLE 19%",
        comprobante: "P 001 00000008890 002",
        fecha: "2026-09-11",
        nit: nitProveedor,
        nombre: "REPUESTOS Y MOTORES S.A.S.",
        descripcion: "IVA FE-5022",
        cruce: "FE-5022",
        debito: 190000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES NACIONALES",
        comprobante: "P 001 00000008890 003",
        fecha: "2026-09-11",
        nit: nitProveedor,
        nombre: "REPUESTOS Y MOTORES S.A.S.",
        descripcion: "CUENTA POR PAGAR FE-5022",
        cruce: "FE-5022",
        debito: 0,
        credito: 1190000,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "SEP 2026");
    const row = res.rows.find((r) => r.numero === "FE-5021")!;

    assert.ok(row, "Debe existir la fila de la factura FE-5021");
    assert.strictEqual(row.estado, "posible_typo");
    assert.ok(row.alerta.includes("FE-5022"));
    assert.ok(row.alerta.includes("Posible error al digitar el número de factura"));
    assert.strictEqual(row.totalSiigo, 1190000);
  });

  it("debe conciliar reembolsos independientes sin marcarlos erróneamente como doble registro", () => {
    const nitGasto = "901234888";
    const dianDocs: DianDoc[] = [
      {
        tipo: "Documento soporte en adquisiciones con no obligados",
        cufe: "CUFE-DS-01",
        folio: "101",
        prefijo: "DS",
        fechaEmision: "2026-09-02",
        fechaRecepcion: "2026-09-02",
        nitEmisor: nitGasto,
        nombreEmisor: "TRANSPORTE Y LOGISTICA EXPRESS",
        nitReceptor: "900123456",
        nombreReceptor: "EMPRESA MODELO S.A.S.",
        iva: 0,
        total: 85000,
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
      {
        tipo: "Documento soporte en adquisiciones con no obligados",
        cufe: "CUFE-DS-02",
        folio: "102",
        prefijo: "DS",
        fechaEmision: "2026-09-18",
        fechaRecepcion: "2026-09-18",
        nitEmisor: nitGasto,
        nombreEmisor: "TRANSPORTE Y LOGISTICA EXPRESS",
        nitReceptor: "900123456",
        nombreReceptor: "EMPRESA MODELO S.A.S.",
        iva: 0,
        total: 85000,
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const movLines: MovLine[] = [
      // Reembolso 1 (Semana 1)
      {
        cuenta: "51953501",
        cuentaNombre: "TAXIS Y BUSES",
        comprobante: "P 001 00000001010 001",
        fecha: "2026-09-02",
        nit: nitGasto,
        nombre: "TRANSPORTE Y LOGISTICA EXPRESS",
        descripcion: "REEMBOLSO DE GASTOS SEMANA 1 TRANSPORTE",
        cruce: "DS-101",
        debito: 85000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 001 00000001010 002",
        fecha: "2026-09-02",
        nit: nitGasto,
        nombre: "TRANSPORTE Y LOGISTICA EXPRESS",
        descripcion: "REEMBOLSO DE GASTOS SEMANA 1",
        cruce: "DS-101",
        debito: 0,
        credito: 85000,
        observacion: "",
      },
      // Reembolso 2 (Semana 3)
      {
        cuenta: "51953501",
        cuentaNombre: "TAXIS Y BUSES",
        comprobante: "P 001 00000001020 001",
        fecha: "2026-09-18",
        nit: nitGasto,
        nombre: "TRANSPORTE Y LOGISTICA EXPRESS",
        descripcion: "REEMBOLSO DE GASTOS SEMANA 3 TRANSPORTE",
        cruce: "DS-102",
        debito: 85000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 001 00000001020 002",
        fecha: "2026-09-18",
        nit: nitGasto,
        nombre: "TRANSPORTE Y LOGISTICA EXPRESS",
        descripcion: "REEMBOLSO DE GASTOS SEMANA 3",
        cruce: "DS-102",
        debito: 0,
        credito: 85000,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "SEP 2026");
    assert.strictEqual(res.totals.duplicados, 0, "No debe marcar falsos duplicados en reembolsos independientes");
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.rows[1].estado, "conciliado");
  });

  it("debe detectar y sugerir factura registrada con mismo número y valor pero bajo otro tercero (Centro Automotriz Serviford)", () => {
    const dianDocs: DianDoc[] = [
      {
        tipo: "Factura electrónica de venta",
        cufe: "CUFE-SERVIFORD-4510",
        folio: "4510",
        prefijo: "FE",
        fechaEmision: "2026-09-14",
        fechaRecepcion: "2026-09-14",
        nitEmisor: "900888111",
        nombreEmisor: "CENTRO AUTOMOTRIZ SERVIFORD S.A.S.",
        nitReceptor: "900123456",
        nombreReceptor: "EMPRESA MODELO S.A.S.",
        iva: 92605,
        total: 580000,
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const movLines: MovLine[] = [
      {
        cuenta: "51451001",
        cuentaNombre: "MANTENIMIENTO EQUIPO DE TRANSPORTE",
        comprobante: "P 001 00000007800 001",
        fecha: "2026-09-14",
        nit: "1020304050", // Causada erróneamente bajo el NIT del conductor/reembolso
        nombre: "CARLOS MARIO - REEMBOLSO CAJA",
        descripcion: "MANTENIMIENTO CAMIONETA FE-4510",
        cruce: "FE-4510",
        debito: 580000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 001 00000007800 002",
        fecha: "2026-09-14",
        nit: "1020304050",
        nombre: "CARLOS MARIO - REEMBOLSO CAJA",
        descripcion: "FE-4510",
        cruce: "FE-4510",
        debito: 0,
        credito: 580000,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "SEP 2026");
    const row = res.rows[0];

    assert.ok(row, "Debe existir la fila");
    assert.strictEqual(row.estado, "posible_typo", "Debe sugerirse como Revisar factura");
    assert.ok(row.alerta.includes("CARLOS MARIO - REEMBOLSO CAJA"));
    assert.ok(row.alerta.includes("1020304050"));
    assert.ok(row.alerta.includes("asignada al tercero"));
    assert.strictEqual(row.totalSiigo, 580000);
  });

  it("debe sugerir causación con posible error de digitación en factura y diferencia en costo (Promotora Colombiana de Extintores)", () => {
    const nitExtintores = "860555444";
    const dianDocs: DianDoc[] = [
      {
        tipo: "Factura electrónica de venta",
        cufe: "CUFE-EXTINTOR-1240",
        folio: "1240",
        prefijo: "FE",
        fechaEmision: "2026-09-20",
        fechaRecepcion: "2026-09-20",
        nitEmisor: nitExtintores,
        nombreEmisor: "PROMOTORA COLOMBIANA DE EXTINTORES S.A.S.",
        nitReceptor: "900123456",
        nombreReceptor: "EMPRESA MODELO S.A.S.",
        iva: 159664,
        total: 1000000,
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const movLines: MovLine[] = [
      {
        cuenta: "51952501",
        cuentaNombre: "ELEMENTOS DE SEGURIDAD INDUSTRIAL",
        comprobante: "P 001 00000009200 001",
        fecha: "2026-09-20",
        nit: nitExtintores,
        nombre: "PROMOTORA COLOMBIANA DE EXTINTORES S.A.S.",
        descripcion: "RECARGA EXTINTORES FE-12400", // Un cero de más en la factura y valor causado con 270.000 de diferencia
        cruce: "FE-12400",
        debito: 1270000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 001 00000009200 002",
        fecha: "2026-09-20",
        nit: nitExtintores,
        nombre: "PROMOTORA COLOMBIANA DE EXTINTORES S.A.S.",
        descripcion: "CUENTA POR PAGAR FE-12400",
        cruce: "FE-12400",
        debito: 0,
        credito: 1270000,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "SEP 2026");
    const row = res.rows[0];

    assert.ok(row, "Debe existir la fila");
    assert.strictEqual(row.estado, "posible_typo", "Debe sugerirse como Revisar factura");
    assert.ok(row.alerta.includes("12400"));
    assert.ok(row.alerta.includes("diferencia de $270.000"));
    assert.strictEqual(row.totalSiigo, 1270000);
  });

  it("debe detectar error de digitación en el prefijo de la factura con mismo folio y valor (Yasser Quintero Carrascal: PJE3 vs PJ3)", () => {
    const nitYasser = "72309561";
    const dianDocs: DianDoc[] = [
      {
        tipo: "Factura electrónica de venta",
        cufe: "CUFE-YASSER-199875",
        folio: "199875",
        prefijo: "PJE3",
        fechaEmision: "2026-09-15",
        fechaRecepcion: "2026-09-15",
        nitEmisor: nitYasser,
        nombreEmisor: "YASSER QUINTERO CARRASCAL",
        nitReceptor: "900123456",
        nombreReceptor: "EMPRESA MODELO S.A.S.",
        iva: 0,
        total: 112500,
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const movLines: MovLine[] = [
      {
        cuenta: "73953501",
        cuentaNombre: "COMBUSTIBLES Y LUBRICANTES",
        comprobante: "P 002 00000010602 016",
        fecha: "2026-09-30",
        nit: nitYasser,
        nombre: "YASSER QUINTERO CARRASCAL",
        descripcion: "CM1569 PJ3199875 REEMBOLSO CM",
        cruce: "",
        debito: 112500,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "22050501",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 002 00000010602 021",
        fecha: "2026-09-30",
        nit: nitYasser,
        nombre: "YASSER QUINTERO CARRASCAL",
        descripcion: "CM1569 PJ3199875 REEMBOLSO CM",
        cruce: "",
        debito: 0,
        credito: 112500,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "SEP 2026");
    const row = res.rows[0];

    assert.ok(row, "Debe existir la fila");
    assert.strictEqual(row.estado, "posible_typo", "Debe sugerirse como Revisar factura");
    assert.ok(row.alerta.includes("PJ3-199875"));
    assert.ok(row.alerta.includes("PJE3"));
    assert.strictEqual(row.totalSiigo, 112500);
    assert.strictEqual(row.diferencia, 0);
  });

  it("debe detectar transposición de dígitos adyacentes en el número de factura como posible_typo (ej. 8329 vs 8392)", () => {
    const nit = "900555444";
    const dianDocs: DianDoc[] = [
      {
        tipo: "01",
        prefijo: "FE",
        folio: "8392",
        cufe: "CUFE8392TEST",
        fechaEmision: "2026-09-15",
        fechaRecepcion: "2026-09-15",
        nitEmisor: nit,
        nombreEmisor: "TECNOLOGIA GLOBAL S.A.S.",
        nitReceptor: "901000111",
        nombreReceptor: "EMPRESA PRUEBA",
        iva: 190000,
        total: 1190000,
        formaPago: "1",
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const movLines: MovLine[] = [
      {
        cuenta: "513505",
        cuentaNombre: "SERVICIOS TECNOLOGICOS",
        comprobante: "P 001 0000005544 001",
        fecha: "2026-09-15",
        nit,
        nombre: "TECNOLOGIA GLOBAL S.A.S.",
        descripcion: "CAUSACION FE 8329 SERV TEC",
        cruce: "8329",
        debito: 1190000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "220505",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 001 0000005544 002",
        fecha: "2026-09-15",
        nit,
        nombre: "TECNOLOGIA GLOBAL S.A.S.",
        descripcion: "CAUSACION FE 8329 SERV TEC",
        cruce: "8329",
        debito: 0,
        credito: 1190000,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "SEP 2026");
    const row = res.rows[0];

    assert.ok(row, "Debe existir la fila");
    assert.strictEqual(row.estado, "posible_typo", "Debe sugerirse como Revisar factura por transposición de dígitos");
    assert.ok(row.alerta.includes("8329"));
    assert.strictEqual(row.totalSiigo, 1190000);
    assert.strictEqual(row.diferencia, 0);
  });

  it("debe sugerir factura DIAN sin prefijo registrada con prefijo contable común FV o FAC", () => {
    const nit = "800111222";
    const dianDocs: DianDoc[] = [
      {
        tipo: "01",
        prefijo: "",
        folio: "5420",
        cufe: "CUFE5420NOPREF",
        fechaEmision: "2026-09-20",
        fechaRecepcion: "2026-09-20",
        nitEmisor: nit,
        nombreEmisor: "DISTRIBUIDORA DEL CARIBE S.A.S.",
        nitReceptor: "901000111",
        nombreReceptor: "EMPRESA PRUEBA",
        iva: 0,
        total: 450000,
        formaPago: "1",
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const movLines: MovLine[] = [
      {
        cuenta: "513595",
        cuentaNombre: "OTROS GASTOS",
        comprobante: "P 001 0000009988 001",
        fecha: "2026-09-20",
        nit,
        nombre: "DISTRIBUIDORA DEL CARIBE S.A.S.",
        descripcion: "CAUSACION FV5420 MERCANCIA",
        cruce: "FV5420",
        debito: 450000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "220505",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 001 0000009988 002",
        fecha: "2026-09-20",
        nit,
        nombre: "DISTRIBUIDORA DEL CARIBE S.A.S.",
        descripcion: "CAUSACION FV5420 MERCANCIA",
        cruce: "FV5420",
        debito: 0,
        credito: 450000,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "SEP 2026");
    const row = res.rows[0];

    assert.ok(row, "Debe existir la fila");
    assert.strictEqual(row.estado, "conciliado", "Debe conciliar directamente factura sin prefijo en DIAN causada con prefijo común FV");
    assert.strictEqual(row.totalSiigo, 450000);
    assert.strictEqual(row.diferencia, 0);
  });

  it("debe sugerir como posible_typo factura DIAN sin prefijo con error en un dígito en libros (ej. 5420 vs FV5421)", () => {
    const nit = "800111222";
    const dianDocs: DianDoc[] = [
      {
        tipo: "01",
        prefijo: "",
        folio: "5420",
        cufe: "CUFE5420TYPO",
        fechaEmision: "2026-09-20",
        fechaRecepcion: "2026-09-20",
        nitEmisor: nit,
        nombreEmisor: "DISTRIBUIDORA DEL CARIBE S.A.S.",
        nitReceptor: "901000111",
        nombreReceptor: "EMPRESA PRUEBA",
        iva: 0,
        total: 450000,
        formaPago: "1",
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const movLines: MovLine[] = [
      {
        cuenta: "513595",
        cuentaNombre: "OTROS GASTOS",
        comprobante: "P 001 0000009988 001",
        fecha: "2026-09-20",
        nit,
        nombre: "DISTRIBUIDORA DEL CARIBE S.A.S.",
        descripcion: "CAUSACION FV5421 MERCANCIA", // 5421 vs 5420
        cruce: "FV5421",
        debito: 450000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "220505",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 001 0000009988 002",
        fecha: "2026-09-20",
        nit,
        nombre: "DISTRIBUIDORA DEL CARIBE S.A.S.",
        descripcion: "CAUSACION FV5421 MERCANCIA",
        cruce: "FV5421",
        debito: 0,
        credito: 450000,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "SEP 2026");
    const row = res.rows[0];

    assert.ok(row, "Debe existir la fila");
    assert.strictEqual(row.estado, "posible_typo", "Debe sugerirse como Revisar factura");
    assert.ok(row.alerta.includes("5421"));
    assert.strictEqual(row.totalSiigo, 450000);
    assert.strictEqual(row.diferencia, 0);
  });

  it("debe sugerir causación con similitud de nombre corporativo por tokens algorítmicos sin regex cableado", () => {
    const nitDian = "900123999";
    const nitLibros = "900123999-1"; // NIT con guión o sufijo sucursal
    const dianDocs: DianDoc[] = [
      {
        tipo: "01",
        prefijo: "SETT",
        folio: "9040",
        cufe: "CUFESETT9040",
        fechaEmision: "2026-09-18",
        fechaRecepcion: "2026-09-18",
        nitEmisor: nitDian,
        nombreEmisor: "SUMINISTROS INDUSTRIALES Y FERRETEROS DEL VALLE S.A.S.",
        nitReceptor: "901000111",
        nombreReceptor: "EMPRESA PRUEBA",
        iva: 19000,
        total: 119000,
        formaPago: "1",
        estadoDian: "Aceptado",
        grupo: "Recibido",
      },
    ];

    const movLines: MovLine[] = [
      {
        cuenta: "513595",
        cuentaNombre: "GASTOS GENERALES",
        comprobante: "P 001 0000007788 001",
        fecha: "2026-09-18",
        nit: nitLibros,
        nombre: "SUMINISTROS INDUSTRIALES FERRETEROS",
        descripcion: "COMPRA SETT 90400 DIF COSTO", // typo 90400 vs 9040
        cruce: "90400",
        debito: 115000, // diferencia de costo
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "220505",
        cuentaNombre: "PROVEEDORES",
        comprobante: "P 001 0000007788 002",
        fecha: "2026-09-18",
        nit: nitLibros,
        nombre: "SUMINISTROS INDUSTRIALES FERRETEROS",
        descripcion: "COMPRA SETT 90400 DIF COSTO",
        cruce: "90400",
        debito: 0,
        credito: 115000,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "SEP 2026");
    const row = res.rows[0];

    assert.ok(row, "Debe existir la fila");
    assert.strictEqual(row.estado, "posible_typo", "Debe coincidir por tokens de nombre sin requerir regex cableado");
    assert.strictEqual(row.totalSiigo, 115000);
    assert.strictEqual(row.diferencia, 4000);
    assert.ok(row.alerta.includes("90400"));
  });

  it("debe conciliar facturas legalizadas en libros (FE562 y FE563) y cruzar notas crédito contra las facturas no causadas (560 y 561)", () => {
    const nitCamargo = "1041903423";
    const baseDoc = {
      fechaRecepcion: "2026-09-17",
      nitReceptor: "900123456",
      nombreReceptor: "EMPRESA MODELO",
      estadoDian: "Aceptado",
    };
    const dianDocs: DianDoc[] = [
      {
        ...baseDoc,
        tipo: "Factura electrónica",
        folio: "563",
        prefijo: "",
        cufe: "CUFE-563",
        fechaEmision: "2026-09-17",
        nitEmisor: nitCamargo,
        nombreEmisor: "JORGE STEVE CAMARGO YEPES",
        total: 130000,
        iva: 0,
        grupo: "Recibido",
      },
      {
        ...baseDoc,
        tipo: "Factura electrónica",
        folio: "562",
        prefijo: "",
        cufe: "CUFE-562",
        fechaEmision: "2026-09-17",
        nitEmisor: nitCamargo,
        nombreEmisor: "JORGE STEVE CAMARGO YEPES",
        total: 130000,
        iva: 0,
        grupo: "Recibido",
      },
      {
        ...baseDoc,
        tipo: "Nota de crédito electrónica",
        folio: "NC28",
        prefijo: "",
        cufe: "CUFE-NC28",
        fechaEmision: "2026-09-17",
        nitEmisor: nitCamargo,
        nombreEmisor: "JORGE STEVE CAMARGO YEPES",
        total: 260000,
        iva: 0,
        grupo: "Recibido",
      },
      {
        ...baseDoc,
        tipo: "Factura electrónica",
        folio: "561",
        prefijo: "",
        cufe: "CUFE-561",
        fechaEmision: "2026-09-17",
        nitEmisor: nitCamargo,
        nombreEmisor: "JORGE STEVE CAMARGO YEPES",
        total: 260000,
        iva: 0,
        grupo: "Recibido",
      },
      {
        ...baseDoc,
        tipo: "Nota de crédito electrónica",
        folio: "NC27",
        prefijo: "",
        cufe: "CUFE-NC27",
        fechaEmision: "2026-09-17",
        nitEmisor: nitCamargo,
        nombreEmisor: "JORGE STEVE CAMARGO YEPES",
        total: 130000,
        iva: 0,
        grupo: "Recibido",
      },
      {
        ...baseDoc,
        tipo: "Factura electrónica",
        folio: "560",
        prefijo: "",
        cufe: "CUFE-560",
        fechaEmision: "2026-09-17",
        nitEmisor: nitCamargo,
        nombreEmisor: "JORGE STEVE CAMARGO YEPES",
        total: 130000,
        iva: 0,
        grupo: "Recibido",
      },
    ];

    const movLines: MovLine[] = [
      {
        cuenta: "73959503",
        cuentaNombre: "OTROS COSTOS",
        comprobante: "P 002 00000002922 032",
        fecha: "2026-09-30",
        nit: nitCamargo,
        nombre: "JORGE STEVE CAMARGO YEPES",
        descripcion: "CM724 FE563 REEMBOLSO CM",
        cruce: "",
        debito: 130000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "73959503",
        cuentaNombre: "OTROS COSTOS",
        comprobante: "P 002 00000002922 033",
        fecha: "2026-09-30",
        nit: nitCamargo,
        nombre: "JORGE STEVE CAMARGO YEPES",
        descripcion: "CM724 FE562 REEMBOLSO CM",
        cruce: "",
        debito: 130000,
        credito: 0,
        observacion: "",
      },
    ];

    const res = conciliar(dianDocs, movLines, "SEP 2026");
    const row563 = res.rows.find((r) => r.numero === "563");
    const row562 = res.rows.find((r) => r.numero === "562");
    const row561 = res.rows.find((r) => r.numero === "561");
    const row560 = res.rows.find((r) => r.numero === "560");
    const rowNC28 = res.rows.find((r) => r.numero === "NC28");
    const rowNC27 = res.rows.find((r) => r.numero === "NC27");

    assert.ok(row563 && row562 && row561 && row560 && rowNC28 && rowNC27);
    assert.strictEqual(row563.estado, "conciliado", "563 debe conciliarse con libros");
    assert.strictEqual(row562.estado, "conciliado", "562 debe conciliarse con libros");
    assert.strictEqual(row561.estado, "cruce_nc", "561 debe anularse con NC28");
    assert.strictEqual(row560.estado, "cruce_nc", "560 debe anularse con NC27");
    assert.strictEqual(rowNC28.estado, "cruce_nc", "NC28 debe cruzar con 561");
    assert.strictEqual(rowNC27.estado, "cruce_nc", "NC27 debe cruzar con 560");

    // Verificar que las facturas y NC compensadas (cruce_nc) NO se agreguen a la cola de auditoría ni inflen el valor
    assert.strictEqual(res.totals.cola, 0, "No debe haber alertas en cola de auditoría porque todo está conciliado o compensado con NC");
    assert.strictEqual(res.totals.valorCola, 0, "El valor de la cola debe ser 0");
    assert.strictEqual(res.totals.crucesNc, 2, "Deben identificarse 2 cruces con NC");
    assert.strictEqual(res.totals.valorCrucesNc, 390000, "Valor compensado simple (no duplicado): 260.000 + 130.000 = 390.000");
  });
});
