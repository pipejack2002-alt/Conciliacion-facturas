import { describe, it } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getDocumentProxy, extractText } from "unpdf";
import { decryptPdfNativeBytes, md5, rc4 } from "./pdf-native-decrypt.ts";
import {
  EXTENSION_VERSION,
  getNitSinDv,
  extractNitPasswordVariants,
  buildCandidatePasswordsForDianPdf,
  buildUnencryptedPdfFromJpegs,
  buildDianQrDirectUrl,
  buildDianSearchDocumentUrl,
  buildDianAutofillBookmarklet,
  buildDianExtensionZipBytes,
  formatInvoicePrefixAndNumber,
  inferInvoiceDocFileName,
  groupTextItemsIntoLines,
  DIAN_SEARCH_DOCUMENT_URL,
} from "./dian-pdf-unlocker.ts";
import {
  EXTENSION_MANIFEST_JSON,
  EXTENSION_BACKGROUND_JS,
  EXTENSION_PAGE_HOOK_JS,
  EXTENSION_CONTENT_JS,
} from "./dian-extension-source.ts";

describe("DIAN CUFE & PDF Unlocker Utilities", () => {
  it("limpia el NIT eliminando puntos, comas y el dígito de verificación (DV)", () => {
    assert.strictEqual(getNitSinDv("901.260.460-1"), "901260460");
    assert.strictEqual(getNitSinDv("802.009.158 - 4"), "802009158");
    assert.strictEqual(getNitSinDv("9012604601"), "901260460");
    assert.strictEqual(getNitSinDv("802009158"), "802009158");
    assert.strictEqual(getNitSinDv("32742699"), "32742699");
  });

  it("genera variantes de contraseña para NIT con y sin DV", () => {
    const variants = extractNitPasswordVariants("901.260.460-1");
    assert.strictEqual(variants[0], "901260460");
    assert.ok(variants.includes("9012604601"));
  });

  it("construye la lista priorizada de contraseñas candidatas (Receptor, Emisor y Conciliación)", () => {
    const candidates = buildCandidatePasswordsForDianPdf({
      companyNit: "901.260.460-1",
      companyNombre: "TECNICOS Y LOGISTICOS DEL CARIBE SAS",
      rowNit: "802009158",
      rowNombre: "ABRASIVOS DE LA COSTA LTDA",
      allRows: [
        { nitContraparte: "890103075", nombreContraparte: "AGRO-COSTA S.A.S" },
      ],
    });

    const passwords = candidates.map((c) => c.password);
    assert.strictEqual(passwords[0], "901260460");
    assert.ok(passwords.includes("802009158"));
    assert.ok(passwords.includes("890103075"));
  });

  it("construye URLs válidas hacia el catálogo VPFE de la DIAN con CUFE, NIT sin DV y Prefijo+Número (doc)", () => {
    const cufe =
      "3df1a8d8c0baf1d8c76d2324c3094986166d3a8d5620faa89b4e050c7fc52be707de1c4ba3d083f9080960a2f31ece93";
    assert.strictEqual(
      DIAN_SEARCH_DOCUMENT_URL,
      "https://catalogo-vpfe.dian.gov.co/User/SearchDocument",
    );
    assert.ok(buildDianQrDirectUrl(cufe, "901260460", "802009158", "FE-29159").includes(cufe));
    assert.ok(buildDianQrDirectUrl(cufe, "901260460", "802009158", "FE-29159").includes("doc=FE-29159"));
    assert.ok(buildDianSearchDocumentUrl(cufe, "901260460", "802009158", "FE-29159").includes("DocumentKey="));
    assert.ok(buildDianSearchDocumentUrl(cufe, "901260460", "802009158", "FE-29159").includes("nit=901260460"));
    assert.ok(buildDianSearchDocumentUrl(cufe, "901260460", "802009158", "FE-29159").includes("emisor=802009158"));
    assert.ok(buildDianSearchDocumentUrl(cufe, "901260460", "802009158", "FE-29159").includes("doc=FE-29159"));
    assert.ok(buildDianAutofillBookmarklet(cufe, "901260460").startsWith("javascript:"));
    const extZip = buildDianExtensionZipBytes();
    assert.ok(extZip.byteLength > 200);
  });

  it("nombra las facturas desbloqueadas con su Prefijo y Número de Factura (ej. FE-29159.pdf)", () => {
    assert.strictEqual(formatInvoicePrefixAndNumber("FE", "29159"), "FE-29159");
    assert.strictEqual(formatInvoicePrefixAndNumber("FE", "FE-29159"), "FE-29159");
    assert.strictEqual(formatInvoicePrefixAndNumber("FE", "FE29159"), "FE-29159");
    assert.strictEqual(formatInvoicePrefixAndNumber("", "730065"), "730065");
    assert.strictEqual(formatInvoicePrefixAndNumber("Folio", "730065"), "730065");

    // 1. Por coincidencia de CUFE en las filas de conciliación
    const cufe =
      "3df1a8d8c0baf1d8c76d2324c3094986166d3a8d5620faa89b4e050c7fc52be707de1c4ba3d083f9080960a2f31ece93";
    assert.strictEqual(
      inferInvoiceDocFileName({
        originalFileName: "RepresentacionGrafica.pdf",
        extractedText: `Factura Electrónica CUFE: ${cufe}`,
        allRows: [{ numero: "FE-29159", prefijo: "FE", folio: "29159", cufe, nitContraparte: "802009158" }],
      }),
      "FE-29159.pdf",
    );

    // 2. Por Serie y Folio en el texto del PDF
    assert.strictEqual(
      inferInvoiceDocFileName({
        originalFileName: "documento_dian.pdf",
        extractedText: "Factura electrónica\nSerie: SETT\nFolio: 10482\nFecha de emisión: 21-10-2026",
      }),
      "SETT-10482.pdf",
    );

    // 3. Por fila seleccionada en el modal (preferredDocNumero)
    assert.strictEqual(
      inferInvoiceDocFileName({
        originalFileName: "RepresentacionGrafica.pdf",
        preferredDocNumero: "FE-29159",
      }),
      "FE-29159.pdf",
    );

    // 4. Con sufijo _SIN_CLAVE para el vigilante de descargas
    assert.strictEqual(
      inferInvoiceDocFileName({
        originalFileName: "ShowDocumentToPublic.pdf",
        preferredDocNumero: "FE-29159",
        includeSinClaveSuffix: true,
      }),
      "FE-29159_SIN_CLAVE.pdf",
    );
  });

  it("mantiene el paquete ZIP descargable sincronizado con la versión más reciente de extension-dian-autofill/", () => {
    const extDir = join(process.cwd(), "extension-dian-autofill");
    const diskManifest = readFileSync(join(extDir, "manifest.json"), "utf8");
    const diskBackground = readFileSync(join(extDir, "background.js"), "utf8");
    const diskPageHook = readFileSync(join(extDir, "page-hook.js"), "utf8");
    const diskContent = readFileSync(join(extDir, "content.js"), "utf8");
    const parsedManifest = JSON.parse(diskManifest);

    assert.strictEqual(EXTENSION_VERSION, parsedManifest.version);
    assert.strictEqual(EXTENSION_MANIFEST_JSON, diskManifest);
    assert.strictEqual(EXTENSION_BACKGROUND_JS, diskBackground);
    assert.strictEqual(EXTENSION_PAGE_HOOK_JS, diskPageHook);
    assert.strictEqual(EXTENSION_CONTENT_JS, diskContent);

    const zipStr = new TextDecoder().decode(buildDianExtensionZipBytes());
    assert.ok(zipStr.includes(`v${EXTENSION_VERSION}`));
    assert.ok(zipStr.includes("SET_CURRENT_INVOICE_FILENAME"));
    assert.ok(zipStr.includes("page-hook.js"));
  });

  it("genera un PDF 1.4 sin contraseña y con capa de texto digital 100% seleccionable y copiable", async () => {
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
    const pdfBytes = buildUnencryptedPdfFromJpegs([
      {
        jpegBytes: fakeJpeg,
        pixelWidth: 1224,
        pixelHeight: 1584,
        ptWidth: 612,
        ptHeight: 792,
        textItems: [
          { str: "ABRASIVOS DE LA COSTA LTDA", x: 50, y: 720, width: 180, fontSize: 11 },
          { str: "NIT 802009158", x: 50, y: 700, width: 90, fontSize: 10 },
          { str: "Factura FE-29159 - Disco de corte 4 1/2", x: 50, y: 650, width: 220, fontSize: 10 },
        ],
      },
    ]);

    const rawPdfString = new TextDecoder().decode(pdfBytes);
    assert.strictEqual(rawPdfString.startsWith("%PDF-1.4"), true);
    assert.ok(rawPdfString.includes("/BaseFont /Helvetica"));
    assert.ok(rawPdfString.includes("3 Tr"));
    assert.strictEqual(rawPdfString.includes("/Encrypt"), false);

    // Verificar con el motor PDF real (unpdf / pdfjs) que el texto del PDF desbloqueado se puede seleccionar/extraer
    const extracted = await extractText(pdfBytes, { mergePages: true });
    assert.ok(extracted.text.includes("ABRASIVOS DE LA COSTA LTDA"));
    assert.ok(extracted.text.includes("NIT 802009158"));
    assert.ok(extracted.text.includes("Factura FE-29159"));
  });

  it("agrupa fragmentos de texto por coordenada Y en renglones ordenados de arriba hacia abajo", () => {
    const lines = groupTextItemsIntoLines([
      { str: "$48.000", x: 400, y: 500, width: 50, fontSize: 10 },
      { str: "DISCO DE CORTE", x: 50, y: 500, width: 100, fontSize: 10 },
      { str: "ENCABEZADO FACTURA", x: 50, y: 700, width: 120, fontSize: 12 },
    ]);
    assert.strictEqual(lines.length, 2);
    assert.strictEqual(lines[0], "ENCABEZADO FACTURA");
    assert.ok(lines[1].includes("DISCO DE CORTE") && lines[1].includes("$48.000"));
  });

  it("desbloquea nativamente un PDF encriptado con NIT (ISO 32000-1) conservando el 100% del texto vectorial original sin convertir a imagen", async () => {
    const PADDING = new Uint8Array([
      0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
      0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
      0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
      0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
    ]);
    const pwd = new TextEncoder().encode("901260460");
    const paddedPwd = new Uint8Array(32);
    paddedPwd.set(pwd);
    paddedPwd.set(PADDING.subarray(0, 32 - pwd.length), pwd.length);

    let ownerHash = md5(paddedPwd);
    for (let i = 0; i < 50; i++) ownerHash = md5(ownerHash);
    let oValue: Uint8Array = new Uint8Array(paddedPwd);
    for (let i = 0; i <= 19; i++) {
      const tk = ownerHash.map((b) => b ^ i);
      oValue = rc4(tk, oValue);
    }

    const id0 = new Uint8Array(16).fill(0x42);
    const P = -4;
    const pBytes = new Uint8Array([P & 0xff, (P >>> 8) & 0xff, (P >>> 16) & 0xff, (P >>> 24) & 0xff]);
    const keyInput = new Uint8Array(32 + 32 + 4 + 16);
    keyInput.set(paddedPwd, 0);
    keyInput.set(oValue, 32);
    keyInput.set(pBytes, 64);
    keyInput.set(id0, 68);
    let fileKey = md5(keyInput);
    for (let i = 0; i < 50; i++) fileKey = md5(fileKey);

    const uInput = new Uint8Array(48);
    uInput.set(PADDING, 0);
    uInput.set(id0, 32);
    let uVal = rc4(fileKey, md5(uInput));
    for (let i = 1; i <= 19; i++) {
      const tk = fileKey.map((b) => b ^ i);
      uVal = rc4(tk, uVal);
    }
    const uFull = new Uint8Array(32);
    uFull.set(uVal, 0);

    const plainStream = new TextEncoder().encode(
      "BT /F1 12 Tf 72 700 Td (Factura FE-29159 ABRASIVOS DE LA COSTA LTDA NIT 802009158) Tj ET",
    );
    const objKeyIn = new Uint8Array(16 + 5);
    objKeyIn.set(fileKey, 0);
    objKeyIn.set([4, 0, 0, 0, 0], 16);
    const obj4Key = md5(objKeyIn);
    const encStream = rc4(obj4Key, plainStream);

    const toHex = (u8: Uint8Array) =>
      Array.from(u8)
        .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
        .join("");
    const idHex = toHex(id0);
    const oHex = toHex(oValue);
    const uHex = toHex(uFull);

    const parts: Uint8Array[] = [];
    let offset = 0;
    const objs: Record<number, number> = {};
    const add = (s: string) => {
      const b = new TextEncoder().encode(s);
      parts.push(b);
      offset += b.length;
    };
    const addB = (b: Uint8Array) => {
      parts.push(b);
      offset += b.length;
    };

    add("%PDF-1.4\n");
    objs[1] = offset;
    add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    objs[2] = offset;
    add("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
    objs[3] = offset;
    add(
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    );
    objs[4] = offset;
    add(`4 0 obj\n<< /Length ${encStream.length} >>\nstream\n`);
    addB(encStream);
    add("\nendstream\nendobj\n");
    objs[5] = offset;
    add("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
    objs[6] = offset;
    add(
      `6 0 obj\n<< /Filter /Standard /V 2 /R 3 /Length 128 /P -4 /O <${oHex}> /U <${uHex}> >>\nendobj\n`,
    );

    const xrefPos = offset;
    add("xref\n0 7\n0000000000 65535 f \r\n");
    for (let i = 1; i <= 6; i++) add(`${String(objs[i]).padStart(10, "0")} 00000 n \r\n`);
    add(
      `trailer\n<< /Size 7 /Root 1 0 R /Encrypt 6 0 R /ID [<${idHex}> <${idHex}>] >>\nstartxref\n${xrefPos}\n%%EOF\n`,
    );

    const encryptedPdf = new Uint8Array(offset);
    let p = 0;
    for (const chunk of parts) {
      encryptedPdf.set(chunk, p);
      p += chunk.length;
    }

    // 1. Verificar que el PDF original pide contraseña
    await assert.rejects(async () => {
      await getDocumentProxy(encryptedPdf.slice());
    });

    // 2. Desencriptar vectorialmente usando los NIT candidatos
    const decrypted = await decryptPdfNativeBytes(encryptedPdf, ["802009158", "901260460"]);
    assert.strictEqual(decrypted.unlocked, true);
    assert.strictEqual(decrypted.wasEncrypted, true);
    assert.strictEqual(decrypted.passwordUsed, "901260460");

    // 3. Verificar que abre SIN contraseña y conserva el texto vectorial original
    const doc = await getDocumentProxy(decrypted.pdfBytes.slice());
    const extracted = await extractText(doc, { mergePages: true });
    await doc.loadingTask?.destroy();
    assert.ok(extracted.text.includes("Factura FE-29159 ABRASIVOS DE LA COSTA LTDA NIT 802009158"));
  });
});
