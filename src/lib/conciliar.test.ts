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
});
