---
phase: 24-context-infrastructure-legacy-cleanup
plan: 02
subsystem: cli
tags: [deprecation, scan, legacy-cleanup]
dependency_graph:
  requires: []
  provides: [hard-error-scan-command]
  affects: [src/cli/scan.ts, tests/unit/cli/scan.test.ts]
tech_stack:
  added: []
  patterns: [hard-error-deprecation-pattern]
key_files:
  created: []
  modified: [src/cli/scan.ts, tests/unit/cli/scan.test.ts]
decisions:
  - Synchronous action handler (no async needed since no I/O)
  - Keep command registered for CLI discoverability (--help shows it)
metrics:
  duration: 2min
  completed: "2026-04-11T11:41:00Z"
  tasks_completed: 1
  tasks_total: 1
  test_count: 8
  tests_passing: 8
---

# Phase 24 Plan 02: Remove Deprecated Scan CLI Summary

Hard error replacement for the scan CLI subcommand -- exits 1 with deprecation message directing users to /evolve:scan or scan-context.

## What Was Done

Rewrote `src/cli/scan.ts` from a working deep-scan command (calling `runDeepScan` and outputting JSON) to a hard error command that:
- Outputs error to stderr containing "removed in v5.0"
- Points users to `/evolve:scan` for model-driven analysis
- Points users to `harness-evolve scan-context` for raw JSON
- Sets `process.exitCode = 1`
- Does NOT import or call `buildScanContext` or `runDeepScan`

## TDD Execution

| Phase | Tests | Status |
|-------|-------|--------|
| RED | 8 tests written asserting error behavior | All failed against old implementation |
| GREEN | scan.ts rewritten as hard error | All 8 tests pass |
| REFACTOR | Not needed -- implementation is minimal | N/A |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| a752d06 | test | Add failing tests for deprecated scan command |
| 876dccc | feat | Replace scan CLI with hard error command |

## Verification

- `npx vitest run tests/unit/cli/scan.test.ts` -- 8/8 pass
- `npx vitest run` -- 611/611 pass (full suite)
- `npx tsc --noEmit` -- clean
- `npx tsx src/cli.ts scan` -- outputs error to stderr, exits 1

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- src/cli/scan.ts: FOUND
- tests/unit/cli/scan.test.ts: FOUND
- Commit a752d06: FOUND
- Commit 876dccc: FOUND
