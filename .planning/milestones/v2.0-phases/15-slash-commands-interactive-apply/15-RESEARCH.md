# Phase 15: Slash Commands & Interactive Apply - Research

**Researched:** 2026-04-04
**Domain:** Claude Code slash commands/skills, CLI installation, interactive recommendation workflow
**Confidence:** HIGH

## Summary

Phase 15 adds two slash commands (`/evolve:scan` and `/evolve:apply`) that allow users to interact with harness-evolve inside Claude Code sessions, plus extends the `init` and `uninstall` CLI commands to manage these slash command files. The slash commands are Markdown files installed into the project's `.claude/commands/` directory (or equivalently `.claude/skills/`).

The research confirms that Claude Code's slash command system is straightforward: a Markdown file at `.claude/commands/<name>.md` or `.claude/skills/<name>/SKILL.md` becomes a `/name` command. Both formats work identically for basic use. The `.claude/commands/` path is simpler for single-file commands and sufficient for this phase. The system supports YAML frontmatter for configuration (description, argument-hint, disable-model-invocation, allowed-tools), `$ARGUMENTS` substitution, and shell injection via `` !`command` `` syntax for dynamic context.

The key architectural insight is that `/evolve:scan` and `/evolve:apply` are **prompt-based skills** -- they instruct Claude what to do, and Claude executes using its tools (Bash to run harness-evolve CLI, Read/Write for file operations). They are NOT programmatic scripts. This means the slash commands contain instructions for Claude to follow, not executable code.

**Primary recommendation:** Create two Markdown command files installed by `harness-evolve init` into `.claude/commands/evolve/` (creating `/evolve:scan` and `/evolve:apply` namespaced commands). `/evolve:scan` instructs Claude to run `harness-evolve` scan and present results. `/evolve:apply` reads pending recommendations from the state file and walks the user through apply/skip/ignore for each.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMD-01 | `harness-evolve init` installs `/evolve:scan` and `/evolve:apply` slash command files into `.claude/commands/` | Slash commands are Markdown files; init writes them to disk; `mkdir -p` + `writeFile` pattern already used by init |
| CMD-02 | `/evolve:apply` presents pending recommendations one-by-one, user chooses apply/skip/permanently ignore | Claude reads recommendation state JSON, iterates pending items, calls applier registry via CLI or programmatic API |
| CMD-03 | `harness-evolve uninstall` removes installed slash command files | Uninstall already removes hooks; extend to also `rm` the command directory |
| SCN-04 | `/evolve:scan` triggers deep config scan at any time (not just init) | `runDeepScan(cwd)` is already exported; slash command instructs Claude to invoke it via CLI or programmatic call |
</phase_requirements>

## Standard Stack

### Core (already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=22.14.0 | Runtime | Already established |
| TypeScript | ~6.0 | Type safety | Already established |
| Zod | ^4.3.6 | Schema validation | Already established |
| Commander.js | ^14.0.3 | CLI framework | Already established |
| write-file-atomic | ^7.0.0 | Atomic file writes | Already established |
| Vitest | ^4.1.2 | Testing | Already established |

### No new dependencies required

This phase adds only Markdown files (slash commands) and TypeScript code that extends existing CLI commands. No new npm packages needed.

## Architecture Patterns

### Recommended Project Structure

```
src/
├── cli/
│   ├── init.ts              # MODIFY: add slash command installation
��   ├── uninstall.ts          # MODIFY: add slash command removal
│   └── utils.ts              # MODIFY: add command file definitions
├── commands/                  # NEW: slash command template content
│   ├── evolve-scan.ts         # Template generator for /evolve:scan
│   └── evolve-apply.ts        # Template generator for /evolve:apply
└── ...

# Installed output (in user's project):
.claude/
└── commands/
    └��─ evolve/
        ├── scan.md            # /evolve:scan slash command
        └── apply.md           # /evolve:apply slash command
```

### Pattern 1: Command Files as String Templates in TypeScript

**What:** Store slash command Markdown content as exported string constants or template functions in TypeScript source files. The init command writes these to disk at install time.

**When to use:** When command content needs dynamic values (like harness-evolve data paths) injected at install time.

**Example:**
```typescript
// src/commands/evolve-scan.ts

import { paths } from '../storage/dirs.js';

/**
 * Generate /evolve:scan slash command content.
 * Injects the data directory path so Claude knows where to find artifacts.
 */
export function generateScanCommand(): string {
  return `---
name: scan
description: Run a deep configuration scan to detect quality issues in your Claude Code setup
disable-model-invocation: true
---

# /evolve:scan

Run harness-evolve deep configuration scan on the current project.

## Instructions

1. Run the scan:
   \`\`\`bash
   npx harness-evolve scan
   \`\`\`
   Or if installed globally:
   \`\`\`bash
   harness-evolve scan
   \`\`\`

2. Present the results to the user...
`;
}
```

### Pattern 2: Subdirectory Namespacing for Slash Commands

**What:** Claude Code supports subdirectory-based namespacing. A file at `.claude/commands/evolve/scan.md` creates the command `/evolve:scan`. This keeps harness-evolve commands grouped and avoids collision with user commands.

**When to use:** Always -- harness-evolve should namespace its commands under `evolve`.

**Example directory layout:**
```
.claude/commands/evolve/
├── scan.md      # Creates /evolve:scan
└── apply.md     # Creates /evolve:apply
```

### Pattern 3: CLI Scan Subcommand

**What:** Add a `harness-evolve scan` CLI subcommand that the slash command can invoke via Bash. This decouples the scan trigger from requiring programmatic imports. The scan command runs `runDeepScan(cwd)` and outputs structured JSON to stdout.

**When to use:** The `/evolve:scan` slash command needs a way to trigger the scan. A CLI subcommand is the cleanest interface since slash commands instruct Claude to run shell commands.

### Pattern 4: Interactive Apply via State File

**What:** `/evolve:apply` reads the recommendation state from `~/.harness-evolve/analysis/recommendation-state.json` and the latest analysis result from `~/.harness-evolve/analysis/analysis-result.json`. It presents pending recommendations one-by-one, asking the user to choose: apply, skip, or permanently ignore. Apply dispatches to the applier registry. Skip does nothing (leaves as pending). Ignore calls `updateStatus(id, 'dismissed')`.

**When to use:** Always -- this is the core CMD-02 requirement.

### Anti-Patterns to Avoid

- **Embedding executable logic in slash command Markdown:** Slash commands are prompts for Claude, not scripts. Don't try to write JavaScript in the .md file. Instead, have the command instruct Claude to run CLI commands or use its tools.
- **Using `.claude/skills/` when `.claude/commands/` suffices:** Skills add complexity (directory per skill, SKILL.md naming). For simple single-file commands, `.claude/commands/evolve/scan.md` is simpler and equivalent.
- **Hardcoding absolute paths in command templates:** The data directory (`~/.harness-evolve/`) uses `$HOME` which varies. Either inject at install time or instruct Claude to use `harness-evolve` CLI commands that handle path resolution internally.
- **Making apply fully automated without user confirmation:** CMD-02 explicitly requires one-by-one user interaction. The apply command must present each recommendation and wait for user choice.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slash command format | Custom file format | Standard `.claude/commands/*.md` with YAML frontmatter | Claude Code's built-in format, well-documented |
| File installation to project | Complex installer | `mkdir -p` + `writeFile` (already used by init) | Simple fs operations, no framework needed |
| User interaction in apply | Custom readline UI | Claude's natural conversation flow | `/evolve:apply` is a slash command -- Claude handles the conversation |
| Recommendation iteration | Custom iteration protocol | Read JSON state file, present in conversation | Claude can read JSON and iterate natively |
| Applier dispatch | New dispatch system | Existing applier registry (`getApplier()`) | 4 appliers already registered and working |

**Key insight:** Slash commands delegate the UX to Claude itself. harness-evolve provides the data (recommendations, state) and the tools (CLI commands, applier registry), and the slash command's Markdown content tells Claude how to orchestrate the workflow conversationally.

## Common Pitfalls

### Pitfall 1: Slash Command File Not Discovered by Claude Code

**What goes wrong:** Installed command files don't appear in Claude's `/` autocomplete.
**Why it happens:** Wrong directory structure, wrong file naming, or project-level `.claude/` directory doesn't exist.
**How to avoid:** Always create `.claude/commands/evolve/` with `mkdir -p` before writing files. Verify the subdirectory naming produces the expected `/evolve:scan` command (colon separator from subdirectory).
**Warning signs:** User reports `/evolve:scan` not found after init.

### Pitfall 2: Init Overwrites User-Modified Command Files

**What goes wrong:** Running `harness-evolve init` a second time overwrites user customizations to the command files.
**Why it happens:** Naive `writeFile` without checking existing content.
**How to avoid:** Check if command files exist before writing. If they exist, skip or offer to overwrite (similar to how `mergeHooks` skips already-registered hooks). Print a message indicating files already installed.
**Warning signs:** User complains about lost customizations after re-init.

### Pitfall 3: Uninstall Leaves Orphan `.claude/commands/evolve/` Directory

**What goes wrong:** After uninstall, empty directory remains.
**Why it happens:** Only removing files but not cleaning up the parent directory.
**How to avoid:** After removing files, attempt `rmdir` on the `evolve/` directory (only succeeds if empty, which is correct behavior -- don't remove if user added their own files there).
**Warning signs:** Stale empty directories after uninstall.

### Pitfall 4: `/evolve:apply` Fails When No Analysis Has Run

**What goes wrong:** User runs `/evolve:apply` before any analysis has been triggered. No recommendation-state.json or analysis-result.json exists.
**Why it happens:** Fresh install with <50 interactions.
**How to avoid:** The slash command instructions should handle the empty case gracefully -- instruct Claude to check if recommendations exist and suggest running `/evolve:scan` first if none found.
**Warning signs:** Claude errors out or reports "no file found."

### Pitfall 5: CLI `scan` Subcommand Conflicts with Existing Commands

**What goes wrong:** Adding a `scan` subcommand to the CLI might interfere with existing `init`/`status`/`uninstall`.
**Why it happens:** Commander.js doesn't prevent conflicts but won't have issues since these are distinct names.
**How to avoid:** Register `scan` as a proper Commander.js subcommand alongside the existing three. Straightforward and no risk of collision.
**Warning signs:** None expected -- Commander.js handles distinct subcommand names cleanly.

### Pitfall 6: Slash Command Contains Stale Data Paths

**What goes wrong:** Command file references `~/.harness-evolve/` paths that might differ on some systems.
**Why it happens:** Hardcoded paths in the Markdown template.
**How to avoid:** Instead of referencing file paths directly, have the command instruct Claude to use `harness-evolve status` or `harness-evolve scan` CLI commands that handle path resolution internally.
**Warning signs:** Commands fail on systems with non-standard HOME.

## Code Examples

### Slash Command: /evolve:scan

```markdown
---
name: scan
description: Run a deep harness-evolve configuration scan to detect quality issues
disable-model-invocation: true
---

# Evolve Scan

Run a deep scan of the current project's Claude Code configuration.

## What This Does

Analyzes CLAUDE.md, .claude/rules/, settings.json, and .claude/commands/ to detect:
- Redundant rules (same constraint in multiple files)
- Missing mechanization (operations in rules that should be hooks)
- Stale config (references to non-existent files or commands)

## Instructions

Run the scan CLI command:
```bash
npx harness-evolve scan
```

Present the results grouped by confidence level (HIGH first).
If issues are found, suggest running /evolve:apply to review and fix them.
```

### Slash Command: /evolve:apply

```markdown
---
name: apply
description: Review and apply pending harness-evolve recommendations one by one
disable-model-invocation: true
argument-hint: "[filter: all|high|medium|low]"
---

# Evolve Apply

Review pending recommendations interactively.

## Instructions

1. Read the pending recommendations:
   ```bash
   npx harness-evolve pending
   ```

2. For each pending recommendation, present:
   - Confidence level and title
   - Description and evidence
   - Suggested action

3. Ask the user to choose:
   - **apply**: Apply the recommendation
   - **skip**: Skip for now (remains pending)
   - **ignore**: Permanently dismiss

4. Execute the user's choice using the harness-evolve CLI.
```

### CLI Scan Command Registration

```typescript
// In cli.ts or cli/scan.ts
export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Run deep configuration scan')
    .action(async () => {
      const { runDeepScan } = await import('../scan/index.js');
      const result = await runDeepScan(process.cwd());
      // Output as structured JSON for slash command consumption
      console.log(JSON.stringify(result, null, 2));
    });
}
```

### Init Extension: Install Slash Commands

```typescript
// Extension to runInit in cli/init.ts
async function installSlashCommands(
  projectDir: string,
): Promise<void> {
  const commandsDir = join(projectDir, '.claude', 'commands', 'evolve');
  await mkdir(commandsDir, { recursive: true });

  // Generate and write each command file
  const scanContent = generateScanCommand();
  const applyContent = generateApplyCommand();

  const scanPath = join(commandsDir, 'scan.md');
  const applyPath = join(commandsDir, 'apply.md');

  // Create-only guard
  for (const { path, content, name } of [
    { path: scanPath, content: scanContent, name: 'scan' },
    { path: applyPath, content: applyContent, name: 'apply' },
  ]) {
    try {
      await access(path);
      console.log(`  /evolve:${name} already installed, skipping`);
    } catch {
      await writeFile(path, content, 'utf-8');
      console.log(`  /evolve:${name} installed`);
    }
  }
}
```

### Uninstall Extension: Remove Slash Commands

```typescript
// Extension to runUninstall in cli/uninstall.ts
async function removeSlashCommands(
  projectDir: string,
): Promise<void> {
  const commandsDir = join(projectDir, '.claude', 'commands', 'evolve');

  for (const file of ['scan.md', 'apply.md']) {
    try {
      await rm(join(commandsDir, file));
      console.log(`  Removed /evolve:${file.replace('.md', '')}`);
    } catch {
      // File doesn't exist -- nothing to remove
    }
  }

  // Try to remove empty directory
  try {
    await rmdir(commandsDir);
  } catch {
    // Directory not empty (user files) or doesn't exist -- leave it
  }
}
```

### CLI Pending Command (for /evolve:apply)

```typescript
// New CLI subcommand: harness-evolve pending
export function registerPendingCommand(program: Command): void {
  program
    .command('pending')
    .description('List pending recommendations as JSON')
    .action(async () => {
      const state = await loadState();
      const pending = state.entries.filter(e => e.status === 'pending');
      // Also load full recommendation data from analysis result
      const analysisResult = await loadAnalysisResult();
      const pendingRecs = analysisResult.recommendations.filter(
        rec => pending.some(p => p.id === rec.id)
      );
      console.log(JSON.stringify({ pending: pendingRecs }, null, 2));
    });
}
```

### CLI Apply-One and Dismiss Commands (for /evolve:apply actions)

```typescript
// New CLI subcommands for individual recommendation actions
export function registerApplyOneCommand(program: Command): void {
  program
    .command('apply-one')
    .description('Apply a single recommendation by ID')
    .argument('<id>', 'Recommendation ID')
    .action(async (id) => {
      // Load recommendation, find applier, execute
      const result = await applySingleRecommendation(id);
      console.log(JSON.stringify(result));
    });
}

export function registerDismissCommand(program: Command): void {
  program
    .command('dismiss')
    .description('Permanently dismiss a recommendation by ID')
    .argument('<id>', 'Recommendation ID')
    .action(async (id) => {
      await updateStatus(id, 'dismissed', 'Dismissed by user via /evolve:apply');
      console.log(JSON.stringify({ id, status: 'dismissed' }));
    });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.claude/commands/*.md` only | `.claude/skills/<name>/SKILL.md` also supported | 2026 (Claude Code update) | Commands and skills merged; both formats work, commands are simpler for single-file use cases |
| No YAML frontmatter | Full YAML frontmatter support | 2026 | `disable-model-invocation`, `allowed-tools`, `description` etc. available |
| No shell injection | `` !`command` `` syntax for dynamic context | 2026 | Commands can inject live data before Claude sees them |
| No argument passing | `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N` substitution | 2026 | Commands can accept user parameters |

**Deprecated/outdated:**
- The `.claude/commands/` format is technically "legacy" per Anthropic docs, but explicitly stated as continuing to work. Skills are recommended for new complex multi-file commands but commands are fine for simple single-file use.

## Open Questions

1. **Project directory for slash command installation**
   - What we know: `harness-evolve init` currently works at the global level (`~/.claude/settings.json`). Slash commands need to be installed in a project's `.claude/commands/` directory.
   - What's unclear: Should init install to `process.cwd()/.claude/commands/` (the project the user ran init from)? This seems correct since Claude Code slash commands at project level are project-scoped.
   - Recommendation: Use `process.cwd()` as the project root for slash command installation. Add a `--project-dir` option for override. This matches how `runDeepScan(process.cwd())` already works.

2. **New CLI subcommands needed**
   - What we know: `/evolve:apply` needs to trigger individual apply and dismiss operations. Currently, auto-apply is batch-only and only for HIGH confidence.
   - What's unclear: Exact CLI subcommand names and signatures.
   - Recommendation: Add `scan`, `pending`, `apply-one <id>`, and `dismiss <id>` subcommands. The slash commands use these as their action interface. `apply-one` works for ANY confidence level (not just HIGH) since it's user-initiated.

3. **Should `/evolve:apply` call appliers directly or via CLI?**
   - What we know: The applier registry exists in-process. CLI subcommands are out-of-process.
   - What's unclear: Whether to have Claude call `harness-evolve apply-one <id>` (CLI) or use some other mechanism.
   - Recommendation: CLI subcommands. Slash commands instruct Claude to run shell commands. This is the natural pattern and avoids needing programmatic imports in the conversation context.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMD-01 | Init installs slash command files to `.claude/commands/evolve/` | unit | `npx vitest run tests/unit/cli/init.test.ts -t "slash commands" -x` | Extend existing |
| CMD-02 | /evolve:apply workflow (pending list, apply-one, dismiss) | unit | `npx vitest run tests/unit/cli/apply.test.ts -x` | Wave 0 |
| CMD-03 | Uninstall removes slash command files | unit | `npx vitest run tests/unit/cli/uninstall.test.ts -t "slash commands" -x` | Extend existing |
| SCN-04 | CLI scan subcommand triggers deep scan and outputs JSON | unit | `npx vitest run tests/unit/cli/scan.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=dot`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/cli/scan.test.ts` -- covers SCN-04 (CLI scan subcommand)
- [ ] `tests/unit/cli/apply.test.ts` -- covers CMD-02 (pending, apply-one, dismiss commands)
- [ ] `tests/unit/commands/templates.test.ts` -- covers CMD-01 (slash command template content validation)
- [ ] Extend `tests/unit/cli/init.test.ts` -- covers CMD-01 (install slash commands during init)
- [ ] Extend `tests/unit/cli/uninstall.test.ts` -- covers CMD-03 (remove slash commands during uninstall)

## Sources

### Primary (HIGH confidence)
- Claude Code Official Skills Documentation: https://code.claude.com/docs/en/skills -- comprehensive reference on slash commands, YAML frontmatter, directory structure, namespacing, argument passing, and shell injection
- Existing codebase: `src/cli/init.ts`, `src/cli/uninstall.ts`, `src/cli/utils.ts` -- current CLI architecture
- Existing codebase: `src/scan/index.ts` -- `runDeepScan()` API
- Existing codebase: `src/delivery/appliers/index.ts` -- applier registry pattern
- Existing codebase: `src/delivery/state.ts` -- recommendation state management
- Existing codebase: `src/delivery/auto-apply.ts` -- auto-apply pipeline with all 4 appliers

### Secondary (MEDIUM confidence)
- [Claude Code Slash Commands Guide](https://felo.ai/blog/claude-code-slash-commands/) -- community guide confirming patterns
- [wshobson/commands](https://github.com/wshobson/commands) -- community slash command collection for pattern reference
- User's existing slash commands (`ClaudeGlance/build-dmg.md`, `openclaw/anti-pattern-czar.md`) -- real examples of the format in use

### Tertiary (LOW confidence)
- None -- all findings verified against official docs and codebase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, extending existing patterns
- Architecture: HIGH -- slash command format well-documented, CLI extension straightforward
- Pitfalls: HIGH -- identified from direct codebase analysis and Claude Code docs

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable -- slash command format is settled)
