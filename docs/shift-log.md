# Shift Log

> Per RULES section 5, this log records up to 5 learning shifts. Each shift is a documented discovery, not a failure. Moved to `docs/` to keep zero `.omo/` content on public repos.

```
LEARNING SHIFT
What we learned: agents repeatedly fail to actually write governance docs, producing summaries instead of files.
Decision: the orchestrator writes the web governance docs deterministically rather than relying on a doc-writing agent.
Cost: orchestrator context and time.
What this enables: reliable delivery of SPECIFICATION, EXPLAINER, RULES, and PROJECT_MODEL without agent stall loops.
```

```
LEARNING SHIFT
What we learned: a blanket npm `ignore-scripts` would break the esbuild postinstall and the CI build.
Decision: skip `ignore-scripts` for this repo; keep the tracked lockfile with hashes as the supply-chain control.
Cost: slightly weaker install-script control than the strictest posture.
What this enables: a working `npm ci` + `npm run build` pipeline in CI.
```

```
LEARNING SHIFT
What we learned: the `.gitignore` whitelist silently excluded `theme.ts` and broke CI, so it was deliberately removed (commit 93b5928).
Decision: keep an explicit-ignore `.gitignore` (with secret patterns) instead of a `/*` whitelist.
Cost: two standards-audit gitignore checks are marked not-applicable.
What this enables: reliable tracking of all source files including `theme.ts`.
```

```
LEARNING SHIFT
What we learned: the CI source of truth is the Dev repo, not the public repo, under a four-layer model.
Decision: CI runs on `Ithmb-Codec-Web-Dev.git`; the public repo is append-only and never runs CI.
Cost: a second private repo to manage.
What this enables: validating every change on the private repo before any public release.
```

```
LEARNING SHIFT
What we learned: webkit cannot run in the local dev environment.
Decision: webkit is verified only in CI; local runs use chromium/firefox.
Cost: a small verification gap for local iteration.
What this enables: a full 3-browser matrix in CI while keeping local runs fast.
```
