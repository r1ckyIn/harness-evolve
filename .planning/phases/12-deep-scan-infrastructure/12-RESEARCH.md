# Phase 12: Deep Scan Infrastructure - Research

**Researched:** 2026-04-04
**Domain:** Static configuration analysis, redundancy detection, file-system scanning
**Confidence:** HIGH

## Summary

Phase 12 introduces a "Deep Scan" capability that gives users immediate Day 0 value by analyzing their existing Claude Code configuration for quality issues -- redundant rules, missing mechanization opportunities, and stale references. This is fundamentally different from the existing analysis pipeline (which relies on accumulated interaction data from hooks): the deep scan operates entirely on static configuration files (CLAUDE.md, .claude/rules/, settings.json, .claude/commands/) without requiring any prior usage history.

The existing codebase provides strong architectural foundations to build on: the `Recommendation` schema, `Classifier` type signature, `renderRecommendations()` renderer, recommendation state management, and the `autoApplyRecommendations()` pipeline. The deep scan module should follow the same patterns -- producing `Recommendation[]` that flow into the existing delivery pipeline -- but with a new input source (config files instead of pre-processed usage data).

**Primary recommendation:** Create a new `src/scan/` module with a `ScanContext` input type (replacing `Summary`) and three scanner functions (redundancy, mechanization, staleness) that produce standard `Recommendation[]`. Integrate into the `init` CLI command and expose a programmatic `runDeepScan(cwd)` function. Extend `patternTypeSchema` with scan-specific pattern types.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCN-01 | `harness-evolve init` scans CLAUDE.md, .claude/rules/, settings.json, .claude/commands/ and produces a config quality report | Scanner reads all 4 config sources into a ScanContext, produces Recommendation[], renders via existing renderer. Init command calls runDeepScan() after hook registration. |
| SCN-02 | Scan detects redundant rules, missing mechanization, and stale config | Three dedicated scanner functions: redundancy-scanner, mechanization-scanner, staleness-scanner. Each operates on ScanContext and returns Recommendation[]. |
| SCN-03 | Scan results output as structured recommendations using existing format and delivery pipeline | Scanner output is standard Recommendation[] -- reuses recommendationSchema, renderRecommendations(), state management, and notification pipeline unchanged. |
</phase_requirements>

## Standard Stack

### Core

No new dependencies needed. This phase uses only existing project dependencies.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Zod | ^4.3.6 | Validate ScanContext schema, scan result schemas | Already in project, used for all schemas |
| Node.js native fs | built-in | Read CLAUDE.md, rules/*.md, settings.json, commands/*.md | No dependency needed for file reads |
| Node.js native path | built-in | Resolve config file paths across scopes | Already used throughout codebase |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| write-file-atomic | ^7.0.0 | Write scan results to disk atomically | Already in project, used for all file writes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom text similarity | string-similarity / levenshtein-distance | Overkill for v1 -- exact string matching + normalized comparison sufficient for redundancy detection |
| AST-based markdown parser | remark / unified | Over-engineered for extracting headings and references -- regex + line-by-line parsing is sufficient |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── scan/                          # NEW: Deep scan module
│   ├── index.ts                   # Public API: runDeepScan(), ScanContext type
│   ├── context-builder.ts         # Read all config files into ScanContext
│   ├── scanners/                  # Individual scanner implementations
│   │   ├── index.ts               # Scanner registry (same pattern as classifiers/index.ts)
│   │   ├── redundancy.ts          # Detect same constraint in multiple files
│   │   ├── mechanization.ts       # Detect operations that should be hooks
│   │   └── staleness.ts           # Detect references to non-existent files/commands
│   └── schemas.ts                 # ScanContext, ScanResult Zod schemas
├── cli/
│   └── init.ts                    # MODIFIED: Add scan step after hook registration
├── schemas/
│   └── recommendation.ts          # MODIFIED: Extend patternTypeSchema with scan types
└── index.ts                       # MODIFIED: Export scan module
```

### Pattern 1: ScanContext (Parallel to Summary)

**What:** A data structure that captures all parsed configuration state, analogous to how `Summary` captures pre-processed usage data for the existing classifiers.

**When to use:** Whenever a scan function needs to inspect the user's configuration.

**Example:**
```typescript
// Source: Project architecture pattern from src/analysis/schemas.ts
export const scanContextSchema = z.object({
  generated_at: z.iso.datetime(),
  project_root: z.string(),
  claude_md_files: z.array(z.object({
    path: z.string(),
    scope: z.enum(['user', 'project', 'local']),
    content: z.string(),
    line_count: z.number(),
    headings: z.array(z.string()),
    references: z.array(z.string()), // @path references
  })),
  rules: z.array(z.object({
    path: z.string(),
    filename: z.string(),
    content: z.string(),
    frontmatter: z.object({
      paths: z.array(z.string()).optional(),
    }).optional(),
    headings: z.array(z.string()),
  })),
  settings: z.object({
    user: z.unknown().nullable(),
    project: z.unknown().nullable(),
    local: z.unknown().nullable(),
  }),
  commands: z.array(z.object({
    path: z.string(),
    name: z.string(),
    content: z.string(),
  })),
  hooks_registered: z.array(z.object({
    event: z.string(),
    scope: z.enum(['user', 'project', 'local']),
    type: z.string(),
    command: z.string().optional(),
  })),
});
export type ScanContext = z.infer<typeof scanContextSchema>;
```

### Pattern 2: Scanner Functions (Parallel to Classifier)

**What:** Each scanner follows the same function signature pattern as classifiers, but takes `ScanContext` instead of `Summary + EnvironmentSnapshot`.

**When to use:** For each scan detection category (redundancy, mechanization, staleness).

**Example:**
```typescript
// Source: Project pattern from src/analysis/classifiers/index.ts
export type Scanner = (context: ScanContext) => Recommendation[];

export const scanners: Scanner[] = [
  scanRedundancy,
  scanMechanization,
  scanStaleness,
];
```

### Pattern 3: Integration with init Command

**What:** The `runInit()` function calls `runDeepScan()` after successful hook registration. Scan results are rendered and written using the existing delivery pipeline.

**When to use:** When `harness-evolve init` completes hook registration.

**Example:**
```typescript
// In src/cli/init.ts, after hooks registered
import { runDeepScan } from '../scan/index.js';

// After hook registration succeeds:
console.log('\nScanning configuration...\n');
const scanResult = await runDeepScan(process.cwd());
if (scanResult.recommendations.length > 0) {
  // Render and display scan results
  console.log(`Found ${scanResult.recommendations.length} configuration suggestions.`);
  console.log(`See ${paths.recommendations} for details.`);
}
```

### Anti-Patterns to Avoid

- **Coupling scan to existing analysis pipeline:** The deep scan does NOT require pre-processed usage data (Summary). It should NOT call `preProcess()` or depend on counter state. It is an independent analysis path.
- **Creating new recommendation format:** Scan results MUST use the existing `Recommendation` type, `renderRecommendations()`, and state management. No new output format.
- **Reading file content inside scanner functions:** All file I/O should happen in `context-builder.ts`. Scanner functions receive fully-loaded `ScanContext` and are pure functions (testable without filesystem mocking).
- **Blocking init on scan failures:** Scan errors should be caught and reported, never blocking hook registration. Hooks are the critical path; scan is value-add.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex parser | Simple split on `---` markers | YAML frontmatter in .claude/rules/ is minimal (just `paths:` array). A regex split + manual parsing is simpler and more reliable than adding a yaml dependency |
| Markdown heading extraction | Full markdown AST | Regex `/^#{1,6}\s+(.+)$/gm` | Only need headings for redundancy comparison, not full document structure |
| File reference detection | Custom link parser | Regex `/@([\w./-]+)/g` for @ references | CLAUDE.md @imports follow a simple `@path` pattern |
| Normalized string comparison | Levenshtein distance library | Lowercase + trim + collapse whitespace | v1 redundancy detection needs exact/near-exact match, not fuzzy matching |

**Key insight:** The deep scan is fundamentally text analysis on well-structured config files. The formats are simple enough (markdown + JSON) that native string operations and regex cover all v1 detection needs without external dependencies.

## Common Pitfalls

### Pitfall 1: Confusing Scanner Scope with Environment Scanner

**What goes wrong:** Reusing or conflating the existing `environment-scanner.ts` (which discovers what tools exist) with the deep scan (which reads and analyzes content of config files).
**Why it happens:** Both read similar file locations (.claude/rules/, settings.json, CLAUDE.md).
**How to avoid:** The environment scanner discovers presence/existence (names, counts). The deep scanner reads and analyzes file CONTENT for quality issues. They are complementary but distinct. The deep scan can leverage the environment scanner's output as a starting point for what to read, but must then do deep content analysis.
**Warning signs:** If the scanner only knows file names but not content, it is duplicating environment-scanner, not adding value.

### Pitfall 2: File Path Resolution Across Scopes

**What goes wrong:** Hardcoding paths or missing config file locations that Claude Code actually reads.
**Why it happens:** CLAUDE.md files load from 4+ locations (project root, .claude/, ~/.claude/, CLAUDE.local.md). Rules load from .claude/rules/ recursively. Settings load from 3 scopes.
**How to avoid:** Use the existing environment scanner's `discoverClaudeMd()` and `discoverRules()` patterns as the starting point for file discovery. Walk directory tree upward from cwd for CLAUDE.md files just like Claude Code does.
**Warning signs:** Tests only check project root CLAUDE.md and miss ~/.claude/CLAUDE.md.

### Pitfall 3: False Positive Redundancy

**What goes wrong:** Flagging conceptually different rules as redundant because they share a keyword.
**Why it happens:** Naive string matching ("always use TypeScript" in CLAUDE.md and "TypeScript naming conventions" in rules) triggers false positives.
**How to avoid:** Compare at the heading/section level, not individual words. Use heading text + first sentence as the comparison unit. Require HIGH similarity (not just keyword overlap). Start with HIGH threshold and lower if users report missed detections.
**Warning signs:** Every user gets 10+ redundancy recommendations on first scan.

### Pitfall 4: Extending patternTypeSchema Without Updating Tests

**What goes wrong:** Adding new pattern type values to the enum breaks existing tests that create recommendations with hardcoded pattern_type values.
**Why it happens:** The patternTypeSchema is a Zod enum -- adding values is non-breaking for existing code, but tests may rely on exhaustive matching.
**How to avoid:** Add scan-specific pattern types (`scan_redundancy`, `scan_missing_mechanization`, `scan_stale_reference`) to the enum. Run existing tests to verify no breakage.
**Warning signs:** Existing classifier tests or recommendation schema tests fail after enum extension.

### Pitfall 5: Scan Blocking init Exit

**What goes wrong:** A scan error (e.g., permission denied reading ~/.claude/CLAUDE.md) crashes the init command after hooks have been successfully registered.
**Why it happens:** Missing try-catch around scan execution in init flow.
**How to avoid:** Wrap scan execution in try-catch. On error, log a warning and continue. Hook registration is the critical path; scan is advisory.
**Warning signs:** `harness-evolve init` exits with non-zero status due to scan failure despite hooks being registered.

## Code Examples

### Context Builder: Reading Config Files

```typescript
// Source: Pattern from src/analysis/environment-scanner.ts
import { readFile, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';

export async function buildScanContext(
  cwd: string,
  home?: string,
): Promise<ScanContext> {
  const homeDir = home ?? process.env.HOME ?? '';

  // Read CLAUDE.md files at all scopes
  const claudeMdFiles = await readClaudeMdFiles(cwd, homeDir);

  // Read .claude/rules/ recursively
  const rules = await readRuleFiles(cwd);

  // Read settings at all 3 scopes
  const settings = await readAllSettings(cwd, homeDir);

  // Read .claude/commands/ files
  const commands = await readCommandFiles(cwd);

  // Extract registered hooks from settings
  const hooks = extractHooksFromAllSettings(settings);

  return scanContextSchema.parse({
    generated_at: new Date().toISOString(),
    project_root: cwd,
    claude_md_files: claudeMdFiles,
    rules,
    settings,
    commands,
    hooks_registered: hooks,
  });
}
```

### Redundancy Scanner

```typescript
// Source: Pattern from src/analysis/classifiers/config-drift.ts
export function scanRedundancy(context: ScanContext): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  // Check 1: Same heading appearing in CLAUDE.md AND rules
  const claudeMdHeadings = context.claude_md_files.flatMap(f =>
    f.headings.map(h => ({ heading: normalizeText(h), source: f.path }))
  );
  const ruleHeadings = context.rules.flatMap(r =>
    r.headings.map(h => ({ heading: normalizeText(h), source: r.path }))
  );

  for (const cmdH of claudeMdHeadings) {
    const match = ruleHeadings.find(rH => rH.heading === cmdH.heading);
    if (match) {
      recommendations.push({
        id: `rec-scan-redundancy-${index++}`,
        target: 'RULE',
        confidence: 'MEDIUM',
        pattern_type: 'scan_redundancy',
        title: `Redundant section: "${cmdH.heading}"`,
        description: `The heading "${cmdH.heading}" appears in both ${cmdH.source} and ${match.source}. This may indicate duplicated instructions.`,
        evidence: {
          count: 2,
          examples: [cmdH.source, match.source],
        },
        suggested_action: `Consolidate into one location. If it belongs in rules, remove from CLAUDE.md. If it belongs in CLAUDE.md, remove the rule file.`,
      });
    }
  }

  // Check 2: Duplicate rule files (same content in different files)
  // Check 3: Same permission in multiple settings scopes
  // ...

  return recommendations;
}
```

### Mechanization Scanner

```typescript
// Source: Pattern informed by project's routing decision tree (CLAUDE.md iteration-routing.md)
const MECHANIZATION_INDICATORS = [
  // Patterns in rule/CLAUDE.md text that suggest hookable operations
  { regex: /always\s+run\s+["`']?(\S+)/i, hookEvent: 'PreToolUse' },
  { regex: /before\s+committing?,?\s+run\s+["`']?(\S+)/i, hookEvent: 'PreToolUse' },
  { regex: /after\s+every\s+(?:edit|change|write)/i, hookEvent: 'PostToolUse' },
  { regex: /must\s+(?:always\s+)?check\s+["`']?(\S+)/i, hookEvent: 'PreToolUse' },
  { regex: /never\s+(?:allow|permit|run)\s+["`']?(\S+)/i, hookEvent: 'PreToolUse' },
  { regex: /forbidden.*(?:rm\s+-rf|drop\s+|delete\s+|truncate)/i, hookEvent: 'PreToolUse' },
];

export function scanMechanization(context: ScanContext): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  // Scan CLAUDE.md and rules for operations that should be hooks
  const allTextSources = [
    ...context.claude_md_files.map(f => ({ content: f.content, source: f.path })),
    ...context.rules.map(r => ({ content: r.content, source: r.path })),
  ];

  for (const source of allTextSources) {
    for (const indicator of MECHANIZATION_INDICATORS) {
      const match = source.content.match(indicator.regex);
      if (match) {
        // Check if a hook already covers this
        const alreadyCovered = context.hooks_registered.some(
          h => h.event === indicator.hookEvent
        );
        if (!alreadyCovered) {
          recommendations.push({
            id: `rec-scan-mechanize-${index++}`,
            target: 'HOOK',
            confidence: 'MEDIUM',
            pattern_type: 'scan_missing_mechanization',
            title: `Mechanizable rule: "${match[0].substring(0, 60)}"`,
            description: `Found a rule in ${source.source} that describes an operation suitable for a ${indicator.hookEvent} hook: "${match[0]}". Hooks provide 100% reliable execution, while rules depend on Claude's probabilistic compliance.`,
            evidence: {
              count: 1,
              examples: [match[0].substring(0, 100)],
            },
            suggested_action: `Create a ${indicator.hookEvent} hook to enforce this rule automatically. See Claude Code hooks docs for ${indicator.hookEvent} event.`,
          });
        }
      }
    }
  }

  return recommendations;
}
```

### Staleness Scanner

```typescript
export function scanStaleness(context: ScanContext): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  // Check 1: @path references in CLAUDE.md that point to non-existent files
  for (const claudeMd of context.claude_md_files) {
    for (const ref of claudeMd.references) {
      // Resolve relative to the CLAUDE.md file's directory
      const resolved = resolve(dirname(claudeMd.path), ref);
      const exists = context.rules.some(r => r.path === resolved)
        || context.claude_md_files.some(f => f.path === resolved)
        || context.commands.some(c => c.path === resolved);
      // Also check filesystem if not in context
      if (!exists) {
        recommendations.push({
          id: `rec-scan-stale-${index++}`,
          target: 'CLAUDE_MD',
          confidence: 'HIGH',
          pattern_type: 'scan_stale_reference',
          title: `Stale reference: @${ref}`,
          description: `${claudeMd.path} references @${ref}, but this file does not exist.`,
          evidence: {
            count: 1,
            examples: [`@${ref} in ${claudeMd.path}`],
          },
          suggested_action: `Remove the @${ref} reference from ${claudeMd.path}, or create the missing file.`,
        });
      }
    }
  }

  // Check 2: Hook commands pointing to non-existent scripts
  // Check 3: Rule files referencing non-existent paths in frontmatter
  // ...

  return recommendations;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Existing config-drift classifier (names only) | Deep scan (content analysis) | Phase 12 | Moves from "you have 2 CLAUDE.md files" to "these 2 CLAUDE.md files have contradictory instructions about X" |
| Manual configuration audit | Automated scan on init | Phase 12 | Day 0 value without waiting for 50 interactions threshold |
| Usage-data-only analysis | Static config + usage data | Phase 12 | Complementary analysis paths for comprehensive coverage |

## Open Questions

1. **Scan depth for CLAUDE.md traversal**
   - What we know: Claude Code walks up the directory tree from cwd to find CLAUDE.md files, and discovers subdirectory CLAUDE.md files lazily
   - What's unclear: Should the deep scan also walk up the tree (potentially scanning ~/.claude/CLAUDE.md and even /Library/Application Support/ClaudeCode/CLAUDE.md), or limit to project scope?
   - Recommendation: Walk up to user scope (~/.claude/CLAUDE.md) for redundancy detection. Skip managed policy scope (requires admin). This matches the environment scanner's existing behavior.

2. **Redundancy detection granularity**
   - What we know: Heading-level comparison catches obvious duplication
   - What's unclear: How deep should content comparison go? Full section text? Key sentences?
   - Recommendation: Start with heading-level comparison + first significant paragraph. Iterate based on false positive rates. Can always go deeper in later phases.

3. **Scan persistence format**
   - What we know: Scan results must use existing Recommendation format
   - What's unclear: Should scan results be merged with usage-based analysis results, or kept separate?
   - Recommendation: Merge into the same recommendations.md file and state tracking. Use distinct `pattern_type` values (`scan_redundancy`, `scan_missing_mechanization`, `scan_stale_reference`) to distinguish scan results from usage-based results.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/unit/scan/` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCN-01 | buildScanContext reads all 4 config sources | unit | `npx vitest run tests/unit/scan/context-builder.test.ts -x` | Wave 0 |
| SCN-01 | runDeepScan produces Recommendation[] | unit | `npx vitest run tests/unit/scan/index.test.ts -x` | Wave 0 |
| SCN-01 | init command calls scan after hook registration | integration | `npx vitest run tests/integration/cli-scan.test.ts -x` | Wave 0 |
| SCN-02 | scanRedundancy detects duplicate headings across files | unit | `npx vitest run tests/unit/scan/scanners/redundancy.test.ts -x` | Wave 0 |
| SCN-02 | scanMechanization detects hookable operations in rules | unit | `npx vitest run tests/unit/scan/scanners/mechanization.test.ts -x` | Wave 0 |
| SCN-02 | scanStaleness detects broken @references | unit | `npx vitest run tests/unit/scan/scanners/staleness.test.ts -x` | Wave 0 |
| SCN-03 | Scan results use existing Recommendation schema | unit | `npx vitest run tests/unit/scan/index.test.ts -x` | Wave 0 |
| SCN-03 | Scan results render via existing renderRecommendations | unit | `npx vitest run tests/unit/scan/index.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/scan/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/scan/context-builder.test.ts` -- covers SCN-01
- [ ] `tests/unit/scan/index.test.ts` -- covers SCN-01, SCN-03
- [ ] `tests/unit/scan/scanners/redundancy.test.ts` -- covers SCN-02
- [ ] `tests/unit/scan/scanners/mechanization.test.ts` -- covers SCN-02
- [ ] `tests/unit/scan/scanners/staleness.test.ts` -- covers SCN-02
- [ ] `tests/integration/cli-scan.test.ts` -- covers SCN-01 integration

## Project Constraints (from CLAUDE.md)

- **Language:** Technical discussion in Chinese, code comments in pure English (no Chinese in code)
- **Commit format:** GSD format `<type>(<phase>-<plan>): <description>`, validated by hook
- **No Co-Authored-By** in commit messages (hook blocks it)
- **TDD workflow:** Write tests first (red), then implement (green)
- **Verification loop:** Build -> Test -> Lint -> TypeCheck after each code change
- **GSD workflow enforcement:** All file changes must go through GSD workflow
- **Build tool:** tsup (configured in tsup.config.ts)
- **Test runner:** Vitest (configured in vitest.config.ts)
- **Node >= 22.14.0**, TypeScript ~6.0, Zod ^4.3.6
- **ESM-only** module system
- **write-file-atomic** for all file writes that need atomicity

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/schemas/recommendation.ts` -- Recommendation schema, PatternType enum, AnalysisResult shape
- Codebase analysis: `src/analysis/classifiers/index.ts` -- Classifier function signature pattern
- Codebase analysis: `src/analysis/classifiers/config-drift.ts` -- Existing config drift detection (surface-level)
- Codebase analysis: `src/analysis/environment-scanner.ts` -- File discovery patterns for all config locations
- Codebase analysis: `src/delivery/auto-apply.ts` -- Applier registry, auto-apply pipeline
- Codebase analysis: `src/delivery/appliers/index.ts` -- Applier interface and registry pattern
- Codebase analysis: `src/cli/init.ts` -- Init command structure, integration point for scan
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Official hook documentation, lifecycle events, handler types, settings schema
- [Claude Code Memory](https://code.claude.com/docs/en/memory) -- CLAUDE.md file format, .claude/rules/ format, @reference syntax, directory traversal
- [Claude Code Settings](https://code.claude.com/docs/en/settings) -- Settings.json schema, scope hierarchy, available settings keys

### Secondary (MEDIUM confidence)
- [Claude Code Slash Commands](https://code.claude.com/docs/en/slash-commands) -- .claude/commands/ format and structure
- [CLAUDE.md best practices](https://www.builder.io/blog/claude-md-guide) -- Community patterns for CLAUDE.md organization

### Tertiary (LOW confidence)
- None -- all findings verified with official docs or codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns verified in existing codebase
- Architecture: HIGH -- direct extension of existing classifier/recommendation patterns
- Pitfalls: HIGH -- identified from concrete codebase analysis and Claude Code documentation

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (30 days -- stable domain, patterns are internal to project)
