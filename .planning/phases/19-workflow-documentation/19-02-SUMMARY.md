---
phase: 19-workflow-documentation
plan: 02
subsystem: cli
tags: [commander, slash-commands, version-tracking, template-update, uninstall]

requires:
  - phase: 19-workflow-documentation-01
    provides: getScanTemplateVersion/getApplyTemplateVersion exports and template-version HTML comments
provides:
  - Version-aware installSlashCommands with stale detection and auto-update
  - Global path cleanup in removeSlashCommands for uninstall
affects: [cli-init, cli-uninstall, slash-commands]

tech-stack:
  added: []
  patterns: [template-version HTML comment for staleness detection, extractInstalledVersion parser, removeSlashCommandsFromDir helper extraction]

key-files:
  created: []
  modified:
    - src/cli/init.ts
    - src/cli/uninstall.ts
    - tests/unit/cli/init.test.ts
    - tests/unit/cli/uninstall.test.ts

key-decisions:
  - "Integer comparison via parseInt for template-version (robust for multi-digit versions)"
  - "extractInstalledVersion returns null for both missing file and missing version comment, distinguished by separate fileExists check"
  - "removeSlashCommandsFromDir extracted as reusable helper, called for both global and project-level paths"

patterns-established:
  - "Template versioning: HTML comment <!-- template-version: N --> in generated .md files, parsed by extractInstalledVersion()"
  - "Dual-path cleanup: uninstall cleans both global and project-level paths for backward compatibility"

requirements-completed: [WFL-01, WFL-02]

duration: 4min
completed: 2026-04-05
---

# Phase 19 Plan 02: Version-Aware Template Update + Global Uninstall Cleanup Summary

**Version-aware installSlashCommands overwrites stale templates using template-version HTML comments; uninstall now cleans both global and project-level slash command paths**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-05T04:39:59Z
- **Completed:** 2026-04-05T04:44:05Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- installSlashCommands() compares template-version in installed files against current template version constants -- files with no version or older version are overwritten, current versions are skipped
- removeSlashCommands() cleans both global (~/.claude/commands/evolve/) and project-level (.claude/commands/evolve/) paths, fixing pre-existing bug from Phase 17
- 9 new tests covering version-aware update (4 tests) and global path cleanup (5 tests)
- Full test suite green: 708 tests passing across 62 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Add version-aware update mechanism to installSlashCommands** - `40ce321` (feat)
2. **Task 2: Fix removeSlashCommands to clean global path** - `2336e7f` (fix)

_Note: Both tasks used TDD (RED -> GREEN) with tests written first_

## Files Created/Modified
- `src/cli/init.ts` - Added readFile import, getScanTemplateVersion/getApplyTemplateVersion imports, extractInstalledVersion() helper, version-aware installSlashCommands loop
- `src/cli/uninstall.ts` - Extracted removeSlashCommandsFromDir() helper, removeSlashCommands() now cleans global + project-level paths
- `tests/unit/cli/init.test.ts` - 4 new tests: no-version overwrite, older-version overwrite, current-version skip, stale-log verification; updated existing "skips" test to use version-aware behavior
- `tests/unit/cli/uninstall.test.ts` - 5 new tests: global path removal, dual path cleanup, missing global dir graceful handling, global rmdir attempt

## Decisions Made
- Used parseInt for version comparison (robust for future multi-digit versions)
- extractInstalledVersion returns null for both "file missing" and "no version comment" cases, with fileExists() used to distinguish the two for appropriate log messages
- Extracted removeSlashCommandsFromDir as a reusable helper rather than duplicating cleanup logic

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired.

## Next Phase Readiness
- Phase 19 complete: both plans executed
- Slash commands now have comprehensive workflow documentation (Plan 01) that automatically reaches users via version-aware updates (Plan 02)
- Pre-existing TypeScript errors in classifier/scanner files remain (20 errors in 11 files, all pre-existing, out of scope)

---
*Phase: 19-workflow-documentation*
*Completed: 2026-04-05*
