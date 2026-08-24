import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CATALOG, DEFAULT_CARGO_ID, catalogCargo } from "@/data/cargos";
import type { CargoProfile } from "@/data/types";

interface CargoState {
  selectedId: string;
  customCargos: CargoProfile[];
  select: (id: string) => void;
  addCustom: (cargo: CargoProfile) => void;
  removeCustom: (id: string) => void;
}

export const useCargoStore = create<CargoState>()(
  persist(
    (set, get) => ({
      selectedId: DEFAULT_CARGO_ID,
      customCargos: [],
      select: (id) => set({ selectedId: id }),
      addCustom: (cargo) =>
        set({
          customCargos: [
            cargo,
            ...get().customCargos.filter((c) => c.id !== cargo.id),
          ].slice(0, 8),
          selectedId: cargo.id,
        }),
      removeCustom: (id) => {
        const next = get().customCargos.filter((c) => c.id !== id);
        const selectedId =
          get().selectedId === id ? DEFAULT_CARGO_ID : get().selectedId;
        set({ customCargos: next, selectedId });
      },
    }),
    { name: "cuaderno-2676-cargo", skipHydration: true },
  ),
);

export function resolveCargo(
  selectedId: string,
  customCargos: CargoProfile[],
): CargoProfile {
  return (
    catalogCargo(selectedId) ??
    customCargos.find((c) => c.id === selectedId) ??
    CATALOG[0]
  );
}

export function allCargos(customCargos: CargoProfile[]): CargoProfile[] {
  return [...CATALOG, ...customCargos];
}
