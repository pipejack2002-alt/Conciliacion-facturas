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
  saldoConciliado: number;
  diferenciaCuadre: number;
  cuadrado: boolean;
  totalItemsBanco: number;
  totalItemsLibros: number;
  totalConciliados: number;
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

    // Filtro universal: Cuentas de activo de tesorería (Clase 11 PUC), inversiones/fondos de liquidez (1250, 1205),
    // Efectivo y equivalentes de efectivo bajo NIIF / IFRS internacional (Clase 10),
    // o cuentas cuyo nombre mencione banco, caja, bcsc, colmena, credicorp, correval, banistmo, fonval, fiducia, ahorro, corriente, tesoreria
    const isTreasury =
      c.startsWith("11") ||
      c.startsWith("1250") ||
      c.startsWith("1205") ||
      c.startsWith("10") ||
      /banco|bcsc|colmena|caja|credicorp|correval|banistmo|fonval|fiducia|fic\b|cartera colectiva|ahorro|corriente|tesor|moneda|rotativ/i.test(
        nom
      ) ||
      /banco|bcsc|caja|bank/i.test(c);

    if (!isTreasury) continue;

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
    return mov.filter((m) => {
      const c = m.cuenta.trim();
      return c === cleanFiltro || c.startsWith(cleanFiltro);
    });
  }

  const filtered = mov.filter((m) => {
    const c = m.cuenta.trim();
    const nom = (m.cuentaNombre || "").trim();
    return (
      c.startsWith("11") ||
      c.startsWith("1250") ||
      c.startsWith("1205") ||
      c.startsWith("10") ||
      /banco|bcsc|colmena|caja|credicorp|correval|banistmo|fonval|fiducia|fic\b|cartera colectiva|ahorro|corriente|tesor|moneda|rotativ/i.test(
        nom
      ) ||
      /banco|bcsc|caja|bank/i.test(c)
    );
  });

  return filtered.length > 0 ? filtered : mov;
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

  // Detección de cuentas bancarias
  const cuentasSet = new Set<string>();
  for (const l of cleanLibros) {
    if (l.cuenta) cuentasSet.add(l.cuenta);
  }
  const cuentasBancosDetectadas = Array.from(cuentasSet);
  const cuentasDetalle = getAvailableBankAccounts(cleanLibros);

  // FASE 0: Causación en libros de Rendimientos del periodo anterior que igualan el Saldo Inicial
  for (let i = 0; i < cleanLibros.length; i++) {
    const l = cleanLibros[i];
    if (l.debito > 0 && /rendimientos?\s+(julio|mes\s+anterior|inicial)/i.test(l.descripcion || l.nombre)) {
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
            const desc = (bItem.descripcion || "").toLowerCase();
            const esGmf = /gmf|4x1000|gravamen|impuesto.*gobierno/i.test(desc);
            const esComision = /comisi[oó]n|cuota.*manejo|chequera|tarifa|costo.*transferencia|cobro/i.test(desc);
            const esRendimiento = /rendimiento|inter[eé]s.*abono|intereses.*liquidados/i.test(desc);
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
    (it) => !matchedExtractoIds.has(it.id) && /gmf|4x1000|gravamen|cobro\s+gm/i.test(it.descripcion)
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
          const desc = (bItem.descripcion || "").toLowerCase();
          const esGmf = /gmf|4x1000|gravamen|impuesto.*gobierno/i.test(desc);
          const esComision = /comisi[oó]n|cuota.*manejo|chequera|tarifa|costo.*transferencia|cobro/i.test(desc);
          const esRendimiento = /rendimiento|inter[eé]s.*abono|intereses.*liquidados/i.test(desc);
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
    const desc = bItem.descripcion.toLowerCase();

    const esGmf = /gmf|4x1000|gravamen|impuesto.*gobierno/i.test(desc);
    const esComision = /comisi[oó]n|cuota.*manejo|chequera|tarifa|costo.*transferencia|cobro/i.test(desc);
    const esRendimiento = /rendimiento|inter[eé]s.*abono|intereses.*liquidados/i.test(desc);

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
      esGmf: false,
      esComision: false,
      esRendimiento: false,
      itemLibros: lItem,
      nota,
    });
  }

  // Cálculo del resumen y conciliación aritmética
  let consignacionesEnTransito = 0;
  let chequesEnTransito = 0;
  let notasDebitoNoRegistradas = 0;
  let notasCreditoNoRegistradas = 0;

  for (const r of rows) {
    if (r.estado === "partida_en_transito_libros") {
      if (r.tipo === "consignacion") consignacionesEnTransito += r.montoLibros;
      if (r.tipo === "retiro") chequesEnTransito += r.montoLibros;
    } else if (r.estado === "nota_debito_banco") {
      notasDebitoNoRegistradas += r.montoBanco;
    } else if (r.estado === "nota_credito_banco") {
      notasCreditoNoRegistradas += r.montoBanco;
    }
  }

  const totalDebitosExtracto = extracto.reduce((a, b) => a + b.debito, 0);
  const totalCreditosExtracto = extracto.reduce((a, b) => a + b.credito, 0);
  const saldoFinalExtracto = saldoInicialExtracto + totalCreditosExtracto - totalDebitosExtracto;

  const totalDebitosLibros = cleanLibros.reduce((a, b) => a + b.debito, 0);
  const totalCreditosLibros = cleanLibros.reduce((a, b) => a + b.credito, 0);
  const saldoFinalLibros = saldoInicialLibros + totalDebitosLibros - totalCreditosLibros;

  // Fórmula estándar de conciliación bancaria:
  // Saldo según Extracto
  // (+) Consignaciones en tránsito
  // (-) Cheques y transferencias en tránsito
  // (-) Notas débito bancarias no registradas
  // (+) Notas crédito bancarias no registradas
  // = Saldo Conciliado
  const saldoConciliado =
    saldoFinalExtracto +
    consignacionesEnTransito -
    chequesEnTransito -
    notasDebitoNoRegistradas +
    notasCreditoNoRegistradas;

  const diferenciaCuadre = Math.abs(saldoConciliado - saldoFinalLibros);
  const cuadrado = diferenciaCuadre < 1;

  const summary: BankConciliacionSummary = {
    saldoExtracto: saldoFinalExtracto,
    saldoLibros: saldoFinalLibros,
    consignacionesEnTransito,
    chequesEnTransito,
    notasDebitoNoRegistradas,
    notasCreditoNoRegistradas,
    saldoConciliado,
    diferenciaCuadre,
    cuadrado,
    totalItemsBanco: extracto.length,
    totalItemsLibros: libros.length,
    totalConciliados: rows.filter((r) => r.estado === "conciliado").length,
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
