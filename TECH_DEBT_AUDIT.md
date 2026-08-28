# TECH_DEBT_AUDIT.md — Technical Debt Inventory

> **Reviewed:** 2026-08-28
> **Purpose:** Triaged list of known technical debt with severity × effort.
> Per §4 rows 4.7/4.8 of the Engineering Plugin: this file must exist and be triaged for a REVIEW gate to PASS.

## Severity × Effort Matrix

| Severity | Effort | Description |
|----------|--------|-------------|
| **Critical** | — | Blocks CI, security, or data loss |
| **High** | — | Affects users or test reliability |
| **Medium** | — | Code quality, maintainability |
| **Low** | — | Cosmetic, informational |

| Effort | Description |
|--------|-------------|
| **S** (small) | < 30 min, single file |
| **M** (medium) | 1-2 hours, multiple files |
| **L** (large) | Half day+, architectural change |

## Open Items

| ID | Description | Severity | Effort | Status | Notes |
|----|-------------|----------|--------|--------|-------|
| TD-01 | Batch path in FEATURES.md §10 — stale reference to `batch:true` | Low | S | **Fixed** | Removed in 2026-08-27 audit |
| TD-02 | Batch endpoint in workers/telemetry/README.md — stale doc lines | Low | S | **Fixed** | Consolidated in 2026-08-27 audit |
| TD-03 | No unit test layer (only Playwright integration) | Medium | M | **Fixed** | vitest added 2026-08-27, 48+ tests in `tests/unit/` |
| TD-15 | a11y spec logs violations but doesn't fail CI | High | S | **Fixed** | Now authoritative — blocks CI on critical/serious violations |
| TD-16 | Worker monolith (740 lines single file) | Medium | M | **Fixed** | Decomposed into 6 modules (worker/ subdirectory), all ≤ 250 LOC |
| WNF-001 | hreflang alternates missing (26) — intentional WARN | Low | S | **Wont-Fix** | Single-locale SEO not priority; zh/ mirrors are navigation aids, not SEO targets. Overhead not worth. check-local.sh warns but exits 0. |

## Resolved Items

| ID | Description | Resolved | Resolution |
|----|-------------|----------|------------|
| TD-01 | Stale batch:true in FEATURES.md | 2026-08-27 | Removed reference |
| TD-02 | Stale batch endpoint in Worker README | 2026-08-27 | Consolidated doc lines |
| TD-03 | No vitest unit tests | 2026-08-27 | Added vitest + 48 tests across 3 files |
| TD-15 | a11y not failing CI | 2026-08-27 | Added assertion + KNOWN_A11Y_EXCLUSIONS |
| TD-16 | Worker monolith | 2026-08-27 | Split into 6 modules |

## Future Considerations

| ID | Description | Severity | Effort | Notes |
|----|-------------|----------|--------|-------|
| TD-20 | Enterprise page uses hardcoded colors (not CSS variables) | Low | M | Documented as intentional "under construction" design |
| TD-21 | Shared mutable arrays (successfulDecodes/failedDecodes) | Medium | L | Multiple writers, no encapsulation — past bug class |
| TD-22 | WASM/loader hand-adapted contract | High | L | Single most fragile integration point; check-wasm-drift.sh mitigates |
| TD-23 | Two counters: S.totalFiles vs S.cardCount | Medium | M | Drift possible, currently consistent |

---

_End of audit. Reviewed: 2026-08-28. Per Engineering Plugin §4.4, this file must be updated alongside code changes._
