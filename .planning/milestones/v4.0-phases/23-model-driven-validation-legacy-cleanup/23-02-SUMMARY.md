---
phase: 23-model-driven-validation-legacy-cleanup
plan: 02
subsystem: scan
tags: [legacy-removal, scanner, context-builder, cli, model-driven]

# Dependency graph
requires:
  - phase: 23-01
    provides: "v4 scan pipeline integration tests (safety net for deletions)"
provides:
  - "Simplified scan module (buildScanResult replaces runDeepScan)"
  - "~2960 LOC removed from codebase (16 scanner files + 1 E2E test)"
  - "CLI scan with deprecation notice + scan-context JSON output"
  - "CLI init using buildScanContext for post-init summary"
affects: [23-03, future scanner guidance docs, /evolve:scan slash command]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Model-driven analysis: scan module returns raw context, model does analysis via guidance docs"
    - "Deprecation notice pattern: stderr for notices, stdout for JSON data"

key-files:
  created: []
  modified:
    - src/scan/index.ts
    - src/index.ts
    - src/cli/scan.ts
    - src/cli/init.ts
    - tests/unit/scan/index.test.ts
    - tests/unit/scan/context-builder.test.ts
    - tests/integration/cli-scan.test.ts
    - tests/unit/cli/scan.test.ts

key-decisions:
  - "buildScanResult is a thin wrapper over buildScanContext -- no recommendations or scanner_meta fields"
  - "Deprecation notice goes to stderr so JSON piping to other tools still works"
  - "Init CLI shows config file/hook counts + /evolve:scan guidance instead of per-recommendation output"

patterns-established:
  - "Scan module context-only pattern: scan returns raw data, model performs analysis"

requirements-completed: [SCAN-03]

# Metrics
duration: 7min
completed: 2026-04-07
---

# Phase 23 Plan 02: Legacy Scanner Removal Summary

**Surgically removed 7 code-based scanners (~2960 LOC), simplified scan orchestrator to context-only, updated CLI and public API -- build passes, 654 tests green**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-06T13:53:58Z
- **Completed:** 2026-04-07T00:00:30Z
- **Tasks:** 2
- **Files modified:** 24 (16 deleted + 8 rewritten/updated)

## Accomplishments
- Deleted all 16 legacy scanner files (8 source + 7 unit tests + 1 E2E test) totaling ~2960 LOC
- Rewrote scan orchestrator: `buildScanResult` replaces `runDeepScan`, returns context-only (no recommendations/scanner_meta)
- Updated public API: removed `runDeepScan`, `Scanner` type, `scanRedundancy`, `scanMechanization`, `scanStaleness` exports
- CLI scan outputs deprecation notice (stderr) + scan-context JSON (stdout)
- CLI init uses `buildScanContext` for lightweight config summary with `/evolve:scan` guidance
- Protected files verified untouched: `recommendation.ts` enum values, generators, appliers

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete legacy scanner files and their tests** - `2363a21` (chore)
2. **Task 2: Rewrite scan orchestrator, update public API, update CLIs, fix tests** - `275cd34` (feat)

## Files Created/Modified
- `src/scan/scanners/*` (8 files DELETED) - Legacy scanner implementations
- `tests/unit/scan/scanners/*` (7 files DELETED) - Legacy scanner unit tests
- `tests/integration/dirty-config-e2e.test.ts` (DELETED) - E2E test for 7 scanners
- `src/scan/index.ts` - Simplified: buildScanResult wrapping buildScanContext
- `src/index.ts` - Removed scanner function exports, added buildScanResult
- `src/cli/scan.ts` - Deprecation notice + scan-context JSON output
- `src/cli/init.ts` - Uses buildScanContext for post-init config summary
- `tests/unit/scan/index.test.ts` - 6 tests for buildScanResult
- `tests/unit/scan/context-builder.test.ts` - Removed Scanner type import and registry tests
- `tests/integration/cli-scan.test.ts` - Tests buildScanResult end-to-end
- `tests/unit/cli/scan.test.ts` - Mocks buildScanContext instead of runDeepScan

## Decisions Made
- `buildScanResult` is intentionally thin (timestamp + context) -- model produces findings via `/evolve:scan` guidance docs, not code
- Deprecation notice to stderr preserves JSON piping for scripts consuming scan output
- Init CLI shows aggregate counts instead of per-recommendation details since scanners no longer exist

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated tests/unit/cli/scan.test.ts (not listed in plan)**
- **Found during:** Task 2 (test suite run)
- **Issue:** `tests/unit/cli/scan.test.ts` mocked `runDeepScan` from `scan/index.js` which no longer exists, causing test failures
- **Fix:** Rewrote test file to mock `buildScanContext` from `scan/context-builder.js`, updated assertions for new JSON output format
- **Files modified:** tests/unit/cli/scan.test.ts
- **Verification:** All 654 tests pass
- **Committed in:** 275cd34 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix -- test file referenced deleted module. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Scan module is now context-only, ready for Phase 23 Plan 03 manual validation
- `buildScanResult` and `buildScanContext` are the stable API for model-driven analysis
- `/evolve:scan` slash command template will be updated in future to reference guidance docs
- All `scan_*` pattern_type enum values preserved in recommendation schema for generators/appliers

---
*Phase: 23-model-driven-validation-legacy-cleanup*
*Completed: 2026-04-07*
