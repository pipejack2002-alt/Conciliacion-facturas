/** Extrae texto de un PDF. Funciona en el navegador y en el servidor. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes, {
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
  } as Parameters<typeof getDocumentProxy>[1]);
  const extracted = await extractText(pdf, { mergePages: true });
  const text = extracted.text;
  if (Array.isArray(text)) return text.join("\n\n");
  return typeof text === "string" ? text : "";
}

export async function extractPdfFromFile(file: File): Promise<string | null> {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const work = extractPdfText(bytes);
    const text = await Promise.race([
      work,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 10000),
      ),
    ]);
    return text.replace(/\s/g, "").length >= 40 ? text : null;
  } catch {
    return null;
  }
}
