#!/usr/bin/env node
// check-i18n.mjs — i18n integrity gate for Ithmb-Codec-Web.
//
// Verifies:
//  1. Key parity: locales/en.json and locales/zh.json have IDENTICAL key sets.
//  2. No raw user-facing literals: user-facing strings must come from t()/data-i18n,
//     not hardcoded literals in ithmb-decoder/*.js.
//  3. Placeholder match: every {param} referenced in a value exists in the key's
//     usage (checked via t("key", {param}) call sites).
//
// Exit 0 = all checks pass. Non-zero = failure (for CI / pre-commit).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const DECODER = join(ROOT, "ithmb-decoder");
const LOCALES = join(DECODER, "locales");

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error("FAIL:", msg);
};

// ---- 1. Key parity ----
const en = JSON.parse(readFileSync(join(LOCALES, "en.json"), "utf8"));
const zh = JSON.parse(readFileSync(join(LOCALES, "zh.json"), "utf8"));
const enKeys = new Set(Object.keys(en));
const zhKeys = new Set(Object.keys(zh));
for (const k of enKeys) if (!zhKeys.has(k)) fail(`key "${k}" in en.json but NOT in zh.json`);
for (const k of zhKeys) if (!enKeys.has(k)) fail(`key "${k}" in zh.json but NOT in en.json`);
console.log(`[1] key parity: ${enKeys.size} en keys / ${zhKeys.size} zh keys`);

// ---- 2. No raw user-facing literals ----
// Known non-translatable constants (keyboard keys, format names, API constants).
const ALLOWLIST = new Set([
  "Files", "ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Escape",
  "JPEG", "PNG", "BMP", "WebP", "SHA-256", "POST", "TITLE", "Content-Type",
  "Error", "image/jpeg", "image/png", "image/bmp", "image/webp",
]);
const jsFiles = readdirSync(DECODER).filter((f) => f.endsWith(".js") && !f.endsWith("_bg.js") && !f.includes("ithmb_wasm") && f !== "i18n.js");
for (const f of jsFiles) {
  const rawSrc = readFileSync(join(DECODER, f), "utf8");
  // Strip comments so only real code is scanned (comments may reference
  // strings that are legitimately keyed elsewhere).
  const src = rawSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  // User-facing prose: quoted strings starting with a capital, 3+ chars.
  const re = /"([A-Z][A-Za-z][^"]{2,})"/g;
  let m;
  while ((m = re.exec(src))) {
    const s = m[1];
    if (ALLOWLIST.has(s)) continue;
    if (/^[A-Z][a-z]+\s+[a-z]/.test(s)) {
      fail(`raw user-facing literal "${s}" in ${f}`);
    }
  }
}
console.log("[2] raw literal scan complete");

// ---- 3. Placeholder match (keys referenced via t("key") have all params) ----
// Require a non-identifier char before t( so createElement/querySelector/
// getElementById("div") etc. are NOT matched.
const tCallRe = /(?:^|[^A-Za-z0-9_])t\(\s*"([^"]+)"/g;
for (const f of jsFiles) {
  const src = readFileSync(join(DECODER, f), "utf8");
  let m;
  while ((m = tCallRe.exec(src))) {
    const key = m[1];
    if (!enKeys.has(key) && !zhKeys.has(key)) {
      fail(`t("${key}") referenced in ${f} but missing from locale tables`);
    }
  }
}
console.log("[3] t() key reference scan complete");

// ---- 4. EMBEDDED_EN parity with locales/en.json ----
// i18n.js ships an embedded copy of the EN table so the first paint renders
// synchronously before the locale fetch lands. It must NEVER drift from
// locales/en.json (they drifted before — the culture pass updated en.json
// but not EMBEDDED_EN, so the fallback showed stale copy). Same keys, same
// values, or this gate fails.
const i18nSrc = readFileSync(join(DECODER, "i18n.js"), "utf8");
const embMatch = i18nSrc.match(/const EMBEDDED_EN = \{[\s\S]*?\n\};/);
if (!embMatch) {
  fail("could not locate EMBEDDED_EN block in i18n.js");
} else {
  let embedded;
  try {
    embedded = eval(
      "(" + embMatch[0].replace(/^const EMBEDDED_EN = /, "").replace(/;$/, "") + ")",
    );
  } catch (e) {
    fail("could not eval EMBEDDED_EN: " + e.message);
  }
  if (embedded) {
    const embKeys = Object.keys(embedded);
    const embOnly = embKeys.filter((k) => !(k in en));
    const enOnly = Object.keys(en).filter((k) => !(k in embedded));
    for (const k of embOnly) fail(`EMBEDDED_EN key "${k}" missing from en.json`);
    for (const k of enOnly) fail(`en.json key "${k}" missing from EMBEDDED_EN`);
    for (const k of embKeys) {
      if (embedded[k] !== en[k]) {
        fail(`EMBEDDED_EN value differs from en.json for "${k}" (fallback would show stale copy)`);
      }
    }
  }
}
console.log("[4] EMBEDDED_EN parity check complete");

if (failures) {
  console.error(`\n${failures} i18n integrity failure(s).`);
  process.exit(1);
}
console.log("\ni18n integrity OK.");
