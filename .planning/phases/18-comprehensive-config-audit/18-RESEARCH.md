# Phase 18: Comprehensive Config Audit - Research

**Researched:** 2026-04-05
**Domain:** Claude Code configuration quality analysis, scanner architecture extension
**Confidence:** HIGH

## Summary

Phase 18 upgrades the existing 3-scanner deep scan infrastructure (redundancy, mechanization, staleness) into a comprehensive configuration audit system. The requirements (AUD-01, AUD-02, AUD-03) call for 4 new audit capabilities: CLAUDE.md rule conflict detection, `.claude/rules/` directory structure audit, `settings.json` hooks redundancy analysis, and `.claude/commands/` convention checking. Additionally, the output must distinguish "problems" from "optimization suggestions" with severity labels, and each finding must include concrete optimization suggestions with expected effects.

The existing scanner architecture is well-designed for extension: the `scanners/index.ts` registry is a simple array of `Scanner` functions, the `ScanContext` already gathers all relevant config sources (CLAUDE.md files, rules, settings, commands, hooks), and the `Recommendation` schema provides the `pattern_type`, `confidence`, and `suggested_action` fields needed for rich audit output. The primary work is (1) implementing new scanner functions, (2) extending the `patternTypeSchema` with new audit-specific types, and (3) adding a severity/category distinction to the output so "problems" and "suggestions" are clearly separated.

**Primary recommendation:** Add 4 new scanner modules following the existing pattern (pure functions taking `ScanContext`, returning `Recommendation[]`), extend the `patternTypeSchema` enum with new audit types, and add a `severity` field (or map existing confidence levels) to distinguish broken-config problems from optimization suggestions. Keep the existing architecture -- it already supports this well.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUD-01 | Scanner performs full-spectrum config audit: CLAUDE.md conflict detection, rules directory structure, settings.json hooks redundancy, commands convention checking | 4 new scanner modules, each addressing one domain. ScanContext already has all data needed. |
| AUD-02 | Audit output includes concrete optimization suggestions with expected effect, user confirms before changes | Extend `suggested_action` with effect descriptions. The existing apply workflow (pending -> apply-one) already provides user confirmation. |
| AUD-03 | Results distinguish "problems" (broken/conflicting) from "optimization suggestions" (works but could be better), with distinct severity labels | Add a `severity` field to recommendations or use a consistent pattern_type convention. Output grouping in CLI/slash command. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Code comments MUST be in pure English (no Chinese, no bilingual)
- Technical discussion in Chinese, code in English
- Use GSD workflow for all changes
- TDD approach: write tests first
- Vitest for testing
- Zod v4 for schema validation
- TypeScript ~6.0 with tsup bundling
- ESM-only

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | ^4.3.6 | Schema validation for new pattern types and severity enum | Already used throughout. Extend existing schemas. |
| TypeScript | ~6.0 | Type safety | Already configured |
| Vitest | ^4.1.2 | Testing new scanners | Already configured, 58 test files passing |
| tsup | ^8.5.1 | Bundling | Already configured |

### No New Dependencies Required

This phase requires zero new npm dependencies. All 4 new scanners are pure functions operating on the existing `ScanContext` data structure. The analysis is text parsing, pattern matching, and cross-referencing -- all achievable with native JS/TS.

## Architecture Patterns

### Existing Scanner Architecture (follow this exactly)
```
src/scan/
  index.ts              # Orchestrator: builds context, runs all scanners
  schemas.ts            # ScanContext Zod schema
  context-builder.ts    # Reads all config files into ScanContext
  scanners/
    index.ts            # Scanner[] registry array
    redundancy.ts       # Existing: duplicate headings
    mechanization.ts    # Existing: hookable rules
    staleness.ts        # Existing: broken references
```

### New Scanner Modules (add to scanners/)
```
src/scan/scanners/
  conflict.ts           # NEW: CLAUDE.md rule conflict detection (AUD-01)
  structure.ts          # NEW: rules directory structure audit (AUD-01)
  hooks-redundancy.ts   # NEW: settings.json hooks redundancy (AUD-01)
  commands.ts           # NEW: commands convention checking (AUD-01)
```

### Pattern: Scanner Function Signature
Every scanner follows the same signature. This is the contract:

```typescript
// Source: src/scan/scanners/index.ts
export type Scanner = (context: ScanContext) => Recommendation[] | Promise<Recommendation[]>;
```

### Pattern: Scanner Registration
New scanners are added to the `scanners` array in `scanners/index.ts`:

```typescript
// Source: src/scan/scanners/index.ts (extend this)
import { scanConflicts } from './conflict.js';
import { scanStructure } from './structure.js';
import { scanHooksRedundancy } from './hooks-redundancy.js';
import { scanCommands } from './commands.js';

export const scanners: Scanner[] = [
  scanRedundancy,
  scanMechanization,
  scanStaleness,
  scanConflicts,       // NEW
  scanStructure,       // NEW
  scanHooksRedundancy, // NEW
  scanCommands,        // NEW
];
```

### Pattern: Recommendation Construction
All existing scanners follow the same pattern for building recommendations:

```typescript
// Source: src/scan/scanners/redundancy.ts (follow this pattern)
recommendations.push({
  id: `rec-scan-<scanner-name>-${index++}`,
  target: 'RULE',           // or HOOK, SETTINGS, CLAUDE_MD
  confidence: 'MEDIUM',     // HIGH for definite problems, MEDIUM for likely issues
  pattern_type: 'scan_<new_type>',
  title: `Short description of finding`,
  description: `Detailed explanation with file paths and what's wrong.`,
  evidence: {
    count: N,
    examples: ['example1', 'example2'],  // max 3
  },
  suggested_action: 'Concrete suggestion with expected effect.',
});
```

### Pattern: Severity Distinction (AUD-03)

The current schema has `confidence` (HIGH/MEDIUM/LOW) which indicates detection certainty, not severity. AUD-03 requires distinguishing "problems" (broken) from "optimization suggestions" (works but improvable).

**Recommended approach -- use `pattern_type` naming convention + confidence mapping:**

- Problem types: `scan_conflict_*`, `scan_broken_*` -- use HIGH confidence
- Optimization types: `scan_optimize_*`, `scan_suggest_*` -- use MEDIUM confidence

The CLI output and slash command already group by confidence (HIGH first), which naturally separates problems from suggestions. To make the distinction explicit:

1. Add new pattern types with clear naming (problems vs. optimizations)
2. In the CLI scan output and slash command template, group findings into "Problems" and "Optimization Suggestions" sections based on the pattern_type prefix
3. Optionally add a `severity` field ('problem' | 'suggestion') to the `Recommendation` schema for explicit categorization

**Recommended: Add `severity` field to schema.** This is cleaner than relying on naming conventions and makes the distinction machine-readable for the CLI renderer. The field is optional with a default so existing scanners aren't broken.

```typescript
// Extend recommendationSchema in src/schemas/recommendation.ts
export const severitySchema = z.enum(['problem', 'suggestion']);

export const recommendationSchema = z.object({
  // ... existing fields ...
  severity: severitySchema.optional().default('suggestion'),
});
```

### New Pattern Types (extend patternTypeSchema)

```typescript
// Add to src/schemas/recommendation.ts patternTypeSchema:
'scan_rule_conflict',          // CLAUDE.md contradictions / conflicting rules
'scan_structure_issue',        // rules directory naming / organization problems
'scan_hooks_redundancy',       // duplicate or overlapping hooks
'scan_command_convention',     // commands that violate naming/frontmatter conventions
```

### Anti-Patterns to Avoid
- **Modifying ScanContext schema unnecessarily:** The existing ScanContext already captures all config data needed. Do NOT add new fields to it. All 4 new scanners operate on existing data.
- **Scanner side effects:** Scanners must be pure functions. No filesystem writes, no external calls. Only read from ScanContext.
- **Breaking existing tests:** The existing scanner registry test checks `scanners.length === 3`. Update this to 7.
- **Coupling scanners:** Each scanner module must be independent. No scanner should import from another scanner.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text conflict detection | NLP similarity matching | Keyword/pattern opposition detection | Simple regex patterns for contradictions ("always" vs. "never", "must" vs. "forbidden") are sufficient and deterministic |
| YAML frontmatter parsing | Custom YAML parser | Existing `parseFrontmatter()` in context-builder.ts | Already handles paths arrays, extend if needed |
| Settings.json hook extraction | Custom JSON traversal | Existing `extractHooksFromAllSettings()` | Already extracts event, scope, type, command from all 3 scopes |
| Recommendation schema validation | Manual type checking | Existing Zod schemas | All recommendations already validated through schema |

## Common Pitfalls

### Pitfall 1: Over-Scoping Conflict Detection
**What goes wrong:** Attempting full NLP semantic analysis of CLAUDE.md to find "conflicts" results in too many false positives and unmanageable complexity.
**Why it happens:** "Rule conflict" is a broad concept that ranges from literal contradictions to subtle semantic tension.
**How to avoid:** Focus on detectable, concrete conflicts: (1) contradictory directives in same scope (e.g., "always use tabs" in one rule, "always use spaces" in another), (2) rules that override each other across scopes, (3) CLAUDE.md instructions that contradict registered hooks.
**Warning signs:** If conflict detection requires understanding natural language intent, scope it down.

### Pitfall 2: False Positives on Rules Directory Structure
**What goes wrong:** Flagging valid but unconventional directory structures as problems.
**Why it happens:** Claude Code's rules directory has no strict convention -- users organize freely.
**How to avoid:** Only flag objectively problematic patterns: (1) .md files directly in `.claude/` that should be in `rules/`, (2) non-.md files in rules/ directory, (3) very deeply nested rules (3+ levels), (4) rules without any headings. DO NOT enforce a specific directory naming scheme.
**Warning signs:** If a "problem" is just a style preference, make it a "suggestion" not a "problem."

### Pitfall 3: Hooks Redundancy Over-Detection
**What goes wrong:** Flagging hooks as redundant when they intentionally layer (e.g., user-level + project-level hook for same event).
**Why it happens:** Multiple hooks on the same event is a valid design pattern in Claude Code (all fire).
**How to avoid:** Only flag: (1) exact duplicate commands on the same event in the same scope, (2) hooks that reference the same script path, (3) hooks that clearly overlap (same matcher + similar command). Hooks on the same event but different scopes or different matchers are intentional.
**Warning signs:** If removing one hook would change behavior, it's not redundant.

### Pitfall 4: Commands Convention Fragility
**What goes wrong:** Enforcing conventions that conflict with how the codebase's own commands are structured.
**Why it happens:** The project's own slash commands (evolve-scan, evolve-apply) have a specific format. External conventions may differ.
**How to avoid:** Check for universal issues only: (1) missing frontmatter, (2) missing description field, (3) commands with legacy format when skills format is available, (4) command files that are empty or too short to be useful. Don't enforce naming style preferences.
**Warning signs:** If the project's own commands would fail the check, the check is wrong.

### Pitfall 5: Schema Migration Breaking Existing Recommendations
**What goes wrong:** Adding required fields to `Recommendation` schema breaks parsing of existing stored recommendations.
**Why it happens:** Recommendations are stored as JSON in `~/.harness-evolve/analysis-result.json`.
**How to avoid:** All new fields MUST be optional with defaults. The `severity` field must be `z.enum(['problem', 'suggestion']).optional().default('suggestion')` so existing recommendations parse as 'suggestion' by default.
**Warning signs:** Existing tests failing after schema changes.

## Code Examples

### Scanner Module Template (verified pattern from existing codebase)
```typescript
// Source: pattern from src/scan/scanners/redundancy.ts
import type { ScanContext } from '../schemas.js';
import type { Recommendation } from '../../schemas/recommendation.js';

/**
 * Scan for [specific issue type] in Claude Code configuration.
 */
export function scanXxx(context: ScanContext): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  // Check 1: [description]
  // ... analysis logic ...

  if (/* issue found */) {
    recommendations.push({
      id: `rec-scan-xxx-${index++}`,
      target: 'RULE',  // or HOOK, SETTINGS, CLAUDE_MD
      confidence: 'HIGH',  // HIGH for problems, MEDIUM for suggestions
      pattern_type: 'scan_xxx',
      title: `Short finding title`,
      description: `Detailed description with affected file paths.`,
      evidence: {
        count: 1,
        examples: ['affected-file.md'],
      },
      suggested_action:
        'Concrete action to take. Expected effect: [what improves].',
    });
  }

  return recommendations;
}
```

### Test Module Template (verified pattern from existing tests)
```typescript
// Source: pattern from tests/unit/scan/scanners/redundancy.test.ts
import { describe, it, expect } from 'vitest';
import { scanXxx } from '../../../../src/scan/scanners/xxx.js';
import { recommendationSchema } from '../../../../src/schemas/recommendation.js';
import type { ScanContext } from '../../../../src/scan/schemas.js';

function makeScanContext(overrides: Partial<ScanContext> = {}): ScanContext {
  return {
    generated_at: new Date().toISOString(),
    project_root: '/tmp/test-project',
    claude_md_files: [],
    rules: [],
    settings: { user: null, project: null, local: null },
    commands: [],
    hooks_registered: [],
    ...overrides,
  };
}

describe('scanXxx', () => {
  it('returns empty when no issues found', () => {
    const ctx = makeScanContext({});
    const result = scanXxx(ctx);
    expect(result).toEqual([]);
  });

  it('detects [specific issue]', () => {
    const ctx = makeScanContext({ /* setup with issue */ });
    const result = scanXxx(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].pattern_type).toBe('scan_xxx');
  });

  it('produces valid recommendations', () => {
    const ctx = makeScanContext({ /* setup */ });
    const result = scanXxx(ctx);
    for (const rec of result) {
      expect(() => recommendationSchema.parse(rec)).not.toThrow();
    }
  });
});
```

## Scanner Design Details

### Scanner 1: Conflict Detection (`conflict.ts`)

Detects contradictions between configuration sources.

**Checks:**
1. **Contradictory directives across CLAUDE.md and rules:** Find opposing instructions (e.g., CLAUDE.md says "use tabs", rule says "use spaces"). Use keyword opposition pairs: always/never, must/must not, enable/disable, require/forbid.
2. **Scope override shadows:** Project-level rule that contradicts user-level CLAUDE.md without acknowledgment.
3. **CLAUDE.md instruction vs. registered hook conflict:** A CLAUDE.md instruction says "never X" but a hook permits or automates X. Or CLAUDE.md says "always Y" but no hook enforces it while another scanner already flagged it as mechanizable.

**Data source:** `context.claude_md_files[].content`, `context.rules[].content`, `context.hooks_registered[]`

**Severity mapping:**
- Contradictory directives = `problem` (HIGH confidence)
- Scope shadows = `suggestion` (MEDIUM confidence)
- Instruction-vs-hook mismatch = `suggestion` (MEDIUM confidence)

### Scanner 2: Structure Audit (`structure.ts`)

Audits `.claude/rules/` directory organization.

**Checks:**
1. **Rules with no frontmatter paths in deeply nested dirs:** Rules in subdirectories that don't use `paths:` frontmatter (missing scope means they fire on everything, defeating purpose of subdirectory organization).
2. **Oversized rule files:** Rules exceeding ~200 lines (context bloat -- should be split or moved to skills/docs).
3. **Rules without headings:** Rule files that lack any markdown headings (poor organization, harder for Claude to parse).
4. **Empty or near-empty rules:** Rule files with <10 characters of content (likely placeholder or mistake).
5. **Non-.md files in rules directory:** Files that won't be loaded by Claude Code.

**Data source:** `context.rules[]` (path, filename, content, headings, frontmatter)

**Severity mapping:**
- Empty rules = `problem` (HIGH confidence)
- Non-.md files = `problem` (HIGH confidence)
- Oversized rules = `suggestion` (MEDIUM confidence)
- Missing frontmatter paths in subdirs = `suggestion` (MEDIUM confidence)
- Rules without headings = `suggestion` (LOW confidence)

### Scanner 3: Hooks Redundancy (`hooks-redundancy.ts`)

Analyzes `settings.json` hooks for redundancy and overlap.

**Checks:**
1. **Exact duplicate hooks:** Same event + same scope + same command string. Clear mistake.
2. **Same script, different scopes:** Same command string registered at user and project scope (user-level may shadow or double-fire).
3. **Overlapping matchers:** Two hooks on same event where one matcher is a subset of the other (e.g., `Bash` and `Bash(git *)` -- the broader one already covers it).
4. **Hooks without commands:** Hook entries missing `command` field (type: command with no command).

**Data source:** `context.hooks_registered[]`, `context.settings` (raw for detailed inspection)

**Severity mapping:**
- Exact duplicates = `problem` (HIGH confidence)
- Hooks without commands = `problem` (HIGH confidence)
- Same script cross-scope = `suggestion` (MEDIUM confidence)
- Overlapping matchers = `suggestion` (MEDIUM confidence)

### Scanner 4: Commands Convention (`commands.ts`)

Checks `.claude/commands/` for convention violations.

**Checks:**
1. **Missing frontmatter:** Command files without YAML frontmatter (missing name/description).
2. **Missing description:** Frontmatter exists but no `description` field (Claude can't categorize the command).
3. **Empty content:** Command files with no meaningful instructions after frontmatter.
4. **Very short content (<50 chars):** Commands too brief to be useful instructions for Claude.
5. **Legacy format awareness:** Commands that could benefit from migration to skills format (`.claude/skills/<name>/SKILL.md`) -- informational suggestion only.

**Data source:** `context.commands[]` (path, name, content)

**Severity mapping:**
- Empty content = `problem` (HIGH confidence)
- Missing description = `suggestion` (MEDIUM confidence)
- Very short content = `suggestion` (LOW confidence)
- Legacy format = `suggestion` (LOW confidence)

## Output Separation (AUD-03)

### CLI Output Format
The scan CLI command (`src/cli/scan.ts`) currently outputs JSON with recommendations sorted by confidence. Extend it to group by severity:

```json
{
  "generated_at": "2026-04-05T...",
  "recommendation_count": 5,
  "problems": [
    { "id": "...", "severity": "problem", "confidence": "HIGH", ... }
  ],
  "suggestions": [
    { "id": "...", "severity": "suggestion", "confidence": "MEDIUM", ... }
  ],
  "recommendations": [ /* all, for backward compatibility */ ]
}
```

### Slash Command Template Update
Update `src/commands/evolve-scan.ts` to instruct Claude to present results in two sections:

1. **Problems** (things that are broken or conflicting) -- need fixing
2. **Optimization Suggestions** (things that work but could be better) -- optional improvements

## User Confirmation Workflow (AUD-02)

The existing apply workflow already handles user confirmation:
- `harness-evolve scan` outputs findings (read-only)
- `harness-evolve pending` lists pending recommendations
- `harness-evolve apply-one <id>` applies one recommendation (user must explicitly choose)
- `harness-evolve dismiss <id>` permanently dismisses
- `/evolve:apply` slash command presents each finding and asks user to choose

**No new confirmation mechanism needed.** The existing pending/apply-one/dismiss workflow already ensures "user reviews audit findings and confirms before any changes are applied -- no silent modifications" (Success Criterion 4).

For new audit scanners that produce suggestions: most will have `target: 'RULE'` or `target: 'CLAUDE_MD'`. The existing ClaudeMdApplier and RuleApplier already handle these. New pattern types should be added to the destructive patterns set in ClaudeMdApplier if they require manual review (e.g., conflict resolution).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.claude/commands/` only | Skills (`.claude/skills/<name>/SKILL.md`) preferred | 2026 (Claude Code update) | Commands still work, but skills add frontmatter control, supporting files, auto-discovery |
| Flat rules files | Path-scoped rules with frontmatter `paths:` | 2025-2026 | Rules can target specific file patterns, reducing context bloat |
| 4 hook handler types | 4 types: command, http, prompt, agent | March 2026 | hooks-redundancy scanner must handle all 4 types |
| 27 hook events | Full lifecycle coverage | March 2026 | Scanner needs to understand all event types for overlap detection |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/unit/scan` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUD-01a | Conflict scanner detects CLAUDE.md rule contradictions | unit | `npx vitest run tests/unit/scan/scanners/conflict.test.ts -x` | Wave 0 |
| AUD-01b | Structure scanner audits rules directory | unit | `npx vitest run tests/unit/scan/scanners/structure.test.ts -x` | Wave 0 |
| AUD-01c | Hooks redundancy scanner detects duplicate/overlapping hooks | unit | `npx vitest run tests/unit/scan/scanners/hooks-redundancy.test.ts -x` | Wave 0 |
| AUD-01d | Commands scanner checks convention violations | unit | `npx vitest run tests/unit/scan/scanners/commands.test.ts -x` | Wave 0 |
| AUD-02 | Recommendations include concrete suggestions with expected effect | unit | All scanner tests validate `suggested_action` content | Wave 0 (in each scanner test) |
| AUD-03 | Severity field distinguishes problems from suggestions | unit | `npx vitest run tests/unit/scan/scanners/*.test.ts` (each test checks severity) | Wave 0 |
| AUD-ALL | Full scan integration with all 7 scanners | integration | `npx vitest run tests/integration/cli-scan.test.ts -x` | Extend existing |
| SCHEMA | Schema backward compatibility | unit | `npx vitest run tests/unit/scan` (existing tests still pass) | Existing |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/scan`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] `tests/unit/scan/scanners/conflict.test.ts` -- covers AUD-01a
- [ ] `tests/unit/scan/scanners/structure.test.ts` -- covers AUD-01b
- [ ] `tests/unit/scan/scanners/hooks-redundancy.test.ts` -- covers AUD-01c
- [ ] `tests/unit/scan/scanners/commands.test.ts` -- covers AUD-01d
- [ ] Update `tests/unit/scan/scanners/staleness.test.ts` scanner registry test from 3 to 7
- [ ] Update `tests/integration/cli-scan.test.ts` with new scanner scenarios

## Open Questions

1. **Severity field vs. pattern_type convention**
   - What we know: AUD-03 requires clear distinction between problems and suggestions
   - What's unclear: Whether to add a new `severity` field or rely on pattern_type naming
   - Recommendation: Add optional `severity` field with default `'suggestion'`. Cleaner, machine-readable, backward compatible.

2. **Conflict detection depth**
   - What we know: Full NLP conflict detection is out of scope
   - What's unclear: How deep keyword-based contradiction detection should go
   - Recommendation: Start with obvious opposition patterns (always/never, must/forbidden) plus exact directive duplication. Can expand later.

3. **Commands scanner scope for global commands**
   - What we know: `context-builder.ts` reads commands from `cwd/.claude/commands/` only
   - What's unclear: Whether to also scan `~/.claude/commands/` and `~/.claude/skills/`
   - Recommendation: Keep scanning project commands only for now. Global commands/skills are a user-level concern. Can be added as enhancement.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/scan/` (index.ts, schemas.ts, context-builder.ts, scanners/*.ts)
- Codebase inspection: `src/schemas/recommendation.ts` (patternTypeSchema, recommendationSchema)
- Codebase inspection: `src/cli/scan.ts`, `src/commands/evolve-scan.ts`, `src/commands/evolve-apply.ts`
- Codebase inspection: `tests/unit/scan/scanners/*.test.ts`, `tests/integration/cli-scan.test.ts`
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- 27 events, 4 handler types, matcher patterns
- [Claude Code Best Practices](https://code.claude.com/docs/en/best-practices) -- CLAUDE.md, rules, hooks, skills conventions
- [Claude Code Skills/Slash Commands](https://code.claude.com/docs/en/slash-commands) -- skills format, frontmatter fields, naming

### Secondary (MEDIUM confidence)
- [Claude Code Rules Directory Guide](https://claudefa.st/blog/guide/mechanics/rules-directory) -- path-scoped rules, directory organization
- [Claude Code Settings Guide](https://www.eesel.ai/blog/settings-json-claude-code) -- settings.json structure

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new dependencies, extending proven architecture
- Architecture: HIGH -- Scanner pattern is well-established (3 working examples to follow)
- Pitfalls: HIGH -- Identified from real codebase analysis and Claude Code documentation
- Scanner designs: MEDIUM -- Specific detection heuristics will need tuning during implementation

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- extending existing architecture, no external API changes expected)
