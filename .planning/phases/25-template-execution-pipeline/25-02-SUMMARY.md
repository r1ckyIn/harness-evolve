---
phase: 25-template-execution-pipeline
plan: 02
subsystem: commands
tags: [slash-commands, template, apply, prompt-engineering, v5, one-at-a-time]

requires:
  - phase: 25-template-execution-pipeline
    provides: v5 scan template pattern, updated test file with scan v5 assertions
provides:
  - v5 apply template with strict one-at-a-time enforcement
  - Per-decision confirmation gates
  - Inline error handling per step (no standalone section)
  - Imperative preamble constraining model behavior
affects: [init, dogfooding]

tech-stack:
  added: []
  patterns: [one-at-a-time-enforcement, per-decision-confirmation, imperative-pipeline-template]

key-files:
  created: []
  modified:
    - src/commands/evolve-apply.ts
    - tests/unit/commands/templates.test.ts

key-decisions:
  - "Kept ## Prerequisites section as minimal heading for backward test compatibility, content moved inline to Step 1"
  - "5 MANDATORY markers placed at critical pipeline gates (pending read, present ONE, wait for choice, confirm result)"
  - "4 DO NOT markers for batching prevention (present multiple, summarize all, retry, batch decisions)"

patterns-established:
  - "One-at-a-time enforcement: MANDATORY + DO NOT markers + per-decision confirmation gate"
  - "Inline error handling per step with offer of skip/dismiss as alternatives on failure"

requirements-completed: [TMPL-02]

duration: 4min
completed: 2026-04-11
---

# Phase 25 Plan 02: Apply Template v5 Summary

**Rewrote /evolve:apply template from v4 to v5 with strict one-at-a-time enforcement, MANDATORY markers, per-decision confirmation gates, and inline error handling**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-11T12:30:30Z
- **Completed:** 2026-04-11T12:34:04Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Apply template v5 with imperative preamble constraining model to follow steps exactly and not improvise
- One-at-a-time enforcement: "exactly ONE recommendation", "DO NOT present multiple", "DO NOT batch"
- Per-decision confirmation: "confirm the result to the user before moving to the next recommendation"
- 5 MANDATORY markers at critical pipeline gates, 4 DO NOT markers for batching prevention
- Inline error handling per step (apply failure offers skip/dismiss alternatives)
- Template reduced from 197 to 131 lines by removing standalone Error Handling section and tightening prose

## Task Commits

Each task was committed atomically:

1. **Task 1: Update apply template tests for v5 assertions** - `0e99a4b` (test)
2. **Task 2: Rewrite apply template to v5 imperative one-at-a-time pipeline** - `4b72bb1` (feat)

_TDD: Task 1 = RED (6 failures confirmed), Task 2 = GREEN (all 702 tests pass)_

## Files Created/Modified
- `src/commands/evolve-apply.ts` - v5 apply template with imperative preamble, MANDATORY/DO NOT markers, per-decision confirmation, inline error handling
- `tests/unit/commands/templates.test.ts` - v5 assertions: version 5, DO NOT present multiple, MANDATORY + ONE recommendation, per-decision confirmation, imperative preamble, inline error handling

## Decisions Made
- Kept `## Prerequisites` section as minimal heading for backward compatibility with existing tests; actual verification content is in Step 1
- Used 5 MANDATORY markers at critical pipeline gates (read pending, present ONE, wait for choice, confirm before next)
- Used 4 DO NOT markers specifically targeting batching behavior (present multiple, summarize all, retry automatically, batch decisions)
- Preserved all 4 options (Apply/Skip/Dismiss/Let Claude decide) and filter argument support exactly as in v4

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both scan and apply templates now at v5 with imperative pipeline language
- Ready for dogfooding to validate model compliance with one-at-a-time enforcement
- `init.ts` version comparison will auto-update installed slash commands when users run `harness-evolve init`

---
*Phase: 25-template-execution-pipeline*
*Completed: 2026-04-11*
