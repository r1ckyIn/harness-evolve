---
phase: 17-bug-fixes-reliability
plan: 01
subsystem: cli, scan
tags: [slash-commands, reference-extraction, npm-scope, false-positive-filtering]

requires:
  - phase: 15-slash-commands-interactive-apply
    provides: installSlashCommands and extractReferences original implementations
provides:
  - Global slash command installation targeting ~/.claude/commands/evolve/
  - Reference extraction with npm/URL false positive filtering
  - Stale project-level commands warning
affects: [18-config-audit, 19-workflow-docs]

tech-stack:
  added: []
  patterns:
    - "isNpmScopedPackage/isUrlUserPath helper pattern for content-aware filtering"
    - "Stale detection pattern: check old location after migrating to new"

key-files:
  created: []
  modified:
    - src/cli/init.ts
    - tests/unit/cli/init.test.ts
    - src/scan/context-builder.ts
    - tests/unit/scan/context-builder.test.ts

key-decisions:
  - "Trailing dot cleanup before npm scope check to handle punctuation in references like @src/index.ts."
  - "npm scope detection uses segment count + file extension heuristic (2 segments, no extension = npm package)"
  - "URL path detection uses prev-char check for / or : (simple, covers all URL formats)"

patterns-established:
  - "Content-aware filtering: check surrounding characters to disambiguate @ references"

requirements-completed: [FIX-01, FIX-02]

duration: 6min
completed: 2026-04-04
---

# Phase 17 Plan 01: Input-Side Bug Fixes Summary

**Global slash command installation via ~/.claude/commands/evolve/ and npm/URL false positive filtering in reference extraction**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-04T13:22:27Z
- **Completed:** 2026-04-04T13:28:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- installSlashCommands() now targets ~/.claude/commands/evolve/ (global) so /evolve:scan and /evolve:apply work from any directory
- runInit() warns when stale project-level .claude/commands/evolve/ directory is detected after global install
- extractReferences() filters npm scoped packages (@scope/package) and URL user paths (/@user/path) while preserving real file references (@docs/guide.md)
- 619 tests passing across 58 files (12 new tests added, zero regressions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix global slash command installation path + stale warning** - `022be8c` (fix) - TDD: RED->GREEN
2. **Task 2: Filter npm scoped packages and URL paths from reference extraction** - `eb8b84c` (fix) - TDD: RED->GREEN

## Files Created/Modified
- `src/cli/init.ts` - installSlashCommands() uses process.env.HOME; runInit() adds stale project-level warning
- `tests/unit/cli/init.test.ts` - 3 new tests (global HOME path, stale warning, no-stale check); updated 3 existing tests for global paths
- `src/scan/context-builder.ts` - Added isNpmScopedPackage() and isUrlUserPath() helper functions; extractReferences() applies both filters
- `tests/unit/scan/context-builder.test.ts` - 9 new tests for reference filtering edge cases

## Decisions Made
- Moved trailing dot cleanup before npm scope check to prevent punctuation from causing false negatives (e.g., @src/index.ts. at end of sentence)
- npm scope detection uses a simple heuristic: exactly 2 path segments with no file extension on the last segment
- URL path detection uses single character check (/ or :) which covers github.com/@user, https://npmjs.com/@scope, and similar patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Trailing dot cleanup order in extractReferences**
- **Found during:** Task 2
- **Issue:** The plan specified adding npm/URL filters after the email check and before the `cleaned` line, but the trailing dot from sentence punctuation (e.g., `@src/index.ts.`) caused `isNpmScopedPackage` to wrongly identify `src/index.ts.` as an npm package (last segment `index.ts.` fails the extension regex because it ends with a bare dot)
- **Fix:** Moved the trailing dot cleanup (`ref.replace(/\.$/, '')`) to happen before the npm scope check, and pass `cleaned` to `isNpmScopedPackage` instead of raw `ref`
- **Files modified:** src/scan/context-builder.ts
- **Verification:** Existing test `extracts @references from CLAUDE.md content` now passes (expects `src/index.ts` from `@src/index.ts.`)
- **Committed in:** eb8b84c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary for correctness -- without this fix, real file references ending with punctuation would be incorrectly filtered as npm packages.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all implementations are complete with no placeholder data.

## Next Phase Readiness
- FIX-01 and FIX-02 resolved, unblocking Phase 18 (config audit depends on FIX-02 scanner fixes) and Phase 19 (workflow docs depend on FIX-01 global command path)
- Full test suite green (619 tests), typecheck clean

## Self-Check: PASSED

All files exist, both commits verified, all implementation patterns confirmed.

---
*Phase: 17-bug-fixes-reliability*
*Completed: 2026-04-04*
