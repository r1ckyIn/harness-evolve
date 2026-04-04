---
phase: 16-ux-polish
plan: 02
subsystem: cli
tags: [commander, sorting, confidence, ux]

# Dependency graph
requires:
  - phase: 15-slash-commands-interactive-apply
    provides: pending and scan CLI subcommands
provides:
  - Confidence-sorted pending output (HIGH -> MEDIUM -> LOW)
  - Confidence-sorted scan output (HIGH -> MEDIUM -> LOW)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [CONFIDENCE_ORDER constant for defensive sort ordering]

key-files:
  created: []
  modified: [src/cli/apply.ts, src/cli/scan.ts, tests/unit/cli/apply.test.ts, tests/unit/cli/scan.test.ts]

key-decisions:
  - "CONFIDENCE_ORDER Record<string,number> with fallback ??3 for defensive unknown-value handling"
  - "Spread copy [...result.recommendations] in scan to avoid mutating source array"

patterns-established:
  - "CONFIDENCE_ORDER constant: shared sort-order map reusable across CLI commands"

requirements-completed: [UX-03]

# Metrics
duration: 3min
completed: 2026-04-04
---

# Phase 16 Plan 02: Confidence-Sorted CLI Output Summary

**Pending and scan CLI outputs now sort recommendations HIGH -> MEDIUM -> LOW using explicit CONFIDENCE_ORDER constant**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-04T10:43:51Z
- **Completed:** 2026-04-04T10:46:41Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Pending command sorts filtered recommendations by confidence tier before JSON output
- Scan command sorts recommendations with non-mutating spread copy before JSON output
- Explicit CONFIDENCE_ORDER constant (HIGH=0, MEDIUM=1, LOW=2) with defensive fallback for unknown values
- Full TDD cycle: 3 new test assertions (2 in apply, 1 in scan) plus 1 updated existing assertion

## Task Commits

Each task was committed atomically:

1. **Task 1: Sort pending and scan output by confidence (UX-03)**
   - RED: `2a9d37f` (test) - add failing tests for confidence-sorted CLI output
   - GREEN: `cc0a727` (feat) - sort CLI output by confidence HIGH -> MEDIUM -> LOW

## Files Created/Modified
- `src/cli/apply.ts` - Added CONFIDENCE_ORDER constant, chained .sort() after .filter() in registerPendingCommand
- `src/cli/scan.ts` - Added CONFIDENCE_ORDER constant, spread-copy sort in registerScanCommand
- `tests/unit/cli/apply.test.ts` - Updated existing pending order assertion, added dedicated confidence sorting test
- `tests/unit/cli/scan.test.ts` - Added confidence sorting test with LOW/HIGH/MEDIUM input verifying HIGH/MEDIUM/LOW output

## Decisions Made
- Used Record<string, number> with ?? 3 fallback for defensive handling of unknown confidence values
- Used spread copy ([...result.recommendations]) in scan to avoid mutating the original scan result array
- Kept CONFIDENCE_ORDER as module-level const in each file (not shared utility) since only 2 consumers

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 16 (ux-polish) fully complete with both plans executed
- All CLI outputs now present highest-impact recommendations first

## Self-Check: PASSED

- All 5 files exist (2 source, 2 test, 1 summary)
- Both commits verified (2a9d37f, cc0a727)
- All acceptance criteria met (CONFIDENCE_ORDER, .sort(), spread copy, updated assertions)
- TypeScript type check passes
- All target tests pass (17/17)

---
*Phase: 16-ux-polish*
*Completed: 2026-04-04*
