# Phase 14: Auto-Apply Closure - Research

**Researched:** 2026-04-04
**Domain:** Delivery pipeline applier strategy pattern extension (HookApplier + ClaudeMdApplier)
**Confidence:** HIGH

## Summary

Phase 14 closes the auto-apply loop by adding two new appliers -- `HookApplier` and `ClaudeMdApplier` -- to the existing strategy pattern registry in `src/delivery/appliers/`. The codebase already has a clean `Applier` interface, a `Map`-based registry, and two working appliers (`SettingsApplier`, `RuleApplier`) that demonstrate the exact pattern to follow. The generator module (Phase 13) already produces `GeneratedArtifact` objects with the content needed; the new appliers consume `Recommendation` objects (matching the existing interface contract) and internally call the generators to obtain the artifact content.

The hook format for Claude Code settings.json is well-documented and already implemented in the project's own `src/cli/utils.ts` (`mergeHooks` function). The HookApplier can reuse `mergeHooks` and `writeSettings` for settings.json registration, and `writeFile` + `chmod` for script creation. The ClaudeMdApplier faces a more nuanced challenge: the generator produces a "simplified unified diff" that is not a real patch -- for HIGH-confidence auto-apply, the safest approach is an append-only strategy (add new sections) rather than attempting to parse and apply pseudo-diffs.

**Primary recommendation:** Implement HookApplier and ClaudeMdApplier following the exact same patterns as SettingsApplier/RuleApplier, using `generateHook()`/`generateClaudeMdPatch()` internally to obtain content, with backup-before-write and create-only guards.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEN-04 | HOOK auto-applier registered in strategy pattern applier registry, HIGH confidence auto-apply | Applier interface documented, registry pattern clear, hook settings.json format researched, `mergeHooks` utility available for reuse |
| GEN-05 | CLAUDE_MD auto-applier registered in strategy pattern applier registry, HIGH confidence auto-apply | Applier interface documented, CLAUDE.md patch generator output analyzed, append-only strategy recommended over diff parsing |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Code comments MUST be pure English (no Chinese, no bilingual)
- GSD workflow enforcement: all changes through GSD commands
- Verification loop: Build -> Test -> Lint -> TypeCheck after every change
- Commit message format: `<type>(<phase>-<plan>): <description>` (GSD project)
- TDD approach: tests first, then implementation
- Technology stack: Node.js 22, TypeScript ~6.0, Zod 4, Vitest 4, write-file-atomic 7

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| write-file-atomic | ^7.0.0 | Atomic writes for settings.json and backup files | Already used by SettingsApplier and cli/utils.ts |
| zod | ^4.3.6 | Schema validation for recommendation input | Already used across all schemas |
| node:fs/promises | built-in | writeFile, copyFile, mkdir, access, chmod | Already used by both existing appliers |

### Supporting (Already Available)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/cli/utils.ts` | internal | `mergeHooks()`, `readSettings()`, `writeSettings()` | HookApplier reuses for settings.json registration |
| `src/generators/hook-generator.ts` | internal | `generateHook()` to obtain hook script content | HookApplier calls internally |
| `src/generators/claude-md-generator.ts` | internal | `generateClaudeMdPatch()` to obtain patch content | ClaudeMdApplier calls internally |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `mergeHooks` from cli/utils.ts | Custom hook registration logic in applier | Duplication; mergeHooks already handles dedup and user hook preservation |
| Append-only CLAUDE.md strategy | Real diff/patch application | Diff parsing is fragile on pseudo-diffs; append-only is safe and reversible |
| node:fs/promises chmod | Third-party permission lib | Unnecessary; `chmod(path, 0o755)` is one line |

**No new dependencies required.** All needed utilities exist in the project.

## Architecture Patterns

### Recommended Project Structure (New Files)

```
src/delivery/appliers/
  index.ts                  # (existing) Applier interface + registry
  settings-applier.ts       # (existing) SETTINGS target
  rule-applier.ts           # (existing) RULE target
  hook-applier.ts           # NEW: HOOK target
  claude-md-applier.ts      # NEW: CLAUDE_MD target

src/delivery/
  auto-apply.ts             # (modify) Register new appliers

tests/unit/delivery/
  auto-apply.test.ts        # (modify) Add HookApplier + ClaudeMdApplier tests
```

### Pattern 1: Applier Strategy Pattern (Existing, Follow Exactly)

**What:** Each applier implements `Applier` interface with `target`, `canApply()`, `apply()`. Registered via `registerApplier()` at module load in `auto-apply.ts`.

**When to use:** Every new auto-apply target type.

**Example (from existing SettingsApplier):**
```typescript
// Source: src/delivery/appliers/settings-applier.ts
export class SettingsApplier implements Applier {
  readonly target = 'SETTINGS';

  canApply(rec: Recommendation): boolean {
    return rec.confidence === 'HIGH' && rec.target === 'SETTINGS'
      && rec.pattern_type === 'permission-always-approved';
  }

  async apply(rec: Recommendation, options?: ApplierOptions): Promise<AutoApplyResult> {
    // 1. Read current state
    // 2. Create backup
    // 3. Modify state
    // 4. Atomic write
    // 5. Return result
  }
}
```

### Pattern 2: HookApplier Two-Step Write (New)

**What:** HookApplier performs two operations: (a) write the hook bash script to `.claude/hooks/`, (b) register the hook in settings.json.

**When to use:** HOOK-targeted recommendations with HIGH confidence.

**Design:**
```typescript
// Source: Research recommendation based on existing patterns
export class HookApplier implements Applier {
  readonly target = 'HOOK';

  canApply(rec: Recommendation): boolean {
    return rec.confidence === 'HIGH' && rec.target === 'HOOK';
  }

  async apply(rec: Recommendation, options?: ApplierOptions): Promise<AutoApplyResult> {
    // 1. Call generateHook(rec) to get GeneratedArtifact
    // 2. Determine hook dir (options.hooksDir or ~/.claude/hooks/)
    // 3. Create-only guard: check if file already exists
    // 4. Write script file with writeFile
    // 5. chmod +x the script file
    // 6. Read settings.json, backup, merge hook registration, atomic write
    // 7. Return result with details
  }
}
```

### Pattern 3: ClaudeMdApplier Append-Only (New)

**What:** ClaudeMdApplier appends a new section to CLAUDE.md rather than applying a real diff. The generator's "simplified unified diff" is used for metadata/display, but the actual write is append-only.

**When to use:** CLAUDE_MD-targeted recommendations with HIGH confidence.

**Design:**
```typescript
// Source: Research recommendation
export class ClaudeMdApplier implements Applier {
  readonly target = 'CLAUDE_MD';

  canApply(rec: Recommendation): boolean {
    return rec.confidence === 'HIGH' && rec.target === 'CLAUDE_MD';
  }

  async apply(rec: Recommendation, options?: ApplierOptions): Promise<AutoApplyResult> {
    // Pattern-type specific behavior:
    // - scan_stale_reference: Cannot safely auto-remove lines.
    //   Return success=false with advisory message.
    // - scan_redundancy: Cannot safely merge sections.
    //   Return success=false with advisory message.
    // - generic (config_drift, etc.): Append new section to CLAUDE.md
    //   1. Read current CLAUDE.md
    //   2. Backup
    //   3. Append "## {rec.title}\n\n{rec.suggested_action}\n"
    //   4. Atomic write
  }
}
```

### Pattern 4: ApplierOptions Extension

**What:** Extend `ApplierOptions` to support new paths needed by the new appliers.

**Design:**
```typescript
export interface ApplierOptions {
  settingsPath?: string;   // (existing) Override settings.json path
  rulesDir?: string;       // (existing) Override rules directory
  hooksDir?: string;       // NEW: Override hooks script directory
  claudeMdPath?: string;   // NEW: Override CLAUDE.md path
}
```

This is a backward-compatible extension -- existing callers don't need to change.

### Anti-Patterns to Avoid

- **Parsing the pseudo-diff for CLAUDE.md:** The generator produces a "simplified unified diff" that lacks real line numbers and context. Do NOT attempt `patch -p1` or line-by-line diff application. The format is `@@ description @@` not `@@ -1,3 +1,4 @@`.
- **Separate settings.json write for HookApplier:** The SettingsApplier already writes to settings.json for `allowedTools`. If both run in the same auto-apply cycle, they must not conflict. Use the shared `readSettings`/`writeSettings` pattern and handle the `hooks` key independently from `allowedTools`.
- **Overwriting user-customized hooks:** Follow the RuleApplier pattern -- create-only guard. If `evolve-{slug}.sh` already exists, return `success: false` rather than overwriting.
- **Modifying project CLAUDE.md:** The user's personal CLAUDE.md at `~/.claude/CLAUDE.md` or project root may contain critical configurations. Always backup before modification.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hook settings.json merge | Custom JSON manipulation for hooks key | `mergeHooks()` from `src/cli/utils.ts` | Already handles dedup, user hook preservation, matcher structure |
| Settings.json I/O | Raw readFile/writeFile | `readSettings()`/`writeSettings()` from `src/cli/utils.ts` | Handles missing files, atomic writes, 2-space indent |
| Hook script content | Template string in applier | `generateHook()` from generators module | Already tested, produces valid bash with shebang, stdin reading, event extraction |
| Atomic file writes | `writeFile` | `write-file-atomic` | Prevents corruption from concurrent Claude Code instances |

**Key insight:** The project already has all the building blocks. Phase 14 is a pure composition task -- wiring existing utilities (generators, settings I/O, atomic writes) into new Applier implementations.

## Common Pitfalls

### Pitfall 1: Settings.json Concurrent Modification

**What goes wrong:** HookApplier and SettingsApplier both modify settings.json in the same auto-apply cycle. Second write overwrites first.
**Why it happens:** `autoApplyRecommendations` processes candidates sequentially, but both appliers read-modify-write settings.json independently.
**How to avoid:** Sequential processing in `autoApplyRecommendations` already guarantees no concurrent modification within a single cycle. Each applier reads the latest state. This is safe as-is.
**Warning signs:** Test with both SETTINGS and HOOK recommendations in the same batch to verify.

### Pitfall 2: Hook Script Not Executable

**What goes wrong:** Hook script is written but Claude Code cannot execute it because it lacks execute permission.
**Why it happens:** `writeFile` creates files with default permissions (0o644). Bash scripts need 0o755.
**How to avoid:** Call `chmod(filePath, 0o755)` after writing the script file. Alternatively use `writeFile` with `mode` option.
**Warning signs:** Hook registered in settings.json but errors with "permission denied" at runtime.

### Pitfall 3: CLAUDE.md Destructive Modification

**What goes wrong:** Applier removes or modifies existing CLAUDE.md content, breaking user's configuration.
**Why it happens:** Attempting to apply the pseudo-diff literally (removing lines marked with `-`).
**How to avoid:** Append-only strategy for generic additions. Return `success: false` for removal patterns (`scan_stale_reference`, `scan_redundancy`) with an advisory message suggesting manual review.
**Warning signs:** User's CLAUDE.md loses content after auto-apply.

### Pitfall 4: Backup Path Collision

**What goes wrong:** Multiple backups overwrite each other because they use the same path.
**Why it happens:** Backup filename not unique per recommendation.
**How to avoid:** Follow SettingsApplier pattern: `{type}-backup-{rec.id}.{ext}` in `paths.analysis/backups/`.
**Warning signs:** Backup file contains wrong content after multiple applies.

### Pitfall 5: mergeHooks Import from CLI Module

**What goes wrong:** Importing from `src/cli/utils.ts` creates a dependency from `delivery` -> `cli`, potentially pulling in Commander.js and readline into the auto-apply path.
**Why it happens:** `cli/utils.ts` exports both hook utilities AND CLI-specific utilities (confirm prompt, Commander types).
**How to avoid:** Extract the pure functions (`mergeHooks`, `readSettings`, `writeSettings`, `HARNESS_EVOLVE_MARKER`) into a shared utility module (e.g., `src/shared/settings-io.ts`), or verify that the imports don't pull in heavy CLI deps. Alternatively, inline the hook merge logic in the applier (it's ~40 lines).
**Warning signs:** Bundle size increases unexpectedly; `readline` imported in non-interactive context.

**Recommended approach:** For Phase 14, directly import from `cli/utils.ts` since the functions are pure (no side effects, no CLI interaction). The `confirm` function and Commander types are not auto-imported by tree-shaking. If this causes issues, extract later.

### Pitfall 6: Hook Event Extraction Mismatch

**What goes wrong:** HookApplier registers the hook under the wrong event name in settings.json.
**Why it happens:** `extractHookEvent()` in `hook-generator.ts` parses event from description/suggested_action text. If the text doesn't match expected patterns, it falls back to `PreToolUse`.
**How to avoid:** Trust the generator's extraction (it's tested). The applier should read the `# Hook event: {event}` comment from the generated content to determine the registration event.
**Warning signs:** Hook script created for `UserPromptSubmit` but registered under `PreToolUse`.

## Code Examples

### Example 1: HookApplier Core Logic

```typescript
// Pseudocode -- not final implementation
import { generateHook } from '../../generators/hook-generator.js';
import { readSettings, writeSettings, mergeHooks } from '../../cli/utils.js';
import { writeFile, access, mkdir, chmod } from 'node:fs/promises';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';

// Inside apply():
const artifact = generateHook(rec);
if (!artifact) {
  return { recommendation_id: rec.id, success: false, details: 'Generator returned null' };
}

const hooksDir = options?.hooksDir ?? join(process.env.HOME ?? '', '.claude', 'hooks');
const scriptPath = join(hooksDir, artifact.filename.split('/').pop()!);

// Create-only guard
try { await access(scriptPath); return { ..., success: false, details: 'Hook file already exists' }; }
catch { /* proceed */ }

// Write script
await mkdir(hooksDir, { recursive: true });
await writeFile(scriptPath, artifact.content, 'utf-8');
await chmod(scriptPath, 0o755);

// Register in settings.json
const settingsPath = options?.settingsPath ?? join(process.env.HOME ?? '', '.claude', 'settings.json');
const settings = await readSettings(settingsPath);
// Backup
await copyFile(settingsPath, join(paths.analysis, 'backups', `settings-backup-${rec.id}.json`));

// Extract event from generated content
const eventMatch = artifact.content.match(/# Hook event: (\w+)/);
const hookEvent = eventMatch?.[1] ?? 'PreToolUse';

const merged = mergeHooks(settings, [{
  event: hookEvent,
  command: `bash "${scriptPath}"`,
  timeout: 10,
  async: true,
}]);
await writeSettings(merged, settingsPath);
```

### Example 2: ClaudeMdApplier Core Logic

```typescript
// Pseudocode -- not final implementation
import { readFile, copyFile, mkdir } from 'node:fs/promises';
import writeFileAtomic from 'write-file-atomic';
import { join, dirname } from 'node:path';

// Inside apply():
// Only auto-apply generic additions (not removals/consolidations)
if (rec.pattern_type === 'scan_stale_reference' || rec.pattern_type === 'scan_redundancy') {
  return {
    recommendation_id: rec.id,
    success: false,
    details: `Pattern type '${rec.pattern_type}' requires manual review -- cannot safely auto-apply`,
  };
}

const claudeMdPath = options?.claudeMdPath
  ?? join(process.cwd(), 'CLAUDE.md');

// Read existing content
let existing = '';
try { existing = await readFile(claudeMdPath, 'utf-8'); }
catch { /* File doesn't exist -- will create */ }

// Backup
if (existing) {
  const backup = join(paths.analysis, 'backups', `claudemd-backup-${rec.id}.md`);
  await mkdir(dirname(backup), { recursive: true });
  await writeFileAtomic(backup, existing);
}

// Append new section
const newSection = `\n\n## ${rec.title}\n\n${rec.suggested_action}\n\n---\n*Auto-generated by harness-evolve (${rec.id})*\n`;
const updated = existing + newSection;

await writeFileAtomic(claudeMdPath, updated);
```

### Example 3: Registration in auto-apply.ts

```typescript
// Source: src/delivery/auto-apply.ts (modification pattern)
import { HookApplier } from './appliers/hook-applier.js';
import { ClaudeMdApplier } from './appliers/claude-md-applier.js';

// Add alongside existing registrations:
registerApplier(new SettingsApplier());
registerApplier(new RuleApplier());
registerApplier(new HookApplier());       // NEW
registerApplier(new ClaudeMdApplier());   // NEW
```

### Example 4: ApplierOptions Extension

```typescript
// Source: src/delivery/appliers/index.ts (modification)
export interface ApplierOptions {
  settingsPath?: string;
  rulesDir?: string;
  hooksDir?: string;      // NEW: for HookApplier
  claudeMdPath?: string;  // NEW: for ClaudeMdApplier
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual recommendation review | Strategy-pattern auto-apply | Phase 9 (v1.1) | SettingsApplier + RuleApplier added |
| No generators | Generator module | Phase 13 | Hook + CLAUDE.md artifacts generated but not auto-applied |
| Hardcoded applier dispatch | Registry-based dispatch | Phase 10 refactor | Any new target just needs registerApplier() |

**Current gap:** Generators produce artifacts (hook scripts, CLAUDE.md patches) but no applier consumes them. Phase 14 closes this gap.

## Open Questions

1. **Which CLAUDE.md file should ClaudeMdApplier target?**
   - What we know: Users may have `~/.claude/CLAUDE.md` (personal), `<project>/CLAUDE.md` (project-specific), or `<project>/.claude/CLAUDE.md` (local). The generator sets `filename: 'CLAUDE.md'` without a path.
   - What's unclear: Should the applier target the project root CLAUDE.md (cwd), or the user's global one?
   - Recommendation: Default to `join(process.cwd(), 'CLAUDE.md')` with `claudeMdPath` override in options. This matches the generator's intent (project-level recommendations come from deep scan of project config).

2. **Should ClaudeMdApplier auto-apply removals (scan_stale_reference)?**
   - What we know: Removing stale references is valuable but risky -- false positives could delete important config.
   - What's unclear: Whether HIGH confidence is sufficient guarantee for safe removal.
   - Recommendation: Do NOT auto-apply removals. Return `success: false` with advisory. Only generic additions (new sections) should auto-apply. This is consistent with RuleApplier's create-only philosophy.

3. **Should HookApplier use mergeHooks from cli/utils.ts or inline the logic?**
   - What we know: `mergeHooks` is ~40 lines and already handles dedup and user hook preservation.
   - What's unclear: Whether importing from `cli/` module creates unwanted dependency coupling.
   - Recommendation: Import directly. The function is pure and `cli/utils.ts` does not have side effects on import. If coupling becomes a concern, extract to shared module in a future refactor.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/unit/delivery/auto-apply.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-04 | HookApplier registered and auto-applies HIGH HOOK recs | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "HOOK applier"` | Partially (file exists, section needed) |
| GEN-04 | Hook script written with correct content and +x permission | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "creates hook script"` | No - Wave 0 |
| GEN-04 | Hook registered in settings.json with correct event/command | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "registers hook"` | No - Wave 0 |
| GEN-04 | Create-only guard: existing hook file not overwritten | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "already exists"` | No - Wave 0 |
| GEN-04 | Backup created before settings.json modification | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "backup"` | No - Wave 0 |
| GEN-05 | ClaudeMdApplier registered and auto-applies generic CLAUDE_MD recs | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "CLAUDE_MD applier"` | No - Wave 0 |
| GEN-05 | New section appended to CLAUDE.md | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "appends section"` | No - Wave 0 |
| GEN-05 | scan_stale_reference returns success=false (no auto-removal) | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "stale reference"` | No - Wave 0 |
| GEN-05 | scan_redundancy returns success=false (no auto-consolidation) | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "redundancy"` | No - Wave 0 |
| GEN-05 | Backup of original CLAUDE.md before modification | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "backup"` | No - Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit/delivery/auto-apply.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/delivery/auto-apply.test.ts` -- add `describe('HOOK applier')` and `describe('CLAUDE_MD applier')` test blocks (file exists, new sections needed)
- [ ] No new test infrastructure required -- existing temp dir pattern and mock setup in auto-apply.test.ts covers all needs

## Sources

### Primary (HIGH confidence)

- `src/delivery/appliers/index.ts` -- Applier interface, ApplierOptions, registry (read directly)
- `src/delivery/appliers/settings-applier.ts` -- Reference implementation for backup + atomic write pattern (read directly)
- `src/delivery/appliers/rule-applier.ts` -- Reference implementation for create-only guard pattern (read directly)
- `src/delivery/auto-apply.ts` -- Auto-apply orchestration, applier registration, audit logging (read directly)
- `src/generators/hook-generator.ts` -- Hook artifact generator (read directly)
- `src/generators/claude-md-generator.ts` -- CLAUDE.md patch generator (read directly)
- `src/cli/utils.ts` -- mergeHooks, readSettings, writeSettings, hook registration format (read directly)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Official hook documentation with settings.json JSON structure
- `~/.claude/settings.json` -- Live example of hook registration format (read directly)
- `tests/unit/delivery/auto-apply.test.ts` -- Existing test patterns for appliers (read directly)

### Secondary (MEDIUM confidence)

- `src/delivery/run-evolve.ts` -- Shows how autoApplyRecommendations is called in the full pipeline (read directly)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies already in project, no new packages needed
- Architecture: HIGH -- strategy pattern is clear, two reference implementations exist, hook format verified against live settings.json and official docs
- Pitfalls: HIGH -- identified through analysis of existing code patterns and edge cases in the generator output format

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable domain, no external dependency changes expected)
