---
phase: 16-ux-polish
plan: 01
subsystem: delivery, cli
tags: [notification, ux, init, hooks, commander]

# Dependency graph
requires:
  - phase: 15-slash-commands-interactive-apply
    provides: /evolve:apply slash command and interactive apply workflow
  - phase: 11-cli-commands-install-experience
    provides: CLI init command with hook registration
provides:
  - Concise notification text referencing /evolve:apply instead of file path
  - Hook descriptions displayed during init output
affects: [documentation, onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Notification messages reference slash commands rather than file paths"
    - "HookRegistration includes human-readable description field"

key-files:
  created: []
  modified:
    - src/delivery/notification.ts
    - src/hooks/user-prompt-submit.ts
    - src/cli/utils.ts
    - src/cli/init.ts
    - tests/unit/delivery/notification.test.ts
    - tests/unit/cli/init.test.ts

key-decisions:
  - "Notification text uses 'suggestion' instead of 'recommendation' for conciseness"
  - "buildNotification signature reduced to single parameter (pendingCount only)"
  - "Hook descriptions embedded in HOOK_REGISTRATIONS array, not in a separate data structure"

patterns-established:
  - "Notification messages reference actionable slash commands (/evolve:apply) not file paths"
  - "Hook registration entries carry human-readable descriptions for display"

requirements-completed: [UX-01, UX-02]

# Metrics
duration: 4min
completed: 2026-04-04
---

# Phase 16 Plan 01: Concise Notification and Hook Description Display Summary

**Notification text now references /evolve:apply with 'suggestion' wording; init output shows hook purpose descriptions**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T10:43:37Z
- **Completed:** 2026-04-04T10:47:19Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- buildNotification simplified to single parameter, outputs concise "/evolve:apply" reference
- Changed terminology from "recommendation" to "suggestion" for brevity
- HookRegistration interface extended with description field for all 6 hooks
- Init output now shows "EventName (async) -- Description" for each hook registration

## Task Commits

Each task was committed atomically:

1. **Task 1: Concise notification with /evolve:apply reference (UX-01)** - `58ee4e8` (feat)
2. **Task 2: Hook description display in init output (UX-02)** - `01d46ab` (feat)

_Both tasks followed TDD: RED (failing tests) -> GREEN (implementation) -> verify_

## Files Created/Modified
- `src/delivery/notification.ts` - Simplified buildNotification to 1-param, uses "suggestion" and "/evolve:apply"
- `src/hooks/user-prompt-submit.ts` - Removed paths import, calls buildNotification with 1 arg
- `src/cli/utils.ts` - Added description field to HookRegistration interface and all 6 entries
- `src/cli/init.ts` - Display loop now shows "EventName (async) -- Description" format
- `tests/unit/delivery/notification.test.ts` - Updated all notification tests for new wording and signature
- `tests/unit/cli/init.test.ts` - Added description presence test and init output display assertions

## Decisions Made
- Used "suggestion" instead of "recommendation" -- shorter, more conversational UX
- Removed filePath from buildNotification signature entirely -- /evolve:apply is the only action path users need
- Embedded descriptions directly in HOOK_REGISTRATIONS array rather than a separate mapping -- keeps data co-located

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None -- all data is wired and functional.

## Next Phase Readiness
- Notification and init UX polished, ready for Plan 02 (additional UX improvements)
- All 607 tests pass, zero TypeScript errors, zero regressions

## Self-Check: PASSED

All 7 files found. Both commits (58ee4e8, 01d46ab) verified. All 6 content checks passed.

---
*Phase: 16-ux-polish*
*Completed: 2026-04-04*
