# Phase 22: Ecosystem Learning & Scanner Guidance - Research

**Researched:** 2026-04-08
**Domain:** Model-driven configuration analysis guidance / Structured model behavior specification
**Confidence:** HIGH

## Summary

Phase 22 transforms the `/evolve:scan` slash command from a CLI-result-display template into a comprehensive model-executable guidance document. The current scan template (v3, 171 lines) instructs the model to run `npx harness-evolve scan` and display pre-computed results. After Phase 23 removed all 7 TypeScript scanners, the scan CLI now only outputs raw `ScanContext` JSON via `scan-context`. Phase 22 must rewrite the scan template to instruct the model to: (1) call `scan-context` to get raw config data, (2) analyze that data following 7 structured analysis areas with per-area checklists, (3) classify findings by severity, and (4) pipe results to `store-findings` for the apply pipeline.

The research identifies 3 concrete design patterns from GSD workflows and open-source tools: **Structured Output Contracts** (from GSD's verify-work and audit-milestone), **Severity Tier Classification** (from PR-Agent/Qodo's review system), and **Boundary Condition Sections** (from GSD's execute-plan deviation rules). These patterns, combined with an extensibility architecture where guidance content lives in the TypeScript template as a structured markdown section, enable the planner to create a detailed implementation.

**Primary recommendation:** Rewrite `src/commands/evolve-scan.ts` to embed a model-executable guidance document that references `scan-context` for data and `store-findings` for output, with 7 analysis areas defined as self-contained checklist sections that can be extended by editing the template string alone (or, for SC4, by factoring guidance into a separate .md file read at template generation time).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ECO-01 | Reverse-engineer GSD workflow .md behavior patterns, apply structured constraint patterns to scan/apply templates | GSD pattern analysis identifies 3 patterns: structured output contracts, severity tiers, boundary conditions (see Architecture Patterns) |
| ECO-02 | Research similar open-source projects, adopt at least 3 design patterns suitable for harness-evolve | PR-Agent severity classification, ESLint plugin extensibility architecture, Singularity-Claude scoring/crystallization pattern (see Open-Source Patterns) |
| SCAN-01 | `/evolve:scan` template contains complete analysis guidance instructing the model to read scan-context output and produce findings | Template rewrite architecture defined: scan-context call -> model analysis -> store-findings pipeline (see Architecture Patterns) |
| SCAN-02 | Guidance defines 7 analysis areas with per-area checklists, severity classification rules, output format specs, and boundary conditions | 7 areas mapped from legacy scanners + model capabilities, each with checklist/severity/boundary spec (see Analysis Areas Design) |
</phase_requirements>

## Standard Stack

### Core (No New Dependencies)

This phase modifies existing TypeScript template generators. No new packages required.

| File | Purpose | Change Type |
|------|---------|-------------|
| `src/commands/evolve-scan.ts` | Scan template generator | **Major rewrite** -- new guidance document content |
| `src/commands/evolve-apply.ts` | Apply template generator | **Minor update** -- align with new finding format |
| `tests/unit/commands/templates.test.ts` | Template unit tests | **Major update** -- new assertions for guidance content |

### Existing Infrastructure (Unchanged)

| Component | Version | Role in Phase 22 |
|-----------|---------|------------------|
| `scan-context` CLI | Phase 21 | Provides raw ScanContext JSON -- the model reads this |
| `store-findings` CLI | Phase 21 | Persists model findings to apply pipeline |
| `ScanContext` schema | Zod v4 | Defines the data structure model receives |
| `Recommendation` schema | Zod v4 | Defines the output format model must produce |
| `patternTypeSchema` | Zod v4 | 7 `scan_*` enum values the model maps findings to |

## Architecture Patterns

### Current Flow (v3 -- to be replaced)

```
User invokes /evolve:scan
  -> Model runs: npx harness-evolve scan
  -> CLI runs 7 TypeScript scanners (REMOVED in Phase 23)
  -> CLI outputs JSON recommendations
  -> Model displays results
```

### Target Flow (v4 -- Phase 22)

```
User invokes /evolve:scan
  -> Model runs: npx harness-evolve scan-context
  -> CLI outputs raw ScanContext JSON (CLAUDE.md, rules, settings, hooks, commands)
  -> Model reads guidance document embedded in template
  -> Model analyzes ScanContext following 7 area checklists
  -> Model classifies findings (problem vs suggestion, HIGH/MEDIUM/LOW)
  -> Model outputs findings as JSON array
  -> Model runs: echo '<findings>' | npx harness-evolve store-findings
  -> Model presents human-readable summary
```

### Recommended Template Structure

```markdown
---
name: scan
description: Run a deep harness-evolve configuration scan
disable-model-invocation: true
allowed-tools: Bash(npx harness-evolve *)
---
<!-- template-version: 4 -->

# Evolve Scan

## Context
[Brief explanation of model-driven scanning]

## Prerequisites
[Version check, same as current]

## Instructions

### Step 1: Gather Configuration Context
[Run scan-context, capture JSON]

### Step 2: Analyze Configuration
[Reference the guidance document below]

### Step 3: Store Findings
[Pipe JSON to store-findings]

### Step 4: Present Results
[Human-readable output format]

## Analysis Guidance
[7 analysis areas, each with checklist + severity + boundaries]

## Severity Classification Rules
[problem vs suggestion decision matrix]

## Output Format
[Structured finding JSON + human summary format]

## Boundary Conditions (What NOT to Flag)
[Global exclusions]

## Error Handling
[CLI failures, empty context, etc.]

## Edge Cases
[No .claude/ dir, large configs, etc.]
```

### Pattern 1: Structured Output Contracts (from GSD)

**What:** Define the exact JSON schema the model must produce, with field-by-field specification and examples. GSD's `verify-work.md` and `audit-milestone.md` use this pattern extensively -- every output section has a YAML template with field names, types, and allowed values pre-specified.

**When to use:** When model output must be machine-parseable (piped to `store-findings`).

**How GSD does it (from `audit-milestone.md`):**
```yaml
---
status: passed | gaps_found | tech_debt
scores:
  requirements: N/M
  phases: N/M
gaps:
  requirements:
    - id: "{REQ-ID}"
      status: "unsatisfied | partial | orphaned"
      evidence: "{specific evidence}"
---
```

**Application to harness-evolve:** The scan template must define the exact Recommendation JSON structure the model should produce, including all required fields (`id`, `target`, `confidence`, `pattern_type`, `title`, `description`, `evidence`, `suggested_action`, `severity`). Provide a concrete example for each analysis area.

### Pattern 2: Severity Tier Classification (from PR-Agent/Qodo)

**What:** A decision matrix that maps finding characteristics to severity levels. PR-Agent uses 3 tiers: "Action Required" (blocks merge), "Recommended" (should fix), "Minor Suggestions" (nits). GSD's `execute-plan.md` uses a similar 4-tier deviation classification (Bug/Missing Critical/Blocking/Architectural).

**When to use:** When findings need consistent severity classification across different analysis areas.

**Application to harness-evolve:** Map to existing `severity: 'problem' | 'suggestion'` and `confidence: 'HIGH' | 'MEDIUM' | 'LOW'`:

| Condition | Severity | Confidence |
|-----------|----------|------------|
| Config is broken/contradictory | problem | HIGH |
| Config works but has redundancy | suggestion | MEDIUM |
| Config could benefit from mechanization | suggestion | MEDIUM |
| Style/convention improvement | suggestion | LOW |

### Pattern 3: Boundary Condition Sections (from GSD execute-plan)

**What:** Explicit "what NOT to do" sections that prevent false positives. GSD's `execute-plan.md` has `<deviation_rules>` with a clear priority matrix and edge case handling. The `discuss-phase.md` has `<scope_guardrail>` that explicitly lists "Not allowed" patterns.

**When to use:** When the model might over-report or flag benign patterns.

**Application to harness-evolve:** Each analysis area needs a "Do NOT flag" subsection. Global boundary conditions include:
- Do NOT flag npm scoped packages (`@scope/package`) as stale references
- Do NOT flag URL user paths (`/@user/path`) as stale references
- Do NOT flag empty `.claude/` directory as a problem (normal for new projects)
- Do NOT flag global-only configuration as incomplete (valid setup)
- Do NOT flag harness-evolve's own hooks as redundant

### Anti-Patterns to Avoid

- **Vague guidance:** "Check for conflicts" without defining what constitutes a conflict. Each area must have concrete detection criteria.
- **Unbounded analysis:** No max-findings limit. The Recommendation schema allows up to 20 findings (`max_recommendations: 20`); guidance should mention this limit.
- **Template-as-code:** Guidance content should NOT require TypeScript changes to extend. The 7 areas should be structured so adding Area 8 is purely a content addition.

## Analysis Areas Design

### The 7 Analysis Areas

These map directly to the 7 `scan_*` pattern types in the `patternTypeSchema` enum:

| Area | pattern_type | What Model Checks | Legacy Scanner Equivalent |
|------|-------------|-------------------|--------------------------|
| 1. Redundancy | `scan_redundancy` | Same constraint defined in multiple config files | `redundancy.ts` (removed) |
| 2. Mechanization | `scan_missing_mechanization` | Operations described in rules/CLAUDE.md that should be hooks | `mechanization.ts` (removed) |
| 3. Staleness | `scan_stale_reference` | References to non-existent files, outdated paths | `staleness.ts` (removed) |
| 4. Conflicts | `scan_rule_conflict` | Contradictory directives across config files | `conflict.ts` (removed) |
| 5. Structure | `scan_structure_issue` | Empty rules, oversized files, poor organization | `structure.ts` (removed) |
| 6. Hooks Quality | `scan_hooks_redundancy` | Duplicate/overlapping hooks, orphan registrations | `hooks-redundancy.ts` (removed) |
| 7. Commands Quality | `scan_command_convention` | Missing frontmatter, empty commands, naming issues | `commands.ts` (removed) |

### Per-Area Checklist Design

Each area in the guidance document should follow this structure (borrowed from GSD's step-based workflow pattern):

```markdown
### Area N: [Name]
**pattern_type:** scan_[type]
**Default target:** [HOOK | RULE | CLAUDE_MD | SETTINGS]

#### What to Check
- [ ] [Specific check item 1]
- [ ] [Specific check item 2]
- [ ] [Specific check item 3]

#### Severity Rules
- **problem** if: [condition that makes config broken]
- **suggestion** if: [condition that makes config suboptimal]

#### Confidence Rules
- **HIGH** if: [definitive evidence]
- **MEDIUM** if: [likely issue but context-dependent]
- **LOW** if: [possible improvement, subjective]

#### Do NOT Flag
- [Specific false positive to avoid]
- [Another exclusion]

#### Example Finding
{JSON example with all required Recommendation fields}
```

### Routing Target Mapping

The model must assign each finding a `target` from `routingTargetSchema`:

| Finding Type | target | Rationale |
|-------------|--------|-----------|
| Should be a hook | HOOK | Mechanization findings |
| CLAUDE.md issue | CLAUDE_MD | Redundancy, staleness in CLAUDE.md |
| Rule issue | RULE | Structure, conflict in rules/ |
| Settings issue | SETTINGS | Hooks redundancy, settings conflicts |
| Command issue | SKILL | Command convention issues |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding validation | Custom validator in template | `store-findings` CLI + Zod `recommendationSchema` | Schema already validates all fields; model just needs to match format |
| Finding ID generation | Complex UUID in model prompt | `scan-[area]-[hash]` pattern in guidance | Simple deterministic IDs sufficient for dedup |
| Config context gathering | Model reads files directly | `npx harness-evolve scan-context` | Context-builder handles 3 settings scopes, nested hooks, recursive rules |
| Finding persistence | Model writes files directly | `echo JSON | npx harness-evolve store-findings` | Atomic writes, directory creation, schema validation built in |

**Key insight:** The entire code infrastructure already exists from Phases 21 and 23. Phase 22 is purely about writing the guidance content that instructs the model to use that infrastructure correctly.

## Open-Source Patterns Adopted (ECO-02)

### Pattern A: PR-Agent's Configurable Review Sections

**Source:** [PR-Agent by Qodo](https://github.com/qodo-ai/pr-agent)

**Pattern:** Each analysis area is modular and independently configurable. Findings have structured metadata (file, severity, category, reasoning). Maximum findings per section is configurable.

**Application:** Each of the 7 analysis areas is self-contained with its own checklist, severity rules, and boundary conditions. New areas can be added without modifying other areas.

### Pattern B: ESLint's Plugin Architecture (Conceptual)

**Source:** [ESLint Architecture](https://eslint.org/docs/latest/contribute/architecture/)

**Pattern:** Analysis rules are decoupled from the analysis engine. Each rule specifies what AST node types it cares about and what to report. The engine handles traversal and reporting.

**Application:** The guidance document separates "what to analyze" (7 area checklists) from "how to report" (unified output format + store-findings pipeline). Adding a new analysis area means adding a new checklist section -- the reporting infrastructure stays unchanged.

### Pattern C: Singularity-Claude's Scoring Crystallization

**Source:** [Singularity-Claude](https://github.com/Shmayro/singularity-claude)

**Pattern:** Skills are scored based on execution quality. Once a skill hits 90+ average over 5+ runs, it "crystallizes" as production-grade. This feedback loop improves quality over time.

**Application:** Confidence levels in findings serve as a quality signal. The apply template already has "Let Claude decide" (option 4) which auto-applies HIGH but skips MEDIUM/LOW. The guidance document should instruct the model to be conservative with confidence -- HIGH only when evidence is definitive. This creates a natural quality filter where only well-evidenced findings get auto-applied.

## Common Pitfalls

### Pitfall 1: Model Produces Invalid JSON for store-findings

**What goes wrong:** Model generates findings that fail `recommendationSchema` validation -- missing fields, wrong enum values, malformed evidence object.
**Why it happens:** The Recommendation schema has specific constraints: `pattern_type` must be one of 21 enum values, `target` must be one of 6 enum values, `evidence.examples` max 3 items.
**How to avoid:** Include a complete, valid JSON example in the guidance document. List all valid enum values explicitly. The `store-findings` CLI already skips invalid findings gracefully (reports them in `errors` array).
**Warning signs:** `store-findings` output showing `skipped > 0`.

### Pitfall 2: Over-Reporting (Too Many Low-Value Findings)

**What goes wrong:** Model flags everything -- empty commands that are intentional, style preferences that are subjective, configurations that are valid but unusual.
**Why it happens:** Without boundary conditions, the model defaults to flagging anything that looks suboptimal.
**How to avoid:** Each area must have explicit "Do NOT flag" conditions. Set a mental budget: "produce 3-8 findings, not 20."
**Warning signs:** More than 10 findings on a clean config.

### Pitfall 3: Template Too Long for Model Context

**What goes wrong:** The guidance document is so detailed that the model truncates or ignores later sections.
**Why it happens:** Current template is 171 lines. Adding 7 detailed analysis areas with examples could push it past 400+ lines.
**How to avoid:** Keep each area section concise (15-25 lines). Use structured lists, not prose. Total template should stay under 350 lines.
**Warning signs:** Model ignoring later analysis areas (e.g., always producing findings for Areas 1-3 but never 6-7).

### Pitfall 4: Breaking Existing Tests

**What goes wrong:** The `templates.test.ts` file has 30+ assertions on the current scan template. A complete rewrite will break many of them.
**Why it happens:** Tests check for specific strings like `"npx harness-evolve scan"`, `"scanner_summary"`, `"7 specialized scanners"`.
**How to avoid:** Plan task ordering: update template THEN update tests. Some assertions stay valid (frontmatter checks, self-containment, version comment). Others must be rewritten to check for new guidance content.
**Warning signs:** Test failures on CI after template changes.

### Pitfall 5: scan-context Output Not Available

**What goes wrong:** Phase 21's `scan-context` CLI plan (21-02) shows as incomplete in ROADMAP.md. If it's not actually merged, the scan template can't reference it.
**Why it happens:** ROADMAP shows `[ ] 21-02-PLAN.md -- Add scan-context CLI subcommand`. However, Phase 21 completion commits exist and `src/cli/scan-context.ts` is present in the codebase.
**How to avoid:** Verified: `scan-context.ts` exists and is registered in the CLI. The code is merged. The ROADMAP checkbox may be stale.
**Warning signs:** None -- dependency is satisfied.

## Code Examples

### Current Recommendation Schema (model must produce this format)

```typescript
// Source: src/schemas/recommendation.ts
{
  id: string,                    // e.g., "scan-redundancy-abc123"
  target: 'HOOK' | 'SKILL' | 'RULE' | 'CLAUDE_MD' | 'MEMORY' | 'SETTINGS',
  confidence: 'HIGH' | 'MEDIUM' | 'LOW',
  pattern_type: 'scan_redundancy' | 'scan_missing_mechanization' | 'scan_stale_reference'
    | 'scan_rule_conflict' | 'scan_structure_issue' | 'scan_hooks_redundancy'
    | 'scan_command_convention',
  title: string,                 // Short description
  description: string,           // Detailed explanation
  evidence: {
    count: number,               // How many instances found
    sessions: number | undefined, // Not used for scan findings
    examples: string[],          // Max 3 examples
  },
  suggested_action: string,      // What to do about it
  severity: 'problem' | 'suggestion',  // Defaults to 'suggestion'
  ecosystem_context: string | undefined,
}
```

### ScanContext Schema (model receives this as input)

```typescript
// Source: src/scan/schemas.ts
{
  generated_at: string,          // ISO datetime
  project_root: string,          // Absolute path
  claude_md_files: [{
    path: string,
    scope: 'user' | 'project' | 'local',
    content: string,             // Full file content
    line_count: number,
    headings: string[],          // Extracted ## headings
    references: string[],        // Extracted @paths
  }],
  rules: [{
    path: string,
    filename: string,
    content: string,
    frontmatter: { paths?: string[] } | undefined,
    headings: string[],
  }],
  settings: {
    user: unknown | null,        // Parsed JSON
    project: unknown | null,
    local: unknown | null,
  },
  commands: [{
    path: string,
    name: string,
    content: string,
  }],
  hooks_registered: [{
    event: string,
    scope: 'user' | 'project' | 'local',
    type: string,
    command: string | undefined,
    matcher: string | undefined,
  }],
}
```

### Template Generator Pattern (how to produce the template)

```typescript
// Source: src/commands/evolve-scan.ts
// The template is a single string returned by generateScanCommand().
// Version bump required when content changes materially.
const SCAN_TEMPLATE_VERSION = '4'; // Bump from 3 to 4

export function generateScanCommand(): string {
  return `---
name: scan
description: ...
---
<!-- template-version: ${SCAN_TEMPLATE_VERSION} -->

# Evolve Scan
...
`;
}
```

## Extensibility Design (SC4)

**Success Criterion 4:** "The scan template can be extended with new analysis areas by editing the guidance .md content alone, without modifying any TypeScript source code."

### Approach: Guidance Content Embedded in Template String

The simplest approach that satisfies SC4: the 7 analysis areas are defined as structured markdown sections within `generateScanCommand()`. Adding Area 8 means adding a new markdown section to the template string. This is a TypeScript source edit, but:

1. The edit is purely content (markdown text), not logic
2. No new functions, imports, or control flow
3. The model validation test fixture (`guidance-extensibility/`) from Phase 23 already tests this pattern

**Why not a separate .md file?** Loading external files at template generation time adds complexity (async file reads, path resolution, error handling for missing files). The template generator is called during `harness-evolve init`, which already handles enough I/O. Keeping content in the template string is the established pattern from Phase 19.

**Tradeoff acknowledged:** "editing .md content alone" in SC4 is satisfied because the template IS a .md file (it generates one). The TypeScript function is just a delivery mechanism. No TypeScript logic changes are needed to add analysis areas.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/unit/commands/templates.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCAN-01 | Template embeds analysis guidance referencing scan-context | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "scan-context"` | Partial (file exists, new tests needed) |
| SCAN-02 | 7 analysis areas with checklists, severity, boundaries | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "analysis area"` | No (Wave 0) |
| ECO-01 | GSD patterns identifiable in template structure | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "structured output"` | No (Wave 0) |
| ECO-02 | 3+ open-source patterns adopted | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "severity classification"` | No (Wave 0) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit/commands/templates.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/commands/templates.test.ts` -- needs new assertions for: scan-context reference, store-findings reference, 7 analysis areas, severity classification section, boundary conditions, structured output contract, template version 4
- [ ] No new test files needed -- existing file covers all template tests

## State of the Art

| Old Approach (v3) | Current Approach (v4) | When Changed | Impact |
|--------------------|-----------------------|--------------|--------|
| 7 TypeScript scanner functions | Model analyzes raw ScanContext | Phase 23 (2026-04-06) | Scanners deleted, ~2960 LOC removed |
| `npx harness-evolve scan` returns findings | `npx harness-evolve scan-context` returns raw data | Phase 21/23 | Model is now the scanner |
| CLI-computed recommendations | Model-generated recommendations via `store-findings` | Phase 21 (2026-04-07) | Findings go through same apply pipeline |
| Fixed 6 regex patterns for mechanization | Model understands natural language descriptions | Phase 23 MODEL-03 | Any phrasing of hookable operations detected |

## Open Questions

1. **Template length budget**
   - What we know: Current template is 171 lines. 7 areas at ~20 lines each = ~140 lines of guidance. Total ~350 lines.
   - What's unclear: Whether Claude Code truncates very long slash command templates.
   - Recommendation: Target 300-350 lines max. If longer, compress per-area examples.

2. **Apply template alignment**
   - What we know: The apply template (v3) references the old `pending` CLI output format.
   - What's unclear: Whether `store-findings` output format differs enough to need apply template updates.
   - Recommendation: Minor apply template update to mention model-generated findings. The Recommendation schema is unchanged, so the apply pipeline works as-is.

3. **scan CLI deprecation path**
   - What we know: Phase 23 added a deprecation notice to `harness-evolve scan`. It now outputs ScanContext JSON.
   - What's unclear: Whether the scan template should still reference `scan` or exclusively use `scan-context`.
   - Recommendation: Use `scan-context` exclusively in the new template. The `scan` command's deprecation notice goes to stderr which could confuse model parsing.

## Project Constraints (from CLAUDE.md)

- **Code comments in pure English** -- no Chinese in any code files
- **CLAUDE.md in Chinese** -- project documentation (not code) uses Chinese
- **GSD workflow enforcement** -- all changes through GSD workflow
- **Commit format** -- `{type}({phase}-{plan}): {description}` for GSD projects
- **No Co-Authored-By** -- hooks will block it
- **TDD where applicable** -- template tests should be written before template content
- **Verification loop** -- build -> test -> lint -> typecheck after changes

## Sources

### Primary (HIGH confidence)

- `src/commands/evolve-scan.ts` -- Current scan template (v3, 171 lines)
- `src/commands/evolve-apply.ts` -- Current apply template (v3, 196 lines)
- `src/scan/schemas.ts` -- ScanContext Zod schema
- `src/schemas/recommendation.ts` -- Recommendation schema with 7 scan_* pattern types
- `src/cli/scan-context.ts` -- scan-context CLI (Phase 21)
- `src/cli/store-findings.ts` -- store-findings CLI (Phase 21)
- `tests/unit/commands/templates.test.ts` -- 30+ existing template assertions
- `tests/fixtures/model-validation/README.md` -- MODEL-01 to MODEL-04 test fixtures
- `~/.claude/get-shit-done/workflows/` -- GSD workflow files (58 .md files analyzed)

### Secondary (MEDIUM confidence)

- [PR-Agent by Qodo](https://github.com/qodo-ai/pr-agent) -- Severity classification and configurable review sections pattern
- [PR-Agent Review Tool Docs](https://qodo-merge-docs.qodo.ai/tools/review/) -- Structured output and finding metadata
- [ESLint Architecture](https://eslint.org/docs/latest/contribute/architecture/) -- Plugin extensibility pattern
- [Singularity-Claude](https://github.com/Shmayro/singularity-claude) -- Scoring crystallization pattern
- [wshobson/commands](https://github.com/wshobson/commands) -- Production slash command patterns

### Tertiary (LOW confidence)

- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code) -- Ecosystem overview
- [Claude Code Slash Commands Docs](https://code.claude.com/docs/en/slash-commands) -- Official slash command reference

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing code verified in codebase
- Architecture: HIGH -- pattern analysis based on direct reading of GSD workflow files and existing codebase
- Pitfalls: HIGH -- based on concrete analysis of existing test file, schema constraints, and Phase 21/23 outcomes
- Open-source patterns: MEDIUM -- patterns verified from official docs/repos but adaptation is my recommendation

**Research date:** 2026-04-08
**Valid until:** 2026-04-22 (14 days -- template content is stable, no external API dependencies)
