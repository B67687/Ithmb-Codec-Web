#!/usr/bin/env node
// sync-embedded.mjs — regenerate the EMBEDDED_EN fallback table in i18n.js
// from locales/en.json (single source of truth).
//
// When to run: after editing en.json (the lint gate check-i18n.mjs will also
// fail on drift, so run this to fix it). `npm run sync:i18n`.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DECODER = join(new URL("../", import.meta.url).pathname, "ithmb-decoder");
const enPath = join(DECODER, "locales/en.json");
const i18nPath = join(DECODER, "i18n.js");

const en = JSON.parse(readFileSync(enPath, "utf8"));
const body = Object.entries(en)
  .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
  .join(",\n");
const block = `const EMBEDDED_EN = {\n${body}\n};`;

const src = readFileSync(i18nPath, "utf8");
const start = src.indexOf("const EMBEDDED_EN = {");
if (start === -1) {
  console.error("EMBEDDED_EN not found in i18n.js");
  process.exit(1);
}
const end = src.indexOf("\n};", start) + 3;
writeFileSync(i18nPath, src.slice(0, start) + block + src.slice(end));
console.log(`EMBEDDED_EN synced from en.json (${Object.keys(en).length} keys)`);
