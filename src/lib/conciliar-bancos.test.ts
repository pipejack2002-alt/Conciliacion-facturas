import { describe, it } from "node:test";
import assert from "node:assert";
import {
  conciliarBancos,
  extractLibroBancos,
  getAvailableBankAccounts,
  getBankExecutiveBreakdown,
  classifyMovementConcept,
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

  it("debe clasificar GMF y Comisiones de forma mutuamente excluyente sin inflar comisiones", () => {
    // Caso real Credicorp: cargos de GMF que empiezan con 'COBRO GM ... COBRO DE GMF'
    const descGmf = "COBRO GM 10653 COBRO DE GMF SOBRE $25.000.000,00";
    const resGmf = classifyMovementConcept(descGmf);
    assert.strictEqual(resGmf.esGmf, true, "Debe ser GMF");
    assert.strictEqual(resGmf.esComision, false, "NUNCA debe ser comisión");
    assert.strictEqual(resGmf.esRendimiento, false);

    // Caso de comisión bancaria legítima con IVA
    const descCom = "COBRO OP BANCARIA TRANSF Y/O CHQ CON IVA";
    const resCom = classifyMovementConcept(descCom);
    assert.strictEqual(resCom.esGmf, false);
    assert.strictEqual(resCom.esComision, true, "Debe ser comisión bancaria");
    assert.strictEqual(resCom.esRendimiento, false);

    // Conciliación con ambos ítems y verificación de desglose analítico
    const extracto: BankExtractItem[] = [
      { id: "e1", fecha: "2026-08-06", descripcion: descGmf, referencia: "", debito: 100000, credito: 0 },
      { id: "e2", fecha: "2026-08-24", descripcion: descCom, referencia: "1-1-47311-2", debito: 149254.56, credito: 0 },
      { id: "e3", fecha: "2026-08-28", descripcion: "AJUSTE TP 3420 TRASLADO DE FONDOS", referencia: "TP 3420", debito: 28000000, credito: 0 },
      { id: "e4", fecha: "2026-08-31", descripcion: "RENDIMIENTOS", referencia: "1-1-47311-2", debito: 0, credito: 1953109.18 },
    ];

    const conc = conciliarBancos(extracto, []);
    assert.strictEqual(conc.summary.notasDebitoGmf, 100000);
    assert.strictEqual(conc.summary.notasDebitoComisiones, 149254.56);
    assert.strictEqual(conc.summary.notasDebitoOperativas, 28000000);
    assert.strictEqual(conc.summary.notasDebitoNoRegistradas, 100000 + 149254.56 + 28000000);
    assert.strictEqual(conc.summary.notasCreditoRendimientos, 1953109.18);

    const exec = getBankExecutiveBreakdown(conc.rows);
    assert.strictEqual(exec.gmf.count, 1);
    assert.strictEqual(exec.gmf.total, 100000);
    assert.strictEqual(exec.comisiones.count, 1, "Solo debe haber 1 comisión, no inflada por GMF");
    assert.strictEqual(exec.comisiones.total, 149254.56);
  });

  it("debe rechazar estrictamente cuentas de pasivo (2370) y gastos (5105) aunque contengan 'caja' o 'ahorro'", () => {
    const movCuentas: MovLine[] = [
      {
        cuenta: "23701001",
        cuentaNombre: "APORTES AL I C B F   SENA Y CAJAS DE COM",
        comprobante: "P 01",
        fecha: "2026-08-01",
        nit: "899999034",
        nombre: "ICBF",
        descripcion: "",
        cruce: "",
        debito: 852500,
        credito: 852500,
        observacion: "",
      },
      {
        cuenta: "51057201",
        cuentaNombre: "APORTES CAJAS DE COMPESACION FAMILIAR",
        comprobante: "P 02",
        fecha: "2026-08-01",
        nit: "890101999",
        nombre: "COMFAMILIAR",
        descripcion: "",
        cruce: "",
        debito: 852500,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "51059522",
        cuentaNombre: "AHORRO INSTITUCIONAL",
        comprobante: "P 03",
        fecha: "2026-08-01",
        nit: "900000001",
        nombre: "FONDO EMPLEADOS",
        descripcion: "",
        cruce: "",
        debito: 10000000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "11100512",
        cuentaNombre: "BANCO COLMENA BCSC",
        comprobante: "G 01",
        fecha: "2026-08-01",
        nit: "1",
        nombre: "BANCO",
        descripcion: "",
        cruce: "",
        debito: 1000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "12503511",
        cuentaNombre: "CORREVAL - FONVAL",
        comprobante: "G 02",
        fecha: "2026-08-01",
        nit: "2",
        nombre: "CREDICORP",
        descripcion: "",
        cruce: "",
        debito: 2000,
        credito: 0,
        observacion: "",
      },
    ];

    const detected = getAvailableBankAccounts(movCuentas);
    const cuentasDetectadas = detected.map((d) => d.cuenta);

    // Debe incluir SOLO activos de tesorería y fondos
    assert.deepStrictEqual(cuentasDetectadas, ["11100512", "12503511"]);

    // Debe excluir cuentas de pasivo (2370) y gastos (5105)
    assert.strictEqual(cuentasDetectadas.includes("23701001"), false, "2370 NUNCA debe ser tesorería");
    assert.strictEqual(cuentasDetectadas.includes("51057201"), false, "5105 NUNCA debe ser tesorería");
    assert.strictEqual(cuentasDetectadas.includes("51059522"), false, "5105 NUNCA debe ser tesorería");
  });

  it("debe cuadrar al 100% y señalar que la única diferencia de ajuste son los rendimientos", () => {
    const extracto: BankExtractItem[] = [
      { id: "e1", fecha: "2026-08-06", descripcion: "AJUSTE TRASLADO", referencia: "TP 1", debito: 25000000, credito: 0 },
      { id: "e2", fecha: "2026-08-31", descripcion: "RENDIMIENTOS DEL MES", referencia: "1-1-47311-2", debito: 0, credito: 1959190.59 },
    ];

    const libros: MovLine[] = [
      {
        cuenta: "12503511",
        cuentaNombre: "CORREVAL - FONVAL",
        comprobante: "L 001",
        fecha: "2026-08-01",
        nit: "0",
        nombre: "RENDIMIENTOS JULIO 2026",
        descripcion: "RENDIMIENTOS JULIO 2026",
        cruce: "",
        debito: 2367723.42, // Reflejado en saldo inicial de extracto
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "12503511",
        cuentaNombre: "CORREVAL - FONVAL",
        comprobante: "G 001",
        fecha: "2026-08-06",
        nit: "900",
        nombre: "PROVEEDOR",
        descripcion: "AJUSTE TRASLADO",
        cruce: "",
        debito: 0,
        credito: 25000000,
        observacion: "",
      },
    ];

    const saldoInicial = 329354431.03;
    const res = conciliarBancos(extracto, libros, saldoInicial, saldoInicial);

    assert.strictEqual(res.summary.cuadrado, true, "Debe estar cuadrado 100%");
    assert.strictEqual(res.summary.soloRendimientos, true, "La única diferencia deben ser los rendimientos");
    assert.strictEqual(Math.round(res.summary.diferenciaCuadre), 0);
    assert.strictEqual(Math.round(res.summary.diferenciaExtractoLibros ?? 0), 1959191);
    assert.strictEqual(res.summary.notasCreditoRendimientos, 1959190.59);
  });

  it("debe permitir conciliar con 'credicorp_all' (ambas cuentas: 12503511 + 12450541) o individualmente", () => {
    const movLines: MovLine[] = [
      {
        cuenta: "12503511",
        cuentaNombre: "CORREVAL - FONVAL",
        comprobante: "L 001",
        fecha: "2026-08-01",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL COLOMBIA",
        descripcion: "OPERACIONES FONVAL",
        cruce: "",
        debito: 1000000,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "12450541",
        cuentaNombre: "SERFINCO CARTERA COLECTIVA 1046364000 SMTE",
        comprobante: "L 002",
        fecha: "2026-08-01",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL COLOMBIA",
        descripcion: "CARTERA VISTA",
        cruce: "",
        debito: 5541.08,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "11100512",
        cuentaNombre: "BANCO COLMENA BCSC",
        comprobante: "CE 01",
        fecha: "2026-08-01",
        nit: "900",
        nombre: "TERCERO",
        descripcion: "PAGO BCSC",
        cruce: "",
        debito: 0,
        credito: 500000,
        observacion: "",
      },
    ];

    // 1. Filtrar solo 12503511
    const f1 = extractLibroBancos(movLines, "12503511");
    assert.strictEqual(f1.length, 1);
    assert.strictEqual(f1[0].cuenta, "12503511");

    // 2. Filtrar solo 12450541
    const f2 = extractLibroBancos(movLines, "12450541");
    assert.strictEqual(f2.length, 1);
    assert.strictEqual(f2[0].cuenta, "12450541");

    // 3. Filtrar ambas cuentas de Credicorp con 'credicorp_all'
    const fBoth = extractLibroBancos(movLines, "credicorp_all");
    assert.strictEqual(fBoth.length, 2);
    assert.ok(fBoth.some((m) => m.cuenta === "12503511"));
    assert.ok(fBoth.some((m) => m.cuenta === "12450541"));
    assert.strictEqual(fBoth.some((m) => m.cuenta === "11100512"), false);

    // 4. Filtrar por lista separada por comas
    const fComma = extractLibroBancos(movLines, "12503511, 12450541");
    assert.strictEqual(fComma.length, 2);
  });

  it("debe conciliar el caso Credicorp con ambas subcuentas de rendimientos de julio (12503511 y 12450541 con $5.541,08) sin generar falsas consignaciones en tránsito", () => {
    const extracto: BankExtractItem[] = [
      {
        id: "b1",
        fecha: "2026-08-06",
        descripcion: "TRASLADO FONDOS FONVAL",
        referencia: "001",
        debito: 25000000,
        credito: 0,
      },
      {
        id: "b2",
        fecha: "2026-08-20",
        descripcion: "PAGO PROVEEDORES ACH",
        referencia: "002",
        debito: 129730569.7,
        credito: 0,
      },
      {
        id: "b3",
        fecha: "2026-08-31",
        descripcion: "RENDIMIENTOS FONDO DE INVERSION COLECTIVA CREDICORP",
        referencia: "REND-AGO",
        debito: 0,
        credito: 1959190.59,
      },
    ];

    const libros: MovLine[] = [
      {
        cuenta: "12503511",
        cuentaNombre: "CORREVAL - FONVAL ALTA LIQUIDEZ",
        comprobante: "L 001",
        fecha: "2026-08-01",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL COLOMBIA",
        descripcion: "RENDIMIENTOS JULIO 2026 FONVAL",
        cruce: "",
        debito: 2367723.42,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "12450541",
        cuentaNombre: "SERFINCO CARTERA COLECTIVA SMTE CARTERA VISTA",
        comprobante: "L 002",
        fecha: "2026-08-01",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL COLOMBIA",
        descripcion: "RENDIMIENTOS JULIO 2026 CARTERA VISTA",
        cruce: "",
        debito: 5541.08,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "12503511",
        cuentaNombre: "CORREVAL - FONVAL",
        comprobante: "G 001",
        fecha: "2026-08-06",
        nit: "900",
        nombre: "PROVEEDOR",
        descripcion: "TRASLADO FONDOS FONVAL",
        cruce: "",
        debito: 0,
        credito: 25000000,
        observacion: "",
      },
      {
        cuenta: "12503511",
        cuentaNombre: "CORREVAL - FONVAL",
        comprobante: "G 002",
        fecha: "2026-08-20",
        nit: "901",
        nombre: "PAGO PROVEEDORES",
        descripcion: "PAGO PROVEEDORES ACH",
        cruce: "",
        debito: 0,
        credito: 129730569.7,
        observacion: "",
      },
    ];

    const saldoInicial = 329354431.03;
    const res = conciliarBancos(extracto, libros, saldoInicial, saldoInicial);

    // Verificaciones críticas solicitadas por el usuario:
    // 1. Los 5.541,08 NO deben aparecer como consignaciones en tránsito
    assert.strictEqual(res.summary.consignacionesEnTransito, 0, "No debe haber consignaciones en tránsito falsas");
    assert.strictEqual(res.summary.chequesEnTransito, 0);
    assert.strictEqual(res.summary.notasDebitoNoRegistradas, 0);

    // 2. La única diferencia deben ser los rendimientos de agosto (1.959.190,59)
    assert.strictEqual(res.summary.soloRendimientos, true, "soloRendimientos debe ser true");
    assert.strictEqual(res.summary.cuadrado, true, "Debe estar cuadrado");
    assert.strictEqual(res.summary.notasCreditoRendimientos, 1959190.59);
    assert.ok(Math.abs(res.summary.diferenciaCuadre) < 0.01, "Diferencia de cuadre debe ser 0");

    // 3. Saldo conciliado coincide con saldo final extracto
    const saldoFinalEsperado = saldoInicial + 1959190.59 - 25000000 - 129730569.7;
    assert.ok(Math.abs(res.summary.saldoExtracto - saldoFinalEsperado) < 0.01);
    assert.ok(Math.abs(res.summary.saldoConciliado - saldoFinalEsperado) < 0.01);

    // 4. Desglose ejecutivo de rendimientos (Separación de periodo actual vs anterior solicitada por el usuario):
    const exec = getBankExecutiveBreakdown(res.rows);
    // Periodo actual: únicamente los 1.959.190,59 del extracto
    assert.strictEqual(exec.rendimientos.periodoActual.count, 1);
    assert.strictEqual(exec.rendimientos.periodoActual.total, 1959190.59);
    assert.strictEqual(exec.rendimientos.periodoActual.pendiente, 1959190.59);
    // Periodo anterior: los dos comprobantes causados en libros (2.367.723,42 + 5.541,08 = 2.373.264,50)
    assert.strictEqual(exec.rendimientos.periodoAnterior.count, 2);
    assert.ok(Math.abs(exec.rendimientos.periodoAnterior.total - 2373264.50) < 0.01);
    assert.strictEqual(exec.rendimientos.periodoAnterior.items.length, 2);
    // El valor principal de la tarjeta destaca el periodo actual y no la suma revuelta
    assert.strictEqual(exec.rendimientos.total, 1959190.59);
    assert.ok(Math.abs(exec.rendimientos.totalConsolidadoAmbosPeriodos - 4332455.09) < 0.01);
  });

  it("debe conciliar movimiento bancario cuya referencia tiene ceros a la izquierda o viene en la descripción", () => {
    const extracto: BankExtractItem[] = [
      {
        id: "b1",
        fecha: "2026-09-10",
        descripcion: "TRANSFERENCIA ACH ABONO FACTURA 49812",
        referencia: "000049812",
        debito: 3500000,
        credito: 0,
        saldo: 10000000,
      },
    ];

    const libros: MovLine[] = [
      {
        cuenta: "111005",
        cuentaNombre: "BANCOLOMBIA",
        comprobante: "G 001 00049812",
        fecha: "2026-09-10",
        nit: "900111222",
        nombre: "PROVEEDOR S.A.S.",
        descripcion: "PAGO FACTURA 49812",
        referencia: "49812",
        cruce: "49812",
        debito: 0,
        credito: 3500000,
        observacion: "",
      },
    ];

    const res = conciliarBancos(extracto, libros);
    assert.strictEqual(res.summary.totalConciliados, 1);
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.rows[0].montoBanco, 3500000);
    assert.strictEqual(res.rows[0].diferencia, 0);
  });

  it("debe conciliar rendimientos registrados en libros de la cuenta 114413 (Soporte Minero / SMTE) sin duplicar ni marcar como pendientes por causar", () => {
    // Extracto bancario / fondo de inversión con abono de rendimientos del periodo actual
    const extracto: BankExtractItem[] = [
      {
        id: "ext_rend_1",
        fecha: "2026-08-31",
        descripcion: "RENDIMIENTOS FINANCIEROS (CREDICORP CAPITAL ALTA LIQUIDEZ)",
        referencia: "1-1-53747-4",
        debito: 0,
        credito: 13519.8,
        saldo: 9829414.6,
      },
      {
        id: "ext_mov_1",
        fecha: "2026-08-28",
        descripcion: "INCREMENTO POR TRASLADO DESDE CTA ADMIN VALORES",
        referencia: "TRASLADO",
        debito: 0,
        credito: 9097528.28,
        saldo: 9815894.8,
      },
    ];

    // Libros contables de Soporte Minero Técnico (SMTE) cuenta 114413 con los rendimientos ya registrados
    const libros: MovLine[] = [
      {
        cuenta: "11441301",
        cuentaNombre: "114413 CREDICORP CAPITAL SMTE",
        comprobante: "L 001 00000000122 001",
        fecha: "2026-08-31",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL COLOMBIA S.A",
        descripcion: "CAUSACION RENDIMIENTOS AGOSTO 2026 SMTE",
        cruce: "",
        debito: 13519.8,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "11441301",
        cuentaNombre: "114413 CREDICORP CAPITAL SMTE",
        comprobante: "RC 002 00000000045 001",
        fecha: "2026-08-28",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL COLOMBIA S.A",
        descripcion: "TRASLADO CTA ADMIN VALORES",
        cruce: "TRASLADO",
        debito: 9097528.28,
        credito: 0,
        observacion: "",
      },
    ];

    const saldoInicial = 718366.52;
    const res = conciliarBancos(extracto, libros, saldoInicial, saldoInicial);

    // Verificaciones indispensables:
    // 1. Debe haber exactamente 2 filas conciliadas y NINGUNA partida pendiente ni duplicada
    assert.strictEqual(res.summary.totalItemsBanco, 2);
    assert.strictEqual(res.summary.totalItemsLibros, 2);
    assert.strictEqual(res.summary.totalConciliados, 2);
    assert.strictEqual(res.rows.length, 2);

    // 2. NINGUNA fila debe estar como nota_credito_banco ("Rendimientos pendientes por causar")
    const pendientesPorCausar = res.rows.filter((r) => r.estado === "nota_credito_banco");
    assert.strictEqual(pendientesPorCausar.length, 0, "No debe haber notas crédito pendientes si el usuario ya registró el rendimiento");

    // 3. NINGUNA partida en tránsito en libros
    assert.strictEqual(res.summary.consignacionesEnTransito, 0);
    assert.strictEqual(res.summary.chequesEnTransito, 0);

    // 4. El rendimiento debe aparecer UNA SOLA VEZ y con estado 'conciliado'
    const rendimientoRows = res.rows.filter((r) => r.esRendimiento);
    assert.strictEqual(rendimientoRows.length, 1, "El rendimiento debe aparecer exactamente UNA vez, no duplicado");
    assert.strictEqual(rendimientoRows[0].estado, "conciliado");
    assert.strictEqual(rendimientoRows[0].montoBanco, 13519.8);
    assert.strictEqual(rendimientoRows[0].montoLibros, 13519.8);
    assert.strictEqual(rendimientoRows[0].diferencia, 0);

    // 5. La conciliación debe estar cuadrada al 100%
    assert.strictEqual(res.summary.cuadrado, true);
    assert.strictEqual(res.summary.diferenciaCuadre, 0);
  });

  it("debe exigir coincidencia exacta con centavos sin permitir tolerancias arbitrarias de redondeo", () => {
    const extracto: BankExtractItem[] = [
      {
        id: "ext_rend_exact",
        fecha: "2026-09-30",
        descripcion: "RENDIMIENTOS",
        referencia: "1-1-44413-6",
        debito: 0,
        credito: 116920.65,
        saldo: 15398635.55,
      },
    ];

    // Caso 1: Con valor exacto al centavo (debe conciliar al 100%)
    const librosExactos: MovLine[] = [
      {
        cuenta: "12503511",
        cuentaNombre: "CORREVAL - FONVAL",
        comprobante: "L 001 00000000098 002",
        fecha: "2026-09-30",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL",
        descripcion: "RENDIMIENTOS SEPT 2026",
        cruce: "",
        debito: 116920.65,
        credito: 0,
        observacion: "",
      },
    ];

    const resExacto = conciliarBancos(extracto, librosExactos, 29183105, 29183105);
    assert.strictEqual(resExacto.summary.totalConciliados, 1);
    assert.strictEqual(resExacto.rows[0].estado, "conciliado");
    assert.strictEqual(resExacto.rows[0].diferencia, 0);
    assert.strictEqual(resExacto.summary.consignacionesEnTransito, 0);
    assert.strictEqual(resExacto.summary.notasCreditoRendimientos, 0);

    // Caso 2: Con diferencia en decimales (no debe forzar coincidencia inexacta)
    const librosInexactos: MovLine[] = [
      {
        cuenta: "12503511",
        cuentaNombre: "CORREVAL - FONVAL",
        comprobante: "L 001 00000000098 002",
        fecha: "2026-09-30",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL",
        descripcion: "RENDIMIENTOS SEPT 2026",
        cruce: "",
        debito: 116921.0, // Diferencia de más de 0.05
        credito: 0,
        observacion: "",
      },
    ];

    const resInexacto = conciliarBancos(extracto, librosInexactos, 29183105, 29183105);
    assert.strictEqual(resInexacto.summary.totalConciliados, 0, "No debe cruzar valores si no coinciden en sus centavos exactos");
  });

  it("debe conciliar en lote cuando la causación contable agrupa o divide subcuentas de rendimientos (1 abono extracto = 2 comprobantes libros)", () => {
    const extracto: BankExtractItem[] = [
      {
        id: "ext_rend_total",
        fecha: "2026-08-31",
        descripcion: "ABONO RENDIMIENTOS FINANCIEROS CONSOLIDADOS",
        referencia: "PORTAFOLIO",
        debito: 0,
        credito: 19601.21,
        saldo: 5000000,
      },
    ];

    const libros: MovLine[] = [
      {
        cuenta: "11441301",
        cuentaNombre: "CARTERA ALTA LIQUIDEZ",
        comprobante: "L 001",
        fecha: "2026-08-31",
        nit: "860068182",
        nombre: "FIDUCIARIA",
        descripcion: "RENDIMIENTOS SUB-PORTAFOLIO 1",
        cruce: "",
        debito: 13519.8,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "11441302",
        cuentaNombre: "CARTERA VISTA",
        comprobante: "L 002",
        fecha: "2026-08-31",
        nit: "860068182",
        nombre: "FIDUCIARIA",
        descripcion: "RENDIMIENTOS SUB-PORTAFOLIO 2",
        cruce: "",
        debito: 6081.41,
        credito: 0,
        observacion: "",
      },
    ];

    const res = conciliarBancos(extracto, libros);
    assert.strictEqual(res.summary.totalConciliados, 1);
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.rows[0].esRendimiento, true);
    assert.strictEqual(res.rows[0].itemsLibrosLote?.length, 2);
    assert.strictEqual(res.summary.notasCreditoNoRegistradas, 0);
  });

  it("debe conciliar comisiones bancarias registradas en libros a fin de mes mediante comprobante de ajuste (L o NC) sin importar la diferencia de días con el extracto", () => {
    const extracto: BankExtractItem[] = [
      {
        id: "com-sep-16",
        fecha: "2026-09-16",
        descripcion: "COBRO OP BANCARIA TRANSF Y/O CHQ CON IVA",
        referencia: "TRANSF",
        debito: 37313.64,
        credito: 0,
        saldo: 6000000,
      },
    ];

    const libros: MovLine[] = [
      {
        cuenta: "12503528",
        cuentaNombre: "CORREVAL - FONVAL TESORERIA",
        comprobante: "L 001 00000000027 004",
        fecha: "2026-09-30",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL FIDUCIARIA S.A.",
        descripcion: "COMISION SEPTIEMBRE 2026",
        cruce: "",
        debito: 0,
        credito: 37313.64,
        observacion: "",
      },
    ];

    const res = conciliarBancos(extracto, libros, 10000000, 10000000);
    assert.strictEqual(res.summary.totalConciliados, 1);
    assert.strictEqual(res.rows[0].estado, "conciliado");
    assert.strictEqual(res.summary.chequesEnTransito, 0);
    assert.strictEqual(res.summary.notasDebitoComisiones, 0);
    assert.strictEqual(res.summary.notasDebitoNoRegistradas, 0);
  });

  it("debe reconocer rendimientos del mes anterior causados el primer día del mes corriente como parte del saldo inicial sin generar falsa partida en tránsito", () => {
    // Caso real Norcarbón: Saldo inicial extracto ya incluye rendimientos de agosto ($757.776,52).
    // Libros al 31 de agosto tenía $9.299.388,66, y causa el 1 de septiembre los rendimientos de agosto.
    // 9.299.388,66 + 757.776,52 = 10.057.165,18 (saldo inicial extracto).
    const extracto: BankExtractItem[] = [
      {
        id: "ext-1",
        fecha: "2026-09-16",
        descripcion: "COBRO COMISION BANCARIA",
        referencia: "COM",
        debito: 50000,
        credito: 0,
        saldo: 10007165.18,
      },
    ];

    const libros: MovLine[] = [
      {
        cuenta: "12503528",
        cuentaNombre: "CORREVAL - FONVAL TESORERIA",
        comprobante: "L 001 00000000026 002",
        fecha: "2026-09-01",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL FIDUCIARIA S.A.",
        descripcion: "RENDIMIENTOS AGOSTO 2026",
        cruce: "",
        debito: 757776.52,
        credito: 0,
        observacion: "",
      },
      {
        cuenta: "12503528",
        cuentaNombre: "CORREVAL - FONVAL TESORERIA",
        comprobante: "L 001 00000000027 004",
        fecha: "2026-09-30",
        nit: "860068182",
        nombre: "CREDICORP CAPITAL FIDUCIARIA S.A.",
        descripcion: "COMISION SEPTIEMBRE 2026",
        cruce: "",
        debito: 0,
        credito: 50000,
        observacion: "",
      },
    ];

    const saldoInicialExtracto = 10057165.18;
    const saldoInicialLibros = 9299388.66; // 9.299.388,66 + 757.776,52 = 10.057.165,18

    const res = conciliarBancos(extracto, libros, saldoInicialExtracto, saldoInicialLibros);
    // No debe considerar los $757.776,52 como "Consignación en Tránsito"
    assert.strictEqual(res.summary.consignacionesEnTransito, 0, "No debe haber consignaciones en tránsito falsas");
    assert.strictEqual(res.summary.chequesEnTransito, 0);
    assert.strictEqual(res.summary.totalConciliados, 2);
    assert.strictEqual(res.summary.cuadrado, true);
    assert.strictEqual(res.summary.diferenciaCuadre, 0);
  });
});


