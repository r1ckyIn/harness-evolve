---
phase: 11-cli-commands-install-experience
plan: 01
subsystem: cli
tags: [commander, cli, hooks, settings-json, init-command]

requires:
  - phase: 10-npm-package-ci-cd-pipeline
    provides: "CLI stub entry point (src/cli.ts), tsup cli build entry, bin field in package.json"
provides:
  - "Commander.js CLI framework wired as harness-evolve binary"
  - "CLI shared utilities: HOOK_REGISTRATIONS, resolveHookPath, readSettings, writeSettings, mergeHooks, confirm"
  - "harness-evolve init command with --yes flag for hook registration"
  - "Settings.json merge logic preserving existing user hooks"
affects: [11-02-status-uninstall-commands, future-install-docs]

tech-stack:
  added: [commander@^14.0.3, "@commander-js/extra-typings@^14.0.0"]
  patterns: [commander-subcommand-registration, import-meta-dirname-path-resolution, atomic-settings-write-with-backup]

key-files:
  created:
    - src/cli/utils.ts
    - src/cli/init.ts
    - tests/unit/cli/init.test.ts
  modified:
    - src/cli.ts
    - package.json
    - package-lock.json

key-decisions:
  - "Use import.meta.dirname (not __dirname/fileURLToPath) for ESM path resolution in Node 22+"
  - "Hook path resolution goes up one level from dist/cli/ to dist/, then into hooks/ for all install methods"
  - "mergeHooks uses HARNESS_EVOLVE_MARKER string detection to skip duplicate registrations"
  - "readSettings returns {} for both ENOENT and invalid JSON (fail-safe defaults)"
  - "Status and uninstall are placeholder stubs in cli.ts awaiting Plan 11-02"

patterns-established:
  - "Commander subcommand registration pattern: registerXxxCommand(program) exported from src/cli/xxx.ts"
  - "CLI test pattern: mock write-file-atomic, node:fs/promises, and node:readline/promises with vi.mock"
  - "Settings merge: append-only for hook arrays, identified by HARNESS_EVOLVE_MARKER in command string"

requirements-completed: [CLI-01, CLI-02, CLI-05]

duration: 5min
completed: 2026-04-03
---

# Phase 11 Plan 01: CLI Init Command Summary

**Commander.js CLI framework with init command for hook registration in settings.json, supporting global/npx/git-clone install paths via import.meta.dirname resolution**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-03T14:17:52Z
- **Completed:** 2026-04-03T14:23:01Z
- **Tasks:** 2 (Task 1 TDD with RED/GREEN)
- **Files modified:** 6

## Accomplishments
- Installed Commander.js (v14) and @commander-js/extra-typings as production dependencies
- Created CLI shared utilities module (src/cli/utils.ts) with 8 exports: HOOK_REGISTRATIONS, SETTINGS_PATH, HARNESS_EVOLVE_MARKER, resolveHookPath, readSettings, writeSettings, mergeHooks, confirm
- Implemented `harness-evolve init` command with --yes flag, npx detection warning, backup creation, and merge-not-replace settings logic
- Rewired cli.ts from stub to full Commander.js program with version/help/init/status/uninstall subcommands
- 20 new unit tests, all 417 tests passing, build and typecheck clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Commander.js and create CLI shared utilities + init command** (TDD)
   - `1573be5` (test) - Failing tests for CLI init command and utilities (RED)
   - `df39f4e` (feat) - CLI shared utilities and init command implementation (GREEN)
2. **Task 2: Rewire cli.ts with Commander.js and register init command** - `f493be3` (feat)

## Files Created/Modified
- `src/cli/utils.ts` - Shared CLI utilities: hook definitions (6 events), settings I/O, path resolution, confirm prompt
- `src/cli/init.ts` - Init command: hook registration with confirmation, backup, merge, npx warning
- `src/cli.ts` - Commander.js program with init, status (stub), uninstall (stub) subcommands
- `tests/unit/cli/init.test.ts` - 20 unit tests covering utils and init command
- `package.json` - Added commander and @commander-js/extra-typings dependencies
- `package-lock.json` - Updated lockfile

## Decisions Made
- Used `import.meta.dirname` (Node 22+ ESM feature) instead of `__dirname` or `fileURLToPath(import.meta.url)` -- cleaner and the project targets Node >=22.14.0
- Hook path resolution strategy: `dirname(import.meta.dirname)` goes from `dist/cli/` up to `dist/`, then joins `hooks/<file>`. Works for global installs, npx, and git clone alike.
- `mergeHooks` identifies existing harness-evolve entries by searching for the `HARNESS_EVOLVE_MARKER` string in hook command strings, preventing double-registration on repeated `init` runs
- `readSettings` silently returns `{}` for both missing files and invalid JSON to avoid crashing on corrupted settings
- Placeholder status and uninstall commands in cli.ts output "coming in Plan 11-02" -- these will be fully implemented in the next plan

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| src/cli.ts | 28 | Status command placeholder | Intentional -- implemented in Plan 11-02 |
| src/cli.ts | 36 | Uninstall command placeholder | Intentional -- implemented in Plan 11-02 |

These stubs do not prevent this plan's goal (init command) from being achieved. They are scaffolding for the next plan.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Commander.js framework fully wired and extensible for Plan 11-02 (status + uninstall commands)
- The `registerXxxCommand(program)` pattern established for adding new subcommands
- CLI shared utilities (readSettings, writeSettings, mergeHooks) reusable by status and uninstall commands
- All 6 hook registrations defined in HOOK_REGISTRATIONS constant, ready for real-world init

## Self-Check: PASSED

- All created files verified: src/cli/utils.ts, src/cli/init.ts, src/cli.ts, tests/unit/cli/init.test.ts
- All commits verified: 1573be5, df39f4e, f493be3
- 20 new tests passing, 417 total tests passing
- Build succeeds, typecheck clean
- CLI --version, --help, init --help all produce correct output

---
*Phase: 11-cli-commands-install-experience*
*Completed: 2026-04-03*
