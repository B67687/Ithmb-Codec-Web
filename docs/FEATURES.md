# ITHMB Codec Web — Feature Inventory & Architecture

> Updated: 2026-08-06 (1.4.16: server-rendered /zh/ tree, language-preference redirect, plain-link switcher, cross-tab sync removed)
> Purpose: Authoritative, current source of truth for features + the architecture that serves them.
> **Keep this file in sync with every behavior change.** A stale spec is how bugs look like features.

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Shared Components](#2-shared-components)
3. [Home Page](#3-home-page)
4. [Decoder Page](#4-decoder-page)
5. [Guide Page](#5-guide-page)
6. [Enterprise Page](#6-enterprise-page)
7. [Internal JS Behaviors](#7-internal-js-behaviors)
8. [i18n Architecture](#8-i18n-architecture)
9. [CSS Design System](#9-css-design-system)
10. [Telemetry Worker](#10-telemetry-worker)
11. [Testing, CI & Deployment](#11-testing-ci--deployment)
12. [Meta-Architecture: Known Seams](#12-meta-architecture-known-seams)

---

## 1. Architecture Overview

### File Structure

```
ithmb-codec-web/
├── index.html                         # Home page (entry)
├── nav.js                             # Shared navigation (IIFE, insertAdjacentHTML)
├── footer.js                          # Shared footer (IIFE — renders ONLY after window.t exists, no raw-key flash)
├── lang-redirect.js                   # Pre-paint locale redirect (stored pref / zh browser → /zh/ counterpart)
├── bmc-icon.svg / favicon.svg / thumb-decoder-preview.png
├── CNAME                              # Custom domain: ithmb-codec.dev
├── package.json                       # Zero runtime deps; dev: @playwright/test, playwright, acorn, @axe-core/playwright
├── playwright.config.js               # 3 projects (chromium, firefox, webkit); baseURL = BASE_URL || live site
├── AGENTS.md                          # Agent onboarding (build/test/deploy/wasm-regen/dev-public workflow)
│
├── ithmb-decoder/                     # Core web app (decoder)
│   ├── index.html                     # Decoder page (entry)
│   ├── styles.css                     # Shared CSS (all pages)
│   ├── app.js                         # Main entry (ES module, top-level await, retry on wasm init failure)
│   ├── decoder.js                     # decodeFile: wasm call → success/failure dispatch (error cards NOT persisted)
│   ├── viewer.js                      # Viewer + toolbar (updateToolbar derives state-dependent labels)
│   ├── state.js                       # S singleton + shared arrays
│   ├── ui.js                          # processFiles, file cards, batch/dedup
│   ├── utils.js                       # bytesToHex/Base64, formatSize, showToast (timer reset), escapeHtml
│   ├── input.js                       # Hold-to-repeat (400ms grace → 30ms interval)
│   ├── telemetry.js                   # submitTelemetry (payload-aware timeout: 8s + 1s/MiB, cap 30s)
│   ├── download.js                    # Download All ZIP (entry names sanitized + deduped)
│   ├── i18n.js                        # en/zh tables, EMBEDDED_EN fallback, setLang, languagechange event
│   ├── share-actions.js               # Share box + SHARED report modal (#reportModal, backdrop bound once)
│   ├── card-success-ui.js             # Success card: info panel + report link (no share box)
│   ├── cards.js                        # SINGLE OWNER of decode-result lists (addSuccess/addFailure/reset/query)
│   ├── locales/{en,zh}.json           # Translation tables (flat keys; sync-embedded.mjs regenerates EMBEDDED_EN)
│   ├── ithmb_wasm.js                  # HAND-ADAPTED loader (streaming instantiation) — do NOT replace
│   ├── ithmb_wasm_bg.js               # GENERATED wasm-bindgen glue (reformatted) — pairs with the loader
│   └── ithmb_wasm_bg.wasm             # GENERATED decoder binary (~194 KB) — copied from Ithmb-Codec
│
├── guide/how-to-open-ithmb-files.html # Documentation page
├── enterprise/index.html              # Enterprise marketing page
├── workers/telemetry/                 # Cloudflare Worker (see its README for deploy)
│   ├── src/worker.js                  # POST share/batch, JSON /, HTML /dashboard; hardening C2–C6
│   └── wrangler.toml                  # KV binding; ADMIN_TOKEN is set in the CF dashboard, NEVER here
├── scripts/
│   ├── check-i18n.mjs                 # i18n integrity gate (key parity, raw literals, EMBEDDED_EN drift)
│   ├── sync-embedded.mjs              # Regenerates EMBEDDED_EN in i18n.js from en.json
│   ├── check-wasm-drift.sh            # Committed wasm imports must all be handled by the loader glue
│   └── real-user-journey.js           # Manual smoke script
├── tests/                             # Playwright specs (see §11)
└── docs/FEATURES.md                   # THIS FILE
```

### Page Matrix

| Page       | Route                            | Purpose        | Type                         | JS Required |
| ---------- | -------------------------------- | -------------- | ---------------------------- | ----------- |
| Home       | `/`                              | Landing page   | Static + CSS                 | nav.js, footer.js, lang-redirect.js |
| Decoder    | `/ithmb-decoder/`                | Core web app   | Full SPA (ES modules + WASM) | nav.js, footer.js, app.js (14 modules), lang-redirect.js |
| Guide      | `/guide/how-to-open-ithmb-files.html` | Documentation | Static + CSS                 | nav.js, footer.js, lang-redirect.js |
| Enterprise | `/enterprise/`                   | Marketing page | Static + CSS                 | nav.js, footer.js, lang-redirect.js |

### Dependency Direction (module graph)

```
app.js ──→ viewer.js ──→ state.js
   │            │
   ├── ui.js ───┘
   └── decoder.js ←── state.js (S, arrays, Set)
         │
         └── utils.js (size, toast, hex, escape)
share-actions.js ──→ telemetry.js ──→ state.js (TELEMETRY_URL)
card-success-ui.js / card-failure-ui.js ──→ share-actions.js + telemetry.js
i18n.js ──(languagechange event, no imports)──→ consumed by every module
```

i18n.js is dependency-free: other modules import `{ t }` from it; re-renders are driven by the `languagechange` DOM event it dispatches.

---

## 2. Shared Components

### 2.1 Navigation Bar (`nav.js`)

IIFE injected as first child of `<body>` via `insertAdjacentHTML`. Fixed top nav (44px, backdrop blur), brand left, 3 links center (Home/Decoder/Guide; Enterprise lives in the footer), icons right (language switcher + BMC + GitHub corner). Active link from `window.location.pathname` (the `/zh/` prefix is stripped first so the same rules apply on Chinese pages).

The language switcher (`#langToggle`) is a plain `<a>` link to the counterpart page in the other locale (EN ↔ /zh/ tree, server-rendered and indexable), not an in-page toggle. Its click handler writes the target language to `localStorage ithmbLang` before navigating; that click is the only writer of the language preference. On `/zh/` pages the nav labels and the switcher aria-label/title are emitted inline in Chinese (首页 / 解码器 / 指南 / 切换语言, matching zh.json's `nav.*` keys), because nav.js runs before i18n.js; the `data-i18n` attributes stay so i18n re-applies the authoritative text on activation.

### 2.2 Footer (`footer.js`)

IIFE injected at the script position. GitHub icon + "Powered by Ithmb-Codec" + Buy me a coffee. **Renders only after `window.t` exists** — no raw-key flash on pages where i18n loads late (re-renders via interval once ready).

### 2.3 Static Assets

`/bmc-icon.svg`, `/favicon.svg`, `/thumb-decoder-preview.png` (og:image).

---

## 3. Home Page

**Route:** `/` · **File:** `index.html`

- **Meta:** title "ITHMB Codec", canonical, OG image, favicon, Inter fonts, FAQPage + WebApplication JSON-LD. **og:title / og:description localized** via `data-i18n-content` (follow the active language).
- **Visual:** logo, subtitle, three cards (Decoder/Guide/Enterprise) with hover states.
- **Responsive:** 768px / 480px breakpoints.

---

## 4. Decoder Page

**Route:** `/ithmb-decoder/` · **File:** `ithmb-decoder/index.html`

### 4.1 Meta

Title "ITHMB Decoder | ITHMB Codec", canonical, JSZip 3.10.1 (cdnjs, with SRI), entry `app.js` (ES module, top-level await).

### 4.2 Visual Components

| Component | ID/Class | Status | Key Behavior |
| --------- | -------- | ------ | ------------ |
| Drop overlay | `#dropOverlay` | hidden | Shown on dragenter, hidden on dragleave/drop |
| Dropzone | `#dropzone` | visible | Click → file picker; drag-over adds `.drag-over` |
| Toolbar | `#toolbar` | hidden init | Shown when files loaded |
| Help button | `#helpBtn` | hidden init | Keyboard-shortcut toast |
| Viewer nav | `#viewerNav` | hidden init | Prev/Next + position ("3/8"); hold-to-repeat |
| Grid toggle | `#viewToggleBtn` | hidden init | **Label derived from viewer state in `updateToolbar()`** (no data-i18n): "Grid view" (viewer open) / "Gallery" (grid). Correct on first render in any language. |
| Download All | `#downloadAllBtn` | hidden init | JSZip ZIP; label/title show format |
| Format select | `#downloadFormatSelect` | hidden init | **Global-only** (ZIP); per-card selects stay independent via `S.cardFormats` |
| Viewer container | `#viewer-container` | hidden init | Bordered card: header + stage + filmstrip |
| Viewer header | `#viewer-header` | 3-col | Encoding \| Filename \| Dimensions |
| Viewer stage | `#viewer-stage` | centered | Canvas or placeholder (success/failed/decoding) |
| Viewer arrows | `#viewerArrowLeft/Right` | absolute | Hold-to-repeat; hidden on mobile |
| Filmstrip | `#viewer-filmstrip` | h-scroll | 80×60 thumbs, active accent, click to navigate |
| File list | `#file-list` | dynamic | Grid (auto-fill) or viewer-mode (flex column) |
| File card | `.file-card` | dynamic | Meta + status + preview + (success: info/save/report) or (failure: share box) |
| Back-to-top / position | `#backToTop` / `#backToPosition` | hidden | Scroll-aware; save/restore position |
| Toast | `#toast` | hidden | 3s auto-hide; **timer resets on each new toast** |
| Report modal | `#reportModal` | hidden | **Shared modal** for "Image looks wrong?" — thumbnail + issue picker + submit/cancel; backdrop listener bound ONCE |

### 4.3 Decoder App States

| State | How It Looks | Trigger |
| ----- | ------------ | ------- |
| Initial | Header + dropzone only | Page load |
| Processing | Cards with spinner + "Decoding…" | Files selected |
| Decode success | Canvas + green "Decoded" + Save + format select + **report link** (no share box) | WASM decode succeeds |
| Decode failure | Share box (hex dump + Share 16 bytes / full file) | Known format fails |
| Decode unknown | Share box with "Unknown format" note | Unrecognized prefix |
| Decode error | Red "Error" + message | Decode throws (no share box, not persisted) |
| Viewer open | Toolbar + viewer (canvas/filmstrip/arrows) | Card click / auto-open on first batch |
| Grid mode | Cards in 2D grid, viewer hidden | Toggle or G key |
| Load failed | Red message + **Retry button** (re-runs wasm init; recovers from transient fetch failures) | `init()` throws |

---

## 5. Guide Page

**Route:** `/guide/how-to-open-ithmb-files.html` · Static documentation (title, canonical, Article JSON-LD, sections: What Is / How to Use / Why Use / About / FAQ / privacy bullet). **Tests target the `.html` URL** (the extensionless path only resolves on Python 3.14+).

## 6. Enterprise Page

**Route:** `/enterprise/` · Marketing page with its own design system (hardcoded colors, not CSS variables — an "under consideration" construction page). Hero, differentiators, comparison table, pricing, FAQ.

---

## 7. Internal JS Behaviors

### 7.1 State Management (`state.js`)

**Mutable state object `S`:** `cardCount`, `globalCardIdCounter`, `viewerIndex`, `totalFiles`, `downloadFormat`, `cardFormats`, `lastTarget`.

**Decode-result lists — owned by `cards.js` (single owner; writes via addSuccess/addFailure/resetCards, reads via successCards()/failedCards()/findSuccess()/findFailure()/successCount() — read accessors return copies so callers can't mutate):**
- success list — `{cardId, canvas, fileName, bytes, prefix, fileSize, width, height}[]` (entries always carry `bytes`)
- failure list — `{cardId, bytes, prefix, fileName, fileSize}[]` — **error cards are never stored** (no shareable bytes)

**Other module-level collections (still in state.js):**
- `processedFileIds` — Set, re-upload dedup (content hash + filename)
- `sharedSubmissionIds` — Set, share/report dedup across re-renders (survives language-switch card rebuilds)

**Constants:** `TELEMETRY_URL`, `KNOWN_PREFIXES`.

### 7.2 File Drop/Upload Flow

1. Drop or click → `processFiles(files)`.
2. First batch: full reset (`fileList`, counters, arrays, filmstrip, viewer closed).
3. Filter: `.ithmb`/`.ipm` extension, ≤ 8 MB, content-hash dedup. Rejects → toast.
4. Card per valid file → `decodeFile(file, cardId)` async.
5. After each batch: `updateToolbar()` (also derives the toggle label).

### 7.3 Decode Pipeline (`decodeFile`)

1. Read → Uint8Array → `peek_prefix(bytes)` → `decode_ithmb(bytes)`.
2. Success → canvas (600×400 max) → success card (renderSuccessCard: info panel + report link; pushes successfulDecodes; filmstrip; refreshViewerIfCurrent).
3. Failure (known/unknown) → failure card (share box + report link; pushes failedDecodes).
4. **Error (throws)** → error card (message only) — **NOT pushed to failedDecodes** (would break re-render's share-box creation).
5. `updateToolbar()`.

### 7.4 Viewer

- Open on card click / first-batch auto-open; cyclic prev/next; ← → arrows + G key + Escape; touch swipe > 50px; filmstrip click.
- **Stage mirrors the card** via `refreshViewerIfCurrent` — success cards get a report link, failed cards get their share box inside the placeholder. One mechanism, no surgical duplicate paths.
- Toolbar via `updateToolbar()` (called on open/close/process/languagechange).

### 7.5 Share / Report (quiet-by-default, opt-in only)

- **Failure/unknown cards:** share box = hex dump (first 16 bytes) + "Share 16 bytes" + "Share full file" (hidden above 8 MB). Header share POSTs `{prefix, fileSize, status, header}` → "Shared ✓" + disabled (full-file button stays enabled for upgrade). Full-file POSTs + base64 → both disabled. Per-card dedup keys, `sharedSubmissionIds` dedup across re-renders. **Server rejection → honest failure toast + button rollback (re-queries live buttons — a mid-POST language switch can't strand the UI).**
- **Success cards:** report link "Image looks wrong?" opens the **shared report modal** (`#reportModal`) — thumbnail, issue-type picker (6 types), free-text detail, submit/cancel. Submit POSTs with `issue`/`issue_detail`. Backdrop click closes (listener bound once). Cancel closes without sending.
- **Nothing is ever sent automatically** — no batch mode, no background sends.

### 7.6 Download All

JSZip from all successful canvases; JPEG 92% (default) / PNG / BMP / WebP; global format select affects only the ZIP (per-card `S.cardFormats` override); entry names sanitized (`[\\/]` → `_`, leading dots stripped) + deduped (no silent overwrite); filename `ithmb-pictures-converted-to-{format}.zip`.

### 7.7 Toast

`showToast(msg)` — role=status, aria-live=polite, 3s hide **with timer reset** (rapid messages don't cut each other short).

### 7.8 WASM Load-Failure Retry

`init()` throws → red message + Retry button. Retry re-runs `init()`: transient failures recover in place, permanent failures re-enable the button. Dropzone disabled during failure state.

---

## 8. i18n Architecture

**Two mechanisms, deliberately split:**

1. **Declarative (`data-i18n` / `data-i18n-html` / `data-i18n-aria-label` / `data-i18n-content`)** — applied by `applyTranslations()` on every element at language activation. Used for static, state-independent text.
2. **Derived (`t(key, params)` in JS)** — for text that depends on runtime state. **The rule: state-derived text must be re-derived at every state change, in the function that owns that state** (e.g. `updateToolbar()` derives the toggle label + Download All label). This is the unified pattern that fixed the toggle-in-Chinese-default bug — never patch derived text only on `languagechange`, because that event fires from i18n.js's module top-level **before** consumer modules have loaded their listeners.

- `t(key, params)` params are **HTML-escaped** (future-proofs `data-i18n-html`).
- `EMBEDDED_EN` (in i18n.js) is **generated** from `locales/en.json` by `scripts/sync-embedded.mjs` — the offline fallback + EN baseline. `scripts/check-i18n.mjs` gates key parity / raw literals / drift (runs in pre-commit + CI).
- **Language resolution:** the server-rendered `<html lang>` attribute is authoritative (`forcedLang()` in i18n.js): every page declares `lang="en"` or `lang="zh-CN"`, so the URL decides the page language and there is no `?lang=` scheme. The stored preference (`localStorage ithmbLang`) and `navigator.language` no longer swap text in place; they drive the pre-paint redirect below.
- Re-render on languagechange (in-page `setLang()` / locale activation): `reRenderCards` (success info panels + failure share boxes) + in-progress "Decoding…" placeholders + `updateToolbar()` + viewer-stage rebuild when open. User-facing switching is now a full navigation between server-rendered pages (the switcher is a link), so this path fires on locale activation rather than on user clicks.

### Language-Preference Redirect (`lang-redirect.js`)

Synchronous classic script loaded in `<head>` of all 8 content pages (4 EN + 4 zh, not 404.html) after the CSP meta, so it runs before first paint. It reads `localStorage ithmbLang`; when the stored preference differs from the current page's language it `location.replace()`s to the counterpart URL in the preferred language. With no stored preference, a zh `navigator.language` (starts with "zh") on an EN page redirects to the `/zh/` counterpart, so zh users land on the Chinese site by default. A `/zh/` page is never redirected to English (no bounce loop); unmapped paths (e.g. `/404.html`) are untouched; targets are relative (no hardcoded domain), so it works on local dev servers too. `location.replace()` keeps the redirect out of history. Language "detection" is now a server-visible redirect between pre-rendered pages, not a client-side text swap.

The preference is written in exactly one place: the language switcher's click handler in nav.js, before it navigates to the counterpart page. i18n.js's `setLang()` can also persist, but that path is only reachable on a page without a declared `<html lang>`, which no shipped page has.

### No-Flash Init on Forced-Language Pages

When `forcedLang()` is set (always, on shipped pages), i18n.js init sets `I18N.lang` to the forced language WITHOUT applying `EMBEDDED_EN` over the server-rendered text, then fetches the locale JSON and activates the merged table when it lands. The served HTML is already in the correct language, so a refreshed `/zh/` page never flashes English while the fetch is in flight. Only when no `<html lang>` is declared does init fall back to `detectLang()` (localStorage → navigator → en) rendered from embedded defaults. EN pages are unchanged: their server HTML is English, matching the embedded baseline.

---

## 9. CSS Design System

CSS custom properties (`--bg #f5f5f7`, `--surface #fff`, `--border`, `--text`, `--muted`, `--accent #007AFF`, `--accent-hover`, `--success`, `--warn`, `--radius 12px`, `--shadow`, `--card-bg`). Component catalog: buttons (`.btn` family), dropzone, file cards, statuses (`.ok/.err/.unknown/.loading` + spinner), viewer, filmstrip, toolbar, toast, drop overlay, GitHub/BMC corners, back-to-top, share box, report link, viewer header, footer, `:focus-visible` outlines. Animations: `spin` (0.6s), `placeholder-spin` (0.8s). Breakpoints 768px / 480px. Home/Guide/Enterprise use inline page styles. **Dark mode is intentionally not supported** (light-first Apple design language; declined 2026-08-06 to avoid a second full design surface for a low-value QoL).

---

## 10. Telemetry Worker

See `workers/telemetry/README.md` for the full reference. Summary of the CURRENT (hardened) design:

| Aspect | Detail |
| ------ | ------ |
| Routes | `POST /` (single + `batch:true`), `GET /` public JSON (prefix counts from **key names only**, zero value fetches), `GET /dashboard` (Bearer auth, HTML, **bounded scan ≤ 5000 slim records**), `OPTIONS` CORS |
| Records | Slim `fmt_<prefix>_<uuid>` (no full-file inline); payloads under separate `fullfile_<uuid>` keys; `hasFullFile` flag; 365d TTL |
| Privacy | fingerprints SHA-256(IP:UA) truncated 8 bytes; **per-IP keys hash the IP alone — raw IP never stored** |
| Rate/caps | **Self-correcting list-based counters (a concurrent burst can overshoot by up to in-flight concurrency)** (day-scoped marker keys, `crypto.randomUUID()`): 100 POSTs/day/fp, 500/day/ip, 50 records/day/fp, 250/day/ip; dedup 24h |
| Body/full_file | **Byte-accurate** body cap (13 MB UTF-8); full_file must be valid base64 ≤ 8 MB decoded (garbage rejected → null) |
| Auth | **`Authorization: Bearer <ADMIN_TOKEN>` only, constant-time** (`?token=` removed); dashboard sends `Cache-Control: no-store` + `Referrer-Policy: no-referrer` + CSP `default-src 'none'` + nosniff |
| Dashboard | Every field HTML-escaped (stored-XSS blocked); frame-ancestors 'none' |
| Deploy | `wrangler deploy`; ADMIN_TOKEN via CF dashboard, never in the repo |

Valid statuses: `success`, `known-failed`, `unknown`, `looks-good`, `looks-wrong`. Valid issues: `color_space`, `dimensions`, `stride`, `offset`, `byte_order`, `other`.

---

## 11. Testing, CI & Deployment

### 11.1 Playwright Suite

**Config:** 3 projects, baseURL = `BASE_URL` env **or** live site — **tests/hooks must always set `BASE_URL` to a local server** (never test production). `npm run test:quick` = 106 tests on chromium (pages, decoder, gallery, upload, quality, a11y, seo-metadata). `npm run test:full` = all projects — **webkit cannot run in this dev environment** (documented; chromium+firefox are the CI/local gate).

| File | Focus |
| ---- | ----- |
| `pages.spec.js` | Landing/enterprise/guide loads + critical elements |
| `ithmb-decoder.spec.js` | Structure/CSS: GitHub/BMC corners, toolbar, footer, CSS vars, no batch toggle |
| `gallery.spec.js` | Viewer mode: filmstrip, arrow/keyboard nav, Escape, G key, pixel content, mobile, download format, dedup |
| `stress.spec.js` | Full flows: invalid file, single/multi, filmstrip, cyclic arrows, grid toggle, dedup, back-to-top |
| `upload.spec.js` | Decode correctness: 8 distinct files, batch append, duplicate filenames |
| `quality.spec.js` | Share/report flows (header/full/dedup/upgrade/rollback), quiet-by-default, corrupt-file handling, viewer contextual share |
| `a11y.spec.js` | axe-core scans (5 pages) |
| `seo-metadata.spec.js` | Meta description (localized), language-preference redirect (7 tests), hreflang/canonical, CSP meta on every page |
| `visual.spec.js` | Visual snapshots (pages, nav, footer) |

### 11.2 Gates

- **Pre-commit** (`.husky/pre-commit`): i18n gate → wasm-drift check → 3 smoke specs against `BASE_URL=http://localhost:8899`. **Wire once per clone:** `git config core.hooksPath .husky`.
- **`npm run ci`**: lint:modules (acorn) + lint:i18n + full Playwright.
- **`npm run check:deps`**: npm audit (fails on vulns) + npm outdated (informational) — the local dependabot replacement.

### 11.3 CI (`.github/workflows/ci.yml`)

Runs on the **public repo** (free minutes; the private dev repo's Actions are billing-blocked). Jobs: lint (acorn + i18n + wasm-drift), test (chromium, `BASE_URL=http://localhost:8899`), secrets (gitleaks). SHA-pinned actions.

### 11.4 Dev/Public Workflow & Deploy

Canonical standard: `docs/standards/RELEASE_WORKFLOW.md` in the Rust repo. Summary:

- `origin` = `Ithmb-Codec-Web-Dev` (private, editing repo) · `public` = `Ithmb-Codec-Web` (public, live site).
- All work on dev `main` → squash thematically onto `squash-work` (tracks `public/main`) → verify trees identical → push `public squash-work:main`. **Public CI is the gate** (dev CI is billing-blocked).
- **Deploy: Cloudflare Pages** connected to the public repo's `main` branch — auto-deploys on push (~1-2 min). Telemetry worker deploys via `wrangler` from `workers/telemetry/`.
- **WASM regeneration** from `Ithmb-Codec/crates/ithmb-wasm` (wasm-pack) — copy ONLY `ithmb_wasm_bg.wasm`; the loader/glue are hand-adapted and must stay unchanged (`scripts/check-wasm-drift.sh` enforces import compatibility).

---

## 12. Meta-Architecture: Known Seams

Honest assessment of where the architecture is fragile — every past bug traces to one of these:

1. **i18n activation races consumer load** (fixed 1.4.7): i18n.js activates + dispatches at module top-level, before consumers' listeners exist. Mitigation: state-derived text re-derived at state changes (updateToolbar); never rely on the initial `languagechange` dispatch. **If a future element shows English on first load in a non-English default, this seam is why.**
2. **Re-render vs in-flight operations**: language-switch card rebuilds race decode/share POSTs. Each instance (share rollback, mid-decode placeholder, error cards) was fixed individually. The rule: **always re-query the DOM by cardId; never mutate captured refs across an await**.
3. **Shared mutable arrays** (`successfulDecodes`/`failedDecodes`) with multiple writers — no encapsulation or invariant enforcement. The duplicate `failedDecodes.length = 0` dead line (fixed 1.4.8) is the class of bug this permits.
4. **Two i18n mechanisms** (declarative vs derived) — the split is intentional, but a new string must pick the right one; the derived side must follow the updateToolbar pattern.
5. **`S.totalFiles` vs `S.cardCount`** — two counters for the card population; drift is possible (currently consistent).
6. **WASM/loader contract** — the hand-adapted loader is the single most fragile integration point; `check-wasm-drift.sh` + AGENTS.md document it, but any wasm-bindgen upgrade needs a manual glue review.

---

_End of Feature Inventory — keep current._
