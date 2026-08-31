import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  TRIBUTO_LOGIN_URL,
  TRIBUTO_PRICING_URL,
  type TributoAuthSession,
  getStoredSession,
  saveSession,
  clearStoredSession,
  extractTokenFromSearch,
  cleanUrlToken,
  verifyTributoToken,
} from "@/lib/tributo-auth";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  ExternalLink,
  Sparkles,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  Zap,
  ArrowRight,
  LogOut,
  UserCheck,
} from "lucide-react";

interface TributoAuthContextValue {
  session: TributoAuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  logout: () => void;
  verifyManualToken: (token: string) => Promise<boolean>;
}

const TributoAuthContext = createContext<TributoAuthContextValue | null>(null);

export function useTributoAuth(): TributoAuthContextValue {
  const ctx = useContext(TributoAuthContext);
  if (!ctx) {
    throw new Error("useTributoAuth must be used within a TributoAuthGuardian");
  }
  return ctx;
}

interface TributoAuthGuardianProps {
  children: ReactNode;
}

export function TributoAuthGuardian({ children }: TributoAuthGuardianProps) {
  const [session, setSession] = useState<TributoAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showManualInput, setShowManualInput] = useState<boolean>(false);
  const [manualToken, setManualToken] = useState<string>("");
  const [isVerifyingManual, setIsVerifyingManual] = useState<boolean>(false);
  const [manualError, setManualError] = useState<string | null>(null);

  // Verificación inicial de sesión al montar en el cliente
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      // 1. Revisar si ya hay sesión en sessionStorage
      const existingSession = getStoredSession();
      if (existingSession && existingSession.valid) {
        if (isMounted) {
          setSession(existingSession);
          setIsLoading(false);
        }
        return;
      }

      // 2. Revisar si viene token en la URL (?auth_token=... o ?token=...)
      const urlToken = extractTokenFromSearch();
      if (urlToken) {
        if (isMounted) {
          setIsLoading(true);
          setError(null);
        }

        try {
          const result = await verifyTributoToken(urlToken);
          if (!isMounted) return;

          if (result.success && result.session) {
            // Guardar sesión y sanitizar la barra de URL
            const saved = saveSession(result.session.user, urlToken);
            cleanUrlToken();
            setSession(saved);
            setError(null);
          } else {
            setError(
              result.error ||
                "El token de acceso no es válido o ha expirado. Por favor inicia sesión en TributoApp."
            );
            cleanUrlToken();
          }
        } catch (err) {
          if (isMounted) {
            setError("Error al conectar con TributoApp. Por favor verifica tu conexión a internet.");
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
        return;
      }

      // 3. Sin sesión y sin token en URL -> Bloqueo
      if (isMounted) {
        setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const logout = () => {
    clearStoredSession();
    setSession(null);
    setError(null);
    setManualError(null);
  };

  const verifyManualToken = async (tokenInput: string): Promise<boolean> => {
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setManualError("Por favor ingresa un token válido.");
      return false;
    }

    setIsVerifyingManual(true);
    setManualError(null);

    try {
      const result = await verifyTributoToken(trimmed);
      if (result.success && result.session) {
        const saved = saveSession(result.session.user, trimmed);
        setSession(saved);
        setShowManualInput(false);
        setManualToken("");
        setIsVerifyingManual(false);
        return true;
      } else {
        setManualError(result.error || "Token inválido o expirado.");
        setIsVerifyingManual(false);
        return false;
      }
    } catch {
      setManualError("Error de conexión al validar el token.");
      setIsVerifyingManual(false);
      return false;
    }
  };

  const contextValue: TributoAuthContextValue = {
    session,
    isAuthenticated: Boolean(session?.valid),
    isLoading,
    error,
    logout,
    verifyManualToken,
  };

  // 1. Pantalla de carga / verificación
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-teal-500/30">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="relative mx-auto size-20 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-teal-500/20 animate-ping opacity-60" />
            <div className="size-16 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-teal-900/40">
              <Loader2 className="size-8 animate-spin" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-white">
              Verificando credenciales
            </h2>
            <p className="text-sm text-slate-400">
              Validando suscripción activa con los servidores de TributoApp...
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs text-teal-400/90 font-medium">
            <ShieldCheck className="size-4" />
            <span>Conexión cifrada TLS 1.3 · TributoApp SSO</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Si no está autenticado -> Pantalla de Bloqueo Anti-Piratería
  if (!session?.valid) {
    return (
      <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col justify-between selection:bg-teal-500/30">
        {/* Barra superior de la pantalla de bloqueo */}
        <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 py-4">
          <div className="mx-auto max-w-6xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md shadow-teal-900/50">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <span className="font-bold text-base tracking-tight text-white">
                  TributoApp
                </span>
                <span className="ml-2 rounded-md bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-400">
                  Conciliador Fiscal DIAN
                </span>
              </div>
            </div>

            <a
              href="https://www.tributoapp.me"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-slate-400 hover:text-teal-400 transition flex items-center gap-1"
            >
              <span>Portal TributoApp</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </header>

        {/* Contenedor Principal / Tarjeta de Bloqueo */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl shadow-2xl shadow-black/60 border border-slate-200 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-300">
            {/* Header Visual de la Tarjeta */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-6 sm:p-8 text-white relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
                <Lock className="size-56 text-teal-300" />
              </div>

              <div className="relative z-10 space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-teal-500/20 border border-teal-400/30 px-3 py-1 text-xs font-semibold text-teal-300">
                  <Lock className="size-3.5" />
                  <span>Guardián de Acceso Anti-Piratería</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
                  Acceso Exclusivo para Suscriptores
                </h1>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                  El <strong className="text-white">Conciliador Fiscal DIAN vs Libros Contables</strong> está protegido y requiere una sesión activa con plan <span className="text-teal-300 font-semibold">Profesional</span> o <span className="text-teal-300 font-semibold">Empresarial</span> en TributoApp.
                </p>
              </div>
            </div>

            {/* Cuerpo de la Tarjeta */}
            <div className="p-6 sm:p-8 space-y-6">
              {/* Alerta de Error si hubo intento fallido */}
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 flex items-start gap-3 text-xs sm:text-sm">
                  <AlertTriangle className="size-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-0.5">Acceso no autorizado:</span>
                    <span>{error}</span>
                  </div>
                </div>
              )}

              {/* Grid de Beneficios de la Herramienta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Zap className="size-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-slate-800 block">Cruce DIAN Instantáneo</strong>
                    <span className="text-slate-500">Compara miles de facturas y notas crédito en segundos.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <ShieldCheck className="size-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-slate-800 block">Auditoría Fiscal Avanzada</strong>
                    <span className="text-slate-500">Detecta omisiones, duplicados y diferencias en IVA.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <FileSpreadsheet className="size-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-slate-800 block">Exportación Oficial</strong>
                    <span className="text-slate-500">Excel auditado con fórmulas y plantillas para Siigo.</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Sparkles className="size-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <strong className="text-slate-800 block">Seguridad Multi-Empresa</strong>
                    <span className="text-slate-500">Historial local seguro y dictámenes tributarios.</span>
                  </div>
                </div>
              </div>

              {/* Botones de Acción Principales */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={TRIBUTO_LOGIN_URL}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white font-bold py-3.5 px-6 shadow-lg shadow-teal-900/20 transition-all text-sm group"
                >
                  <span>🚀 Iniciar Sesión en TributoApp</span>
                  <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
                </a>

                <a
                  href={TRIBUTO_PRICING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold py-3.5 px-6 transition-all text-sm"
                >
                  <span>👑 Conoce los Planes Disponibles</span>
                  <ExternalLink className="size-4 text-slate-500" />
                </a>
              </div>

              {/* Sección desplegable para ingreso manual de token */}
              <div className="border-t border-slate-100 pt-4 text-center">
                {!showManualInput ? (
                  <button
                    type="button"
                    onClick={() => setShowManualInput(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-teal-700 font-medium transition"
                  >
                    <KeyRound className="size-3.5" />
                    <span>¿Tienes un token de acceso? Ingresar manualmente</span>
                  </button>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await verifyManualToken(manualToken);
                    }}
                    className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200 text-left"
                  >
                    <div className="flex items-center justify-between">
                      <label htmlFor="manual-token" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <KeyRound className="size-3.5 text-teal-700" />
                        <span>Pegar Token de Acceso TributoApp:</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowManualInput(false)}
                        className="text-[11px] text-slate-400 hover:text-slate-600"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        id="manual-token"
                        type="text"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        placeholder="ej. trib_auth_eyJhbGciOi..."
                        className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 font-mono text-slate-800"
                      />
                      <button
                        type="submit"
                        disabled={isVerifyingManual || !manualToken.trim()}
                        className="px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                      >
                        {isVerifyingManual ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>Validando...</span>
                          </>
                        ) : (
                          <span>Verificar</span>
                        )}
                      </button>
                    </div>

                    {manualError && (
                      <p className="text-xs text-rose-600 font-medium">
                        {manualError}
                      </p>
                    )}
                  </form>
                )}
              </div>
            </div>

            {/* Footer de la Tarjeta */}
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 text-center text-[11px] text-slate-500 flex items-center justify-center gap-2">
              <ShieldCheck className="size-3.5 text-teal-600" />
              <span>Protección de Software y Propiedad Intelectual · TributoApp S.A.S. Colombia</span>
            </div>
          </div>
        </main>

        {/* Footer Global */}
        <footer className="border-t border-slate-800/60 bg-slate-950/40 py-4 px-6 text-center text-xs text-slate-500">
          <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© {new Date().getFullYear()} TributoApp S.A.S. · Todos los derechos reservados</span>
            <span className="text-[11px] text-slate-600">
              Cruce tributario inteligente y automatización contable
            </span>
          </div>
        </footer>
      </div>
    );
  }

  // 3. Si está autenticado -> Renderiza la aplicación protegida con el Context
  return (
    <TributoAuthContext.Provider value={contextValue}>
      {children}
    </TributoAuthContext.Provider>
  );
}

/**
 * Componente que renderiza el estado del usuario autenticado en la barra superior.
 */
export function TributoUserBadge() {
  const { session, logout } = useTributoAuth();

  if (!session?.valid) return null;

  const user = session.user;
  const displayName = user?.name || user?.email || "Usuario Suscriptor";
  const planName = user?.plan || "Profesional";

  return (
    <div className="flex items-center gap-2 bg-teal-soft/60 border border-teal/20 rounded-lg px-2.5 py-1 text-xs">
      <div className="flex items-center gap-1.5 text-teal-deep font-semibold">
        <UserCheck className="size-3.5 text-teal" />
        <span className="max-w-[140px] truncate">{displayName}</span>
        <span className="rounded bg-teal text-bg-elevated px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
          {planName}
        </span>
      </div>

      <button
        type="button"
        onClick={logout}
        title="Cerrar sesión protegida"
        className="ml-1 text-ink-subtle hover:text-danger p-0.5 rounded transition"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}
