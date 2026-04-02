# Phase 3: Pre-Processing & Environment Discovery - Research

**Researched:** 2026-04-01
**Domain:** JSONL log aggregation, cross-session pattern compression, Claude Code environment scanning
**Confidence:** HIGH

## Summary

Phase 3 transforms raw JSONL logs (produced by Phase 1-2) into compressed pattern summaries that fit in an agent's context window, and maps the user's installed Claude Code tools into an environment snapshot. This is the bridge between "data collection" (Phase 2 complete) and "intelligent analysis" (Phase 4). Without this phase, the Phase 4 analysis agent would receive raw logs (potentially 3000+ lines for 30 days at 100 interactions/day), overwhelming its context window and producing poor results.

The existing codebase provides a solid foundation: Zod v4 schemas for all log entry types (`promptEntrySchema`, `toolEntrySchema`, `permissionEntrySchema`, `sessionEntrySchema`), JSONL append-only logging with daily rotation (`logger.ts`), atomic counter with cross-process locking (`counter.ts`), and a well-defined directory structure (`dirs.ts`). Phase 3 builds three new modules on top: (1) a JSONL reader that streams and parses log files across date ranges, (2) a pre-processor that computes frequency maps and top-N extractions from parsed logs, and (3) an environment scanner that discovers installed tools by reading `settings.json`, `.claude/` directories, and plugin metadata.

**Primary recommendation:** Implement the pre-processor as a pure TypeScript module using `node:readline` for streaming JSONL reads, `Map<string, number>` for frequency counting, and Zod schemas for output validation. Keep it under the 5-second performance budget for the Stop hook. The environment scanner reads filesystem paths and JSON files -- no network calls, no CLI invocations (except `claude --version` once for ONB-04), just `fs.readdir` and `JSON.parse`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANL-01 | Shell pre-processing layer extracts frequency counts, top-N patterns, and statistical summaries from raw logs before agent analysis | JSONL reader + pre-processor module using Map-based frequency counting, top-N extraction via sort+slice. Architecture research confirms this is the established pattern (Component 5 in ARCHITECTURE.md) |
| ANL-08 | Cross-session pattern aggregation -- analyze accumulated data across sessions, not just current session | JSONL reader reads ALL daily log files in a date range (default 30 days). Frequency maps merge automatically -- a prompt in session A and session B becomes one entry with combined count. Session-awareness via `session_id` field already in every log entry |
| RTG-08 | Dynamic environment discovery -- scan settings.json, .claude/ directory, plugin SKILL.md metadata to detect installed tools | Environment scanner module reads 4 settings scopes, plugin cache directories, skills/, rules/, hooks/ at user+project levels. Real-world verification on user's machine confirms the directory structures |
| ONB-04 | Claude Code version change detection -- notify user and suggest reviewing changelog for new capabilities | `claude --version` outputs "X.Y.Z (Claude Code)" format. Parse with regex, compare against known compatible range, store in environment snapshot. Verified on user's machine: "2.1.87 (Claude Code)" |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Code comments**: Pure English only, no bilingual, no Chinese
- **Technical discussion**: Chinese preferred for communication
- **GSD workflow**: All edits through GSD commands
- **Testing**: Vitest 4.x, TDD where applicable
- **Build**: tsup 8.x to ESM, target node22
- **Validation**: Zod v4 (import from 'zod/v4')
- **Persistence**: File-based only, no databases, no daemons
- **Atomic writes**: write-file-atomic + proper-lockfile for shared files
- **Performance**: Stop hook analysis must complete in <5s
- **Commit messages**: GSD format `type(phase-plan): description`
- **No Co-Authored-By** in commits (hook enforced)

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:readline` | (built-in) | Stream JSONL files line-by-line | Zero dependency, streaming memory efficiency, already used pattern in stack research |
| `node:fs/promises` | (built-in) | Read directories, files, check existence | Already used throughout codebase |
| `node:child_process` | (built-in) | Run `claude --version` for ONB-04 | One-time sync call during environment scan |
| Zod v4 | ^4.3.6 | Validate pre-processor output schemas, environment snapshot schemas | Established pattern from Phase 1-2 |
| write-file-atomic | ^7.0.0 | Write summary.json and environment-snapshot.json atomically | Established pattern from Phase 1 |

### Supporting (Already Installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| proper-lockfile | ^4.1.2 | Lock counter file during threshold check + reset | Already used in counter.ts |
| tsx | ^4.21.0 | Dev-time execution of pre-processor scripts | Development only |

### No New Dependencies Required

Phase 3 requires zero new npm packages. All functionality is achievable with Node.js built-ins + existing project dependencies. This is by design -- the pre-processor is a data transformation layer, not a new capability.

## Architecture Patterns

### Recommended Project Structure (New Files)

```
src/
  analysis/                     # NEW: Phase 3 modules
    jsonl-reader.ts             # Stream-read and parse JSONL files across date ranges
    pre-processor.ts            # Frequency counting, top-N extraction, summary generation
    environment-scanner.ts      # Discover installed tools, plugins, settings
    schemas.ts                  # Zod schemas for summary.json and environment-snapshot.json
  schemas/
    (existing log-entry.ts, config.ts, counter.ts, hook-input.ts)
  storage/
    dirs.ts                     # MODIFY: add paths for analysis output subdirs
tests/
  unit/
    analysis/
      jsonl-reader.test.ts
      pre-processor.test.ts
      environment-scanner.test.ts
  integration/
    pre-processor-pipeline.test.ts
```

### Pattern 1: Streaming JSONL Reader

**What:** Read multiple JSONL files across date partitions, parse each line, yield validated entries.
**When to use:** Whenever reading accumulated log data (pre-processor, future analysis phases).
**Why this way:** Memory-efficient for large date ranges. A 30-day window with 100 interactions/day = ~3000 lines. While this fits in memory, streaming is future-proof and matches the Node.js readline pattern already chosen in STACK.md.

```typescript
// Source: Node.js readline documentation + codebase pattern
import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import { z } from 'zod/v4';

/**
 * Read all JSONL entries from a log directory within a date range.
 * Files are named YYYY-MM-DD.jsonl (daily rotation from logger.ts).
 * Invalid lines are silently skipped (defensive against corruption).
 */
export async function readLogEntries<T>(
  logDir: string,
  schema: z.ZodType<T>,
  options?: { since?: Date; until?: Date },
): Promise<T[]> {
  const files = await readdir(logDir);
  const jsonlFiles = files
    .filter(f => f.endsWith('.jsonl'))
    .filter(f => {
      const date = f.replace('.jsonl', '');
      if (options?.since && date < formatDate(options.since)) return false;
      if (options?.until && date > formatDate(options.until)) return false;
      return true;
    })
    .sort(); // Chronological order

  const entries: T[] = [];
  for (const file of jsonlFiles) {
    const rl = createInterface({
      input: createReadStream(join(logDir, file)),
      crlfDelay: Infinity,
    });
    for await (const line of rl) {
      try {
        const parsed = schema.parse(JSON.parse(line));
        entries.push(parsed);
      } catch {
        // Skip malformed lines -- defensive against Pitfall 2 (corruption)
      }
    }
  }
  return entries;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
```

### Pattern 2: Map-Based Frequency Counting with Cross-Session Tracking

**What:** Use `Map<string, { count: number; sessions: Set<string> }>` for frequency counting that tracks BOTH total count and unique session count.
**When to use:** Counting repeated prompts, tool usage, permission patterns.
**Why this way:** Simple, fast, zero-dependency. A Map handles 10K+ unique keys. The sessions Set enables ANL-08 (cross-session aggregation) -- "7 total across 4 sessions" is more informative than just "7 total".

```typescript
// Frequency counting with session tracking
function countWithSessions(
  items: Array<{ key: string; session: string }>,
): Map<string, { count: number; sessions: Set<string> }> {
  const map = new Map<string, { count: number; sessions: Set<string> }>();
  for (const { key, session } of items) {
    const entry = map.get(key) ?? { count: 0, sessions: new Set() };
    entry.count++;
    entry.sessions.add(session);
    map.set(key, entry);
  }
  return map;
}

// Top-N extraction from frequency map
function topN<V extends { count: number }>(
  counts: Map<string, V>,
  n: number,
): Array<[string, V]> {
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, n);
}

// Prompt normalization -- match near-duplicates
function normalizePrompt(prompt: string): string {
  return prompt
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');  // Collapse whitespace
}
```

### Pattern 3: Environment Discovery via Filesystem Scan

**What:** Read settings.json files at all 3 user-accessible scopes, scan `.claude/` directories, and enumerate plugin capabilities from the plugin cache.
**When to use:** Building the environment-snapshot.json that tells the analysis engine what tools exist.
**Why this way:** Pure filesystem reads -- no CLI invocations (except `claude --version` once), no network calls. Safe, fast, deterministic. Treats results as hints (Pitfall 13: discovery fragility).

**Verified scan targets (from real user machine):**

| Target | Path | What to Extract |
|--------|------|----------------|
| User settings | `~/.claude/settings.json` | hooks, enabledPlugins, permissions.allow |
| Project settings | `.claude/settings.json` | hooks, enabledPlugins |
| Local settings | `.claude/settings.local.json` | hooks overrides |
| Installed plugins | `~/.claude/plugins/installed_plugins.json` | Plugin names, scopes, install paths |
| Plugin cache | `~/.claude/plugins/cache/{marketplace}/{plugin}/{version}/` | commands/, skills/, hooks/, agents/ subdirs |
| User skills | `~/.claude/skills/` | Skill directory names |
| Project skills | `.claude/skills/` or `{repo}/.claude/skills/` | Skill directory names |
| Project rules | `.claude/rules/` or `{repo}/.claude/rules/` | Rule directory names |
| Project hooks | `.claude/hooks/` or `{repo}/.claude/hooks/` | Hook script names |
| CLAUDE.md | `./CLAUDE.md`, `./.claude/CLAUDE.md`, `~/.claude/CLAUDE.md` | Existence check |
| GSD artifacts | `.planning/` | Existence check for GSD ecosystem |

### Pattern 4: Summary Output Schema with Size Budget

**What:** Zod schema for summary.json enforcing structure; runtime validation of size (<50KB).
**When to use:** Output of pre-processor.

```typescript
import { z } from 'zod/v4';

export const summarySchema = z.object({
  generated_at: z.iso.datetime(),
  period: z.object({
    since: z.string(), // YYYY-MM-DD
    until: z.string(), // YYYY-MM-DD
    days: z.number(),
  }),
  stats: z.object({
    total_prompts: z.number(),
    total_tool_uses: z.number(),
    total_permissions: z.number(),
    unique_sessions: z.number(),
  }),
  top_repeated_prompts: z.array(z.object({
    prompt: z.string(),  // Normalized, truncated to 100 chars
    count: z.number(),
    sessions: z.number(), // Cross-session count for ANL-08
  })).max(20),
  tool_frequency: z.array(z.object({
    tool_name: z.string(),
    count: z.number(),
    avg_duration_ms: z.number().optional(),
  })),
  permission_patterns: z.array(z.object({
    tool_name: z.string(),
    count: z.number(),
    sessions: z.number(),
  })),
  long_prompts: z.array(z.object({
    prompt_preview: z.string(), // First 100 chars
    length: z.number(),
    count: z.number(),
  })).max(10),
});
export type Summary = z.infer<typeof summarySchema>;

export const environmentSnapshotSchema = z.object({
  generated_at: z.iso.datetime(),
  claude_code: z.object({
    version: z.string(),
    version_known: z.boolean(),
    compatible: z.boolean(),
  }),
  settings: z.object({
    user: z.unknown().nullable(),
    project: z.unknown().nullable(),
    local: z.unknown().nullable(),
  }),
  installed_tools: z.object({
    plugins: z.array(z.object({
      name: z.string(),
      marketplace: z.string(),
      enabled: z.boolean(),
      scope: z.string(),
      capabilities: z.array(z.string()), // ["commands", "skills", "hooks", "agents"]
    })),
    skills: z.array(z.object({
      name: z.string(),
      scope: z.enum(['user', 'project']),
    })),
    rules: z.array(z.object({
      name: z.string(),
      scope: z.enum(['user', 'project']),
    })),
    hooks: z.array(z.object({
      event: z.string(),
      scope: z.enum(['user', 'project', 'local']),
      type: z.string(), // "command" | "agent"
    })),
    claude_md: z.array(z.object({
      path: z.string(),
      exists: z.boolean(),
    })),
  }),
  detected_ecosystems: z.array(z.string()), // e.g., ["gsd", "custom-hooks"]
});
export type EnvironmentSnapshot = z.infer<typeof environmentSnapshotSchema>;
```

### Anti-Patterns to Avoid

- **Loading all files into memory at once:** Use streaming readline for JSONL, not `readFileSync` + `split('\n')`. Streaming is future-proof for large accumulations.
- **Exact string matching only for prompts:** Normalize before counting (lowercase, trim, collapse whitespace). Catches near-duplicates without NLP complexity.
- **Scanning network resources in environment discovery:** Environment scanner must be 100% filesystem-based (except `claude --version`). No `npm list -g`, no `claude plugin list`, no HTTP calls. These are slow and may not be available.
- **Storing original prompts in summary:** The summary should contain normalized/truncated prompts only. Original prompts may contain secrets that survived scrubbing.
- **Coupling pre-processor to analysis agent format:** summary.json should be a general-purpose statistical summary. Phase 4 consumes it however it wants.
- **Pretty-printing summary.json:** Compact JSON keeps file size under the 50KB budget.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONL parsing | Custom line splitter | `node:readline` with `createInterface()` | Handles edge cases (partial lines, backpressure, encoding) |
| Atomic JSON writes | `writeFileSync` + hope | `write-file-atomic` | Already in project deps, prevents corruption |
| Date range filtering | Manual date arithmetic | ISO string comparison on YYYY-MM-DD | ISO date strings sort lexicographically -- simple string compare works |
| Semver comparison | Full semver library | Split on `.` + numeric compare | Good enough for "X.Y.Z" format; no need for a library for one comparison |
| Plugin cache enumeration | Recursive directory walk | `readdir` on known paths | Plugin cache structure is flat: `cache/{marketplace}/{plugin}/{version}/` |

**Key insight:** Phase 3 is a data transformation phase. The complexity is in correct aggregation logic and defensive parsing, not in sophisticated algorithms. Keep it simple.

## Common Pitfalls

### Pitfall 1: Cross-Session Aggregation Miscount

**What goes wrong:** Prompts counted per-file (daily) miss cross-day duplicates. A prompt used 3 times on Monday and 4 times on Tuesday should show 7 total, but if counted per-file first, the top-N list may miss it.
**Why it happens:** Daily log file partitioning is great for retention but creates an aggregation boundary.
**How to avoid:** Read ALL entries from ALL files in the date range into a single frequency map BEFORE extracting top-N. Do not pre-aggregate per file.
**Warning signs:** Top-N counts seem low relative to total interaction count.

### Pitfall 2: Malformed JSONL Lines Crash the Pipeline

**What goes wrong:** A single corrupted line (from concurrent write race -- Pitfall 2 in PITFALLS.md) causes `JSON.parse()` to throw, aborting the entire pre-processing pipeline.
**Why it happens:** JSONL append operations can be interrupted by process termination, leaving partial lines.
**How to avoid:** Wrap every `JSON.parse()` in try-catch. Skip malformed lines silently (log a counter of skipped lines for diagnostics).
**Warning signs:** Pre-processor throws "Unexpected token in JSON" errors.

### Pitfall 3: Environment Scanner Reads Stale Plugin Data

**What goes wrong:** The `installed_plugins.json` file and plugin cache directories may be stale -- plugins updated but cache not refreshed, or plugins uninstalled but directories remain.
**Why it happens:** Known Claude Code bug (Issues #38271, #36317) -- plugin refresh doesn't always clean up.
**How to avoid:** Cross-reference `enabledPlugins` in settings.json (what SHOULD be active) with `installed_plugins.json` (what IS installed). Only report plugins that appear in BOTH. Mark confidence as "detected" not "confirmed".
**Warning signs:** Environment snapshot reports plugins the user has uninstalled.

### Pitfall 4: Summary Size Exceeds 50KB Budget

**What goes wrong:** Long prompts, many unique tool names, or verbose JSON push summary.json beyond the 50KB limit.
**Why it happens:** Prompts can be 10K+ characters. If top-20 prompts are each 500 chars, that's 10KB just for prompts.
**How to avoid:** Truncate prompt text to first 100 characters in the summary. Use compact JSON (no pretty-printing). Validate file size after generation and trim if needed.
**Warning signs:** summary.json file size exceeds 40KB.

### Pitfall 5: Claude Code Version Format Changes

**What goes wrong:** `claude --version` output format changes between versions, breaking the version parser.
**Why it happens:** Claude Code updates frequently. No guarantee the output format is stable.
**How to avoid:** Use a lenient regex that extracts version numbers. Fall back gracefully if parsing fails -- return "unknown" rather than crashing. Use `execFileSync('claude', ['--version'])` (not `execSync`) to avoid shell injection.
**Warning signs:** Environment snapshot shows `version: "unknown"` after an update.

### Pitfall 6: Permission Decisions Are Always "unknown"

**What goes wrong:** The existing `permission-request.ts` hook records `decision: 'unknown'` because the PermissionRequest hook fires BEFORE the user decides.
**Why it happens:** Architectural limitation documented in STATE.md.
**How to avoid:** Count permission REQUEST frequency by tool_name (how often a tool triggers a permission prompt), not approval/denial rates. This is still a strong signal: if `Bash(npm test)` triggers 47 permission prompts, that's a clear candidate for `allowedTools`.
**Warning signs:** All permission entries have `decision: 'unknown'`.

## Code Examples

### Example 1: Pre-Processor Entry Point

```typescript
// Source: Codebase analysis + ARCHITECTURE.md Component 5
import { paths } from '../storage/dirs.js';
import { promptEntrySchema, toolEntrySchema, permissionEntrySchema } from '../schemas/log-entry.js';
import { readLogEntries } from './jsonl-reader.js';
import type { Summary } from './schemas.js';

const PROMPT_TRUNCATE_LEN = 100;
const LONG_PROMPT_THRESHOLD = 200;

export async function preProcess(options?: {
  since?: Date;
  until?: Date;
  topN?: number;
}): Promise<Summary> {
  const topN = options?.topN ?? 20;
  const until = options?.until ?? new Date();
  const since = options?.since ?? new Date(until.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Read all entries across date range (ANL-08: cross-session)
  const prompts = await readLogEntries(paths.logs.prompts, promptEntrySchema, { since, until });
  const tools = await readLogEntries(paths.logs.tools, toolEntrySchema, { since, until });
  const permissions = await readLogEntries(paths.logs.permissions, permissionEntrySchema, { since, until });

  // 2. Unique sessions
  const allSessions = new Set<string>();
  for (const p of prompts) allSessions.add(p.session_id);
  for (const t of tools) allSessions.add(t.session_id);
  for (const p of permissions) allSessions.add(p.session_id);

  // 3. Prompt frequency (normalized, cross-session)
  const promptFreq = countWithSessions(
    prompts.map(p => ({ key: normalizePrompt(p.prompt), session: p.session_id }))
  );
  const topPrompts = extractTopN(promptFreq, topN, PROMPT_TRUNCATE_LEN);

  // 4. Tool frequency with avg duration
  const toolFreq = computeToolFrequency(tools);

  // 5. Permission request frequency
  const permFreq = countWithSessions(
    permissions.map(p => ({ key: p.tool_name, session: p.session_id }))
  );

  // 6. Long prompts (skill candidates)
  const longPrompts = detectLongPrompts(prompts, LONG_PROMPT_THRESHOLD);

  return {
    generated_at: new Date().toISOString(),
    period: {
      since: formatDate(since),
      until: formatDate(until),
      days: Math.ceil((until.getTime() - since.getTime()) / (24 * 60 * 60 * 1000)),
    },
    stats: {
      total_prompts: prompts.length,
      total_tool_uses: tools.length,
      total_permissions: permissions.length,
      unique_sessions: allSessions.size,
    },
    top_repeated_prompts: topPrompts,
    tool_frequency: toolFreq,
    permission_patterns: extractTopN(permFreq, topN, 200),
    long_prompts: longPrompts,
  };
}
```

### Example 2: Environment Scanner

```typescript
// Source: Verified on user machine -- real directory structures
import { readdir, readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { EnvironmentSnapshot } from './schemas.js';

const KNOWN_COMPATIBLE = { min: '2.1.0', max: '2.1.99' };

export async function scanEnvironment(cwd: string): Promise<EnvironmentSnapshot> {
  const home = process.env.HOME ?? '';

  const [claudeVersion, userSettings, projectSettings, localSettings, plugins, skills, rules, hooks, claudeMds, ecosystems] =
    await Promise.all([
      detectClaudeCodeVersion(),
      readSettingsSafe(join(home, '.claude', 'settings.json')),
      readSettingsSafe(join(cwd, '.claude', 'settings.json')),
      readSettingsSafe(join(cwd, '.claude', 'settings.local.json')),
      discoverPlugins(home),
      discoverSkills(home, cwd),
      discoverRules(cwd),
      discoverHooks(home, cwd),
      discoverClaudeMd(home, cwd),
      detectEcosystems(cwd),
    ]);

  return {
    generated_at: new Date().toISOString(),
    claude_code: claudeVersion,
    settings: {
      user: userSettings,
      project: projectSettings,
      local: localSettings,
    },
    installed_tools: { plugins, skills, rules, hooks, claude_md: claudeMds },
    detected_ecosystems: ecosystems,
  };
}

function detectClaudeCodeVersion(): { version: string; version_known: boolean; compatible: boolean } {
  try {
    const output = execFileSync('claude', ['--version'], {
      timeout: 3000,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const match = output.match(/^(\d+\.\d+\.\d+)/);
    if (!match) return { version: 'unknown', version_known: false, compatible: false };
    const version = match[1];
    const compatible = compareSemver(version, KNOWN_COMPATIBLE.min) >= 0
      && compareSemver(version, KNOWN_COMPATIBLE.max) <= 0;
    return { version, version_known: true, compatible };
  } catch {
    return { version: 'unknown', version_known: false, compatible: false };
  }
}
```

### Example 3: dirs.ts Modification

```typescript
// Additions to existing paths object in storage/dirs.ts
export const paths = {
  // ... existing paths ...
  analysis: join(BASE_DIR, 'analysis'),
  analysisPreProcessed: join(BASE_DIR, 'analysis', 'pre-processed'),
  summary: join(BASE_DIR, 'analysis', 'pre-processed', 'summary.json'),
  environmentSnapshot: join(BASE_DIR, 'analysis', 'environment-snapshot.json'),
} as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Shell pre-processing (jq/awk/sort/uniq) | TypeScript pre-processing (Node.js readline + Map) | Phase 1-2 decision | ARCHITECTURE.md suggested shell scripts, but Phase 1-2 established TypeScript as the implementation language. All hooks are TypeScript. Pre-processor follows same pattern for consistency, testability, and Zod validation. |
| Per-session analysis only | Cross-session aggregation | Phase 3 requirement (ANL-08) | Patterns accumulate across sessions. 3x in session A + 4x in session B = 7 total. |
| Raw log feeding to agent | Compressed summary feeding | Core architecture decision | 3000 raw JSONL lines -> ~50 summary entries. Keeps agent context clean. |

**Note on shell vs TypeScript:** ARCHITECTURE.md (written before Phase 1) proposed shell scripts for pre-processing. Phase 1-2 established TypeScript as the sole implementation language. All hooks are compiled TypeScript via tsup. Switching to shell would break the testability pattern (Vitest), schema validation (Zod), and build pipeline (tsup). The pre-processor MUST be TypeScript to maintain codebase consistency.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts (exists) |
| Quick run command | `npx vitest run tests/unit/analysis/` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANL-01 | Pre-processor extracts frequency counts, top-N, stats from JSONL logs | unit | `npx vitest run tests/unit/analysis/pre-processor.test.ts -t "frequency" -x` | Wave 0 |
| ANL-01 | summary.json under 50KB with top-20 prompts, tool freq, permission patterns | unit | `npx vitest run tests/unit/analysis/pre-processor.test.ts -t "summary size" -x` | Wave 0 |
| ANL-08 | Cross-session aggregation: 3 in session A + 4 in session B = 7 total | unit | `npx vitest run tests/unit/analysis/pre-processor.test.ts -t "cross-session" -x` | Wave 0 |
| RTG-08 | Environment scanner identifies 3+ tool types | unit | `npx vitest run tests/unit/analysis/environment-scanner.test.ts -t "tool types" -x` | Wave 0 |
| RTG-08 | Scanner reads settings.json enabledPlugins | unit | `npx vitest run tests/unit/analysis/environment-scanner.test.ts -t "plugins" -x` | Wave 0 |
| ONB-04 | Claude Code version detection and compatibility check | unit | `npx vitest run tests/unit/analysis/environment-scanner.test.ts -t "version" -x` | Wave 0 |
| ONB-04 | Warning logged when version is untested | unit | `npx vitest run tests/unit/analysis/environment-scanner.test.ts -t "untested version" -x` | Wave 0 |
| E2E | Full pipeline: write sample logs -> pre-process -> validate output | integration | `npx vitest run tests/integration/pre-processor-pipeline.test.ts -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit/analysis/ tests/integration/pre-processor-pipeline.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/analysis/jsonl-reader.test.ts` -- covers JSONL streaming, date filtering, malformed line handling
- [ ] `tests/unit/analysis/pre-processor.test.ts` -- covers ANL-01, ANL-08 (frequency counts, cross-session, summary size)
- [ ] `tests/unit/analysis/environment-scanner.test.ts` -- covers RTG-08, ONB-04 (tool discovery, version detection)
- [ ] `tests/integration/pre-processor-pipeline.test.ts` -- covers end-to-end pipeline with real file I/O
- [ ] `src/analysis/schemas.ts` -- Zod schemas for summary.json and environment-snapshot.json output

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.14.0 | -- |
| claude CLI | Version detection (ONB-04) | Yes | 2.1.87 | Return "unknown" if not found |
| ~/.claude/settings.json | Environment scanner | Yes | -- | Report empty settings |
| ~/.claude/plugins/ | Plugin discovery | Yes | -- | Report no plugins |

**Missing dependencies with no fallback:** None -- all external dependencies have graceful degradation.

**Missing dependencies with fallback:**
- If `claude` CLI is not found, version detection returns "unknown" with `compatible: false` and `version_known: false`. This is a soft failure that does not block the pipeline.

## Open Questions

1. **Prompt Normalization Depth**
   - What we know: Basic normalization (lowercase, trim, collapse whitespace) catches exact duplicates.
   - What's unclear: Should we collapse prompts that differ only by file paths or variable names? E.g., "fix bug in auth.ts" and "fix bug in user.ts" -- same pattern?
   - Recommendation: Start with exact-after-normalization for Phase 3. Defer semantic similarity to Phase 4+ (agent can do this). Document as a known limitation.

2. **Permission Decision Resolution**
   - What we know: PermissionRequest hook fires BEFORE user decides. All entries have `decision: 'unknown'`.
   - What's unclear: Whether transcript reading could resolve decisions retroactively.
   - Recommendation: Count permission REQUEST frequency only for Phase 3. Decision resolution requires transcript parsing -- defer to Phase 4.

3. **GSD Detection Accuracy**
   - What we know: GSD presence is detectable via `.planning/` directory.
   - What's unclear: Whether `.planning/` existence always means GSD is actively in use.
   - Recommendation: Check for `.planning/` directory AND `get-shit-done` in `~/.claude/`. Report as "detected" not "confirmed".

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** -- Direct reading of all Phase 1-2 source files (schemas, hooks, storage, tests)
- **User machine inspection** -- Real-world `~/.claude/` directory structure, `settings.json`, `plugins/installed_plugins.json`, plugin cache layout
- **[Claude Code Settings Documentation](https://code.claude.com/docs/en/settings)** -- Settings scopes, enabledPlugins format, hooks configuration
- **[Claude Code Plugins README](https://github.com/anthropics/claude-code/blob/main/plugins/README.md)** -- Plugin directory structure, manifest format

### Secondary (MEDIUM confidence)
- **ARCHITECTURE.md** -- Component 5 (Pre-Processing Layer) design, data flow diagram
- **PITFALLS.md** -- Pitfalls 2 (race conditions), 12 (context overflow), 13 (discovery fragility)
- **[enabledPlugins settings.local.json issue #27247](https://github.com/anthropics/claude-code/issues/27247)** -- enabledPlugins scope behavior

### Tertiary (LOW confidence)
- **Prompt normalization strategies** -- Training data only, no specific library research. Start simple, iterate.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all built on existing patterns
- Architecture: HIGH -- direct extension of Phase 1-2 codebase, well-defined module boundaries
- Pitfalls: HIGH -- derived from real codebase analysis and known Claude Code issues
- Environment scanner: MEDIUM -- plugin directory structure verified on user's machine but may vary across installations

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable domain -- log processing and filesystem scanning don't change fast)
