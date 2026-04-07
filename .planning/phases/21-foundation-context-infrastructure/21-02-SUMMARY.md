---
phase: 21-foundation-context-infrastructure
plan: 02
subsystem: cli
tags: [commander, scan-context, cli, json-output]

requires:
  - phase: 21-01
    provides: "buildScanContext function and ScanContext schema"
provides:
  - "scan-context CLI subcommand outputting raw ScanContext JSON"
  - "registerScanContextCommand function for CLI registration"
affects: [22-ecosystem-learning-scanner-guidance, 23-model-driven-validation-legacy-cleanup]

tech-stack:
  added: []
  patterns: ["CLI subcommand registration pattern (registerXCommand)"]

key-files:
  created:
    - src/cli/scan-context.ts
    - tests/unit/cli/scan-context.test.ts
  modified:
    - src/cli.ts

key-decisions:
  - "scan-context outputs raw ScanContext JSON directly (no wrapper object, no deprecation notice)"
  - "Errors go to stderr with exitCode=1 to preserve JSON piping to stdout"

patterns-established:
  - "CLI read-only commands work without prior init (no ensureInit guard)"

requirements-completed: [INFRA-02, INFRA-04]

duration: 2min
completed: 2026-04-07
---

# Phase 21 Plan 02: scan-context CLI Command Summary

**scan-context CLI subcommand outputting raw ScanContext JSON to stdout for model-driven analysis consumption**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-07T03:02:40Z
- **Completed:** 2026-04-07T03:04:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created `scan-context` CLI subcommand that outputs raw ScanContext JSON (no wrapper, no deprecation)
- Registered scan-context as the 8th subcommand in the CLI program
- TDD test suite with 4 test cases covering JSON output, no deprecation, and error handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scan-context CLI command with tests** - `8c7f1f4` (test: failing tests), `d4d9b35` (feat: implementation)
2. **Task 2: Register scan-context in CLI program** - `e5bad0d` (feat: registration)

_TDD task had separate RED and GREEN commits._

## Files Created/Modified
- `src/cli/scan-context.ts` - New CLI subcommand: registerScanContextCommand, outputs raw ScanContext JSON
- `tests/unit/cli/scan-context.test.ts` - 4 test cases: export, JSON output, no deprecation, error handling
- `src/cli.ts` - Added import and registration of scan-context command

## Decisions Made
- scan-context outputs raw ScanContext JSON directly (unlike `scan` which wraps in `{generated_at, recommendations}`)
- No deprecation notice in scan-context output (unlike `scan` which prints one to stderr)
- Errors go to stderr with exitCode=1 for clean JSON piping

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- scan-context CLI bridge is ready for Phase 22 to wire into /evolve:scan template
- The /evolve:scan slash command can now call `harness-evolve scan-context` to get raw ScanContext

## Self-Check: PASSED

- [x] src/cli/scan-context.ts exists
- [x] tests/unit/cli/scan-context.test.ts exists
- [x] src/cli.ts modified
- [x] Commit 8c7f1f4 exists (test RED)
- [x] Commit d4d9b35 exists (feat GREEN)
- [x] Commit e5bad0d exists (feat registration)
- [x] No stubs found

---
*Phase: 21-foundation-context-infrastructure*
*Completed: 2026-04-07*
