# Phase 1: Foundation & Storage - Research

**Researched:** 2026-03-31
**Domain:** File-based persistence, Claude Code hooks infrastructure, secret scrubbing, atomic file operations
**Confidence:** HIGH

## Summary

Phase 1 builds the persistent storage layer for harness-evolve: the directory structure (`~/.harness-evolve/`), config schema with defaults, JSONL log format with daily rotation, an atomic file-based counter, secret scrubbing on write, and zero-config installation via plugin manifest. This is a greenfield phase with no existing code.

The technology stack is locked (Node.js 22, TypeScript 6, Zod 4, write-file-atomic 7, tsup 8, Vitest 4). The critical risk is UserPromptSubmit stdout injection (Gray Area #1) -- research confirms this has been historically unreliable (bugs in v2.0.69 and v2.1.4), though the current version (v2.1.88) documents it as working. Phase 1 must validate this empirically and document a fallback. For atomic counter writes across concurrent processes, write-file-atomic alone is insufficient -- it serializes writes within a single process but does not lock across processes. A read-lock-increment-write pattern using proper-lockfile (mkdir-based, macOS-safe) combined with write-file-atomic provides the required guarantee.

**Primary recommendation:** Build the storage layer as a well-typed TypeScript library with Zod schemas for all data structures. Use write-file-atomic + proper-lockfile for the counter. Use plain text stdout (not JSON hookSpecificOutput) for UserPromptSubmit injection to avoid known bugs. Structure the project as a plugin from the start using Claude Code's plugin system.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Scrub on write -- disk never contains plaintext secrets. Even if log files are copied/leaked, no sensitive data is exposed.
- **D-02:** Scrubbed content replaced with `[REDACTED:type]` markers (e.g., `[REDACTED:aws_key]`, `[REDACTED:bearer_token]`)
- **D-03:** Separate directories by log type: `logs/prompts/`, `logs/tools/`, `logs/permissions/`, `logs/sessions/`
- **D-04:** Each directory contains JSONL files with daily rotation (e.g., `2026-03-31.jsonl`)

### Claude's Discretion
- Secret scrubbing regex ruleset -- which patterns to cover (AWS keys, Bearer tokens, API keys, passwords, private keys, JWT, etc.) and false positive tolerance
- Log rotation size limits -- whether to split files beyond daily rotation
- Config schema design -- structure of config.json, what's configurable, defaults, validation approach
- Project scaffolding -- package structure, entry points for hooks vs CLI, src/ layout, test structure
- JSONL field schemas per log type -- exact fields for prompt entries, tool entries, permission entries

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAP-05 | Persist interaction logs to ~/.harness-evolve/logs/ as JSONL with daily rotation | JSONL append pattern with date-based filenames; native `fs.appendFile` for append, Zod schemas for entry validation |
| CAP-06 | Secret scrubbing -- strip API keys, tokens, passwords from captured prompts before writing to log | Regex-based scrubber with 15+ patterns covering AWS, GitHub, Google, generic keys, JWT, private keys, passwords; `[REDACTED:type]` replacement |
| CAP-07 | Atomic file writes to prevent corruption from concurrent Claude Code instances | write-file-atomic for atomic writes + proper-lockfile for cross-process counter locking |
| TRG-01 | File-based interaction counter per session, persisted in ~/.harness-evolve/counter.json | JSON counter file with lock-read-increment-write pattern; proper-lockfile for cross-process safety |
| ONB-01 | Zero-config installation -- works immediately with sensible defaults | Plugin manifest with auto-discovery; init-on-first-use pattern creates directory structure and default config.json |
| ONB-03 | Configurable thresholds via ~/.harness-evolve/config.json | Zod schema with `.default()` for all fields; config loader that merges user overrides with defaults |
</phase_requirements>

## Standard Stack

### Core (Locked -- from CLAUDE.md)
| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| Node.js | >=22.14.0 | Runtime | v22.14.0 installed |
| TypeScript | ~6.0 | Type safety | 6.0.2 on npm |
| Zod | ^4.3.6 | Schema validation for config, logs, hook input | 4.3.6 on npm |
| write-file-atomic | ^7.0.0 | Atomic file writes for counter and config | 7.0.1 on npm |
| tsup | ^8.5.1 | Bundle TS to JS for distribution | 8.5.1 on npm |
| tsx | ^4.x | Dev-time TS execution | 4.21.0 on npm |
| Vitest | ^4.1.2 | Unit and integration testing | 4.1.2 on npm |
| Commander.js | ^14.0.3 | CLI framework (Phase 1 minimal use) | 14.0.3 on npm |

### Supporting (New for Phase 1)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| proper-lockfile | ^4.1.2 | Cross-process file locking (mkdir-based, macOS-safe) | Counter increment: lock before read-modify-write |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| proper-lockfile | mkdir-based custom lock | proper-lockfile handles stale lock cleanup, retry logic, cross-platform -- no reason to hand-roll |
| write-file-atomic for logs | native fs.appendFile | Logs are append-only JSONL, append is atomic on POSIX for small writes (<4KB pipe buffer). write-file-atomic not needed for append. |
| Zod for config | Manual validation | Zod gives type inference + runtime validation in one schema. No reason to skip. |

**Installation:**
```bash
npm install zod write-file-atomic proper-lockfile
npm install -D typescript tsup tsx vitest @types/node
```

## Architecture Patterns

### Recommended Project Structure
```
harness-evolve/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest
├── hooks/
│   └── hooks.json            # Hook registration for Claude Code
├── scripts/                  # Compiled hook entry points (built by tsup)
├── src/
│   ├── index.ts              # Main library export
│   ├── schemas/              # Zod schemas
│   │   ├── config.ts         # Config schema with defaults
│   │   ├── log-entry.ts      # JSONL entry schemas per log type
│   │   ├── counter.ts        # Counter schema
│   │   └── hook-input.ts     # Claude Code hook input schemas
│   ├── storage/              # File I/O layer
│   │   ├── dirs.ts           # Directory structure init & paths
│   │   ├── logger.ts         # JSONL append with daily rotation
│   │   ├── counter.ts        # Atomic counter with locking
│   │   └── config.ts         # Config read/write with defaults
│   ├── scrubber/             # Secret scrubbing
│   │   ├── patterns.ts       # Regex pattern definitions
│   │   └── scrub.ts          # Scrub function (string -> scrubbed string)
│   └── hooks/                # Hook handler source (compiled to scripts/)
│       └── user-prompt-submit.ts  # Capture prompt + inject context
├── tests/
│   ├── unit/
│   │   ├── scrubber.test.ts
│   │   ├── counter.test.ts
│   │   ├── logger.test.ts
│   │   └── config.test.ts
│   └── integration/
│       └── concurrent-counter.test.ts
├── tsup.config.ts
├── vitest.config.ts
├── tsconfig.json
├── package.json
└── CLAUDE.md
```

### Pattern 1: Init-on-First-Use
**What:** Directory structure and default config are created lazily on first hook invocation, not during install.
**When to use:** Every storage operation should call `ensureInit()` first.
**Why:** Zero-config requirement (ONB-01) -- user installs plugin, it works immediately.
```typescript
// src/storage/dirs.ts
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const BASE_DIR = join(process.env.HOME ?? '', '.harness-evolve');

export const paths = {
  base: BASE_DIR,
  logs: {
    prompts: join(BASE_DIR, 'logs', 'prompts'),
    tools: join(BASE_DIR, 'logs', 'tools'),
    permissions: join(BASE_DIR, 'logs', 'permissions'),
    sessions: join(BASE_DIR, 'logs', 'sessions'),
  },
  analysis: join(BASE_DIR, 'analysis'),
  config: join(BASE_DIR, 'config.json'),
  counter: join(BASE_DIR, 'counter.json'),
} as const;

let initialized = false;

export async function ensureInit(): Promise<void> {
  if (initialized) return;
  await mkdir(paths.logs.prompts, { recursive: true });
  await mkdir(paths.logs.tools, { recursive: true });
  await mkdir(paths.logs.permissions, { recursive: true });
  await mkdir(paths.logs.sessions, { recursive: true });
  await mkdir(paths.analysis, { recursive: true });
  initialized = true;
}
```

### Pattern 2: Scrub-Before-Write Pipeline
**What:** Every log entry passes through the scrubber before touching disk.
**When to use:** All log append operations.
**Why:** D-01 decision -- disk never contains plaintext secrets.
```typescript
// Scrub pipeline: raw data -> validate schema -> scrub strings -> append JSONL
async function appendLogEntry(type: LogType, rawEntry: unknown): Promise<void> {
  const validated = logEntrySchema[type].parse(rawEntry);
  const scrubbed = scrubObject(validated);
  const line = JSON.stringify(scrubbed) + '\n';
  const filePath = getLogFilePath(type); // e.g., logs/prompts/2026-03-31.jsonl
  await appendFile(filePath, line, 'utf-8');
}
```

### Pattern 3: Lock-Read-Increment-Write Counter
**What:** Counter uses proper-lockfile for cross-process safety + write-file-atomic for crash safety.
**When to use:** Every counter increment.
**Why:** Success Criterion #3 -- two concurrent processes incrementing 100 times each must produce exactly 200.
```typescript
import { lock } from 'proper-lockfile';
import writeFileAtomic from 'write-file-atomic';

async function incrementCounter(sessionId: string): Promise<number> {
  const release = await lock(paths.counter, { retries: 5 });
  try {
    const data = await readCounter();
    data.total += 1;
    data.session[sessionId] = (data.session[sessionId] ?? 0) + 1;
    await writeFileAtomic(paths.counter, JSON.stringify(data, null, 2));
    return data.total;
  } finally {
    await release();
  }
}
```

### Pattern 4: Daily Rotation via Date-Based Filenames
**What:** Each log type directory contains files named `YYYY-MM-DD.jsonl`. New day = new file automatically.
**When to use:** All JSONL log writes.
**Why:** D-04 decision. Simple, no rotation daemon needed.
```typescript
function getLogFilePath(type: LogType): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return join(paths.logs[type], `${date}.jsonl`);
}
```

### Anti-Patterns to Avoid
- **Reading entire JSONL file into memory:** JSONL files grow unbounded within a day. Always use streaming (readline) for reads. Append-only for writes.
- **Using write-file-atomic for log appends:** Atomic writes replace the entire file. For append-only JSONL, use native `fs.appendFile` which is atomic for small writes on POSIX.
- **Putting the counter in memory:** Counter must survive process restarts. Always read from disk, increment, write back.
- **Skipping the lock for counter reads:** Even "just reading" the counter during a write cycle creates race conditions. Always lock for the full read-modify-write cycle.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-process file locking | mkdir-based lock with cleanup | proper-lockfile ^4.1.2 | Handles stale lock detection (mtime-based), retry with backoff, cleanup on crash. mkdir is atomic on all filesystems including macOS. |
| Atomic file replacement | temp-file-then-rename | write-file-atomic ^7.0.0 | Handles temp naming, concurrent write serialization within process, fsync. npm's own battle-tested package. |
| Secret pattern matching | Ad-hoc regex list | Curated pattern set (see scrubber section) | secrets-patterns-db has 1600+ patterns. We extract the top 15-20 most common for v1. |
| Config schema + defaults | Manual JSON parsing | Zod ^4.3.6 with `.default()` | Type inference + runtime validation + default values in one schema definition. |
| JSONL streaming reads | Manual line splitting | Node.js readline interface | Built-in, handles line buffering, backpressure, streaming. |

**Key insight:** The deceptively complex problems in this phase are (1) cross-process counter atomicity and (2) secret pattern coverage. Both have well-tested library solutions.

## Claude Code Hooks System -- Critical Research

### Hook Input Format (UserPromptSubmit)
When a UserPromptSubmit hook fires, Claude Code passes this JSON on stdin:
```json
{
  "session_id": "abc123",
  "transcript_path": "/home/user/.claude/projects/.../transcript.jsonl",
  "cwd": "/home/user/my-project",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "User's typed message"
}
```

### Stdout Injection -- Gray Area #1 Analysis

**Current documentation states:** For UserPromptSubmit, stdout from exit-0 hooks is added as context that Claude can see and act on. Two methods: (1) plain text stdout, (2) JSON with `hookSpecificOutput.additionalContext`.

**Known bugs (historical):**
- **v2.0.69 (Dec 2025, Issue #13912):** ANY stdout from UserPromptSubmit caused "UserPromptSubmit hook error". Closed as duplicate of #12151.
- **v2.1.4 (Jan 2026, Issue #17550):** JSON hookSpecificOutput caused error on FIRST message only. Plain text worked fine.

**Current state (v2.1.88):** Both issues are closed. The official docs (March 2026 edition) document stdout injection as working. However, no explicit "fixed in version X" confirmation found.

**Recommendation for Phase 1:**
1. **Use plain text stdout** (not JSON hookSpecificOutput) for injection -- this was the working path even during the buggy versions.
2. **Build a validation test** that verifies stdout injection works on the current Claude Code version.
3. **Design the injection to be gracefully degraded** -- if stdout injection fails, the system still works (data is captured, recommendations are written to file). The `/evolve` command becomes the primary delivery path.
4. **Document the test result** in VERIFICATION.md for Phase 5 to consume.

### Hook Configuration for Plugin
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/user-prompt-submit.js\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### Async Hooks for Non-Blocking Capture
For hooks that only need to log data (no stdout needed), use `"async": true` to avoid blocking:
```json
{
  "type": "command",
  "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/capture-tool.js\"",
  "async": true
}
```

### Performance Budget
| Hook | Target Latency | Strategy |
|------|---------------|----------|
| UserPromptSubmit (capture only) | <50ms | Read stdin, scrub, append to JSONL, increment counter, exit |
| UserPromptSubmit (with injection) | <100ms | Same as above + read pre-computed recommendations, write to stdout |

## Secret Scrubbing Patterns

### Recommended Pattern Set (Claude's Discretion)
Based on research from secrets-patterns-db (1600+ patterns) and common detection tools, the following 15 patterns provide high coverage with low false positive rate:

| Pattern Name | Regex | Redaction Marker |
|-------------|-------|-----------------|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | `[REDACTED:aws_key]` |
| AWS Secret Key | `(?:aws_secret_access_key\|AWS_SECRET_ACCESS_KEY)[\s=:]+[A-Za-z0-9/+=]{40}` | `[REDACTED:aws_secret]` |
| GitHub PAT | `gh[ps]_[A-Za-z0-9_]{36,}` | `[REDACTED:github_token]` |
| GitHub OAuth | `gho_[A-Za-z0-9_]{36,}` | `[REDACTED:github_oauth]` |
| Bearer Token | `[Bb]earer\s+[A-Za-z0-9\-._~+/]+=*` | `[REDACTED:bearer_token]` |
| JWT | `eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+` | `[REDACTED:jwt]` |
| Generic API Key | `(?:api[_-]?key\|apikey)[\s=:]+['"]?[A-Za-z0-9\-._]{20,}['"]?` | `[REDACTED:api_key]` |
| Generic Secret | `(?:secret\|SECRET)[\s=:]+['"]?[A-Za-z0-9\-._]{20,}['"]?` | `[REDACTED:secret]` |
| Private Key Block | `-----BEGIN (?:RSA\|EC\|OPENSSH\|DSA)? ?PRIVATE KEY-----` | `[REDACTED:private_key]` |
| Password Assignment | `(?:password\|passwd\|pwd)[\s=:]+['"]?[^\s'"]{8,}['"]?` | `[REDACTED:password]` |
| Slack Token | `xox[bpors]-[A-Za-z0-9-]{10,}` | `[REDACTED:slack_token]` |
| Google API Key | `AIza[0-9A-Za-z\-_]{35}` | `[REDACTED:google_api_key]` |
| Stripe Key | `[sr]k_(test\|live)_[A-Za-z0-9]{20,}` | `[REDACTED:stripe_key]` |
| Database URL | `(?:postgres\|mysql\|mongodb)://[^\s]+:[^\s]+@[^\s]+` | `[REDACTED:db_url]` |
| High Entropy (fallback) | Strings >20 chars with Shannon entropy >4.5 adjacent to key/token/secret keywords | `[REDACTED:high_entropy]` |

**False positive mitigation:**
- Only match patterns in string values, not in the regex patterns themselves
- AWS key pattern (`AKIA...`) has near-zero false positives due to fixed prefix
- Password pattern requires minimum 8 chars to avoid matching config keys
- High-entropy fallback is optional and disabled by default in config

### Scrubber Design
```typescript
// src/scrubber/scrub.ts
interface ScrubPattern {
  name: string;
  regex: RegExp;
  replacement: string;
}

const PATTERNS: ScrubPattern[] = [
  { name: 'aws_key', regex: /AKIA[0-9A-Z]{16}/g, replacement: '[REDACTED:aws_key]' },
  // ... all patterns
];

export function scrubString(input: string): string {
  let result = input;
  for (const pattern of PATTERNS) {
    result = result.replace(pattern.regex, pattern.replacement);
  }
  return result;
}

export function scrubObject<T>(obj: T): T {
  // Recursively walk object, scrub all string values
  // Preserves structure, only modifies string leaves
}
```

## Config Schema Design (Claude's Discretion)

### Recommended config.json Schema
```typescript
import { z } from 'zod/v4';

export const configSchema = z.object({
  version: z.number().default(1),
  analysis: z.object({
    threshold: z.number().min(1).default(50),
    enabled: z.boolean().default(true),
  }).default({}),
  hooks: z.object({
    capturePrompts: z.boolean().default(true),
    captureTools: z.boolean().default(true),
    capturePermissions: z.boolean().default(true),
    captureSessions: z.boolean().default(true),
  }).default({}),
  scrubbing: z.object({
    enabled: z.boolean().default(true),
    highEntropyDetection: z.boolean().default(false),
    customPatterns: z.array(z.object({
      name: z.string(),
      regex: z.string(),
      replacement: z.string(),
    })).default([]),
  }).default({}),
  delivery: z.object({
    stdoutInjection: z.boolean().default(true),
    maxTokens: z.number().default(200),
  }).default({}),
}).strict();

export type Config = z.infer<typeof configSchema>;
```

**Key design choices:**
- All fields have defaults -- `configSchema.parse({})` produces a fully populated config
- `.strict()` rejects unknown keys -- catches typos early
- Nested objects use `.default({})` so partial configs work
- `version` field for future schema migrations
- `customPatterns` allows user-defined scrubbing rules (ONB-03)

### Config Loader Pattern
```typescript
export async function loadConfig(): Promise<Config> {
  try {
    const raw = await readFile(paths.config, 'utf-8');
    return configSchema.parse(JSON.parse(raw));
  } catch {
    // File doesn't exist or invalid -- use defaults
    const defaults = configSchema.parse({});
    await writeFileAtomic(paths.config, JSON.stringify(defaults, null, 2));
    return defaults;
  }
}
```

## JSONL Log Entry Schemas (Claude's Discretion)

### Prompt Entry (logs/prompts/)
```typescript
export const promptEntrySchema = z.object({
  timestamp: z.string().datetime(),
  session_id: z.string(),
  cwd: z.string(),
  prompt: z.string(),
  prompt_length: z.number(),
});
```

### Tool Entry (logs/tools/) -- designed for Phase 2
```typescript
export const toolEntrySchema = z.object({
  timestamp: z.string().datetime(),
  session_id: z.string(),
  event: z.enum(['pre', 'post', 'failure']),
  tool_name: z.string(),
  input_summary: z.string().optional(),
  duration_ms: z.number().optional(),
  success: z.boolean().optional(),
});
```

### Permission Entry (logs/permissions/) -- designed for Phase 2
```typescript
export const permissionEntrySchema = z.object({
  timestamp: z.string().datetime(),
  session_id: z.string(),
  tool_name: z.string(),
  decision: z.enum(['approved', 'denied', 'unknown']),
});
```

### Session Entry (logs/sessions/)
```typescript
export const sessionEntrySchema = z.object({
  timestamp: z.string().datetime(),
  session_id: z.string(),
  event: z.enum(['start', 'end']),
  cwd: z.string().optional(),
});
```

### Counter Schema
```typescript
export const counterSchema = z.object({
  total: z.number().default(0),
  session: z.record(z.string(), z.number()).default({}),
  last_analysis: z.string().datetime().optional(),
  last_updated: z.string().datetime(),
});
```

## Common Pitfalls

### Pitfall 1: write-file-atomic Does Not Solve Cross-Process Races
**What goes wrong:** Developer assumes write-file-atomic handles concurrent access from multiple Claude Code instances. It does not -- it only serializes writes within a single Node.js process.
**Why it happens:** The npm README says "multiple concurrent writes are serialized" but this means concurrent calls within the same event loop, not across OS processes.
**How to avoid:** Use proper-lockfile for the lock, write-file-atomic for the atomic replacement inside the lock.
**Warning signs:** Counter value is less than expected after concurrent test.

### Pitfall 2: Shell Profile Pollution Breaking Hook JSON
**What goes wrong:** Hook stdout contains shell profile output (e.g., "Welcome to zsh") prepended to JSON, causing parse failures.
**Why it happens:** Claude Code spawns hooks in a shell that sources the user's profile.
**How to avoid:** Use `node` directly (not bash wrapper) for hook commands. If bash is needed, add `#!/bin/bash` shebang and ensure no unconditional echo in profile.
**Warning signs:** "UserPromptSubmit hook error" or "JSON parse error" in Claude Code transcript.

### Pitfall 3: POSIX Append Atomicity Limits
**What goes wrong:** JSONL log entries get interleaved when two hooks append to the same file simultaneously.
**Why it happens:** POSIX guarantees atomic append only for writes <= PIPE_BUF (4KB on macOS/Linux). Larger log entries may interleave.
**How to avoid:** Keep individual JSONL entries under 4KB (they should be -- prompts are captured, not full transcripts). Monitor entry size in validation.
**Warning signs:** Invalid JSON lines when parsing JSONL files.

### Pitfall 4: macOS Missing flock
**What goes wrong:** Using `flock` for file locking fails on macOS because it's a Linux-specific utility.
**Why it happens:** macOS uses a different locking mechanism.
**How to avoid:** Use proper-lockfile which uses mkdir-based locking (atomic on all filesystems).
**Warning signs:** "flock: command not found" or ENOSYS errors.

### Pitfall 5: Forgetting to Create Parent Directories
**What goes wrong:** First log write fails because `~/.harness-evolve/logs/prompts/` doesn't exist yet.
**Why it happens:** The init-on-first-use pattern wasn't called before the write.
**How to avoid:** Always call `ensureInit()` at the top of every storage operation. Use `{ recursive: true }` in mkdir.
**Warning signs:** ENOENT errors on first run.

### Pitfall 6: UserPromptSubmit Hook Blocking User Experience
**What goes wrong:** Hook takes too long, user experiences delay between typing and Claude processing.
**Why it happens:** Hook does synchronous analysis or network calls before exiting.
**How to avoid:** Capture hooks must be fast (<50ms). Only append to file and increment counter. No analysis during capture. Use `async: true` for non-stdout hooks.
**Warning signs:** Noticeable delay after pressing Enter.

## Code Examples

### tsup Configuration for Hook Entry Points
```typescript
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'hooks/user-prompt-submit': 'src/hooks/user-prompt-submit.ts',
    'index': 'src/index.ts',
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

### Vitest Configuration
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
    },
  },
});
```

### Hook Entry Point Pattern
```typescript
// src/hooks/user-prompt-submit.ts
import { ensureInit } from '../storage/dirs.js';
import { appendPromptEntry } from '../storage/logger.js';
import { incrementCounter } from '../storage/counter.js';
import { loadConfig } from '../storage/config.js';

async function main(): Promise<void> {
  await ensureInit();

  // Read hook input from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  const input = JSON.parse(Buffer.concat(chunks).toString('utf-8'));

  const config = await loadConfig();

  // Capture prompt
  if (config.hooks.capturePrompts) {
    await appendPromptEntry({
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      cwd: input.cwd,
      prompt: input.prompt,
      prompt_length: input.prompt.length,
    });
  }

  // Increment counter
  const count = await incrementCounter(input.session_id);

  // Inject context if threshold reached (Phase 5 will expand this)
  if (count > 0 && count % config.analysis.threshold === 0) {
    // Plain text stdout -- safest injection method
    process.stdout.write(
      `[harness-evolve] ${count} interactions recorded. ` +
      `Run /evolve to see recommendations.\n`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`harness-evolve error: ${err.message}\n`);
  process.exit(1); // Non-blocking error -- Claude Code continues
});
```

### Concurrent Counter Test
```typescript
// tests/integration/concurrent-counter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { fork } from 'node:child_process';

describe('concurrent counter', () => {
  it('two processes incrementing 100 times each produce 200', async () => {
    // Spawn two child processes that each increment 100 times
    const results = await Promise.all([
      runIncrementWorker(100),
      runIncrementWorker(100),
    ]);

    // Read final counter value
    const counter = await readCounter();
    expect(counter.total).toBe(200);
  });
});
```

## Plugin Structure

### Plugin Manifest
```json
{
  "name": "harness-evolve",
  "version": "0.1.0",
  "description": "Self-iteration engine for Claude Code -- detects patterns and suggests harness optimizations",
  "author": {
    "name": "r1ckyIn",
    "email": "rickyqin919@gmail.com",
    "url": "https://github.com/r1ckyIn"
  },
  "repository": "https://github.com/r1ckyIn/harness-evolve",
  "license": "MIT",
  "keywords": ["claude-code", "hooks", "optimization", "self-improving"]
}
```

### Plugin Environment Variables
- `${CLAUDE_PLUGIN_ROOT}` -- absolute path to plugin installation directory (changes on update)
- `${CLAUDE_PLUGIN_DATA}` -- persistent data directory at `~/.claude/plugins/data/harness-evolve/` (survives updates)

**Important:** For harness-evolve, user data lives at `~/.harness-evolve/` (our own directory), NOT in `${CLAUDE_PLUGIN_DATA}`. This is intentional -- the data should be accessible even if the plugin is uninstalled and reinstalled. `${CLAUDE_PLUGIN_DATA}` is for plugin cache/dependencies only.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| UserPromptSubmit JSON hookSpecificOutput | Plain text stdout preferred | v2.1.x (Jan 2026) | JSON hookSpecificOutput had first-message bug. Plain text is more reliable. |
| flock for file locking | mkdir-based locking (proper-lockfile) | Always on macOS | macOS doesn't have flock. mkdir is POSIX-atomic. |
| Zod v3 | Zod v4 (14x faster, 57% smaller) | 2026 | Use `z.object().default({})` for nested defaults |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.14.0 | -- |
| npm | Package management | Yes | (bundled with Node) | -- |
| Claude Code | Hook system | Yes | v2.1.88 | -- |
| jq | Hook input parsing (optional) | Likely | -- | Not needed -- hooks use Node.js, not bash |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (Wave 0) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAP-05 | JSONL log persistence with daily rotation | unit | `npx vitest run tests/unit/logger.test.ts -t "append"` | Wave 0 |
| CAP-06 | Secret scrubbing strips known patterns | unit | `npx vitest run tests/unit/scrubber.test.ts` | Wave 0 |
| CAP-07 | Atomic writes prevent corruption | integration | `npx vitest run tests/integration/concurrent-counter.test.ts` | Wave 0 |
| TRG-01 | Counter persists across sessions | unit | `npx vitest run tests/unit/counter.test.ts` | Wave 0 |
| ONB-01 | Zero-config installation creates defaults | unit | `npx vitest run tests/unit/config.test.ts -t "defaults"` | Wave 0 |
| ONB-03 | Config overrides merge with defaults | unit | `npx vitest run tests/unit/config.test.ts -t "overrides"` | Wave 0 |
| Gray#1 | UserPromptSubmit stdout injection | manual + smoke | Manual: verify in Claude Code session | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- Vitest configuration for Node.js
- [ ] `tsconfig.json` -- TypeScript configuration
- [ ] `package.json` -- project setup with dependencies
- [ ] `tsup.config.ts` -- build configuration
- [ ] `tests/unit/scrubber.test.ts` -- covers CAP-06
- [ ] `tests/unit/logger.test.ts` -- covers CAP-05
- [ ] `tests/unit/counter.test.ts` -- covers TRG-01
- [ ] `tests/unit/config.test.ts` -- covers ONB-01, ONB-03
- [ ] `tests/integration/concurrent-counter.test.ts` -- covers CAP-07

## Open Questions

1. **UserPromptSubmit stdout reliability on v2.1.88**
   - What we know: Bugs existed in v2.0.69 and v2.1.4. Both issues are closed. Plain text stdout was the working workaround. Official docs say it works.
   - What's unclear: Whether the JSON hookSpecificOutput path is fully fixed in v2.1.88.
   - Recommendation: Use plain text stdout. Include a manual smoke test in Phase 1 to validate. Document result for Phase 5.

2. **Counter file vs counter per-session**
   - What we know: TRG-01 says "per session" but counter must survive restarts. The counter.json stores both total and per-session counts.
   - What's unclear: Whether "per session" means reset per session or accumulate per session.
   - Recommendation: Store both -- total count (never resets) and session map (count per session_id). Phase 4's threshold trigger uses total count.

3. **Log rotation size limits**
   - What we know: Daily rotation is decided (D-04). A busy day could produce large files.
   - What's unclear: Whether to add size-based splitting within a day.
   - Recommendation: Skip for v1. Daily rotation is sufficient. A full day of prompts is unlikely to exceed practical limits. Add size-based splitting in v2 if needed.

## Project Constraints (from CLAUDE.md)

- **Code comments:** Must be in pure English (no Chinese, no bilingual)
- **Commit messages:** Follow conventional commits format, GSD format for phases: `<type>(<phase>-<plan>): <description>`
- **No Co-Authored-By:** Hook blocks it
- **Use /commit skill** for git commits
- **Branch strategy:** Feature branches per phase (GSD integration rules)
- **TDD:** Default `tdd="true"` for business logic tasks
- **Verification loop:** Build -> Test -> Lint -> TypeCheck after every change
- **Performance budget:** UserPromptSubmit capture <50ms, injection <100ms

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Complete hook event list, JSON schemas, decision control, environment variables
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) -- Practical examples, stdout injection behavior, troubleshooting
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference) -- Plugin manifest schema, CLAUDE_PLUGIN_ROOT/DATA, hooks.json structure
- [Claude Code Settings](https://code.claude.com/docs/en/settings) -- Settings hierarchy, configuration scopes
- [write-file-atomic GitHub](https://github.com/npm/write-file-atomic) -- API, atomic write strategy (temp+rename), intra-process serialization
- [Zod v4 Documentation](https://zod.dev/) -- Schema definition, `.default()`, `.strict()`, type inference

### Secondary (MEDIUM confidence)
- [GitHub Issue #13912](https://github.com/anthropics/claude-code/issues/13912) -- UserPromptSubmit stdout error in v2.0.69 (CLOSED, dup of #12151)
- [GitHub Issue #17550](https://github.com/anthropics/claude-code/issues/17550) -- hookSpecificOutput first-message bug in v2.1.4 (CLOSED, inactive)
- [proper-lockfile npm](https://www.npmjs.com/package/proper-lockfile) -- mkdir-based cross-process locking, stale detection
- [secrets-patterns-db](https://github.com/mazen160/secrets-patterns-db) -- 1600+ secret detection regex patterns (CC-BY-SA-4.0)
- [secret-regex-list](https://github.com/h33tlit/secret-regex-list) -- Curated regex patterns for API keys and secrets

### Tertiary (LOW confidence)
- UserPromptSubmit fix status on v2.1.88 -- no explicit "fixed in" changelog entry found; confidence based on closed issues + updated docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry, locked in CLAUDE.md
- Architecture: HIGH -- patterns are standard Node.js file I/O, well-understood domain
- Hooks system: HIGH -- official documentation fetched and cross-referenced with GitHub issues
- Secret scrubbing: MEDIUM -- pattern set is researched but coverage should be validated empirically
- UserPromptSubmit injection: MEDIUM -- documented as working but historical bugs warrant caution
- Pitfalls: HIGH -- based on official troubleshooting docs + known GitHub issues

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable domain, 30-day validity)
