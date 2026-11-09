/**
 * Extensión de Autollenado DIAN (CUFE + NIT sin DV)
 * Rellena automáticamente los campos de texto "CUFE o UUID" y "NIT del Emisor o Receptor"
 * en https://catalogo-vpfe.dian.gov.co/User/SearchDocument sin interferir con Cloudflare.
 */
(function () {
  const STORAGE_KEY_NIT = "tributoapp_dian_last_nit_sin_dv";
  const STORAGE_KEY_EMISOR = "tributoapp_dian_last_emisor_sin_dv";

  function parseParams() {
    const search = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const cufe =
      search.get("DocumentKey") ||
      search.get("documentkey") ||
      search.get("cufe") ||
      hash.get("DocumentKey") ||
      hash.get("cufe") ||
      "";

    const nit =
      search.get("nit") ||
      search.get("Nit") ||
      search.get("SenderCode") ||
      hash.get("nit") ||
      "";

    const emisor =
      search.get("emisor") ||
      search.get("nitEmisor") ||
      hash.get("emisor") ||
      "";

    if (nit) {
      try {
        localStorage.setItem(STORAGE_KEY_NIT, nit.replace(/\D+/g, ""));
      } catch {}
    }
    if (emisor) {
      try {
        localStorage.setItem(STORAGE_KEY_EMISOR, emisor.replace(/\D+/g, ""));
      } catch {}
    }

    let savedNit = "";
    let savedEmisor = "";
    try {
      savedNit = localStorage.getItem(STORAGE_KEY_NIT) || "";
      savedEmisor = localStorage.getItem(STORAGE_KEY_EMISOR) || "";
    } catch {}

    return {
      cufe: cufe.trim(),
      nit: (nit || savedNit).replace(/\D+/g, ""),
      emisor: (emisor || savedEmisor).replace(/\D+/g, ""),
    };
  }

  function getVisibleTextInputs() {
    return Array.from(
      document.querySelectorAll(
        'input[type="text"], input[type="search"], input[type="number"], input:not([type])'
      )
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        el.offsetParent !== null
      );
    });
  }

  function findCufeInput() {
    return (
      document.querySelector(
        'input#DocumentKey, input[name="DocumentKey"], input[name*="DocumentKey" i], input[placeholder*="CUFE" i], input[placeholder*="UUID" i]'
      ) ||
      getVisibleTextInputs()[0] ||
      null
    );
  }

  function findNitInput() {
    return (
      document.querySelector(
        'input#SenderCode, input[name="SenderCode"], input#Nit, input[name*="Nit" i], input[placeholder*="NIT" i], input[placeholder*="emisor" i]'
      ) ||
      getVisibleTextInputs()[1] ||
      null
    );
  }

  function setInputValue(input, value) {
    if (!input || !value) return false;
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
    return true;
  }

  function injectHelperBar(nitInput, data) {
    if (!nitInput || document.getElementById("tributoapp-dian-helper")) return;

    const bar = document.createElement("div");
    bar.id = "tributoapp-dian-helper";
    bar.style.cssText =
      "margin-top:8px;padding:8px 10px;border-radius:8px;background:#f0fdfa;border:1px solid #14b8a6;font-family:system-ui,sans-serif;font-size:12px;color:#0f172a;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;";

    const status = document.createElement("span");
    status.style.cssText = "font-weight:700;color:#0f766e;";
    status.textContent = data.nit
      ? `⚡ Autollenado listo (NIT: ${data.nit}) — Solo dale clic a Buscar`
      : "⚡ Asistente Conciliador DIAN activo";
    bar.appendChild(status);

    const btnGroup = document.createElement("div");
    btnGroup.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";

    if (data.nit) {
      const btnReceptor = document.createElement("button");
      btnReceptor.type = "button";
      btnReceptor.textContent = `NIT Receptor: ${data.nit}`;
      btnReceptor.style.cssText =
        "background:#0d9488;color:#fff;border:none;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;";
      btnReceptor.onclick = function () {
        setInputValue(nitInput, data.nit);
      };
      btnGroup.appendChild(btnReceptor);
    }

    if (data.emisor && data.emisor !== data.nit) {
      const btnEmisor = document.createElement("button");
      btnEmisor.type = "button";
      btnEmisor.textContent = `NIT Emisor: ${data.emisor}`;
      btnEmisor.style.cssText =
        "background:#e2e8f0;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;";
      btnEmisor.onclick = function () {
        setInputValue(nitInput, data.emisor);
      };
      btnGroup.appendChild(btnEmisor);
    }

    bar.appendChild(btnGroup);
    nitInput.parentElement?.appendChild(bar);
  }

  function runAutofill() {
    const data = parseParams();
    const cufeInput = findCufeInput();
    const nitInput = findNitInput();

    if (cufeInput && data.cufe && !cufeInput.value) {
      setInputValue(cufeInput, data.cufe);
    }
    if (nitInput && data.nit && !nitInput.value) {
      setInputValue(nitInput, data.nit);
    }
    if (nitInput && (data.nit || data.emisor)) {
      injectHelperBar(nitInput, data);
    }
  }

  runAutofill();
  setTimeout(runAutofill, 300);
  setTimeout(runAutofill, 900);
})();
