import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveActiveModule,
  resolveModoBanco,
  STORAGE_ACTIVE_MODULE_KEY,
  STORAGE_MODO_BANCO_KEY,
} from "./tab-persistence.ts";

describe("Tab and Bank Mode Persistence on Reload (F5)", () => {
  describe("resolveActiveModule", () => {
    it("debe retornar 'dian' por defecto cuando no hay parámetros de URL ni almacenamiento previo", () => {
      assert.equal(resolveActiveModule("", null), "dian");
      assert.equal(resolveActiveModule(undefined, undefined), "dian");
    });

    it("debe priorizar el parámetro 'modulo' de la URL sobre localStorage", () => {
      assert.equal(resolveActiveModule("?modulo=bancos", "dashboard_bi"), "bancos");
      assert.equal(resolveActiveModule("modulo=dashboard_bi", "dian"), "dashboard_bi");
      assert.equal(resolveActiveModule("?modulo=dian", "bancos"), "dian");
    });

    it("debe soportar el parámetro alternativo 'tab' de la URL", () => {
      assert.equal(resolveActiveModule("?tab=bancos", null), "bancos");
      assert.equal(resolveActiveModule("?tab=dashboard_bi", null), "dashboard_bi");
    });

    it("debe usar el valor de localStorage si no viene en la URL", () => {
      assert.equal(resolveActiveModule("", "bancos"), "bancos");
      assert.equal(resolveActiveModule("", "dashboard_bi"), "dashboard_bi");
      assert.equal(resolveActiveModule("?otro=123", "bancos"), "bancos");
    });

    it("debe ignorar valores inválidos y retornar 'dian'", () => {
      assert.equal(resolveActiveModule("?modulo=invalido", "desconocido"), "dian");
      assert.equal(resolveActiveModule("", "tab_no_existente"), "dian");
    });
  });

  describe("resolveModoBanco", () => {
    it("debe retornar 'homologado' por defecto cuando no hay parámetros ni storage", () => {
      assert.equal(resolveModoBanco("", null), "homologado");
      assert.equal(resolveModoBanco(undefined, undefined), "homologado");
    });

    it("debe priorizar el parámetro 'modo_banco' de la URL", () => {
      assert.equal(resolveModoBanco("?modo_banco=universal", "homologado"), "universal");
      assert.equal(resolveModoBanco("?modo_banco=homologado", "universal"), "homologado");
    });

    it("debe soportar el parámetro corto 'modo' en la URL", () => {
      assert.equal(resolveModoBanco("?modo=universal", null), "universal");
    });

    it("debe usar localStorage si no hay parámetro en la URL", () => {
      assert.equal(resolveModoBanco("", "universal"), "universal");
      assert.equal(resolveModoBanco("", "homologado"), "homologado");
    });

    it("debe ignorar valores inválidos y retornar 'homologado'", () => {
      assert.equal(resolveModoBanco("?modo_banco=inventado", "raro"), "homologado");
    });
  });

  describe("Claves de almacenamiento", () => {
    it("debe exponer claves de almacenamiento descriptivas y consistentes", () => {
      assert.equal(STORAGE_ACTIVE_MODULE_KEY, "conciliador_suite_active_module_v1");
      assert.equal(STORAGE_MODO_BANCO_KEY, "conciliador_modo_banco_v1");
    });
  });
});
