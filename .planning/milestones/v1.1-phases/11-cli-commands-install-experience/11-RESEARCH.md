# Phase 11: CLI Commands & Install Experience - Research

**Researched:** 2026-04-04
**Domain:** CLI tooling, npm package install experience, Claude Code hook registration
**Confidence:** HIGH

## Summary

Phase 11 transforms the existing CLI stub (`src/cli.ts`) into a full Commander.js CLI with three subcommands: `init`, `status`, and `uninstall`. The dominant technical challenge is **hook command path resolution** -- ensuring that the paths written into `~/.claude/settings.json` point to the correct compiled JS files regardless of whether the user installed via `npm i -g`, `npx`, or `git clone`.

The project already has all the infrastructure needed: `storage/dirs.ts` defines paths, `storage/counter.ts` reads interaction data, `delivery/state.ts` tracks recommendation status, and `analysis/environment-scanner.ts` reads settings.json. The CLI layer is a thin orchestration over these existing modules, plus Commander.js for argument parsing and `node:readline` for interactive confirmation.

**Primary recommendation:** Use `import.meta.dirname` (Node 22 built-in) to resolve hook script paths relative to the CLI entry point at runtime. This single mechanism works for all install methods because the CLI and hook scripts are always siblings in the same `dist/` directory.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CLI-01 | `harness-evolve init` detects settings.json location, displays planned hook registrations, and applies after user confirmation (or `--yes` flag) | Commander.js subcommand with `--yes` option; settings.json location detection via `~/.claude/settings.json`; interactive confirmation via `node:readline`; atomic write via `write-file-atomic` |
| CLI-02 | `harness-evolve init` resolves hook command paths dynamically based on actual install location | `import.meta.dirname` resolves to `dist/` directory at runtime; hook scripts are siblings (`dist/hooks/*.js`); works for global, npx, and git clone |
| CLI-03 | `harness-evolve status` shows interaction count, last analysis timestamp, pending recommendations count, and hook registration status | `readCounter()` for interaction count + last_analysis; `loadState()` for pending recommendations; settings.json parsing for hook registration status |
| CLI-04 | `harness-evolve uninstall` removes hook entries from settings.json and optionally deletes ~/.harness-evolve/ data directory | Reverse of init: read settings.json, filter out harness-evolve hook entries, atomic write; `rm -rf` equivalent via `node:fs/promises` for data directory |
| CLI-05 | `npx harness-evolve init` works as zero-install setup | npx downloads package to `~/.npm/_npx/`, runs `dist/cli.js` via bin field; `import.meta.dirname` resolves correctly in npx cache; no postinstall needed |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Commander.js | ^14.0.3 | CLI argument parsing, subcommand routing | Decade-stable, 14M+ weekly downloads, first-class TypeScript support. Already specified in PROJECT.md stack. |
| @commander-js/extra-typings | ^14.0.0 | Strong TypeScript inference for opts/actions | Compile-time safety for option access without runtime cost. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| write-file-atomic | ^7.0.0 | Atomic settings.json writes | Already a project dependency -- reuse for init/uninstall settings modifications |
| node:readline | (built-in) | Interactive confirmation prompt | Only for `init` command when `--yes` is not specified |
| node:fs/promises | (built-in) | Read/write settings.json, delete data directory | Core file operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Commander.js | yargs | Heavier, more config, no advantage for 3 commands |
| node:readline | inquirer/prompts | Extra dependency for a single yes/no question |
| import.meta.dirname | fileURLToPath(import.meta.url) | Both work; dirname is cleaner, Node 22+ only (which is our floor) |

**Installation:**
```bash
npm install commander @commander-js/extra-typings
```

**Version verification:** Commander 14.0.3 and @commander-js/extra-typings 14.0.0 confirmed current on npm registry (2026-04-04).

## Architecture Patterns

### Recommended Project Structure
```
src/
├── cli.ts                      # Commander program definition + subcommand wiring
├── cli/
│   ├── init.ts                 # init command implementation
│   ├── status.ts               # status command implementation
│   ├── uninstall.ts            # uninstall command implementation
│   └── utils.ts                # Shared CLI utilities (settings path, hook definitions, console formatting)
├── hooks/                      # (existing) Hook handlers
├── storage/                    # (existing) Config, counter, dirs, logger
├── delivery/                   # (existing) State, appliers, notification
└── ...
```

### Pattern 1: Hook Path Resolution via import.meta.dirname

**What:** Resolve the absolute path to compiled hook JS files using `import.meta.dirname`, which points to the `dist/` directory at runtime regardless of install method.

**When to use:** In the `init` command, when generating hook command strings for settings.json.

**Example:**
```typescript
// Source: Node.js built-in (Node 22+)
// import.meta.dirname in dist/cli/init.js resolves to /path/to/dist/cli/
// The hook files are at /path/to/dist/hooks/*.js

import { join, dirname } from 'node:path';

function resolveHookPath(hookFile: string): string {
  // import.meta.dirname = dist/cli/ (where init.js lives)
  // Go up one level to dist/, then into hooks/
  const distDir = dirname(import.meta.dirname);
  return join(distDir, 'hooks', hookFile);
}

// Generates: node "/usr/local/lib/node_modules/harness-evolve/dist/hooks/user-prompt-submit.js"
// Or:        node "/Users/x/.npm/_npx/abc123/node_modules/harness-evolve/dist/hooks/user-prompt-submit.js"
// Or:        node "/Users/x/projects/harness-evolve/dist/hooks/user-prompt-submit.js"
```

**Why this works for all install methods:**
- **`npm i -g`:** CLI runs from global node_modules symlink, `import.meta.dirname` resolves through symlink to actual `dist/cli/` directory
- **`npx`:** Package cached in `~/.npm/_npx/`, `import.meta.dirname` points to cache location's `dist/cli/`
- **git clone + npm run build:** `import.meta.dirname` points to local `dist/cli/` directory

### Pattern 2: Settings.json Detection and Modification

**What:** Detect the correct settings.json path (user-level at `~/.claude/settings.json`), read existing content, merge hook entries, write atomically.

**When to use:** In both `init` (add hooks) and `uninstall` (remove hooks).

**Example:**
```typescript
// Source: Claude Code official docs + existing settings-applier.ts pattern
import { readFile } from 'node:fs/promises';
import writeFileAtomic from 'write-file-atomic';
import { join } from 'node:path';

const SETTINGS_PATH = join(process.env.HOME ?? '', '.claude', 'settings.json');

async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(SETTINGS_PATH, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writeSettings(settings: Record<string, unknown>): Promise<void> {
  await writeFileAtomic(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}
```

### Pattern 3: Hook Registration Definition

**What:** Define the complete set of hook registrations that harness-evolve needs, matching the Claude Code hooks format.

**When to use:** Central definition used by both `init` (to add) and `uninstall` (to identify and remove).

**Example:**
```typescript
// The 6 hooks harness-evolve registers:
interface HookRegistration {
  event: string;           // Claude Code event name
  matcher: string;         // Regex matcher (usually "*")
  hookFile: string;        // Compiled JS filename in dist/hooks/
  timeout?: number;        // Timeout in seconds
  async?: boolean;         // Whether to run async
}

const HOOK_REGISTRATIONS: HookRegistration[] = [
  { event: 'UserPromptSubmit', matcher: '*', hookFile: 'user-prompt-submit.js', timeout: 10 },
  { event: 'PreToolUse',       matcher: '*', hookFile: 'pre-tool-use.js',       timeout: 10, async: true },
  { event: 'PostToolUse',      matcher: '*', hookFile: 'post-tool-use.js',      timeout: 10, async: true },
  { event: 'PostToolUseFailure', matcher: '*', hookFile: 'post-tool-use-failure.js', timeout: 10, async: true },
  { event: 'PermissionRequest', matcher: '*', hookFile: 'permission-request.js', timeout: 10, async: true },
  { event: 'Stop',             matcher: '*', hookFile: 'stop.js',               timeout: 10, async: true },
];
```

### Pattern 4: Interactive Confirmation via node:readline

**What:** Use Node.js built-in readline for a simple yes/no prompt, bypassed by `--yes` flag.

**Example:**
```typescript
import { createInterface } from 'node:readline';

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
```

### Anti-Patterns to Avoid
- **Hardcoding absolute paths in settings.json:** Never write `"/usr/local/lib/node_modules/..."` -- always resolve at init time using `import.meta.dirname`
- **Using postinstall scripts:** Security concern per REQUIREMENTS.md Out of Scope. Users must explicitly run `harness-evolve init`.
- **Modifying project-level settings.json:** Always target `~/.claude/settings.json` (user scope) so hooks apply globally. Project-level would require running init per project.
- **Reading package.json from disk for version:** The current cli.ts reads package.json via `readFileSync` + `join(__dirname, '..', 'package.json')`. This is fragile with nested `cli/` directory. Instead, import package.json version at build time or use Commander's `.version()` with a similar path resolution approach.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CLI argument parsing | Custom argv parser | Commander.js 14 | Option validation, help generation, subcommand routing |
| Atomic file writes | Manual write + rename | write-file-atomic (already a dep) | Handles crash-safe writes, cross-platform |
| Interactive prompts | Custom stdin reader | node:readline createInterface | Built-in, handles line editing, terminal raw mode |
| Settings.json backup | Manual copy | copyFile before modification | Pattern from existing SettingsApplier -- make backup before modifying |

**Key insight:** The project already has all the file I/O patterns established in `storage/config.ts` and `delivery/appliers/settings-applier.ts`. The CLI commands are thin wrappers that orchestrate existing modules.

## Common Pitfalls

### Pitfall 1: npx Cache Path Instability
**What goes wrong:** npx caches packages in `~/.npm/_npx/<hash>/`, and the hash changes when the package version changes. Hook commands written to settings.json with npx cache paths become stale after package updates.
**Why it happens:** npx uses content-addressable storage -- different versions get different cache directories.
**How to avoid:** When detecting npx install, warn the user that paths may break on update. Recommend `npm i -g` for persistent installations. For npx users, `harness-evolve init` should be re-run after each update. Add a version check in the `status` command to detect path staleness.
**Warning signs:** `status` command shows hooks registered but files don't exist at the registered paths.

### Pitfall 2: Settings.json Doesn't Exist Yet
**What goes wrong:** First-time Claude Code users may not have `~/.claude/settings.json` at all.
**Why it happens:** Claude Code creates settings.json lazily, not at install time.
**How to avoid:** The `init` command must handle the case where the file doesn't exist (create it), the directory doesn't exist (create `~/.claude/`), or the file is empty/invalid JSON (initialize with `{}`).
**Warning signs:** ENOENT or JSON.parse errors during init.

### Pitfall 3: Existing Hook Entries Conflict
**What goes wrong:** User already has hooks registered for the same events (e.g., a custom `UserPromptSubmit` hook). Blindly overwriting destroys their configuration.
**Why it happens:** Settings.json hooks are arrays per event -- multiple handlers can coexist.
**How to avoid:** The `init` command must APPEND to existing event arrays, not replace them. The `uninstall` command must only remove entries whose command contains `harness-evolve`, not all entries for that event.
**Warning signs:** User reports losing custom hooks after running init.

### Pitfall 4: Shebang and Node Path
**What goes wrong:** The CLI entry has `#!/usr/bin/env node` shebang, but hook commands are run via `node "/path/to/hook.js"`. If the user's PATH doesn't include Node 22, the hook may run under an older Node version.
**Why it happens:** Claude Code spawns hook commands via shell, which uses whatever `node` is in PATH.
**How to avoid:** In the hook command string, use `node` (which resolves via PATH, matching the CLI's own runtime). The `engines` field in package.json already requires `>=22.14.0`, so npm/npx will warn if Node is too old. The `init` command should verify Node version before proceeding.
**Warning signs:** Hook crashes with syntax errors (ESM not supported in older Node).

### Pitfall 5: Uninstall Data Deletion Without Confirmation
**What goes wrong:** User loses accumulated interaction logs and analysis data unexpectedly.
**Why it happens:** `~/.harness-evolve/` contains valuable historical data that can't be regenerated.
**How to avoid:** Make data directory deletion OPTIONAL and explicitly confirm it. Default behavior: only remove hook entries from settings.json. Only delete `~/.harness-evolve/` when `--purge` flag is provided (or after explicit confirmation).
**Warning signs:** User runs uninstall and asks where their data went.

### Pitfall 6: tsup Entry Point Configuration for CLI Submodules
**What goes wrong:** Adding `src/cli/init.ts` etc. as separate tsup entry points creates independent bundles that don't share code with `cli.ts`.
**Why it happens:** tsup entry points are independent bundles by default (splitting: false in current config).
**How to avoid:** Do NOT add cli subcommands as separate tsup entry points. The `cli.ts` entry point imports from `cli/init.ts`, `cli/status.ts`, `cli/uninstall.ts` -- tsup bundles them into `dist/cli.js` as part of the existing cli entry. Only the hook entry points and library entry remain separate.
**Warning signs:** dist/cli.js doesn't contain the subcommand code, or import errors at runtime.

## Code Examples

### Commander.js Program Setup
```typescript
// Source: Commander.js v14 official README
import { Command } from '@commander-js/extra-typings';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const pkg = JSON.parse(
  readFileSync(join(dirname(import.meta.dirname), 'package.json'), 'utf-8')
);

const program = new Command()
  .name('harness-evolve')
  .description('Self-iteration engine for Claude Code')
  .version(pkg.version);

program
  .command('init')
  .description('Register harness-evolve hooks in Claude Code settings')
  .option('--yes', 'Skip confirmation prompt')
  .action(async (opts) => {
    // opts.yes is typed as boolean | undefined
    await runInit({ yes: opts.yes ?? false });
  });

program
  .command('status')
  .description('Show harness-evolve status and statistics')
  .action(async () => {
    await runStatus();
  });

program
  .command('uninstall')
  .description('Remove harness-evolve hooks and optionally delete data')
  .option('--purge', 'Also delete ~/.harness-evolve/ data directory')
  .action(async (opts) => {
    await runUninstall({ purge: opts.purge ?? false });
  });

program.parse();
```

### Hook Registration Merge Logic
```typescript
// Merge harness-evolve hooks into existing settings without destroying user hooks
function mergeHooks(
  existing: Record<string, unknown>,
  hookDefs: Array<{ event: string; command: string; timeout: number; async?: boolean }>,
): Record<string, unknown> {
  const hooks = (existing.hooks ?? {}) as Record<string, unknown[]>;

  for (const def of hookDefs) {
    const eventHooks = Array.isArray(hooks[def.event]) ? hooks[def.event] : [];

    // Check if harness-evolve hook already registered for this event
    const alreadyRegistered = eventHooks.some(
      (h: any) => typeof h === 'object' && h?.hooks?.some?.(
        (hh: any) => typeof hh.command === 'string' && hh.command.includes('harness-evolve')
      )
    );

    if (!alreadyRegistered) {
      eventHooks.push({
        matcher: '*',
        hooks: [{
          type: 'command',
          command: def.command,
          timeout: def.timeout,
          ...(def.async ? { async: true } : {}),
        }],
      });
    }

    hooks[def.event] = eventHooks;
  }

  return { ...existing, hooks };
}
```

### Status Command Data Gathering
```typescript
// Gather data from existing modules for status display
import { readCounter } from '../storage/counter.js';
import { loadState } from '../delivery/state.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function gatherStatus() {
  const counter = await readCounter();
  const state = await loadState();
  const pendingCount = state.entries.filter(e => e.status === 'pending').length;

  // Check hook registration in settings.json
  const settingsPath = join(process.env.HOME ?? '', '.claude', 'settings.json');
  let hooksRegistered = false;
  try {
    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    hooksRegistered = JSON.stringify(settings.hooks ?? {}).includes('harness-evolve');
  } catch {
    // Settings not found
  }

  return {
    interactionCount: counter.total,
    lastAnalysis: counter.last_analysis ?? 'never',
    pendingRecommendations: pendingCount,
    hooksRegistered,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `fileURLToPath(import.meta.url)` + `dirname()` | `import.meta.dirname` | Node 21.2+ (stable in 22 LTS) | Simpler path resolution, no import needed |
| Commander.js v12 | Commander.js v14 | 2025 | Better TypeScript support via extra-typings |
| Manual subcommand routing (process.argv) | Commander `.command()` API | N/A | Built-in help, error handling, option parsing |

**Deprecated/outdated:**
- `__dirname` / `__filename`: Not available in ESM modules. Use `import.meta.dirname` / `import.meta.filename` instead.
- `require.resolve()`: CJS-only. Use `import.meta.resolve()` for ESM package resolution.

## Open Questions

1. **npx path persistence across versions**
   - What we know: npx caches in `~/.npm/_npx/<hash>/`, hash changes per version
   - What's unclear: Whether re-running `npx harness-evolve init` after an update automatically updates the hook paths in settings.json
   - Recommendation: The `init` command should always update paths, and `status` should warn when registered hook paths don't exist on disk

2. **Windows compatibility**
   - What we know: Project targets macOS (user's machine), but npm packages should work cross-platform
   - What's unclear: Whether `node "/path/to/hook.js"` command format works in PowerShell-based Claude Code sessions
   - Recommendation: Out of scope for v1.1 (user is on macOS), but use `path.join` and avoid hardcoded separators for future-proofing

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.14.0 | -- |
| npm | Package install | Yes | 11.6.0 | -- |
| npx | Zero-install setup | Yes | 11.6.0 | -- |
| Commander.js | CLI framework | No (not yet installed as direct dep) | 14.0.3 on npm | -- |
| @commander-js/extra-typings | TypeScript CLI types | No (not yet installed) | 14.0.0 on npm | -- |
| write-file-atomic | Atomic writes | Yes | ^7.0.0 (existing dep) | -- |
| ~/.claude/ directory | Settings.json location | Yes (Claude Code installed) | -- | Create if missing |

**Missing dependencies with no fallback:**
- Commander.js and @commander-js/extra-typings must be installed as production dependencies

**Missing dependencies with fallback:**
- None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/unit/cli` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CLI-01 | init command displays hooks and writes settings.json | unit | `npx vitest run tests/unit/cli/init.test.ts -x` | No -- Wave 0 |
| CLI-02 | Hook paths resolve correctly for all install methods | unit | `npx vitest run tests/unit/cli/path-resolution.test.ts -x` | No -- Wave 0 |
| CLI-03 | status command reads counter, state, and settings | unit | `npx vitest run tests/unit/cli/status.test.ts -x` | No -- Wave 0 |
| CLI-04 | uninstall removes hooks, optionally deletes data | unit | `npx vitest run tests/unit/cli/uninstall.test.ts -x` | No -- Wave 0 |
| CLI-05 | npx init flow works end-to-end | integration | `npx vitest run tests/integration/cli-init.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/cli`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/cli/init.test.ts` -- covers CLI-01, CLI-02
- [ ] `tests/unit/cli/status.test.ts` -- covers CLI-03
- [ ] `tests/unit/cli/uninstall.test.ts` -- covers CLI-04
- [ ] `tests/integration/cli-init.test.ts` -- covers CLI-05
- [ ] Framework install: `npm install commander @commander-js/extra-typings` -- production deps

## Project Constraints (from CLAUDE.md)

- **Code comments must be in pure English** -- no Chinese, no bilingual mixing
- **Technology stack is locked** -- Commander.js ^14, Zod ^4, tsup ^8, Vitest ^4, Node >=22.14.0
- **ESM-only** -- no CJS dual format
- **No postinstall hooks** -- security concern, explicit `harness-evolve init` required (per REQUIREMENTS.md Out of Scope)
- **File-based persistence** -- use `write-file-atomic` for crash-safe writes
- **Never block Claude Code** -- all hook handlers swallow errors
- **Performance budget** -- hooks must stay under 50ms (capture) / 100ms (inject) / 30ms (async)
- **GSD workflow enforcement** -- work through GSD commands, not direct edits
- **Commit message format** -- `<type>(<phase>-<plan>): <description>` (GSD project with `.planning/`)

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Hook registration format, event names, command hook specification, environment variables
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) -- Automate workflows guide
- [Commander.js GitHub](https://github.com/tj/commander.js) -- v14 API, subcommand definition, option parsing, TypeScript usage
- [npm Docs: Folders](https://docs.npmjs.com/cli/v11/configuring-npm/folders/) -- Global vs local install paths
- [npx Docs](https://docs.npmjs.com/cli/v11/commands/npx/) -- npx cache behavior, package resolution

### Secondary (MEDIUM confidence)
- [MDN: import.meta.resolve()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta/resolve) -- ESM module resolution
- [Sonarsource: dirname is back](https://www.sonarsource.com/blog/dirname-node-js-es-modules) -- import.meta.dirname in Node 22
- npm registry version checks for Commander 14.0.3, @commander-js/extra-typings 14.0.0

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Commander.js is locked in PROJECT.md, versions verified against npm registry
- Architecture: HIGH -- CLI is a thin wrapper over existing modules; hook registration format verified against official Claude Code docs
- Pitfalls: HIGH -- Path resolution challenge is well-understood; settings.json format verified from official docs and existing codebase patterns (settings-applier.ts, environment-scanner.ts)

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (30 days -- stable domain, no fast-moving APIs)
