# Phase 24: Context Infrastructure & Legacy Cleanup - Research

**Researched:** 2026-04-11
**Domain:** CLI infrastructure, Zod schema design, scan-context output structure
**Confidence:** HIGH

## Summary

Phase 24 addresses two specific requirements: (1) scan-context output must label each config source with its scope (project vs user), and (2) the deprecated `scan` CLI must be removed or redirected. Both are straightforward infrastructure changes with clear implementation paths.

The current codebase already has partial scope labeling -- `claude_md_files` and `hooks_registered` both carry a `scope` field, and `settings` uses `user`/`project`/`local` as object keys. The gap is: `commands` are only read from project-level (missing global `~/.claude/commands/`) and have no scope field, and the overall output lacks a top-level indicator telling the model which sources are project-scoped vs user-global. The deprecated `scan` CLI currently outputs context data with a deprecation notice to stderr but still functions -- it should be fully removed.

**Primary recommendation:** Add a `scope` field to the `commands` schema, read global commands from `~/.claude/commands/`, and replace the `scan` CLI registration with a hard error pointing to `/evolve:scan`. Add a top-level `scope_summary` object to the ScanContext output so the model can instantly understand the project/user separation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion -- pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from dogfooding:
- `harness-evolve scan-context` currently outputs user-global settings (all hooks, MCP permissions) mixed with project-level config -- this confuses analysis when run in a project subdirectory
- `harness-evolve scan` (deprecated) still produces 21 false-positive findings about "empty hooks" and "duplicate registrations" because it runs old code-based scanners that were removed in v4.0
- The deprecated `scan` CLI should either error with a message pointing to `/evolve:scan`, or be fully removed

### Claude's Discretion
All implementation choices for this infrastructure phase.

### Deferred Ideas (OUT OF SCOPE)
None -- infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEGACY-01 | Deprecated `harness-evolve scan` CLI subcommand is removed or redirected to `scan-context`, no longer producing false-positive findings | Remove `registerScanCommand`, delete `src/cli/scan.ts`, update CLI registration in `src/cli.ts` to either remove or replace with error-only command |
| LEGACY-02 | `harness-evolve scan-context` output distinguishes project-level config from user-global config, labeling each config source (project/user scope) | Add `scope` field to commands schema, read global commands, add top-level `scope_summary` to ScanContext output |
</phase_requirements>

## Standard Stack

### Core (No new dependencies needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | ^4.3.6 | Schema updates for new fields | Already in use, schema-first approach |
| Commander.js | ^14.0.3 | CLI command removal/replacement | Already in use |
| node:fs/promises | built-in | Read global commands directory | Already in use |

No new packages needed. This phase modifies existing code only.

## Architecture Patterns

### Current scan-context Data Flow
```
buildScanContext(cwd, home)
  ├── readClaudeMdFiles(cwd, home)     → claude_md_files[] with scope
  ├── readRuleFiles(cwd)               → rules[] (project-only, no scope field)
  ├── readAllSettings(cwd, home)       → settings { user, project, local }
  ├── readCommandFiles(cwd)            → commands[] (project-only, no scope field)
  └── extractHooksFromAllSettings()    → hooks_registered[] with scope
```

### Required Changes
```
buildScanContext(cwd, home)
  ├── readClaudeMdFiles(cwd, home)     → [unchanged, already has scope]
  ├── readRuleFiles(cwd)               → rules[] [add scope: 'project' field]
  ├── readAllSettings(cwd, home)       → [unchanged, already scoped by key]
  ├── readCommandFiles(cwd, home)      → commands[] [read global + project, add scope]
  ├── extractHooksFromAllSettings()    → [unchanged, already has scope]
  └── buildScopeSummary()              → NEW: top-level scope_summary object
```

### Pattern 1: Scope-Labeled Command Reading
**What:** Read commands from both project `.claude/commands/` and global `~/.claude/commands/`, labeling each with scope.
**When to use:** When building ScanContext.
**Example:**
```typescript
// src/scan/context-builder.ts
async function readCommandFiles(
  cwd: string,
  home: string,
): Promise<ScanContext['commands']> {
  const locations = [
    { dir: join(cwd, '.claude', 'commands'), scope: 'project' as const },
    { dir: join(home, '.claude', 'commands'), scope: 'user' as const },
  ];

  const commands: ScanContext['commands'] = [];
  for (const loc of locations) {
    // Read .md files recursively (handles subdirs like evolve/)
    const mdFiles = await collectMdFilesFlat(loc.dir);
    for (const filePath of mdFiles) {
      const content = await readFileSafe(filePath);
      if (content !== null) {
        commands.push({
          path: filePath,
          name: basename(filePath, '.md'),
          scope: loc.scope,
          content,
        });
      }
    }
  }
  return commands;
}
```

### Pattern 2: Deprecated CLI Removal
**What:** Replace `registerScanCommand` with a hard-error command that tells users about `/evolve:scan`.
**When to use:** Removing deprecated functionality while preserving discoverability.
**Example:**
```typescript
// Option A: Remove entirely (user gets Commander's built-in "unknown command" error)
// Option B: Keep as error-only command (better UX)
export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('[REMOVED] Use /evolve:scan in Claude Code instead')
    .action(() => {
      console.error(
        'Error: The "scan" subcommand was removed in v5.0.\n\n' +
        'Use /evolve:scan in Claude Code for model-driven analysis.\n' +
        'Or use "harness-evolve scan-context" for raw configuration JSON.\n'
      );
      process.exitCode = 1;
    });
}
```

### Pattern 3: Top-Level Scope Summary
**What:** Add a `scope_summary` field at the root of ScanContext that tells the model at a glance what scopes are present.
**When to use:** Helps the model distinguish project config from user-global noise.
**Example:**
```typescript
// Added to ScanContext schema
scope_summary: z.object({
  project_sources: z.number(), // count of project-scoped items
  user_sources: z.number(),    // count of user-scoped items
  has_project_config: z.boolean(),
  has_user_config: z.boolean(),
})
```

### Anti-Patterns to Avoid
- **Filtering out user-global config entirely:** The model still needs to see it for hooks redundancy analysis. Label it, don't hide it.
- **Breaking the existing schema contract:** Add new fields, don't rename or remove existing ones (except `scan` CLI). The `scan-context` output is consumed by `/evolve:scan` template.
- **Nested directory traversal for commands without deduplication:** Global and project may both have `evolve/scan.md` -- show both with their scope, don't merge.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recursive directory reading | Custom recursive walker | Existing `collectMdFiles()` function in context-builder.ts | Already implemented and tested |
| Schema validation | Manual field checks | Zod schema with `.parse()` | Already the pattern for all ScanContext validation |
| Atomic settings writes | Manual fs.writeFile | Existing `writeSettings()` in cli/utils.ts | Already handles JSON formatting and errors |

## Common Pitfalls

### Pitfall 1: Breaking Schema Backward Compatibility
**What goes wrong:** Adding `scope` as a required field to `commands` schema breaks older consumers that don't expect it.
**Why it happens:** Zod schemas are strict by default.
**How to avoid:** Since this is the authoritative schema and `scan-context` is the only consumer path, this is fine -- just ensure the field is always populated. The `/evolve:scan` template doesn't validate the JSON schema itself, it just reads the fields.
**Warning signs:** Tests that mock ScanContext without the new fields will fail -- update all mocks.

### Pitfall 2: Commands Subdirectory Handling
**What goes wrong:** Global commands include subdirectories (e.g., `evolve/scan.md`, `gsd/`). Current `readCommandFiles` only reads top-level `.md` files, not subdirectories.
**Why it happens:** `readdir` without recursive option misses nested files.
**How to avoid:** Use the existing `collectMdFiles()` helper (recursive) and compute `name` as relative path without extension (e.g., `evolve/scan`).
**Warning signs:** `/evolve:scan` and `/evolve:apply` not appearing in commands output.

### Pitfall 3: Home Directory Resolution
**What goes wrong:** `process.env.HOME` can be empty in CI or edge environments.
**Why it happens:** Context builder already handles this with `home ?? process.env.HOME ?? ''`, but if empty, global reads silently return empty arrays.
**How to avoid:** Keep the existing fallback pattern. When `home` is empty, global commands/settings are simply absent.
**Warning signs:** Tests that don't pass `fakeHome` to `readCommandFiles`.

### Pitfall 4: Duplicate Commands Between Scopes
**What goes wrong:** A project might install evolve commands locally AND they exist globally, creating apparent duplicates in the output.
**Why it happens:** Both `~/.claude/commands/evolve/scan.md` and `.claude/commands/evolve/scan.md` exist.
**How to avoid:** Show both with their respective scopes. The model (and `init` command) already warns about stale project-level commands. Don't deduplicate -- let the model reason about it.
**Warning signs:** N/A -- this is expected behavior.

## Code Examples

### Existing ScanContext Schema (src/scan/schemas.ts)
```typescript
// Current commands schema -- no scope field
commands: z.array(
  z.object({
    path: z.string(),
    name: z.string(),
    content: z.string(),
  }),
),
```

### Required Schema Update
```typescript
// Updated commands schema with scope
commands: z.array(
  z.object({
    path: z.string(),
    name: z.string(),
    scope: z.enum(['user', 'project']),
    content: z.string(),
  }),
),

// New top-level field
scope_summary: z.object({
  project_sources: z.number(),
  user_sources: z.number(),
  has_project_config: z.boolean(),
  has_user_config: z.boolean(),
}),
```

### Files That Need Modification

| File | Change |
|------|--------|
| `src/scan/schemas.ts` | Add `scope` to commands, add `scope_summary` to root |
| `src/scan/context-builder.ts` | Update `readCommandFiles` to read global + project with scope labels; add rules scope; compute scope_summary |
| `src/cli/scan.ts` | Replace with hard error or remove |
| `src/cli.ts` | Update if `scan` is fully removed |
| `tests/unit/cli/scan.test.ts` | Update to test new error behavior or remove |
| `tests/unit/cli/scan-context.test.ts` | Update mocks to include new fields |
| `tests/unit/scan/context-builder.test.ts` | Add tests for global commands, scope labels, scope_summary |
| `tests/integration/cli-scan.test.ts` | Update for new behavior |
| `tests/integration/scan-pipeline-v4.test.ts` | Update mocks/assertions for new schema |

### Affected Entry Points
- `harness-evolve scan-context` -- output gains `scope_summary` and commands gain `scope`
- `harness-evolve scan` -- removed/error
- `/evolve:scan` template -- will consume richer output (no template changes needed in this phase)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/unit/scan/ tests/unit/cli/scan` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEGACY-01 | `scan` CLI errors with redirect message | unit | `npx vitest run tests/unit/cli/scan.test.ts -x` | Needs update |
| LEGACY-01 | `scan` CLI exit code is 1 | unit | `npx vitest run tests/unit/cli/scan.test.ts -x` | Needs update |
| LEGACY-02 | scan-context commands have scope field | unit | `npx vitest run tests/unit/scan/context-builder.test.ts -x` | Needs new tests |
| LEGACY-02 | scan-context reads global commands | unit | `npx vitest run tests/unit/scan/context-builder.test.ts -x` | Needs new tests |
| LEGACY-02 | scan-context scope_summary is computed | unit | `npx vitest run tests/unit/scan/context-builder.test.ts -x` | Needs new tests |
| LEGACY-02 | schema validates with new fields | unit | `npx vitest run tests/unit/scan/schemas.test.ts -x` | Needs update |
| LEGACY-02 | integration: real filesystem reads both scopes | integration | `npx vitest run tests/integration/cli-scan.test.ts -x` | Needs update |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/scan/ tests/unit/cli/scan`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update `tests/unit/cli/scan.test.ts` -- test new error behavior for removed `scan` CLI
- [ ] Add scope tests to `tests/unit/scan/context-builder.test.ts` -- global commands, scope_summary
- [ ] Update all test mocks that use `commands: []` to include `scope` field
- [ ] Update `tests/integration/scan-pipeline-v4.test.ts` for schema changes

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/scan/context-builder.ts`, `src/scan/schemas.ts`, `src/cli/scan.ts`, `src/cli/scan-context.ts`
- Live `scan-context` output analysis (ran locally, verified actual structure)
- Claude Code filesystem layout: verified `~/.claude/commands/evolve/` structure

### Secondary (MEDIUM confidence)
- Claude Code documentation on settings hierarchy (user > project > local)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, pure refactor of existing code
- Architecture: HIGH - clear data flow changes, well-understood codebase patterns
- Pitfalls: HIGH - based on direct code analysis and schema inspection

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable infrastructure, no external dependency changes expected)
