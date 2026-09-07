import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { useConciliacion } from "./store.ts";
import type { ConciliacionRow } from "./types.ts";

function makeRow(partial: Partial<ConciliacionRow>): ConciliacionRow {
  return {
    id: partial.id || Math.random().toString(),
    estado: partial.estado || "pendiente",
    grupo: partial.grupo || "Recibido",
    tipo: partial.tipo || "Factura electrónica",
    prefijo: partial.prefijo || "FE",
    folio: partial.folio || "1",
    numero: partial.numero || "FE-1",
    nitContraparte: partial.nitContraparte || "900123456",
    nombreContraparte: partial.nombreContraparte || "Proveedor Test",
    fecha: partial.fecha || "2026-08-01",
    totalDian: partial.totalDian ?? 100000,
    totalSiigo: partial.totalSiigo ?? 0,
    diferencia: partial.diferencia ?? 100000,
    iva: partial.iva ?? 19000,
    cufe: partial.cufe || "",
    prioridad: partial.prioridad || "audit",
    alerta: partial.alerta || "",
    hits: partial.hits || [],
    linked: partial.linked || [],
    comprobantes: partial.comprobantes || [],
    matchVia: partial.matchVia || "",
  };
}

describe("Ordenamiento y Filtrado por Columna en Tabla de Conciliación", () => {
  it("debe ordenar por fecha de menor a mayor (ascendente) y mayor a menor (descendente)", () => {
    const r1 = makeRow({ id: "1", fecha: "2026-07-05", numero: "F-1" });
    const r2 = makeRow({ id: "2", fecha: "2026-07-01", numero: "F-2" });
    const r3 = makeRow({ id: "3", fecha: "2026-08-10", numero: "F-3" });
    const rows = [r1, r2, r3];

    // Menor a mayor (ascendente)
    const ascSorted = [...rows].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
    assert.deepEqual(ascSorted.map((r) => r.fecha), ["2026-07-01", "2026-07-05", "2026-08-10"]);

    // Mayor a menor (descendente)
    const descSorted = [...rows].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "") * -1);
    assert.deepEqual(descSorted.map((r) => r.fecha), ["2026-08-10", "2026-07-05", "2026-07-01"]);
  });

  it("debe ordenar por documento de forma alfanumérica natural (FE-1, FE-2, FE-10)", () => {
    const r1 = makeRow({ numero: "FE-10" });
    const r2 = makeRow({ numero: "FE-2" });
    const r3 = makeRow({ numero: "FE-1" });
    const rows = [r1, r2, r3];

    const sorted = [...rows].sort((a, b) =>
      a.numero.localeCompare(b.numero, undefined, { numeric: true, sensitivity: "base" }),
    );
    assert.deepEqual(sorted.map((r) => r.numero), ["FE-1", "FE-2", "FE-10"]);
  });

  it("debe ordenar proveedores alfabéticamente respetando acentos y mayúsculas en español", () => {
    const r1 = makeRow({ nombreContraparte: "Zapatos y Cueros SAS" });
    const r2 = makeRow({ nombreContraparte: "Álvarez Hermanos" });
    const r3 = makeRow({ nombreContraparte: "Bancolombia SA" });
    const rows = [r1, r2, r3];

    const sorted = [...rows].sort((a, b) =>
      a.nombreContraparte.localeCompare(b.nombreContraparte, "es", { sensitivity: "base" }),
    );
    assert.deepEqual(sorted.map((r) => r.nombreContraparte), [
      "Álvarez Hermanos",
      "Bancolombia SA",
      "Zapatos y Cueros SAS",
    ]);
  });

  it("debe ordenar por monto DIAN ascendente y descendente", () => {
    const r1 = makeRow({ totalDian: 500000 });
    const r2 = makeRow({ totalDian: 10000000 });
    const r3 = makeRow({ totalDian: 200000 });
    const rows = [r1, r2, r3];

    const desc = [...rows].sort((a, b) => b.totalDian - a.totalDian);
    assert.deepEqual(desc.map((r) => r.totalDian), [10000000, 500000, 200000]);

    const asc = [...rows].sort((a, b) => a.totalDian - b.totalDian);
    assert.deepEqual(asc.map((r) => r.totalDian), [200000, 500000, 10000000]);
  });

  it("debe alternar la dirección de ordenamiento con toggleSort en Zustand", () => {
    const store = useConciliacion.getState();
    store.reset();

    assert.equal(useConciliacion.getState().sort, "prioridad");
    assert.equal(useConciliacion.getState().sortDirection, "asc");

    // Cambiar a fecha -> por defecto asc (menor a mayor)
    useConciliacion.getState().toggleSort("fecha");
    assert.equal(useConciliacion.getState().sort, "fecha");
    assert.equal(useConciliacion.getState().sortDirection, "asc");

    // Toggle en la misma columna -> cambia a desc (mayor a menor)
    useConciliacion.getState().toggleSort("fecha");
    assert.equal(useConciliacion.getState().sort, "fecha");
    assert.equal(useConciliacion.getState().sortDirection, "desc");

    // Toggle nuevamente -> vuelve a asc
    useConciliacion.getState().toggleSort("fecha");
    assert.equal(useConciliacion.getState().sortDirection, "asc");
  });

  it("debe aplicar y limpiar filtros por columna en Zustand", () => {
    const store = useConciliacion.getState();
    store.reset();

    // Filtro de estado
    store.setColumnFilter("estado", ["pendiente", "diferencia"]);
    assert.deepEqual(useConciliacion.getState().columnFilters.estado, ["pendiente", "diferencia"]);

    // Filtro de proveedor
    store.setColumnFilter("proveedor", "Éxito");
    assert.equal(useConciliacion.getState().columnFilters.proveedor, "Éxito");

    // Limpiar filtro individual
    store.clearColumnFilter("estado");
    assert.equal(useConciliacion.getState().columnFilters.estado, undefined);
    assert.equal(useConciliacion.getState().columnFilters.proveedor, "Éxito");

    // Limpiar todos los filtros
    store.clearAllColumnFilters();
    assert.deepEqual(useConciliacion.getState().columnFilters, {});
  });
});
