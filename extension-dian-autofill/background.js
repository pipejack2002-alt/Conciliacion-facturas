/**
 * Background Service Worker — Extensión Conciliador DIAN v2.0.0
 * -------------------------------------------------------------
 * 1. Permite descargar el binario del PDF de la DIAN sin restricciones CORS
 *    (incluso cuando redirige a Azure Blob Storage *.blob.core.windows.net).
 * 2. Intercepta descargas nativas bloqueadas iniciadas desde catalogo-vpfe.dian.gov.co
 *    para que se descargue únicamente la versión YA DESBLOQUEADA (_SIN_CLAVE.pdf).
 */

let bypassNextDownloadUntil = 0;
const chromeApi = globalThis.chrome;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

chromeApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return false;

  if (message.type === "ALLOW_LOCKED_DOWNLOAD_ONCE") {
    bypassNextDownloadUntil = Date.now() + 8000;
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === "FETCH_DIAN_PDF" && message.url) {
    (async () => {
      try {
        const res = await fetch(message.url, {
          method: "GET",
          credentials: "include",
        });
        if (!res.ok) {
          sendResponse({
            ok: false,
            error: "HTTP " + res.status + " al descargar PDF desde DIAN",
          });
          return;
        }
        const buf = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") || "application/pdf";
        sendResponse({
          ok: true,
          base64: arrayBufferToBase64(buf),
          contentType,
          byteLength: buf.byteLength,
        });
      } catch (err) {
        sendResponse({
          ok: false,
          error: String((err && err.message) || err || "Error de red"),
        });
      }
    })();
    return true; // respuesta asíncrona
  }

  return false;
});

if (chromeApi.downloads && chromeApi.downloads.onCreated) {
  chromeApi.downloads.onCreated.addListener((downloadItem) => {
    try {
      if (Date.now() < bypassNextDownloadUntil) return;

      const url = downloadItem.finalUrl || downloadItem.url || "";
      const referrer = downloadItem.referrer || "";

      // Ignorar descargas blob:/data: generadas por nuestro propio desbloqueador
      if (url.startsWith("blob:") || url.startsWith("data:")) return;

      const isFromDian =
        url.includes("dian.gov.co") ||
        referrer.includes("dian.gov.co") ||
        (url.includes("blob.core.windows.net") && referrer.includes("dian"));

      if (!isFromDian) return;

      // Cancelar la descarga bloqueada original y pedirle al content script que la desbloquee
      chromeApi.downloads.cancel(downloadItem.id, () => {
        if (chromeApi.runtime.lastError) {
          // ignorar si ya terminó
        }
        if (chromeApi.downloads.erase) {
          chromeApi.downloads.erase({ id: downloadItem.id });
        }
      });

      chromeApi.tabs.query({ url: "https://catalogo-vpfe.dian.gov.co/*" }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        const targetTab = tabs.find((t) => t.active) || tabs[0];
        if (targetTab && targetTab.id) {
          chromeApi.tabs.sendMessage(targetTab.id, {
            type: "INTERCEPTED_DIAN_DOWNLOAD_URL",
            url,
            filename: downloadItem.filename || "",
          });
        }
      });
    } catch {
      // continuar normalmente
    }
  });
}
