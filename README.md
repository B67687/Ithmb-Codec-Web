<div align="center">

<img src="docs/logo.svg" alt="ITHMB Codec Web" width="96" height="96">

# ITHMB Codec Web

[![CI](https://github.com/B67687/Ithmb-Codec-Web-Dev/actions/workflows/ci.yml/badge.svg)](https://github.com/B67687/Ithmb-Codec-Web-Dev/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with WebAssembly](https://img.shields.io/badge/Built%20with-WebAssembly-654FF0?logo=webassembly&logoColor=white)](https://webassembly.org/)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/thumbnami)

Free, private, browser-based .ithmb file decoder.

[**Try it live → ithmb-codec.dev**](https://ithmb-codec.dev/ithmb-decoder/)  |  [How to open .ithmb files (guide)](https://ithmb-codec.dev/guide/how-to-open-ithmb-files)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/decoder-ui-dark.svg">
  <img src="docs/screenshots/decoder-ui.svg" alt="ITHMB Decoder screenshot">
</picture>

<sub>Built with AI assistance — see <a href="./docs/CREDITS.md">CREDITS.md</a></sub>
<br>
<a href="./docs/CREDITS.md"><img src="https://cdn.jsdelivr.net/gh/B67687/Ithmb-Codec-Web@main/docs/badges/deepseek.svg?v=2" alt="DeepSeek"></a>
<a href="./docs/CREDITS.md"><img src="https://cdn.jsdelivr.net/gh/B67687/Ithmb-Codec-Web@main/docs/badges/opencode.svg" alt="OpenCode"></a>
<a href="./docs/CREDITS.md"><img src="https://cdn.jsdelivr.net/gh/B67687/Ithmb-Codec-Web@main/docs/badges/omo.svg" alt="Oh My OpenAgent"></a>

<br>
</div>

ITHMB files are Apple iThumbnail images found in iPod Classic, iPod Nano, and other legacy Apple devices — thumbnail-sized album art, photos, and menu graphics that the iPod's UI reads directly from its disk. The format is undocumented and varies across devices and firmware versions. This project decodes them in your browser via WebAssembly, powered by [ithmb-core](https://crates.io/crates/ithmb-core) from the parent repo [Ithmb-Codec](https://github.com/B67687/Ithmb-Codec).

## Features

- **Free.** No cost, no signup, no account needed.
- **Private.** Everything runs in your browser via WebAssembly. Your files never leave
  your machine unless you explicitly opt in to contribute anonymous format data.
- **Batch decode.** Decode multiple .ithmb files at once.
- **Open source.** MIT licensed. Fork it, audit it, improve it.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ITHMB Codec Web                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  index.html  │  │ decoder page │  │  guide /     │  Static     │
│  │  (Home)      │  │ (SPA entry)  │  │  enterprise  │  pages      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         │                 │                  │                       │
│         └────────┬────────┴────────┬─────────┘                     │
│                  ▼                 ▼                                 │
│          ┌─────────────┐  ┌──────────────┐                         │
│          │   nav.js    │  │  footer.js   │  Shared (IIFE)          │
│          └─────────────┘  └──────────────┘                         │
│                                                                     │
│  ┌─────────────── Decoder SPA (ES Modules) ───────────────────┐    │
│  │                                                             │    │
│  │  app.js ──→ viewer.js ──→ state.js                         │    │
│  │    │            │                                           │    │
│  │    ├── ui.js ───┘                                           │    │
│  │    └── decoder.js ──→ state.js (S, arrays)                 │    │
│  │          │                                                  │    │
│  │          └── utils.js (format, toast, hex, escape)         │    │
│  │                                                             │    │
│  │  cards.js ←── addSuccess / addFailure / reset              │    │
│  │  i18n.js  ←── t() key, languagechange event                │    │
│  │  telemetry.js ──→ Cloudflare Worker POST                   │    │
│  │  download.js ──→ JSZip (JPEG/PNG/BMP/WebP)                │    │
│  │                                                             │    │
│  │  ┌───────────────────────────────────────────────────┐      │    │
│  │  │  ithmb_wasm_bg.wasm (Rust → wasm-bindgen glue)   │      │    │
│  │  │  Hand-adapted loader: ithmb_wasm.js               │      │    │
│  │  └───────────────────────────────────────────────────┘      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
│  ┌─────────────────── Telemetry Worker ────────────────────────┐    │
│  │  workers/telemetry/src/                                     │    │
│  │  ├── worker.ts      (thin router)                           │    │
│  │  ├── types.ts       (Env, constants)                        │    │
│  │  ├── crypto.ts      (HMAC, fingerprints)                    │    │
│  │  ├── dashboard.ts   (HTML template)                         │    │
│  │  ├── validation.ts  (field validation)                      │    │
│  │  └── persistence.ts (KV writes, dedup, rate limits)         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
npm install              # install dependencies
npm run build            # compile TS → JS (nav, footer, theme, lang-redirect)
npm run serve            # serve at http://localhost:8899
```

Open http://localhost:8899 and drag a .ithmb file onto the decoder page.

### All npm scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `npm run build` | `tsx scripts/build.mts` | Compile TS sources to JS |
| `npm run serve` | `http-server -p 8899 -c-1 -s` | Local dev server |
| `npm run typecheck` | `tsc --noEmit` (3 tsconfigs) | Type-check browser + node + worker |
| `npm run test` | `playwright test` | Run all Playwright specs |
| `npm run test:quick` | `playwright test --project=chromium` | Fast single-browser check |
| `npm run test:full` | `playwright test` (3 browsers) | Full cross-browser test |
| `npm run test:unit` | `vitest run` | Unit tests (pure logic, fast) |
| `npm run test:worker` | `tsx test-worker.ts` | Telemetry worker smoke test |
| `npm run ci` | `lint:modules + lint:i18n + playwright` | Full CI gate |
| `npm run lint:modules` | `typecheck + build` | TS + determinism check |
| `npm run lint:i18n` | `check-i18n + check-mirror-parity` | i18n integrity |
| `npm run check:local` | `bash scripts/check-local.sh` | Full local CI (10 gates) |
| `npm run check:deps` | `npm audit + npm outdated` | Dependency security + staleness |

## Local vs GitHub CI

This project follows a **local-first CI** principle: local runs everything hardware allows (< 2 min); GitHub only for what local cannot do (webkit matrix, macOS/Windows).

| Gate | Local (`check:local`) | GitHub CI | Why GitHub? |
|------|:---------------------:|:---------:|-------------|
| npm audit | ✅ | — | Local is enough |
| typecheck (3 tsconfigs) | ✅ | ✅ | Deterministic |
| unit tests (vitest) | ✅ | ✅ | Fast, no browser |
| build + determinism | ✅ | ✅ | Ensures clean build |
| i18n + mirror parity | ✅ | — | Local is enough |
| wasm-drift | ✅ | — | Local is enough |
| telemetry worker test | ✅ | — | Local is enough |
| Playwright (chromium) | ✅ | ✅ | Core browser |
| Playwright (firefox) | ✅ | ✅ | CI matrix |
| Playwright (webkit) | ❌ (not installed) | ✅ | Needs CI runner |
| parity gate tests | ✅ | — | Local is enough |

**Total local time target: < 2 minutes** (vitest + typecheck + playwright on chromium).

## How to use

Go to [https://ithmb-codec.dev/ithmb-decoder/](https://ithmb-codec.dev/ithmb-decoder/) and drag your .ithmb files
onto the page. They decode instantly — no upload, no waiting. Download individual
images or grab them all as a ZIP archive.

## Documentation

- [**FEATURES.md**](docs/FEATURES.md) — Complete feature inventory with F-### lifecycle, behavior contracts, and test anchoring
- [**docs/PROJECT_MODEL.md**](docs/PROJECT_MODEL.md) — Project state model and current status
- [**workers/telemetry/README.md**](workers/telemetry/README.md) — Telemetry Worker reference
- [**docs/CREDITS.md**](docs/CREDITS.md) — AI tooling credits

## Tech Debt

Known technical debt is tracked in [TECH_DEBT_AUDIT.md](TECH_DEBT_AUDIT.md) with severity × effort triage.
1 wont-fix (WNF-001: hreflang — single-locale SEO intentional WARN), 5 fixed (08fe620).
See [TECH_DEBT_AUDIT.md](TECH_DEBT_AUDIT.md) for full history.

## Support

Found an .ithmb file that doesn't decode? [Open an issue on the codec repo](https://github.com/B67687/Ithmb-Codec/issues).

Enjoying the tool? [Buy me a coffee](https://buymeacoffee.com/thumbnami).

## Built with

Rust, WebAssembly, and TypeScript.

## License

MIT — see [LICENSE](LICENSE). Free to fork, audit, and improve.
