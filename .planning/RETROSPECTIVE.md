# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Self-Iteration Engine

**Shipped:** 2026-04-02
**Phases:** 8 | **Plans:** 21 | **Tasks:** 39

### What Was Built
- Complete self-improving feedback loop: capture user interactions via 5 lifecycle hooks, persist as JSONL with secret scrubbing, pre-process into compressed summaries, classify patterns through 8 classifiers, route to 7+ config targets, deliver recommendations via dual-channel (stdout + /evolve), and track outcomes for confidence adjustment
- 11,733 LOC TypeScript (3,765 src + 7,968 tests), 336 tests across 37 files
- Environment-agnostic design: dynamically discovers installed tools (GSD, Cog, plugins) and adapts routing

### What Worked
- Bottom-up phase structure (storage -> hooks -> pre-processing -> analysis -> delivery -> polish -> integration) allowed clean dependency flow — each phase built on the previous
- Zod v4 schemas as single source of truth for all data structures — type safety propagated from config to hooks to analysis to delivery
- TDD approach kept test coverage high naturally (2:1 test-to-src ratio)
- Integration phases (7, 8) at the end successfully caught and closed cross-phase wiring gaps
- GSD workflow tracked 121 commits across 21 plans with clear traceability

### What Was Inefficient
- Phase 7-8 gap closure could have been avoided if integration wiring was tested incrementally per phase rather than deferred to end
- SUMMARY.md frontmatter requirements coverage was inconsistent (21/41 missing) — should enforce during plan execution, not retrofit
- 13 human verification items accumulated without a systematic way to batch-validate them
- inferPatternType string mismatch (7/8 classifiers) was a design oversight that persisted across Phase 4-6 without detection

### Patterns Established
- Handler pattern: export handleX(rawJson) for testability, main() wraps readStdin
- vi.mock with getter pattern for dirs.js isolation in tests
- proper-lockfile for cross-process file operations on macOS
- Config-gated feature flags (stdoutInjection, fullAuto) for progressive capability exposure
- ID-prefix heuristic (rec-{target}-{N}) for type inference without schema lookup

### Key Lessons
1. **Wire integration tests per phase, not at the end** — Phase 7 found 3 broken connections that would have been caught earlier with cross-phase integration tests in each phase
2. **String constants across module boundaries need a shared enum** — the inferPatternType mismatch showed that two modules using the same string values without a shared definition will drift
3. **Pre-processing is essential for hook-based systems** — raw JSONL logs are unbounded, shell pre-processing to <50KB is what makes agent analysis feasible
4. **Restrict auto-apply scope aggressively in v1** — limiting to permissions-only auto-apply was the right call for safety; expand scope gradually based on outcome tracking data

### Cost Observations
- Model mix: primarily opus for planning/architecture, sonnet for execution
- Timeline: 2 days (2026-03-31 to 2026-04-01) for full 8-phase pipeline
- Notable: Phase 4 Plan 01 was the longest (26min) due to analyzer orchestrator complexity; most plans completed in 3-7 minutes

---

## Milestone: v1.1 — Stabilization & Production

**Shipped:** 2026-04-04
**Phases:** 3 | **Plans:** 7 | **Tasks:** 12

### What Was Built
- Fixed self-iteration feedback loop: PatternType Zod enum with 13 values corrects string mismatches for 7/8 classifiers
- Hardened concurrent-counter test: proper-lockfile retry (50 retries, 20-1000ms jitter) eliminates ELOCKED flakes
- Strategy pattern applier registry: extensible auto-apply dispatch with SETTINGS + RULE appliers (create-only rule files)
- npm package: complete metadata, files whitelist, ESM exports map (8 subpaths), publishable with publint+attw validation
- CI/CD: GitHub Actions CI (build+test+typecheck+publint+attw) + Publish workflow with npm OIDC trusted publishing
- Commander.js CLI: `init` (hook registration with path resolution), `status` (4 fields), `uninstall` (selective removal + --purge)
- 14,246 LOC TypeScript, 441 tests across 44 files

### What Worked
- Hard dependency chain (tech debt -> npm -> CLI) was correct — each phase was genuinely blocked by the previous
- Strategy pattern for applier registry enables clean extension without modifying existing code
- import.meta.dirname for hook path resolution elegantly handles global/npx/git-clone install diversity
- TDD continued to catch issues early — init command backup/merge logic was validated before full wiring

### What Was Inefficient
- Phase 9 ROADMAP.md wasn't marked with `[x]` after completion — required manual fixup
- v1.0's inferPatternType mismatch should have been caught by Phase 4's verification, not deferred to v1.1 tech debt

### Patterns Established
- Strategy pattern for extensible auto-apply dispatch (registerApplier/getApplier/hasApplier)
- RuleApplier create-only convention: never overwrite existing rule files to respect user customizations
- npm files whitelist over .npmignore for explicit tarball control
- tsup DTS exclusion for CLI bin entries (not imported as libraries)
- Hook path resolution via import.meta.dirname with baseDirOverride for testability

### Key Lessons
1. **Lock retry params matter for CI** — default lock retries are insufficient for 2-vCPU CI runners; explicit retry count + jitter backoff eliminates flakes
2. **Publish validation tooling catches real issues** — publint and attw found exports map problems that manual testing missed
3. **CLI path resolution is the dominant install risk** — npx ephemeral paths break on package update; detection + warning is the right UX
4. **Stabilization milestones are fast** — 3 phases completed in ~2 hours; clear scope + no design ambiguity = high velocity

### Cost Observations
- Model mix: opus for planning, executor agents for implementation
- Timeline: 1 day (2026-04-03 to 2026-04-04)
- Notable: 39 commits across 7 plans, 51 files changed, 7,552 insertions

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 121 | 8 | Initial pipeline build with bottom-up phase structure |
| v1.1 | 39 | 3 | Stabilization, npm publish, CLI commands |

### Cumulative Quality

| Milestone | Tests | LOC (src) | LOC (test) |
|-----------|-------|-----------|------------|
| v1.0 | 336 | 3,765 | 7,968 |
| v1.1 | 441 | ~5,200 | ~9,000 |

### Top Lessons (Verified Across Milestones)

1. Wire integration per phase, not post-hoc (v1.0: 3 gaps caught in Phase 7)
2. Shared string enums for cross-module constants (v1.0: inferPatternType drift, v1.1: PatternType Zod enum fixed it)
3. Lock retry params for CI environments need explicit tuning (v1.1: 50 retries + jitter)
4. Publish validation tooling (publint, attw) catches real issues manual testing misses (v1.1)
