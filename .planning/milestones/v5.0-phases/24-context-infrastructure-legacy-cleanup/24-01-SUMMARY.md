---
phase: 24-context-infrastructure-legacy-cleanup
plan: 01
subsystem: scan
tags: [scope-labeling, schema, context-builder, scan-context]
dependency_graph:
  requires: []
  provides: [scope-labeled-commands, scope-labeled-rules, scope-summary]
  affects: [scan-context-output, deep-scan-pipeline]
tech_stack:
  added: []
  patterns: [recursive-command-reading, scope-labeling, summary-aggregation]
key_files:
  created: []
  modified:
    - src/scan/schemas.ts
    - src/scan/context-builder.ts
    - tests/unit/scan/context-builder.test.ts
    - tests/unit/scan/schemas.test.ts
    - tests/unit/scan/scanners/mechanization.test.ts
    - tests/unit/scan/scanners/redundancy.test.ts
    - tests/unit/scan/scanners/staleness.test.ts
    - tests/integration/cli-scan.test.ts
decisions:
  - Used z.default('project') for rules scope to maintain backward compatibility with existing data
  - Used collectMdFiles (recursive) for commands to support subdirectory structures
  - Compute scope_summary by counting all source types across project/local and user scopes
metrics:
  duration: 7min
  completed: 2026-04-11T11:46:00Z
  tasks_completed: 2
  tasks_total: 2
  files_modified: 8
  tests_added: 8
  tests_total: 614
---

# Phase 24 Plan 01: Scope Labeling for Scan-Context Summary

Scope fields added to commands and rules in scan-context output, plus global commands reading and top-level scope_summary for model analysis.

## What Was Done

### Task 1: Update schema and context-builder for scope labeling (TDD)

Updated `src/scan/schemas.ts`:
- Added `scope: z.enum(['user', 'project'])` to commands array item schema
- Added `scope: z.enum(['user', 'project']).default('project')` to rules array item schema
- Added top-level `scope_summary` object with `project_sources`, `user_sources`, `has_project_config`, `has_user_config`

Updated `src/scan/context-builder.ts`:
- Refactored `readCommandFiles(cwd, home)` to read from both project `.claude/commands/` and global `~/.claude/commands/`
- Uses `collectMdFiles()` (recursive) instead of flat readdir for full subdirectory support
- Computes command `name` as relative path without `.md` extension (e.g., `evolve/scan`)
- Added `scope: 'project'` to all rule objects in `readRuleFiles`
- Added `buildScopeSummary()` function counting project vs user sources
- Updated `buildScanContext` to pass `homeDir` to `readCommandFiles` and include `scope_summary`

### Task 2: Update all test files for new schema fields

- Added integration tests verifying scope_summary presence and correctness in deep scan output
- Added test for commands having scope fields in integration pipeline
- Updated scanner test helpers (mechanization, redundancy, staleness) with `scope_summary` field
- Updated schema test fixtures with new `scope` on commands and `scope_summary`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scanner test helpers missing scope_summary**
- **Found during:** Task 1
- **Issue:** Scanner test files (mechanization, redundancy, staleness) use `makeScanContext()` helpers that didn't include the now-required `scope_summary` field
- **Fix:** Added `scope_summary: { project_sources: 0, user_sources: 0, has_project_config: false, has_user_config: false }` to all three helpers
- **Files modified:** tests/unit/scan/scanners/mechanization.test.ts, redundancy.test.ts, staleness.test.ts

**2. [Rule 3 - Blocking] Plan references non-existent test files**
- **Found during:** Task 2
- **Issue:** Plan references `tests/unit/cli/scan-context.test.ts` and `tests/integration/scan-pipeline-v4.test.ts` which don't exist. Actual files are `tests/unit/cli/scan.test.ts` and `tests/integration/cli-scan.test.ts`
- **Fix:** Updated the actual test files instead. No mock changes needed for `tests/unit/cli/scan.test.ts` as it uses `{} as any` for scan_context mock.

## Verification Results

- `npx vitest run` (full suite): 614 tests passing across 58 test files
- `npx tsc --noEmit`: Clean, no type errors
- All acceptance criteria met:
  - Commands have scope='user'|'project'
  - Rules have scope='project'
  - scope_summary accurately counts sources
  - Global commands reading works
  - Recursive subdirectory reading works (evolve/scan.md -> name: "evolve/scan")

## Known Stubs

None - all features fully implemented and wired.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | e93b471 | feat(24-01): add scope labeling to scan-context output |
| 2 | 9dc2b6a | test(24-01): add integration tests for scope fields and scope_summary |

## Self-Check: PASSED

- All source files exist (schemas.ts, context-builder.ts)
- Both commits verified (e93b471, 9dc2b6a)
- scope_summary present in both schema and context-builder
- 614 tests passing, TypeScript clean
