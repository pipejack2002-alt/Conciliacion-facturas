import { resolveCargo } from "@/lib/cargo-store";
import { useCargoStore } from "@/lib/cargo-store";
import {
  flashcardsForCargo,
  modulesForCargo,
  questionsForCargo,
} from "@/lib/cargo-content";
import { DEFAULT_CARGO_ID, catalogCargo } from "@/data/cargos";

export function useCargo() {
  const selectedId = useCargoStore((s) => s.selectedId);
  const customCargos = useCargoStore((s) => s.customCargos);
  const cargo = resolveCargo(selectedId || DEFAULT_CARGO_ID, customCargos);
  return {
    cargo,
    ficha: cargo.ficha,
    modules: modulesForCargo(cargo),
    questions: questionsForCargo(cargo),
    flashcards: flashcardsForCargo(cargo),
    isCustom: Boolean(cargo.custom),
    isCatalog: Boolean(catalogCargo(cargo.id)),
  };
}
