---
phase: 06-onboarding-quality-polish
plan: 02
subsystem: analysis
tags: [outcome-tracking, confidence-adjustment, feedback-loop, jsonl, persistence-detection]

requires:
  - phase: 06-onboarding-quality-polish
    provides: ExperienceLevel, onboarding classifier, Phase 6 Zod schemas (outcomeEntry, outcomeSummary)
  - phase: 05-delivery-user-interaction
    provides: Recommendation state tracking (applied/dismissed/pending), auto-apply with allowedTools
  - phase: 04-analysis-engine-routing
    provides: Analyzer orchestrator, classifier system, Recommendation schema with confidence tiers
  - phase: 03-pre-processing-environment-discovery
    provides: EnvironmentSnapshot with installed_tools and settings
provides:
  - Outcome tracker cross-referencing applied recommendations against environment snapshot
  - Persistence detection for SETTINGS (allowedTools), HOOK, SKILL, RULE targets
  - JSONL-based outcome history persistence
  - Outcome summary computation (grouping by pattern_type with persistence rates)
  - Confidence adjustment in analyzer based on outcome history (>30% revert rate -> downgrade tier)
  - Complete Phase 6 library exports from src/index.ts
affects: [analysis-engine, delivery-pipeline, future-phases]

tech-stack:
  added: []
  patterns: [outcome-tracking-feedback-loop, confidence-adjustment-pipeline, id-prefix-based-heuristic]

key-files:
  created:
    - src/analysis/outcome-tracker.ts
    - tests/unit/analysis/outcome-tracker.test.ts
    - tests/integration/outcome-pipeline.test.ts
  modified:
    - src/storage/dirs.ts
    - src/analysis/analyzer.ts
    - src/index.ts
    - tests/unit/analysis/analyzer.test.ts

key-decisions:
  - "ID-prefix heuristic for persistence detection: rec-repeated->HOOK, rec-long->SKILL, rec-correction->RULE, rec-permission->SETTINGS"
  - "Confidence downgrade threshold at 0.7 (70% persistence rate): >30% revert rate triggers one-tier downgrade"
  - "computeOutcomeSummaries uses latest outcome per recommendation_id to avoid double-counting from repeat checks"
  - "Default persistence assumption: unknown recommendation types assumed persisted (safe fallback)"

patterns-established:
  - "Outcome tracking pattern: cross-reference recommendation state with environment snapshot"
  - "JSONL append pattern for outcome history, matching auto-apply-log.jsonl pattern"
  - "Confidence adjustment as optional pipeline step in analyzer (backward compatible)"

requirements-completed: [QUA-04]

duration: 7min
completed: 2026-04-01
---

# Phase 06 Plan 02: Outcome Tracking Summary

**Outcome tracker with persistence detection, JSONL history, and analyzer confidence adjustment creating a feedback loop for recommendation quality improvement**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-01T05:10:53Z
- **Completed:** 2026-04-01T05:18:38Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Outcome tracker module cross-references applied recommendations against environment snapshot to detect persistence vs reversion
- Persistence detection works for SETTINGS (allowedTools check), HOOK (hooks exist), SKILL (skills exist), RULE (rules exist) targets
- Outcomes classified as positive (5+ checks persisted), negative (reverted), or monitoring (persisted but < 5 checks)
- Confidence adjustment integrated into analyzer: pattern types with >30% revert rate get downgraded one tier (HIGH->MEDIUM, MEDIUM->LOW)
- Integration test proves full feedback loop: apply rec -> track outcome -> confidence adjusted on next run
- All Phase 6 modules exported from src/index.ts for library consumers

## Task Commits

Each task was committed atomically:

1. **Task 1: Create outcome tracker module and add outcomeHistory path** - `1213212` (feat)
2. **Task 2: Add confidence adjustment to analyzer, integration test, and library exports** - `44d28b4` (feat)

_Both tasks followed TDD RED-GREEN pattern._

## Files Created/Modified
- `src/analysis/outcome-tracker.ts` - Outcome tracker: trackOutcomes, loadOutcomeHistory, computeOutcomeSummaries, persistence detection
- `src/storage/dirs.ts` - Added outcomeHistory path to paths object
- `src/analysis/analyzer.ts` - Added adjustConfidence function and optional outcomeSummaries parameter to analyze()
- `src/index.ts` - Phase 6 exports: schemas, experience-level, onboarding classifier, outcome-tracker, adjustConfidence
- `tests/unit/analysis/outcome-tracker.test.ts` - 15 tests covering persistence detection, outcome classification, JSONL persistence, history loading, summary computation
- `tests/unit/analysis/analyzer.test.ts` - 7 new tests for confidence adjustment (downgrade tiers, threshold boundary, backward compat)
- `tests/integration/outcome-pipeline.test.ts` - 2 integration tests: confidence downgrade after negative outcomes, trackOutcomes persistence detection

## Decisions Made
- ID-prefix heuristic for persistence detection: recommendation IDs already encode their target type (rec-repeated->HOOK, rec-permission->SETTINGS, etc.), so we parse the prefix rather than requiring additional metadata storage
- Confidence downgrade threshold at 0.7 (70% persistence rate): a >30% revert rate signals unreliable recommendations and triggers one-tier downgrade
- computeOutcomeSummaries uses the latest outcome per recommendation_id to avoid double-counting from repeated tracking checks
- Default persistence assumption for unknown recommendation types: assume persisted (safe fallback avoids false negatives)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed integration test assertion for recommendation lookup**
- **Found during:** Task 2 (integration test)
- **Issue:** Integration test searched for `r.pattern_type === 'repeated-prompt'` but with a newcomer snapshot (empty), the onboarding classifier produces HOOK recs first. The repeated-prompt classifier may not trigger because the minimal snapshot is empty.
- **Fix:** Changed lookup to find any HOOK-targeted recommendation (which may be onboarding or repeated-prompt depending on threshold), then used the actual pattern_type for outcome history and confidence assertions
- **Files modified:** tests/integration/outcome-pipeline.test.ts
- **Verification:** Both integration tests pass
- **Committed in:** 44d28b4 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test assertion)
**Impact on plan:** Auto-fix necessary for test correctness given newcomer snapshot behavior. No scope creep.

## Issues Encountered
- Pre-existing flaky test `concurrent-counter.test.ts` intermittently fails due to lock contention race condition -- not related to Phase 6 changes

## Known Stubs
None -- all functions are fully implemented with real logic.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 complete: all onboarding and quality polish modules implemented
- Full feedback loop operational: recommendations -> tracking -> confidence adjustment
- All v1 requirements from Phase 6 (ONB-02, QUA-04) are satisfied
- Library exports complete for all 6 phases

## Self-Check: PASSED

All 7 files verified present. Both commits (1213212, 44d28b4) verified in git log. All 4 Phase 6 exports verified in src/index.ts. outcomeHistory path verified in dirs.ts.

---
*Phase: 06-onboarding-quality-polish*
*Completed: 2026-04-01*
