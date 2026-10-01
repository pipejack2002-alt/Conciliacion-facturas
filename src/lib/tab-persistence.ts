/**
 * Persistencia de Pestañas Activas y Modos de Vista
 * 
 * Permite que al recargar la página (F5) o navegar entre módulos, el usuario
 * permanezca exactamente en la pestaña donde estaba (Dian, Dashboard BI, Bancos)
 * y en el submodo bancario correspondiente (Homologado vs Universal).
 */

export type ActiveModuleId = "dian" | "dashboard_bi" | "bancos";
export type ModoBancoId = "homologado" | "universal";

export const STORAGE_ACTIVE_MODULE_KEY = "conciliador_suite_active_module_v1";
export const STORAGE_MODO_BANCO_KEY = "conciliador_modo_banco_v1";

/**
 * Resuelve el módulo activo a partir del query string (URL) o del valor almacenado en localStorage.
 * Prioridad: 1. URL search params (?modulo=... o ?tab=...), 2. localStorage, 3. Valor por defecto "dian".
 */
export function resolveActiveModule(
  searchString?: string,
  storedValue?: string | null
): ActiveModuleId {
  if (searchString) {
    try {
      const search = searchString.startsWith("?") ? searchString.slice(1) : searchString;
      const params = new URLSearchParams(search);
      const modUrl = (params.get("modulo") || params.get("tab") || "").toLowerCase();
      if (modUrl === "bancos" || modUrl === "dashboard_bi" || modUrl === "dian") {
        return modUrl as ActiveModuleId;
      }
    } catch {
      // Silently ignore URL parsing errors
    }
  }

  if (storedValue === "bancos" || storedValue === "dashboard_bi" || storedValue === "dian") {
    return storedValue as ActiveModuleId;
  }

  return "dian";
}

/**
 * Obtiene el módulo activo inicial en el navegador.
 */
export function getInitialActiveModule(): ActiveModuleId {
  if (typeof window === "undefined") return "dian";
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_ACTIVE_MODULE_KEY) : null;
    return resolveActiveModule(window.location.search, stored);
  } catch {
    return "dian";
  }
}

/**
 * Resuelve el modo de vista bancario (Homologado vs Universal) a partir de URL o localStorage.
 */
export function resolveModoBanco(
  searchString?: string,
  storedValue?: string | null
): ModoBancoId {
  if (searchString) {
    try {
      const search = searchString.startsWith("?") ? searchString.slice(1) : searchString;
      const params = new URLSearchParams(search);
      const m = (params.get("modo_banco") || params.get("modo") || "").toLowerCase();
      if (m === "universal" || m === "homologado") {
        return m as ModoBancoId;
      }
    } catch {
      // Silently ignore
    }
  }

  if (storedValue === "universal" || storedValue === "homologado") {
    return storedValue as ModoBancoId;
  }

  return "homologado";
}

/**
 * Obtiene el modo de vista bancario inicial en el navegador.
 */
export function getInitialModoVista(): ModoBancoId {
  if (typeof window === "undefined") return "homologado";
  try {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_MODO_BANCO_KEY) : null;
    return resolveModoBanco(window.location.search, stored);
  } catch {
    return "homologado";
  }
}
