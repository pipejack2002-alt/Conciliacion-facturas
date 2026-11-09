import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const extDir = join(root, "extension-dian-autofill");
const outPath = join(root, "src", "lib", "dian-extension-source.ts");

const manifestJson = readFileSync(join(extDir, "manifest.json"), "utf8");
const backgroundJs = readFileSync(join(extDir, "background.js"), "utf8");
const pageHookJs = readFileSync(join(extDir, "page-hook.js"), "utf8");
const contentJs = readFileSync(join(extDir, "content.js"), "utf8");

const parsedManifest = JSON.parse(manifestJson);
const version = String(parsedManifest.version || "2.2.0");

const output = `// AUTO-GENERATED FROM extension-dian-autofill/ — DO NOT EDIT MANUALLY
// Ejecuta: node scripts/sync-extension-source.mjs para sincronizar.

export const EXTENSION_VERSION = ${JSON.stringify(version)};

export const EXTENSION_MANIFEST_JSON = ${JSON.stringify(manifestJson)};

export const EXTENSION_BACKGROUND_JS = ${JSON.stringify(backgroundJs)};

export const EXTENSION_PAGE_HOOK_JS = ${JSON.stringify(pageHookJs)};

export const EXTENSION_CONTENT_JS = ${JSON.stringify(contentJs)};
`;

writeFileSync(outPath, output, "utf8");
console.log(
  `[sync-extension-source] Sincronizado src/lib/dian-extension-source.ts con extension-dian-autofill v${version}`,
);
