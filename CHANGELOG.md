# Changelog

## 1.4.2 — 2026-08-04

### Added
- Localized og:title / og:description (meta tags follow the active language)
- `npm run ci` now gates on `lint:modules` + `lint:i18n` before the test run

### Fixed
- "Decoding…" placeholder now re-translates if you switch language mid-decode
- Footer no longer flashes raw translation keys on pages where i18n loads late
- Report modal backdrop listener bound once (was accumulating one per click)
- Toast hide timer resets on each new toast (rapid messages no longer cut short)
- Share POST timeout now scales with payload size (8s + 1s/MiB, capped 30s) — large full-file uploads over slow connections no longer always time out
- Duplicate aria-labels and duplicate/dead lines removed

## 1.4.1 — 2026-08-04

### Security
- Block stored XSS in the telemetry dashboard: every record field HTML-escaped, CSP `default-src 'none'` + `frame-ancestors 'none'` + `nosniff`, non-hex header values rejected
- Hardened the telemetry worker against abuse: race-free per-day record/rate caps (list-based counters — the old read-then-write counters were permanently bypassable under concurrency), per-IP counter keys hashed (raw IP no longer written to KV), bounded dashboard scan + full-file payloads moved to separate keys (renders never fetch multi-MB values), byte-accurate body cap + base64-validated full-file uploads, Bearer-only constant-time dashboard auth, `no-store` + `no-referrer` headers
- Cap embedded-JPEG dimensions before decode (a 166-byte progressive JPEG declaring 65535×65535 triggered an ~8 GiB allocation and SIGABRT — CWE-400); browser wasm rebuilt with the fix
- Client hardening: ZIP entry names sanitized + deduped, i18n interpolation params HTML-escaped

### Fixed
- Error cards no longer pushed into the shareable set (broke re-render after a language switch)
- Share-box rollback re-queries live buttons — a mid-POST language switch no longer strands the UI at "Shared ✓"
- View-toggle button label now follows the viewer state after a language switch

## 1.4.0 — 2026-08-04

### Added
- Full i18n: Simplified Chinese + English across the decoder, home, guide, 404, and enterprise pages — EN/中 nav toggle, auto-detect (browser language / ?lang= / saved choice), instant in-memory language switch, and cross-tab sync (all open tabs follow the toggle)
- Culture-fit localization: native Chinese dev-site voice (请我喝杯奶茶 sponsor, 由 Ithmb-Codec 驱动 footer, 免费 · 本地 · 无追踪 tagline, 页面飞走了 🕊️ 404, 给个 ⭐ star invite, 分享 not 共享) — five independent QA passes
- Restored report/contribute modal: shared centered dialog (dimmed + blurred backdrop) with the decoded-image thumbnail, plain-language issue picker, and honest submit — from any card or the viewer stage
- SEO: localized meta descriptions, hreflang en/zh alternates, Content-Security-Policy on the 404 page, SEO metadata regression suite
- Brand-last page titles ("Page | ITHMB Codec")

### Changed
- Share/report UI is optimistic (instant feedback, background POST, honest rollback on failure)
- Decode-failed styling standardized to orange across file cards, viewer placeholder, and filmstrip
- Modal/buttons/radii unified to consistent tiers; removed dead code
- 30-squashed-commit architecture cleanup: single mechanisms for toggle, swipe, viewer refresh, i18n activation; EMBEDDED_EN single-source with drift gate

### Fixed
- Share buttons lied when a request hung — added an 8s timeout so a failed send rolls back and toasts honestly
- Language-switch "seizure" (rapid en↔zh flicker across tabs) — write-amplification loop fixed at the root
- Report form closing on language switch; form now survives re-renders
- Warning-triangle glyph rendering differently per language (now identical SVG)
- Locale tables were never tracked in git (deployed site had no translations); footer suffix key leaking raw into EN

## 1.3.0 — 2026-08-02

### Added
- Static decoder mockup in the guide (toolbar, viewer, filmstrip, grid) using native-resolution synthetic test images — sharp at any zoom, no screenshots
- Brand logo on the README (padded square mark) and enterprise page
- Fixed-height gallery stage so the viewer no longer resizes when navigating between differently-sized images
- Regression test locking the fixed-stage behavior

### Changed
- Guide privacy wording to match the opt-in sharing model ("Nothing gets uploaded unless you click Share")
- Home meta/og description: accurate privacy claim
- README issue link now points at the Rust codec repo

### Fixed
- Missing closing tags on home meta/og description broke the favicon link
- Gallery viewer resizing abruptly between images of different sizes

## 1.2.0 — 2026-08-01

### Added
- SEO structured data: HowTo + FAQPage schema on the guide, BreadcrumbList on home/decoder/guide
- Cross-platform note in the guide (Windows, macOS, Linux, mobile)
- "Try it live" CTA + guide link in the README

### Fixed
- Stray `/>` rendering in the guide head
- Guide link check (dead/bot-blocked URLs excluded)

## 1.1.0 — 2026-07-30

### Added
- Cross-browser test suite: Chromium + Firefox (196 tests)
- Visual regression snapshots for all pages (Chromium + Firefox)
- aria-live on batch modal countdown timer (screen readers)
- Download All info tooltip (count + format on hover)

### Changed
- Batch modal: timer + confirm message stack vertically (not flex)
- Batch toggle label shortened to Share data, placed inline
- Toolbar: all buttons same height (btn-small)
- Toolbar: grid/gallery button fixed width (no resize on toggle)
- Download All: removed bracket count, added title tooltip
- View toggle button text centered
- Logo: SVG owns its own blue box (no CSS background overlap)
- Logo: better spacing, proper nav-bar-like proportions
- Guide page: clarified privacy claim (opt-in contribution)
- All pages: styles.css cache-busted with ?v=1

### Fixed
- Drag-and-drop broken by duplicate import
- Batch toggle padding not matching button height
- Format select padding mismatched
- viewer-nav button font-size overriding btn-small
- viewerPos span missing vertical padding
- Firefox viewer buttons navigating by DOM order
- Duplicate Contributed alert on batch checkbox uncheck
- Stale CSS served from http-server cache

## 1.0.0 — 2026-07-28

### Added
- Initial public release of ITHMB Codec Web
- Browser-based .ithmb decoder using WebAssembly
- Drag-and-drop file processing with batch support
- Individual and batch ZIP download (JPEG, PNG, BMP, WebP)
- Format contribution system with privacy-first telemetry
- Guide page with FAQ and documentation
- Open source release (MIT license)
- CI/CD pipeline with Playwright test suite
- Visual regression testing (8 snapshot baselines)
- FAQ schema, XML sitemap, Google Search Console integration

