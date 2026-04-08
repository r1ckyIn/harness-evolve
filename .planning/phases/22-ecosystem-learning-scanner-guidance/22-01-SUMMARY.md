---
phase: 22-ecosystem-learning-scanner-guidance
plan: 01
subsystem: scanner
tags: [slash-commands, model-driven, template, scan-guidance, severity-classification]

requires:
  - phase: 21-foundation-context-infrastructure
    provides: scan-context CLI and store-findings CLI for model-driven pipeline
  - phase: 23-model-driven-validation-legacy-cleanup
    provides: Legacy scanner removal, model-driven architecture established
provides:
  - v4 scan template with 7 analysis area checklists and model-executable guidance
  - Structured output contract matching Recommendation schema
  - Severity tier classification matrix (problem/suggestion)
  - Boundary condition sections preventing false positives
affects: [22-02, evolve-apply, verify-work]

tech-stack:
  added: []
  patterns: [model-driven-guidance-document, structured-output-contract, severity-tier-classification, boundary-condition-sections]

key-files:
  created: []
  modified:
    - src/commands/evolve-scan.ts
    - tests/unit/commands/templates.test.ts

key-decisions:
  - "Template embeds guidance as structured markdown in TypeScript template literal (not external .md file) -- established pattern from Phase 19"
  - "Each analysis area is self-contained (15-20 lines) enabling extensibility by adding new markdown sections"
  - "Conservative classification guidance: prefer suggestion over problem, MEDIUM over HIGH"
  - "Template uses scan-context exclusively (not deprecated scan command) to avoid stderr noise"

patterns-established:
  - "Model-driven guidance: structured markdown sections with What to Check / Severity Rules / Confidence / Do NOT Flag per analysis area"
  - "Severity tier classification matrix: decision table mapping conditions to severity + confidence levels"
  - "Boundary condition sections: explicit Do NOT Flag exclusions per area plus global exclusions"

requirements-completed: [ECO-01, ECO-02, SCAN-01, SCAN-02]

duration: 5min
completed: 2026-04-08
---

# Phase 22 Plan 01: Scan Template v4 Model-Driven Guidance Summary

**Rewrote /evolve:scan from CLI-result-display template (v3) to 328-line model-executable guidance document (v4) with 7 analysis area checklists, severity classification matrix, and structured output contract**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-08T03:28:26Z
- **Completed:** 2026-04-08T03:34:10Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Rewrote scan template from v3 (171 lines, CLI display) to v4 (328 lines, model-executable guidance)
- Embedded 7 analysis area checklists with per-area What to Check, Severity Rules, Confidence, and Do NOT Flag subsections
- Added structured output contract with complete JSON example matching Recommendation schema
- Added severity tier classification matrix and boundary condition sections (3 patterns from GSD/open-source)
- Wrote 27 comprehensive tests for v4 guidance content while keeping all 26 apply template tests unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite scan template with model-driven guidance document** - `06328ee` (feat)
2. **Task 2: Rewrite template tests for v4 guidance content** - `54bae4c` (test)
3. **Task 3: Full test suite verification and build check** - verification only (684 tests, tsc clean, build success)

## Files Created/Modified

- `src/commands/evolve-scan.ts` - v4 model-driven guidance template (328 lines) replacing v3 CLI-display template
- `tests/unit/commands/templates.test.ts` - 53 tests (27 scan v4 + 26 apply v3) replacing 41 previous tests

## Decisions Made

- Template embeds guidance as structured markdown in TypeScript template literal (not external .md file) -- follows established pattern from Phase 19 and avoids async file I/O complexity
- Each analysis area is self-contained (15-20 lines) enabling extensibility by adding new markdown sections without TypeScript logic changes
- Conservative classification guidance: "prefer suggestion over problem, MEDIUM over HIGH" reduces false positives
- Template uses scan-context exclusively (not deprecated scan command) to avoid stderr deprecation notice interfering with JSON piping

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all template content is complete and functional.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- v4 scan template ready for Plan 02 (apply template alignment)
- scan-context -> model analysis -> store-findings pipeline fully specified in template
- 684 tests passing, build clean, ready for Phase 22 Plan 02

---
*Phase: 22-ecosystem-learning-scanner-guidance*
*Completed: 2026-04-08*
