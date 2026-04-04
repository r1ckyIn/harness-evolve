---
phase: 17-bug-fixes-reliability
plan: 02
subsystem: delivery
tags: [applier, confidence-gate, notification, cli, auto-apply]

requires:
  - phase: 15-slash-commands-interactive-apply
    provides: apply-one CLI command and applier registry
  - phase: 16-ux-polish
    provides: notification module with writeNotificationFlag
provides:
  - skipConfidenceGate option on Applier interface for user-initiated apply
  - notification flag written after Stop hook analysis for UserPromptSubmit injection
affects: [18-config-audit-scanner, 19-workflow-docs]

tech-stack:
  added: []
  patterns:
    - "Optional options parameter on canApply for confidence gate bypass"
    - "Silent try/catch for non-critical notification writes in analysis flow"

key-files:
  created: []
  modified:
    - src/delivery/appliers/index.ts
    - src/delivery/appliers/settings-applier.ts
    - src/delivery/appliers/rule-applier.ts
    - src/delivery/appliers/hook-applier.ts
    - src/delivery/appliers/claude-md-applier.ts
    - src/cli/apply.ts
    - src/analysis/trigger.ts
    - tests/unit/cli/apply.test.ts
    - tests/unit/delivery/auto-apply.test.ts
    - tests/unit/analysis/trigger.test.ts

key-decisions:
  - "skipConfidenceGate as optional boolean in ApplierOptions rather than a separate method -- minimal interface change"
  - "Notification flag writes wrapped in silent try/catch to never block analysis flow"
  - "getStatusMap used to count only truly pending recommendations for notification accuracy"

patterns-established:
  - "canApply(rec, options?) pattern: optional second param for context-dependent behavior"

requirements-completed: [FIX-03, FIX-04]

duration: 5min
completed: 2026-04-04
---

# Phase 17 Plan 02: Output-Side Bug Fixes Summary

**skipConfidenceGate bypass for apply-one CLI (MEDIUM/LOW recs now applicable) and notification flag write after Stop hook analysis**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-04T13:22:25Z
- **Completed:** 2026-04-04T13:27:48Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- apply-one CLI now passes skipConfidenceGate: true, allowing MEDIUM and LOW confidence recommendations to be applied when user explicitly chooses
- Auto-apply safety preserved: no skipConfidenceGate passed in auto-apply path, still gates on HIGH only
- checkAndTriggerAnalysis now writes notification flag with pending count after successful analysis
- Notification flag write failure silently caught -- never blocks analysis flow
- 13 new tests added (620 total, all passing), TypeScript clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Add skipConfidenceGate to Applier interface and apply-one CLI** - `5989c5a` (fix)
2. **Task 2: Write notification flag after Stop hook analysis completes** - `bb2d6a1` (fix)

## Files Created/Modified
- `src/delivery/appliers/index.ts` - Added skipConfidenceGate to ApplierOptions, updated Applier.canApply signature
- `src/delivery/appliers/settings-applier.ts` - canApply respects skipConfidenceGate
- `src/delivery/appliers/rule-applier.ts` - canApply respects skipConfidenceGate
- `src/delivery/appliers/hook-applier.ts` - canApply respects skipConfidenceGate
- `src/delivery/appliers/claude-md-applier.ts` - canApply respects skipConfidenceGate
- `src/cli/apply.ts` - apply-one passes skipConfidenceGate: true to canApply and apply
- `src/analysis/trigger.ts` - checkAndTriggerAnalysis writes notification flag after analysis
- `tests/unit/cli/apply.test.ts` - Tests for MEDIUM/LOW confidence apply-one
- `tests/unit/delivery/auto-apply.test.ts` - Regression test + skipConfidenceGate tests for all appliers
- `tests/unit/analysis/trigger.test.ts` - 4 tests for notification flag write behavior

## Decisions Made
- Used optional `options?: ApplierOptions` parameter on `canApply` rather than creating a separate method or flag -- minimal interface change, backward compatible
- Notification flag writes wrapped in silent try/catch so notification failures never block the core analysis-and-reset flow
- Used `getStatusMap` to filter already-applied/dismissed recommendations before counting pending -- ensures accurate notification count

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all changes are fully wired and functional.

## Next Phase Readiness
- FIX-03 and FIX-04 resolved -- apply-one works for all confidence levels, Stop hook analysis triggers notifications
- Ready for Phase 18 (config audit scanner) which depends on Phase 17 bug fixes

## Self-Check: PASSED

- All 10 source/test files verified present
- Commits 5989c5a and bb2d6a1 verified in git log
- SUMMARY.md verified on disk
- 620/620 tests passing, TypeScript clean

---
*Phase: 17-bug-fixes-reliability*
*Completed: 2026-04-04*
