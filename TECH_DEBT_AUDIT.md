# TECH_DEBT_AUDIT.md — Ithmb-Codec-Web

> **Generated:** 2026-09-02 | **HEAD:** main | **Method:** 9-dim audit (grep + ast-grep + tsc) | **Auditor:** Sisyphus
> **Stack:** TypeScript (strict), Vite/WASM, Playwright + Vitest, Cloudflare Worker | **LOC:** ~10k TS

## Severity × Effort Matrix

| Severity | Effort | Description                       |
| -------- | ------ | --------------------------------- |
| Critical | —      | Blocks CI, security, or data loss |
| High     | —      | Affects users or test reliability |
| Medium   | —      | Code quality, maintainability     |
| Low      | —      | Cosmetic, informational           |

| Effort | S <30m single file | M 1-2h multi-file | L half-day+ arch |

## Active (2026-09-02 scan — 5 Trivial/Low + 1 Moderate)

| ID      | Description                                                       | File:Line                                                               | Severity     | Effort | Status    | Recommendation                                                                  |
| ------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------ | ------ | --------- | ------------------------------------------------------------------------------- |
| WB-01   | 3 `console.log` left in prod                                      | `src/ithmb-decoder/app.ts:48,52,65`                                     | Trivial      | S      | Open      | Remove or gate behind `import.meta.env.DEV`, keep `console.warn/error` for prod |
| WB-02   | 3 over-exported symbols never imported                            | `src/ithmb-decoder/share-actions.ts:10,12` `src/telemetry.ts:13`        | Trivial      | S      | Open      | Remove `export` or add `// exported for test` comment                           |
| WB-03   | `prevViewer`/`nextViewer` near-duplicate                          | `src/ithmb-decoder/viewer.ts:184-197`                                   | Trivial      | S      | Open      | Collapse to `navigateViewer(dir: -1                                             | 1)` |
| WB-04   | `ithmb-decoder/decoder.ts` has 0 unit tests (only Playwright e2e) | `src/ithmb-decoder/decoder.ts`                                          | **Moderate** | M      | Open      | **Highest priority** — add Vitest unit layer for core decoder (mock WASM)       |
| WB-05   | `escapeHtml` duplicated `utils.ts:20` vs `workers/crypto.ts:117`  | `src/ithmb-decoder/utils.ts:20` ↔ `workers/telemetry/src/crypto.ts:117` | Low          | —      | Accepted  | Intentional — browser vs Worker boundary isolates; no change                    |
| WB-06   | Unused `app.ts:14` `lastToastParams` flagged dead                 | `src/ithmb-decoder/app.ts:14`                                           | Trivial      | S      | **Fixed** | Was false positive — now used for toast dedup                                   |
| WNF-001 | hreflang alternates missing (26) — intentional WARN               | `check-local.sh`                                                        | Low          | S      | Wont-Fix  | Single-locale SEO not priority; zh/ mirrors are navigation aids                 |

Full 9 dims otherwise clean: **0 `as any`/`@ts-ignore`, 0 `TODO`/`FIXME`, 0 `eval`/`innerHTML`, 0 `await` in loop, 0 empty `catch`, 0 `SELECT *`**. `npm audit` clean (WSL run may show `ETARGET` but CI `audit` is green).

## Resolved Items (history)

| ID    | Description                           | Resolved   | Resolution                                |
| ----- | ------------------------------------- | ---------- | ----------------------------------------- |
| TD-01 | Stale `batch:true` in FEATURES.md     | 2026-08-27 | Removed reference                         |
| TD-02 | Stale batch endpoint in Worker README | 2026-08-27 | Consolidated                              |
| TD-03 | No vitest unit tests                  | 2026-08-27 | Added vitest + 48 tests across 3 files    |
| TD-15 | a11y not failing CI                   | 2026-08-27 | Added assertion + `KNOWN_A11Y_EXCLUSIONS` |
| TD-16 | Worker monolith 740 lines             | 2026-08-27 | Split into 6 modules (≤250 LOC)           |

## Future Considerations (accepted, not active)

| ID    | Description                                                 | Severity | Effort | Notes                                               |
| ----- | ----------------------------------------------------------- | -------- | ------ | --------------------------------------------------- |
| TD-20 | Enterprise page hardcoded colors (not CSS vars)             | Low      | M      | Intentional "under construction" design             |
| TD-21 | Shared mutable arrays (`successfulDecodes`/`failedDecodes`) | Medium   | L      | Multiple writers, no encapsulation — past bug class |
| TD-22 | WASM/loader hand-adapted contract (`ithmb_wasm.js`)         | High     | L      | Most fragile point; `check-wasm-drift.sh` mitigates |
| TD-23 | Two counters: `S.totalFiles` vs `S.cardCount`               | Medium   | M      | Drift possible, currently consistent                |

## Top 5 Priorities (impact/effort)

1. **WB-04** — decoder unit tests (M) — only real coverage gap
2. **WB-03** — collapse viewer nav duplication (S) — 5 min
3. **WB-01** — remove console.log (S) — 10 min
4. **WB-02** — trim exports (S) — 5 min
5. **WB-05** — accepted, no action

## Quick Wins Checklist (<30m each)

- [ ] `app.ts:48,52,65` remove `console.log` (10 min)
- [ ] `share-actions.ts:10,12` + `telemetry.ts:13` remove `export` (5 min)
- [ ] `viewer.ts:184-197` merge prev/next → `navigate(dir)` (15 min)
- [ ] Add 3 decoder unit tests mocking WASM (follow existing `tests/unit/` pattern)

## "Looks Bad But Is Fine"

- **`utils.ts` vs `workers/crypto.ts` `escapeHtml`** — Intentional duplication; Worker cannot import browser bundle.
- **`worker.ts` 6 modules after split** — Was monolith, now ≤250 LOC each. Not debt.
- **Wasm loader hand-adapted** — Flagged TD-22 but mitigated by `check-wasm-drift.sh`.

## Open Questions

1. Should `decoder.ts` vitest target `wbg` mock or real `ithmb_wasm_bg.wasm`?
2. Keep `console.log` behind `DEV` flag or delete entirely?

---

_Generated 2026-09-02. Per Engineering Plugin §4.7, keep triaged for REVIEW gate._
