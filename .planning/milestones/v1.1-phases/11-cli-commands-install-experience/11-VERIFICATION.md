---
phase: 11-cli-commands-install-experience
verified: 2026-04-04T01:37:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 11: CLI Commands & Install Experience Verification Report

**Phase Goal:** Users can install and set up harness-evolve with a single command, manage it through CLI subcommands, and remove it cleanly
**Verified:** 2026-04-04T01:37:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npx harness-evolve init` downloads the package, displays planned hook registrations, and writes them to settings.json after user confirmation (or with `--yes`) | VERIFIED | `src/cli/init.ts` runInit() displays planned registrations (lines 61-67), detects npx paths (line 71), prompts for confirmation unless `--yes` (lines 81-87), writes via mergeHooks + writeSettings (lines 100-106). Integration test `cli-init.test.ts` proves all 6 hooks written with `--yes`. |
| 2 | Hook command paths in settings.json resolve correctly regardless of install method (global `npm i -g`, local `npx`, git clone) | VERIFIED | `src/cli/utils.ts` resolveHookPath() uses `import.meta.dirname` (line 85) to compute absolute paths from the actual install location. Goes up from `dist/cli/` to `dist/` then into `hooks/`. Unit tests confirm path resolution with `baseDirOverride` for both `/opt/harness-evolve/dist/cli` and `/home/user/.npm/lib/harness-evolve/dist/cli`. npx ephemeral path detection at `init.ts:71`. |
| 3 | `harness-evolve status` displays interaction count, last analysis timestamp, pending recommendations count, and hook registration status | VERIFIED | `src/cli/status.ts` runStatus() reads counter via `readCounter()` (line 28), recommendation state via `loadState()` (line 31), computes pending count (lines 34-36), checks hook registration via `readSettings` + HARNESS_EVOLVE_MARKER (lines 39-42). Output format confirmed at lines 46-52 with all 4 fields. 9 unit tests cover all display scenarios including graceful handling of missing files. |
| 4 | `harness-evolve uninstall` removes all hook entries from settings.json and optionally deletes the ~/.harness-evolve/ data directory | VERIFIED | `src/cli/uninstall.ts` runUninstall() filters hooks by HARNESS_EVOLVE_MARKER (lines 50-59), removes empty event keys (lines 62-65), creates backup before write (line 70), supports `--purge` with confirmation (lines 83-101). 9 unit tests + 2 integration tests prove selective removal, user hook preservation, and purge behavior. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/cli/utils.ts` | Shared CLI utilities: hook definitions, settings I/O, path resolution, confirm prompt | VERIFIED | 199 lines, exports HOOK_REGISTRATIONS (6 entries), SETTINGS_PATH, HARNESS_EVOLVE_MARKER, resolveHookPath, readSettings, writeSettings, mergeHooks, confirm |
| `src/cli/init.ts` | Init command implementation | VERIFIED | 124 lines, exports registerInitCommand, runInit with --yes flag, npx detection, backup, merge |
| `src/cli.ts` | Commander.js program with all subcommands | VERIFIED | 27 lines, imports and registers all 3 commands (init, status, uninstall), no placeholder stubs |
| `src/cli/status.ts` | Status command implementation | VERIFIED | 65 lines, exports registerStatusCommand, runStatus with interaction count, last analysis, pending recs, hook registration |
| `src/cli/uninstall.ts` | Uninstall command implementation | VERIFIED | 119 lines, exports registerUninstallCommand, runUninstall with --purge, --yes, selective hook removal, backup |
| `tests/unit/cli/init.test.ts` | Unit tests for init command | VERIFIED | 486 lines, 20 test cases covering utils and init command |
| `tests/unit/cli/status.test.ts` | Unit tests for status command | VERIFIED | 253 lines, 9 test cases covering all status display scenarios |
| `tests/unit/cli/uninstall.test.ts` | Unit tests for uninstall command | VERIFIED | 309 lines, 9 test cases covering removal, preservation, purge, backup |
| `tests/integration/cli-init.test.ts` | Integration test for init -> uninstall lifecycle | VERIFIED | 228 lines, 6 test cases with real file I/O proving full CLI lifecycle |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/cli/init.ts` | `src/cli/utils.ts` | `import { HOOK_REGISTRATIONS, resolveHookPath, readSettings, writeSettings, mergeHooks, confirm } from './utils.js'` | WIRED | Multi-line import at lines 6-14, all 7 exports used |
| `src/cli.ts` | `src/cli/init.ts` | `registerInitCommand(program)` | WIRED | Import at line 7, call at line 23 |
| `src/cli/utils.ts` | settings.json | `readSettings/writeSettings with write-file-atomic` | WIRED | writeFileAtomic imported at line 6, used at line 114 |
| `src/cli/status.ts` | `src/storage/counter.ts` | `import { readCounter }` | WIRED | Import at line 4, called at line 28 |
| `src/cli/status.ts` | `src/delivery/state.ts` | `import { loadState }` | WIRED | Import at line 5, called at line 31 |
| `src/cli/uninstall.ts` | `src/cli/utils.ts` | `import { readSettings, writeSettings, HARNESS_EVOLVE_MARKER, confirm, SETTINGS_PATH }` | WIRED | Multi-line import at lines 6-12, all exports used in runUninstall |
| `src/cli.ts` | `src/cli/status.ts` | `registerStatusCommand(program)` | WIRED | Import at line 8, call at line 24 |
| `src/cli.ts` | `src/cli/uninstall.ts` | `registerUninstallCommand(program)` | WIRED | Import at line 9, call at line 25 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `src/cli/status.ts` | `counter` | `readCounter()` from `src/storage/counter.ts` | Yes -- reads counter.json from ~/.harness-evolve/ | FLOWING |
| `src/cli/status.ts` | `state` | `loadState()` from `src/delivery/state.ts` | Yes -- reads recommendation-state.json from ~/.harness-evolve/ | FLOWING |
| `src/cli/status.ts` | `settings` | `readSettings()` from `src/cli/utils.ts` | Yes -- reads ~/.claude/settings.json | FLOWING |
| `src/cli/init.ts` | `hookCommands` | `HOOK_REGISTRATIONS.map(resolveHookPath)` | Yes -- resolves real filesystem paths via import.meta.dirname | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CLI version output | `node dist/cli.js --version` | `1.0.0` | PASS |
| CLI help lists all 3 commands | `node dist/cli.js --help` | Shows init, status, uninstall | PASS |
| Init help shows --yes | `node dist/cli.js init --help` | Shows `--yes Skip confirmation prompt` | PASS |
| Status help shows description | `node dist/cli.js status --help` | Shows `Show harness-evolve status and statistics` | PASS |
| Uninstall help shows --purge and --yes | `node dist/cli.js uninstall --help` | Shows `--purge` and `--yes` options | PASS |
| Build succeeds | `npm run build` | Exit 0, produces dist/cli.js (12,707 bytes) | PASS |
| Typecheck passes | `npm run typecheck` (tsc --noEmit) | Exit 0, no errors | PASS |
| CLI unit tests pass | `npx vitest run tests/unit/cli/` | 35 tests passed | PASS |
| Integration tests pass | `npx vitest run tests/integration/cli-init.test.ts` | 6 tests passed (+ 3 test files) | PASS |
| All 44 CLI tests pass | `npx vitest run tests/unit/cli/ tests/integration/cli-init.test.ts` | 44 passed in 553ms | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CLI-01 | 11-01 | `harness-evolve init` detects settings.json location, displays planned hook registrations, and applies after user confirmation (or `--yes` flag) | SATISFIED | `src/cli/init.ts` runInit() displays registrations, prompts for confirmation, writes via mergeHooks. 6 unit tests + 4 integration tests. |
| CLI-02 | 11-01 | `harness-evolve init` resolves hook command paths dynamically based on actual install location (works for both global install and npx) | SATISFIED | `src/cli/utils.ts` resolveHookPath() with import.meta.dirname, npx detection at init.ts:71. 2 unit tests for path resolution. |
| CLI-03 | 11-02 | `harness-evolve status` shows interaction count, last analysis timestamp, pending recommendations count, and hook registration status | SATISFIED | `src/cli/status.ts` reads counter, state, settings and displays all 4 fields. 9 unit tests. |
| CLI-04 | 11-02 | `harness-evolve uninstall` removes hook entries from settings.json and optionally deletes ~/.harness-evolve/ data directory | SATISFIED | `src/cli/uninstall.ts` filters by HARNESS_EVOLVE_MARKER, supports --purge with confirmation. 9 unit tests + 2 integration tests. |
| CLI-05 | 11-01, 11-02 | `npx harness-evolve init` works as zero-install setup (download, run init, register hooks, exit) | SATISFIED | bin field in package.json points to dist/cli.js, Commander.js parses args, init command works. npx ephemeral path warning at init.ts:71. Integration test proves full lifecycle. |

No orphaned requirements found -- all 5 CLI requirements (CLI-01 through CLI-05) are claimed by plans and verified.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/cli/utils.ts` | 102 | `return {}` in catch block | Info | Intentional fail-safe: readSettings returns empty object when file missing or JSON invalid. Not a stub. |

No blockers, no warnings. No TODO/FIXME/PLACEHOLDER comments in any CLI source files.

### Human Verification Required

### 1. Interactive Init Confirmation Flow

**Test:** Run `npx harness-evolve init` (without `--yes`) in a fresh environment
**Expected:** Displays 6 planned hook registrations, prompts "[y/N]", waits for user input. "y" writes hooks, "n" aborts.
**Why human:** Interactive readline prompt requires real terminal input

### 2. npx Ephemeral Path Warning

**Test:** Run `npx harness-evolve init` via npx (not global install)
**Expected:** Shows warning about `.npm/_npx/` ephemeral paths and recommends `npm i -g`
**Why human:** Requires actual npx execution environment to trigger the path detection

### 3. Status Display with Real Data

**Test:** After init + some Claude Code usage, run `harness-evolve status`
**Expected:** Shows non-zero interaction count, actual timestamp, real pending recommendations count, "Hooks registered: Yes"
**Why human:** Requires real ~/.harness-evolve/ data from actual Claude Code sessions

### Gaps Summary

No gaps found. All 4 success criteria are verified through source code inspection, automated tests (44 passing), and behavioral spot-checks (10 passing). The CLI framework is fully wired with Commander.js, all 3 commands (init, status, uninstall) are implemented with real logic, and the integration test proves the full init -> uninstall lifecycle with real file I/O.

---

_Verified: 2026-04-04T01:37:00Z_
_Verifier: Claude (gsd-verifier)_
