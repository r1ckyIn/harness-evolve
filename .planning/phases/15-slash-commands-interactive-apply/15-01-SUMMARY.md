---
phase: 15-slash-commands-interactive-apply
plan: 01
subsystem: cli
tags: [slash-commands, commander, markdown-templates, init, uninstall]

# Dependency graph
requires:
  - phase: 12-deep-scan-infrastructure
    provides: runDeepScan function called during init
  - phase: 11-cli-commands-install-experience
    provides: init/uninstall CLI structure, utils.ts, Commander.js setup
provides:
  - generateScanCommand() and generateApplyCommand() template generators
  - installSlashCommands() in init.ts for .claude/commands/evolve/ file installation
  - removeSlashCommands() in uninstall.ts for cleanup
  - projectDir option on InitOptions and UninstallOptions
affects: [15-02, cli, commands]

# Tech tracking
tech-stack:
  added: []
  patterns: [slash-command-template-generator, create-only-guard, graceful-cleanup]

key-files:
  created:
    - src/commands/evolve-scan.ts
    - src/commands/evolve-apply.ts
    - tests/unit/commands/templates.test.ts
  modified:
    - src/cli/init.ts
    - src/cli/uninstall.ts
    - tests/unit/cli/init.test.ts
    - tests/unit/cli/uninstall.test.ts

key-decisions:
  - "Template generators are pure functions returning strings -- no filesystem access, matching Phase 13 generator pattern"
  - "Create-only guard: init skips existing command files to prevent overwriting user customizations"
  - "Graceful cleanup: uninstall uses rmdir (not rm -rf) so user-added files in evolve/ are preserved"

patterns-established:
  - "Slash command template pattern: pure function returning Markdown with YAML frontmatter"
  - "Create-only guard pattern: check fileExists before writeFile, log 'already installed' if exists"

requirements-completed: [CMD-01, CMD-03]

# Metrics
duration: 6min
completed: 2026-04-04
---

# Phase 15 Plan 01: Slash Command Templates & CLI Wiring Summary

**Pure-function slash command template generators for /evolve:scan and /evolve:apply wired into init/uninstall CLI with create-only guard and graceful cleanup**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-04T10:03:00Z
- **Completed:** 2026-04-04T10:08:57Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created generateScanCommand() producing /evolve:scan Markdown with YAML frontmatter, scan instructions, and confidence-grouped result presentation
- Created generateApplyCommand() producing /evolve:apply Markdown with apply/skip/ignore workflow, $ARGUMENTS filtering, and CLI command references
- Extended init to install slash command files with create-only guard (won't overwrite existing)
- Extended uninstall to remove slash command files with graceful empty-directory cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create slash command template generators** - `e407163` (feat)
2. **Task 2: Wire slash commands into init and uninstall CLI** - `df4f417` (feat)

_Note: TDD tasks had RED-GREEN flow within each commit._

## Files Created/Modified
- `src/commands/evolve-scan.ts` - Template generator for /evolve:scan slash command
- `src/commands/evolve-apply.ts` - Template generator for /evolve:apply slash command
- `src/cli/init.ts` - Extended with installSlashCommands, projectDir option, imports for generators
- `src/cli/uninstall.ts` - Extended with removeSlashCommands, projectDir option, rmdir import
- `tests/unit/commands/templates.test.ts` - 18 tests covering both template generators
- `tests/unit/cli/init.test.ts` - 3 new tests for slash command installation (23 total)
- `tests/unit/cli/uninstall.test.ts` - 3 new tests for slash command removal + 2 updated tests (12 total)

## Decisions Made
- Template generators are pure functions returning strings (no filesystem access) -- consistent with Phase 13 generator pattern
- Create-only guard prevents overwriting user customizations of command files
- Graceful cleanup uses rmdir (fails silently if directory not empty) to preserve user-added files
- Updated 2 existing uninstall tests to account for rm now being called for slash command removal (not just purge)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing uninstall tests for slash command rm calls**
- **Found during:** Task 2 (wiring slash commands into uninstall)
- **Issue:** Two existing uninstall tests (`without --purge keeps directory` and `--purge prompts for confirmation`) asserted `mockedRm.not.toHaveBeenCalled()`, but rm is now legitimately called for slash command file removal
- **Fix:** Changed assertions to check that rm was NOT called with `{ recursive: true, force: true }` (the purge signature) instead of asserting rm was never called
- **Files modified:** tests/unit/cli/uninstall.test.ts
- **Verification:** All 12 uninstall tests pass
- **Committed in:** df4f417 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Auto-fix was necessary to maintain test correctness after adding slash command removal. No scope creep.

## Issues Encountered
None

## Known Stubs
None -- all generators produce complete Markdown content and are fully wired into CLI lifecycle.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Template generators ready for Plan 02 CLI subcommands (scan, pending, apply-one, dismiss)
- /evolve:scan template references `npx harness-evolve scan` which Plan 02 will implement
- /evolve:apply template references `npx harness-evolve pending`, `apply-one`, `dismiss` which Plan 02 will implement

---
## Self-Check: PASSED

All 8 files verified present. Both commit hashes (e407163, df4f417) found in git log.

---
*Phase: 15-slash-commands-interactive-apply*
*Completed: 2026-04-04*
