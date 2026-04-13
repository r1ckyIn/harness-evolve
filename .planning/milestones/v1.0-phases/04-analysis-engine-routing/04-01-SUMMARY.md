---
phase: 04-analysis-engine-routing
plan: 01
subsystem: analysis
tags: [zod, classifier, recommendation, routing, pattern-detection]

requires:
  - phase: 03-pre-processing-environment-discovery
    provides: "Summary and EnvironmentSnapshot schemas, pre-processor pipeline"
provides:
  - "Recommendation, RoutingTarget, Confidence, AnalysisConfig, AnalysisResult Zod v4 schemas"
  - "analyze() orchestrator function with classifier chain pattern"
  - "classifyRepeatedPrompts: short prompts -> HOOK"
  - "classifyLongPrompts: long prompts -> SKILL"
  - "classifyPermissionPatterns: permission approvals -> SETTINGS"
  - "Classifier type and registry for extensibility"
affects: [04-02, 04-03, 05-delivery]

tech-stack:
  added: []
  patterns: [classifier-chain-strategy, confidence-tier-sorting, configurable-thresholds-with-defaults]

key-files:
  created:
    - src/schemas/recommendation.ts
    - src/analysis/analyzer.ts
    - src/analysis/classifiers/index.ts
    - src/analysis/classifiers/repeated-prompts.ts
    - src/analysis/classifiers/long-prompts.ts
    - src/analysis/classifiers/permission-patterns.ts
    - tests/unit/analysis/analyzer.test.ts
    - tests/unit/analysis/helpers.ts
    - tests/unit/analysis/classifiers/repeated-prompts.test.ts
    - tests/unit/analysis/classifiers/long-prompts.test.ts
    - tests/unit/analysis/classifiers/permission-patterns.test.ts
  modified:
    - src/schemas/config.ts
    - src/analysis/classifiers/index.ts
    - .gitignore

key-decisions:
  - "Used factory function defaults (.default(() => ({...}))) for Zod v4 nested object schemas to satisfy TypeScript 6 strict mode"
  - "Deterministic index-based recommendation IDs (rec-repeated-0, rec-long-1, rec-perm-0) for testability"
  - "Word count > 50 as boundary between short prompts (HOOK) and long prompts (SKILL) classifiers"

patterns-established:
  - "Classifier chain: each classifier is a pure function (Summary, Snapshot, Config) => Recommendation[], registered in classifiers/index.ts array"
  - "Confidence assignment: HIGH/MEDIUM based on configurable count+session thresholds"
  - "Test helpers in tests/unit/analysis/helpers.ts: makeEmptySummary(), makeEmptySnapshot(), makeDefaultConfig()"

requirements-completed: [ANL-02, ANL-03, ANL-04, ANL-05, RTG-01, RTG-02, RTG-03, RTG-07]

duration: 26min
completed: 2026-04-01
---

# Phase 04 Plan 01: Analysis Engine Core Summary

**Recommendation schemas, analyzer orchestrator with classifier chain, and three core classifiers (repeated-prompts->HOOK, long-prompts->SKILL, permission-patterns->SETTINGS) with configurable thresholds**

## Performance

- **Duration:** 26 min
- **Started:** 2026-04-01T00:55:02Z
- **Completed:** 2026-04-01T01:21:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Established all analysis engine type contracts: Recommendation, RoutingTarget, Confidence, AnalysisConfig, AnalysisResult as Zod v4 schemas
- Analyzer orchestrator with classifier chain pattern: iterates registered classifiers, sorts by confidence, caps at configurable max
- Three core HIGH-signal classifiers covering the most deterministic patterns: repeated short prompts, long repeated prompts, and permission approval patterns
- Extended config.ts with classifierThresholds for power user override
- 24 unit tests (7 analyzer + 6 repeated-prompts + 5 long-prompts + 6 permission-patterns) all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Recommendation schemas, analysis config, and analyzer orchestrator with tests** - `73ad5aa` (feat)
2. **Task 2: Core classifiers -- repeated prompts, long prompts, permission patterns** - `c93888c` (feat)

## Files Created/Modified
- `src/schemas/recommendation.ts` - Recommendation, RoutingTarget, Confidence, AnalysisConfig, AnalysisResult Zod v4 schemas
- `src/schemas/config.ts` - Added classifierThresholds to analysis section
- `src/analysis/analyzer.ts` - Main analyze() orchestrator: iterates classifiers, sorts by confidence, caps results
- `src/analysis/classifiers/index.ts` - Classifier type definition and registry array
- `src/analysis/classifiers/repeated-prompts.ts` - Short prompts (count>=5, <=50 words) -> HOOK
- `src/analysis/classifiers/long-prompts.ts` - Long prompts (>=200 words, count>=2) -> SKILL
- `src/analysis/classifiers/permission-patterns.ts` - Tool approvals (count>=10, sessions>=3) -> SETTINGS
- `tests/unit/analysis/analyzer.test.ts` - 7 tests: empty summary, schema validation, classifier iteration, confidence sorting, cap, defaults
- `tests/unit/analysis/helpers.ts` - Shared test factories: makeEmptySummary, makeEmptySnapshot, makeDefaultConfig
- `tests/unit/analysis/classifiers/repeated-prompts.test.ts` - 6 tests: HIGH/MEDIUM/threshold/word-count/multiple/empty
- `tests/unit/analysis/classifiers/long-prompts.test.ts` - 5 tests: HIGH/MEDIUM/word-threshold/count-threshold/empty
- `tests/unit/analysis/classifiers/permission-patterns.test.ts` - 6 tests: HIGH/MEDIUM/count-threshold/session-threshold/allowedTools/empty
- `.gitignore` - Added .claude/ directory exclusion

## Decisions Made
- Used factory function defaults (`.default(() => ({...}))`) for Zod v4 nested object schemas -- TypeScript 6 strict mode requires explicit default values matching the full output type; `.default({})` fails type checking even though Zod handles it at runtime
- Deterministic index-based recommendation IDs (`rec-repeated-0`, `rec-long-1`) instead of timestamp-based -- enables reliable assertions in tests
- Word count boundary of 50 words between short prompts (HOOK classifier) and long prompts (SKILL classifier) -- prevents overlap between the two classifiers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Zod v4 default({}) type error with TypeScript 6**
- **Found during:** Task 1 (recommendation schema creation)
- **Issue:** `.default({})` on `z.object()` with `.default()` fields fails TypeScript 6 type checking (overload mismatch)
- **Fix:** Extracted DEFAULT_THRESHOLDS constant, used factory function pattern `.default(() => ({ ...DEFAULT_THRESHOLDS }))` for both inner and outer objects
- **Files modified:** src/schemas/recommendation.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 73ad5aa (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added .claude/ to .gitignore**
- **Found during:** Task 1 (pre-commit file check)
- **Issue:** `.claude/worktrees/` directory was untracked and would be committed
- **Fix:** Added `.claude/` to `.gitignore`
- **Files modified:** .gitignore
- **Committed in:** 73ad5aa (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both essential for correct builds and clean git state. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Analysis engine core contracts are established, ready for Plan 02 (additional classifiers: code-corrections, personal-info, config-drift, ecosystem-adapter)
- Plan 03 (trigger mechanism) can use the analyze() function directly
- Classifier registry is extensible -- future classifiers only need to implement the Classifier type and push to the array

## Self-Check: PASSED

- All 13 created/modified files verified present on disk
- Commit 73ad5aa verified in git log
- Commit c93888c verified in git log
- 24 unit tests passing (7 analyzer + 17 classifiers)
- TypeScript type check clean

---
*Phase: 04-analysis-engine-routing*
*Completed: 2026-04-01*
