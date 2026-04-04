---
phase: 14-auto-apply-closure
plan: 01
subsystem: delivery
tags: [auto-apply, hook-applier, claude-md-applier, strategy-pattern, write-file-atomic]

requires:
  - phase: 09-tech-debt-auto-apply
    provides: Applier interface, registry pattern, SettingsApplier, RuleApplier
  - phase: 13-auto-generators
    provides: generateHook, generateClaudeMdPatch pure functions
provides:
  - HookApplier class — generates and registers hook scripts automatically
  - ClaudeMdApplier class — appends CLAUDE.md sections with destructive pattern guard
  - Extended ApplierOptions with hooksDir and claudeMdPath fields
  - Complete auto-apply pipeline for HOOK and CLAUDE_MD routing targets
affects: [15-slash-commands, delivery, auto-apply]

tech-stack:
  added: []
  patterns: [create-only guard for hook files, destructive pattern rejection set, backup-before-modify]

key-files:
  created:
    - src/delivery/appliers/hook-applier.ts
    - src/delivery/appliers/claude-md-applier.ts
  modified:
    - src/delivery/appliers/index.ts
    - src/delivery/auto-apply.ts
    - src/index.ts
    - tests/unit/delivery/auto-apply.test.ts

key-decisions:
  - "HookApplier uses generateHook + readSettings/mergeHooks/writeSettings from existing CLI utils"
  - "ClaudeMdApplier rejects scan_stale_reference and scan_redundancy as destructive (manual review required)"
  - "Backup files use distinct naming: settings-backup-{id}.json and claudemd-backup-{id}.md"

patterns-established:
  - "Destructive pattern guard: Set-based check before auto-apply, refuses dangerous pattern types"
  - "Hook event extraction: regex from generated script '# Hook event: {event}' comment"

requirements-completed: [GEN-04, GEN-05]

duration: 6min
completed: 2026-04-04
---

# Phase 14 Plan 01: Auto-Apply Closure Summary

**HookApplier and ClaudeMdApplier complete the auto-apply pipeline for 4 of 6 routing targets (SETTINGS, RULE, HOOK, CLAUDE_MD)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-04T09:26:18Z
- **Completed:** 2026-04-04T09:32:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- HookApplier: generates bash hook script via generateHook, writes to disk with +x permission, creates backup of settings.json, registers hook in settings.json via mergeHooks, enforces create-only guard
- ClaudeMdApplier: appends new sections for generic CLAUDE_MD patterns, rejects scan_stale_reference and scan_redundancy as destructive, creates backup via write-file-atomic, handles missing CLAUDE.md gracefully
- Both appliers registered in auto-apply.ts strategy pattern registry, exported from src/index.ts
- 34 auto-apply tests pass (17 new tests added), TypeScript typecheck clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ApplierOptions and implement HookApplier** - `be5797d` (feat)
2. **Task 2: Implement ClaudeMdApplier** - `a43f79d` (feat)
3. **Task 3: Register appliers and wire public API exports** - `a397cf2` (feat)

## Files Created/Modified
- `src/delivery/appliers/hook-applier.ts` - HookApplier class: generateHook -> write script -> chmod +x -> mergeHooks -> writeSettings
- `src/delivery/appliers/claude-md-applier.ts` - ClaudeMdApplier class: read -> backup -> append -> atomic write
- `src/delivery/appliers/index.ts` - Extended ApplierOptions with hooksDir and claudeMdPath fields
- `src/delivery/auto-apply.ts` - Registered HookApplier and ClaudeMdApplier in strategy pattern registry
- `src/index.ts` - Phase 14 exports for both new appliers
- `tests/unit/delivery/auto-apply.test.ts` - 17 new tests for HOOK and CLAUDE_MD appliers, updated existing tests

## Decisions Made
- HookApplier reuses existing CLI utils (readSettings, writeSettings, mergeHooks) rather than duplicating settings I/O logic
- ClaudeMdApplier uses a Set-based destructive pattern guard to reject scan_stale_reference and scan_redundancy — these require manual review because they involve deletions/consolidations
- Backup files use pattern-specific naming to avoid collisions: settings-backup-{id}.json for hooks, claudemd-backup-{id}.md for CLAUDE.md
- Hook event extraction uses regex on generated script content ("# Hook event: {event}") with PreToolUse fallback

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in tests/unit/readme-badges.test.ts (static badge count check) — unrelated to this plan, not addressed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Auto-apply pipeline now covers SETTINGS, RULE, HOOK, and CLAUDE_MD targets (4 of 6)
- SKILL and MEMORY targets remain without appliers (future work)
- Ready for slash command integration and interactive recommendation application

## Self-Check: PASSED

All 3 created/modified source files verified present. All 3 task commits verified in git log.

---
*Phase: 14-auto-apply-closure*
*Completed: 2026-04-04*
