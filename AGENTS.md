# AGENTS.md — AI Agent Guide for Ithmb-Codec-Web

This file tells AI coding agents (Claude Code, Copilot, Cursor, Codex, OpenCode) how to work with this repository. Read this first before editing any code.

## Repository Purpose

The browser front-end for the ITHMB Codec project: a **zero-runtime-dependency** vanilla-JS decoder web app (`ithmb-codec.dev`) plus a **Cloudflare telemetry worker** that collects opt-in share/report data. Decoding itself happens in WebAssembly (`ithmb_wasm_bg.wasm`) generated from the sibling Rust repo `B67687/Ithmb-Codec` (`crates/ithmb-wasm`). This repo also hosts the marketing pages (home, guide, enterprise, 404) and is fully i18n'd (Simplified Chinese + English).

## Repository Layout

```
Ithmb-Codec-Web/
├── ithmb-decoder/           # The decoder SPA (all vanilla ES modules, no deps)
│   ├── app.js               # Init, keyboard, dropzone wiring, languagechange handler
│   ├── ui.js                # File cards, processFiles (batch/dedup), filmstrip
│   ├── decoder.js           # decodeFile: wasm call, success/failure dispatch
│   ├── cards.js             # Single owner of decode-result lists (add/query/reset)
│   ├── card-success-ui.js   # Success card render + reRenderCards (language switch)
│   ├── card-failure-ui.js   # Failed/unknown card render
│   ├── share-actions.js     # Share box + shared report modal (backdrop bound once)
│   ├── telemetry.js         # POST to the worker (payload-aware timeout)
│   ├── viewer.js            # Fullscreen viewer, stage, toolbar, download
│   ├── download.js          # Download All ZIP (entry-name sanitized + deduped)
│   ├── i18n.js              # en/zh tables, EMBEDDED_EN fallback, setLang/applyTranslations
│   ├── state.js             # S singleton + dedup Sets (decode lists live in cards.js)
│   ├── utils.js             # formatSize, showToast, escapeHtml, bytesToHex/Base64
│   ├── index.html           # Decoder page markup (viewToggleBtn has NO data-i18n — state-derived)
│   ├── locales/{en,zh}.json # Translation tables (flat keys)
│   ├── ithmb_wasm.js        # HAND-ADAPTED loader (streaming instantiation) — do NOT replace
│   ├── ithmb_wasm_bg.js     # GENERATED wasm-bindgen glue (reformatted) — pairs with the loader
│   └── ithmb_wasm_bg.wasm   # GENERATED decoder binary — copied from Ithmb-Codec
├── workers/telemetry/       # Cloudflare Worker (see its README for deploy)
│   ├── src/worker.js        # POST /api/share + batch, JSON /, HTML /dashboard (ADMIN_TOKEN)
│   └── wrangler.toml        # KV binding; ADMIN_TOKEN is set in the CF dashboard, NEVER here
├── scripts/
│   ├── check-i18n.mjs       # i18n integrity gate (key parity, raw literals, EMBEDDED_EN drift)
│   ├── sync-embedded.mjs    # Regenerates EMBEDDED_EN in i18n.js from en.json (run after locale edits)
│   ├── check-wasm-drift.sh  # Verifies committed wasm imports are all handled by the loader glue
│   └── real-user-journey.js # Manual smoke script
├── tests/                   # Playwright specs (see test scripts in package.json)
├── index.html               # Home page (og:title/og:description localized via data-i18n-content)
├── footer.js                # Shared footer — renders ONLY after window.t exists (no raw-key flash)
└── package.json             # Zero runtime deps; dev deps: @playwright/test, acorn
```

## Quick Start (build / test / lint)

```bash
npm ci                                  # install dev deps
npm run lint:modules                    # acorn ES-module parse of every ithmb-decoder/*.js
npm run lint:i18n                       # i18n integrity gate (must pass after any locale/i18n change)
bash scripts/check-wasm-drift.sh        # committed wasm vs loader glue (run after wasm updates)

# Local dev server (serves /ithmb-decoder/ + pages)
python3 -m http.server 8899

# Tests — ALWAYS point BASE_URL at the local server, never the live site
BASE_URL=http://localhost:8899 npm run test:quick      # 101 tests, chromium, ~17s
BASE_URL=http://localhost:8899 npm run test:full       # all projects — NOTE: webkit is NOT
                                                       # installable in this env; chromium+firefox pass
```

**After editing `locales/*.json`:** run `npm run sync:i18n` (regenerates `EMBEDDED_EN` in i18n.js) then `npm run lint:i18n`. Committing a locale edit without the sync fails the gate.

## Pre-commit (wire once per clone)

The repo ships a `.husky/pre-commit` (i18n gate + wasm drift + 3 smoke specs against a LOCAL server — `BASE_URL` is forced to `localhost` so it never tests production). It is a plain script, NOT the husky package. Activate it:

```bash
git config core.hooksPath .husky
```

(A fresh clone does NOT run it until this is set — this is a known gap, kept manual to stay dependency-free.)

## Dev / Public Dual-Repo Workflow (CRITICAL)

**Canonical standard: `docs/standards/RELEASE_WORKFLOW.md` in the Rust repo** (https://github.com/B67687/Ithmb-Codec/blob/main/docs/standards/RELEASE_WORKFLOW.md) — this section is a summary; the standard is the source of truth.

There are TWO remotes and they are NOT interchangeable:

```
origin  → https://github.com/B67687/Ithmb-Codec-Web-Dev   (PRIVATE — editing repo, CI billing-blocked)
public  → https://github.com/B67687/Ithmb-Codec-Web       (PUBLIC — shipped repo, FREE CI, live site)
```

- **All work happens on `main` (dev) first** → push to `origin/main`.
- **Squash-work branch** (`squash-work`, tracks `public/main`) is where public commits are built: `git cherry-pick -n <dev-commits>` into 1-3 **thematic** squashed commits, verify `git diff --quiet <dev-head> squash-work` shows identical trees, then `git push public squash-work:main`.
- **Public CI is the gate.** The dev repo's Actions are blocked by the account's paid-minute billing state (private repos need paid minutes); the PUBLIC repo runs the same workflows for free. A red dev CI is cosmetic — check the public repo's run.
- Version bumps + CHANGELOG entries are added on dev and ride the squash.

## WASM Regeneration (the fragile part)

The decoder wasm comes from `B67687/Ithmb-Codec` → `crates/ithmb-wasm`. To ship a core change to the browser:

```bash
cd ../Ithmb-Codec/crates/ithmb-wasm
cargo check -p ithmb-wasm --target wasm32-unknown-unknown
wasm-pack build --target web --release
cp pkg/ithmb_wasm_bg.wasm ../../Ithmb-Codec-Web/ithmb-decoder/ithmb_wasm_bg.wasm
```

**Copy ONLY `ithmb_wasm_bg.wasm`.** `ithmb_wasm.js` is hand-adapted (custom streaming loader, `__wbindgen_start` call) and `ithmb_wasm_bg.js` is the reformatted glue — replacing them with stock wasm-pack output breaks the app. **If the rebuild adds a wasm import the glue doesn't define, the decoder fails at runtime** — `scripts/check-wasm-drift.sh` detects exactly this (it compares the wasm's import list against the glue). Example of a forbidden import: `console_error_panic_hook`'s `__wbg_new_...` (js_sys::Error glue) — a panic hook using it broke the loader once; don't reintroduce it.

## Deploy

- **Site (ithmb-codec.dev):** Cloudflare Pages, connected to the PUBLIC repo's `main` branch. Push to public → auto-deploy (~1-2 min). No workflow file involved.
- **Telemetry worker:** `workers/telemetry/` — see `workers/telemetry/README.md` for `wrangler deploy`, secrets (`ADMIN_TOKEN` set in the CF dashboard, never committed), and the KV/rate-limit/record schema. Local testing: `wrangler dev` against `workers/telemetry/.wrangler/` miniflare state.

## Security Posture

- **Telemetry privacy:** fingerprints are SHA-256(IP:UA) truncated to 8 bytes; per-IP rate/record keys hash the IP alone — the raw IP is never stored. `full_file` (opt-in, ≤8 MiB base64) is validated and stored under separate `fullfile_` keys; records are slim.
- **Worker hardening (2026-08 audit, all fixed):** stored-XSS blocked (every dashboard field escaped + CSP `default-src 'none'` + nosniff), race-free list-based rate/record caps, byte-accurate body cap, Bearer-only constant-time dashboard auth (`?token=` removed).
- **`ADMIN_TOKEN` is dashboard-managed** — never commit it, never put it in `wrangler.toml`, never reference it in tests.
- Both repos' histories are secrets-clean; a gitleaks job runs in CI.

## Conventions

- **Zero runtime dependencies** — vanilla ES modules only. Adding a runtime dep requires strong justification.
- `data-i18n` / `data-i18n-html` / `data-i18n-aria-label` / `data-i18n-content` for translatable surface; `t(key, params)` params are HTML-escaped.
- Every innerHTML sink escapes its input (`escapeHtml`) or interpolates only numbers/static i18n/hex.
- **Bugfix discipline:** fix minimally; the wasm loader + glue are a hand-adapted contract — never bulk-replace them.
- Do NOT add `Co-authored-by`/attribution lines to commits.

## Release Process (checklist)

1. Bump `package.json` version + add a CHANGELOG entry (`## X.Y.Z — date`, Keep-a-Changelog style).
2. Commit to dev `main`, run the full local gate (`lint:modules` + `lint:i18n` + `test:quick`).
3. Push `origin/main` (dev).
4. Squash thematically onto `squash-work`, verify trees identical, push `public squash-work:main`.
5. Cloudflare Pages auto-deploys; verify the live site (og tags, decoder load, no console errors).

## What NOT to Do

- Do NOT commit to `squash-work` directly (it's the public mirror — build it via cherry-pick from dev).
- Do NOT edit `locales/*.json` without running `sync:i18n`.
- Do NOT copy stock wasm-pack output over `ithmb_wasm.js` / `ithmb_wasm_bg.js`.
- Do NOT add a wasm import that the loader glue doesn't provide (check-wasm-drift.sh enforces).
- Do NOT run Playwright against `https://ithmb-codec.dev` during local dev/tests — always set `BASE_URL`.
