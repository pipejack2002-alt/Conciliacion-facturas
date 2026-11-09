import { getDocumentProxy, extractText } from "unpdf";

export const DIAN_SEARCH_DOCUMENT_URL =
  "https://catalogo-vpfe.dian.gov.co/User/SearchDocument";

/**
 * Construye el enlace de consulta directa por QR/CUFE en el catálogo VPFE de la DIAN.
 * Este enlace lleva el CUFE embebido en el parámetro documentkey para no tener que digitarlo.
 */
export function buildDianQrDirectUrl(cufe: string, nitSinDv?: string): string {
  const clean = (cufe || "").trim();
  if (!clean) return DIAN_SEARCH_DOCUMENT_URL;
  const nitParam = nitSinDv ? `&nit=${encodeURIComponent(nitSinDv.trim())}` : "";
  return `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${encodeURIComponent(clean)}${nitParam}`;
}

/**
 * Construye la URL de SearchDocument pasando CUFE y NIT sin DV como parámetros de consulta
 */
export function buildDianSearchDocumentUrl(cufe?: string, nitSinDv?: string): string {
  const cleanCufe = (cufe || "").trim();
  const cleanNit = (nitSinDv || "").trim();
  if (!cleanCufe && !cleanNit) return DIAN_SEARCH_DOCUMENT_URL;
  const params = new URLSearchParams();
  if (cleanCufe) params.set("documentkey", cleanCufe);
  if (cleanNit) params.set("nit", cleanNit);
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

    // Construir el nuevo PDF sin contraseña y CON CAPA DE TEXTO SELECCIONABLE
    const unlockedPdfBytes =
      jpegPages.length > 0 ? buildUnencryptedPdfFromJpegs(jpegPages) : rawBytes.slice();

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
