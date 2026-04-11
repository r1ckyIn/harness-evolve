---
phase: 26-self-healing-installation
plan: 02
subsystem: hooks
tags: [session-start, hook-registration, tsup, npm-exports, cli-init]

requires:
  - phase: 26-self-healing-installation
    plan: 01
    provides: SessionStart hook handler, sessionStartInputSchema, checkAndRepairSlashCommands
provides:
  - SessionStart wired into HOOK_REGISTRATIONS (7 events total)
  - tsup entry point for hooks/session-start
  - npm export mapping ./hooks/session-start
  - Library re-exports for sessionStartInputSchema, SessionStartInput, handleSessionStart, checkAndRepairSlashCommands, SlashCommandHealth, RepairResult
  - Integration test asserting 7 hook events
affects: [cli-init, npm-package, hook-consumers]

tech-stack:
  added: []
  patterns: [dependency injection for handler testability (repairFn parameter)]

key-files:
  created: []
  modified:
    - src/cli/utils.ts
    - tsup.config.ts
    - package.json
    - src/index.ts
    - src/hooks/session-start.ts
    - tests/integration/cli-init.test.ts
    - tests/unit/hooks/session-start.test.ts

key-decisions:
  - "Dependency injection (repairFn parameter) for handleSessionStart instead of vi.spyOn module mocking"
  - "SessionStart placed as first entry in HOOK_REGISTRATIONS for logical ordering (fires before all other hooks)"

patterns-established:
  - "Handler DI pattern: optional function parameter with default for testable hook handlers"

requirements-completed: [HEAL-01]

duration: 4min
completed: 2026-04-11
---

# Phase 26 Plan 02: SessionStart Hook Registration Wiring Summary

**SessionStart hook wired into all 5 registration surfaces: HOOK_REGISTRATIONS, tsup, package.json, index.ts, and integration test**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-11T13:02:04Z
- **Completed:** 2026-04-11T13:06:13Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Added SessionStart as first entry in HOOK_REGISTRATIONS array (7 events total, sync with 10s timeout)
- Wired tsup entry point (entry + dts.entry) and npm export mapping for hooks/session-start
- Re-exported all SessionStart types and functions from src/index.ts for library consumers
- Updated integration test to assert 7 hook events including SessionStart
- Fixed handleSessionStart testability via dependency injection pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Add SessionStart to HOOK_REGISTRATIONS and update utils.ts comment** - `458c196` (feat)
2. **Task 2: Wire tsup entry, package.json export, index.ts re-export, and update integration test** - `df39a55` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `src/cli/utils.ts` - Added SessionStart as first entry in HOOK_REGISTRATIONS, updated JSDoc to 7 events
- `tsup.config.ts` - Added hooks/session-start entry point in both entry and dts.entry objects
- `package.json` - Added ./hooks/session-start npm export with types and default
- `src/index.ts` - Re-exported sessionStartInputSchema, SessionStartInput, handleSessionStart, checkAndRepairSlashCommands, SlashCommandHealth, RepairResult
- `src/hooks/session-start.ts` - Added repairFn dependency injection parameter to handleSessionStart
- `tests/integration/cli-init.test.ts` - Updated assertion from 6 to 7 events, added SessionStart to expected keys
- `tests/unit/hooks/session-start.test.ts` - Updated handler tests to use DI instead of vi.spyOn

## Decisions Made
- Used dependency injection (repairFn parameter with default) for handleSessionStart instead of relying on vi.spyOn module-level mocking, which fails for ESM internal function calls
- Placed SessionStart as first entry in HOOK_REGISTRATIONS array for logical ordering (it fires before all other hooks)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed handleSessionStart testability via dependency injection**
- **Found during:** Task 2 (verification step)
- **Issue:** vi.spyOn on dynamically imported module could not intercept internal function calls in ESM -- handleSessionStart called checkAndRepairSlashCommands directly, not through module export
- **Fix:** Added optional repairFn parameter to handleSessionStart with default value of checkAndRepairSlashCommands; updated tests to pass mock functions via DI
- **Files modified:** src/hooks/session-start.ts, tests/unit/hooks/session-start.test.ts
- **Verification:** All 23 tests pass (17 unit + 6 integration)
- **Committed in:** df39a55 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for test reliability. No scope creep.

## Known Stubs

None - all functionality is fully wired.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SessionStart hook is fully registered and wired across all 5 surfaces
- Phase 26 (self-healing-installation) is complete
- `harness-evolve init` now registers 7 hook events
- npm package exports the new hook for library consumers

## Self-Check: PASSED

- FOUND: src/cli/utils.ts
- FOUND: tsup.config.ts
- FOUND: package.json
- FOUND: src/index.ts
- FOUND: src/hooks/session-start.ts
- FOUND: tests/integration/cli-init.test.ts
- FOUND: tests/unit/hooks/session-start.test.ts
- FOUND: .planning/phases/26-self-healing-installation/26-02-SUMMARY.md
- FOUND: 458c196 (Task 1 commit)
- FOUND: df39a55 (Task 2 commit)

---
*Phase: 26-self-healing-installation*
*Completed: 2026-04-11*
