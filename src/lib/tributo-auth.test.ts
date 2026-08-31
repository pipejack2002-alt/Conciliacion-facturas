import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractTokenFromSearch,
  verifyTributoToken,
  saveSession,
  getStoredSession,
  clearStoredSession,
  TRIBUTO_SESSION_KEY,
} from "./tributo-auth.ts";

describe("Guardián TributoApp SSO - Pruebas Unitarias", () => {
  it("debe extraer 'auth_token' de los parámetros de búsqueda", () => {
    const search = "?auth_token=super_secret_jwt_token_123&empresa=test";
    const token = extractTokenFromSearch(search);
    assert.equal(token, "super_secret_jwt_token_123");
  });

  it("debe extraer 'token' alternativo si no existe auth_token", () => {
    const search = "?token=fallback_token_xyz_789";
    const token = extractTokenFromSearch(search);
    assert.equal(token, "fallback_token_xyz_789");
  });

  it("debe retornar null si no hay token en los parámetros", () => {
    const search = "?foo=bar&page=1";
    const token = extractTokenFromSearch(search);
    assert.equal(token, null);
  });

  it("debe verificar token exitosamente con la API oficial de TributoApp", async () => {
    const mockFetch = (async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("www.tributoapp.me/api/conciliador/verify?token=valid_token_123")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            valid: true,
            user: {
              id: "usr_99",
              email: "contador@empresa.com",
              name: "Carlos Contador",
              plan: "Empresarial",
            },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    }) as unknown as typeof fetch;

    const result = await verifyTributoToken("valid_token_123", mockFetch);
    assert.equal(result.success, true);
    assert.equal(result.session?.valid, true);
    assert.equal(result.session?.user?.email, "contador@empresa.com");
    assert.equal(result.session?.user?.plan, "Empresarial");
  });

  it("debe activar el fallback a tributoapp.me si www.tributoapp.me falla por red", async () => {
    let attemptedWww = false;
    let attemptedFallback = false;

    const mockFetch = (async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.startsWith("https://www.tributoapp.me")) {
        attemptedWww = true;
        throw new Error("DNS resolution failed for www");
      }
      if (urlStr.startsWith("https://tributoapp.me")) {
        attemptedFallback = true;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            valid: true,
            user: {
              id: "usr_42",
              email: "auditor@tributario.co",
              name: "Laura Auditora",
              plan: "Profesional",
            },
          }),
        };
      }
      return { ok: false, status: 500 };
    }) as unknown as typeof fetch;

    const result = await verifyTributoToken("fallback_token_456", mockFetch);
    assert.equal(attemptedWww, true);
    assert.equal(attemptedFallback, true);
    assert.equal(result.success, true);
    assert.equal(result.session?.user?.email, "auditor@tributario.co");
  });

  it("debe rechazar token cuando la API responde { valid: false }", async () => {
    const mockFetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        valid: false,
        message: "Suscripción vencida o token revocado.",
      }),
    })) as unknown as typeof fetch;

    const result = await verifyTributoToken("expired_token", mockFetch);
    assert.equal(result.success, false);
    assert.ok(result.error?.includes("Suscripción vencida"));
  });

  it("debe rechazar token cuando la API responde con 401 Unauthorized", async () => {
    const mockFetch = (async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        message: "Acceso no autorizado",
      }),
    })) as unknown as typeof fetch;

    const result = await verifyTributoToken("unauthorized_token", mockFetch);
    assert.equal(result.success, false);
    assert.equal(result.error, "Acceso no autorizado");
  });
});
