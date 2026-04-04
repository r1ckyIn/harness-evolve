---
status: passed
phase: 15-slash-commands-interactive-apply
verified_at: "2026-04-04T10:20:00.000Z"
requirements: [CMD-01, CMD-02, CMD-03, SCN-04]
must_haves_verified: 4
must_haves_total: 4
gaps: []
human_verification: []
---

# Phase 15 Verification: Slash Commands & Interactive Apply

## Goal
Users can interact with harness-evolve through Claude Code slash commands for scanning, reviewing, and applying recommendations.

## Success Criteria Verification

| # | Criteria | Status | Evidence |
|---|---------|--------|----------|
| 1 | `harness-evolve init` installs `/evolve:scan` and `/evolve:apply` slash command files into `.claude/commands/` | VERIFIED | `src/cli/init.ts` contains `installSlashCommands()` which calls `generateScanCommand()` and `generateApplyCommand()` from `src/commands/evolve-scan.ts` and `src/commands/evolve-apply.ts`. Creates `.claude/commands/evolve/scan.md` and `apply.md` with create-only guard (skips if exists). |
| 2 | `/evolve:scan` triggers a deep config scan at any time, outputting structured recommendations | VERIFIED | `src/cli/scan.ts` registers `scan` subcommand that calls `runDeepScan(process.cwd())` and outputs JSON with `generated_at`, `recommendation_count`, and `recommendations` array. Error handling outputs JSON with `error` field. |
| 3 | `/evolve:apply` presents pending recommendations one-by-one, allowing apply/skip/ignore | VERIFIED | `src/cli/apply.ts` implements three subcommands: `pending` (lists filtered recommendations), `apply-one <id>` (applies single recommendation via applier registry), `dismiss <id>` (permanently ignores). All output structured JSON. `/evolve:apply` template in `src/commands/evolve-apply.ts` instructs Claude to use these subcommands interactively. |
| 4 | `harness-evolve uninstall` removes installed slash command files | VERIFIED | `src/cli/uninstall.ts` contains `removeSlashCommands()` which removes `scan.md` and `apply.md`, then `rmdir` on empty `evolve/` directory. Graceful error handling for missing files. |

## Requirements Traceability

| Requirement | Description | Status | Plan |
|-------------|-------------|--------|------|
| CMD-01 | init installs slash commands | VERIFIED | 15-01 |
| CMD-02 | /evolve:apply interactive workflow | VERIFIED | 15-02 |
| CMD-03 | uninstall cleans slash commands | VERIFIED | 15-01 |
| SCN-04 | on-demand scan trigger via /evolve:scan | VERIFIED | 15-02 |

## Automated Checks

- **Test suite:** 603/603 tests passing (58 test files)
- **TypeScript:** `tsc --noEmit` clean
- **CLI registration:** 7 subcommands registered in `src/cli.ts` (init, status, uninstall, scan, pending, apply-one, dismiss)

## Key Artifacts

### Plan 15-01 (Templates & Init/Uninstall Wiring)
- `src/commands/evolve-scan.ts` — generateScanCommand() template generator
- `src/commands/evolve-apply.ts` — generateApplyCommand() template generator
- `src/cli/init.ts` — extended with installSlashCommands + projectDir
- `src/cli/uninstall.ts` — extended with removeSlashCommands + projectDir
- `tests/unit/commands/templates.test.ts` — 18 template tests
- `tests/unit/cli/init.test.ts` — 3 new slash command tests
- `tests/unit/cli/uninstall.test.ts` — 3 new slash command tests

### Plan 15-02 (CLI Subcommands)
- `src/cli/scan.ts` — scan subcommand (registerScanCommand)
- `src/cli/apply.ts` — pending, apply-one, dismiss subcommands
- `src/cli.ts` — all 7 subcommands registered
- `src/index.ts` — new exports for programmatic use
- `tests/unit/cli/scan.test.ts` — scan command tests
- `tests/unit/cli/apply.test.ts` — pending, apply-one, dismiss tests

## Note

Initial verifier ran in stale worktree (agent-a0fe581a) which only contained Plan 02 artifacts. Manual verification of merged main branch confirmed all 4 criteria pass. Worktree verifier gaps were false positives.
