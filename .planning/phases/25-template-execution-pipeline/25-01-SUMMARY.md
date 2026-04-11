---
phase: 25-template-execution-pipeline
plan: 01
subsystem: commands
tags: [slash-commands, template, scan, prompt-engineering, v5]

requires:
  - phase: 24-context-infrastructure-legacy-cleanup
    provides: scan-context CLI bridge, store-findings CLI, deprecated scan command redirect
provides:
  - v5 scan template with imperative pipeline language
  - First-scan vs subsequent-scan detection gate (Step 0)
  - Per-step verification gates and inline error handling
  - Explicit command allowlists per step
affects: [25-02, evolve-apply, init]

tech-stack:
  added: []
  patterns: [imperative-pipeline-template, verification-gates, first-scan-detection]

key-files:
  created: []
  modified:
    - src/commands/evolve-scan.ts
    - tests/unit/commands/templates.test.ts

key-decisions:
  - "Areas integrated into Step 2 rather than separate Analysis Guidance section"
  - "Kept allowed-tools as Bash(npx harness-evolve *) — ls/cat for detection run with user permission"
  - "Template reduced from 351 to 270 lines by tightening prose, not cutting content"

patterns-established:
  - "Imperative pipeline: preamble + step gates + inline error handling per step"
  - "First-scan detection: ls summary.json at Step 0 with branching in Step 2"

requirements-completed: [TMPL-01, TMPL-03]

duration: 4min
completed: 2026-04-11
---

# Phase 25 Plan 01: Scan Template v5 Summary

**Rewrote /evolve:scan template from v4 to v5 with imperative pipeline language, first-scan/subsequent-scan detection, inline error handling, and per-step verification gates**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-11T12:23:11Z
- **Completed:** 2026-04-11T12:27:30Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Scan template v5 with imperative preamble constraining model to follow steps exactly
- Step 0 first-scan detection via `ls ~/.harness-evolve/analysis/pre-processed/summary.json`
- Inline error handling per step (no separate bottom Error Handling section)
- All 7 analysis areas preserved with 4 subsections each
- No deprecated commands mentioned anywhere in template
- Template reduced from 351 to 270 lines (23% reduction)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update scan template tests for v5 assertions** - `a9739de` (test)
2. **Task 2: Rewrite scan template to v5 imperative pipeline** - `61d8eb2` (feat)

_TDD: Task 1 = RED (6 failures confirmed), Task 2 = GREEN (all 698 tests pass)_

## Files Created/Modified
- `src/commands/evolve-scan.ts` - v5 scan template with imperative pipeline, first-scan detection, inline error handling
- `tests/unit/commands/templates.test.ts` - v5 assertions: version 5, imperative preamble, summary.json check, deprecated command exclusion, MANDATORY/DO NOT markers, 200-300 line range

## Decisions Made
- Integrated analysis areas directly into Step 2 (removed separate `## Analysis Guidance` section header) for tighter template flow
- Kept `allowed-tools: Bash(npx harness-evolve *)` unchanged — the `ls` and `cat` commands for first-scan detection run via normal Bash permission, not the allowed-tools grant
- Compressed severity/confidence rules per area into single-line format to save lines while preserving information

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated Analysis Guidance section test to match v5 structure**
- **Found during:** Task 2 (GREEN phase)
- **Issue:** Test asserted `## Analysis Guidance` section header which no longer exists in v5 (areas integrated into Step 2)
- **Fix:** Changed test to assert `Step 2: Analyze Configuration` instead
- **Files modified:** tests/unit/commands/templates.test.ts
- **Verification:** All 58 template tests pass
- **Committed in:** 61d8eb2 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary adaptation of v4-specific test to v5 structure. No scope creep.

## Issues Encountered
None

## Known Stubs
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- v5 scan template ready for dogfooding
- Apply template (Plan 02) next — will also bump to v5 with one-at-a-time enforcement
- `init.ts` version comparison will auto-update installed slash commands when TEMPLATE_VERSION changes from 4 to 5

---
*Phase: 25-template-execution-pipeline*
*Completed: 2026-04-11*
