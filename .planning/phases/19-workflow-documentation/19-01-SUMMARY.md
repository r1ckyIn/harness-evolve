---
phase: 19-workflow-documentation
plan: 01
subsystem: cli
tags: [slash-commands, workflow-docs, template-generators, vitest]

# Dependency graph
requires:
  - phase: 18-comprehensive-config-audit
    provides: Severity-based scan output (problems/suggestions arrays) that templates reference
  - phase: 17-bug-fixes-reliability
    provides: Global slash command install path (~/.claude/commands/evolve/)
provides:
  - Comprehensive self-contained workflow .md templates for /evolve:scan and /evolve:apply
  - Template version tracking constants and getter functions for version-aware updates
  - 16 new tests verifying workflow completeness and self-containment
affects: [19-02 (version-aware update mechanism uses template versions from this plan)]

# Tech tracking
tech-stack:
  added: []
  patterns: [self-contained workflow document structure with Prerequisites/Instructions/Output Format/Error Handling/Edge Cases/Notes]

key-files:
  created: []
  modified:
    - src/commands/evolve-scan.ts
    - src/commands/evolve-apply.ts
    - tests/unit/commands/templates.test.ts

key-decisions:
  - "Template version embedded as HTML comment (<!-- template-version: N -->) for easy extraction without YAML parsing"
  - "allowed-tools scoped to Bash(npx harness-evolve *) to avoid broad permission grants"
  - "Error handling specifies 3 scenarios each (CLI fail, no results/apply fail, parse error/dismiss fail) based on research Pattern 3"

patterns-established:
  - "Self-contained workflow document: frontmatter + Context + Prerequisites + Instructions (numbered steps) + Output Format + Error Handling + Edge Cases + Notes"
  - "Template version tracking: const VERSION + exported getter for init.ts to compare"

requirements-completed: [WFL-01, WFL-02]

# Metrics
duration: 3min
completed: 2026-04-05
---

# Phase 19 Plan 01: Workflow Documentation Summary

**Comprehensive GSD-style workflow templates for /evolve:scan (130+ lines) and /evolve:apply (150+ lines) with error handling, exact output formatting, edge cases, and template version tracking**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T04:33:15Z
- **Completed:** 2026-04-05T04:36:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Rewrote scan template from ~75 lines to 130+ lines with 7 structured sections (Context, Prerequisites, Instructions, Output Format, Error Handling, Edge Cases, Notes)
- Rewrote apply template from ~78 lines to 150+ lines with 8 structured sections (Context, Arguments, Prerequisites, Instructions, Output Format, Error Handling, Edge Cases, Notes)
- Added template version tracking (SCAN_TEMPLATE_VERSION, APPLY_TEMPLATE_VERSION) with exported getters for version-aware update mechanism
- Added allowed-tools frontmatter to both templates scoped to harness-evolve CLI
- Full test suite: 701 tests pass across 62 files (16 new tests added)

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite scan template generator with comprehensive workflow** - `86b76a5` (feat)
2. **Task 2: Rewrite apply template generator with comprehensive workflow** - `965457b` (feat)

_Both tasks followed TDD: RED (failing tests) -> GREEN (implementation) -> verified_

## Files Created/Modified
- `src/commands/evolve-scan.ts` - Comprehensive scan workflow template with 7 sections, version tracking, allowed-tools
- `src/commands/evolve-apply.ts` - Comprehensive apply workflow template with 8 sections, version tracking, allowed-tools
- `tests/unit/commands/templates.test.ts` - 16 new tests for workflow completeness, self-containment, template versioning

## Decisions Made
- Template version as HTML comment (`<!-- template-version: N -->`) rather than YAML frontmatter field -- easier to extract with regex, no YAML parser needed
- `allowed-tools: Bash(npx harness-evolve *)` scoped narrowly to only harness-evolve CLI calls rather than broad `Bash` access
- Three error handling scenarios per template based on research Pattern 3 (CLI fail, domain-specific fail, parse/dismiss fail)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Template version constants and getters ready for 19-02 (version-aware update mechanism in installSlashCommands)
- Both templates fully self-contained, satisfying WFL-01 and WFL-02

## Self-Check: PASSED

- All 4 files exist (2 source, 1 test, 1 summary)
- Both task commits verified (86b76a5, 965457b)
- SCAN_TEMPLATE_VERSION and APPLY_TEMPLATE_VERSION constants present
- getScanTemplateVersion and getApplyTemplateVersion exported
- 701 tests pass across 62 files

---
*Phase: 19-workflow-documentation*
*Completed: 2026-04-05*
