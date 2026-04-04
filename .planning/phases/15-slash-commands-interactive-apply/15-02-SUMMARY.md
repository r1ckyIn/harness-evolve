---
phase: 15-slash-commands-interactive-apply
plan: 02
subsystem: cli
tags: [commander, cli-subcommands, scan, apply, dismiss, json-output]

# Dependency graph
requires:
  - phase: 11-cli-commands-install-experience
    provides: Commander.js CLI entry point with init/status/uninstall pattern
  - phase: 12-deep-scan-infrastructure
    provides: runDeepScan function and ScanResult type
  - phase: 14-auto-apply-closure
    provides: 4-applier registry (settings, rule, hook, claude-md) via strategy pattern
provides:
  - "scan subcommand: programmatic deep scan with JSON output"
  - "pending subcommand: filtered pending recommendations as JSON"
  - "apply-one subcommand: single recommendation apply via applier registry"
  - "dismiss subcommand: permanent recommendation dismissal"
  - "7 total CLI subcommands registered in cli.ts"
affects: [15-slash-commands-interactive-apply, future-cli-extensions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CLI subcommand JSON output pattern: structured JSON to stdout for slash command consumers"
    - "loadAnalysisResult helper: Zod-validated analysis result loading with graceful fallback"

key-files:
  created:
    - src/cli/scan.ts
    - src/cli/apply.ts
    - tests/unit/cli/scan.test.ts
    - tests/unit/cli/apply.test.ts
  modified:
    - src/cli.ts
    - src/index.ts

key-decisions:
  - "Scan output omits scan_context to keep JSON concise for slash command consumers"
  - "apply-one imports auto-apply.js for side-effect applier registration"
  - "Non-critical log write failure in apply-one is silently caught (advisory logging)"

patterns-established:
  - "JSON CLI output: all new subcommands output structured JSON for programmatic consumption"
  - "Graceful degradation: missing files return empty arrays rather than errors"

requirements-completed: [SCN-04, CMD-02]

# Metrics
duration: 8min
completed: 2026-04-04
---

# Phase 15 Plan 02: CLI Subcommands for Scan and Interactive Apply

**Four CLI subcommands (scan, pending, apply-one, dismiss) providing JSON backend for /evolve:scan and /evolve:apply slash commands**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-04T10:04:25Z
- **Completed:** 2026-04-04T10:12:51Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `harness-evolve scan` triggers runDeepScan and outputs structured JSON with recommendation_count and recommendations array
- `harness-evolve pending` reads analysis result + state, filters to pending recommendations, outputs JSON with count
- `harness-evolve apply-one <id>` loads recommendation by ID, dispatches to applier registry, logs attempt, updates status on success
- `harness-evolve dismiss <id>` marks recommendation as dismissed with audit trail
- All 7 subcommands registered in cli.ts (init, status, uninstall, scan, pending, apply-one, dismiss)
- All new functions exported from src/index.ts for programmatic use

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **Task 1: Implement scan and pending CLI subcommands** - `d29b9ca` (test: RED) -> `8c0f364` (feat: GREEN)
2. **Task 2: Implement apply-one, dismiss and wire CLI** - `416a6a7` (test: RED) -> `df29304` (feat: GREEN)

_TDD flow: failing tests committed first, then implementation to make tests pass._

## Files Created/Modified
- `src/cli/scan.ts` - Scan subcommand: triggers runDeepScan, outputs JSON
- `src/cli/apply.ts` - Pending, apply-one, dismiss subcommands with loadAnalysisResult helper
- `src/cli.ts` - Updated CLI entry point registering all 7 subcommands
- `src/index.ts` - Exports for registerScanCommand, registerPendingCommand, registerApplyOneCommand, registerDismissCommand
- `tests/unit/cli/scan.test.ts` - 3 tests: export check, JSON output, error handling
- `tests/unit/cli/apply.test.ts` - 12 tests: pending (4), apply-one (5), dismiss (3)

## Decisions Made
- Scan output omits scan_context to keep JSON concise for slash command consumers (reduces output noise)
- apply-one imports auto-apply.js to trigger applier registration side-effects (all 4 appliers: settings, rule, hook, claude-md)
- Non-critical log write failures in apply-one are silently caught -- advisory logging should not fail the apply operation
- Used appendFile for auto-apply log writes (consistent with existing auto-apply.ts pattern)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pattern_type values in test data to match patternTypeSchema enum**
- **Found during:** Task 1 (scan and pending tests)
- **Issue:** Plan interfaces section stated `pattern_type: z.string()` but actual schema uses `patternTypeSchema` enum. Test data used invalid value `'scan_mechanization'` instead of valid `'scan_missing_mechanization'`.
- **Fix:** Updated all test data to use valid PatternType enum values
- **Files modified:** tests/unit/cli/scan.test.ts, tests/unit/cli/apply.test.ts
- **Verification:** All tests pass with correct schema validation
- **Committed in:** 8c0f364 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Schema interface mismatch in plan document. Fix was necessary for correct Zod validation. No scope creep.

## Issues Encountered
None beyond the schema deviation noted above.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all subcommands are fully wired to existing infrastructure (scan, appliers, state).

## Next Phase Readiness
- All 4 CLI subcommands ready for slash command wiring (plan 01 creates the .claude/commands/ files that invoke these)
- JSON output format designed for easy parsing by Claude Code agent in slash command handlers

## Self-Check: PASSED

All 6 created/modified source files verified on disk. All 4 task commits verified in git log (d29b9ca, 8c0f364, 416a6a7, df29304). 15/15 tests pass. TypeScript compiles clean. 7 subcommands registered.

---
*Phase: 15-slash-commands-interactive-apply*
*Completed: 2026-04-04*
