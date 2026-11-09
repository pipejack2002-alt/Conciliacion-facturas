import { describe, it } from "node:test";
import assert from "node:assert";
import { extractText } from "unpdf";
import {
  getNitSinDv,
  extractNitPasswordVariants,
  buildCandidatePasswordsForDianPdf,
  buildUnencryptedPdfFromJpegs,
  buildDianQrDirectUrl,
  groupTextItemsIntoLines,
  DIAN_SEARCH_DOCUMENT_URL,
} from "./dian-pdf-unlocker.ts";

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

  it("construye URLs válidas hacia el catálogo VPFE de la DIAN", () => {
    const cufe =
      "3df1a8d8c0baf1d8c76d2324c3094986166d3a8d5620faa89b4e050c7fc52be707de1c4ba3d083f9080960a2f31ece93";
    assert.strictEqual(
      DIAN_SEARCH_DOCUMENT_URL,
      "https://catalogo-vpfe.dian.gov.co/User/SearchDocument",
    );
    assert.ok(buildDianQrDirectUrl(cufe).includes(cufe));
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
});
