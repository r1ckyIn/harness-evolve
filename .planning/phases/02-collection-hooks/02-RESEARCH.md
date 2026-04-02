# Phase 2: Collection Hooks - Research

**Researched:** 2026-03-31
**Domain:** Claude Code hooks system, lifecycle event capture, hook registration, performance-critical stdin parsing
**Confidence:** HIGH

## Summary

Phase 2 transforms the Phase 1 storage layer into a live data collection pipeline by creating four Claude Code hooks that capture user interactions: UserPromptSubmit (prompts), PreToolUse/PostToolUse (tool usage with duration), and PermissionRequest (permission patterns). Each hook is a standalone shell command that reads JSON from stdin, extracts relevant fields, calls the Phase 1 `appendLogEntry()` and `incrementCounter()` functions, and exits within the performance budget (<100ms for UserPromptSubmit, <30ms for others).

The primary architectural challenge is that hooks run as separate Node.js processes (child processes of Claude Code), so each invocation pays the Node.js startup cost (~30-60ms). Each hook script must be a compiled JS file (via tsup) that imports the Phase 1 storage library, reads stdin, validates with Zod, and appends a JSONL entry. The `tool_use_id` field present in both PreToolUse and PostToolUse events enables duration calculation by correlating paired events. The PermissionRequest hook fires BEFORE the user decides, so it cannot directly capture approved/denied decisions -- we must infer the decision: if a PostToolUse fires for the same tool_use_id, it was approved; otherwise it was denied or the user cancelled.

**Primary recommendation:** Create four hook entry point scripts compiled by tsup (one per hook event), each reading stdin JSON, validating input schema, constructing a log entry, appending via the Phase 1 logger, and incrementing the counter. Register hooks in settings.json with proper matchers. Use `tool_use_id` correlation for duration tracking. For PermissionRequest, log the request itself and infer the decision from subsequent tool execution events.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAP-01 | Capture user prompts via UserPromptSubmit hook with timestamp, session_id, cwd, prompt text | UserPromptSubmit hook receives `{session_id, cwd, prompt, transcript_path}` on stdin. Map directly to Phase 1 `promptEntrySchema` fields. |
| CAP-02 | Capture permission approval/denial patterns via PermissionRequest hook with tool_name and decision | PermissionRequest fires BEFORE user decision -- captures `{tool_name, tool_input}`. Decision must be inferred: log as "unknown" initially, or correlate with subsequent PostToolUse (approved) / absence (denied). |
| CAP-03 | Capture tool usage patterns via PreToolUse/PostToolUse hooks with tool_name, input summary, duration | PreToolUse receives `{tool_name, tool_input, tool_use_id}`. PostToolUse adds `{tool_response}`. Correlate by `tool_use_id` for duration. PostToolUseFailure provides error info. |
| CAP-04 | Access full conversation transcripts via transcript_path for context enrichment (read-only) | All hooks receive `transcript_path` in stdin. Phase 2 stores the path in log entries for later Phase 3 analysis. No transcript copying -- just path reference. |
</phase_requirements>

## Standard Stack

### Core (Locked -- from CLAUDE.md)

| Library | Version | Purpose | Phase 2 Use |
|---------|---------|---------|-------------|
| Node.js | >=22.14.0 | Runtime | Hook scripts execute as Node.js processes |
| TypeScript | ~6.0 | Type safety | Hook source code, input schemas |
| Zod | ^4.3.6 | Runtime validation | Validate hook stdin JSON input |
| tsup | ^8.5.1 | Bundling | Compile hook entry points to standalone JS files |
| Vitest | ^4.1.2 | Testing | Unit tests for hook handlers, integration tests for full pipeline |

### Phase 1 Dependencies (consumed, not added)

| Module | Path | Purpose |
|--------|------|---------|
| `appendLogEntry()` | `src/storage/logger.ts` | Append scrubbed JSONL entries to type-specific log files |
| `incrementCounter()` | `src/storage/counter.ts` | Atomic counter increment with cross-process locking |
| `loadConfig()` | `src/storage/config.ts` | Read config to check if specific hook types are enabled |
| `promptEntrySchema` | `src/schemas/log-entry.ts` | Validate prompt log entries |
| `toolEntrySchema` | `src/schemas/log-entry.ts` | Validate tool log entries |
| `permissionEntrySchema` | `src/schemas/log-entry.ts` | Validate permission log entries |
| `userPromptSubmitInputSchema` | `src/schemas/hook-input.ts` | Validate UserPromptSubmit stdin input |

### No New Dependencies

Phase 2 adds zero new npm dependencies. All hook scripts use:
- Phase 1 library imports (Zod schemas, logger, counter)
- Node.js built-ins (`process.stdin`, `node:readline`)
- tsup for compilation to standalone entry points

## Architecture Patterns

### Recommended Project Structure

```
src/
├── hooks/                    # NEW: Hook entry point scripts
│   ├── user-prompt-submit.ts # UserPromptSubmit handler
│   ├── pre-tool-use.ts       # PreToolUse handler
│   ├── post-tool-use.ts      # PostToolUse handler
│   ├── permission-request.ts # PermissionRequest handler
│   └── shared.ts             # Shared stdin reader + error handling
├── schemas/
│   ├── hook-input.ts         # EXTEND: Add schemas for all 4 hook events
│   ├── log-entry.ts          # EXISTS: Phase 1 log entry schemas
│   ├── config.ts             # EXISTS: Config schema
│   └── counter.ts            # EXISTS: Counter schema
├── scrubber/                 # EXISTS: Phase 1 scrubber
├── storage/                  # EXISTS: Phase 1 storage
└── index.ts                  # EXTEND: Export new hook input schemas
```

### Pattern 1: Hook Entry Point Architecture

**What:** Each hook is a self-contained TypeScript file that compiles to a standalone JS entry point via tsup. It reads JSON from stdin, validates it, constructs a log entry, appends it, and increments the counter.

**When to use:** Every hook handler follows this pattern.

**Example:**
```typescript
// src/hooks/user-prompt-submit.ts
// Source: Claude Code hooks reference (https://code.claude.com/docs/en/hooks)

import { userPromptSubmitInputSchema } from '../schemas/hook-input.js';
import { appendLogEntry } from '../storage/logger.js';
import { incrementCounter } from '../storage/counter.js';
import { loadConfig } from '../storage/config.js';
import { readStdin } from './shared.js';

async function main(): Promise<void> {
  const config = await loadConfig();
  if (!config.hooks.capturePrompts) {
    process.exit(0);
  }

  const raw = await readStdin();
  const input = userPromptSubmitInputSchema.parse(JSON.parse(raw));

  await appendLogEntry('prompts', {
    timestamp: new Date().toISOString(),
    session_id: input.session_id,
    cwd: input.cwd,
    prompt: input.prompt,
    prompt_length: input.prompt.length,
  });

  await incrementCounter(input.session_id);
  process.exit(0);
}

main().catch(() => process.exit(1));
```

### Pattern 2: Shared Stdin Reader

**What:** A reusable function that reads all of stdin into a string buffer. Hooks receive JSON on stdin from Claude Code.

**When to use:** Every hook handler needs this.

**Example:**
```typescript
// src/hooks/shared.ts

export function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}
```

### Pattern 3: Tool Duration Correlation via tool_use_id

**What:** PreToolUse logs a "pre" event with timestamp. PostToolUse finds the matching "pre" event by `tool_use_id` to calculate `duration_ms`.

**When to use:** For CAP-03 tool usage patterns.

**Design decision:** Rather than reading back log files (expensive for a <30ms hook), PreToolUse writes a tiny temp marker file (`~/.harness-evolve/pending/{tool_use_id}.ts`) containing just the start timestamp. PostToolUse reads this marker, computes duration, deletes the marker, and writes the final "post" log entry with duration_ms.

**Alternative considered:** Using an in-memory store -- impossible because hooks run as separate processes. Using a shared SQLite -- contradicts project "plain files only" constraint.

**Example:**
```typescript
// PreToolUse: write start marker
const markerPath = join(paths.base, 'pending', `${input.tool_use_id}.ts`);
await writeFile(markerPath, Date.now().toString(), 'utf-8');

// PostToolUse: read marker, compute duration, clean up
const markerPath = join(paths.base, 'pending', `${input.tool_use_id}.ts`);
let duration_ms: number | undefined;
try {
  const startTs = parseInt(await readFile(markerPath, 'utf-8'), 10);
  duration_ms = Date.now() - startTs;
  await unlink(markerPath);
} catch {
  // Marker missing -- PreToolUse didn't run or was async
}
```

### Pattern 4: tsup Multi-Entry Point Build

**What:** Extend tsup.config.ts to compile each hook as a separate entry point, producing `dist/hooks/user-prompt-submit.js`, etc.

**When to use:** Building the project for distribution.

**Example:**
```typescript
// tsup.config.ts (updated)
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'hooks/user-prompt-submit': 'src/hooks/user-prompt-submit.ts',
    'hooks/pre-tool-use': 'src/hooks/pre-tool-use.ts',
    'hooks/post-tool-use': 'src/hooks/post-tool-use.ts',
    'hooks/permission-request': 'src/hooks/permission-request.ts',
  },
  format: ['esm'],
  target: 'node22',
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: false,
});
```

### Pattern 5: Hook Registration in settings.json

**What:** Register hooks in `~/.claude/settings.json` so Claude Code invokes them at the right lifecycle points.

**Example:**
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.harness-evolve/dist/hooks/user-prompt-submit.js",
            "timeout": 10
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.harness-evolve/dist/hooks/pre-tool-use.js",
            "timeout": 10
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.harness-evolve/dist/hooks/post-tool-use.js",
            "timeout": 10
          }
        ]
      }
    ],
    "PermissionRequest": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.harness-evolve/dist/hooks/permission-request.js",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### Anti-Patterns to Avoid

- **Running analysis in hooks:** Hooks are for capture only. Analysis happens in Phase 3+. Every hook must finish in <100ms.
- **Reading log files in hooks:** Never read back log files from within a hook. Append only.
- **Agent or prompt hook types for capture:** Use `type: "command"` for all capture hooks. Agent/prompt hooks are slower and more expensive. Save them for Phase 4 analysis.
- **Blocking on PermissionRequest:** The PermissionRequest hook should never block (exit 0 always). It captures the request metadata, not make decisions.
- **Heavy imports in hook scripts:** Each hook spawns a new Node.js process. Minimize import chains. tsup bundles everything into a single file per hook which helps.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stdin JSON parsing | Custom stream parser | `readStdin()` + `JSON.parse()` | Stdin for hooks is always a single JSON object, not streaming. Simple buffer + parse is correct. |
| Log scrubbing | New scrubber in hooks | Phase 1 `scrubObject()` via `appendLogEntry()` | Already built, tested with 34 tests, 14 patterns. Logger calls scrubber automatically. |
| Atomic counter | New locking logic | Phase 1 `incrementCounter()` | Already built with proper-lockfile, tested with 2x100 concurrent processes = 200. |
| Log entry validation | Manual field checking | Phase 1 Zod schemas + `appendLogEntry()` | Schema validation is built into the logger pipeline. |
| Daily log rotation | Custom date logic | Phase 1 logger `getLogFilePath()` | Already handles YYYY-MM-DD.jsonl naming internally. |
| Directory initialization | Manual mkdir calls | Phase 1 `ensureInit()` | Init-on-first-use pattern already handles all directory creation. |

**Key insight:** Phase 2 hooks are thin wrappers around Phase 1's storage library. The hooks read stdin, extract fields, and call Phase 1 functions. Almost zero new logic is needed beyond the hook entry points themselves and the new input schemas.

## Common Pitfalls

### Pitfall 1: Node.js Startup Latency Eating the Performance Budget

**What goes wrong:** Each hook invocation spawns a new Node.js process. Cold start on Node 22 is ~30-60ms. With the 50-100ms performance budget, this leaves only 20-40ms for actual work.
**Why it happens:** Hooks are command-type, meaning Claude Code runs them as child processes.
**How to avoid:** tsup bundles all dependencies into a single file, eliminating module resolution overhead. Keep hook logic minimal -- read stdin, parse JSON, append one line, increment counter, exit. No unnecessary imports.
**Warning signs:** Hook execution times consistently >80ms in testing.

### Pitfall 2: PermissionRequest Cannot Capture User Decisions

**What goes wrong:** The PermissionRequest hook fires BEFORE the user sees the permission dialog. The hook input contains `tool_name` and `tool_input` but NOT the user's approval/denial decision.
**Why it happens:** This is by design -- PermissionRequest hooks are meant to make decisions ON BEHALF of the user, not observe their decisions.
**How to avoid:** Log PermissionRequest events with `decision: 'unknown'`. The Phase 1 schema already supports this enum value. In Phase 3, decision can be inferred: if a subsequent PostToolUse with the same `tool_use_id` exists, the request was approved. If PostToolUseFailure fires, the tool was denied or failed. If neither fires, the user denied.
**Warning signs:** Tests expecting "approved"/"denied" in PermissionRequest log entries.

### Pitfall 3: PostToolUseFailure as a Separate Event

**What goes wrong:** Assuming PostToolUse fires on both success and failure. It only fires on SUCCESS. PostToolUseFailure is a separate event that fires on FAILURE.
**Why it happens:** Different hook events in Claude Code.
**How to avoid:** Register a separate PostToolUseFailure handler (or handle it in the same script with an event type check). The Phase 1 `toolEntrySchema` already has `event: z.enum(['pre', 'post', 'failure'])` and `success: z.boolean().optional()` fields to accommodate this.
**Warning signs:** Missing failure entries in tool logs.

### Pitfall 4: stdin Not Being Fully Read Before Processing

**What goes wrong:** Starting JSON.parse before stdin is completely buffered, causing parsing errors.
**Why it happens:** stdin is a stream; data arrives in chunks.
**How to avoid:** Always use a "read all then parse" pattern. Collect all chunks into a buffer, then parse on the 'end' event.
**Warning signs:** Intermittent JSON parse errors in hook output.

### Pitfall 5: Hook Errors Blocking Claude Code

**What goes wrong:** An unhandled exception in a hook causes exit code 2, which BLOCKS the action in Claude Code (blocks prompt submission, blocks tool execution, denies permission).
**Why it happens:** Exit code 2 is the "blocking error" code. Any unhandled throw causes a non-zero exit, and code 2 specifically blocks.
**How to avoid:** Wrap all hook logic in try/catch. On ANY error, exit(0) (allow) or exit(1) (non-blocking error), NEVER exit(2). Exit 2 should only be used intentionally for blocking.
**Warning signs:** Claude Code showing "hook error" messages that prevent normal operation.

### Pitfall 6: tool_input Summary Truncation

**What goes wrong:** Logging the entire `tool_input` object for tools like `Write` which can contain massive file contents.
**Why it happens:** `tool_input` for Write includes the full file content. Storing this would bloat logs enormously.
**How to avoid:** Create an `input_summary` that truncates large fields. For Bash: log the command. For Write/Edit: log the file_path only. For Read: log the file_path. Cap summary at ~200 characters.
**Warning signs:** Tool log files growing to MB size after a few sessions.

## Code Examples

### Complete UserPromptSubmit Hook Handler

```typescript
// Source: Claude Code hooks reference + Phase 1 API
import { userPromptSubmitInputSchema } from '../schemas/hook-input.js';
import { appendLogEntry } from '../storage/logger.js';
import { incrementCounter } from '../storage/counter.js';
import { loadConfig } from '../storage/config.js';

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk: string) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main(): Promise<void> {
  try {
    const config = await loadConfig();
    if (!config.hooks.capturePrompts) process.exit(0);

    const raw = await readStdin();
    const input = userPromptSubmitInputSchema.parse(JSON.parse(raw));

    await appendLogEntry('prompts', {
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      cwd: input.cwd,
      prompt: input.prompt,
      prompt_length: input.prompt.length,
    });

    await incrementCounter(input.session_id);
  } catch {
    // Never block Claude Code on capture errors
  }
  process.exit(0);
}

main();
```

### Hook Input Schemas (New Zod Schemas)

```typescript
// src/schemas/hook-input.ts (EXTENDED)
import { z } from 'zod/v4';

// Common fields present in ALL hook events
const hookCommonSchema = z.object({
  session_id: z.string(),
  transcript_path: z.string(),
  cwd: z.string(),
  permission_mode: z.string(),
});

// UserPromptSubmit (already exists)
export const userPromptSubmitInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('UserPromptSubmit'),
  prompt: z.string(),
});
export type UserPromptSubmitInput = z.infer<typeof userPromptSubmitInputSchema>;

// PreToolUse
export const preToolUseInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('PreToolUse'),
  tool_name: z.string(),
  tool_input: z.record(z.unknown()),
  tool_use_id: z.string(),
});
export type PreToolUseInput = z.infer<typeof preToolUseInputSchema>;

// PostToolUse
export const postToolUseInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('PostToolUse'),
  tool_name: z.string(),
  tool_input: z.record(z.unknown()),
  tool_response: z.unknown().optional(),
  tool_use_id: z.string(),
});
export type PostToolUseInput = z.infer<typeof postToolUseInputSchema>;

// PostToolUseFailure
export const postToolUseFailureInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('PostToolUseFailure'),
  tool_name: z.string(),
  tool_input: z.record(z.unknown()),
  tool_use_id: z.string(),
  error: z.string().optional(),
  is_interrupt: z.boolean().optional(),
});
export type PostToolUseFailureInput = z.infer<typeof postToolUseFailureInputSchema>;

// PermissionRequest
export const permissionRequestInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('PermissionRequest'),
  tool_name: z.string(),
  tool_input: z.record(z.unknown()),
  permission_suggestions: z.array(z.unknown()).optional(),
});
export type PermissionRequestInput = z.infer<typeof permissionRequestInputSchema>;
```

### Tool Input Summary Function

```typescript
// Generate a concise summary of tool_input for log entries
// Prevents Write/Edit tool inputs (with full file content) from bloating logs
export function summarizeToolInput(
  toolName: string,
  toolInput: Record<string, unknown>
): string {
  const MAX_LEN = 200;

  switch (toolName) {
    case 'Bash':
      return truncate(String(toolInput.command ?? ''), MAX_LEN);
    case 'Write':
    case 'Edit':
    case 'Read':
      return truncate(String(toolInput.file_path ?? ''), MAX_LEN);
    case 'Glob':
      return truncate(String(toolInput.pattern ?? ''), MAX_LEN);
    case 'Grep':
      return truncate(String(toolInput.pattern ?? ''), MAX_LEN);
    default: {
      // MCP tools and others: stringify first 200 chars of input
      const str = JSON.stringify(toolInput);
      return truncate(str, MAX_LEN);
    }
  }
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual log aggregation | Claude Code hooks (21 events) | v2.1.x (Jan 2026) | Automated, lifecycle-integrated data collection |
| Single PostToolUse for all outcomes | Separate PostToolUse + PostToolUseFailure | v2.1.x | Must handle both events for complete tool tracking |
| No tool_use_id correlation | tool_use_id in Pre/Post events | v2.1.x | Enables duration calculation between pre/post events |
| PermissionRequest with decision | PermissionRequest before decision | Current | Decision inference required (not directly observable) |

**Deprecated/outdated:**
- UserPromptSubmit JSON `hookSpecificOutput` stdout format had bugs in v2.0.69 and v2.1.4. Plain text stdout is now documented as the standard for context injection. Phase 2 hooks don't inject context (capture-only), so this doesn't affect us.

## Open Questions

1. **PermissionRequest Decision Inference**
   - What we know: PermissionRequest fires before user decides. PostToolUse/PostToolUseFailure fire after tool execution.
   - What's unclear: Exact timing/ordering guarantees between PermissionRequest and subsequent tool events. Whether Claude Code guarantees a PostToolUse or PostToolUseFailure always fires if permission is granted.
   - Recommendation: Log PermissionRequest with `decision: 'unknown'`. Leave decision inference to Phase 3 aggregation where we can correlate across log files. This is acceptable -- the Phase 1 schema already has `'unknown'` as a valid enum value.

2. **Node.js Startup Performance on macOS Ventura Intel**
   - What we know: Node 22 cold start is ~30-60ms. User has MacBook Pro 2019 Intel.
   - What's unclear: Whether Intel Mac cold starts are slower than ARM benchmarks suggest.
   - Recommendation: Measure actual hook execution time in tests. If consistently >80ms, consider a shell wrapper that only invokes Node when config.hooks.X is enabled (avoiding Node startup for disabled hooks). Also consider whether `node --jitless` flag or pre-loading via `NODE_COMPILE_CACHE` helps.

3. **PostToolUseFailure Registration**
   - What we know: PostToolUseFailure is a separate event from PostToolUse.
   - What's unclear: Whether we should register a separate hook script or handle it in the same post-tool-use handler.
   - Recommendation: Register PostToolUseFailure as a separate hook entry in settings.json pointing to a dedicated handler. This keeps each handler simple and focused. The toolEntrySchema already supports `event: 'failure'` and `success: false`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Hook execution | Yes | v22.14.0 | -- |
| npm | Package management | Yes | 11.6.0 | -- |
| TypeScript | Compilation | Yes | 6.0.2 | -- |
| tsup | Bundle hooks | Yes | ^8.5.1 (installed) | -- |
| Vitest | Testing | Yes | 4.1.2 | -- |
| jq | JSON parsing in tests | N/A | N/A | Use Node.js for all JSON parsing (no jq dependency) |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run && npx tsc --noEmit` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAP-01 | UserPromptSubmit hook captures prompt with timestamp, session_id, cwd, prompt text | unit | `npx vitest run tests/unit/hooks/user-prompt-submit.test.ts -t "captures prompt"` | Wave 0 |
| CAP-02 | PermissionRequest hook captures tool_name and decision (unknown) | unit | `npx vitest run tests/unit/hooks/permission-request.test.ts -t "captures permission"` | Wave 0 |
| CAP-03 | PreToolUse/PostToolUse hooks capture tool_name, input_summary, duration | unit | `npx vitest run tests/unit/hooks/tool-use.test.ts -t "captures tool usage"` | Wave 0 |
| CAP-03 | Duration calculated from PreToolUse/PostToolUse correlation | unit | `npx vitest run tests/unit/hooks/tool-use.test.ts -t "calculates duration"` | Wave 0 |
| CAP-04 | transcript_path stored in log entries for later context enrichment | unit | `npx vitest run tests/unit/hooks/user-prompt-submit.test.ts -t "stores transcript_path"` | Wave 0 |
| PERF | Each hook completes in under 100ms | integration | `npx vitest run tests/integration/hook-performance.test.ts` | Wave 0 |
| BUILD | tsup compiles all hook entry points to dist/hooks/ | integration | `npx tsup && ls dist/hooks/` | Wave 0 |
| CONFIG | Config hooks.captureX=false disables corresponding hook | unit | `npx vitest run tests/unit/hooks/ -t "respects config"` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run && npx tsc --noEmit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/hooks/user-prompt-submit.test.ts` -- covers CAP-01, CAP-04
- [ ] `tests/unit/hooks/pre-tool-use.test.ts` -- covers CAP-03 (pre event)
- [ ] `tests/unit/hooks/post-tool-use.test.ts` -- covers CAP-03 (post event, duration)
- [ ] `tests/unit/hooks/permission-request.test.ts` -- covers CAP-02
- [ ] `tests/unit/hooks/shared.test.ts` -- covers shared stdin reader, summarizeToolInput
- [ ] `tests/integration/hook-performance.test.ts` -- covers performance budget verification

## Project Constraints (from CLAUDE.md)

- **Code comments:** Pure English, no Chinese (from `02-standards/code-comments.md`)
- **Commit messages:** GSD format `<type>(<phase>-<plan>): <description>` (from `02-standards/commit-messages.md`)
- **No Co-Authored-By:** Hook will block (from commit message rules)
- **Technology stack:** Locked to Node.js 22, TypeScript 6, Zod 4, tsup 8, Vitest 4
- **File persistence:** Plain files only, no database (from PROJECT.md Out of Scope)
- **No transcript copying:** Read-only access to transcript_path, never copy content to own storage (from REQUIREMENTS.md Out of Scope)
- **Secret scrubbing:** All captured data must pass through scrubber before disk write (D-01 from Phase 1)
- **Performance budget:** UserPromptSubmit <50ms (capture), PreToolUse/PostToolUse <30ms, PermissionRequest <30ms (from CLAUDE.md Performance Budget)

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Complete hook event types, stdin schemas, exit codes, JSON output format, matchers, settings.json format, all event-specific input fields
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) -- Best practices, common patterns, example implementations, performance constraints
- Phase 1 codebase (`src/schemas/`, `src/storage/`, `src/scrubber/`) -- Existing schemas and APIs that hooks will consume

### Secondary (MEDIUM confidence)
- [Claude Code Hooks Multi-Agent Observability](https://github.com/disler/claude-code-hooks-multi-agent-observability) -- Confirms tool_use_id correlation pattern for Pre/PostToolUse events
- [PermissionRequest Hook Issue #19298](https://github.com/anthropics/claude-code/issues/19298) -- Documents PermissionRequest decision limitations

### Tertiary (LOW confidence)
- Node.js cold start performance numbers (~30-60ms) -- based on general benchmarks, not verified on user's specific Intel MacBook Pro 2019 hardware

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- locked in Phase 1, no new dependencies
- Architecture: HIGH -- hook input schemas from official docs, patterns well-established in ecosystem
- Pitfalls: HIGH -- PermissionRequest limitation verified via official docs + GitHub issues, exit code behavior from official reference
- Performance: MEDIUM -- Node.js startup latency on Intel Mac is an estimate, needs empirical validation

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (hooks API is stable, unlikely to change)
