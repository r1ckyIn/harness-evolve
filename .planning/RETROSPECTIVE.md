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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Commits | Phases | Key Change |
|-----------|---------|--------|------------|
| v1.0 | 121 | 8 | Initial pipeline build with bottom-up phase structure |

### Cumulative Quality

| Milestone | Tests | LOC (src) | LOC (test) |
|-----------|-------|-----------|------------|
| v1.0 | 336 | 3,765 | 7,968 |

### Top Lessons (Verified Across Milestones)

1. Wire integration per phase, not post-hoc (v1.0: 3 gaps caught in Phase 7)
2. Shared string enums for cross-module constants (v1.0: inferPatternType drift)
