import { getDocumentProxy, extractText } from "unpdf";
import { decryptPdfNativeBytes } from "./pdf-native-decrypt.ts";

export const DIAN_SEARCH_DOCUMENT_URL =
  "https://catalogo-vpfe.dian.gov.co/User/SearchDocument";

/**
 * Construye el enlace directo al buscador de documentos de la DIAN con DocumentKey (PascalCase)
 * para que la página de la DIAN rellene automáticamente el campo CUFE sin redirección 302
 * y conserve los parámetros nit y emisor para la extensión de autollenado.
 */
export function buildDianQrDirectUrl(
  cufe: string,
  nitSinDv?: string,
  emisorNitSinDv?: string,
): string {
  return buildDianSearchDocumentUrl(cufe, nitSinDv, emisorNitSinDv);
}

/**
 * Construye la URL de SearchDocument pasando DocumentKey (CUFE), nit (Receptor sin DV) y emisor (Emisor sin DV)
 */
export function buildDianSearchDocumentUrl(
  cufe?: string,
  nitSinDv?: string,
  emisorNitSinDv?: string,
): string {
  const cleanCufe = (cufe || "").trim();
  const cleanNit = (nitSinDv || "").trim();
  const cleanEmisor = (emisorNitSinDv || "").trim();
  if (!cleanCufe && !cleanNit) return DIAN_SEARCH_DOCUMENT_URL;
  const params = new URLSearchParams();
  if (cleanCufe) params.set("DocumentKey", cleanCufe);
  if (cleanNit) params.set("nit", cleanNit);
  if (cleanEmisor) params.set("emisor", cleanEmisor);
  return `${DIAN_SEARCH_DOCUMENT_URL}?${params.toString()}`;
}

/**
 * Construye un marcador inteligente (Bookmarklet) para la barra de favoritos del navegador
 * que rellena simultáneamente la casilla de CUFE y la casilla de NIT sin DV en la página de la DIAN
 * para que el usuario solo tenga que hacer clic en el botón verde "Buscar".
 */
export function buildDianAutofillBookmarklet(cufe: string, nitSinDv: string): string {
  const safeCufe = (cufe || "").trim().replace(/[^a-zA-Z0-9-]/g, "");
  const safeNit = (nitSinDv || "").trim().replace(/\D+/g, "");
  const code = `(function(){var c="${safeCufe}",n="${safeNit}";function fill(cufeVal,nitVal){var inputs=Array.from(document.querySelectorAll('input[type="text"],input:not([type])')).filter(function(el){return el.offsetParent!==null;});var cInput=document.querySelector('input[name*="DocumentKey" i],input[id*="DocumentKey" i],input[placeholder*="CUFE" i],input[placeholder*="UUID" i]')||inputs[0];var nInput=document.querySelector('input[name*="Nit" i],input[id*="Nit" i],input[placeholder*="NIT" i],input[placeholder*="emisor" i]')||inputs[1];if(cInput&&cufeVal){cInput.focus();cInput.value=cufeVal;cInput.dispatchEvent(new Event("input",{bubbles:true}));cInput.dispatchEvent(new Event("change",{bubbles:true}));}if(nInput&&nitVal){nInput.focus();nInput.value=nitVal;nInput.dispatchEvent(new Event("input",{bubbles:true}));nInput.dispatchEvent(new Event("change",{bubbles:true}));}}if(navigator.clipboard&&navigator.clipboard.readText){navigator.clipboard.readText().then(function(txt){if(txt&&txt.indexOf("|")>10){var parts=txt.trim().split("|");fill(parts[0].trim(),parts[1].trim());}else{fill(txt&&txt.trim().length>=30?txt.trim():c,n);}}).catch(function(){fill(c,n);});}else{fill(c,n);}})();`;
  return `javascript:${encodeURIComponent(code)}`;
}

/**
 * Obtiene el NIT limpio sin puntos, comas ni dígito de verificación (DV),
 * tal como lo exige el portal de la DIAN y como viene cifrada la contraseña del PDF.
 */
export function getNitSinDv(nit: string | undefined | null): string {
  if (!nit) return "";
  const raw = String(nit).trim();
  if (!raw) return "";

  // Si trae guion explícito de DV al final (ej. "901.260.460-1" o "802009158 - 4"), quitamos el sufijo
  const withoutExplicitDv = raw.replace(/[-–—]\s*\d\s*$/, "");
  const digits = withoutExplicitDv.replace(/\D+/g, "");
  if (!digits) return "";

  // Si tenía guion explícito, ya quedó sin DV
  if (withoutExplicitDv !== raw) {
    return digits;
  }

  // En Colombia, los NIT de personas jurídicas sin guion que tienen 10 dígitos y empiezan por 8 o 9
  // traen el dígito de verificación concatenado al final (9 dígitos base + 1 DV).
  if (digits.length === 10 && (digits.startsWith("8") || digits.startsWith("9"))) {
    return digits.slice(0, 9);
  }

  return digits;
}

/**
 * Genera todas las variantes posibles de un NIT para probar como contraseña del PDF de la DIAN
 * (primero el NIT sin DV de 9 dígitos, luego los dígitos completos, etc.)
 */
export function extractNitPasswordVariants(nit: string | undefined | null): string[] {
  if (!nit) return [];
  const sinDv = getNitSinDv(nit);
  const allDigits = String(nit).replace(/\D+/g, "");
  const variants: string[] = [];

  const add = (v: string) => {
    const clean = v.trim();
    if (clean.length >= 5 && !variants.includes(clean)) {
      variants.push(clean);
    }
  };

  if (sinDv) add(sinDv);
  if (allDigits) {
    if (allDigits.length === 10) {
      add(allDigits.slice(0, 9));
    }
    add(allDigits);
    if (allDigits.length >= 8 && allDigits !== sinDv) {
      add(allDigits.slice(0, -1));
    }
  }

  return variants;
}

export interface PasswordCandidate {
  password: string;
  sourceLabel: string;
}

/**
 * Construye la lista priorizada de contraseñas candidatas (NIT del Receptor sin DV,
 * NIT del Emisor sin DV, contraseña manual si se indicó, y todos los NIT de la conciliación activa).
 */
export function buildCandidatePasswordsForDianPdf(options: {
  companyNit?: string;
  companyNombre?: string;
  rowNit?: string;
  rowNombre?: string;
  allRows?: Array<{ nitContraparte: string; nombreContraparte?: string }>;
  customPassword?: string;
}): PasswordCandidate[] {
  const seen = new Set<string>();
  const list: PasswordCandidate[] = [];

  const pushCandidate = (pwd: string, sourceLabel: string) => {
    const clean = pwd.trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    list.push({ password: clean, sourceLabel });
  };

  // 1. Contraseña manual ingresada por el usuario (máxima prioridad)
  if (options.customPassword && options.customPassword.trim()) {
    const manual = options.customPassword.trim();
    pushCandidate(manual, "Clave ingresada manualmente");
    for (const v of extractNitPasswordVariants(manual)) {
      pushCandidate(v, "NIT manual sin DV");
    }
  }

  // 2. NIT de la empresa receptora / pagadora (Receptor en DIAN)
  if (options.companyNit) {
    const label = options.companyNombre
      ? `NIT Receptor (${options.companyNombre})`
      : "NIT Receptor (Empresa)";
    for (const v of extractNitPasswordVariants(options.companyNit)) {
      pushCandidate(v, label);
    }
  }

  // 3. NIT del proveedor / emisor de la fila seleccionada
  if (options.rowNit) {
    const label = options.rowNombre
      ? `NIT Emisor/Contraparte (${options.rowNombre})`
      : `NIT Emisor/Contraparte (${options.rowNit})`;
    for (const v of extractNitPasswordVariants(options.rowNit)) {
      pushCandidate(v, label);
    }
  }

  // 4. Todos los demás NIT presentes en la sesión de conciliación DIAN
  if (options.allRows && options.allRows.length > 0) {
    for (const r of options.allRows) {
      if (!r.nitContraparte) continue;
      const label = r.nombreContraparte
        ? `NIT en Conciliación (${r.nombreContraparte})`
        : `NIT en Conciliación (${r.nitContraparte})`;
      for (const v of extractNitPasswordVariants(r.nitContraparte)) {
        pushCandidate(v, label);
      }
    }
  }

  return list;
}

export interface PdfSelectableTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
}

export interface PdfJpegPageInput {
  jpegBytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
  ptWidth: number;
  ptHeight: number;
  textItems?: PdfSelectableTextItem[];
}

/**
 * Codifica una cadena Unicode al formato literal de PDF en WinAnsiEncoding (CP1252 / Latin-1)
 * para que todo el texto (incluyendo tildes, eñes, símbolos de moneda, etc.) sea 100% seleccionable y copiable.
 */
export function encodeWinAnsiPdfString(input: string): string {
  let out = "";
  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    // Reemplazos comunes de tipografía Unicode a CP1252 / ASCII
    if (code === 0x2013 || code === 0x2014 || code === 0x2212) code = 0x2d; // guiones
    else if (code === 0x2018 || code === 0x2019) code = 0x27; // comillas simples
    else if (code === 0x201c || code === 0x201d) code = 0x22; // comillas dobles
    else if (code === 0x2022) code = 0xb7; // viñeta
    else if (code === 0x20ac) code = 0x80; // euro

    if (code === 0x28) {
      out += "\\(";
    } else if (code === 0x29) {
      out += "\\)";
    } else if (code === 0x5c) {
      out += "\\\\";
    } else if (code >= 0x20 && code <= 0x7e) {
      out += String.fromCharCode(code);
    } else if (code >= 0xa0 && code <= 0xff) {
      out += "\\" + code.toString(8).padStart(3, "0");
    } else if (code === 0x09 || code === 0x0a || code === 0x0d) {
      out += " ";
    } else if (code > 0xff) {
      out += "?";
    }
  }
  return out;
}

/**
 * Construye un archivo binario PDF 1.4 estándar, multipágina, 100% SIN CONTRASEÑA
 * y CON CAPA DE TEXTO DIGITAL SELECCIONABLE Y COPIABLE (Ctrl+C) sobre la representación visual exacta.
 */
export function buildUnencryptedPdfFromJpegs(pages: PdfJpegPageInput[]): Uint8Array {
  if (pages.length === 0) {
    throw new Error("No hay páginas para generar el PDF desbloqueado.");
  }

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  let offset = 0;

  const writeStr = (str: string) => {
    const bytes = encoder.encode(str);
    chunks.push(bytes);
    offset += bytes.byteLength;
  };

  const writeBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    offset += bytes.byteLength;
  };

  // Objetos del PDF:
  // 1: Catalog
  // 2: Pages
  // 3: Font (Helvetica WinAnsiEncoding para capa de texto seleccionable)
  // Por cada página i (0..N-1):
  //   pageObjId = 4 + i * 3
  //   contentObjId = 5 + i * 3
  //   imgObjId = 6 + i * 3
  const totalObjects = 3 + pages.length * 3;
  const offsets: number[] = new Array(totalObjects + 1).fill(0);

  // Cabecera PDF 1.4 con comentario binario estándar
  writeStr("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n");

  // Objeto 1: Catalog
  offsets[1] = offset;
  writeStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Objeto 2: Pages
  const kidsRef = pages.map((_, i) => `${4 + i * 3} 0 R`).join(" ");
  offsets[2] = offset;
  writeStr(`2 0 obj\n<< /Type /Pages /Kids [ ${kidsRef} ] /Count ${pages.length} >>\nendobj\n`);

  // Objeto 3: Fuente estándar Type1 Helvetica con WinAnsiEncoding (permite seleccionar y copiar todo el texto)
  offsets[3] = offset;
  writeStr(
    "3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n",
  );

  // Objetos por cada página
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const pageObjId = 4 + i * 3;
    const contentObjId = 5 + i * 3;
    const imgObjId = 6 + i * 3;

    const ptW = Number(Math.max(72, p.ptWidth || 612).toFixed(2));
    const ptH = Number(Math.max(72, p.ptHeight || 792).toFixed(2));
    const pxW = Math.max(1, Math.round(p.pixelWidth));
    const pxH = Math.max(1, Math.round(p.pixelHeight));

    // Page Object (incluye tanto el XObject de imagen como la fuente /F1 para selección de texto)
    offsets[pageObjId] = offset;
    writeStr(
      `${pageObjId} 0 obj\n` +
        `<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 ${ptW} ${ptH} ] ` +
        `/Resources << /Font << /F1 3 0 R >> /XObject << /Im0 ${imgObjId} 0 R >> >> ` +
        `/Contents ${contentObjId} 0 R >>\n` +
        `endobj\n`,
    );

    // Content Stream Object:
    // 1) Dibuja la factura de alta resolución (/Im0 Do)
    // 2) Superpone la capa de texto digital original en modo 3 Tr (invisible pero 100% seleccionable y copiable con el mouse)
    let contentStream = `q\n${ptW} 0 0 ${ptH} 0 0 cm\n/Im0 Do\nQ\n`;
    if (p.textItems && p.textItems.length > 0) {
      contentStream += "BT\n3 Tr\n";
      for (const item of p.textItems) {
        const cleanStr = (item.str || "").trim();
        if (!cleanStr) continue;
        const encoded = encodeWinAnsiPdfString(item.str);
        if (!encoded) continue;

        const fontSize = Math.max(4, Math.min(72, Number((item.fontSize || 9).toFixed(2))));
        const x = Number(Math.max(0, Math.min(ptW, item.x || 0)).toFixed(2));
        const y = Number(Math.max(0, Math.min(ptH, item.y || 0)).toFixed(2));

        // Ajustar escala horizontal (Tz) para que el ancho de selección con el cursor coincida con el texto visual
        const estimatedWidth = Math.max(1, item.str.length * fontSize * 0.52);
        const tz =
          item.width && item.width > 1
            ? Math.max(40, Math.min(240, Math.round((item.width / estimatedWidth) * 100)))
            : 100;

        contentStream += `${tz} Tz\n/F1 ${fontSize} Tf\n1 0 0 1 ${x} ${y} Tm\n(${encoded}) Tj\n`;
      }
      contentStream += "ET\n";
    }

    const contentBytes = encoder.encode(contentStream);
    offsets[contentObjId] = offset;
    writeStr(`${contentObjId} 0 obj\n<< /Length ${contentBytes.byteLength} >>\nstream\n`);
    writeBytes(contentBytes);
    writeStr("\nendstream\nendobj\n");

    // Image XObject (DCTDecode = raw JPEG bytes)
    offsets[imgObjId] = offset;
    writeStr(
      `${imgObjId} 0 obj\n` +
        `<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
        `/Length ${p.jpegBytes.byteLength} >>\nstream\n`,
    );
    writeBytes(p.jpegBytes);
    writeStr("\nendstream\nendobj\n");
  }

  // Tabla XREF
  const xrefOffset = offset;
  writeStr(`xref\n0 ${totalObjects + 1}\n`);
  writeStr("0000000000 65535 f \n");
  for (let objId = 1; objId <= totalObjects; objId++) {
    const padded = String(offsets[objId]).padStart(10, "0");
    writeStr(`${padded} 00000 n \n`);
  }

  // Trailer
  writeStr(
    `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  // Concatenar todos los fragmentos en un único Uint8Array
  const result = new Uint8Array(offset);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return result;
}

/**
 * Agrupa los fragmentos de texto de una página PDF en líneas legibles de arriba hacia abajo
 * y de izquierda a derecha, para que el usuario pueda copiar descripciones, ítems y valores con 1 clic.
 */
export function groupTextItemsIntoLines(items: PdfSelectableTextItem[]): string[] {
  if (!items || items.length === 0) return [];
  const valid = items.filter((it) => it.str && it.str.trim().length > 0);
  if (valid.length === 0) return [];

  // En coordenadas PDF, Y crece de abajo hacia arriba; ordenamos de mayor Y (arriba) a menor Y (abajo)
  const sorted = [...valid].sort((a, b) => {
    if (Math.abs(b.y - a.y) > 3.5) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: Array<{ y: number; parts: Array<{ x: number; str: string }> }> = [];
  for (const item of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - item.y) <= 3.5) {
      last.parts.push({ x: item.x, str: item.str.trim() });
    } else {
      lines.push({ y: item.y, parts: [{ x: item.x, str: item.str.trim() }] });
    }
  }

  return lines
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join("   ")
        .trim(),
    )
    .filter((l) => l.length > 0);
}

/**
 * Convierte un Data URL base64 (ej. "data:image/jpeg;base64,...") en un Uint8Array
 */
function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(",");
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Descomprime archivos .pdf contenidos dentro de un archivo .zip descargado de la DIAN
 */
export async function extractPdfsFromZipBuffer(
  zipBuffer: ArrayBuffer | Uint8Array,
): Promise<Array<{ fileName: string; pdfBytes: Uint8Array }>> {
  const bytes =
    zipBuffer instanceof Uint8Array
      ? new Uint8Array(zipBuffer.buffer, zipBuffer.byteOffset, zipBuffer.byteLength)
      : new Uint8Array(zipBuffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder("utf-8");
  const extracted: Array<{ fileName: string; pdfBytes: Uint8Array }> = [];

  // Buscar el End of Central Directory (EOCD) signature 0x06054b50 desde el final
  let eocdOffset = -1;
  for (let i = bytes.byteLength - 22; i >= Math.max(0, bytes.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("El archivo ZIP no tiene un formato válido.");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  let ptr = cdOffset;
  for (let idx = 0; idx < totalEntries; idx++) {
    if (ptr + 46 > bytes.byteLength || view.getUint32(ptr, true) !== 0x02014b50) {
      break;
    }
    const compressionMethod = view.getUint16(ptr + 10, true);
    const compressedSize = view.getUint32(ptr + 20, true);
    const fileNameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const fileName = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + fileNameLen));
    ptr += 46 + fileNameLen + extraLen + commentLen;

    if (!fileName.toLowerCase().endsWith(".pdf")) continue;

    if (
      localHeaderOffset + 30 > bytes.byteLength ||
      view.getUint32(localHeaderOffset, true) !== 0x04034b50
    ) {
      continue;
    }

    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedSlice = bytes.subarray(dataStart, dataStart + compressedSize);

    if (compressionMethod === 0) {
      extracted.push({
        fileName: fileName.split("/").pop() || fileName,
        pdfBytes: compressedSlice.slice(),
      });
    } else if (compressionMethod === 8 && typeof DecompressionStream !== "undefined") {
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      writer.write(compressedSlice.slice());
      writer.close();
      const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
      extracted.push({
        fileName: fileName.split("/").pop() || fileName,
        pdfBytes: new Uint8Array(decompressedBuffer),
      });
    }
  }

  return extracted;
}

export interface UnlockedDianPdfResult {
  fileName: string;
  unlockedFileName: string;
  unlockedPdfBytes: Uint8Array;
  wasEncrypted: boolean;
  matchedPassword: string | null;
  matchedSourceLabel: string | null;
  pageCount: number;
  previewDataUrls: string[];
  extractedText: string;
  extractedLines: string[];
}

/**
 * Desbloquea un archivo PDF de factura electrónica de la DIAN probando automáticamente
 * el NIT del Receptor sin DV, el NIT del Emisor sin DV y los NIT de la sesión.
 * Devuelve un nuevo archivo PDF 100% libre de contraseña Y CON CAPA DE TEXTO SELECCIONABLE (Ctrl+C).
 */
export async function unlockDianPdfBuffer(
  pdfBuffer: ArrayBuffer | Uint8Array,
  originalFileName: string,
  candidates: PasswordCandidate[],
): Promise<UnlockedDianPdfResult> {
  const rawBytes =
    pdfBuffer instanceof Uint8Array
      ? new Uint8Array(pdfBuffer.buffer, pdfBuffer.byteOffset, pdfBuffer.byteLength)
      : new Uint8Array(pdfBuffer);

  let doc: Awaited<ReturnType<typeof getDocumentProxy>> | null = null;
  let wasEncrypted = false;
  let matchedPassword: string | null = null;
  let matchedSourceLabel: string | null = null;

  // 1. Intentar abrir sin contraseña primero (por si el PDF ya viene libre)
  try {
    doc = await getDocumentProxy(rawBytes.slice());
    wasEncrypted = false;
  } catch (err: any) {
    const errName = String(err?.name || "");
    const errMsg = String(err?.message || "").toLowerCase();
    const isPasswordError =
      errName === "PasswordException" ||
      errMsg.includes("password") ||
      errMsg.includes("contraseña") ||
      errMsg.includes("encrypted");

    if (!isPasswordError) {
      throw new Error(
        `No se pudo leer el archivo PDF (${originalFileName}): ${err?.message || "Formato inválido"}`,
      );
    }
    wasEncrypted = true;
  }

  // 2. Si tiene contraseña, probar cada NIT candidato automáticamente
  if (wasEncrypted) {
    for (const candidate of candidates) {
      try {
        doc = await getDocumentProxy(rawBytes.slice(), {
          password: candidate.password,
        } as any);
        matchedPassword = candidate.password;
        matchedSourceLabel = candidate.sourceLabel;
        break;
      } catch {
        // Siguiente NIT candidato
      }
    }

    if (!doc) {
      const triedSample = candidates
        .slice(0, 4)
        .map((c) => c.password)
        .join(", ");
      throw new Error(
        `El PDF está protegido con contraseña y ninguno de los NIT sin DV probados (${triedSample || "ninguno"}) coincidió. Ingresa el NIT del emisor o receptor manualmente arriba.`,
      );
    }
  }

  if (!doc) {
    throw new Error("No fue posible inicializar el documento PDF.");
  }

  try {
    const pageCount = doc.numPages;
    const allExtractedLines: string[] = [];
    const previewDataUrls: string[] = [];
    const jpegPages: PdfJpegPageInput[] = [];
    const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport1x = page.getViewport({ scale: 1.0 });

      // Extraer todos los fragmentos de texto digital con sus coordenadas exactas para incrustarlos
      // como capa de texto seleccionable (Ctrl+C) en el PDF desbloqueado y en el panel de copia rápida.
      const pageTextItems: PdfSelectableTextItem[] = [];
      try {
        const textContent = await page.getTextContent();
        for (const rawItem of textContent.items as any[]) {
          if (!rawItem || typeof rawItem.str !== "string" || !rawItem.str.trim()) continue;
          const tr = Array.isArray(rawItem.transform) ? rawItem.transform : [1, 0, 0, 10, 0, 0];
          const fontSize = Math.max(
            4,
            Math.hypot(Number(tr[2]) || 0, Number(tr[3]) || 0) || Number(rawItem.height) || 9,
          );
          pageTextItems.push({
            str: rawItem.str,
            x: Number(tr[4]) || 0,
            y: Number(tr[5]) || 0,
            width: Number(rawItem.width) || 0,
            fontSize,
          });
        }
      } catch {
        // continuar si alguna página no tiene capa de texto
      }

      const pageLines = groupTextItemsIntoLines(pageTextItems);
      allExtractedLines.push(...pageLines);

      if (isBrowser) {
        // Escala 2.0 (~144 DPI) para nitidez fiscal de facturas electrónicas y códigos QR
        const scale = 2.0;
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("No se pudo crear el contexto gráfico para reconstruir el PDF.");
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvas,
          canvasContext: ctx as any,
          viewport,
        } as any).promise;

        const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
        previewDataUrls.push(jpegDataUrl);
        jpegPages.push({
          jpegBytes: dataUrlToUint8Array(jpegDataUrl),
          pixelWidth: canvas.width,
          pixelHeight: canvas.height,
          ptWidth: viewport1x.width,
          ptHeight: viewport1x.height,
          textItems: pageTextItems,
        });
      }
    }

    let extractedText = allExtractedLines.join("\n");
    if (!extractedText.trim()) {
      try {
        const textRes = await extractText(doc, { mergePages: true });
        extractedText = typeof textRes.text === "string" ? textRes.text : "";
      } catch {
        extractedText = "";
      }
    }

    // 1. Intentar desencriptación vectorial nativa (ISO 32000-1) para conservar 100% fuentes, tablas y texto vectorial original sin convertir a imagen
    let unlockedPdfBytes: Uint8Array | null = null;
    if (!wasEncrypted) {
      unlockedPdfBytes = rawBytes.slice();
    } else {
      try {
        const pwdList = matchedPassword
          ? [matchedPassword, ...candidates.map((c) => c.password)]
          : candidates.map((c) => c.password);
        const nativeRes = await decryptPdfNativeBytes(rawBytes, pwdList);
        if (nativeRes.unlocked && nativeRes.pdfBytes.byteLength > 64) {
          const checkDoc = await getDocumentProxy(nativeRes.pdfBytes.slice());
          await checkDoc.loadingTask?.destroy();
          unlockedPdfBytes = nativeRes.pdfBytes;
        }
      } catch {
        // Respaldo: reconstrucción híbrida si algún PDF no estándar falla en modo nativo
      }
    }

    if (!unlockedPdfBytes) {
      unlockedPdfBytes =
        jpegPages.length > 0 ? buildUnencryptedPdfFromJpegs(jpegPages) : rawBytes.slice();
    }

    const baseName = originalFileName.replace(/\.pdf$/i, "");
    const unlockedFileName = baseName.endsWith("_SIN_CLAVE")
      ? `${baseName}.pdf`
      : `${baseName}_SIN_CLAVE.pdf`;

    return {
      fileName: originalFileName,
      unlockedFileName,
      unlockedPdfBytes,
      wasEncrypted,
      matchedPassword,
      matchedSourceLabel,
      pageCount,
      previewDataUrls,
      extractedText,
      extractedLines: allExtractedLines,
    };
  } finally {
    try {
      await doc.loadingTask?.destroy();
    } catch {
      // Ignorar al liberar memoria
    }
  }
}

/**
 * Descarga en el navegador un archivo PDF desbloqueado
 */
export function downloadUnlockedPdf(item: UnlockedDianPdfResult, customName?: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([item.unlockedPdfBytes.buffer as ArrayBuffer], {
    type: "application/pdf",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = customName || item.unlockedFileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Permite al usuario elegir en qué carpeta y con qué nombre guardar el PDF desbloqueado
 * usando el selector nativo de archivos del sistema operativo (showSaveFilePicker).
 */
export async function saveUnlockedPdfWithPicker(
  item: UnlockedDianPdfResult,
  customName?: string,
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const suggestedName = (customName || item.unlockedFileName).endsWith(".pdf")
    ? customName || item.unlockedFileName
    : `${customName || item.unlockedFileName}.pdf`;

  const win = window as any;
  if (typeof win.showSaveFilePicker === "function") {
    try {
      const handle = await win.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: "Documento PDF desbloqueado",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(item.unlockedPdfBytes);
      await writable.close();
      return handle.name || suggestedName;
    } catch (err: any) {
      if (err?.name === "AbortError") return null;
    }
  }

  downloadUnlockedPdf(item, suggestedName);
  return suggestedName;
}

/**
 * Calcula el CRC32 estándar para construir un archivo .ZIP válido en memoria
 */
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Construye un archivo .ZIP con la extensión de Chrome / Edge (manifest.json + content.js + instrucciones)
 * para autollenar el CUFE y el NIT sin DV en la pestaña de la DIAN.
 */
export function buildDianExtensionZipBytes(): Uint8Array {
  const encoder = new TextEncoder();

  const manifestJson = JSON.stringify(
    {
      manifest_version: 3,
      name: "Autollenado DIAN CUFE + NIT (Conciliador Fiscal)",
      version: "1.0.0",
      description:
        "Rellena automáticamente el CUFE y el NIT sin DV en catalogo-vpfe.dian.gov.co/User/SearchDocument cuando abres una factura desde tu Conciliador DIAN.",
      content_scripts: [
        {
          matches: ["https://catalogo-vpfe.dian.gov.co/*"],
          js: ["content.js"],
          run_at: "document_idle",
        },
      ],
    },
    null,
    2,
  );

  const contentJs = `(function () {
  var STORAGE_KEY_NIT = "tributoapp_dian_last_nit_sin_dv";
  var STORAGE_KEY_EMISOR = "tributoapp_dian_last_emisor_sin_dv";

  function parseParams() {
    var search = new URLSearchParams(window.location.search);
    var hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    var cufe = search.get("DocumentKey") || search.get("documentkey") || search.get("cufe") || hash.get("DocumentKey") || "";
    var nit = search.get("nit") || search.get("Nit") || search.get("SenderCode") || hash.get("nit") || "";
    var emisor = search.get("emisor") || search.get("nitEmisor") || hash.get("emisor") || "";

    if (nit) { try { localStorage.setItem(STORAGE_KEY_NIT, nit.replace(/\\D+/g, "")); } catch (e) {} }
    if (emisor) { try { localStorage.setItem(STORAGE_KEY_EMISOR, emisor.replace(/\\D+/g, "")); } catch (e) {} }

    var savedNit = "";
    var savedEmisor = "";
    try {
      savedNit = localStorage.getItem(STORAGE_KEY_NIT) || "";
      savedEmisor = localStorage.getItem(STORAGE_KEY_EMISOR) || "";
    } catch (e) {}

    return {
      cufe: cufe.trim(),
      nit: (nit || savedNit).replace(/\\D+/g, ""),
      emisor: (emisor || savedEmisor).replace(/\\D+/g, "")
    };
  }

  function getVisibleTextInputs() {
    return Array.from(document.querySelectorAll('input[type="text"], input[type="search"], input[type="number"], input:not([type])')).filter(function (el) {
      var style = window.getComputedStyle(el);
      return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
    });
  }

  function findCufeInput() {
    return document.querySelector('input#DocumentKey, input[name="DocumentKey"], input[name*="DocumentKey" i], input[placeholder*="CUFE" i]') || getVisibleTextInputs()[0] || null;
  }

  function findNitInput() {
    return document.querySelector('input#SenderCode, input[name="SenderCode"], input#Nit, input[name*="Nit" i], input[placeholder*="NIT" i], input[placeholder*="emisor" i]') || getVisibleTextInputs()[1] || null;
  }

  function setInputValue(input, value) {
    if (!input || !value) return;
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, value);
    else input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
  }

  function injectHelperBar(nitInput, data) {
    if (!nitInput || document.getElementById("tributoapp-dian-helper")) return;
    var bar = document.createElement("div");
    bar.id = "tributoapp-dian-helper";
    bar.style.cssText = "margin-top:8px;padding:8px 10px;border-radius:8px;background:#f0fdfa;border:1px solid #14b8a6;font-family:system-ui,sans-serif;font-size:12px;color:#0f172a;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px;";
    var status = document.createElement("span");
    status.style.cssText = "font-weight:700;color:#0f766e;";
    status.textContent = data.nit ? ("⚡ Autollenado listo (NIT: " + data.nit + ") — Solo dale clic a Buscar") : "⚡ Asistente Conciliador DIAN activo";
    bar.appendChild(status);

    var btnGroup = document.createElement("div");
    btnGroup.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";
    if (data.nit) {
      var btnReceptor = document.createElement("button");
      btnReceptor.type = "button";
      btnReceptor.textContent = "NIT Receptor: " + data.nit;
      btnReceptor.style.cssText = "background:#0d9488;color:#fff;border:none;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;";
      btnReceptor.onclick = function () { setInputValue(nitInput, data.nit); };
      btnGroup.appendChild(btnReceptor);
    }
    if (data.emisor && data.emisor !== data.nit) {
      var btnEmisor = document.createElement("button");
      btnEmisor.type = "button";
      btnEmisor.textContent = "NIT Emisor: " + data.emisor;
      btnEmisor.style.cssText = "background:#e2e8f0;color:#0f172a;border:1px solid #cbd5e1;border-radius:6px;padding:4px 8px;font-size:11px;font-weight:700;cursor:pointer;";
      btnEmisor.onclick = function () { setInputValue(nitInput, data.emisor); };
      btnGroup.appendChild(btnEmisor);
    }
    bar.appendChild(btnGroup);
    if (nitInput.parentElement) nitInput.parentElement.appendChild(bar);
  }

  function runAutofill() {
    var data = parseParams();
    var cufeInput = findCufeInput();
    var nitInput = findNitInput();
    if (cufeInput && data.cufe && !cufeInput.value) setInputValue(cufeInput, data.cufe);
    if (nitInput && data.nit && !nitInput.value) setInputValue(nitInput, data.nit);
    if (nitInput && (data.nit || data.emisor)) injectHelperBar(nitInput, data);
  }

  runAutofill();
  setTimeout(runAutofill, 300);
  setTimeout(runAutofill, 900);
})();\n`;

  const readmeTxt = `COMO INSTALAR LA EXTENSION DE AUTOLLENADO DIAN EN CHROME O EDGE (EN 15 SEGUNDOS):
1. Descomprime este archivo ZIP en una carpeta (o usa la carpeta "extension-dian-autofill" que ya está creada dentro de tu proyecto C:\\Apps\\CONCILIACION DIAN\\extension-dian-autofill).
2. En Google Chrome abre: chrome://extensions  (o en Microsoft Edge abre: edge://extensions).
3. Activa el interruptor "Modo de desarrollador" (arriba a la derecha en Chrome o a la izquierda en Edge).
4. Haz clic en el botón "Cargar descomprimida" (Load unpacked) y selecciona la carpeta "extension-dian-autofill".
5. ¡Listo! Ahora cada vez que hagas clic en el botón "DIAN" de tu aplicación, la pestaña de la DIAN se abrirá con el CUFE y el NIT sin DV ya escritos automáticamente en sus dos casillas, para que solo tengas que darle clic en "Buscar".\n`;

  const files = [
    { name: "manifest.json", data: encoder.encode(manifestJson) },
    { name: "content.js", data: encoder.encode(contentJs) },
    { name: "INSTRUCCIONES_INSTALACION.txt", data: encoder.encode(readmeTxt) },
  ];

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const crc = crc32(f.data);
    const size = f.data.byteLength;

    const localHeader = new Uint8Array(30 + nameBytes.byteLength);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.byteLength, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    const centralHeader = new Uint8Array(46 + nameBytes.byteLength);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.byteLength, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    localParts.push(localHeader, f.data);
    centralParts.push(centralHeader);
    offset += localHeader.byteLength + size;
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of centralParts) cdSize += c.byteLength;

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, cdStart, true);
  ev.setUint16(20, 0, true);

  const totalLen = offset + cdSize + 22;
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of localParts) {
    out.set(p, pos);
    pos += p.byteLength;
  }
  for (const p of centralParts) {
    out.set(p, pos);
    pos += p.byteLength;
  }
  out.set(eocd, pos);
  return out;
}

/**
 * Descarga en el navegador el archivo .ZIP con la extensión de Chrome / Edge
 */
export function downloadDianAutofillExtensionZip(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const zipBytes = buildDianExtensionZipBytes();
  const blob = new Blob([zipBytes.buffer as ArrayBuffer], {
    type: "application/zip",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "extension-dian-autofill.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
