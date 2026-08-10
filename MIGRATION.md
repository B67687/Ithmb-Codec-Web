# MIGRATION — JavaScript → TypeScript (minimal build pipeline)

Status: applied and committed. Post-migration evolution: the generated `.js`
build outputs are **no longer tracked** (see "Cloudflare Pages" below); the
`.ts` sources are the tracked artifacts and CI builds before serving.

## What changed

All hand-written site JavaScript is now typed TypeScript source, built by
**esbuild** back to the **same public `.js` paths and filenames** the HTML
already references. Zero public URL / behavior / HTML / test changes.

| Path | Was | Now |
|------|-----|-----|
| `ithmb-decoder/*.js` (13 hand-written modules) | JS (ES modules) | `ithmb-decoder/*.ts` source, built → same `ithmb-decoder/*.js` |
| `nav.js`, `footer.js`, `lang-redirect.js` | JS (classic scripts) | `nav.ts`, `footer.ts`, `lang-redirect.ts` source, built → same `.js` |
| `ithmb-decoder/ithmb_wasm.js` + `ithmb_wasm_bg.js` | generated (wasm-pack) | **untouched**; typed via `ithmb-decoder/ithmb_wasm.d.ts` |

## Build layout

- **Bundler**: `esbuild` (zero-config, fast, output is byte-stable per file).
- **Mode**: transform-only per file (`bundle: false`). The site already uses
  native browser ES-module loading (`<script type="module">`); bundling would
  inline shared modules and change the served tree. Transform-only preserves
  the exact module graph, import specifiers (`./ui.js` etc.), and classic-script
  globals (`nav`, `footer`, `lang-redirect`).
- **Entry points**: every hand-written `.ts` is an entry point, so every
  previously-served `.js` keeps existing at the same path.
  - `ithmb-decoder/*.ts` → `format: esm`, `target: es2022`, outdir `ithmb-decoder/`
  - `nav.ts`, `footer.ts`, `lang-redirect.ts` → `format: iife`, `target: es2022`, outdir `.`
- **Output lands in-place** (no `dist/`): `npm run build` overwrites the `.js`
  files at their existing paths. Those generated `.js` outputs are **gitignored**
  (see `.gitignore` → "Generated build outputs"); the `.ts` sources are the
  tracked artifacts, and CI runs `npm run build` before serving/tests.
- **Generated wasm glue** is never an input or output of the build; it is only
  imported (`./ithmb_wasm.js`) and typed by `ithmb_wasm.d.ts`.

## Scripts (package.json)

| Script | Command | Replaces |
|--------|---------|----------|
| `build` | `node scripts/build.mts` | — (new) |
| `typecheck` | `tsc --noEmit` | — (new) |
| `lint:modules` | `npm run typecheck && npm run build` | the old acorn `ithmb-decoder/*.js` syntax gate (sources are now `.ts`) |
| `ci` | `lint:modules && lint:i18n && playwright test` | unchanged (now runs build + typecheck first) |

`lint:i18n` (`scripts/check-i18n.mts`) now scans the `.ts` sources instead of
the (deleted) `.js` sources; `scripts/sync-embedded.mts` regenerates
`EMBEDDED_EN` in `i18n.ts`.

## TypeScript strictness

`tsc --noEmit` with `strict: true` (`strictNullChecks`, no implicit `any`, …)
plus `isolatedModules` and `noUnusedLocals`. Pragmatic exceptions:

- DOM lookups for elements the HTML guarantees are present use non-null
  assertions (`document.getElementById("toast")!`) — the original code
  dereferenced them unconditionally.
- Legacy globals are typed precisely (no `any`): `window.t` / `window.setLang` /
  `window.I18N` (set by `i18n.js`, read by classic scripts) are declared in
  `globals.d.ts`.
- The wasm boundary is fully typed in `ithmb-decoder/ithmb_wasm.d.ts`
  (`decode_ithmb(bytes: Uint8Array): Uint8Array | undefined`, `peek_prefix`,
  `get_encoding_name`, `init`, `initSync`).

## Cloudflare Pages

The site is served as committed static assets, but the build outputs are no
longer committed. Pages must build from source:

- **Build command**: `npm run build`
- **Output directory**: `.` (the build writes each `.js` to its existing
  public path — do NOT use a `dist/` output, that would change every URL).

CI mirrors this model: every test job runs `npm run build` before starting the
local server, so the committed `.ts` sources are what is actually validated.

## Verification gates

- `npm run build` → exit 0, `.js` at identical public paths
- `npx tsc --noEmit` → exit 0
- `npm run lint:i18n` → passes
- `npx --yes http-server -p 8899 -c-1 -s` + `BASE_URL=http://localhost:8899
  npx playwright test --project=chromium` → full suite green
- `ithmb_wasm.js` / `ithmb_wasm_bg.js` untouched (`git status` clean for them)
