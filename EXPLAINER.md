# EXPLAINER.md: Code Explanation

> Generated at REVIEW start to describe the AS-BUILT codebase at HEAD `4198c5c`.

## For the Reader

This project was built with AI assistance. This explainer lets someone who cannot read every line of code understand what the system does, how data flows through it, and why the key decisions were made. It describes the code as it exists today, not an idealized design.

## 1. Macro Architecture

Ithmb-Codec-Web is a static, privacy-first website that decodes Apple .ithmb (iThumbnail) files entirely in the browser. The core is a single-page decoder application (`ithmb-decoder/`) that loads a WASM build of the Ithmb-Codec engine and runs all decoding client-side, so no file content ever leaves the user's machine. Around that SPA sit static informational pages (Home, Guide, Enterprise, privacy) that explain and route to the decoder, plus an en/zh internationalization layer. A separate, optional Cloudflare Worker (`workers/telemetry/`) receives only what a user explicitly opts to share, under a strict quiet-by-default privacy contract. The site deploys to GitHub Pages, and its CI runs on the private Dev repo.

## 2. Data Flow Walk

Trigger: a user drops a `.ithmb` file onto the decoder page.

1. The drop/select handler in `input.js` captures the file bytes.
2. `app.js` boots the SPA and passes the bytes to `decoder.js`.
3. `decoder.js` calls `peek_prefix` then `decode_ithmb` on the WASM engine (`ithmb_wasm.js` loader -> `ithmb_wasm_bg.wasm`).
4. On success, the decoded image renders to a 600x400 canvas via `card-success-ui.js` and `viewer.js`; the user can navigate with filmstrip/arrows or download a ZIP via `download.js`.
5. On failure, `share-actions.js` renders a share box with a hex dump of the first 16 bytes. Nothing is sent unless the user explicitly clicks share.
6. On a success card, the user may open a report modal (`card-success-ui.js`) and pick one of 6 issue types. This report is also opt-in.
7. If the user opts to share, `telemetry.js` POSTs the minimal record to the worker; otherwise the flow ends in the browser with no network call.

**End:** the user has either viewed/downloaded their decoded file entirely in-browser, or opted in to share a minimal diagnostic. The quiet-by-default invariant holds unless the user actively chooses otherwise.

## 3. Module Breakdown

| Module | Responsibility | Public API | Key Types |
|---|---|---|---|
| `input.js` | File capture | `handleFile(bytes)` | File, bytes |
| `decoder.js` | WASM decode orchestration | `decode(fileBytes)` | DecodeResult |
| `ithmb_wasm.js` | WASM loader (hand-adapted) | `decode_ithmb` | Wasm module |
| `state.js` | App state + dedup | `getState()`, `addProcessed(id)` | State, FileId |
| `viewer.js` | Filmstrip navigation | `open(canvas)`, `next()`, `prev()` | ViewState |
| `card-success-ui.js` | Success card + report modal | `renderSuccess(result)` | Card |
| `card-failure-ui` | Failure/share UI | `renderFailure(hex)` | Card |
| `share-actions.js` | Opt-in share | `sharePrefix()`, `shareFull()` | ShareRecord |
| `telemetry.js` | Opt-in submission | `submit(record)` | TelemetryRecord |
| `download.js` | ZIP export | `downloadAll(files)` | Blob, Zip |
| `i18n.js` | Locale strings | `t(key)` | Locale |
| `ui.js` | DOM rendering | `render(dom)` | Element |

The most complex module is `decoder.js`: it hides the WASM call details, the peek/decode sequence, and the success/failure/error branching behind a single `decode` call, so the rest of the app never touches wasm internals.

## 4. Key Decisions

**Decision 1: Decode in the browser, never on a server.** *Situation:* users have private .ithmb thumbnails. *Concern:* server-side decoding would force uploads. *Choice:* compile the engine to WASM and decode client-side. *Tradeoff:* larger initial payload, but true zero-upload privacy.

**Decision 2: Telemetry is quiet-by-default.** *Situation:* the project wants failure diagnostics. *Concern:* diagnostics must not compromise privacy. *Choice:* nothing is sent automatically; failures present an explicit opt-in share. *Tradeoff:* lower diagnostic volume, but a defensible privacy posture.

**Decision 3: Static multi-page site plus one SPA.** *Situation:* a content site that also decodes files. *Concern:* speed and SEO vs. app complexity. *Choice:* static HTML pages for content, one SPA for the decoder. *Tradeoff:* some template duplication, but fast, indexable pages.

**Decision 4: en/zh i18n with a pre-paint redirect.** *Situation:* international users. *Concern:* FOUC and duplicate-content SEO risk. *Choice:* a `lang-redirect` script that runs before paint plus a canonical `lang` attribute. *Tradeoff:* an i18n parity gate every change must pass.

## 5. Quality Guarantees

**Tests.** A Playwright suite (~423 tests) runs across chromium, firefox, and webkit covering pages, decoder, gallery, stress, upload, quality, accessibility, and SEO metadata.

**Privacy guarantee.** The quiet-by-default contract is the core invariant: no automatic sends, no raw IP storage, HMAC-SHA256 keyed pseudonyms, bounded dashboard scans.

**i18n parity.** The `lint:i18n` gate keeps en/zh mirrors in sync, preventing half-translated pages.

**WASM drift.** The `check-wasm-drift.sh` gate keeps the bundled engine in sync with the core repo.

**Automated checks.** Typecheck (3 tsconfigs), build, gitleaks, and worker smoke test all run in CI on the Dev repo.

**Honest limits.** WebKit cannot run in the local dev environment, so that browser project is only verified in CI. The site relies on GitHub Pages static hosting; there is no server-side compute beyond the optional telemetry worker.

## Mandatory Check

1. Does the data flow walk have both a clear start and a clear end? Yes.
2. Does the module breakdown match the real files in the repo? Yes, verified against `ithmb-decoder/`.
3. Are the key decisions real constraints, not platitudes? Yes, each names a concrete tradeoff.
4. Do the quality guarantees honestly state limits? Yes (webkit and hosting limits are explicit).
5. Does this describe as-built code, not intent? Yes.
