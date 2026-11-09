// ============================================================================
// Service Worker (Background) — Asistente DIAN Autollenado + Desbloqueo PDF v2.2.0
// 1. Descarga en memoria el PDF de la DIAN (incluyendo redirecciones 302 a Azure Blob).
// 2. Intercepta cualquier descarga directa con clave desde la DIAN, la cancela,
//    envía los bytes a content.js para desbloquearla y guarda el PDF con Prefijo-Número (ej. FE-29159.pdf).
// ============================================================================

const chromeApi = globalThis.chrome;

let currentInvoiceFilename = "";
let lastInterceptedUrl = "";
let lastInterceptedTime = 0;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function hasPdfOrZipSignature(u8) {
  if (!u8 || u8.byteLength < 8) return false;
  if (u8[0] === 0x50 && u8[1] === 0x4b && u8[2] === 0x03 && u8[3] === 0x04) {
    return true;
  }
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

function sanitizePdfFilename(rawName) {
  const clean = String(rawName || "")
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "_")
    .replace(/^-+|-+$/g, "");
  if (!clean) return "";
  return clean.toLowerCase().endsWith(".pdf") ? clean : clean + ".pdf";
}

function sendBytesToDianTabs(base64, url) {
  if (!chromeApi || !chromeApi.tabs || !chromeApi.tabs.query) return;
  chromeApi.tabs.query({ url: ["*://catalogo-vpfe.dian.gov.co/*", "*://*.dian.gov.co/*"] }, function (tabs) {
    if (!tabs || tabs.length === 0) return;
    for (let i = 0; i < tabs.length; i++) {
      if (tabs[i].id != null) {
        chromeApi.tabs.sendMessage(
          tabs[i].id,
          {
            type: "INTERCEPTED_DIAN_PDF_BYTES",
            base64: base64,
            url: url,
          },
          function () {
            if (chromeApi.runtime && chromeApi.runtime.lastError) {
              // Ignorar si la pestaña no tiene content script activo
            }
          }
        );
      }
    }
  });
}

if (chromeApi && chromeApi.runtime && chromeApi.runtime.onMessage) {
  chromeApi.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return false;

    if (msg.type === "SET_CURRENT_INVOICE_FILENAME" && msg.filename) {
      currentInvoiceFilename = sanitizePdfFilename(msg.filename);
      sendResponse({ ok: true, filename: currentInvoiceFilename });
      return false;
    }

    if (msg.type === "FETCH_DIAN_PDF" && msg.url) {
      fetch(msg.url, {
        method: "GET",
        credentials: "include",
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error("HTTP " + res.status);
          }
          const buf = await res.arrayBuffer();
          const u8 = new Uint8Array(buf);
          if (!hasPdfOrZipSignature(u8)) {
            throw new Error("La respuesta no contiene un PDF o ZIP válido");
          }
          sendResponse({
            ok: true,
            base64: arrayBufferToBase64(buf),
            contentType: res.headers.get("content-type") || "application/pdf",
          });
        })
        .catch((err) => {
          sendResponse({
            ok: false,
            error: String((err && err.message) || err),
          });
        });
      return true;
    }

    return false;
  });
}

// Interceptar descargas desde la DIAN:
// - Si es blob: (nuestro PDF ya desbloqueado), le asigna el nombre Prefijo-Numero.pdf (ej. FE-29159.pdf).
// - Si es https:// desde dian.gov.co o blob.core.windows.net (PDF original con clave de la DIAN),
//   descarga los bytes en memoria, cancela el archivo bloqueado y se los envía a content.js para desbloquearlo automáticamente.
if (chromeApi && chromeApi.downloads && chromeApi.downloads.onDeterminingFilename) {
  chromeApi.downloads.onDeterminingFilename.addListener(function (downloadItem, suggest) {
    const url = String(downloadItem.finalUrl || downloadItem.url || "");
    const origUrl = String(downloadItem.url || "");
    const referrer = String(downloadItem.referrer || "");

    const isBlobFromDian =
      origUrl.startsWith("blob:https://catalogo-vpfe.dian.gov.co") ||
      origUrl.startsWith("blob:https://");

    if (isBlobFromDian) {
      if (currentInvoiceFilename) {
        suggest({
          filename: currentInvoiceFilename,
          conflictAction: "uniquify",
        });
      } else {
        suggest();
      }
      return false;
    }

    const isDirectDianServerDownload =
      url.includes("dian.gov.co") ||
      origUrl.includes("dian.gov.co") ||
      referrer.includes("dian.gov.co") ||
      (url.includes("blob.core.windows.net") && Boolean(currentInvoiceFilename));

    if (isDirectDianServerDownload && url.startsWith("http")) {
      const now = Date.now();
      if (url === lastInterceptedUrl && now - lastInterceptedTime < 2500) {
        try {
          chromeApi.downloads.cancel(downloadItem.id, function () {});
        } catch {}
        return false;
      }
      lastInterceptedUrl = url;
      lastInterceptedTime = now;

      fetch(url, {
        method: "GET",
        credentials: "include",
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("HTTP " + res.status);
          const buf = await res.arrayBuffer();
          const u8 = new Uint8Array(buf);
          if (!hasPdfOrZipSignature(u8)) {
            throw new Error("No es PDF/ZIP");
          }
          // Cancelar la descarga con clave para que solo se guarde el PDF desbloqueado
          try {
            chromeApi.downloads.cancel(downloadItem.id, function () {
              if (chromeApi.runtime && chromeApi.runtime.lastError) {
                // ignorar
              }
            });
          } catch {}
          sendBytesToDianTabs(arrayBufferToBase64(buf), url);
        })
        .catch(() => {
          // Si no se pudo interceptar por red, al menos renombrarlo con Prefijo-Numero.pdf
          if (currentInvoiceFilename) {
            suggest({
              filename: currentInvoiceFilename,
              conflictAction: "uniquify",
            });
          } else {
            suggest();
          }
        });

      return true;
    }

    return false;
  });
}
