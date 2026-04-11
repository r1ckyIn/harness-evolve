---
phase: 26-self-healing-installation
plan: 01
subsystem: hooks
tags: [session-start, self-healing, slash-commands, zod, hooks]

requires:
  - phase: 25-scan-template-rewrite
    provides: v5 scan/apply templates with generateScanCommand/generateApplyCommand
provides:
  - sessionStartInputSchema for SessionStart hook event validation
  - checkAndRepairSlashCommands utility for detecting and repairing missing/outdated slash commands
  - handleSessionStart hook handler with JSON additionalContext output
affects: [26-02-hook-registration, cli-init, tsup-config]

tech-stack:
  added: []
  patterns: [SessionStart hook handler following stop.ts pattern, homeOverride parameter for filesystem testability]

key-files:
  created:
    - src/hooks/session-start.ts
    - tests/unit/hooks/session-start.test.ts
  modified:
    - src/schemas/hook-input.ts

key-decisions:
  - "homeOverride parameter for checkAndRepairSlashCommands enables real-filesystem testing without mocking"
  - "vi.spyOn for handleSessionStart tests isolates handler from filesystem while checkAndRepairSlashCommands tests use real temp dirs"
  - "Zero output for healthy sessions -- no additionalContext emitted when nothing repaired"

patterns-established:
  - "SessionStart hook pattern: validate input, run health check, conditionally emit hookSpecificOutput JSON"
  - "homeOverride pattern for testable filesystem operations without mocking node:fs"

requirements-completed: [HEAL-01]

duration: 3min
completed: 2026-04-11
---

# Phase 26 Plan 01: SessionStart Hook Handler Summary

**SessionStart hook with self-healing slash command detection using version-aware repair and conditional additionalContext output**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-11T12:56:10Z
- **Completed:** 2026-04-11T12:59:25Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments
- Added `sessionStartInputSchema` to hook-input.ts validating SessionStart events (source enum, optional model)
- Created `checkAndRepairSlashCommands` utility that detects missing directories, missing files, and outdated template versions
- Created `handleSessionStart` handler that outputs `hookSpecificOutput.additionalContext` JSON only when repair was performed
- Zero output for healthy sessions (no latency impact on normal operations)
- All errors swallowed -- handler never throws or blocks Claude Code
- 17 unit tests covering schema validation, health check (real temp dirs), and handler output

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests for SessionStart hook** - `5b33c20` (test)
2. **Task 1 (GREEN): Implement SessionStart hook handler** - `f39551a` (feat)

**Plan metadata:** TBD (docs: complete plan)

_Note: TDD task with RED -> GREEN commits_

## Files Created/Modified
- `src/schemas/hook-input.ts` - Added sessionStartInputSchema and SessionStartInput type
- `src/hooks/session-start.ts` - SessionStart hook handler with checkAndRepairSlashCommands utility
- `tests/unit/hooks/session-start.test.ts` - 17 unit tests (schema, health check, handler)

## Decisions Made
- Used `homeOverride` parameter on `checkAndRepairSlashCommands` for real-filesystem testing without mocking `node:fs`
- Used `vi.spyOn` to mock `checkAndRepairSlashCommands` in handler tests while using real temp directories in health check tests
- Zero output for healthy sessions -- no additionalContext emitted unless repair actually performed

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is fully wired.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Hook handler code is complete and tested
- Plan 02 will register the hook in HOOK_REGISTRATIONS, add tsup entry point, and update package.json exports
- `checkAndRepairSlashCommands` is exported and ready for reuse by CLI init or other consumers

## Self-Check: PASSED

- FOUND: src/hooks/session-start.ts
- FOUND: src/schemas/hook-input.ts
- FOUND: tests/unit/hooks/session-start.test.ts
- FOUND: .planning/phases/26-self-healing-installation/26-01-SUMMARY.md
- FOUND: 5b33c20 (RED commit)
- FOUND: f39551a (GREEN commit)

---
*Phase: 26-self-healing-installation*
*Completed: 2026-04-11*
