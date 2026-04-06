---
phase: 20-scanner-ux-coverage-polish
plan: 01
subsystem: cli
tags: [scanner, ux, templates, slash-commands, cli-output]

requires:
  - phase: 19-workflow-documentation
    provides: Slash command templates v2 with workflow docs
  - phase: 18-comprehensive-config-audit
    provides: 7-scanner registry and severity-based output
provides:
  - English-language instruction in scan template (UX-01)
  - Numbered interactive apply options with Let Claude decide (UX-02)
  - Scanner coverage summary in CLI scan JSON output (UX-03)
  - ScannerMeta interface and scanner_meta in ScanResult
  - scannerNames registry parallel to scanners array
affects: [20-02-PLAN, evolve-scan, evolve-apply, cli-scan]

tech-stack:
  added: []
  patterns:
    - "Parallel arrays pattern: scanners[] and scannerNames[] kept in sync"
    - "Scanner metadata aggregation: per-scanner finding_count built during scan loop"

key-files:
  created: []
  modified:
    - src/commands/evolve-scan.ts
    - src/commands/evolve-apply.ts
    - src/scan/scanners/index.ts
    - src/scan/index.ts
    - src/cli/scan.ts
    - tests/unit/commands/templates.test.ts
    - tests/unit/scan/index.test.ts
    - tests/unit/cli/scan.test.ts

key-decisions:
  - "Parallel arrays (scanners + scannerNames) over Map or object registry -- minimal change, no refactor needed"
  - "scanner_summary placed between recommendation_count and problems in CLI output for logical grouping"
  - "Error-throwing scanners get finding_count: 0 in scanner_meta (consistent with existing error swallowing)"

patterns-established:
  - "Template versioning: bump to v3 when content changes materially"
  - "Scanner metadata: every scan result includes per-scanner name and finding_count"

requirements-completed: [UX-01, UX-02, UX-03]

duration: 4min
completed: 2026-04-06
---

# Phase 20 Plan 01: Scanner UX & Coverage Polish Summary

**English-language scan instruction, numbered apply options (1-4) with Let Claude decide, and scanner_summary in CLI scan JSON output**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-06T07:33:25Z
- **Completed:** 2026-04-06T07:37:53Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- UX-01: Scan template now instructs Claude to always present results in English regardless of session language
- UX-02: Apply template replaces free-form "Choose: [Apply] [Skip] [Dismiss]" with numbered options (1-4) including "Let Claude decide"
- UX-03: CLI scan JSON output includes scanner_summary with total_scanners, scanners_with_findings, areas_scanned, areas_with_findings
- runDeepScan returns scanner_meta array with per-scanner name and finding_count
- Both scan and apply templates bumped to version 3
- Full test suite: 719 tests passing (11 new tests added)

## Task Commits

Each task was committed atomically:

1. **Task 1: Template UX changes (UX-01, UX-02, UX-03 template side)**
   - `8977476` (test: RED -- failing tests for English instruction, numbered options, version 3)
   - `592125e` (feat: GREEN -- implement template changes, bump versions to 3)

2. **Task 2: Scanner metadata + scanner_summary (UX-03 backend)**
   - `0c4fb7a` (test: RED -- failing tests for scanner_meta and scanner_summary)
   - `8d6702a` (feat: GREEN -- implement scannerNames, ScannerMeta, scanner_summary)

## Files Created/Modified
- `src/commands/evolve-scan.ts` - Added English instruction, scanner coverage summary line format, bumped to v3
- `src/commands/evolve-apply.ts` - Replaced free-form choices with numbered options (1-4), bumped to v3
- `src/scan/scanners/index.ts` - Added scannerNames export parallel to scanners array
- `src/scan/index.ts` - Added ScannerMeta interface, scanner_meta to ScanResult, indexed scan loop
- `src/cli/scan.ts` - Added scanner_summary field to CLI JSON output
- `tests/unit/commands/templates.test.ts` - 7 new assertions for template UX changes
- `tests/unit/scan/index.test.ts` - 3 new tests for scanner_meta behavior
- `tests/unit/cli/scan.test.ts` - 1 new test for scanner_summary, updated mocks with scanner_meta

## Decisions Made
- Used parallel arrays (scanners + scannerNames) instead of refactoring to Map/object registry -- minimal change to existing code, keeps backward compatibility
- scanner_summary placed between recommendation_count and problems in CLI output for logical grouping
- Error-throwing scanners get finding_count: 0 in scanner_meta -- consistent with existing error swallowing behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Template UX improvements complete, ready for Plan 02 (scan progress feedback and area-specific scan)
- scanner_meta provides the data foundation for Plan 02's area-specific scan filtering
- All 719 tests passing, build clean

## Self-Check: PASSED

- All 8 modified files exist on disk
- All 4 task commits verified in git log
- All 8 acceptance criteria assertions pass
- 719/719 tests passing, build clean

---
*Phase: 20-scanner-ux-coverage-polish*
*Completed: 2026-04-06*
