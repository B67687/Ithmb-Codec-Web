# Changelog

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

