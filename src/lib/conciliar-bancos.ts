import type { MovLine } from "./types.ts";

export interface BankExtractItem {
  id: string;
  fecha: string;
  descripcion: string;
  referencia: string;
  debito: number; // Salida / Retiro del banco
  credito: number; // Entrada / Abono al banco
  saldo?: number;
}

export type EstadoConciliacionBancaria =
  | "conciliado"
  | "partida_en_transito_libros" // Está en libros, falta en el banco (ej. cheque girado y no cobrado)
  | "nota_debito_banco" // Salida en banco no registrada en libros (GMF 4x1000, comisión, chequera)
  | "nota_credito_banco" // Entrada en banco no registrada en libros (rendimientos, transferencias no identificadas)
  | "diferencia_valor";

export interface BankConciliacionRow {
  id: string;
  estado: EstadoConciliacionBancaria;
  fecha: string;
  descripcion: string;
  referencia: string;
  tipo: "retiro" | "consignacion";
  montoBanco: number;
  montoLibros: number;
  diferencia: number;
  esGmf: boolean;
  esComision: boolean;
  esRendimiento: boolean;
  itemBanco?: BankExtractItem;
  itemLibros?: MovLine;
  itemsLibrosLote?: MovLine[];
  nota: string;
}

export interface BankConciliacionSummary {
  saldoExtracto: number;
  saldoLibros: number;
  consignacionesEnTransito: number;
  chequesEnTransito: number;
  notasDebitoNoRegistradas: number;
  notasCreditoNoRegistradas: number;
  notasDebitoGmf?: number;
  notasDebitoComisiones?: number;
  notasDebitoOperativas?: number;
  notasCreditoRendimientos?: number;
  notasCreditoOperativas?: number;
  saldoConciliado: number;
  diferenciaCuadre: number;
  diferenciaExtractoLibros?: number;
  cuadrado: boolean;
  soloRendimientos?: boolean;
  totalItemsBanco: number;
  totalItemsLibros: number;
  totalConciliados: number;
  totalMovimientosBancoConciliados?: number;
}

export interface DetectedBankAccount {
  cuenta: string;
  cuentaNombre: string;
  totalMovimientos: number;
  saldoInicial?: number;
  totalDebitos: number;
  totalCreditos: number;
  saldoFinal: number;
}

export interface BankConciliacionResult {
  rows: BankConciliacionRow[];
  summary: BankConciliacionSummary;
  cuentasBancosDetectadas: string[];
  cuentasDetalle?: DetectedBankAccount[];
}

/**
 * Determina si una cuenta contable corresponde estrictamente a Tesorería, Bancos o Fondos de Inversión/Liquidez.
 * Regla contable estricta:
 * - Cuentas de Pasivo (2xxx), Patrimonio (3xxx), Ingresos (4xxx), Gastos (5xxx), Costos (6xxx, 7xxx), Orden (8xxx, 9xxx)
 *   NUNCA son bancos ni tesorería, incluso si su nombre contiene "caja" (ej. 2370/5105 cajas de compensación) o "ahorro" (ej. ahorro institucional).
 * - Cuentas de Activo de Tesorería PUC: 11 (Efectivo y equivalentes: 1105 Caja, 1110 Bancos, 1115 Remesas, 1120 Ahorro, 1125 Fondos).
 * - Cuentas de Activo de Inversiones / FICs de Liquidez: 1205, 1215, 1225, 1245 (Carteras Colectivas / SMTE), 1250 (Fondos de Inversión / Fonval / Credicorp).
 * - Cuentas bajo IFRS / NIIF: Clase 10 (Efectivo y equivalentes).
 */
export function isTreasuryAccount(c: string, nom: string): boolean {
  const cleanC = (c || "").trim();
  const cleanNom = (nom || "").trim().toLowerCase();

  // Regla contable absoluta: Pasivos (2), Patrimonio (3), Ingresos (4), Gastos (5), Costos (6/7), Orden (8/9) JAMÁS son bancos/tesorería
  if (/^[2-9]/.test(cleanC)) {
    return false;
  }

  // Exclusiones explícitas de conceptos que no son tesorería aunque coincidan con palabras como "caja" o "ahorro"
  if (
    /cajas?\s+de\s+compensaci|sena\b|icbf\b|n[oó]mina|cesant|pensi[oó]n|ahorro\s+institucional|fondo\s+de\s+empleados|retenci[oó]n|proveedor|cliente|deudor|anticipo/i.test(
      cleanNom
    )
  ) {
    return false;
  }

  // Cuentas de Activo de Tesorería PUC y FICs / Fondos de liquidez:
  if (
    cleanC.startsWith("11") ||
    cleanC.startsWith("1250") ||
    cleanC.startsWith("1245") ||
    cleanC.startsWith("1205") ||
    cleanC.startsWith("1225") ||
    cleanC.startsWith("10")
  ) {
    return true;
  }

  // Cuentas con códigos de ERP alfanuméricos cuyo nombre confirme explícitamente tesorería bancaria
  if (
    /banco|bcsc|colmena|credicorp|correval|banistmo|fonval|fiducia|fic\b|cartera colectiva|cuenta\s*corriente|cta\s*cte|cuenta\s*de\s*ahorro|cta\s*ahorro|caja\s*general|caja\s*menor/i.test(
      cleanNom
    )
  ) {
    return cleanC.startsWith("1") || !/^[0-9]/.test(cleanC);
  }

  return false;
}

/**
 * Detecta y agrupa todas las cuentas contables de tesorería, bancos e inversiones/fondos
 * (Clase 11 y Clase 12 como 1250 Fondos de Inversión / FICs / Carteras Colectivas tipo Credicorp)
 */
export function getAvailableBankAccounts(mov: MovLine[]): DetectedBankAccount[] {
  const map = new Map<string, {
    cuenta: string;
    cuentaNombre: string;
    totalMovimientos: number;
    totalDebitos: number;
    totalCreditos: number;
    saldoInicial?: number;
  }>();

  for (const line of mov) {
    const c = line.cuenta.trim();
    const nom = (line.cuentaNombre || "").trim();

    if (!isTreasuryAccount(c, nom)) continue;

    if (!map.has(c)) {
      map.set(c, {
        cuenta: c,
        cuentaNombre: nom || c,
        totalMovimientos: 0,
        totalDebitos: 0,
        totalCreditos: 0,
      });
    }

    const acc = map.get(c)!;
    acc.totalMovimientos++;
    acc.totalDebitos += line.debito;
    acc.totalCreditos += line.credito;
    if (nom && nom.length > acc.cuentaNombre.length) {
      acc.cuentaNombre = nom;
    }
  }

  // Si ninguna cuenta coincidió con el filtro tradicional (ej. ERP con plan de cuentas atípico o códigos alfanuméricos),
  // se listan todas las cuentas encontradas en el archivo para que ningún software quede bloqueado.
  if (map.size === 0) {
    for (const line of mov) {
      const c = line.cuenta.trim();
      const nom = (line.cuentaNombre || "").trim();
      if (!c) continue;
      if (!map.has(c)) {
        map.set(c, {
          cuenta: c,
          cuentaNombre: nom || c,
          totalMovimientos: 0,
          totalDebitos: 0,
          totalCreditos: 0,
        });
      }
      const acc = map.get(c)!;
      acc.totalMovimientos++;
      acc.totalDebitos += line.debito;
      acc.totalCreditos += line.credito;
      if (nom && nom.length > acc.cuentaNombre.length) {
        acc.cuentaNombre = nom;
      }
    }
  }

  return Array.from(map.values())
    .map((a) => ({
      ...a,
      saldoFinal: (a.saldoInicial || 0) + a.totalDebitos - a.totalCreditos,
    }))
    .sort((a, b) => a.cuenta.localeCompare(b.cuenta));
}

/**
 * Filtra los movimientos contables del ERP correspondientes a cuentas de bancos y tesorería
 * (Clase 11, típicamente 1110 Bancos, 1120 Cuentas de Ahorro, 1105 Caja General, 1115 Remesas,
 * Clase 1250 Fondos de Inversión Colectiva / Carteras Colectivas / FICs, o IFRS Clase 10).
 */
export function extractLibroBancos(mov: MovLine[], cuentaFiltro?: string): MovLine[] {
  if (cuentaFiltro && cuentaFiltro !== "todas") {
    const cleanFiltro = cuentaFiltro.trim();
    if (cleanFiltro === "credicorp_all") {
      return mov.filter((m) => {
        const c = m.cuenta.trim();
        const nom = (m.cuentaNombre || "").toLowerCase();
        return (
          c.startsWith("12503511") ||
          c.startsWith("12450541") ||
          /credicorp|correval|fonval|serfinco/i.test(nom)
        );
      });
    }

    const filters = cleanFiltro
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return mov.filter((m) => {
      const c = m.cuenta.trim();
      return filters.some((f) => c === f || c.startsWith(f));
    });
  }

  const filtered = mov.filter((m) => isTreasuryAccount(m.cuenta, m.cuentaNombre));

  return filtered.length > 0 ? filtered : mov;
}

/**
 * Clasifica de forma estricta y mutuamente excluyente los conceptos de un movimiento bancario:
 * - GMF (Gravamen a los Movimientos Financieros / 4x1000)
 * - Rendimientos Financieros (abonos de intereses del banco)
 * - Comisiones Bancarias (cuotas de manejo, tarifas, chequeras, costos de transferencia / operaciones bancarias con IVA)
 */
export function classifyMovementConcept(desc: string): {
  esGmf: boolean;
  esComision: boolean;
  esRendimiento: boolean;
} {
  const d = (desc || "").toLowerCase();

  // 1. Detección de GMF (4x1000)
  const esGmf = /gmf|4x1000|4\s*x\s*1000|gravamen|cobro\s*gm|impuesto.*gobierno/i.test(d);

  // 2. Detección de Rendimientos / Abono de intereses
  const esRendimiento = /rendimiento|inter[eé]s.*abono|intereses.*liquidados/i.test(d);

  // 3. Detección de Comisiones Bancarias:
  // IMPORTANTE: Una comisión bancaria NUNCA es GMF ni Rendimiento.
  // Debe describir expresamente comisiones, cuotas de manejo, chequeras, tarifas bancarias,
  // costo de transferencia/transaccional, cobro de operación bancaria o IVA financiero asociado.
  const esComision =
    !esGmf &&
    !esRendimiento &&
    /comisi[oó]n|cuota.*manejo|chequera|tarifa|costo.*transf|costo.*transaccional|cobro.*(?:op|operaci[oó]n|bancar|tarifa|transf|servicio|cuota|mantenimiento)|cargo.*servicio|iva.*(?:comisi[oó]n|cuota|tarifa|bancar)/i.test(
      d
    );

  return { esGmf, esComision, esRendimiento };
}

/**
 * Motor de Conciliación Bancaria Automática (Extracto Bancario vs Cuenta 11 / Fondos)
 * Aplica la regla contable espejo:
 * - Débito en Banco (Retiro) <=> Crédito en Libros (Disminución de Banco)
 * - Crédito en Banco (Abono)  <=> Débito en Libros (Aumento de Banco)
 *
 * Incluye:
 * 1. Cruce exacto por documento / referencia y valor
 * 2. Cruce exacto por valor y ventana de compensación
 * 3. Cruce en Lotes / Pagos Agrupados ACH (1 a N y N a 1)
 * 4. Identificación de notas bancarias (4x1000 GMF, comisiones, rendimientos)
 * 5. Determinación de partidas en tránsito
 */
export function conciliarBancos(
  extracto: BankExtractItem[],
  libros: MovLine[],
  saldoInicialExtracto = 0,
  saldoInicialLibros = 0
): BankConciliacionResult {
  const matchedExtractoIds = new Set<string>();
  const matchedLibroIndices = new Set<number>();
  const rows: BankConciliacionRow[] = [];

  // Filtrar posibles filas de totales o resúmenes de software contable (sin comprobante ni fecha)
  const cleanLibros = libros.filter((l) => Boolean((l.comprobante || "").trim() || (l.fecha || "").trim()));

  if (extracto.length === 0 && cleanLibros.length === 0) {
    return {
      rows: [],
      summary: {
        saldoExtracto: 0,
        saldoLibros: 0,
        consignacionesEnTransito: 0,
        chequesEnTransito: 0,
        notasDebitoNoRegistradas: 0,
        notasCreditoNoRegistradas: 0,
        notasDebitoGmf: 0,
        notasDebitoComisiones: 0,
        notasDebitoOperativas: 0,
        notasCreditoRendimientos: 0,
        notasCreditoOperativas: 0,
        saldoConciliado: 0,
        diferenciaCuadre: 0,
        cuadrado: false,
        soloRendimientos: false,
        totalItemsBanco: 0,
        totalItemsLibros: 0,
        totalConciliados: 0,
      },
      cuentasBancosDetectadas: [],
    };
  }

  // Detección de cuentas bancarias
  const cuentasSet = new Set<string>();
  for (const l of cleanLibros) {
    if (l.cuenta) cuentasSet.add(l.cuenta);
  }
  const cuentasBancosDetectadas = Array.from(cuentasSet);
  const cuentasDetalle = getAvailableBankAccounts(cleanLibros);

  let prevRendLineIndex = -1;
  // FASE 0: Causación en libros de Rendimientos del periodo anterior que igualan el Saldo Inicial
  for (let i = 0; i < cleanLibros.length; i++) {
    const l = cleanLibros[i];
    if (l.debito > 0 && /rendimientos?\s+(julio|mes\s+anterior|inicial)/i.test(l.descripcion || l.nombre)) {
      prevRendLineIndex = i;
      matchedLibroIndices.add(i);
      rows.push({
        id: `prev_rend_${i}`,
        estado: "conciliado",
        fecha: l.fecha,
        descripcion: `${l.descripcion || l.nombre} ↔ (Causación de rendimientos mes anterior que iguala saldo inicial de extracto)`,
        referencia: l.comprobante || "Saldo Inicial",
        tipo: "consignacion",
        montoBanco: 0,
        montoLibros: l.debito,
        diferencia: 0,
        esGmf: false,
        esComision: false,
        esRendimiento: true,
        itemLibros: l,
        nota: "Causación contable de rendimientos del periodo anterior ya reflejados en el saldo inicial del banco.",
      });
      break;
    }
  }

  // FASE 1: Cruce exacto por Referencia / Cheque y Valor
  for (const bItem of extracto) {
    if (matchedExtractoIds.has(bItem.id)) continue;
    const isRetiro = bItem.debito > 0;
    const montoBanco = isRetiro ? bItem.debito : bItem.credito;
    const refClean = (bItem.referencia || "").replace(/\D/g, "");

    if (refClean.length >= 4) {
      for (let i = 0; i < cleanLibros.length; i++) {
        if (matchedLibroIndices.has(i)) continue;
        const lItem = cleanLibros[i];
        const montoLibro = isRetiro ? lItem.credito : lItem.debito;

        const libroRefClean = (lItem.referencia || lItem.cruce || lItem.comprobante || "").replace(/\D/g, "");
        if (libroRefClean.includes(refClean) || refClean.includes(libroRefClean)) {
          if (Math.abs(montoBanco - montoLibro) <= 0.05) {
            matchedExtractoIds.add(bItem.id);
            matchedLibroIndices.add(i);
            const { esGmf, esComision, esRendimiento } = classifyMovementConcept(bItem.descripcion);
            rows.push({
              id: `match_${bItem.id}_${i}`,
              estado: "conciliado",
              fecha: bItem.fecha,
              descripcion: `${bItem.descripcion} ↔ ${lItem.descripcion || lItem.nombre}`,
              referencia: bItem.referencia || lItem.referencia || lItem.comprobante || "Match directo",
              tipo: isRetiro ? "retiro" : "consignacion",
              montoBanco,
              montoLibros: montoLibro,
              diferencia: 0,
              esGmf,
              esComision,
              esRendimiento,
              itemBanco: bItem,
              itemLibros: lItem,
              nota: "Conciliado por referencia de documento/cheque y valor exacto.",
            });
            break;
          }
        }
      }
    }
  }

  // FASE 2: Cruce en Lotes / Pagos Agrupados ACH (1 débito en banco = N comprobantes en libros)
  // DEBE EJECUTARSE ANTES DEL CRUCE POR VALOR INDIVIDUAL para evitar que un comprobante individual
  // sea sustraído del lote agrupado del mismo día.
  for (const bItem of extracto) {
    if (matchedExtractoIds.has(bItem.id)) continue;
    const isRetiro = bItem.debito > 0;
    const montoBanco = isRetiro ? bItem.debito : bItem.credito;
    const bTime = new Date(bItem.fecha).getTime();

    // Si ya existe un registro 1-a-1 en libros con el mismo valor exacto en fecha cercana (±2 días),
    // se trata de una operación individual, no un lote agrupado ACH. Se reserva para la Fase 4.
    const hasExactSingleCandidate = cleanLibros.some((l, idx) => {
      if (matchedLibroIndices.has(idx)) return false;
      const val = isRetiro ? l.credito : l.debito;
      if (Math.abs(val - montoBanco) > 0.05) return false;
      const lTime = new Date(l.fecha).getTime();
      const diffDays = Math.abs(bTime - lTime) / (1000 * 60 * 60 * 24);
      return isNaN(diffDays) || diffDays <= 2;
    });
    if (hasExactSingleCandidate) continue;

    // 1. Probar primero con comprobantes de la MISMA FECHA EXACTA
    const sameDateCandidates = cleanLibros
      .map((l, idx) => ({ ...l, originalIdx: idx }))
      .filter((l) => {
        if (matchedLibroIndices.has(l.originalIdx)) return false;
        const val = isRetiro ? l.credito : l.debito;
        if (val <= 0) return false;
        return l.fecha === bItem.fecha;
      });

    if (sameDateCandidates.length >= 2) {
      const sumSameDate = sameDateCandidates.reduce((s, c) => s + (isRetiro ? c.credito : c.debito), 0);
      if (Math.abs(sumSameDate - montoBanco) <= 0.05) {
        matchedExtractoIds.add(bItem.id);
        sameDateCandidates.forEach((c) => matchedLibroIndices.add(c.originalIdx));
        const vouchersStr = sameDateCandidates.map((c) => c.comprobante).filter(Boolean).slice(0, 4).join(", ");
        rows.push({
          id: `match_lote_date_${bItem.id}`,
          estado: "conciliado",
          fecha: bItem.fecha,
          descripcion: `${bItem.descripcion} ↔ Lote ACH ${sameDateCandidates.length} comprobantes (${vouchersStr}${sameDateCandidates.length > 4 ? "..." : ""})`,
          referencia: bItem.referencia || "Lote ACH",
          tipo: isRetiro ? "retiro" : "consignacion",
          montoBanco,
          montoLibros: sumSameDate,
          diferencia: 0,
          esGmf: false,
          esComision: false,
          esRendimiento: false,
          itemBanco: bItem,
          itemsLibrosLote: sameDateCandidates,
          nota: `Conciliado en Lote ACH de la misma fecha (1 movimiento en extracto = ${sameDateCandidates.length} registros en libros).`,
        });
        continue;
      }

      // Probar subconjunto en misma fecha con poda temprana (pruning)
      let foundSameDateSubset: number[] | null = null;
      const maxSubSize = Math.min(sameDateCandidates.length, 10);
      for (let size = 2; size <= maxSubSize; size++) {
        function findSameDateSub(
          start: number,
          remaining: number,
          currentSum: number,
          currentIndices: number[]
        ): number[] | null {
          if (currentSum > montoBanco + 0.05) return null; // Poda: no seguir si ya supera el monto
          if (remaining === 0) {
            if (Math.abs(currentSum - montoBanco) <= 0.05) return currentIndices;
            return null;
          }
          for (let i = start; i <= sameDateCandidates.length - remaining; i++) {
            const val = isRetiro ? sameDateCandidates[i].credito : sameDateCandidates[i].debito;
            const res = findSameDateSub(i + 1, remaining - 1, currentSum + val, [
              ...currentIndices,
              sameDateCandidates[i].originalIdx,
            ]);
            if (res) return res;
          }
          return null;
        }
        foundSameDateSubset = findSameDateSub(0, size, 0, []);
        if (foundSameDateSubset) break;
      }

      if (foundSameDateSubset) {
        matchedExtractoIds.add(bItem.id);
        foundSameDateSubset.forEach((idx) => matchedLibroIndices.add(idx));
        const matchedCandidates = cleanLibros.filter((_, idx) => foundSameDateSubset!.includes(idx));
        const vouchersStr = matchedCandidates.map((c) => c.comprobante).filter(Boolean).slice(0, 4).join(", ");
        rows.push({
          id: `match_subset_date_${bItem.id}`,
          estado: "conciliado",
          fecha: bItem.fecha,
          descripcion: `${bItem.descripcion} ↔ Lote ACH ${foundSameDateSubset.length} comprobantes (${vouchersStr}${foundSameDateSubset.length > 4 ? "..." : ""})`,
          referencia: bItem.referencia || "Lote ACH",
          tipo: isRetiro ? "retiro" : "consignacion",
          montoBanco,
          montoLibros: montoBanco,
          diferencia: 0,
          esGmf: false,
          esComision: false,
          esRendimiento: false,
          itemBanco: bItem,
          itemsLibrosLote: matchedCandidates,
          nota: `Conciliado en Lote ACH / Pago agrupado (1 débito en extracto = ${foundSameDateSubset.length} comprobantes en libros).`,
        });
        continue;
      }
    }

    // 2. Si no cuadró en la misma fecha, buscar candidatos dentro de una ventana de ±4 días
    const candidates = cleanLibros
      .map((l, idx) => ({ ...l, originalIdx: idx }))
      .filter((l) => {
        if (matchedLibroIndices.has(l.originalIdx)) return false;
        const val = isRetiro ? l.credito : l.debito;
        if (val <= 0) return false;
        const lTime = new Date(l.fecha).getTime();
        const diffDays = Math.abs(bTime - lTime) / (1000 * 60 * 60 * 24);
        return isNaN(diffDays) || diffDays <= 4;
      });

    if (candidates.length >= 2) {
      const sumAll = candidates.reduce((s, c) => s + (isRetiro ? c.credito : c.debito), 0);
      if (Math.abs(sumAll - montoBanco) <= 0.05) {
        matchedExtractoIds.add(bItem.id);
        candidates.forEach((c) => matchedLibroIndices.add(c.originalIdx));
        const vouchersStr = candidates.map((c) => c.comprobante).filter(Boolean).slice(0, 4).join(", ");
        rows.push({
          id: `match_lote_${bItem.id}`,
          estado: "conciliado",
          fecha: bItem.fecha,
          descripcion: `${bItem.descripcion} ↔ Lote de ${candidates.length} comprobantes (${vouchersStr}${candidates.length > 4 ? "..." : ""})`,
          referencia: bItem.referencia || "Lote ACH",
          tipo: isRetiro ? "retiro" : "consignacion",
          montoBanco,
          montoLibros: sumAll,
          diferencia: 0,
          esGmf: false,
          esComision: false,
          esRendimiento: false,
          itemBanco: bItem,
          itemsLibrosLote: candidates,
          nota: `Conciliado en Lote ACH / Pago agrupado (1 movimiento en extracto = ${candidates.length} registros en libros).`,
        });
        continue;
      }

      let foundSubset: number[] | null = null;
      for (let size = 2; size <= Math.min(candidates.length, 12); size++) {
        function findSubset(
          start: number,
          remainingCount: number,
          currentSum: number,
          currentIndices: number[]
        ): number[] | null {
          if (currentSum > montoBanco + 0.05) return null;
          if (remainingCount === 0) {
            if (Math.abs(currentSum - montoBanco) <= 0.05) return currentIndices;
            return null;
          }
          for (let i = start; i <= candidates.length - remainingCount; i++) {
            const val = isRetiro ? candidates[i].credito : candidates[i].debito;
            const res = findSubset(i + 1, remainingCount - 1, currentSum + val, [
              ...currentIndices,
              candidates[i].originalIdx,
            ]);
            if (res) return res;
          }
          return null;
        }

        foundSubset = findSubset(0, size, 0, []);
        if (foundSubset) break;
      }

      if (foundSubset) {
        matchedExtractoIds.add(bItem.id);
        foundSubset.forEach((idx) => matchedLibroIndices.add(idx));
        const matchedCandidates = cleanLibros.filter((_, idx) => foundSubset!.includes(idx));
        const vouchersStr = matchedCandidates.map((c) => c.comprobante).filter(Boolean).slice(0, 4).join(", ");
        rows.push({
          id: `match_subset_${bItem.id}`,
          estado: "conciliado",
          fecha: bItem.fecha,
          descripcion: `${bItem.descripcion} ↔ Lote de ${foundSubset.length} comprobantes (${vouchersStr}${foundSubset.length > 4 ? "..." : ""})`,
          referencia: bItem.referencia || "Lote ACH",
          tipo: isRetiro ? "retiro" : "consignacion",
          montoBanco,
          montoLibros: montoBanco,
          diferencia: 0,
          esGmf: false,
          esComision: false,
          esRendimiento: false,
          itemBanco: bItem,
          itemsLibrosLote: matchedCandidates,
          nota: `Conciliado en Lote ACH / Pago agrupado (1 débito en extracto = ${foundSubset.length} comprobantes en libros).`,
        });
      }
    }
  }

  // FASE 3: Impuestos y Deducciones Consolidadas del Mes (GMF 4x1000 y Retención en la fuente)
  // Muy frecuente: el banco descuenta diario o por operación, mientras que el ERP causa 1 comprobante al fin de mes
  // A. GMF Consolidado
  const unassignedGmfItems = extracto.filter(
    (it) => !matchedExtractoIds.has(it.id) && classifyMovementConcept(it.descripcion).esGmf
  );
  if (unassignedGmfItems.length > 0) {
    const sumGmf = unassignedGmfItems.reduce((s, it) => s + it.debito, 0);
    for (let i = 0; i < cleanLibros.length; i++) {
      if (matchedLibroIndices.has(i)) continue;
      const l = cleanLibros[i];
      if (Math.abs(l.credito - sumGmf) <= 0.05) {
        unassignedGmfItems.forEach((it) => matchedExtractoIds.add(it.id));
        matchedLibroIndices.add(i);
        rows.push({
          id: "match_gmf_consolidado",
          estado: "conciliado",
          fecha: l.fecha,
          descripcion: `GRAVAMEN MOVIMIENTOS FINANCIEROS (GMF 4x1000) Consolidado (${unassignedGmfItems.length} cargos diarios) ↔ ${l.descripcion || l.nombre}`,
          referencia: l.comprobante || "GMF Consolidado",
          tipo: "retiro",
          montoBanco: sumGmf,
          montoLibros: l.credito,
          diferencia: 0,
          esGmf: true,
          esComision: false,
          esRendimiento: false,
          itemLibros: l,
          nota: `GMF mensual conciliado (Suma exacta de ${unassignedGmfItems.length} deducciones diarias en extracto = 1 comprobante mensual en libros).`,
        });
        break;
      }
    }
  }

  // B. Retención en la fuente Consolidada
  const unassignedRetItems = extracto.filter(
    (it) => !matchedExtractoIds.has(it.id) && /retenci[oó]n/i.test(it.descripcion)
  );
  if (unassignedRetItems.length > 0) {
    const sumRet = unassignedRetItems.reduce((s, it) => s + it.debito, 0);
    for (let i = 0; i < cleanLibros.length; i++) {
      if (matchedLibroIndices.has(i)) continue;
      const l = cleanLibros[i];
      if (Math.abs(l.credito - sumRet) <= 0.05) {
        unassignedRetItems.forEach((it) => matchedExtractoIds.add(it.id));
        matchedLibroIndices.add(i);
        rows.push({
          id: "match_retefuente_consolidada",
          estado: "conciliado",
          fecha: l.fecha,
          descripcion: `Retención en la Fuente Consolidada (${unassignedRetItems.length} retenciones) ↔ ${l.descripcion || l.nombre}`,
          referencia: l.comprobante || "Retefuente Consolidada",
          tipo: "retiro",
          montoBanco: sumRet,
          montoLibros: l.credito,
          diferencia: 0,
          esGmf: false,
          esComision: false,
          esRendimiento: false,
          itemLibros: l,
          nota: `Retención en la fuente mensual conciliada (${unassignedRetItems.length} cargos diarios = 1 comprobante en libros).`,
        });
        break;
      }
    }
  }

  // FASE 4: Cruce por Valor Exacto y Fecha cercana (±7 días) para movimientos ordinarios restantes
  for (const bItem of extracto) {
    if (matchedExtractoIds.has(bItem.id)) continue;
    // Si es un rendimiento del periodo actual que no fue causado en libros en este mes, no cruzar con terceros
    if (/rendimiento|inter[eé]s.*abono/i.test(bItem.descripcion)) continue;

    const isRetiro = bItem.debito > 0;
    const montoBanco = isRetiro ? bItem.debito : bItem.credito;

    for (let i = 0; i < cleanLibros.length; i++) {
      if (matchedLibroIndices.has(i)) continue;
      const lItem = cleanLibros[i];
      const montoLibro = isRetiro ? lItem.credito : lItem.debito;

      if (Math.abs(montoBanco - montoLibro) <= 0.05) {
        const bTime = new Date(bItem.fecha).getTime();
        const lTime = new Date(lItem.fecha).getTime();
        const diffDays = Math.abs(bTime - lTime) / (1000 * 60 * 60 * 24);

        if (isNaN(diffDays) || diffDays <= 7) {
          matchedExtractoIds.add(bItem.id);
          matchedLibroIndices.add(i);
          const { esGmf, esComision, esRendimiento } = classifyMovementConcept(bItem.descripcion);
          rows.push({
            id: `match_val_${bItem.id}_${i}`,
            estado: "conciliado",
            fecha: bItem.fecha,
            descripcion: `${bItem.descripcion} ↔ ${lItem.descripcion || lItem.nombre}`,
            referencia: bItem.referencia || lItem.referencia || lItem.comprobante || "Valor exacto",
            tipo: isRetiro ? "retiro" : "consignacion",
            montoBanco,
            montoLibros: montoLibro,
            diferencia: 0,
            esGmf,
            esComision,
            esRendimiento,
            itemBanco: bItem,
            itemLibros: lItem,
            nota: `Conciliado por valor idéntico dentro de la ventana de compensación.`,
          });
          break;
        }
      }
    }
  }

  // FASE 5: Partidas que están en el Extracto del Banco pero NO en Libros
  for (const bItem of extracto) {
    if (matchedExtractoIds.has(bItem.id)) continue;
    const isRetiro = bItem.debito > 0;
    const montoBanco = isRetiro ? bItem.debito : bItem.credito;
    const { esGmf, esComision, esRendimiento } = classifyMovementConcept(bItem.descripcion);

    let nota = "Movimiento en extracto pendiente de causar en contabilidad.";
    if (esGmf) nota = "Gravamen a los Movimientos Financieros (4x1000) descontado por el banco. Pendiente comprobante de gasto (PUC 511595).";
    if (esComision) nota = "Comisión o costo financiero bancario con IVA. Requiere nota contable de gastos bancarios (PUC 530515).";
    if (esRendimiento) nota = "Rendimientos financieros abonados por la entidad en el extracto. Pendientes de causar en libros (se registran el 1 de septiembre).";

    rows.push({
      id: `extracto_pend_${bItem.id}`,
      estado: isRetiro ? "nota_debito_banco" : "nota_credito_banco",
      fecha: bItem.fecha,
      descripcion: bItem.descripcion,
      referencia: bItem.referencia || "Extracto Bancario",
      tipo: isRetiro ? "retiro" : "consignacion",
      montoBanco,
      montoLibros: 0,
      diferencia: montoBanco,
      esGmf,
      esComision,
      esRendimiento,
      itemBanco: bItem,
      nota,
    });
  }

  // FASE 6: Partidas que están en Libros pero NO en el Extracto Bancario
  for (let i = 0; i < cleanLibros.length; i++) {
    if (matchedLibroIndices.has(i)) continue;
    const lItem = cleanLibros[i];
    const isRetiro = lItem.credito > 0;
    const montoLibro = isRetiro ? lItem.credito : lItem.debito;

    const nota = isRetiro
      ? "Giro, cheque o transferencia contabilizada en libros aún no debitada por el banco (Partida en Tránsito)."
      : "Consignación o ingreso contabilizado en libros en trámite de acreditación bancaria (Consignación en Tránsito).";

    const { esGmf, esComision, esRendimiento } = classifyMovementConcept(
      lItem.descripcion || lItem.nombre || ""
    );

    rows.push({
      id: `libro_pend_${i}`,
      estado: "partida_en_transito_libros",
      fecha: lItem.fecha,
      descripcion: lItem.descripcion || lItem.nombre || `Comprobante ${lItem.comprobante}`,
      referencia: lItem.referencia || lItem.comprobante || "Contabilidad",
      tipo: isRetiro ? "retiro" : "consignacion",
      montoBanco: 0,
      montoLibros: montoLibro,
      diferencia: montoLibro,
      esGmf,
      esComision,
      esRendimiento,
      itemLibros: lItem,
      nota,
    });
  }

  // Cálculo del resumen y conciliación aritmética
  let consignacionesEnTransito = 0;
  let chequesEnTransito = 0;
  let notasDebitoNoRegistradas = 0;
  let notasCreditoNoRegistradas = 0;
  let notasDebitoGmf = 0;
  let notasDebitoComisiones = 0;
  let notasDebitoOperativas = 0;
  let notasCreditoRendimientos = 0;
  let notasCreditoOperativas = 0;

  for (const r of rows) {
    if (r.estado === "partida_en_transito_libros") {
      if (r.tipo === "consignacion") consignacionesEnTransito += r.montoLibros;
      if (r.tipo === "retiro") chequesEnTransito += r.montoLibros;
    } else if (r.estado === "nota_debito_banco") {
      notasDebitoNoRegistradas += r.montoBanco;
      if (r.esGmf) {
        notasDebitoGmf += r.montoBanco;
      } else if (r.esComision) {
        notasDebitoComisiones += r.montoBanco;
      } else {
        notasDebitoOperativas += r.montoBanco;
      }
    } else if (r.estado === "nota_credito_banco") {
      notasCreditoNoRegistradas += r.montoBanco;
      if (r.esRendimiento) {
        notasCreditoRendimientos += r.montoBanco;
      } else {
        notasCreditoOperativas += r.montoBanco;
      }
    }
  }

  const totalDebitosExtracto = extracto.reduce((a, b) => a + b.debito, 0);
  const totalCreditosExtracto = extracto.reduce((a, b) => a + b.credito, 0);
  const saldoFinalExtracto = saldoInicialExtracto + totalCreditosExtracto - totalDebitosExtracto;

  // En libros: Si hubo nota contable de rendimientos del mes anterior (FASE 0) que ya estaba
  // incorporada en el saldo inicial del extracto bancario, no se duplica en los débitos operativos del periodo actual.
  const totalDebitosLibros = cleanLibros
    .filter((_, idx) => idx !== prevRendLineIndex)
    .reduce((a, b) => a + b.debito, 0);
  const totalCreditosLibros = cleanLibros.reduce((a, b) => a + b.credito, 0);
  const saldoFinalLibros = cleanLibros.length > 0
    ? (saldoInicialLibros || saldoInicialExtracto) + totalDebitosLibros - totalCreditosLibros
    : 0;

  // Conciliación de Libros a Extracto Bancario (Norma Técnica DIAN / NIIF):
  // Saldo según Libros Contables
  // (+) Notas Crédito Bancarias no causadas en libros (Rendimientos del periodo pendientes de registro)
  // (-) Notas Débito Bancarias no registradas en libros (GMF, comisiones, cheques devueltos)
  // (+) Cheques / Giros en tránsito
  // (-) Consignaciones en tránsito
  // (=) Saldo Bancario Conciliado (debe coincidir con el Saldo según Extracto Bancario)
  const saldoConciliado =
    saldoFinalLibros +
    notasCreditoNoRegistradas -
    notasDebitoNoRegistradas +
    chequesEnTransito -
    consignacionesEnTransito;

  const diferenciaCuadre = Math.abs(saldoConciliado - saldoFinalExtracto);
  const cuadrado = cleanLibros.length > 0 && extracto.length > 0 && diferenciaCuadre < 1;
  const diferenciaExtractoLibros = Math.abs(saldoFinalExtracto - saldoFinalLibros);
  const soloRendimientos =
    cuadrado &&
    notasCreditoRendimientos > 0 &&
    notasDebitoNoRegistradas === 0 &&
    chequesEnTransito === 0 &&
    consignacionesEnTransito === 0;

  const summary: BankConciliacionSummary = {
    saldoExtracto: saldoFinalExtracto,
    saldoLibros: saldoFinalLibros,
    consignacionesEnTransito,
    chequesEnTransito,
    notasDebitoNoRegistradas,
    notasCreditoNoRegistradas,
    notasDebitoGmf,
    notasDebitoComisiones,
    notasDebitoOperativas,
    notasCreditoRendimientos,
    notasCreditoOperativas,
    saldoConciliado,
    diferenciaCuadre,
    diferenciaExtractoLibros,
    cuadrado,
    soloRendimientos,
    totalItemsBanco: extracto.length,
    totalItemsLibros: libros.length,
    totalConciliados: rows.filter((r) => r.estado === "conciliado").length,
    totalMovimientosBancoConciliados: matchedExtractoIds.size,
  };

  return {
    rows,
    summary,
    cuentasBancosDetectadas,
    cuentasDetalle,
  };
}

export interface BankConceptBreakdown {
  total: number;
  registrado: number;
  pendiente: number;
  count: number;
  items: BankConciliacionRow[];
}

export interface BankExecutiveBreakdown {
  gmf: BankConceptBreakdown;
  comisiones: BankConceptBreakdown;
  rendimientos: BankConceptBreakdown;
  lotesAch: {
    total: number;
    countLotes: number;
    countComprobantes: number;
    items: BankConciliacionRow[];
  };
}

export function getBankExecutiveBreakdown(rows: BankConciliacionRow[]): BankExecutiveBreakdown {
  const gmfRows = rows.filter((r) => r.esGmf);
  const comisionRows = rows.filter((r) => r.esComision);
  const rendimientoRows = rows.filter((r) => r.esRendimiento);
  const loteRows = rows.filter((r) => r.itemsLibrosLote && r.itemsLibrosLote.length > 0);

  const calcBreakdown = (items: BankConciliacionRow[]): BankConceptBreakdown => {
    let registrado = 0;
    let pendiente = 0;
    let total = 0;
    for (const r of items) {
      const val = r.montoBanco > 0 ? r.montoBanco : r.montoLibros;
      total += val;
      if (r.estado === "conciliado") {
        registrado += val;
      } else {
        pendiente += val;
      }
    }
    return {
      total,
      registrado,
      pendiente,
      count: items.length,
      items,
    };
  };

  let lotesTotal = 0;
  let lotesCompCount = 0;
  for (const r of loteRows) {
    lotesTotal += r.montoBanco;
    lotesCompCount += r.itemsLibrosLote?.length || 0;
  }

  return {
    gmf: calcBreakdown(gmfRows),
    comisiones: calcBreakdown(comisionRows),
    rendimientos: calcBreakdown(rendimientoRows),
    lotesAch: {
      total: lotesTotal,
      countLotes: loteRows.length,
      countComprobantes: lotesCompCount,
      items: loteRows,
    },
  };
}
