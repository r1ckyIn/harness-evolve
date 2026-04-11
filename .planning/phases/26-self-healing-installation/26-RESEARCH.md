# Phase 26: Self-Healing Installation - Research

**Researched:** 2026-04-11
**Domain:** Claude Code hooks (SessionStart event), file system integrity detection, slash command installation
**Confidence:** HIGH

## Summary

Phase 26 adds self-healing installation detection to harness-evolve. When the `~/.claude/commands/evolve/` directory is missing or its slash command files are incomplete/outdated, the system should detect this and either auto-reinstall the commands or prompt the user to run `harness-evolve init`. Detection should occur at two natural trigger points: (1) a new SessionStart hook that runs when Claude Code sessions begin, and (2) within the `/evolve` skill invocation path.

The implementation is straightforward because all building blocks already exist. The `installSlashCommands()` function in `src/cli/init.ts` already handles version-aware installation (creates directory, checks template versions, writes/updates files). The `generateScanCommand()` and `generateApplyCommand()` template generators are finalized at v5. The SessionStart hook event is a first-class Claude Code lifecycle event that receives `session_id`, `cwd`, `transcript_path`, and a `source` field indicating startup/resume/clear/compact.

**Primary recommendation:** Create a new `SessionStart` command hook (`src/hooks/session-start.ts`) that checks for the existence and completeness of `~/.claude/commands/evolve/{scan,apply}.md`, auto-repairs if templates are missing or outdated, and injects a brief `additionalContext` message only when a repair was performed. Register this hook in `HOOK_REGISTRATIONS` and update the `/evolve` skill SKILL.md to include a pre-check guard.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion (infrastructure phase).

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints from requirement HEAL-01:
- Detection must happen at SessionStart hook or /evolve skill invocation
- Must not add user-visible latency to normal operations
- When `~/.claude/commands/evolve/` directory is missing or incomplete, the system detects this
- Response: auto-reinstall OR prompt user to run `harness-evolve init`
- Templates were finalized in Phase 25 (v5) -- auto-reinstall installs the correct v5 versions

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HEAL-01 | SessionStart hook or `/evolve` skill detects whether `~/.claude/commands/evolve/` exists, auto-reinstalling slash commands or prompting user to run init when missing | SessionStart is a confirmed Claude Code hook event; `installSlashCommands()` already exists in `src/cli/init.ts`; hook output can inject `additionalContext` via JSON on stdout |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Code comments must be pure English (no Chinese, no bilingual)
- Use GSD workflow for all changes
- Commit message format: `<type>(<phase>-<plan>): <description>`
- All hook handlers must swallow errors and never block Claude Code
- Performance budget: hooks should be fast (SessionStart especially -- runs every session)

## Standard Stack

No new dependencies required. This phase uses existing project infrastructure:

### Core (Already in Project)
| Library | Version | Purpose | Role in Phase 26 |
|---------|---------|---------|-------------------|
| Node.js | >=22.14.0 | Runtime | Built-in `fs/promises` for file existence checks |
| Zod | ^4.3.6 | Schema validation | SessionStart input schema |
| tsup | ^8.5.1 | Bundler | New `hooks/session-start` entry point |
| Vitest | ^4.1.2 | Testing | Unit + integration tests |

### No New Dependencies
This is purely internal plumbing. File existence checks use `node:fs/promises` (already imported in multiple hooks). Template generation reuses `generateScanCommand()` and `generateApplyCommand()` from `src/commands/`. No new npm packages needed.

## Architecture Patterns

### Recommended Additions to Project Structure
```
src/
├── hooks/
│   ├── session-start.ts     # NEW: SessionStart hook handler
│   ├── shared.ts            # Existing: readStdin, summarizeToolInput
│   └── ...                  # Existing hooks unchanged
├── cli/
│   ├── init.ts              # MODIFY: extract installSlashCommands to shared utility
│   └── utils.ts             # MODIFY: add HOOK_REGISTRATIONS entry for SessionStart
├── commands/
│   └── evolve-scan.ts       # Existing: template generators (no changes)
├── schemas/
│   └── hook-input.ts        # MODIFY: add sessionStartInputSchema
└── index.ts                 # MODIFY: export new schema + handler
```

### Pattern 1: SessionStart Hook Handler
**What:** A new command hook that runs on every Claude Code session start/resume/clear/compact. It checks the health of slash command installation and auto-repairs if needed.
**When to use:** Every session start event.
**Architecture:**

```typescript
// src/hooks/session-start.ts
// Follows exact pattern of existing hooks (stop.ts, user-prompt-submit.ts)

export async function handleSessionStart(rawJson: string): Promise<void> {
  try {
    const input = sessionStartInputSchema.parse(JSON.parse(rawJson));
    const result = await checkAndRepairSlashCommands();
    
    if (result.repaired) {
      // Output JSON to inject context into session
      const output = {
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: `[harness-evolve] Auto-repaired ${result.details.join(', ')}. Slash commands are now up to date.`,
        },
      };
      process.stdout.write(JSON.stringify(output));
    }
    // If nothing repaired, output nothing (zero latency impact)
  } catch {
    // Never block Claude Code
  }
}
```

### Pattern 2: Extract installSlashCommands for Reuse
**What:** The `installSlashCommands()` function in `src/cli/init.ts` already does version-aware installation. Extract the core logic (check + write) into a shared utility so both `init` CLI and SessionStart hook can use it.
**Why:** Avoids duplicating the template version checking and file writing logic.

```typescript
// Shared utility (could live in src/cli/utils.ts or a new src/commands/install.ts)
export interface RepairResult {
  repaired: boolean;
  details: string[];  // e.g. ['scan.md installed', 'apply.md updated (v4 -> v5)']
}

export async function checkAndRepairSlashCommands(options?: {
  silent?: boolean;  // Suppress console.log (for hook use)
}): Promise<RepairResult>;
```

### Pattern 3: Skill Pre-Check Guard
**What:** Add a pre-check in the `/evolve` SKILL.md that detects missing commands before running analysis.
**When to use:** When user invokes `/evolve` skill directly.

### Anti-Patterns to Avoid
- **Running full `init` from SessionStart:** The SessionStart hook should ONLY repair slash commands, NOT re-register hooks in settings.json. Hook registration is a heavyweight operation with backup/confirm/merge logic that belongs in `init` only.
- **Blocking on errors:** All hook handlers must swallow errors. If slash command repair fails, silently continue -- the user can still use the CLI directly.
- **Verbose output on every session:** Only output `additionalContext` when a repair was actually performed. Silent sessions (everything healthy) must produce zero output.
- **Checking hook registration health from SessionStart:** If the SessionStart hook is running, hooks are already registered. Only check slash commands.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template version checking | Custom diffing logic | Existing `extractInstalledVersion()` from `src/cli/init.ts` | Already handles version comparison with `<!-- template-version: N -->` markers |
| Slash command generation | Hardcoded markdown strings | Existing `generateScanCommand()` / `generateApplyCommand()` | Templates are finalized at v5, generators are the single source of truth |
| File existence checks | Custom stat wrappers | Native `access()` from `node:fs/promises` | Already used in init.ts (`fileExists()` helper) |
| Hook JSON output format | Manual string building | `JSON.stringify()` with `hookSpecificOutput` structure | Claude Code expects valid JSON with specific structure |

## Common Pitfalls

### Pitfall 1: SessionStart Hook Latency
**What goes wrong:** SessionStart hook adds noticeable delay to every Claude Code session start.
**Why it happens:** Reading files, checking versions, and writing repairs takes time. If done synchronously with heavy I/O, it blocks session initialization.
**How to avoid:**
1. Use `access()` for existence checks (fast -- no file content reading)
2. Only read file content when `access()` succeeds (to check version)
3. Only write when version is stale or file missing
4. Happy path (everything healthy) should be ~3 filesystem calls: `access(dir)`, `access(scan.md)`, `access(apply.md)` -- under 5ms
5. Consider making the hook `async: true` if repair path is slow, but note that SessionStart context injection requires synchronous completion (exit 0 with JSON)
**Warning signs:** Users report slow session starts, or timing shows >50ms for the hook.

### Pitfall 2: Race Condition with Concurrent Sessions
**What goes wrong:** Two Claude Code sessions start simultaneously, both detect missing commands, both try to write.
**Why it happens:** File writes from two processes to the same path can corrupt.
**How to avoid:** Use `writeFile()` directly (not `write-file-atomic`) since slash command files are small idempotent templates. Two concurrent writes of identical content produce the same result. Alternatively, use `write-file-atomic` from the project's existing dependency for safety.
**Warning signs:** Corrupted .md files in ~/.claude/commands/evolve/.

### Pitfall 3: Forgetting to Update HOOK_REGISTRATIONS
**What goes wrong:** SessionStart hook code exists but isn't registered in settings.json on `init`.
**Why it happens:** Adding `src/hooks/session-start.ts` without updating `HOOK_REGISTRATIONS` in `src/cli/utils.ts` and the tsup entry points.
**How to avoid:** Checklist: (1) Create hook source, (2) Add to `HOOK_REGISTRATIONS`, (3) Add tsup entry, (4) Add package.json exports, (5) Update tests.
**Warning signs:** Hook file exists in dist/ but `harness-evolve init` doesn't register it.

### Pitfall 4: SessionStart Hook Doesn't Receive stdin Like Other Hooks
**What goes wrong:** Assuming SessionStart receives the same stdin JSON structure as other hooks.
**Why it happens:** SessionStart has a slightly different schema (`source` field instead of `stop_hook_active`, `model` field, no `prompt` or `tool_name`).
**How to avoid:** Define a proper `sessionStartInputSchema` with the correct fields: `session_id`, `transcript_path`, `cwd`, `hook_event_name: 'SessionStart'`, `source`, `model` (optional), `permission_mode`.
**Warning signs:** Zod parse failures in the hook handler.

### Pitfall 5: Hook Output Format for SessionStart
**What goes wrong:** Plain text stdout doesn't inject context properly, or JSON output is malformed.
**Why it happens:** SessionStart hooks support `hookSpecificOutput.additionalContext` for injecting context, and `hookSpecificOutput.sessionTitle` for setting title. Plain text stdout also works but is shown differently in the transcript.
**How to avoid:** Use the JSON output format with `hookSpecificOutput.hookEventName: 'SessionStart'` and `additionalContext` field. Only output JSON when repair was performed; output nothing (empty stdout) when everything is healthy.
**Warning signs:** Context not appearing in Claude's conversation, or hook output showing raw JSON to user.

## Code Examples

### SessionStart Input Schema (Verified from Official Docs)
```typescript
// Source: https://code.claude.com/docs/en/hooks (SessionStart event documentation)
export const sessionStartInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('SessionStart'),
  source: z.enum(['startup', 'resume', 'clear', 'compact']),
  model: z.string().optional(),
});
export type SessionStartInput = z.infer<typeof sessionStartInputSchema>;
```

### SessionStart Hook Output (Verified from Official Docs)
```typescript
// Source: https://code.claude.com/docs/en/hooks (hook output format)
// Only output when repair was performed
const output = {
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: '[harness-evolve] Auto-repaired missing /evolve:scan command.',
  },
};
process.stdout.write(JSON.stringify(output));
```

### Hook Registration Entry
```typescript
// Add to HOOK_REGISTRATIONS in src/cli/utils.ts
{
  event: 'SessionStart',
  hookFile: 'session-start.js',
  timeout: 10,    // seconds -- fast check, rarely writes
  async: false,    // Must be sync for additionalContext injection
  description: 'Detects and repairs missing slash commands on session start',
}
```

### tsup Entry Point Addition
```typescript
// Add to tsup.config.ts entry
'hooks/session-start': 'src/hooks/session-start.ts',
```

### Slash Command Health Check Logic
```typescript
// Core detection logic -- reusable between SessionStart hook and /evolve skill
import { access } from 'node:fs/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generateScanCommand, getScanTemplateVersion } from '../commands/evolve-scan.js';
import { generateApplyCommand, getApplyTemplateVersion } from '../commands/evolve-apply.js';

export interface SlashCommandHealth {
  healthy: boolean;
  missing: string[];       // e.g. ['scan.md', 'apply.md']
  outdated: string[];      // e.g. ['scan.md (v4 -> v5)']
}

export async function checkSlashCommandHealth(): Promise<SlashCommandHealth> {
  const home = process.env.HOME ?? '';
  const dir = join(home, '.claude', 'commands', 'evolve');
  const result: SlashCommandHealth = { healthy: true, missing: [], outdated: [] };

  const commands = [
    { name: 'scan.md', version: getScanTemplateVersion(), path: join(dir, 'scan.md') },
    { name: 'apply.md', version: getApplyTemplateVersion(), path: join(dir, 'apply.md') },
  ];

  for (const cmd of commands) {
    try {
      await access(cmd.path);
      // File exists -- check version
      const content = await readFile(cmd.path, 'utf-8');
      const match = content.match(/<!-- template-version: (\d+) -->/);
      if (!match || parseInt(match[1], 10) < parseInt(cmd.version, 10)) {
        result.outdated.push(cmd.name);
        result.healthy = false;
      }
    } catch {
      result.missing.push(cmd.name);
      result.healthy = false;
    }
  }

  return result;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No self-healing | Phase 26 adds SessionStart detection | v5.0 | Users no longer get stuck with broken /evolve commands |
| Slash commands installed only by `init` | SessionStart hook auto-repairs | v5.0 | Resilient to accidental deletion, version upgrades |
| 6 registered hook events | 7 hook events (adding SessionStart) | v5.0 | New lifecycle coverage |

**Claude Code Hook Events (current as of April 2026):**
- SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, Stop, StopFailure, SessionEnd, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, Notification, InstructionsLoaded, ConfigChange, CwdChanged, FileChanged, WorktreeCreate, WorktreeRemove, PreCompact, PostCompact, Elicitation, ElicitationResult, TeammateIdle, PermissionDenied
- harness-evolve currently uses 6: UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, Stop
- Phase 26 adds SessionStart as the 7th

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/unit/hooks/session-start.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HEAL-01a | SessionStart hook detects missing `~/.claude/commands/evolve/` directory | unit | `npx vitest run tests/unit/hooks/session-start.test.ts -x` | Wave 0 |
| HEAL-01b | SessionStart hook detects outdated template versions | unit | `npx vitest run tests/unit/hooks/session-start.test.ts -x` | Wave 0 |
| HEAL-01c | SessionStart hook auto-repairs missing/outdated slash commands | unit | `npx vitest run tests/unit/hooks/session-start.test.ts -x` | Wave 0 |
| HEAL-01d | SessionStart hook outputs additionalContext only when repair performed | unit | `npx vitest run tests/unit/hooks/session-start.test.ts -x` | Wave 0 |
| HEAL-01e | SessionStart hook swallows all errors (never blocks Claude Code) | unit | `npx vitest run tests/unit/hooks/session-start.test.ts -x` | Wave 0 |
| HEAL-01f | SessionStart hook registered in HOOK_REGISTRATIONS (7 events) | integration | `npx vitest run tests/integration/cli-init.test.ts -x` | Existing (update) |
| HEAL-01g | /evolve skill pre-check detects missing commands | manual-only | Manual: invoke `/evolve` with missing commands dir | N/A |
| HEAL-01h | SessionStart input schema validates correctly | unit | `npx vitest run tests/unit/hooks/session-start.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/hooks/session-start.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/hooks/session-start.test.ts` -- covers HEAL-01a through HEAL-01e, HEAL-01h
- [ ] Update `tests/integration/cli-init.test.ts` -- covers HEAL-01f (7 events instead of 6)

## Open Questions

1. **Should SessionStart hook be async or sync?**
   - What we know: `additionalContext` injection requires exit 0 with JSON stdout. Async hooks run without blocking session start but their context injection behavior is undocumented for SessionStart specifically.
   - What's unclear: Whether `async: true` SessionStart hooks can still inject additionalContext.
   - Recommendation: Use `async: false` (synchronous) to guarantee context injection works. The happy path is <5ms (3 file existence checks), and the repair path is <20ms (write 2 small markdown files). Both are well under the 10-second timeout.

2. **Should the hook also check hook registration in settings.json?**
   - What we know: If the SessionStart hook is running, hooks are by definition registered. Checking settings.json from within a running hook is circular.
   - Recommendation: No. Only check slash commands. Hook registration health is verified by the fact that the hook is executing at all.

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- SessionStart event schema, hook output format, additionalContext mechanism, exit code behavior
- Existing codebase: `src/cli/init.ts` (installSlashCommands), `src/cli/utils.ts` (HOOK_REGISTRATIONS), `src/hooks/*.ts` (hook handler patterns)
- Existing codebase: `src/commands/evolve-scan.ts`, `src/commands/evolve-apply.ts` (template generators with version constants)

### Secondary (MEDIUM confidence)
- None needed -- this phase is entirely internal plumbing using verified APIs

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing
- Architecture: HIGH -- follows exact patterns of 6 existing hooks, verified SessionStart event schema from official docs
- Pitfalls: HIGH -- based on real codebase analysis and official documentation of hook behavior

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable -- internal plumbing, no external API dependencies)
