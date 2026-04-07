---
phase: 21-foundation-context-infrastructure
plan: 03
subsystem: cli
tags: [store-findings, stdin, zod-validation, atomic-write, cli]
dependency_graph:
  requires: [21-01]
  provides: [store-findings-cli, model-output-pipeline]
  affects: [pending, apply-one, evolve-apply]
tech_stack:
  added: []
  patterns: [stdin-reading, zod-safeParse-batch, write-file-atomic]
key_files:
  created:
    - src/cli/store-findings.ts
    - tests/unit/cli/store-findings.test.ts
  modified:
    - src/cli.ts
decisions:
  - "Added store-findings after dismiss command (not after scan-context since Plan 02 runs in parallel wave)"
metrics:
  duration: 3min
  completed: 2026-04-07
---

# Phase 21 Plan 03: Store-Findings CLI Command Summary

Store-findings CLI subcommand that validates model-generated findings from stdin via Zod safeParse and persists valid ones atomically to the analysis pipeline for pending/apply consumption.

## What Was Done

### Task 1: Create store-findings CLI command with tests (TDD)
- **RED**: Wrote 9 failing tests covering valid/invalid/mixed findings, TTY guard, malformed JSON, ensureInit, and schema compliance
- **GREEN**: Implemented `registerStoreFindingsCommand` with stdin reading, Zod validation, atomic write, and error reporting
- **Commits**: `dce1e76` (test RED), `3357e08` (feat GREEN)

### Task 2: Register store-findings in CLI program and verify full pipeline
- Added import and registration in `src/cli.ts` after dismiss command
- Verified full test suite (616 tests), build, and typecheck pass
- Verified `store-findings --help` outputs correct description
- **Commit**: `4d0d3d6`

## Key Implementation Details

- **stdin reading**: Collects Buffer chunks via async iterator, concatenates to string
- **Validation**: `recommendationSchema.safeParse()` on each finding individually -- valid ones stored, invalid ones skipped with indexed error messages
- **Output format**: JSON summary `{stored: N, skipped: M, errors: [...]}` to stdout
- **Persistence**: Wraps valid findings in `analysisResultSchema`-compliant envelope with `generated_at`, `summary_period`, and `metadata` fields, written atomically via `write-file-atomic`
- **INFRA-04**: Calls `ensureInit()` before any file operations, auto-creating `~/.harness-evolve/` directory tree
- **TTY guard**: Detects `process.stdin.isTTY` and prints usage to stderr with exit code 1

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run` (full suite) | 616 tests pass |
| `npx tsc --noEmit` | Clean |
| `npm run build` | Success |
| `node dist/cli.js store-findings --help` | Shows command |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all data paths are fully wired.

## Self-Check: PASSED

All 3 created/modified files exist on disk. All 3 commit hashes verified in git log.
