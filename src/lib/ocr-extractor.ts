import { createWorker, type Worker } from "tesseract.js";
import { getDocumentProxy, renderPageAsImage } from "unpdf";

let sharedWorkerPromise: Promise<Worker> | null = null;

/**
 * Determina si un archivo o nombre de archivo corresponde a un formato de imagen soportado
 */
export function isImageFile(fileOrName: File | string): boolean {
  if (typeof fileOrName === "string") {
    const lower = fileOrName.toLowerCase();
    return /\.(png|jpe?g|webp|bmp|tiff)$/i.test(lower);
  }
  if (fileOrName && typeof fileOrName === "object") {
    if ("type" in fileOrName && typeof fileOrName.type === "string" && fileOrName.type.startsWith("image/")) {
      return true;
    }
    if ("name" in fileOrName && typeof fileOrName.name === "string") {
      return /\.(png|jpe?g|webp|bmp|tiff)$/i.test(fileOrName.name.toLowerCase());
    }
  }
  return false;
}

/**
 * Determina si un archivo o nombre de archivo corresponde a un documento PDF
 */
export function isPdfFile(fileOrName: File | string): boolean {
  if (typeof fileOrName === "string") {
    return fileOrName.toLowerCase().endsWith(".pdf");
  }
  if (fileOrName && typeof fileOrName === "object") {
    if ("type" in fileOrName && typeof fileOrName.type === "string" && fileOrName.type.includes("pdf")) {
      return true;
    }
    if ("name" in fileOrName && typeof fileOrName.name === "string") {
      return fileOrName.name.toLowerCase().endsWith(".pdf");
    }
  }
  return false;
}

/**
 * Obtiene o inicializa el worker de Tesseract configurado con modelo en español ('spa')
 * Carga los archivos traineddata desde la ruta local /tessdata servida por la app.
 */
export async function getOcrWorker(onProgress?: (progress: number) => void): Promise<Worker> {
  if (!sharedWorkerPromise) {
    const isBrowser = typeof window !== "undefined";
    const origin = isBrowser ? window.location.origin : "";
    const langPath = isBrowser ? `${origin}/tessdata` : undefined;

    sharedWorkerPromise = createWorker("spa", 1, {
      langPath,
      logger: (m) => {
        if (m.status === "recognizing text" && onProgress) {
          onProgress(Math.round((m.progress || 0) * 100));
        }
      },
    });
  }
  return sharedWorkerPromise;
}

/**
 * Libera el worker de OCR en memoria
 */
export async function terminateOcrWorker(): Promise<void> {
  if (sharedWorkerPromise) {
    const worker = await sharedWorkerPromise;
    await worker.terminate();
    sharedWorkerPromise = null;
  }
}

/**
 * Realiza OCR sobre un archivo de imagen (File, Blob, base64 data URL o Canvas)
 */
export async function extractTextFromImage(
  imageSource: File | Blob | string | HTMLCanvasElement,
  onProgress?: (progress: number) => void
): Promise<string> {
  const worker = await getOcrWorker(onProgress);
  const result = await worker.recognize(imageSource as any);
  return result.data.text || "";
}

/**
 * Renderiza cada página de un PDF a canvas en el navegador y extrae el texto mediante OCR.
 * Diseñado para PDFs vectorizados sin fuentes digitales o documentos escaneados.
 */
export async function extractTextFromPdfWithOcr(
  buffer: ArrayBuffer | Uint8Array,
  onProgress?: (progress: number) => void
): Promise<string[]> {
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  if (!isBrowser) {
    return [];
  }

  const rawBytes =
    buffer instanceof Uint8Array
      ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
      : new Uint8Array(buffer);
  const uint8 = rawBytes.slice();

  const doc = await getDocumentProxy(uint8);
  const numPages = doc.numPages;
  const pagesText: string[] = [];

  const worker = await getOcrWorker(onProgress);

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const dataUrl = await renderPageAsImage(doc, pageNum, {
      scale: 2.0,
      toDataURL: true,
    });

    const result = await worker.recognize(dataUrl);
    pagesText.push(result.data.text || "");

    if (onProgress) {
      onProgress(Math.round((pageNum / numPages) * 100));
    }
  }

  return pagesText;
}
