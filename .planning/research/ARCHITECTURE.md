# Architecture Patterns — v1.1 Stabilization & Production

**Domain:** Self-improving Claude Code harness system (harness-evolve)
**Researched:** 2026-04-02
**Focus:** CLI integration, npm bin entries, CI/CD pipeline, auto-apply scope expansion
**Confidence:** HIGH (based on codebase analysis + official docs + verified patterns)

## Existing Architecture Summary

The v1.0 codebase has a clean, layered architecture:

```
src/
├── hooks/           5 lifecycle handlers + shared utils (stdin, summarize)
├── analysis/        pre-processor, trigger, analyzer, environment-scanner
│   └── classifiers/ 8 classifiers (repeated-prompts, long-prompts, etc.)
├── delivery/        renderer, state, rotator, notification, auto-apply, run-evolve
├── storage/         config, counter, dirs, logger
├── schemas/         Zod v4 schemas (config, hook-input, log-entry, recommendation, delivery, onboarding, counter)
└── scrubber/        secret patterns + scrub functions
```

**Build output (tsup):** 8 entry points producing flat JS files:
- `dist/index.js` — Library exports
- `dist/hooks/{user-prompt-submit,pre-tool-use,post-tool-use,post-tool-use-failure,permission-request,stop}.js` — Hook entry points (standalone executables)
- `dist/delivery/run-evolve.js` — /evolve skill entry point

**Key design invariant:** Hook entry points are self-contained executables with `main()` functions that read stdin and call handler functions. They must be runnable standalone via `node dist/hooks/stop.js`.

## Integration Point 1: CLI Commands + tsup Build

### Problem

The project needs a `harness-evolve` CLI command (at minimum `harness-evolve init`) for hook registration setup. This must integrate with the existing tsup multi-entry build without disrupting the 8 existing entry points.

### Recommended Approach: New `src/cli.ts` Entry Point

Add a single new tsup entry for the CLI:

```typescript
// tsup.config.ts — add one entry
entry: {
  // ... existing 8 entries unchanged ...
  'cli': 'src/cli.ts',   // NEW: CLI entry point
}
```

The `src/cli.ts` file starts with a shebang:
```typescript
#!/usr/bin/env node
// CLI entry point for harness-evolve
import { program } from 'commander';
// ... subcommand definitions
```

**tsup shebang handling (HIGH confidence):** When a source file contains `#!/usr/bin/env node`, tsup automatically preserves the shebang in the output and marks the file as executable (`chmod +x`). No manual `chmod` or post-build scripts needed.

This produces `dist/cli.js` which is directly executable.

### package.json bin Field

```json
{
  "bin": {
    "harness-evolve": "./dist/cli.js"
  }
}
```

When installed globally (`npm install -g harness-evolve`) or via npx (`npx harness-evolve init`), npm symlinks `dist/cli.js` to the user's PATH as `harness-evolve`.

### package.json exports Field

The existing `"main": "dist/index.js"` and `"types": "dist/index.d.ts"` serve library consumers. For v1.1, add an `exports` map for explicit subpath exports:

```json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

**Why ESM-only (no CJS dual format):** The project already uses `"type": "module"` and targets Node 22+. All hook entry points are ESM. Adding CJS support would double the build output for zero benefit — Claude Code runs Node 22+ and all consumers are ESM. This aligns with the 2025+ trend of ESM-only packages for Node 22+ targets.

### CLI Structure (Commander.js)

```
src/
├── cli.ts                 # Entry point with shebang, top-level program
└── cli/
    ├── init.ts            # `harness-evolve init` — register hooks in settings.json
    ├── status.ts          # `harness-evolve status` — show current state
    └── config.ts          # `harness-evolve config` — view/edit config
```

**Subcommand pattern:** Each subcommand exports a function that receives the Commander `program` and registers itself. `cli.ts` imports and composes them:

```typescript
#!/usr/bin/env node
import { program } from 'commander';
import { registerInit } from './cli/init.js';
import { registerStatus } from './cli/status.js';

program.name('harness-evolve').version('1.1.0');
registerInit(program);
registerStatus(program);
program.parse();
```

This pattern keeps the main entry minimal and allows adding subcommands without touching cli.ts.

### What `init` Does

The `init` command automates hook registration in `~/.claude/settings.json`:

1. Read existing settings.json (or create default)
2. For each hook event (UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest, Stop):
   - Check if harness-evolve handler already registered
   - If not, append `{ "type": "command", "command": "node /path/to/dist/hooks/<event>.js" }`
3. Write settings.json atomically (using write-file-atomic, already a dependency)
4. Report what was added/skipped

**Path resolution:** The hook command paths must be absolute because Claude Code resolves them from its own process cwd, not the user's cwd. `init` resolves `__dirname` to find the installed dist/ location.

### Impact on Existing Architecture

| Component | Change | Risk |
|-----------|--------|------|
| tsup.config.ts | Add 1 entry (`cli`) | NONE — additive, existing entries unchanged |
| package.json | Add `bin`, `exports`, add `commander` dep | LOW — no existing fields modified |
| src/ | Add `cli.ts` + `cli/` directory | NONE — new files, no modifications |
| dist/ | Adds `dist/cli.js` | NONE — existing outputs unchanged |

**Dependency addition:** `commander` (^14.0.3) and `@commander-js/extra-typings` (^14.x) are new runtime and dev dependencies respectively. This is the only new dependency for CLI support.

## Integration Point 2: npm Publishing Setup

### package.json Metadata

Required fields for npm publish that are currently missing:

```json
{
  "description": "Self-improving engine for Claude Code harnesses — detects patterns, routes optimizations",
  "keywords": ["claude-code", "hooks", "self-improving", "automation", "harness"],
  "author": "r1ckyIn <rickyqin919@gmail.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/r1ckyIn/harness-evolve.git"
  },
  "homepage": "https://github.com/r1ckyIn/harness-evolve#readme",
  "bugs": {
    "url": "https://github.com/r1ckyIn/harness-evolve/issues"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ]
}
```

**The `files` field is critical:** Without it, npm publishes everything not in `.gitignore`. The `files` whitelist ensures only `dist/`, `README.md`, and `LICENSE` are included. This excludes `src/`, `tests/`, `.planning/`, `CLAUDE.md`, and other development artifacts.

### npx Support

npx support comes automatically from the `bin` field. When a user runs `npx harness-evolve init`, npm:
1. Downloads the package to a temp cache
2. Resolves the `bin.harness-evolve` entry
3. Executes `dist/cli.js`

No additional configuration needed.

### prepublishOnly Script

```json
{
  "scripts": {
    "prepublishOnly": "npm run build && npm run test && npm run typecheck"
  }
}
```

This prevents accidental publishing of broken code.

## Integration Point 3: CI/CD Pipeline (GitHub Actions)

### Recommended Workflow Structure

Two separate workflows:

**1. `ci.yml` — Runs on every push/PR**

```yaml
name: CI
on:
  push:
    branches: [main, 'feature/**']
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm run typecheck
      - run: npm test
```

**2. `publish.yml` — Runs on version tag push**

```yaml
name: Publish
on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write    # Required for npm OIDC trusted publishing
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: 'https://registry.npmjs.org'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm run typecheck
      - run: npm test
      - run: npm publish --provenance --access public
```

### npm Trusted Publishing (OIDC)

**Recommended over NPM_TOKEN (HIGH confidence).** Since July 2025, npm supports OIDC-based trusted publishing from GitHub Actions. This eliminates the need for long-lived NPM tokens stored as repository secrets.

Setup:
1. On npmjs.com, link the GitHub repository to the package
2. Configure trusted publisher: org/user = `r1ckyIn`, repository = `harness-evolve`, workflow = `publish.yml`
3. The `id-token: write` permission in the workflow allows GitHub to generate OIDC tokens
4. `npm publish --provenance` automatically uses OIDC authentication
5. Provenance attestations are generated automatically

**No NPM_TOKEN secret needed** when using OIDC. The `npm publish` command automatically detects the OIDC environment.

### Why Two Separate Workflows

| Aspect | ci.yml | publish.yml |
|--------|--------|-------------|
| Trigger | Push + PR | Tag push only |
| Permissions | Default (read) | id-token: write |
| Purpose | Gate PRs | Publish to npm |
| Failure impact | Blocks merge | Blocks release |

Separating them follows the principle of least privilege — only the publish workflow has token-minting permission.

### Test Coverage in CI

The existing test suite (336 tests, 37 files) runs via `npm test` (Vitest). No special CI configuration needed — Vitest detects CI mode automatically and disables watch mode.

**One concern:** The flaky concurrent-counter test. If this test fails intermittently in CI, it will block PRs. The v1.1 tech debt fix for this test should happen before CI setup to avoid CI noise.

## Integration Point 4: Expanding Auto-Apply Scope

### Current State

`auto-apply.ts` currently handles only one pattern:

```
if (rec.pattern_type !== 'permission-always-approved') {
  return { success: false, details: 'Skipped: pattern_type not supported...' };
}
```

It modifies `~/.claude/settings.json` by adding tools to `allowedTools`. All other recommendation types (HOOK, SKILL, RULE, CLAUDE_MD, MEMORY) are skipped.

### Expansion Strategy: Strategy Pattern for Target-Specific Appliers

The current monolithic `applySingleRecommendation` function checks pattern_type with an if-statement. As more targets are supported, this should use a strategy pattern:

```
src/delivery/
├── auto-apply.ts            # Orchestrator (exists, refactored)
└── appliers/
    ├── index.ts             # Applier registry
    ├── settings-applier.ts  # settings.json modifications (extracted from current auto-apply)
    ├── rule-applier.ts      # NEW: create .claude/rules/*.md files
    └── hook-applier.ts      # NEW: register hooks in settings.json
```

### Applier Interface

```typescript
interface Applier {
  /** Which recommendation targets this applier handles */
  targets: RoutingTarget[];
  /** Which pattern_types within those targets are supported */
  supportedPatterns: string[];
  /** Apply a single recommendation. Returns success/failure with details. */
  apply(rec: Recommendation, options?: ApplyOptions): Promise<AutoApplyResult>;
  /** Create a backup before modification */
  backup(rec: Recommendation): Promise<string>;
}
```

### Safe Expansion Order (by blast radius)

| Priority | Target | What It Modifies | Blast Radius | Rationale |
|----------|--------|-----------------|--------------|-----------|
| 1 (done) | SETTINGS (allowedTools) | `~/.claude/settings.json` | LOW | Only adds items to an array. Easily reversible. |
| 2 | RULE | `.claude/rules/*.md` | LOW | Creates new files only. Never modifies existing rules. Easily deletable. |
| 3 | HOOK | `~/.claude/settings.json` hooks array | MEDIUM | Adds hook registrations. Could conflict with existing hooks. Needs duplicate detection. |
| 4 | MEMORY | `~/.claude/projects/*/memory/*.md` | MEDIUM | Creates memory entries. Could duplicate. Needs dedup logic. |
| 5 | CLAUDE_MD | Project CLAUDE.md | HIGH | Appends to existing file. Hard to isolate changes. Defer. |
| 6 | SKILL | `.claude/skills/*.md` | HIGH | Creates executable skill files. Needs careful validation. Defer. |

### Architectural Constraints for Safe Auto-Apply

1. **Create-only, never modify** — New appliers should only create new files or append to arrays. Never modify existing file content (except JSON arrays where items are additive).

2. **Backup before every write** — The existing pattern of `copyFile(settingsFilePath, backup)` before modification must be preserved for all new appliers.

3. **Idempotency** — Running auto-apply twice with the same recommendation must produce the same result. Check if the target already exists before creating.

4. **Audit trail** — Every auto-apply attempt (success or failure) must be logged to `auto-apply-log.jsonl`. This is already implemented in the orchestrator and applies to all appliers.

5. **Config-gated** — `config.delivery.fullAuto` must still be the master switch. Consider adding per-target gates: `config.delivery.autoApplyTargets: ['SETTINGS', 'RULE']`.

### Impact on Existing Delivery Architecture

| Component | Change | Risk |
|-----------|--------|------|
| `auto-apply.ts` | Refactor to use applier registry instead of inline logic | MEDIUM — must preserve existing behavior exactly |
| `delivery/index.ts` | No change — `autoApplyRecommendations` export stays the same | NONE |
| `schemas/config.ts` | Add `autoApplyTargets` array field with default `['SETTINGS']` | LOW — Zod default ensures backward compatibility |
| `schemas/delivery.ts` | No change — `AutoApplyLogEntry` already has generic `target` field | NONE |
| `run-evolve.ts` | No change — calls `autoApplyRecommendations()` which handles all targets | NONE |

### Data Flow After Expansion

```
analyze() → recommendations[]
    │
    ▼
autoApplyRecommendations(recommendations)
    │
    ├── Filter: HIGH confidence + target in autoApplyTargets + pending status
    │
    ├── For each candidate:
    │   ├── Look up applier from registry by rec.target
    │   ├── Check if rec.pattern_type is in applier.supportedPatterns
    │   ├── applier.backup(rec) → backup path
    │   ├── applier.apply(rec) → AutoApplyResult
    │   ├── Log to auto-apply-log.jsonl
    │   └── Update recommendation state (applied/failed)
    │
    └── Return AutoApplyResult[]
```

## Integration Point 5: The inferPatternType String Mismatch Fix

### Problem

`inferPatternType` in the outcome tracker uses pattern_type strings to map recommendations back to classifiers for confidence adjustment. 7 of 8 classifiers use `pattern_type` values that don't match what `inferPatternType` expects, breaking the feedback loop.

### Fix Architecture

Introduce a shared `PatternType` enum (or Zod enum) that both classifiers and `inferPatternType` reference:

```typescript
// src/schemas/pattern-types.ts (NEW)
import { z } from 'zod/v4';

export const patternTypeSchema = z.enum([
  'repeated-command',
  'repeated-prompt',
  'long-prompt',
  'permission-always-approved',
  'code-correction',
  'personal-info',
  'config_drift',
  'ecosystem-adaptation',
  'onboarding',
]);
export type PatternType = z.infer<typeof patternTypeSchema>;
```

All classifiers and `inferPatternType` import from this single source. This directly addresses the v1.0 retrospective lesson: "String constants across module boundaries need a shared enum."

### Impact

| Component | Change |
|-----------|--------|
| `schemas/pattern-types.ts` | NEW — shared enum |
| `schemas/recommendation.ts` | Change `pattern_type: z.string()` to `pattern_type: patternTypeSchema` |
| All 8 classifiers | Use enum values instead of string literals |
| `analysis/outcome-tracker.ts` | `inferPatternType` uses enum values |
| Tests | Update pattern_type assertions to use enum values |

## Component Architecture: New vs Modified

### New Components

| Component | Path | Purpose | Dependencies |
|-----------|------|---------|--------------|
| CLI entry | `src/cli.ts` | Shebang entry point, Commander setup | commander, cli/* |
| CLI init | `src/cli/init.ts` | Register hooks in settings.json | storage/dirs, storage/config, write-file-atomic |
| CLI status | `src/cli/status.ts` | Show counter, last analysis, pending recs | storage/counter, delivery/state |
| CLI config | `src/cli/config.ts` | View/edit harness-evolve config | storage/config |
| Pattern types enum | `src/schemas/pattern-types.ts` | Shared pattern_type values | zod |
| Applier registry | `src/delivery/appliers/index.ts` | Map targets to applier implementations | applier implementations |
| Settings applier | `src/delivery/appliers/settings-applier.ts` | Extract from auto-apply.ts | write-file-atomic, storage/dirs |
| Rule applier | `src/delivery/appliers/rule-applier.ts` | Create .claude/rules/*.md files | node:fs/promises |
| CI workflow | `.github/workflows/ci.yml` | Build + test + typecheck on push/PR | N/A |
| Publish workflow | `.github/workflows/publish.yml` | npm publish on tag | N/A |

### Modified Components

| Component | Change Description | Risk |
|-----------|-------------------|------|
| `tsup.config.ts` | Add `cli` entry | NONE |
| `package.json` | Add bin, exports, metadata, commander dep, scripts | LOW |
| `src/delivery/auto-apply.ts` | Refactor to use applier registry | MEDIUM |
| `src/schemas/recommendation.ts` | pattern_type: z.string() -> patternTypeSchema | MEDIUM (breaks tests) |
| `src/analysis/outcome-tracker.ts` | Use shared pattern types enum | LOW |
| All 8 classifiers | Use enum pattern_type values | LOW (find-and-replace) |
| `src/schemas/config.ts` | Add autoApplyTargets field | LOW (Zod default) |
| `src/index.ts` | Export new symbols (PatternType, CLI utilities if needed) | NONE |

### Unchanged Components (Verify No Regression)

| Component | Why Unchanged |
|-----------|---------------|
| `src/hooks/*.ts` | Hook handlers are self-contained; CLI and auto-apply changes don't touch them |
| `src/storage/logger.ts` | Log format unchanged |
| `src/storage/counter.ts` | Counter logic unchanged |
| `src/storage/dirs.ts` | Directory structure unchanged |
| `src/scrubber/*` | Secret scrubbing unchanged |
| `src/analysis/pre-processor.ts` | Pre-processing unchanged |
| `src/analysis/environment-scanner.ts` | Environment scanning unchanged |
| `src/analysis/analyzer.ts` | Analyzer orchestration unchanged |
| `src/analysis/trigger.ts` | Trigger logic unchanged |
| `src/delivery/renderer.ts` | Rendering unchanged |
| `src/delivery/state.ts` | State tracking unchanged |
| `src/delivery/notification.ts` | Notification unchanged |
| `src/delivery/rotator.ts` | Rotation unchanged |
| `src/delivery/run-evolve.ts` | /evolve entry unchanged |

## Suggested Build Order

Based on dependency analysis, the v1.1 features should be built in this order:

```
Phase 1: Tech Debt (no dependencies, unblocks CI)
├── Fix inferPatternType string mismatch (shared pattern-types enum)
├── Fix flaky concurrent-counter test
└── Rationale: These must land before CI to prevent CI noise

Phase 2: CI/CD (depends on Phase 1: clean test suite)
├── .github/workflows/ci.yml
├── .github/workflows/publish.yml
├── npm metadata in package.json (files, exports, description, etc.)
├── prepublishOnly script
└── Rationale: CI validates all subsequent changes automatically

Phase 3: CLI + npm bin (depends on Phase 2: CI gates quality)
├── src/cli.ts (Commander.js setup with shebang)
├── src/cli/init.ts (hook registration)
├── src/cli/status.ts (optional, nice-to-have)
├── tsup.config.ts entry addition
├── package.json bin field
└── Rationale: CLI is the user-facing install experience

Phase 4: Auto-apply expansion (depends on Phase 1: shared enums)
├── src/delivery/appliers/ strategy pattern
├── Extract settings-applier from auto-apply.ts
├── Implement rule-applier
├── Config gate: autoApplyTargets
└── Rationale: Separate from CLI; independent concern
```

**Phase ordering rationale:**
- Phase 1 before Phase 2: CI must not be blocked by flaky tests or known bugs
- Phase 2 before Phase 3: CI validates CLI implementation as it's built
- Phase 1 before Phase 4: The shared pattern-types enum from the inferPatternType fix is used by the new applier registry for pattern matching
- Phase 3 and Phase 4 are independent and could theoretically run in parallel on separate branches, but sequential is safer given that Phase 4 refactors the delivery module

## Performance Budget

| New Component | Target Latency | Strategy |
|---------------|---------------|----------|
| `harness-evolve init` (CLI) | <2s | One-time operation. Read + validate + write settings.json. |
| `harness-evolve status` (CLI) | <500ms | Read counter.json + recommendation-state.json. Pure reads. |
| CI build + test | <3min | npm ci with cache. Vitest is fast (336 tests in <10s locally). |
| Rule auto-apply | <100ms per rule | `writeFile` to create a small .md file. |

## Anti-Patterns to Avoid

### Anti-Pattern 1: CLI Logic in Hook Entry Points

**What:** Putting CLI subcommand logic in the same files as hook handlers.

**Why bad:** Hook entry points must be minimal (read stdin, call handler, exit). Mixing CLI concerns adds import weight and startup time to every hook invocation. Hooks fire on every Claude Code interaction.

**Instead:** CLI lives in `src/cli/` and `src/cli.ts`. Hooks live in `src/hooks/`. They share library code via `src/storage/`, `src/schemas/`, etc. but never import from each other.

### Anti-Pattern 2: Single tsup Config for Different Build Targets

**What:** Trying to use `banner` or `define` options globally to add shebangs to all entry points.

**Why bad:** Only the CLI entry needs a shebang. Adding it to hook entry points is harmless but confusing. tsup handles shebangs automatically when the source file has one.

**Instead:** Put `#!/usr/bin/env node` in `src/cli.ts` only. tsup handles the rest.

### Anti-Pattern 3: Auto-Apply Modifying Existing File Content

**What:** Having the rule-applier or hook-applier modify the content of existing configuration files (e.g., editing an existing rule to add content).

**Why bad:** Merge conflicts, data loss, hard to audit. The v1.0 retrospective explicitly states: "Restrict auto-apply scope aggressively."

**Instead:** Create-only operations. New rule = new file. New hook = new entry in the hooks array. Never edit existing entries.

### Anti-Pattern 4: npm Publish Without Provenance

**What:** Publishing with `NPM_TOKEN` secret instead of OIDC trusted publishing.

**Why bad:** Long-lived tokens are a security risk. OIDC tokens are short-lived, scoped, and provide automatic provenance attestation.

**Instead:** Use OIDC trusted publishing with `id-token: write` permission. No secrets needed.

## Sources

### HIGH Confidence (Official Documentation)
- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) — OIDC setup for npm publishing
- [npm Provenance Statements](https://docs.npmjs.com/generating-provenance-statements/) — Provenance with OIDC
- [tsup Documentation](https://tsup.egoist.dev/) — Shebang handling, entry points, banner options
- [Commander.js](https://github.com/tj/commander.js) — CLI framework, subcommands
- [GitHub Actions setup-node](https://github.com/actions/setup-node) — Node.js CI setup

### MEDIUM Confidence (Verified Community Patterns)
- [npm OIDC GA Announcement](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/) — July 2025 announcement
- [Building TypeScript CLI with Commander](https://blog.logrocket.com/building-typescript-cli-node-js-commander/) — CLI patterns
- [Publishing ESM-based npm packages with TypeScript](https://2ality.com/2025/02/typescript-esm-packages.html) — ESM-only publishing patterns
- [Things you need to do for npm trusted publishing](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/) — Practical OIDC setup guide
- [Building npm packages with tsup + multiple entry points](https://dev.to/tigawanna/building-and-publishing-npm-packages-with-typescript-multiple-entry-points-tailwind-tsup-and-npm-9e7) — Multi-entry tsup patterns

### LOW Confidence (Single Source / Inference)
- Auto-apply expansion beyond SETTINGS is based on codebase analysis of classifier output patterns and existing auto-apply architecture. No external source validates the specific applier strategy pattern for this domain. However, the strategy pattern itself is a well-known OOP pattern with proven applicability.
