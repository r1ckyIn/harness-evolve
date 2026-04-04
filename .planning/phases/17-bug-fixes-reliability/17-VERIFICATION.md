---
phase: 17-bug-fixes-reliability
verified: 2026-04-05T00:45:00Z
status: passed
score: 4/4 must-haves verified
gaps: []
---

# Phase 17: Bug Fixes & Reliability Verification Report

**Phase Goal:** All v2.0 dogfooding bugs are resolved -- slash commands work globally, scanner reports are accurate, apply-one respects user intent, and analysis notifications flow automatically
**Verified:** 2026-04-05T00:45:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can invoke /evolve:scan and /evolve:apply from any directory (commands live in ~/.claude/commands/evolve/) | VERIFIED | `installSlashCommands()` in src/cli/init.ts line 47-48 uses `process.env.HOME` to build path `join(home, '.claude', 'commands', 'evolve')`. No projectDir parameter. Tests confirm writes target HOME path, not project path. |
| 2 | Scanning a project with npm scoped packages (@scope/package) or URL @user/path produces zero false-positive stale reference warnings | VERIFIED | `isNpmScopedPackage()` (line 40) and `isUrlUserPath()` (line 61) in src/scan/context-builder.ts filter these patterns. 9 unit tests in context-builder.test.ts cover edge cases. extractReferences('@scope/package') returns []. |
| 3 | User can apply-one a MEDIUM or LOW confidence recommendation without being rejected by a confidence gate | VERIFIED | src/cli/apply.ts line 90: `const applyOptions = { skipConfidenceGate: true }`. All 4 appliers (settings, rule, hook, claude-md) implement `canApply(rec, options?)` with `options?.skipConfidenceGate \|\| rec.confidence === 'HIGH'`. Tests verify MEDIUM and LOW pass. |
| 4 | After Stop hook analysis with new recommendations, next user prompt automatically shows notification | VERIFIED | src/analysis/trigger.ts lines 135-146: after `runAnalysis()` succeeds, `getStatusMap()` counts pending recs, `writeNotificationFlag(pendingCount)` writes flag. Stop hook calls `checkAndTriggerAnalysis`. UserPromptSubmit hook reads flag via `hasNotificationFlag()` and injects notification. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/cli/init.ts` | Global slash command installation targeting ~/.claude/commands/evolve/ | VERIFIED | Line 47-48: `const home = process.env.HOME ?? ''`; `const commandsDir = join(home, '.claude', 'commands', 'evolve')`. installSlashCommands() has no projectDir param. Stale warning at lines 147-154. |
| `src/scan/context-builder.ts` | Reference extraction with npm/URL false positive filtering | VERIFIED | Contains `isNpmScopedPackage` (line 40) and `isUrlUserPath` (line 61). Both called in extractReferences loop (lines 87-93) with `continue` to skip matches. |
| `src/delivery/appliers/index.ts` | ApplierOptions with skipConfidenceGate, Applier.canApply with optional options param | VERIFIED | Line 19: `skipConfidenceGate?: boolean`. Line 24: `canApply(rec: Recommendation, options?: ApplierOptions): boolean`. |
| `src/delivery/appliers/settings-applier.ts` | canApply respects skipConfidenceGate | VERIFIED | Line 17: `options?.skipConfidenceGate \|\| rec.confidence === 'HIGH'` |
| `src/delivery/appliers/rule-applier.ts` | canApply respects skipConfidenceGate | VERIFIED | Line 16: `options?.skipConfidenceGate \|\| rec.confidence === 'HIGH'` |
| `src/delivery/appliers/hook-applier.ts` | canApply respects skipConfidenceGate | VERIFIED | Line 23: `options?.skipConfidenceGate \|\| rec.confidence === 'HIGH'` |
| `src/delivery/appliers/claude-md-applier.ts` | canApply respects skipConfidenceGate | VERIFIED | Line 25: `options?.skipConfidenceGate \|\| rec.confidence === 'HIGH'` |
| `src/cli/apply.ts` | apply-one passes skipConfidenceGate:true | VERIFIED | Line 90: `const applyOptions = { skipConfidenceGate: true }`. Line 91: `applier.canApply(rec, applyOptions)`. Line 101: `applier.apply(rec, applyOptions)`. |
| `src/analysis/trigger.ts` | checkAndTriggerAnalysis writes notification flag after analysis | VERIFIED | Lines 136-146: imports writeNotificationFlag and getStatusMap, counts pending recs, writes flag. Silent try/catch around notification block. |
| `tests/unit/cli/init.test.ts` | Tests proving global path and stale project-level warning | VERIFIED | 8 tests in "CLI init slash commands" describe block covering global HOME path, stale warning, no-stale check, directory creation. |
| `tests/unit/scan/context-builder.test.ts` | Tests proving @scope/package and URL @user/path are filtered | VERIFIED | 9 tests in "extractReferences filtering" describe block. Covers npm scoped packages, URL paths, JSON context, mixed content, preservation of real file references. |
| `tests/unit/cli/apply.test.ts` | Tests proving MEDIUM/LOW recs are applied via apply-one | VERIFIED | Two explicit tests: "apply-one applies MEDIUM confidence recommendation successfully" and "apply-one applies LOW confidence recommendation successfully". Both verify skipConfidenceGate: true is passed. |
| `tests/unit/delivery/auto-apply.test.ts` | Regression test proving auto-apply still gates on HIGH | VERIFIED | Test: "autoApplyRecommendations skips MEDIUM confidence recommendations (regression)" at line 324. Also: "skips MEDIUM and LOW confidence recommendations even when fullAuto=true" at line 160. |
| `tests/unit/analysis/trigger.test.ts` | Test proving notification flag is written after analysis | VERIFIED | 4 tests: "writes notification flag when analysis has pending recommendations", "does not write notification flag when all recommendations are applied", "does not write notification flag when analysis returns zero recommendations", "returns true even when notification flag write fails". |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| src/cli/init.ts | ~/.claude/commands/evolve/ | `join(home, '.claude', 'commands', 'evolve')` | WIRED | Line 48: explicit path construction using process.env.HOME |
| src/scan/context-builder.ts | extractReferences callers | filtered references array | WIRED | isNpmScopedPackage and isUrlUserPath called at lines 87-93 in the extractReferences loop |
| src/cli/apply.ts | src/delivery/appliers/index.ts | `applier.canApply(rec, { skipConfidenceGate: true })` | WIRED | Line 91: canApply called with applyOptions; Line 101: apply called with applyOptions |
| src/delivery/auto-apply.ts | src/delivery/appliers/index.ts | `applier.canApply(rec)` with no skipConfidenceGate | WIRED | Line 70: `!applier.canApply(rec)` -- no options, defaults to falsy skipConfidenceGate. Safety preserved. |
| src/analysis/trigger.ts | src/delivery/notification.ts | `writeNotificationFlag(pendingCount)` after runAnalysis | WIRED | Line 16: import writeNotificationFlag. Line 142: called with pendingCount. |
| src/hooks/stop.ts | src/analysis/trigger.ts | `checkAndTriggerAnalysis(input.cwd)` | WIRED | Line 6: import. Line 22: call with cwd. |
| src/hooks/user-prompt-submit.ts | src/delivery/notification.ts | `hasNotificationFlag()` + `readNotificationFlagCount()` | WIRED | Lines 11-14: imports. Lines 41-42: reads flag and count for stdout injection. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| src/analysis/trigger.ts | result.recommendations | runAnalysis -> analyze() | Yes -- analyze() processes real preProcess summary + environment snapshot | FLOWING |
| src/analysis/trigger.ts | pendingCount | getStatusMap() + filter on result.recommendations | Yes -- getStatusMap reads real state file, filters against analysis results | FLOWING |
| src/hooks/user-prompt-submit.ts | pendingCount | readNotificationFlagCount() | Yes -- reads flag file written by trigger.ts after analysis | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npx vitest run` | 632 tests passing across 58 files | PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit` | Zero errors, zero output | PASS |
| Commits exist in git history | `git log --oneline` | All 6 commits present: 022be8c, eb8b84c, 5989c5a, bb2d6a1, 5de91c9, b67ee69 + c01ac5b merge | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FIX-01 | 17-01-PLAN.md | Slash commands install to global ~/.claude/commands/evolve/ | SATISFIED | installSlashCommands() uses process.env.HOME. Tests verify HOME-based paths. Stale project-level warning implemented. |
| FIX-02 | 17-01-PLAN.md | Scanner filters npm scoped packages and URL user paths | SATISFIED | isNpmScopedPackage() and isUrlUserPath() helpers in extractReferences. 9 test cases cover edge cases. |
| FIX-03 | 17-02-PLAN.md | apply-one skips confidence gate for MEDIUM/LOW recommendations | SATISFIED | skipConfidenceGate: true passed in apply-one. All 4 appliers respect the flag. Auto-apply unchanged (safety preserved). |
| FIX-04 | 17-02-PLAN.md | Stop hook analysis writes notification flag for next UserPromptSubmit | SATISFIED | checkAndTriggerAnalysis writes notification flag after analysis. Silent try/catch ensures non-blocking. Full data flow: Stop -> trigger -> notification -> UserPromptSubmit. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TODO/FIXME/PLACEHOLDER/HACK patterns found in any modified file |

### Human Verification Required

### 1. Global Slash Command Accessibility

**Test:** Launch Claude Code in a new, unrelated directory. Type `/evolve:scan` and `/evolve:apply`.
**Expected:** Both commands are available and executable without running `harness-evolve init` in that directory.
**Why human:** Requires actual Claude Code runtime to verify slash command resolution from ~/.claude/commands/evolve/.

### 2. Notification After Background Analysis

**Test:** Use Claude Code long enough to trigger the Stop hook analysis threshold. After Stop completes, type a new prompt.
**Expected:** A notification line appears automatically indicating pending recommendations.
**Why human:** Requires real session interaction to trigger the Stop hook -> analysis -> notification -> UserPromptSubmit flow end-to-end.

### Gaps Summary

No gaps found. All 4 observable truths are verified against the actual codebase. All 14 artifacts pass Level 1 (exists), Level 2 (substantive -- no stubs), and Level 3 (wired -- imported and used). Data-flow traces confirm real data flows through the notification pipeline. All 4 requirements (FIX-01 through FIX-04) are satisfied. 632 tests pass, TypeScript compiles cleanly, and zero anti-patterns detected.

---

_Verified: 2026-04-05T00:45:00Z_
_Verifier: Claude (gsd-verifier)_
