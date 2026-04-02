---
phase: 02-collection-hooks
verified: 2026-03-31T23:45:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
---

# Phase 02: Collection Hooks Verification Report

**Phase Goal:** Every user interaction with Claude Code generates a structured log entry automatically
**Verified:** 2026-03-31T23:45:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

Truths aggregated from all three plan must_haves (Plan 01: schemas/shared, Plan 02: hook handlers, Plan 03: build/integration).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 5 hook event input schemas validate correctly against Claude Code hook stdin JSON | VERIFIED | `src/schemas/hook-input.ts` contains hookCommonSchema + 5 event schemas with z.literal() discrimination, Zod v4 z.record(z.string(), z.unknown()), 15 schema tests pass |
| 2 | readStdin() reliably buffers all stdin data and summarizeToolInput() produces concise summaries under 200 chars | VERIFIED | `src/hooks/shared.ts` exports readStdin, readFromStream, summarizeToolInput with MAX_LEN=200 and switch dispatch for Bash/Write/Edit/Read/Glob/Grep, 16 tests pass |
| 3 | UserPromptSubmit captures prompt with timestamp, session_id, cwd, prompt_length, transcript_path | VERIFIED | `src/hooks/user-prompt-submit.ts` line 23-30 calls appendLogEntry('prompts', {...}) with all fields including transcript_path, 6 unit tests + integration test CAP-01/CAP-04 pass |
| 4 | PreToolUse writes marker file, PostToolUse reads marker/calculates duration_ms/cleans up, PostToolUseFailure logs failure with success=false | VERIFIED | Pre: writeFile marker at paths.pending, Post: readFile marker + duration_ms + unlink, Failure: unlink + success:false, integration test proves duration_ms >= 10ms |
| 5 | PermissionRequest logs permission entry with tool_name and decision='unknown' | VERIFIED | `src/hooks/permission-request.ts` line 27 decision='unknown', integration test confirms |
| 6 | All hooks exit(0) on any error and never block Claude Code | VERIFIED | All 5 hook files contain process.exit(0), grep for process.exit(2) returns zero matches, try/catch wraps all logic |
| 7 | All hooks respect config flags (capturePrompts, captureTools, capturePermissions) | VERIFIED | Each handler checks config.hooks.captureX early-return pattern, unit tests verify config=false behavior |
| 8 | tsup builds all 5 hook entry points to dist/hooks/ as standalone JS files | VERIFIED | tsup.config.ts has 6 entries, `npx tsup` produces dist/hooks/{user-prompt-submit,pre-tool-use,post-tool-use,post-tool-use-failure,permission-request}.js |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/schemas/hook-input.ts` | Zod schemas for all 5 hook events | VERIFIED | 57 lines, 6 schemas (hookCommon + 5 events), all z.literal discriminated |
| `src/hooks/shared.ts` | stdin reader + tool input summarizer | VERIFIED | 62 lines, readStdin/readFromStream/summarizeToolInput exports |
| `src/storage/dirs.ts` | Updated paths with pending directory | VERIFIED | pending: join(BASE_DIR, 'pending') at line 15, ensureInit mkdir at line 29 |
| `src/hooks/user-prompt-submit.ts` | UserPromptSubmit handler | VERIFIED | 49 lines, appendLogEntry('prompts'), transcript_path, incrementCounter |
| `src/hooks/pre-tool-use.ts` | PreToolUse handler with marker write | VERIFIED | 58 lines, writeFile marker, appendLogEntry('tools'), event:'pre' |
| `src/hooks/post-tool-use.ts` | PostToolUse handler with duration | VERIFIED | 64 lines, readFile marker, duration_ms calc, unlink, event:'post', success:true |
| `src/hooks/post-tool-use-failure.ts` | PostToolUseFailure handler | VERIFIED | 60 lines, unlink marker, event:'failure', success:false |
| `src/hooks/permission-request.ts` | PermissionRequest handler | VERIFIED | 47 lines, appendLogEntry('permissions'), decision:'unknown' |
| `src/schemas/log-entry.ts` | Extended with transcript_path | VERIFIED | Line 9: transcript_path: z.string().optional() |
| `src/index.ts` | Exports all new schemas + utilities | VERIFIED | Lines 22-39: all 6 schemas, 6 types, readStdin/readFromStream/summarizeToolInput |
| `tsup.config.ts` | Multi-entry build config | VERIFIED | 6 entry points (index + 5 hooks) |
| `tests/unit/hooks/shared.test.ts` | Schema + shared utility tests | VERIFIED | 288 lines |
| `tests/unit/hooks/user-prompt-submit.test.ts` | Handler tests | VERIFIED | 131 lines |
| `tests/unit/hooks/pre-tool-use.test.ts` | Handler tests | VERIFIED | 158 lines |
| `tests/unit/hooks/post-tool-use.test.ts` | Handler tests (Post + Failure) | VERIFIED | 248 lines |
| `tests/unit/hooks/permission-request.test.ts` | Handler tests | VERIFIED | 116 lines |
| `tests/integration/hook-pipeline.test.ts` | End-to-end pipeline test | VERIFIED | 267 lines, 5 test cases |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/schemas/hook-input.ts` | `zod/v4` | `import { z } from 'zod/v4'` | WIRED | Line 1: import statement confirmed |
| `src/hooks/shared.ts` | `process.stdin` | `readFromStream(process.stdin)` | WIRED | Line 33: readStdin delegates to readFromStream with process.stdin |
| `src/hooks/user-prompt-submit.ts` | `src/storage/logger.ts` | `appendLogEntry('prompts', {...})` | WIRED | Line 23: appendLogEntry('prompts') confirmed |
| `src/hooks/pre-tool-use.ts` | `src/storage/dirs.ts` | `paths.pending` for marker | WIRED | Line 30: `join(paths.pending, ...)` confirmed |
| `src/hooks/post-tool-use.ts` | `src/hooks/pre-tool-use.ts` | marker file correlation by tool_use_id | WIRED | Line 27: same marker path pattern with tool_use_id |
| `src/hooks/permission-request.ts` | `src/storage/logger.ts` | `appendLogEntry('permissions', {...})` | WIRED | Line 23: appendLogEntry('permissions') confirmed |
| `tsup.config.ts` | `src/hooks/*.ts` | entry points config | WIRED | Lines 6-10: all 5 hook paths listed |
| `dist/hooks/*.js` | `src/hooks/*.ts` | tsup compilation | WIRED | All 5 dist/hooks/*.js files exist after build |

### Data-Flow Trace (Level 4)

Not applicable for this phase. Hook handlers are CLI scripts that capture stdin JSON and write to JSONL files -- they do not render dynamic data. The data flow was verified via integration tests with real file I/O instead.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `npx vitest run` | 11 test files, 130 tests passed | PASS |
| TypeScript compiles cleanly | `npx tsc --noEmit` | No errors | PASS |
| tsup builds all entry points | `npx tsup` | 6 JS + 6 DTS + 6 maps produced | PASS |
| dist/hooks/ contains 5 bundles | `ls dist/hooks/*.js` | 5 files present | PASS |
| No blocking exits in hooks | `grep -r 'process.exit(2)' src/hooks/` | 0 matches | PASS |
| All hooks write to correct log types | `grep -r 'appendLogEntry' src/hooks/` | 5 calls: prompts(1), tools(3), permissions(1) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CAP-01 | 02-02 | Capture user prompts with timestamp, session_id, cwd, prompt text | SATISFIED | user-prompt-submit.ts captures all fields, integration test verifies 3 prompts with correct fields |
| CAP-02 | 02-02 | Capture permission patterns with tool_name and decision | SATISFIED | permission-request.ts logs tool_name + decision='unknown', integration test verifies |
| CAP-03 | 02-01, 02-02 | Capture tool usage with tool_name, input summary, duration | SATISFIED | PreToolUse/PostToolUse with marker correlation, duration_ms >= 10ms verified in integration test, PostToolUseFailure captures failures |
| CAP-04 | 02-01, 02-02 | Access transcripts via transcript_path for context enrichment | SATISFIED | transcript_path stored in prompt log entries (user-prompt-submit.ts line 29), promptEntrySchema extended with transcript_path field |

No orphaned requirements. REQUIREMENTS.md maps exactly CAP-01 through CAP-04 to Phase 2, matching the plan frontmatter declarations.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | - |

No anti-patterns detected. All hook files are clean: no TODO/FIXME/PLACEHOLDER, no process.exit(2), no empty implementations, no console.log-only handlers, no hardcoded empty returns.

### Human Verification Required

### 1. Live Claude Code Hook Invocation

**Test:** Register hooks in settings.json, submit prompts, use tools, approve permissions in a real Claude Code session.
**Expected:** ~/.harness-evolve/logs/ directories contain JSONL entries with correct fields, counter.json increments.
**Why human:** Integration test uses handler functions directly; live test verifies the full stdio pipeline through Claude Code's hook runtime (stdin piping, process spawning, exit code handling).

### 2. Hook Performance Budget

**Test:** Measure actual latency of each hook during real Claude Code usage.
**Expected:** UserPromptSubmit < 100ms, Pre/PostToolUse < 30ms, PermissionRequest < 30ms.
**Why human:** Performance timing requires real filesystem I/O and process startup latency that varies by machine. Unit tests mock I/O and cannot measure real latency.

### Gaps Summary

No gaps found. All 8 observable truths verified. All 17 artifacts exist, are substantive, and are wired. All 8 key links confirmed. All 4 requirements (CAP-01 through CAP-04) satisfied with implementation evidence. All 130 tests pass, TypeScript compiles cleanly, tsup produces all 6 entry points. No anti-patterns detected in any Phase 2 file.

---

_Verified: 2026-03-31T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
