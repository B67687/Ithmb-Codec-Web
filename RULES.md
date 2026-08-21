# RULES.md: Agent Operating Rules

> A meta-protocol that adapts to ANY project type.
> Read this at the START of every AI session. It defines the current phase, scope constraints,
> agent persona, stop rules, verification gates, and the immutable project constitution.
> The AI enforces phase/scope boundaries: if asked to do something outside scope
> or current phase, it MUST refuse and explain why.
>
> **Current: POLISHED**

---
## Table of Contents

| # | Section |
|---|---|
| 1 | Project Type Routing |
| 2 | Intent Decomposition |
| 3 | Constitution |
| 4 | Phase Definitions |
| 5 | V1 Scope & Learning Shifts |
| 6 | AI Persona & Constraints |
| 7 | Stop Rules |
| 8 | Verification Gates |
| 9 | Test Philosophy |
| 10 | Evolution & Phase Exit |
| 11 | Known Failure Patterns |
| 12 | Session Kickoff |

---

## 1. Project Type Routing

Classify the work before starting:

- If the request is a **bug fix**, route to the debugging path: reproduce, isolate root cause, fix minimally, verify.
- If the request is a **feature**, route to the spec path: update SPECIFICATION, then implement, then test.
- If the request is a **docs/ops change**, route to the docs path: update the relevant docs, verify gates.
- If the request is **ambiguous**, classify via Cynefin (section 2) before acting.

**This project (Ithmb-Codec-Web):** routed as a **production web application**: a privacy-first static site plus a Cloudflare telemetry worker. It runs the full Tier 1-3 spec and the complete verification gate suite.

Sub-cycles (telemetry worker, i18n, build pipeline) route the same way but with their own focused gates.

## 2. Intent Decomposition

- **Clear** (single file, known fix): act directly.
- **Complicated** (multi-step, known domain): decompose into steps, follow gates.
- **Complex** (unknown domain, emergent): research and validate before implementing; use the spec path.
- **Chaotic** (broken, unclear): stop and restore a known-good state before proceeding.

## 3. Constitution

The Constitution in SPECIFICATION section 0 applies to all agent work. The most important rules for agents:

1. **Privacy first.** Never add code that sends user data automatically.
2. **No magic.** Every build step and network call must be discoverable.
3. **Test what matters.** Protect the decode path, i18n parity, and telemetry privacy.
4. **Tool-first.** Use the canonical scripts and gates.

## 4. Phase Definitions

| Phase | Meaning |
|---|---|
| IDEA | A concept before any design |
| SPEC'D | Written down in the SPECIFICATION |
| PROTOTYPED | A working sketch exists |
| IMPLEMENTED | Feature-complete and tested |
| POLISHED | REVIEW remediation complete, all gates green |
| SHIPPED | Released to the public surface |
| MAINTAINED | Sustained with fixes |
| EVOLVED | Significant new capability added |

## 5. V1 Scope & Learning Shifts

**IN SCOPE (V1):**
- In-browser decoding of .ithmb files via WASM.
- Static informational pages and en/zh internationalization.
- Opt-in, quiet-by-default telemetry with a privacy contract.
- Full browser test matrix and Dev-repo CI.

**OUT OF SCOPE (V1):**
- Server-side decoding, accounts, saved history, third-party APIs.

**NO-GOS:**
- No automatic telemetry sends.
- No replacement of the hand-adapted `ithmb_wasm.js`.
- No dependency added without a Y-Statement.

**LEARNING SHIFT** (recorded in `docs/shift-log.md`, max 5):

```
LEARNING SHIFT
What we learned: agents repeatedly fail to actually write governance docs, producing summaries instead.
Decision: the orchestrator writes the web governance docs deterministically.
Cost: orchestrator context and time.
What this enables: reliable doc delivery without agent stall loops.
```

## 6. AI Persona & Constraints

- You are an expert web engineer working on a privacy-first decoder.
- Prefer the canonical tooling: `npm run build`, `npm run typecheck`, `npm test`, `npm run test:worker`, `scripts/check-local.sh`.
- Make decisions using the spec and the Y-Statement format when a real tradeoff exists.
- Never commit `.omo/` content except the tracked shift-log; never push to the public remote without explicit go.

## 7. Stop Rules

- Stop if a verification gate fails and you cannot explain why.
- Stop if a change would violate the privacy-first constitution.
- Stop if you are about to replace generated or hand-adapted files without a Y-Statement.
- Stop and report if the build, tests, or a gate regresses without a clear cause.

## 8. Verification Gates

| Gate | Command |
|---|---|
| Build | `npm run build` |
| Typecheck | `npm run typecheck` |
| Test | `npm test` (3 browser projects) |
| Worker | `npm run test:worker` |
| i18n parity | `npm run lint:i18n` |
| WASM drift | `scripts/check-wasm-drift.sh` |
| Secrets | gitleaks (pre-commit) |
| Local CI parity | `scripts/check-local.sh` |

**SPEC SYNC:** if code changes the behavior described in SPECIFICATION or EXPLAINER, update those docs in the same change.

## 9. Test Philosophy

- Test the decode path, the i18n mirrors, and the telemetry privacy contract with the highest priority.
- Prefer behavior-level Playwright tests over brittle selectors.
- Every issue type in the report modal and every share action must be covered.
- Test edge cases: empty files, oversized files (>8MB full-share hidden), decode failures, boundary sizes.
- A change is not done until the relevant tests pass and no suite regresses.

## 10. Evolution & Phase Exit

- Exit POLISHED to SHIPPED only when all gates are green and REVIEW passes.
- Any later regression sends the project back to an earlier phase per PROJECT_MODEL valid transitions.
- New capabilities enter via the spec path and a Y-Statement.

## 11. Known Failure Patterns

| ID | Pattern | Mitigation |
|---|---|---|
| FP-1 | Agent writes a summary instead of files | Orchestrator verifies files on disk |
| FP-2 | Replacing the hand-adapted wasm loader | Never replace `ithmb_wasm.js` without a Y-Statement |
| FP-3 | i18n mirror drift | Always run `lint:i18n` |
| FP-4 | WASM drift after engine update | Always run `check-wasm-drift.sh` |
| FP-5 | Accidental auto-send in telemetry | Enforce quiet-by-default; review worker changes |
| FP-6 | Committing `.omo/` or pushing public | `.omo/` exempt; public push only on explicit go |

## 12. Session Kickoff

At the start of any session:

1. Confirm repo identity and remote layout: `git status`, `git remote -v`, `git log --oneline -5`. `origin` must point at `Ithmb-Codec-Web-Dev.git`.
2. Read `AGENTS.md` for the repo map.
3. Read this `RULES.md` and SPECIFICATION section 0.
4. Confirm the current phase in `docs/PROJECT_MODEL.md`.
5. Only then start work.
