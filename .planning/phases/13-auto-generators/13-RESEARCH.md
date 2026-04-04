# Phase 13: Auto-Generators - Research

**Researched:** 2026-04-04
**Domain:** Artifact generation from detected patterns (skill files, hook scripts, CLAUDE.md patches)
**Confidence:** HIGH

## Summary

Phase 13 transforms harness-evolve from a system that only *recommends* changes into one that *generates ready-to-use artifact drafts*. Three generators are needed: (1) a skill generator that produces `.claude/commands/<name>.md` files from detected long-prompt patterns, (2) a hook generator that produces shell command hook scripts from detected mechanization patterns, and (3) a CLAUDE.md patch generator that produces unified diff patches from scan recommendations targeting CLAUDE_MD.

The existing codebase provides a strong foundation. The Recommendation type already carries `target` (SKILL, HOOK, CLAUDE_MD), `pattern_type`, `evidence.examples`, and `suggested_action` -- all the raw material generators need. The Applier interface (in `src/delivery/appliers/index.ts`) defines the pattern for transforming recommendations into files, with SettingsApplier and RuleApplier as reference implementations. Phase 14 will register HOOK and CLAUDE_MD appliers that USE these generators, so Phase 13 should focus on pure generation functions (input: Recommendation -> output: generated artifact content) without applier registration.

**Primary recommendation:** Create a new `src/generators/` module with three generator functions, each following a consistent interface: `(rec: Recommendation, options?) => GeneratedArtifact`. Generators produce content strings and metadata; they do NOT write to disk (that is the applier's job in Phase 14). This separation ensures testability and reusability.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GEN-01 | Detect repeated long-prompt patterns -> generate `.claude/commands/<name>.md` skill file draft | Skill generator uses `long_prompt` pattern_type recommendations. Evidence contains `prompt_preview` (the actual prompt text). Generate a valid SKILL.md with frontmatter (name, description) and prompt template body. |
| GEN-02 | Detect mechanizable operations -> generate hook script draft (shell command type) | Hook generator uses `scan_missing_mechanization` and `repeated_prompt` (short) pattern_type recommendations. Evidence contains the matched rule text or repeated prompt. Generate a bash script following Claude Code hook stdin/stdout contract. |
| GEN-03 | Detect project-level config suggestions -> generate CLAUDE.md patch in diff format | CLAUDE.md patch generator uses `scan_stale_reference`, `scan_redundancy`, and other CLAUDE_MD-targeted recommendations. Generate a unified diff that can be reviewed and applied with `patch` or programmatic string replacement. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | >=22.14.0 | Runtime | Project standard |
| TypeScript | ~6.0 | Type safety | Project standard |
| Zod | ^4.3.6 | Schema validation for generator input/output | Project standard |
| Vitest | ^4.1.2 | Testing | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Native `node:fs/promises` | (built-in) | Reading source files for diff context | When CLAUDE.md patch generator needs to read the current file content |
| write-file-atomic | ^7.0.0 | Atomic writes for generated artifacts | When writing generated files to disk (in applier layer, Phase 14) |

**No new dependencies needed.** All generation is string manipulation and template rendering -- no external libraries required.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── generators/
│   ├── index.ts              # Public API: re-exports all generators + types
│   ├── schemas.ts            # GeneratedArtifact schema, GeneratorOptions
│   ├── skill-generator.ts    # GEN-01: long_prompt -> .claude/commands/<name>.md
│   ├── hook-generator.ts     # GEN-02: mechanization/repeated -> hook script
│   └── claude-md-generator.ts # GEN-03: CLAUDE_MD recs -> unified diff patch
├── delivery/
│   └── appliers/             # Phase 14 will add HookApplier, ClaudeMdApplier
└── ...existing modules...
```

### Pattern 1: Generator Function Interface
**What:** Each generator is a pure function: `Recommendation -> GeneratedArtifact`
**When to use:** For all three generators

```typescript
// GeneratedArtifact schema
interface GeneratedArtifact {
  /** Type of artifact generated */
  type: 'skill' | 'hook' | 'claude_md_patch';
  /** Suggested filename (relative to project root) */
  filename: string;
  /** Generated file content (full file for skill/hook, unified diff for patch) */
  content: string;
  /** Source recommendation ID for traceability */
  source_recommendation_id: string;
  /** Metadata about the generation */
  metadata: {
    generated_at: string;
    generator_version: string;
    pattern_type: string;
  };
}

// Generator function signature
type Generator = (rec: Recommendation, options?: GeneratorOptions) => GeneratedArtifact | null;
```

**Why this pattern:**
- Pure functions are trivially testable (no mocking needed)
- Returning `null` when a recommendation is not applicable is cleaner than throwing
- The `filename` field lets the applier (Phase 14) know where to write
- `content` is the full generated text -- generators don't touch the filesystem

### Pattern 2: Template-Based Generation (not string concatenation)
**What:** Use template arrays joined by newlines, not string concatenation
**When to use:** For all content generation

```typescript
// Good: template array pattern (matches existing RuleApplier style)
const content = [
  `---`,
  `name: ${slugName}`,
  `description: ${description}`,
  `---`,
  '',
  `# ${title}`,
  '',
  promptTemplate,
  '',
  `---`,
  `*Auto-generated by harness-evolve (${rec.id})*`,
].join('\n');

// Bad: string concatenation
const content = `---\nname: ${slugName}\n...`
```

**Why:** The RuleApplier already uses `[].join('\n')` pattern. Consistent, readable, easy to add/remove lines.

### Pattern 3: Slug Generation for Filenames
**What:** Convert recommendation titles/content to valid filenames
**When to use:** For skill and hook generators

```typescript
// Convert arbitrary text to a valid filename slug
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50); // Cap filename length
}
```

### Anti-Patterns to Avoid
- **Generators writing to disk:** Generation and file-writing are separate concerns. Phase 14 appliers handle disk writes. Generators produce strings only.
- **Over-engineering templates:** These are DRAFTS for users to review. Simple string templates are sufficient. Do not use Handlebars/Mustache/EJS.
- **Generating invalid artifacts:** Each generator MUST produce output that follows Claude Code conventions (valid YAML frontmatter for skills, valid bash for hooks, valid unified diff for patches).
- **Coupling to scan vs. analysis classifiers:** Generators should work with ANY Recommendation that has the right `target` and `pattern_type`, regardless of whether it came from the analysis pipeline or the scan pipeline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unified diff generation | Custom line-by-line diff algorithm | Simple `createUnifiedDiff()` utility function | Unified diff format is well-defined (RFC-like format with `---`/`+++`/`@@` headers). For CLAUDE.md patches, we only need to generate simple diffs (add lines, remove lines, replace sections). A ~30-line utility is sufficient -- no need for a full diff library. |
| Filename sanitization | Complex regex per generator | Shared `toSlug()` utility | One utility used by all generators |
| YAML frontmatter generation | Manual string building | Simple key-value template | SKILL.md frontmatter is trivial (3-4 fields). No YAML library needed. |

**Key insight:** The generation is fundamentally template filling. The "intelligence" already happened in the classifiers and scanners -- generators just format the output. Keep them simple.

## Common Pitfalls

### Pitfall 1: Invalid Bash in Generated Hook Scripts
**What goes wrong:** Generated hook scripts have syntax errors (unescaped quotes, missing shebangs, wrong jq paths)
**Why it happens:** Recommendation evidence contains user input that may have special characters
**How to avoid:** Always escape shell special characters in generated scripts. Use `#!/usr/bin/env bash` shebang. Validate generated scripts with basic syntax checks in tests (bash -n).
**Warning signs:** Tests that only check content contains certain strings but don't validate shell syntax

### Pitfall 2: YAML Frontmatter with Special Characters
**What goes wrong:** Skill file YAML frontmatter breaks parsing when description contains colons, quotes, or newlines
**Why it happens:** Recommendation descriptions contain arbitrary text
**How to avoid:** Always quote YAML string values that might contain special chars. Use single-line descriptions (truncate if needed).
**Warning signs:** Generated skill files that parse incorrectly when loaded by Claude Code

### Pitfall 3: Diff Context Mismatch
**What goes wrong:** Generated CLAUDE.md unified diff doesn't apply because the context lines don't match the actual file
**Why it happens:** CLAUDE.md may have changed since the scan ran
**How to avoid:** The generator produces a "suggested patch" format, NOT a strict unified diff. Include enough context (heading-based) for the user to locate the change manually. Phase 14's applier can do a fresh read + apply.
**Warning signs:** Patches that reference specific line numbers (fragile) instead of heading-based context (robust)

### Pitfall 4: Slug Collisions
**What goes wrong:** Two different recommendations generate files with the same slug name
**Why it happens:** Different prompts can produce the same slug after normalization
**How to avoid:** Include the recommendation ID suffix in the filename: `<slug>-<rec-id-hash>.md`
**Warning signs:** Generators that produce filenames based only on user content without a unique suffix

### Pitfall 5: Generators Doing Too Much (Scope Creep to Phase 14)
**What goes wrong:** Generators start writing files, updating settings.json, registering hooks
**Why it happens:** Temptation to "complete the loop" in one phase
**How to avoid:** Phase 13 generators return `GeneratedArtifact` objects. Phase 14 registers appliers that use generators and write to disk. Clear separation.
**Warning signs:** `writeFile` calls in generator functions, settings.json manipulation in generators

## Code Examples

### Example 1: Skill Generator (GEN-01)

```typescript
// src/generators/skill-generator.ts
import type { Recommendation } from '../schemas/recommendation.js';
import type { GeneratedArtifact } from './schemas.js';
import { toSlug, GENERATOR_VERSION, nowISO } from './shared.js';

/**
 * Generate a .claude/commands/<name>.md skill file draft from a long_prompt
 * recommendation. Returns null if the recommendation is not applicable.
 */
export function generateSkill(rec: Recommendation): GeneratedArtifact | null {
  if (rec.target !== 'SKILL' || rec.pattern_type !== 'long_prompt') {
    return null;
  }

  const promptPreview = rec.evidence.examples[0] ?? '';
  const slugName = toSlug(rec.title);
  const description = rec.description.split('.')[0]; // First sentence

  const content = [
    '---',
    `name: ${slugName}`,
    `description: "${escapeYaml(description)}"`,
    '---',
    '',
    `# ${rec.title}`,
    '',
    '## Instructions',
    '',
    promptPreview,
    '',
    '---',
    `*Auto-generated by harness-evolve (${rec.id})*`,
  ].join('\n');

  return {
    type: 'skill',
    filename: `.claude/commands/${slugName}.md`,
    content,
    source_recommendation_id: rec.id,
    metadata: {
      generated_at: nowISO(),
      generator_version: GENERATOR_VERSION,
      pattern_type: rec.pattern_type,
    },
  };
}
```

### Example 2: Hook Generator (GEN-02)

```typescript
// src/generators/hook-generator.ts
import type { Recommendation } from '../schemas/recommendation.js';
import type { GeneratedArtifact } from './schemas.js';

// Map pattern evidence to appropriate hook event
const HOOK_EVENT_MAP: Record<string, string> = {
  'scan_missing_mechanization': 'PreToolUse', // default, may vary
  'repeated_prompt': 'UserPromptSubmit',
};

export function generateHook(rec: Recommendation): GeneratedArtifact | null {
  if (rec.target !== 'HOOK') return null;

  const hookEvent = HOOK_EVENT_MAP[rec.pattern_type] ?? 'PreToolUse';
  const slugName = toSlug(rec.title);

  // Extract the operation from evidence
  const operation = rec.evidence.examples[0] ?? 'echo "TODO: implement"';

  const content = [
    '#!/usr/bin/env bash',
    `# Auto-generated hook for: ${rec.title}`,
    `# Hook event: ${hookEvent}`,
    `# Source: harness-evolve (${rec.id})`,
    '#',
    '# TODO: Review and customize this script before use.',
    '',
    '# Read hook input from stdin',
    'INPUT=$(cat)',
    '',
    '# Extract relevant fields',
    `# Adjust jq path based on your ${hookEvent} event schema`,
    '',
    `# ${rec.suggested_action}`,
    '',
    '# Exit 0 to allow, exit 2 to block',
    'exit 0',
  ].join('\n');

  return {
    type: 'hook',
    filename: `.claude/hooks/evolve-${slugName}.sh`,
    content,
    source_recommendation_id: rec.id,
    metadata: {
      generated_at: new Date().toISOString(),
      generator_version: '1.0.0',
      pattern_type: rec.pattern_type,
      hook_event: hookEvent,
    },
  };
}
```

### Example 3: CLAUDE.md Patch Generator (GEN-03)

```typescript
// src/generators/claude-md-generator.ts
import type { Recommendation } from '../schemas/recommendation.js';
import type { GeneratedArtifact } from './schemas.js';

/**
 * Generate a CLAUDE.md patch from a recommendation.
 * Produces a human-readable diff format (not strict unified diff)
 * that shows what to add/remove/change.
 */
export function generateClaudeMdPatch(rec: Recommendation): GeneratedArtifact | null {
  if (rec.target !== 'CLAUDE_MD') return null;

  // Build patch based on pattern_type
  let patchContent: string;

  if (rec.pattern_type === 'scan_stale_reference') {
    // For stale references: suggest removal
    const ref = rec.evidence.examples[0] ?? '';
    patchContent = [
      `--- a/CLAUDE.md`,
      `+++ b/CLAUDE.md`,
      `@@ Stale reference removal @@`,
      `- ${ref}`,
      `+ # (removed stale reference: ${ref})`,
    ].join('\n');
  } else {
    // Generic patch: add suggested action as new content
    patchContent = [
      `--- a/CLAUDE.md`,
      `+++ b/CLAUDE.md`,
      `@@ ${rec.title} @@`,
      `+ ## ${rec.title}`,
      `+`,
      `+ ${rec.suggested_action}`,
    ].join('\n');
  }

  return {
    type: 'claude_md_patch',
    filename: 'CLAUDE.md',
    content: patchContent,
    source_recommendation_id: rec.id,
    metadata: {
      generated_at: new Date().toISOString(),
      generator_version: '1.0.0',
      pattern_type: rec.pattern_type,
    },
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Recommendations are text-only suggestions | Recommendations can produce draft artifacts | Phase 13 (now) | Closes the gap between "suggestion" and "action" |
| Only SETTINGS and RULE appliers exist | HOOK and CLAUDE_MD generators prepare for Phase 14 appliers | Phase 13 (now) | Enables Phase 14 to register appliers that call generators |
| Skill files require manual creation | Auto-generated skill drafts from detected patterns | Phase 13 (now) | Users get usable drafts instead of vague suggestions |

**Claude Code skill format changes (verified 2026-04-04):**
- `.claude/commands/<name>.md` files still work and are equivalent to `.claude/skills/<name>/SKILL.md`
- Both formats support YAML frontmatter with `name`, `description`, `disable-model-invocation`, etc.
- The commands format is simpler (single file) -- ideal for auto-generated drafts
- Skills format supports supporting files (directory-based) -- users can upgrade later

**Claude Code hook format changes (verified 2026-04-04):**
- Hook configuration uses new matcher/hooks nested structure: `{ matcher: "...", hooks: [{ type: "command", command: "..." }] }`
- Many new hook events since project start: SessionStart, SessionEnd, SubagentStart, SubagentStop, TaskCreated, TaskCompleted, CwdChanged, FileChanged, ConfigChange, InstructionsLoaded, PreCompact, PostCompact, Elicitation, ElicitationResult, WorktreeCreate, WorktreeRemove, PermissionDenied, StopFailure, TeammateIdle, Notification
- Hook `if` field added for argument-level filtering (e.g., `"if": "Bash(git *)"`)
- HTTP hooks (`type: "http"`) and prompt hooks (`type: "prompt"`) now available alongside command hooks
- Exit codes: 0 = success/allow, 2 = blocking error, other = non-blocking error

## Open Questions

1. **Should generators handle scan_redundancy recommendations?**
   - What we know: Scan redundancy targets RULE, not CLAUDE_MD. The suggested_action is "consolidate into one location."
   - What's unclear: Should the CLAUDE.md patch generator handle redundancy by generating a diff that removes the duplicate section?
   - Recommendation: Keep scope tight. GEN-03 handles CLAUDE_MD-targeted recommendations only. Redundancy recs target RULE and are already handled by the existing RuleApplier pattern (or would need a different generator).

2. **How should the hook generator determine the correct hook event?**
   - What we know: Mechanization scanner already stores `hookEvent` in its MECHANIZATION_INDICATORS. But the Recommendation schema doesn't carry this metadata -- it's in the description text.
   - What's unclear: Should we extend the Recommendation schema with an optional `metadata` field, or extract the hook event from the description text?
   - Recommendation: Parse the hook event from the description text (it contains "suitable for a {hookEvent} hook"). Avoid schema changes that would ripple across all classifiers. Alternatively, a simple regex on `rec.suggested_action` which contains "Create a {hookEvent} hook".

3. **What is the minimum viable diff format for CLAUDE.md patches?**
   - What we know: Standard unified diff is fragile (line numbers change). Users need to review before applying.
   - What's unclear: Whether to use strict unified diff or a simpler "suggested change" format.
   - Recommendation: Use a simplified unified diff format (with `---`/`+++` headers and heading-based context instead of line numbers). This is human-readable and can be applied programmatically by the Phase 14 applier.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/unit/generators/` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-01 | Skill generator produces valid .claude/commands/<name>.md from long_prompt rec | unit | `npx vitest run tests/unit/generators/skill-generator.test.ts -x` | Wave 0 |
| GEN-01 | Generated skill has valid YAML frontmatter (name, description) | unit | `npx vitest run tests/unit/generators/skill-generator.test.ts -x` | Wave 0 |
| GEN-01 | Returns null for non-SKILL/non-long_prompt recommendations | unit | `npx vitest run tests/unit/generators/skill-generator.test.ts -x` | Wave 0 |
| GEN-02 | Hook generator produces valid bash script from mechanization rec | unit | `npx vitest run tests/unit/generators/hook-generator.test.ts -x` | Wave 0 |
| GEN-02 | Generated hook script has correct shebang and exit codes | unit | `npx vitest run tests/unit/generators/hook-generator.test.ts -x` | Wave 0 |
| GEN-02 | Hook generator handles repeated_prompt (short) recs for HOOK target | unit | `npx vitest run tests/unit/generators/hook-generator.test.ts -x` | Wave 0 |
| GEN-03 | CLAUDE.md patch generator produces diff format from scan_stale_reference | unit | `npx vitest run tests/unit/generators/claude-md-generator.test.ts -x` | Wave 0 |
| GEN-03 | Generated diff has ---/+++ headers and context markers | unit | `npx vitest run tests/unit/generators/claude-md-generator.test.ts -x` | Wave 0 |
| GEN-03 | Returns null for non-CLAUDE_MD recommendations | unit | `npx vitest run tests/unit/generators/claude-md-generator.test.ts -x` | Wave 0 |
| ALL | GeneratedArtifact schema validates all outputs | unit | `npx vitest run tests/unit/generators/schemas.test.ts -x` | Wave 0 |
| ALL | Public API exports all generators from src/index.ts | unit | `npx vitest run tests/unit/generators/ -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/generators/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/generators/skill-generator.test.ts` -- covers GEN-01
- [ ] `tests/unit/generators/hook-generator.test.ts` -- covers GEN-02
- [ ] `tests/unit/generators/claude-md-generator.test.ts` -- covers GEN-03
- [ ] `tests/unit/generators/schemas.test.ts` -- covers GeneratedArtifact schema

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/delivery/appliers/` -- Applier interface and existing implementations (RuleApplier, SettingsApplier)
- Codebase inspection: `src/schemas/recommendation.ts` -- Recommendation type with patternType enum, evidence structure
- Codebase inspection: `src/scan/scanners/mechanization.ts` -- MECHANIZATION_INDICATORS with hookEvent mapping
- Codebase inspection: `src/analysis/classifiers/long-prompts.ts` -- long_prompt classifier producing SKILL-targeted recommendations
- Codebase inspection: `src/analysis/classifiers/repeated-prompts.ts` -- repeated_prompt classifier producing HOOK-targeted recommendations
- [Claude Code Skills docs](https://code.claude.com/docs/en/skills) -- Skill file format, frontmatter reference, .claude/commands/ equivalence (verified 2026-04-04)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Hook configuration structure, lifecycle events, command hook format (verified 2026-04-04)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) -- Hook script patterns, stdin/stdout contract, exit codes (verified 2026-04-04)

### Secondary (MEDIUM confidence)
- Unified diff format specification -- well-known format, no version drift concern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, reuses project stack entirely
- Architecture: HIGH - follows established Applier/Classifier patterns in the codebase, clear separation between generator (Phase 13) and applier (Phase 14)
- Pitfalls: HIGH - based on direct codebase analysis and Claude Code format verification
- Claude Code format compatibility: HIGH - verified against official docs on 2026-04-04

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable domain, 30-day validity)
