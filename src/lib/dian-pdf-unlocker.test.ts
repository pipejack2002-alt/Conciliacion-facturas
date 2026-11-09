import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getNitSinDv,
  extractNitPasswordVariants,
  buildCandidatePasswordsForDianPdf,
  buildUnencryptedPdfFromJpegs,
  buildDianQrDirectUrl,
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

  it("genera un binario PDF 1.4 multipágina válido y sin contraseña a partir de imágenes JPEG", () => {
    const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
    const pdfBytes = buildUnencryptedPdfFromJpegs([
      {
        jpegBytes: fakeJpeg,
        pixelWidth: 1224,
        pixelHeight: 1584,
        ptWidth: 612,
        ptHeight: 792,
      },
    ]);

    const text = new TextDecoder().decode(pdfBytes);
    assert.strictEqual(text.startsWith("%PDF-1.4"), true);
    assert.ok(text.includes("/Filter /DCTDecode"));
    assert.ok(text.includes("/Count 1"));
    assert.ok(text.includes("%%EOF"));
    assert.strictEqual(text.includes("/Encrypt"), false);
  });
});
