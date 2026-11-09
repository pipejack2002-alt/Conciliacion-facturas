// ============================================================================
// Hook de Contexto Principal (MAIN World) — Conciliador DIAN v2.2.0
// Intercepta descargas generadas por jQuery / XHR / fetch / Blob / window.open
// en https://catalogo-vpfe.dian.gov.co/Document/ShowDocumentToPublic
// ============================================================================

(function () {
  if (window.__tributoappMainHookInstalled) return;
  window.__tributoappMainHookInstalled = true;

  function isShowDocumentPage() {
    const path = (window.location.pathname || "").toLowerCase();
    return (
      path.includes("showdocument") ||
      path.includes("/document/") ||
      Boolean(document.body && /descargar\s*pdf/i.test(document.body.innerText || ""))
    );
  }

  function hasPdfOrZipSignature(u8) {
    if (!u8 || u8.byteLength < 8) return false;
    // ZIP signature: PK\x03\x04
    if (u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04) {
      return true;
    }
    // PDF signature: %PDF- within first 1024 bytes
    const limit = Math.min(u8.byteLength - 5, 1024);
    for (let i = 0; i <= limit; i++) {
      if (
        u8[i] === 0x25 &&
        u8[i + 1] === 0x50 &&
        u8[i + 2] === 0x44 &&
        u8[i + 3] === 0x46 &&
        u8[i + 4] === 0x2d
      ) {
        return true;
      }
    }
    return false;
  }

  function uint8ToBase64(u8) {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < u8.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, u8.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function notifyCapturedBytes(u8, sourceUrl) {
    if (!hasPdfOrZipSignature(u8)) return;
    try {
      window.postMessage(
        {
          source: "tributoapp-main-hook",
          type: "CAPTURED_PDF_BYTES",
          base64: uint8ToBase64(u8),
          url: sourceUrl || "",
        },
        "*"
      );
    } catch {}
  }

  function notifyCapturedUrl(url) {
    if (!url || typeof url !== "string") return;
    if (url === "#" || url.toLowerCase().startsWith("javascript:")) return;
    try {
      const fullUrl = new URL(url, window.location.href).href;
      window.postMessage(
        {
          source: "tributoapp-main-hook",
          type: "CAPTURED_PDF_URL",
          url: fullUrl,
        },
        "*"
      );
    } catch {}
  }

  // 1. Escuchar window.open en la página de detalle del documento sin bloquear la descarga
  const origWindowOpen = window.open;
  window.open = function (url) {
    if (isShowDocumentPage() && url && typeof url === "string" && !url.startsWith("blob:")) {
      notifyCapturedUrl(url);
    }
    return origWindowOpen.apply(this, arguments);
  };

  // 2. Interceptar XMLHttpRequest por si la DIAN descarga el PDF o su URL vía AJAX ($.ajax)
  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__tributoappUrl = url;
    return origXhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    if (isShowDocumentPage()) {
      this.addEventListener("load", function () {
        try {
          const reqUrl = String(this.__tributoappUrl || "");
          if (this.response instanceof ArrayBuffer) {
            const u8 = new Uint8Array(this.response);
            if (hasPdfOrZipSignature(u8)) {
              notifyCapturedBytes(u8, reqUrl);
            }
          } else if (typeof Blob !== "undefined" && this.response instanceof Blob) {
            this.response.arrayBuffer().then(function (buf) {
              const u8 = new Uint8Array(buf);
              if (hasPdfOrZipSignature(u8)) {
                notifyCapturedBytes(u8, reqUrl);
              }
            });
          } else if (typeof this.responseText === "string" && this.responseText.length > 10) {
            const txt = this.responseText.trim();
            // Si el AJAX devuelve una URL de descarga o JSON con URL / base64
            if (
              /DownloadPDF|GetGraphicRepresentation|blob\.core\.windows\.net/i.test(reqUrl) ||
              /DownloadPDF|GetGraphicRepresentation|blob\.core\.windows\.net/i.test(txt)
            ) {
              const urlMatch = txt.match(/https?:\/\/[^"'\s<>]+|\/Document\/[^"'\s<>]+/i);
              if (urlMatch) {
                notifyCapturedUrl(urlMatch[0]);
              }
            }
          }
        } catch {}
      });
    }
    return origXhrSend.apply(this, arguments);
  };

  // 3. Escuchar comandos desde content.js para inspeccionar jQuery events o disparar el clic nativo
  window.addEventListener("message", function (event) {
    if (event.source !== window || !event.data || event.data.source !== "tributoapp-content") {
      return;
    }

    if (event.data.type === "INSPECT_OR_TRIGGER_DIAN_DOWNLOAD") {
      try {
        const links = Array.from(document.querySelectorAll("a, button")).filter(function (el) {
          if (el.closest("#tributoapp-dian-unlocker-banner, #tributoapp-dian-helper")) return false;
          const txt = (el.textContent || "").trim();
          const href = el.getAttribute("href") || "";
          return (
            /descargar\s*pdf/i.test(txt) ||
            /DownloadPDF/i.test(href) ||
            /GetGraphicRepresentation/i.test(href)
          );
        });

        const targetEl = links[0];
        if (!targetEl) return;

        // Inspeccionar handlers de jQuery si existen en la página de la DIAN
        const jq = window.jQuery || window.$;
        if (jq && typeof jq._data === "function") {
          const elementsToInspect = [targetEl, targetEl.parentElement, document, document.body];
          for (let i = 0; i < elementsToInspect.length; i++) {
            const node = elementsToInspect[i];
            if (!node) continue;
            const evData = jq._data(node, "events");
            if (evData && evData.click) {
              for (let j = 0; j < evData.click.length; j++) {
                const fnStr = String(evData.click[j].handler || "");
                const m = fnStr.match(/['"](\/Document\/[^'"]+|https?:\/\/[^'"]+)['"]/i);
                if (m && m[1]) {
                  notifyCapturedUrl(m[1]);
                }
              }
            }
          }
        }

        if (event.data.triggerClick) {
          if (jq && typeof jq(targetEl).trigger === "function") {
            targetEl.click();
          } else {
            targetEl.click();
          }
        }
      } catch {}
    }
  });
})();
