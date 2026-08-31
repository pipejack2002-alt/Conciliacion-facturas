/**
 * Módulo de Autenticación SSO y Guardián de Seguridad con TributoApp
 * Protege el Conciliador Fiscal DIAN contra accesos no autorizados.
 */

export const TRIBUTO_SESSION_KEY = "tributo_conciliador_auth_session";

export const TRIBUTO_API_ENDPOINTS = [
  "https://www.tributoapp.me/api/conciliador/verify",
  "https://tributoapp.me/api/conciliador/verify",
];

export const TRIBUTO_LOGIN_URL = "https://www.tributoapp.me/login?return_to=recursos";
export const TRIBUTO_PRICING_URL = "https://www.tributoapp.me/precios";

export interface TributoUser {
  id?: string | number;
  email?: string;
  name?: string;
  plan?: string;
  company?: string;
  nit?: string;
  [key: string]: unknown;
}

export interface TributoAuthSession {
  valid: boolean;
  user: TributoUser | null;
  authenticatedAt: string;
  token?: string;
}

export interface VerifyTokenResult {
  success: boolean;
  session?: TributoAuthSession;
  error?: string;
}

/**
 * Obtiene la sesión activa almacenada en sessionStorage si existe y es válida.
 */
export function getStoredSession(): TributoAuthSession | null {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(TRIBUTO_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as TributoAuthSession;
    if (parsed && parsed.valid === true) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Guarda la sesión validada en sessionStorage.
 */
export function saveSession(user: TributoUser | null, token?: string): TributoAuthSession {
  const session: TributoAuthSession = {
    valid: true,
    user: user || null,
    authenticatedAt: new Date().toISOString(),
    token: token || undefined,
  };

  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.setItem(TRIBUTO_SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn("[TributoAuth] Error al guardar sesión en sessionStorage:", e);
    }
  }

  return session;
}

/**
 * Elimina la sesión actual de sessionStorage.
 */
export function clearStoredSession(): void {
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(TRIBUTO_SESSION_KEY);
    } catch (e) {
      console.warn("[TributoAuth] Error al limpiar sesión de sessionStorage:", e);
    }
  }
}

/**
 * Extrae el parámetro auth_token o token de los search params de la URL actual.
 */
export function extractTokenFromSearch(searchString?: string): string | null {
  if (typeof window === "undefined" && !searchString) {
    return null;
  }

  const search = searchString ?? (typeof window !== "undefined" ? window.location.search : "");
  if (!search) return null;

  try {
    const params = new URLSearchParams(search);
    const token = params.get("auth_token") || params.get("token");
    return token ? token.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Limpia la barra de direcciones eliminando tokens sensibles sin recargar la página.
 */
export function cleanUrlToken(): void {
  if (typeof window === "undefined" || !window.history?.replaceState) {
    return;
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("auth_token");
    url.searchParams.delete("token");

    const cleanPath = url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") + url.hash;
    window.history.replaceState({}, document.title, cleanPath || window.location.pathname);
  } catch {
    // Fallback simple si la API de URL falla
    const fallbackPath = window.location.pathname + (window.location.hash || "");
    window.history.replaceState({}, document.title, fallbackPath);
  }
}

/**
 * Valida un token con la API oficial de TributoApp (con fallback de endpoints).
 */
export async function verifyTributoToken(
  token: string,
  fetchFn: typeof fetch = fetch
): Promise<VerifyTokenResult> {
  const cleanToken = token.trim();
  if (!cleanToken) {
    return {
      success: false,
      error: "Token no proporcionado o vacío.",
    };
  }

  let lastError = "No fue posible conectar con el servidor de autenticación de TributoApp.";

  for (const endpoint of TRIBUTO_API_ENDPOINTS) {
    try {
      const url = `${endpoint}?token=${encodeURIComponent(cleanToken)}`;
      
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;

      const res = await fetchFn(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller?.signal,
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          const body = (await res.json().catch(() => null)) as { message?: string } | null;
          return {
            success: false,
            error: body?.message || "Token inválido, expirado o sin suscripción activa.",
          };
        }
        lastError = `Servidor respondió con código HTTP ${res.status}`;
        continue; // Intentar endpoint fallback
      }

      const data = (await res.json()) as {
        valid?: boolean;
        user?: TributoUser;
        message?: string;
      };

      if (data && data.valid === true) {
        const session: TributoAuthSession = {
          valid: true,
          user: data.user || null,
          authenticatedAt: new Date().toISOString(),
          token: cleanToken,
        };
        return {
          success: true,
          session,
        };
      } else {
        return {
          success: false,
          error: data?.message || "El token proporcionado no es válido o ha expirado.",
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      lastError = `Error de conexión con ${endpoint}: ${errorMsg}`;
    }
  }

  return {
    success: false,
    error: lastError,
  };
}
