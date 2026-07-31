# ITHMB Codec Web — Feature Inventory

> Updated: 2026-07-31 (quiet-by-default refactor, module split, worker fixes)
> Purpose: Authoritative, current source of truth for features. Prevents regressions during refactoring.

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Shared Components](#2-shared-components)
3. [Home Page](#3-home-page)
4. [Decoder Page](#4-decoder-page)
5. [Guide Page](#5-guide-page)
6. [Enterprise Page](#6-enterprise-page)
7. [Internal JS Behaviors](#7-internal-js-behaviors)
8. [CSS Design System](#8-css-design-system)
9. [Deployment & Testing Infra](#9-deployment--testing-infra)

---

## 1. Architecture Overview

### File Structure

```
ithmb-codec-web/
├── index.html                         # Home page (entry)
├── nav.js                             # Shared navigation (IIFE, insertAdjacentHTML)
├── footer.js                          # Shared footer (IIFE, insertAdjacentHTML)
├── bmc-icon.svg                       # Buy Me a Coffee icon
├── favicon.svg                        # Site favicon
├── thumb-decoder-preview.png          # OG preview image
├── CNAME                              # Custom domain: ithmb-codec.dev
├── package.json                       # Dev: @playwright/test, playwright, acorn, @axe-core/playwright
├── playwright.config.js               # 3 projects (chromium, firefox, webkit), fullyParallel
│
├── ithmb-decoder/                     # Core web app (decoder)
│   ├── index.html                     # Decoder page (entry)
│   ├── styles.css                     # Shared CSS (988 lines, all pages)
│   ├── app.js                         # Main entry (ES module, top-level await)
│   ├── decoder.js                     # WASM decode orchestration
│   ├── viewer.js                      # Image viewer & toolbar
│   ├── state.js                       # State management
│   ├── ui.js                          # File card creation & processing
│   ├── utils.js                       # Utility functions (bytesToHex, bytesToBase64, toast…)
│   ├── input.js                       # Hold-to-repeat helper
│   ├── telemetry.js                   # submitTelemetry (fire-and-forget POST)
│   ├── download.js                    # Download All (JSZip)
│   ├── card-success-ui.js             # Success card rendering + report link
│   ├── card-failure-ui.js             # Failure card rendering + share buttons
│   ├── ithmb_wasm.js                  # WASM loader (generated)
│   ├── ithmb_wasm_bg.js              # WASM FFI bindings (generated)
│   └── ithmb_wasm_bg.wasm            # Binary WASM module (181 KB)
│
├── guide/
│   └── how-to-open-ithmb-files.html   # Documentation page
│
├── enterprise/
│   └── index.html                     # Enterprise marketing page
│
├── tests/
│   ├── a11y.spec.js                   # axe-core accessibility scans
│   ├── pages.spec.js                  # Smoke tests
│   ├── ithmb-decoder.spec.js          # Structural/CSS regression
│   ├── gallery.spec.js                # Viewer mode + regressions
│   ├── stress.spec.js                 # Full user flow scenarios
│   ├── upload.spec.js                 # Upload + decode correctness
│   ├── quality.spec.js                # Share flow + quiet-by-default checks
│   ├── visual.spec.js                 # Visual regression (snapshots)
│   └── fixtures/                      # invalid.bin + test1-8.ithmb (real binary files)
│
└── workers/
    └── telemetry/
        ├── src/worker.js              # Cloudflare Worker (~493 lines)
        ├── wrangler.toml              # KV binding, compat date 2026-07-13
        └── README.md                  # Deployment docs + API reference

.husky/pre-commit                      # Runs gallery.spec.js (120s timeout)
```

### Page Matrix

| Page       | Route                            | Purpose        | Type                         | JS Required                                      |
| ---------- | -------------------------------- | -------------- | ---------------------------- | ------------------------------------------------ |
| Home       | `/`                              | Landing page   | Static + CSS                 | nav.js, footer.js                                |
| Decoder    | `/ithmb-decoder/`                | Core web app   | Full SPA (ES modules + WASM) | nav.js, footer.js, app.js (12 modules), JSZip CDN |
| Guide      | `/guide/how-to-open-ithmb-files` | Documentation  | Static + CSS                 | nav.js, footer.js                                |
| Enterprise | `/enterprise/`                   | Marketing page | Static + CSS                 | nav.js, footer.js                                |

### Dependency Direction

```
app.js ──→ viewer.js ──→ state.js (TELEMETRY_URL)
   │            │
   ├── ui.js ───┘
   └── decoder.js ←── state.js (S, arrays, Set)
         │
         └── utils.js (size, toast, hex, escape)
card-failure-ui.js ──→ telemetry.js ──→ state.js (TELEMETRY_URL)
card-success-ui.js ──→ telemetry.js
```

---

## 2. Shared Components

### 2.1 Navigation Bar (`nav.js` — 61 lines)

IIFE injected as first child of `<body>` via `insertAdjacentHTML`.

**Structure:**

- Fixed top nav (44px, backdrop-filter blur), brand left, 4 links center (Home/Decoder/Guide/Enterprise), icons right (BMC corner → buymeacoffee.com/ThumbNami, GitHub corner → github.com/B67687/Ithmb-Codec).
- **Active link detection** from `window.location.pathname`: contains `/ithmb-decoder/` → decoder, `/guide/` → guide, `/enterprise/` → enterprise, default → home.
- Nav styling is inline (no CSS classes).

### 2.2 Footer (`footer.js` — 19 lines)

IIFE injected at the `<script src="/footer.js">` position via `insertAdjacentHTML`.

**Structure:** GitHub icon + "Powered by Ithmb-Codec" (link to github.com/B67687/Ithmb-Codec) + Buy me a coffee (bmc-icon.svg).

**Placement:** Inside `<div class="container">` on home/decoder/guide pages. Direct child of `<body>` on enterprise page.

### 2.3 Static Assets

| File                         | Used In                          |
| ---------------------------- | -------------------------------- |
| `/bmc-icon.svg`              | nav.js, footer.js                |
| `/favicon.svg`               | All `<link rel="icon">`          |
| `/thumb-decoder-preview.png` | All `og:image` meta tags         |

---

## 3. Home Page

**Route:** `/`
**File:** `index.html` (333 lines)

### 3.1 Meta

| Property                    | Value                                                     |
| --------------------------- | --------------------------------------------------------- |
| `<title>`                   | ITHMB Codec — Decode Apple thumbnail files (.ithmb, .ipm) |
| Canonical                   | https://ithmb-codec.dev/                                  |
| OG image                    | thumb-decoder-preview.png                                 |
| Favicon                     | `/favicon.svg`                                            |
| Fonts                       | Inter 400/500/600/700 (Google Fonts)                      |
| Stylesheet                  | `/ithmb-decoder/styles.css` + inline `<style>` block      |
| Structured data             | FAQPage + WebApplication JSON-LD                          |

### 3.2 Visual Components

| Component        | Element                 | Notes                                                                  |
| ---------------- | ----------------------- | ---------------------------------------------------------------------- |
| Logo icon        | `.logo .logo-icon`      | 44×44px, accent bg, rounded, SVG grid pattern                          |
| Logo text        | `.logo .logo-text`      | 2rem, 700 weight, tight letter-spacing ("ITHMB Codec")                 |
| Subtitle         | `header .subtitle`      | 1.05rem, muted, 480px max-width                                        |
| Card: Decoder    | `.card.card-decoder`    | Badges: "Free" (green), "Popular" (orange). Links to `/ithmb-decoder/` |
| Card: Guide      | `.card.card-guide`      | Badge: "Guide" (blue). Links to `/guide/how-to-open-ithmb-files`       |
| Card: Enterprise | `.card.card-enterprise` | Badge: "Enterprise" (purple). Links to `/enterprise/`                  |
| Card hover       | `.card:hover`           | shadow + translateY(-2px), arrow slides right                          |

### 3.3 Responsive Breakpoints

- **768px:** Logo shrinks (1.6rem, 36px), card padding reduced
- **480px:** Further shrink (1.35rem, 32px), card padding 16px

---

## 4. Decoder Page

**Route:** `/ithmb-decoder/`
**File:** `ithmb-decoder/index.html` (253 lines)

### 4.1 Meta

| Property                    | Value                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `<title>`                   | ITHMB Decoder — free .ithmb & .ipm file converter                                    |
| Canonical                   | https://ithmb-codec.dev/ithmb-decoder/                                               |
| External JS                 | JSZip 3.10.1 (CDN: cdnjs.cloudflare.com) for batch download                          |
| Entry module                | `app.js` (ES module with top-level `await`)                                          |

### 4.2 Visual Components

| Component              | ID/Class                                 | Status            | Key Behavior                                                                                    |
| ---------------------- | ---------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| Full-page drop overlay | `#dropOverlay` `.drop-overlay`           | Hidden by default | Shown on dragenter, hidden on dragleave/drop                                                    |
| Page header            | `<header>`                               | Always visible    | h1 "ITHMB Decoder" + subtitle                                                                   |
| Dropzone               | `#dropzone`                              | Always visible    | Dashed blue border. Click → file picker. Drag-over adds `.drag-over` (blue bg).                 |
| Toolbar                | `#toolbar` `.toolbar`                    | Hidden initially  | Shown when files loaded. Two rows.                                                              |
| Help button            | `#helpBtn`                               | Hidden initially  | Circular "?" — shows keyboard shortcut toast on click.                                          |
| Viewer nav             | `#viewerNav`                             | Hidden initially  | Prev (◀) + position ("3/8") + Next (▶). Hold-to-repeat (400ms delay, 30ms interval).            |
| Grid toggle            | `#viewToggleBtn`                         | Hidden initially  | Toggles viewer/grid. Text flips between "Grid view" / "Gallery".                                |
| Download All button    | `#downloadAllBtn`                        | Hidden initially  | Creates ZIP via JSZip. Shows format in label/title.                                              |
| Format select          | `#downloadFormatSelect`                  | Hidden initially  | JPEG (default), PNG, BMP, WebP. **Global-only** — sets S.downloadFormat + ZIP label/title.       |
| Viewer container       | `#viewer-container`                      | Hidden initially  | Bordered card, rounded, contains header + stage + filmstrip.                                    |
| Viewer header          | `#viewer-header`                         | 3-column         | Encoding \| Filename \| Dimensions                                                              |
| Viewer stage           | `#viewer-stage`                          | Centered canvas   | min-height 400px. Contains decoded canvas or placeholder.                                       |
| Viewer arrows          | `#viewerArrowLeft` / `#viewerArrowRight` | Absolute          | Hold-to-repeat navigation. Hidden on mobile.                                                    |
| Filmstrip              | `#viewer-filmstrip`                      | Horizontal scroll | 80×60 per thumb. Hover opacity 0.85. Active accent border. Click to navigate.                   |
| File list              | `#file-list` `.file-list`                | Dynamic          | Grid mode (auto-fill) or viewer mode (flex column).                                             |
| File card              | `.file-card`                             | Dynamic          | Meta (name + size) + status + preview + actions (save, format select; success) or share box (failure). |
| Back-to-top            | `#backToTop`                             | Hidden by default | Fixed bottom-right. Scroll-aware show/hide. Saves scroll position.                              |
| Back-to-position       | `#backToPosition`                        | Hidden by default | Appears after back-to-top click. Auto-hides after 8s or manual scroll.                          |
| Toast                  | `#toast` `.toast`                        | Hidden by default | Fixed bottom-center. Dark bg, white text. Auto-disappears after 3s.                             |

### 4.3 Decoder App States

| State            | How It Looks                                                              | Trigger                                |
| ---------------- | ------------------------------------------------------------------------- | -------------------------------------- |
| Initial          | Header + dropzone only                                                    | Page load                              |
| Processing files | Cards appear with loading spinner + "Decoding..." status                  | Files selected via click or drop       |
| Decode success   | Canvas thumbnail + green "Decoded" status + Save button + format select   | WASM decode succeeds                   |
| Decode failure   | Share box (hex dump + Share 16 bytes / Share full file)                   | Known format fails to decode           |
| Decode unknown   | Share box with "Unknown format" note                                      | Unrecognized format prefix             |
| Decode error     | Red "Error" status + error message                                        | Decode throws                          |
| Viewer open      | Toolbar visible + viewer container with canvas + filmstrip + arrows       | Card click or programmatic openViewer  |
| Grid mode        | Cards in 2D grid, viewer hidden                                           | Toggle button or G key                 |
| Download all     | ZIP download triggered (JSZip)                                            | Download All button click              |

### 4.4 Internal JS Modules

See [§7 Internal JS Behaviors](#7-internal-js-behaviors) for complete module-level documentation.

---

## 5. Guide Page

**Route:** `/guide/how-to-open-ithmb-files`
**File:** `guide/how-to-open-ithmb-files.html` (470 lines)

### 5.1 Meta

| Property                    | Value                                                                           |
| --------------------------- | ------------------------------------------------------------------------------- |
| `<title>`                   | How to Open .ITHMB Files — Free Online ITHMB Decoder                            |
| Canonical                   | https://ithmb-codec.dev/guide/how-to-open-ithmb-files                           |
| Stylesheet                  | `/ithmb-decoder/styles.css` + inline `<style>` block                            |
| Structured data             | Article JSON-LD                                                                 |

### 5.2 Content Sections

| Section                                     | Notes                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| What Is an ITHMB File?                      | Apple thumbnail format, iPod/iPhone origin                                |
| How to Use the Free Online Decoder          | 3 numbered steps: navigate, drop file, download                           |
| Why Use This Decoder?                       | 5 bullets: Private, Fast, Free, Open Source, Batch                        |
| About the ITHMB Codec Project               | Open source description with GitHub link                                  |
| FAQ                                         | 4 items: batch conversion, privacy (no uploads), .ipm support, free usage |
| Privacy bullet                              | "No data leaves your computer by default… zero automatic uploads"         |

### 5.3 Responsive Breakpoints

- **768px:** Logo shrink, article padding 32px
- **480px:** Article padding 16px, further font reduction

---

## 6. Enterprise Page

**Route:** `/enterprise/`
**File:** `enterprise/index.html` (98 lines)

### 6.1 Meta

| Property                    | Value                                                                             |
| --------------------------- | --------------------------------------------------------------------------------- |
| `<title>`                   | ITHMB Codec Enterprise — Licensing for Organizations                              |
| Canonical                   | https://ithmb-codec.dev/enterprise/                                               |
| Stylesheet                  | `/ithmb-decoder/styles.css` + inline `<style>` block                              |

### 6.2 Architectural Note

Enterprise has a **separate design system**: does NOT use CSS variables (hardcoded `#007aff`, `#1d1d1f`, `#6e6e73`, etc.), only borrows `.btn` classes from `styles.css`. Currently an "under consideration" construction page.

### 6.3 Visual Components

| Component            | Class                                | Notes                                                              |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| Hero section         | `.hero`                              | Badge, h1 "ITHMB Codec Enterprise", subtitle, GitHub + Try Decoder links |
| CTA buttons          | `.btn-group`                         | "See Pricing", "Compare Editions", "Try ITHMB Demo"                |
| Differentiators grid | `.diff-grid` (6 `.diff-card`s)       | Privacy, Rust+WASM, Open Source, Priority Support, Custom Integration, Format Research |
| Comparison table     | `.comparison-table`                  | Open Source / Enterprise $299/seat / Site License $999/org         |
| Pricing cards        | `.pricing-grid` (2 `.pricing-card`s) | Enterprise ($299/seat) + Site License ($999/org, "Best Value")     |
| Trust section        | `.trust-placeholder`                 | Placeholder content                                                |
| FAQ                  | `.faq-list` (5 `.faq-item`s)         | 5 questions                                                        |

### 6.4 Responsive

- **480px:** Hero padding reduced, grids collapse to single column, github-corner + bmc-corner hidden

---

## 7. Internal JS Behaviors

### 7.1 Module Inventory (current LOC)

| Module           | File                             | Pattern   | LOC  | Dependencies                                                    |
| ---------------- | -------------------------------- | --------- | ---- | --------------------------------------------------------------- |
| nav.js           | `nav.js`                         | IIFE      | 61   | None                                                            |
| footer.js        | `footer.js`                      | IIFE      | 19   | None                                                            |
| state.js         | `ithmb-decoder/state.js`         | ES module | 29   | None                                                            |
| utils.js         | `ithmb-decoder/utils.js`         | ES module | 48   | None                                                            |
| input.js         | `ithmb-decoder/input.js`         | ES module | 38   | None                                                            |
| telemetry.js     | `ithmb-decoder/telemetry.js`     | ES module | 11   | state.js (TELEMETRY_URL)                                        |
| decoder.js       | `ithmb-decoder/decoder.js`       | ES module | 64   | state.js, utils.js, viewer.js, card-success-ui.js, card-failure-ui.js, ithmb_wasm.js |
| viewer.js        | `ithmb-decoder/viewer.js`        | ES module | 270  | state.js, utils.js, card-success-ui.js, card-failure-ui.js       |
| ui.js            | `ithmb-decoder/ui.js`            | ES module | 105  | state.js, utils.js, decoder.js, viewer.js                        |
| download.js      | `ithmb-decoder/download.js`      | ES module | 28   | state.js, utils.js                                               |
| card-success-ui.js | `ithmb-decoder/card-success-ui.js` | ES module | 133 | state.js, utils.js, telemetry.js                                 |
| card-failure-ui.js | `ithmb-decoder/card-failure-ui.js` | ES module | 103 | state.js, utils.js, telemetry.js, viewer.js                      |
| app.js           | `ithmb-decoder/app.js`           | ES module | 265  | All above + ithmb_wasm.js (init)                                 |

### 7.2 State Management (`state.js`)

**Mutable state object `S`:**

| Field                 | Type    | Default      | Purpose                      |
| --------------------- | ------- | ------------ | ---------------------------- |
| `cardCount`           | number  | 0            | Number of file cards in UI   |
| `globalCardIdCounter` | number  | 0            | Unique card ID generator     |
| `viewerIndex`         | number  | -1           | Currently viewed image index |
| `totalFiles`          | number  | 0            | Total files being processed  |
| `processedCount`      | number  | 0            | Files decoded so far         |
| `downloadFormat`      | string  | "image/jpeg" | Global download format (ZIP) |
| `cardFormats`         | object  | {}           | Per-card format overrides    |
| `lastTarget`          | Element | null         | Drag enter/leave tracking    |

**Global arrays (mutated directly by consumer modules):**

- `successfulDecodes` — `{canvas, fileName, bytes, prefix, fileSize}[]`
- `failedDecodes` — `{bytes, prefix, fileName, fileSize}[]`
- `sharedFileIds` — Set of deduped card IDs (re-upload dedup + failure-share dedup)

**Constants:**

- `TELEMETRY_URL` — `"https://ithmb-telemetry.ithmb-codec.workers.dev"`
- `KNOWN_PREFIXES` — Set of recognized format prefix values (1005–3011)

### 7.3 Key Behaviors

#### File Drop/Upload Flow

1. User drops file(s) or clicks dropzone → native file picker
2. `processFiles(files: File[])` called
3. On first batch: full state reset (all arrays cleared, counters reset)
4. Files filtered by: `.ithmb`/`.ipm` extension, ≤ 8MB, content-based dedup (SHA-256 of first 256 bytes)
5. Rejected files (wrong type, too large) → toast notification
6. Card created for each valid file → `addFileCard(file)` returns cardId
7. `decodeFile(file, cardId)` called per file (async)

#### Decode Pipeline (`decodeFile` — 64 lines)

1. Read file as ArrayBuffer → Uint8Array
2. Call `peek_prefix(bytes)` → read 4-byte format prefix
3. Call `decode_ithmb(bytes)` → returns `Uint8Array` (RGBA pixels) or undefined
4. On success:
   - Create `<canvas>`, draw image data (constrained 600×400 max)
   - Render preview in card (card-success-ui.js)
   - Add to `successfulDecodes[]`, create filmstrip thumbnail, wire Save + format select
5. On failure:
   - Show share box with hex dump + "Share 16 bytes" / "Share full file" buttons (card-failure-ui.js)
   - Add to `failedDecodes[]`
6. Increment `processedCount`, update toolbar

#### Viewer Navigation

- Open: `openViewer(index)` → clones canvas, highlights thumb, populates header
- Prev/Next: `prevViewer()` / `nextViewer()` — wraps around (cyclic)
- Keyboard: ← → ↑↓ arrows, Escape closes, G toggles grid
- Touch swipe: horizontal swipe > 50px threshold triggers prev/next

#### Failure Sharing (opt-in, failure-only)

- Failed/unknown cards show a share box with a hex dump of the first 16 bytes and two buttons: **"Share 16 bytes"** (header) and **"Share full file"** (hidden above 8 MB).
- Nothing is ever sent automatically — no batch mode, no background sends.
- Header share: POSTs `{prefix, fileSize, status, header}` (32 hex chars), marks that button "Shared ✓", disables it; **full-file button stays enabled** (header can be upgraded).
- Full-file share: POSTs `{...header payload, full_file: base64}` (full file ≤ 8 MB), marks "Shared ✓", disables both buttons, sets title "Full file already shared — the 16 bytes are included" on the header button.
- Per-card dedup keys: `(fail-|unknown-)<cardId>-h` / `-f`. Toast on share; no modal, no countdown, no checkboxes.
- Success cards: **no** contribution button — only a small report link "Image looks wrong? Share the first 16 bytes" (POSTs status `success`, dedup key `fb-<cardId>`, becomes "Thanks — shared ✓").

#### Download All

- Creates JSZip archive from all successful decode canvases
- Format: JPEG 92% quality (default), PNG, BMP, or WebP
- **Global format select only affects the ZIP** — per-card format selects stay independent (S.cardFormats overrides)
- Downloads as: `ithmb-pictures-converted-to-{format}.zip`

### 7.4 DOM Elements Registry

```
#dropzone, #dropOverlay, #file-list, #toolbar,
#helpBtn, #viewerNav, #prevBtn, #nextBtn, #viewerPos, #viewToggleBtn,
#downloadAllBtn, #downloadFormatSelect,
#viewer-container, #viewer-header, #vhEnc, #vhFile, #vhDims,
#viewer-main, #viewer-stage, #viewerArrowLeft, #viewerArrowRight,
#viewer-filmstrip,
#backToTop, #backToTopLink, #backToPosition, #backToPositionLink,
#toast
```

### 7.5 Event Handlers (Summary)

| Event           | Element(s)                              | Handler                                                |
| --------------- | --------------------------------------- | ------------------------------------------------------ |
| Click           | `#dropzone`                             | Open file picker                                       |
| Drag events (5) | `document`                              | Show/hide overlay, handle drop                         |
| Click           | `#file-list` (delegated)                | Open viewer on card click                              |
| Click           | `#helpBtn`                              | Show keyboard shortcut toast                           |
| Click           | `#prevBtn`, `#nextBtn`                  | Viewer navigation (hold-to-repeat)                     |
| Click           | `#viewerArrowLeft`, `#viewerArrowRight` | Viewer navigation (hold-to-repeat)                     |
| Click           | `#viewToggleBtn`                        | Toggle viewer/grid mode                                |
| Click           | `#downloadAllBtn`                       | ZIP download all                                       |
| Change          | `#downloadFormatSelect`                 | Update global format + ZIP label (per-card unaffected) |
| Click           | `#backToTopLink`                        | Save position, scroll to top                           |
| Click           | `#backToPositionLink`                   | Restore position                                       |
| Keydown         | `document`                              | Arrows = navigate, Esc = close viewer, G = toggle grid |
| Touch           | `document`                              | Swipe left/right navigation                            |
| Scroll          | `document` (passive)                    | Show/hide back-to-top                                  |
| Dragstart       | `document`                              | Prevent default (anti-accidental-drag)                 |
| Click           | `[data-share]` buttons (failure cards)  | Share 16 bytes / full file to telemetry, then toast    |
| Click           | `[data-report]` link (success cards)    | Share first 16 bytes (status: success), then mark sent |

---

## 8. CSS Design System

### 8.1 CSS Custom Properties (`:root`)

| Variable         | Value                         | Role                         |
| ---------------- | ----------------------------- | ---------------------------- |
| `--bg`           | `#f5f5f7`                     | Page background (Apple gray) |
| `--surface`      | `#fff`                        | Card/component surface       |
| `--border`       | `#d2d2d7`                     | Default border               |
| `--text`         | `#1d1d1f`                     | Primary text                 |
| `--muted`        | `#86868b`                     | Secondary text               |
| `--accent`       | `#007aff`                     | Primary accent (Apple blue)  |
| `--accent-hover` | `#0066d6`                     | Accent hover                 |
| `--success`      | `#30d158`                     | Success/OK                   |
| `--warn`         | `#ff9f0a`                     | Warning                      |
| `--radius`       | `12px`                        | Default border-radius        |
| `--shadow`       | `0 2px 12px rgba(0,0,0,0.08)` | Default box-shadow           |
| `--card-bg`      | `var(--surface)`              | Card surface alias           |

### 8.2 Component Class Catalog (from `styles.css`)

| Category          | Selectors                                                                      | Key Properties                                                    |
| ----------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **Buttons**       | `.btn`, `.btn-primary`, `.btn-outline`, `.btn-small`, `.btn-success`           | 8px radius, 0.85rem, inline-flex, transition 0.15s                |
| **Dropzone**      | `#dropzone`, `.drag-over`                                                      | Dashed accent border, surface bg, cursor pointer                  |
| **File Cards**    | `.file-card`, `.file-card .meta`, `.file-list`, `.file-list:not(.viewer-mode)` | Surface bg, shadow, padding 16px. Grid layout in non-viewer mode. |
| **Status**        | `.ok` (green), `.err` (red), `.unknown` (orange), `.loading` (blue)            | `.spinner` animation (14px, spin 0.6s)                            |
| **Viewer**        | `#viewer-container`, `#viewer-main`, `#viewer-stage`, `.viewer-arrow`          | Min-height 400px, centered, canvas 70vh max                       |
| **Filmstrip**     | `#viewer-filmstrip`, `.filmstrip-thumb`, `.filmstrip-thumb.active`             | Horizontal scroll, 80×60 thumbs, accent active border             |
| **Toolbar**       | `.toolbar`, `.toolbar-row`                                                     | Flex column/row layout, responsive wrap                           |
| **Toast**         | `.toast`, `.toast.show`                                                        | Fixed bottom-center, 0.3s opacity transition                      |
| **Drop Overlay**  | `.drop-overlay`, `.drop-overlay.active`                                        | Fullscreen dark overlay, blur, 175ms transition                   |
| **GitHub/BMC**    | `.github-corner`, `.bmc-corner`                                                | inline-flex, muted → accent on hover, line-height:0               |
| **Back-to-Top**   | `#backToTop`, `#backToPosition`                                                | Fixed bottom-right, 44px circular buttons                         |
| **Share box**     | `.share-box`, `.share-actions`, `.share-hexdump`                               | Warn-tinted failure-card box: heading, hex dump, two share buttons|
| **Report link**   | `.success-report`                                                              | Muted underline link on success cards                             |
| **Viewer Header** | `#viewer-header`, `.vh-enc`, `.vh-file`, `.vh-dims`                            | 3-column flex: encoding \| filename \| dimensions                 |
| **Footer**        | `footer`, `footer a`, `footer > div`                                           | Bordered top, flex centered, muted 0.8rem                         |
| **Accessibility** | `:focus-visible`, `button:focus-visible`, etc.                                 | 2px accent outline, 2px offset                                    |

### 8.3 Animations

| Keyframe                                    | Element                | Purpose                     |
| ------------------------------------------- | ---------------------- | --------------------------- |
| `@keyframes spin` (0.6s linear)             | `.spinner`             | File card loading indicator |
| `@keyframes placeholder-spin` (0.8s linear) | `.placeholder-spinner` | Viewer placeholder loading  |

### 8.4 Responsive Breakpoints

**`@media (max-width: 768px)`:** Body padding reduced (68px 12px).

**`@media (max-width: 480px)`:** Body padding 68px 8px, dropzone padding reduced, toolbar wraps, viewer stage min-height 300px + canvas 50vh, viewer arrows hidden, GitHub/BMC corners hidden, filmstrip thumbs 48×36, grid collapses to minmax(160px, 1fr), back-to-top shrinks.

### 8.5 Page-Specific Styles

| Page       | Inline styles       | Unique Classes                                                                                       |
| ---------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| Home       | ~250 lines          | `.logo`, `.logo-icon`, `.logo-text`, `.cards`, `.card`, `.card h2 .arrow`, `.about`                  |
| Decoder    | None (pure styles.css) | N/A                                                                                                |
| Guide      | ~270 lines          | `.article`, `.steps`, `.steps li::before`, `.lead`, `.faq-item`, `.faq-question`, `.faq-answer`      |
| Enterprise | ~430 lines          | `.hero`, `.diff-grid`, `.diff-card`, `.comparison-table`, `.pricing-grid`, `.trust-placeholder`, `.faq-list` |

---

## 9. Deployment & Testing Infra

### 9.1 Playwright Test Suite

**Config:** 3 projects (chromium, firefox, webkit), 30s timeout (10s expect), `fullyParallel`, baseURL = `BASE_URL` env || `https://ithmb-codec.dev`. **196 tests total**, green on chromium + firefox.

| File                    | Focus                                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `pages.spec.js`         | Smoke tests: landing, enterprise, guide page loads + critical elements                                                              |
| `ithmb-decoder.spec.js` | Structural/CSS regression: page structure, GitHub/BMC corners, toolbar, footer, CSS variables, no batch toggle                      |
| `gallery.spec.js`       | Viewer mode: filmstrip, arrow nav, keyboard, Escape; regression: pixel content; download format; mobile; G key                      |
| `stress.spec.js`        | Full user flow scenarios: invalid file, single/multi file, filmstrip click, arrow key cyclic, grid toggle, Escape, dedup, back-to-top, G key |
| `upload.spec.js`        | Decode correctness: 8 distinct files, batch append, duplicate filenames                                                             |
| `quality.spec.js`       | Share flows (header/full/dedup/upgrade), report link, quiet-by-default checks, corrupt-file handling                                 |
| `a11y.spec.js`          | axe-core accessibility scans (5 pages)                                                                                              |
| `visual.spec.js`        | Visual regression with snapshots (pages, nav bar, footer)                                                                           |

**Test fixtures:** `tests/fixtures/test{1-8}.ithmb` — real .ithmb binary files; `invalid.bin` (64B, non-ithmb).

**Known:** no CI workflow runs Playwright. Pre-commit hook runs `gallery.spec.js` (120s timeout).

### 9.2 Cloudflare Worker (Telemetry)

| Aspect      | Detail                                                                                         |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Route       | `POST /` submit record; `GET /dashboard` dashboard HTML (auth required); `GET /` public JSON; `OPTIONS /` CORS |
| KV Binding  | `FORMAT_TELEMETRY`                                                                             |
| Rate limit  | 100 requests/day per IP:UA fingerprint                                                         |
| Dedup       | 24h TTL dedup markers keyed `dedup:{fp}:{prefix}:{status}:{h\|f}`                              |
| Record cap  | 50 records/day per fingerprint                                                                 |
| Body limit  | 13 MB (`MAX_BODY_BYTES`); full-file field capped `FULL_FILE_B64_MAX` = 11,184,812 chars (~8 MB raw) |
| Retention   | 365 days (`fmt_{prefix}_{ts}` keys)                                                            |
| CORS        | Echoes allowed origins (`https://ithmb-codec.dev`, `localhost`/`127.0.0.1` any port); others get production domain (blocked) |
| Auth        | Dashboard: `Authorization: Bearer <ADMIN_TOKEN>` header **or** `?token=<ADMIN_TOKEN>` query param; `/dashboard` without valid token → 401 |
| Deploy      | `npx wrangler deploy` (needs `CLOUDFLARE_API_TOKEN` or `wrangler login`)                        |
| URL         | `https://ithmb-telemetry.ithmb-codec.workers.dev`                                               |

**Valid status values:** `success`, `known-failed`, `unknown`, `looks-good`, `looks-wrong`
**Valid issue types:** `color_space`, `dimensions`, `stride`, `offset`, `byte_order`, `other`

**Privacy:** fingerprint = SHA-256 of IP+UA (first 8 bytes hex) — no raw IP stored. Nothing sent from the app unless the user clicks a Share button.

### 9.3 WASM Integration

| File                 | Role                                                              |
| -------------------- | ----------------------------------------------------------------- |
| `ithmb_wasm.js`      | Cross-browser streaming WASM instantiation, re-exports from bg.js |
| `ithmb_wasm_bg.js`   | Low-level FFI bindings                                            |
| `ithmb_wasm_bg.wasm` | Binary WASM module (from `crates/ithmb-wasm`)                     |

**Exported functions:** `decode_ithmb(bytes)`, `peek_prefix(bytes)`, `get_encoding_name(prefix)`

**No version metadata in WASM files** — built externally from the Ithmb-Codec repo.

### 9.4 Git / CI

| Aspect      | Detail                                                         |
| ----------- | -------------------------------------------------------------- |
| Branch      | `clean-push` (working branch)                                  |
| CI          | None (removed as over-optimization for a solo project)         |
| Pre-commit  | Runs `gallery.spec.js` (120s timeout)                          |
| Deploy      | GitHub Pages via CNAME `ithmb-codec.dev`                       |

---

_End of Feature Inventory_
