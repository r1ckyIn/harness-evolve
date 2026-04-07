# Phase 21: Foundation & Context Infrastructure - Research

**Researched:** 2026-04-07
**Domain:** Claude Code hooks parsing, CLI command design, Zod schema validation, first-time user onboarding
**Confidence:** HIGH

## Summary

Phase 21 addresses four infrastructure requirements (INFRA-01 through INFRA-04) that form the foundation for v4.0's model-driven scanner architecture. The primary deliverables are: (1) fixing the nested hooks parsing bug in `extractHooksFromAllSettings`, (2) adding `scan-context` and `store-findings` CLI subcommands, and (3) ensuring first-time users can invoke `/evolve:scan` without a manual init step.

The codebase is well-structured with clean separation between context-building (`src/scan/`), CLI registration (`src/cli/`), and schemas (`src/schemas/`). All 654 tests pass. The existing `buildScanContext()` function and `recommendationSchema` are the primary integration points. No new dependencies are needed -- all four requirements can be implemented using the existing stack (Commander.js 14, Zod 4, write-file-atomic 7, native Node.js fs).

**Primary recommendation:** Fix the hooks parser first (INFRA-01), then build the two CLI commands (INFRA-02, INFRA-03), then address onboarding (INFRA-04). The dependency chain is linear: scan-context depends on correct parsing, store-findings depends on the recommendation schema, and onboarding ties everything together.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | context-builder correctly parses nested hooks format `{matcher, hooks: [{type, command}]}`, zero false positives on real configs | Bug root cause identified in `extractHooksFromAllSettings` (context-builder.ts:266-298). Fix requires detecting `hooks` sub-array and extracting inner hook objects. Both flat and nested formats must be supported. User's real settings.json verified as test fixture source. |
| INFRA-02 | `harness-evolve scan-context` CLI outputs complete JSON with CLAUDE.md, rules, settings, hooks, commands | Thin wrapper around existing `buildScanContext()`. Register via `registerScanContextCommand()` in cli.ts. Output validated by `scanContextSchema`. Existing `scan` command provides the pattern. |
| INFRA-03 | `harness-evolve store-findings` accepts JSON findings from stdin, validates against Recommendation schema, persists to apply pipeline | Reads stdin JSON, validates each item with `recommendationSchema.parse()`, writes to `paths.analysisResult` in the same format as `analysisResultSchema`. Uses existing `updateStatus()` for state tracking. Graceful degradation: skip invalid findings, report validation errors. |
| INFRA-04 | First-time user can invoke `/evolve:scan` without manual `harness-evolve init`, or is guided to run init automatically | Scan template already has Prerequisites section checking `npx harness-evolve --version`. Enhancement: scan-context CLI auto-creates `~/.harness-evolve/` directories if missing. Slash command template guides user through init if not set up. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Code comments must be pure English (no Chinese, no bilingual)
- Technical discussion in Chinese, code in English
- Use Vitest for testing (`npm run test` = `vitest run`)
- Build with tsup (`npm run build`)
- TypeCheck with `tsc --noEmit`
- ESM-only (`"type": "module"` in package.json)
- Node.js >= 22.14.0
- Zod v4 (`zod/v4` import path)
- Commander.js 14 with `@commander-js/extra-typings`
- Atomic writes via `write-file-atomic`
- GSD workflow enforcement for all changes

## Standard Stack

### Core (Already Installed -- No Changes)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Commander.js | ^14.0.3 | CLI subcommand registration | Already used for all CLI commands. `registerXCommand(program)` pattern established. |
| Zod | ^4.3.6 | Schema validation for findings input | Already used for all schemas. `recommendationSchema.parse()` validates model output. |
| write-file-atomic | ^7.0.1 | Atomic writes for analysis-result.json | Already used for state persistence. Prevents corruption from concurrent writes. |
| Native node:fs/promises | built-in | File I/O for context building | Already used throughout. No new dependency needed. |
| Native node:readline | built-in | Stdin reading for store-findings | Built-in. Used for line-by-line JSON array input from pipe. |

### No New Dependencies Required

All four INFRA requirements can be implemented with the existing dependency set. The `scan-context` command wraps `buildScanContext()`. The `store-findings` command reads stdin and validates with `recommendationSchema`. No new packages.

## Architecture Patterns

### Existing CLI Command Registration Pattern
```
src/cli/<name>.ts    -- exports registerXCommand(program: Command)
src/cli.ts           -- imports and calls registerXCommand(program)
tests/unit/cli/<name>.test.ts  -- unit tests with mocked fs
```

Every CLI subcommand follows this pattern. New commands MUST follow it.

### Existing Scan Module Pattern
```
src/scan/context-builder.ts  -- buildScanContext(cwd, home) -> ScanContext
src/scan/schemas.ts          -- scanContextSchema (Zod v4)
src/scan/index.ts            -- buildScanResult() wrapper
```

### Recommended Structure for New Code
```
src/
├── scan/
│   └── context-builder.ts   # FIX: extractHooksFromAllSettings nested format
├── cli/
│   ├── scan-context.ts      # NEW: scan-context subcommand
│   └── store-findings.ts    # NEW: store-findings subcommand
├── cli.ts                   # MODIFY: register new subcommands
└── schemas/
    └── recommendation.ts    # NO CHANGE: existing schema is sufficient
```

### Pattern: INFRA-01 Hooks Parsing Fix

**Bug location:** `src/scan/context-builder.ts`, function `extractHooksFromAllSettings`, lines 266-298.

**Root cause:** The function iterates over each element in the event array and reads `def.type` and `def.command` directly. But in the official Claude Code hooks format, each array element is a **matcher group** with structure `{matcher?: string, hooks: [{type, command, ...}]}`. The actual hook definitions are inside the `hooks` sub-array, not at the top level.

**Real settings.json format (from user's machine):**
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash(git commit*)",
        "hooks": [
          { "type": "command", "command": "/path/to/guard-branch.sh" },
          { "type": "command", "command": "/path/to/validate-commit-msg.sh" }
        ]
      }
    ]
  }
}
```

**Fix approach:** Check each array element for a `hooks` sub-array. If present (nested format), iterate inner hooks. If not present, treat as flat format for backward compatibility. Also extract the `matcher` field into the hook registration data.

**Schema update:** Add optional `matcher` field to `hooks_registered` schema entry:
```typescript
hooks_registered: z.array(
  z.object({
    event: z.string(),
    scope: z.enum(['user', 'project', 'local']),
    type: z.string(),
    command: z.string().optional(),
    matcher: z.string().optional(),  // NEW: from nested format
  }),
),
```

**Key insight:** The `mergeHooks()` function in `src/cli/utils.ts` already correctly WRITES the nested format (creates `{matcher: '*', hooks: [hookEntry]}`). The bug is only in the READING side.

### Pattern: scan-context CLI Command

**Purpose:** Output the full `ScanContext` JSON to stdout for model consumption.

**Design:** Thin wrapper around existing `buildScanContext()`. No deprecation notice (unlike the existing `scan` command). Pure JSON output to stdout, errors to stderr.

```typescript
// src/cli/scan-context.ts
export function registerScanContextCommand(program: Command): void {
  program
    .command('scan-context')
    .description('Output structured configuration context as JSON')
    .action(async () => {
      const context = await buildScanContext(process.cwd());
      console.log(JSON.stringify(context, null, 2));
    });
}
```

**Difference from existing `scan` command:**
- `scan` wraps context in `{generated_at, scan_context}` and prints deprecation notice
- `scan-context` outputs raw `ScanContext` directly, no wrapper, no deprecation
- `scan-context` is the command the `/evolve:scan` template will use

### Pattern: store-findings CLI Command

**Purpose:** Accept model-generated findings from stdin, validate each against `recommendationSchema`, persist valid ones to the analysis pipeline.

**Design:**
1. Read all stdin as text
2. Parse as JSON array
3. Validate each element with `recommendationSchema.safeParse()`
4. Write valid findings to `paths.analysisResult` in `analysisResultSchema` format
5. Output summary: `{stored: N, skipped: M, errors: [...]}`

**Key considerations:**
- Must write in `analysisResultSchema` format (includes `generated_at`, `summary_period`, `recommendations`, `metadata`) so `pending` command can read it
- Use `write-file-atomic` for the write to prevent corruption
- Graceful degradation: invalid findings are skipped with error messages, not rejected entirely
- The `summary_period` and `metadata` fields can use sensible defaults since they come from model analysis, not interaction logs

**Stdin reading pattern:**
```typescript
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}
```

### Pattern: First-Time User Experience (INFRA-04)

**Current state:** The `/evolve:scan` template has a Prerequisites section that checks `npx harness-evolve --version` and guides users to run `init` if not found. The `scan-context` CLI command will work without init (it only reads config files, doesn't need hooks registered).

**Enhancement options (ranked):**
1. **Best:** `scan-context` and `store-findings` CLI commands auto-create `~/.harness-evolve/` directories via `ensureInit()` if they don't exist. This means the model-driven scan workflow works without a prior `init`.
2. **Good:** Update the scan template to detect missing init and provide clear one-command guidance.
3. **Minimal:** The existing template Prerequisites section already covers this.

**Recommendation:** Option 1 -- call `ensureInit()` in store-findings (it needs the directories to write results). scan-context doesn't need it (read-only). The scan template should also guide users if harness-evolve is not installed at all.

### Anti-Patterns to Avoid
- **Do NOT create a new schema file for scan-context output.** Reuse `scanContextSchema` from `src/scan/schemas.ts`.
- **Do NOT modify the existing `scan` CLI command.** It already has a deprecation notice and backward compatibility role.
- **Do NOT change the Recommendation schema fields.** `store-findings` must accept exactly the same shape the apply pipeline expects.
- **Do NOT read stdin line-by-line for store-findings.** The input is a JSON array, not JSONL. Read all at once, parse as array.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON schema validation | Custom validation logic | `recommendationSchema.safeParse()` | Zod already defines the exact shape. SafeParse returns errors without throwing. |
| Atomic file writes | Manual write + rename | `write-file-atomic` | Already a dependency. Handles concurrent access correctly. |
| CLI argument parsing | Manual argv parsing | Commander.js `.command().action()` | Consistent with all existing CLI commands. |
| Directory creation | Manual mkdir chains | `ensureInit()` from `storage/dirs.ts` | Already handles all required directories. |
| stdin reading | readline line-by-line | `process.stdin` async iterator | JSON array input, not streaming. Collect all then parse. |

## Common Pitfalls

### Pitfall 1: Breaking Flat Hook Format Backward Compatibility
**What goes wrong:** The fix for nested format stops working for any remaining flat-format entries.
**Why it happens:** Real-world settings.json files could theoretically contain both formats (though Claude Code official format is always nested).
**How to avoid:** Check for `hooks` sub-array first (nested). If not present, check for `type`/`command` directly (flat). Test with fixtures for: nested-only, flat-only (if supported), mixed, empty events, missing matcher.
**Warning signs:** Tests that only use nested format pass but old flat-format tests fail.

### Pitfall 2: store-findings Overwriting Existing Analysis Results
**What goes wrong:** Running `store-findings` replaces the previous analysis result, losing hook-generated recommendations.
**Why it happens:** The code writes to `paths.analysisResult` which is also where the analysis pipeline stores its results.
**How to avoid:** When storing findings, merge with existing recommendations rather than replacing. Or use a separate file for model-generated findings. Consider: the existing `pending` command reads from `analysisResult` -- if we write elsewhere, `pending` won't find them.
**Warning signs:** After running store-findings, `npx harness-evolve pending` shows only model-generated findings, not background-analysis findings.

### Pitfall 3: Matcher Field Missing from hooks_registered Schema
**What goes wrong:** The fix extracts hooks correctly but doesn't include the `matcher` field. Model-driven analysis cannot tell which hooks are scoped to specific tools vs. wildcard.
**Why it happens:** The current `hooks_registered` schema doesn't have a `matcher` field.
**How to avoid:** Add `matcher: z.string().optional()` to the hooks_registered schema entry. Existing tests should still pass (field is optional).
**Warning signs:** Model-driven scanner cannot distinguish between `matcher: "Bash"` and `matcher: "*"` hooks.

### Pitfall 4: stdin Pipe Hangs When No Input Provided
**What goes wrong:** User runs `harness-evolve store-findings` without piping input. Process hangs waiting for stdin.
**Why it happens:** `process.stdin` is a readable stream that stays open until EOF.
**How to avoid:** Check if stdin is a TTY. If it is (interactive terminal, no pipe), print usage and exit immediately. Use `process.stdin.isTTY` check.
**Warning signs:** User runs command in terminal without pipe and it appears frozen.

### Pitfall 5: ScanContext Schema Change Breaks Existing Tests
**What goes wrong:** Adding `matcher` to `hooks_registered` schema breaks tests that assert exact schema shape.
**Why it happens:** Tests create hook entries without the matcher field.
**How to avoid:** Make `matcher` optional with `.optional()`. Existing test data remains valid.
**Warning signs:** `scanContextSchema.parse()` throws on test fixtures that don't have matcher.

## Code Examples

### INFRA-01: Fixed extractHooksFromAllSettings
```typescript
// Source: Analysis of context-builder.ts:266-298 and official hooks docs
function extractHooksFromAllSettings(
  settings: ScanContext['settings'],
): ScanContext['hooks_registered'] {
  const hooks: ScanContext['hooks_registered'] = [];

  const extractFromScope = (
    settingsObj: unknown,
    scope: 'user' | 'project' | 'local',
  ): void => {
    if (!settingsObj || typeof settingsObj !== 'object') return;
    const obj = settingsObj as Record<string, unknown>;
    if (!obj.hooks || typeof obj.hooks !== 'object') return;

    const hooksConfig = obj.hooks as Record<string, unknown>;
    for (const [event, defs] of Object.entries(hooksConfig)) {
      if (!Array.isArray(defs)) continue;
      for (const def of defs) {
        if (!def || typeof def !== 'object') continue;
        const matcherGroup = def as Record<string, unknown>;

        // Nested format: { matcher?, hooks: [{ type, command, ... }] }
        if (Array.isArray(matcherGroup.hooks)) {
          const matcher = typeof matcherGroup.matcher === 'string'
            ? matcherGroup.matcher : undefined;
          for (const innerHook of matcherGroup.hooks) {
            if (!innerHook || typeof innerHook !== 'object') continue;
            const h = innerHook as Record<string, unknown>;
            hooks.push({
              event,
              scope,
              type: String(h.type ?? 'command'),
              command: typeof h.command === 'string' ? h.command : undefined,
              matcher,
            });
          }
        } else {
          // Flat format fallback: { type, command, ... }
          hooks.push({
            event,
            scope,
            type: String(matcherGroup.type ?? 'command'),
            command: typeof matcherGroup.command === 'string'
              ? matcherGroup.command : undefined,
          });
        }
      }
    }
  };

  extractFromScope(settings.user, 'user');
  extractFromScope(settings.project, 'project');
  extractFromScope(settings.local, 'local');

  return hooks;
}
```

### INFRA-02: scan-context CLI Command
```typescript
// Source: Following existing cli/scan.ts pattern
import type { Command } from '@commander-js/extra-typings';
import { buildScanContext } from '../scan/context-builder.js';

export function registerScanContextCommand(program: Command): void {
  program
    .command('scan-context')
    .description('Output structured configuration context as JSON for model consumption')
    .action(async () => {
      try {
        const context = await buildScanContext(process.cwd());
        console.log(JSON.stringify(context, null, 2));
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        process.exitCode = 1;
      }
    });
}
```

### INFRA-03: store-findings CLI Command
```typescript
// Source: Following existing cli/apply.ts pattern + recommendation schema
import type { Command } from '@commander-js/extra-typings';
import { recommendationSchema } from '../schemas/recommendation.js';
import { ensureInit } from '../storage/dirs.js';
import { paths } from '../storage/dirs.js';
import writeFileAtomic from 'write-file-atomic';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export function registerStoreFindings(program: Command): void {
  program
    .command('store-findings')
    .description('Validate and store model-generated findings into the apply pipeline')
    .action(async () => {
      if (process.stdin.isTTY) {
        console.error('Usage: echo \'[...]\' | harness-evolve store-findings');
        process.exitCode = 1;
        return;
      }
      await ensureInit();

      const raw = await readStdin();
      const parsed = JSON.parse(raw);
      // ... validate each with recommendationSchema.safeParse()
      // ... write to paths.analysisResult
    });
}
```

### INFRA-04: TTY Detection for User Guidance
```typescript
// Source: Node.js process.stdin.isTTY documentation
// In store-findings: detect interactive terminal and guide user
if (process.stdin.isTTY) {
  console.error('Usage: Pipe JSON findings to stdin.');
  console.error('  echo \'[{"id":"...","target":"HOOK",...}]\' | harness-evolve store-findings');
  process.exitCode = 1;
  return;
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/unit/scan/context-builder.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | Nested hooks `{matcher, hooks: [{type, command}]}` parsed correctly | unit | `npx vitest run tests/unit/scan/context-builder.test.ts -t "nested hooks"` | Partial (existing test notes INFRA-01 fix needed) |
| INFRA-01 | Mixed nested + flat format works | unit | `npx vitest run tests/unit/scan/context-builder.test.ts -t "mixed hooks"` | No -- Wave 0 |
| INFRA-01 | Matcher field extracted from nested hooks | unit | `npx vitest run tests/unit/scan/context-builder.test.ts -t "matcher"` | No -- Wave 0 |
| INFRA-01 | Real user settings.json parsed with zero false positives | integration | `npx vitest run tests/integration/scan-pipeline-v4.test.ts -t "INFRA-01"` | Partial (placeholder test exists) |
| INFRA-02 | scan-context outputs valid ScanContext JSON | unit | `npx vitest run tests/unit/cli/scan-context.test.ts` | No -- Wave 0 |
| INFRA-02 | scan-context output parseable by scanContextSchema | integration | `npx vitest run tests/integration/cli-scan.test.ts` | Partial (existing tests cover buildScanResult) |
| INFRA-03 | store-findings validates and persists valid findings | unit | `npx vitest run tests/unit/cli/store-findings.test.ts` | No -- Wave 0 |
| INFRA-03 | store-findings rejects invalid findings gracefully | unit | `npx vitest run tests/unit/cli/store-findings.test.ts -t "invalid"` | No -- Wave 0 |
| INFRA-03 | store-findings findings appear in pending output | integration | `npx vitest run tests/integration/e2e-flows.test.ts -t "store-findings"` | No -- Wave 0 |
| INFRA-04 | scan-context works without prior init | unit | `npx vitest run tests/unit/cli/scan-context.test.ts -t "no init"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/scan/ tests/unit/cli/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/scan/context-builder.test.ts` -- new tests for nested hooks, mixed format, matcher extraction
- [ ] `tests/unit/cli/scan-context.test.ts` -- covers INFRA-02
- [ ] `tests/unit/cli/store-findings.test.ts` -- covers INFRA-03
- [ ] `tests/integration/scan-pipeline-v4.test.ts` -- update INFRA-01 placeholder test to assert correct nested parsing

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flat hook format `[{type, command}]` | Nested format `[{matcher, hooks: [{type, command}]}]` | Claude Code hooks v1 | context-builder must support nested format |
| 7 code-based scanners | Model-driven analysis (Phase 23 validated) | v4.0 | scan-context and store-findings bridge code-to-model |
| Manual `init` required | Progressive onboarding | v4.0 (this phase) | scan-context works without init, store-findings auto-inits |

## Open Questions

1. **Should store-findings merge with or replace existing analysis results?**
   - What we know: `paths.analysisResult` is also written by the background analysis pipeline. `pending` command reads from this single file.
   - What's unclear: If store-findings overwrites, background-generated recommendations are lost. If it merges, deduplication logic is needed.
   - Recommendation: **Replace** the file (same behavior as background analysis). The model-driven scan is a complete analysis pass. Document this in the CLI help text. If merge is needed later, it can be added as a separate concern.

2. **Should the hooks_registered schema include additional nested-format fields (timeout, async, statusMessage)?**
   - What we know: The model-driven scanner might find these useful for analysis (e.g., detecting hooks with very short timeouts).
   - What's unclear: Whether adding more fields creates schema bloat without clear analysis value.
   - Recommendation: Add `matcher` only for now. Other fields can be added when a guidance document needs them.

3. **How should scan-context handle the `home` parameter?**
   - What we know: `buildScanContext(cwd, home)` accepts an optional home dir. For CLI usage, `process.env.HOME` is always correct.
   - Recommendation: Default to `process.env.HOME`. No CLI flag needed.

## Sources

### Primary (HIGH confidence)
- `src/scan/context-builder.ts` -- Bug root cause analysis (extractHooksFromAllSettings lines 266-298)
- `src/cli/utils.ts` -- mergeHooks already creates nested format correctly (line 172-188)
- `src/schemas/recommendation.ts` -- Recommendation schema (line 47-63)
- `src/scan/schemas.ts` -- ScanContext schema (line 7-54)
- `src/cli/scan.ts` -- Existing scan command pattern
- `src/cli/apply.ts` -- Existing apply commands pattern (pending, apply-one, dismiss)
- `src/storage/dirs.ts` -- paths and ensureInit()
- `~/.claude/settings.json` -- Real user hooks configuration confirming nested format
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Official nested hooks format specification
- `tests/integration/scan-pipeline-v4.test.ts` -- Existing INFRA-01 placeholder test (line 107-143)

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` -- Feature landscape and dependency chain analysis
- `.planning/research/PITFALLS.md` -- Pitfalls 31-48 covering model-driven migration risks
- `.planning/PROJECT.md` -- Current state: 708 tests, 7 scanners removed in Phase 23

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing packages verified against npm registry
- Architecture: HIGH -- patterns directly derived from existing codebase analysis of 6 CLI commands and 3 scan module files
- Pitfalls: HIGH -- root cause of INFRA-01 confirmed by comparing code (flat read) vs real data (nested format) vs official docs (nested is the only format)

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable -- core Node.js APIs and established project patterns)
