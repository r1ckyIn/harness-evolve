---
phase: 02-collection-hooks
plan: 01
subsystem: schemas
tags: [zod, hooks, stdin, validation, tool-input]

# Dependency graph
requires:
  - phase: 01-foundation-storage
    provides: userPromptSubmitInputSchema, paths object, ensureInit(), appendLogEntry()
provides:
  - hookCommonSchema with shared fields for all 5 hook events
  - preToolUseInputSchema, postToolUseInputSchema, postToolUseFailureInputSchema, permissionRequestInputSchema
  - readStdin() and readFromStream() for stdin buffering
  - summarizeToolInput() for concise log-safe tool input summaries
  - paths.pending for tool_use_id duration correlation markers
affects: [02-collection-hooks, 03-pre-processing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "hookCommonSchema.extend() for event-specific schema composition"
    - "readFromStream() testability pattern: extract stream dependency for unit testing"
    - "summarizeToolInput() switch-based tool dispatch with 200-char truncation"

key-files:
  created:
    - src/hooks/shared.ts
    - tests/unit/hooks/shared.test.ts
  modified:
    - src/schemas/hook-input.ts
    - src/storage/dirs.ts
    - src/index.ts

key-decisions:
  - "Zod v4 z.record() requires two args: z.record(z.string(), z.unknown()) not z.record(z.unknown())"
  - "readFromStream() extracted for testability; readStdin() delegates to it with process.stdin"

patterns-established:
  - "Hook input schema composition: hookCommonSchema.extend() for type-safe event schemas"
  - "Stream reader testability: export a stream-parameterized function, wrap stdin in public API"

requirements-completed: [CAP-03, CAP-04]

# Metrics
duration: 5min
completed: 2026-03-31
---

# Phase 02 Plan 01: Contract Schemas and Shared Hook Utilities Summary

**Zod v4 input schemas for all 5 Claude Code hook events plus shared stdin reader and tool input summarizer with 200-char truncation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-31T12:18:24Z
- **Completed:** 2026-03-31T12:23:59Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- All 5 hook event input schemas (UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest) with hookCommonSchema composition and z.literal() discrimination
- Shared readStdin()/readFromStream() for reliable stdin buffering across all hook handlers
- summarizeToolInput() dispatching per tool type (Bash/Write/Edit/Read/Glob/Grep/default) with 200-char cap
- paths.pending directory for tool_use_id duration markers, auto-created by ensureInit()
- All new schemas and utilities exported from index.ts barrel

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend hook input schemas for all 5 Claude Code hook events** - `71d0483` (feat)
2. **Task 2: Create shared stdin reader and tool input summarizer** - `7edce86` (feat)
3. **Task 3: Update dirs.ts with pending directory and extend index.ts exports** - `a3dbf0d` (feat)

## Files Created/Modified
- `src/schemas/hook-input.ts` - Extended from 1 schema to 6 (hookCommon + 5 event schemas) with full Zod v4 types
- `src/hooks/shared.ts` - New: readStdin(), readFromStream(), summarizeToolInput() with truncation
- `src/storage/dirs.ts` - Added paths.pending and ensureInit() mkdir for pending directory
- `src/index.ts` - Exports all 6 schemas, 6 types, and 3 shared utility functions
- `tests/unit/hooks/shared.test.ts` - 31 unit tests: 15 schema + 12 summarize + 4 stream

## Decisions Made
- Fixed Zod v4 API: z.record() requires explicit key type z.record(z.string(), z.unknown()) -- plan used z.record(z.unknown()) which crashes at runtime
- Extracted readFromStream(stream) as testable primitive; readStdin() wraps it with process.stdin -- avoids mocking global process.stdin in tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Zod v4 z.record() API**
- **Found during:** Task 1 (schema implementation)
- **Issue:** Plan specified `z.record(z.unknown())` but Zod v4 requires two args `z.record(z.string(), z.unknown())`
- **Fix:** Changed all `z.record(z.unknown())` to `z.record(z.string(), z.unknown())` in hook-input.ts
- **Files modified:** src/schemas/hook-input.ts
- **Verification:** All 15 schema tests pass
- **Committed in:** 71d0483

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for runtime correctness. No scope creep.

## Issues Encountered
None beyond the Zod v4 API deviation noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All hook input schemas are ready for Plan 02 hook handlers to import and use
- readStdin() and summarizeToolInput() are ready for direct use in hook entry points
- paths.pending is ready for PreToolUse/PostToolUse duration correlation markers
- No blockers for Plan 02 execution

## Self-Check: PASSED

- All 6 files found (5 source/test + 1 SUMMARY)
- All 3 task commits verified (71d0483, 7edce86, a3dbf0d)
- No stubs detected in any created/modified file

---
*Phase: 02-collection-hooks*
*Completed: 2026-03-31*
