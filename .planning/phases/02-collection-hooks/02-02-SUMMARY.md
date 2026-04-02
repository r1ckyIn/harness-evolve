---
phase: 02-collection-hooks
plan: 02
subsystem: hooks
tags: [claude-code-hooks, stdin, jsonl, tool-duration, marker-files, lifecycle-capture]

# Dependency graph
requires:
  - phase: 01-foundation-storage
    provides: appendLogEntry(), incrementCounter(), loadConfig(), ensureInit(), paths, scrubObject()
  - phase: 02-collection-hooks
    plan: 01
    provides: hookCommonSchema, all 5 input schemas, readStdin(), summarizeToolInput(), paths.pending
provides:
  - UserPromptSubmit hook handler capturing prompts with transcript_path (CAP-01, CAP-04)
  - PermissionRequest hook handler capturing tool_name with decision='unknown' (CAP-02)
  - PreToolUse hook handler with marker file write for duration correlation (CAP-03)
  - PostToolUse hook handler with duration_ms calculation via marker correlation (CAP-03)
  - PostToolUseFailure hook handler with failure tracking and marker cleanup (CAP-03)
affects: [03-pre-processing, 04-analysis, 05-delivery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Testable handler pattern: export async handleX(rawJson) for tests, main() calls readStdin + handleX for CLI"
    - "vi.mock dirs.js with getter for tempDir: enables per-test isolated file system without stubbing HOME"
    - "ensureInit() before marker write: pending dir must exist before writeFile in PreToolUse"

key-files:
  created:
    - src/hooks/user-prompt-submit.ts
    - src/hooks/permission-request.ts
    - src/hooks/pre-tool-use.ts
    - src/hooks/post-tool-use.ts
    - src/hooks/post-tool-use-failure.ts
    - tests/unit/hooks/user-prompt-submit.test.ts
    - tests/unit/hooks/permission-request.test.ts
    - tests/unit/hooks/pre-tool-use.test.ts
    - tests/unit/hooks/post-tool-use.test.ts
  modified:
    - src/schemas/log-entry.ts

key-decisions:
  - "Testable handler pattern: each hook exports handleX(rawJson) wrapping logic in try/catch; main() just calls readStdin and delegates"
  - "vi.mock dirs.js with getter pattern for test isolation instead of vi.stubEnv('HOME') which doesn't affect module-level const paths"
  - "ensureInit() called explicitly in PreToolUse before marker write because appendLogEntry (which calls ensureInit internally) runs after marker write"
  - "Extended promptEntrySchema with optional transcript_path for CAP-04 context enrichment path storage"

patterns-established:
  - "Hook handler testability: export async handleX(rawJson), test calls handler directly, main() wraps readStdin"
  - "dirs.js mock with getter: vi.mock using get paths() for dynamic tempDir per test"
  - "Error swallowing: all handlers catch all errors at top level, never exit(2), always exit(0)"

requirements-completed: [CAP-01, CAP-02, CAP-03, CAP-04]

# Metrics
duration: 7min
completed: 2026-03-31
---

# Phase 02 Plan 02: Hook Handlers Summary

**5 Claude Code lifecycle hook handlers capturing prompts, tool usage with duration correlation, permission requests, and failure events via Phase 1 storage pipeline**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-31T12:27:35Z
- **Completed:** 2026-03-31T12:35:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- All 5 hook handlers (UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest) implemented with error-safe exit(0) behavior
- PreToolUse/PostToolUse marker file correlation enabling tool duration_ms tracking
- transcript_path stored in prompt entries for Phase 3 context enrichment (CAP-04)
- 32 unit tests covering all behaviors: field capture, counter increment, config flag respect, error safety, duration calculation, marker lifecycle, input truncation
- Full test suite green: 125 tests pass including all Phase 1 tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement UserPromptSubmit and PermissionRequest hook handlers with tests** - `1e85ffe` (feat)
2. **Task 2: Implement PreToolUse, PostToolUse, and PostToolUseFailure hook handlers with tests** - `cef2322` (feat)

## Files Created/Modified
- `src/hooks/user-prompt-submit.ts` - Captures prompt, session_id, cwd, prompt_length, transcript_path via appendLogEntry('prompts')
- `src/hooks/permission-request.ts` - Captures tool_name with decision='unknown' via appendLogEntry('permissions')
- `src/hooks/pre-tool-use.ts` - Writes marker file to pending/, logs 'pre' tool entry with input_summary
- `src/hooks/post-tool-use.ts` - Reads marker file, calculates duration_ms, logs 'post' tool entry with success=true
- `src/hooks/post-tool-use-failure.ts` - Cleans up marker file, logs 'failure' tool entry with success=false
- `src/schemas/log-entry.ts` - Added transcript_path: z.string().optional() to promptEntrySchema
- `tests/unit/hooks/user-prompt-submit.test.ts` - 6 tests: field capture, transcript_path, counter, config, malformed input
- `tests/unit/hooks/permission-request.test.ts` - 5 tests: field capture, counter, config, malformed input
- `tests/unit/hooks/pre-tool-use.test.ts` - 8 tests: marker file, log entry, input_summary, truncation, counter, config, errors
- `tests/unit/hooks/post-tool-use.test.ts` - 13 tests: PostToolUse duration/marker/summary + PostToolUseFailure failure/marker/cleanup

## Decisions Made
- Used testable handler pattern: export `handleX(rawJson)` for direct test invocation, `main()` at file bottom just reads stdin and delegates. Avoids need to mock process.stdin and process.exit in tests.
- Used vi.mock with getter pattern for dirs.js test isolation. vi.stubEnv('HOME') doesn't work because `paths` is a module-level constant evaluated at first import.
- Called `ensureInit()` explicitly in PreToolUse handler before marker write. The `appendLogEntry()` call (which also calls ensureInit) happens after the marker write, so pending/ directory must be pre-created.
- Extended promptEntrySchema with optional transcript_path field to satisfy CAP-04 requirement for context enrichment path storage.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added ensureInit() call before marker file write in PreToolUse**
- **Found during:** Task 2 (TDD GREEN phase)
- **Issue:** Plan placed marker writeFile before appendLogEntry. Since appendLogEntry calls ensureInit() internally, but writeFile runs first, the pending/ directory didn't exist yet, causing silent failure.
- **Fix:** Added explicit `await ensureInit()` call before the marker writeFile in handlePreToolUse
- **Files modified:** src/hooks/pre-tool-use.ts
- **Verification:** All 8 pre-tool-use tests pass, marker file correctly created
- **Committed in:** cef2322

**2. [Rule 1 - Bug] Changed test pattern from vi.stubEnv to vi.mock for dirs.js**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Plan suggested vi.stubEnv('HOME', tmpDir) + resetInit() + ensureInit(), but `paths` is a module-level constant computed at first import, so changing HOME after import has no effect
- **Fix:** Used vi.mock('../../../src/storage/dirs.js') with getter pattern matching the established logger.test.ts pattern from Phase 1
- **Files modified:** All 4 test files
- **Verification:** All 32 hook handler tests pass with isolated temp directories
- **Committed in:** 1e85ffe, cef2322

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes essential for correctness. The ensureInit order bug would have caused marker files to silently fail in production. The test pattern fix was required for test isolation. No scope creep.

## Issues Encountered
None beyond the deviations noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 hook handlers are ready for tsup compilation to dist/hooks/ entry points
- Plan 03 (tsup build + settings.json registration) can proceed
- No blockers: all CAP-01 through CAP-04 requirements fully implemented and tested
- 125 total tests green across full test suite

## Self-Check: PASSED

- All 11 files found (10 source/test + 1 SUMMARY)
- Both task commits verified (1e85ffe, cef2322)
- No stubs detected in any created/modified file

---
*Phase: 02-collection-hooks*
*Completed: 2026-03-31*
