# Technology Stack — v4.0 Model-Driven Scanner Architecture

**Project:** harness-evolve
**Researched:** 2026-04-06
**Scope:** Stack additions/changes for model-driven scanning, GSD-style behavior documents, and open-source ecosystem comparison. Existing validated stack (Node.js 22, TypeScript 6, tsup 8.x, Zod 4, Commander.js 14, Vitest 4, write-file-atomic, proper-lockfile) is NOT re-researched.
**Overall confidence:** HIGH

---

## Executive Summary

The v4.0 architectural shift is fundamentally different from previous milestones: it removes code, not adds it. The current 7 hardcoded TypeScript scanners will be replaced by model-driven analysis where the user's Claude Code model performs the analysis, guided by embedded documentation in the `/evolve:scan` slash command template. This means the primary "stack addition" is **structured markdown documentation** -- not new npm packages.

**Key insight from research:** The GSD framework, Everything Claude Code, Singularity-Claude, and Cog all converge on the same pattern -- **markdown documents as behavior specifications**. GSD calls them "workflow documents," ECC calls them "skills," Singularity calls them "SKILL.md files." The mechanism is identical: structured natural language embedded in `.claude/commands/*.md` files that Claude Code loads as context when the slash command is invoked. harness-evolve already uses this pattern (the v3.0 `/evolve:scan` and `/evolve:apply` templates are 143/163 lines of behavior specification). v4.0 deepens this pattern by moving scanner logic from TypeScript into the template.

**The result: zero new production dependencies.** One dev dependency addition for YAML frontmatter parsing in tests. Everything else is restructuring existing code and expanding markdown templates.

---

## Architecture Change: Why No New Dependencies

### Current State (v3.0)

```
User invokes /evolve:scan
  -> Template tells Claude to run `npx harness-evolve scan`
  -> CLI invokes runDeepScan()
  -> 7 TypeScript scanner functions execute against ScanContext
  -> Returns Recommendation[] JSON
  -> Claude renders results per template format
```

The model is **not involved in analysis**. It only renders results. All intelligence is in TypeScript regex matching and heuristics (e.g., `scanMechanization` matches patterns like `/always\s+run/i`).

### Target State (v4.0)

```
User invokes /evolve:scan
  -> Template contains embedded scanner guidance docs (checklists, severity definitions, examples)
  -> Template tells Claude to read config files directly (Read tool, not CLI)
  -> Claude performs analysis using its own reasoning + guidance docs
  -> Claude outputs structured findings in the specified format
  -> Optionally: CLI validates/stores findings for /evolve:apply pipeline
```

The model **is the scanner**. The guidance documents replace regex heuristics with natural language analysis criteria that the model evaluates against the user's actual configuration.

### Why This Works Better

| Dimension | Hardcoded Scanner | Model-Driven Scanner |
|-----------|-------------------|----------------------|
| False positives | HIGH -- regex can't understand context | LOW -- model understands intent |
| Coverage | LIMITED -- only checks what code is written for | BROAD -- model reasons about any pattern |
| Maintenance | Every new check = new TypeScript code | Add a line to the checklist |
| Adaptability | None -- same checks for every user | Adapts to project-specific conventions |
| Extensibility | Requires code changes + npm publish | Users can extend guidance docs locally |

---

## Stack Decisions

### 1. No New Production Dependencies

The v4.0 model-driven scanner requires **zero new npm packages** because:

1. **Scanner logic moves from TypeScript to markdown** -- no code to execute
2. **File reading is done by Claude's built-in Read/Grep tools** -- not by CLI
3. **Context building can be simplified** -- the model reads files directly instead of building a ScanContext JSON blob
4. **Output format is enforced by template instructions** -- not by Zod schemas in the pipeline

The existing stack handles everything:
- `commander` -- CLI still needed for `init`, `status`, `uninstall`, and a lightweight `scan` command
- `zod` -- Still validates any structured data that passes through the CLI (stored recommendations)
- `write-file-atomic` -- Still used for recommendation storage
- `node:fs/promises` -- Still used by context-builder (simplified version)

### 2. Context Builder Simplification (Existing Code Change)

**Current:** `context-builder.ts` (334 lines) reads all config files, extracts headings, parses frontmatter, builds a Zod-validated `ScanContext` object with nested arrays.

**v4.0:** The context builder becomes optional/simplified. Two paths:

| Path | When | What Happens |
|------|------|--------------|
| **Model-driven** (primary) | `/evolve:scan` slash command | Template instructs Claude to use Read/Grep tools directly. No context builder needed. |
| **CLI fallback** | `npx harness-evolve scan` from terminal | Simplified context builder produces a text summary (not JSON), piped to stdout for human reading or model consumption. |

The context builder doesn't need new dependencies -- it's a simplification of existing code.

### 3. Scanner Guidance Documents (New Files, No Dependencies)

The core v4.0 deliverable is a set of **scanner guidance documents** embedded in the `/evolve:scan` template. These are structured markdown sections within `src/commands/evolve-scan.ts` that the template generator embeds.

**Structure borrowed from GSD's pattern:**

GSD uses a layered document approach:
- `PROJECT.md` -- vision, always loaded
- `CONTEXT.md` -- phase-specific preferences
- `PLAN.md` -- XML-structured atomic tasks with verification criteria

harness-evolve v4.0 adapts this as:
- **Scanner overview** -- what to check, severity scale (already exists in v3.0 template)
- **Per-scanner guidance** -- detailed checklist, examples of findings, edge cases to avoid
- **Output format contract** -- exact structure the model must produce (already exists)
- **Calibration examples** -- "this IS a finding" vs "this is NOT a finding" pairs

No libraries needed -- this is pure markdown engineering within existing TypeScript template generators.

### 4. YAML Frontmatter Parsing for Tests (Dev Dependency)

**Decision: Use `yaml` package for test validation only.**

The `/evolve:scan` and `/evolve:apply` templates include YAML frontmatter (`---` delimited). Currently, the existing `parseFrontmatter()` in `context-builder.ts` does minimal regex-based extraction. For v4.0 testing of the expanded templates, proper YAML parsing ensures frontmatter correctness.

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| yaml | ^2.7.x | Parse YAML frontmatter in template tests | The `yaml` package is the standard YAML parser for Node.js (23M+ weekly downloads). Used only in tests to validate that generated templates have correct frontmatter. NOT a production dependency -- templates are consumed as raw text by Claude Code. |

**Alternative considered: `gray-matter`** -- Popular frontmatter parser (8M weekly downloads), but it bundles `js-yaml` internally and adds string-manipulation helpers we don't need. The `yaml` package is lower-level, lighter, and more appropriate for test-only validation.

**Alternative considered: Keep using regex** -- Adequate for current 3-field frontmatter, but v4.0 templates may add fields like `allowed-tools`, `model`, `timeout`. Regex parsing becomes fragile at 5+ fields. The `yaml` package is the principled choice.

### 5. No NLP/AI Libraries

**Decision: Do NOT add winkNLP, natural, or any NLP library.**

The v1.0 STACK.md listed winkNLP as a "deferred decision" for semantic similarity. v4.0 eliminates the need entirely because:

1. The model IS the NLP engine -- it understands semantic similarity natively
2. Prompt deduplication (the original use case) can be done by the model directly
3. Adding a local NLP library would be architecturally backwards -- we're moving FROM code-based analysis TO model-based analysis

### 6. No Markdown/AST Parsing Libraries

**Decision: Do NOT add remark, unified, markdown-it, or similar.**

The scanner guidance documents are **consumed by Claude Code as raw text**, not parsed programmatically. Claude Code's markdown rendering handles the presentation. We don't need to parse or transform markdown at the application level.

**Exception:** If a future phase needs to programmatically generate markdown from structured data (e.g., combining user-provided checklist items with defaults), we'd consider `mdast-util-to-markdown` from the unified ecosystem. But v4.0 doesn't need this -- templates are static TypeScript string literals.

### 7. Template Versioning (Existing Pattern, No New Dependencies)

The v3.0 template system already has version-aware updates:

```typescript
const SCAN_TEMPLATE_VERSION = '3';
```

v4.0 increments this to trigger re-installation of updated templates for existing users. The `extractInstalledVersion()` + version comparison logic in the init command handles this automatically. No new code patterns or dependencies needed.

---

## Existing Stack: What Changes

### Files That Change (Not Stack, But Architecture)

| File | Current | v4.0 | Impact |
|------|---------|------|--------|
| `src/commands/evolve-scan.ts` | 171 lines, brief scanner descriptions | 400-600 lines, full guidance docs | Major expansion of template content |
| `src/scan/scanners/*.ts` | 7 scanner functions, ~600 total LOC | Deprecated or simplified to validation-only | Code removal |
| `src/scan/index.ts` | Orchestrates all 7 scanners | Simplified or becomes optional CLI-only path | Simplification |
| `src/scan/context-builder.ts` | Full ScanContext builder | Simplified text summary generator | Simplification |
| `src/scan/schemas.ts` | ScanContext Zod schema | Simplified or retained for CLI path | Minimal change |

### Files That Don't Change

| File | Why |
|------|-----|
| `src/schemas/recommendation.ts` | Recommendation schema stays -- /evolve:apply still uses structured recommendations |
| `src/cli.ts` | CLI commands stay -- init/status/uninstall/scan all still needed |
| `src/commands/evolve-apply.ts` | Apply template stays -- interactive apply workflow unchanged |
| `src/hooks/*.ts` | All hook handlers stay -- interaction capture pipeline is independent |
| `src/analysis/**` | Classifier pipeline stays -- background analysis is separate from deep scan |
| `src/generators/**` | Generator functions stay -- skill/hook/patch generation is separate |
| `src/delivery/**` | Delivery pipeline stays -- notification and recommendation output unchanged |

---

## Recommended Stack (Complete v4.0 View)

### Unchanged Core (DO NOT MODIFY)

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | >=22.14.0 | Runtime |
| TypeScript | ~6.0 | Type safety |
| tsup | ^8.5.1 | Bundler |
| Zod | ^4.3.6 | Schema validation |
| Commander.js | ^14.0.3 | CLI framework |
| @commander-js/extra-typings | ^14.x | CLI type inference |
| write-file-atomic | ^7.0.0 | Atomic file writes |
| proper-lockfile | ^4.1.2 | Cross-process locking |
| Vitest | ^4.1.2 | Testing |
| tsx | ^4.x | Dev-time TS execution |

### New Dev Dependencies

| Package | Version | Purpose | When to Install |
|---------|---------|---------|-----------------|
| yaml | ^2.7.0 | YAML frontmatter parsing in template tests | Phase where template expansion happens |

### Dependencies NOT to Add

| Package | Why Not |
|---------|---------|
| winkNLP | Model IS the NLP engine now. Local NLP is architecturally backwards. |
| remark / unified / markdown-it | Templates consumed as raw text by Claude Code. No programmatic markdown parsing needed. |
| gray-matter | Overkill for test-only frontmatter validation. `yaml` is lighter. |
| @anthropic-ai/sdk | harness-evolve does NOT call the Anthropic API. The user's Claude Code session provides the model. Adding an SDK would introduce API key management, billing complexity, and vendor lock-in for zero benefit. |
| langchain / llamaindex | Same reason as above. Model-driven means the model that's already running does the work, not a separate API call. |
| openai / any LLM SDK | harness-evolve is Claude Code-specific and model-agnostic within that context. |
| handlebars / ejs / mustache | Template strings in TypeScript are sufficient. Adding a templating engine for markdown generation is over-engineering. |
| js-yaml | Predecessor to `yaml` package. The `yaml` package (v2.x) is the maintained successor with better TypeScript support. |
| @constellos/claude-code-kit | Third-party Claude Code type definitions. Risk of drift. Own Zod schemas are safer. |

---

## Slash Command Template Architecture (The Real "Stack")

Since the primary deliverable is expanded markdown templates, here's the architectural pattern for the guidance documents:

### Template Structure (GSD-Inspired)

```
/evolve:scan template structure:
---
name: scan
description: ...
allowed-tools: Read(*), Grep(*), Glob(*), Bash(npx harness-evolve *)
---

# Evolve Scan (v4)

## Your Role
[One paragraph: you are a config auditor. Analyze, don't just pattern-match.]

## What to Scan
[Ordered list of file locations to check]

## Scanner Guidance

### 1. Redundancy Analysis
**What to look for:** [checklist]
**Severity:** [when PROBLEM vs SUGGESTION]
**Examples:**
  - IS a finding: [concrete example]
  - NOT a finding: [concrete non-example]

### 2. Mechanization Opportunities
[same structure]

### 3. Staleness Detection
[same structure]

... (7 scanner sections)

## Output Format
[Exact format specification -- carried forward from v3.0]

## Calibration
[Global examples of correct vs incorrect findings]
[False positive patterns to avoid]

## Edge Cases
[Carried forward from v3.0 + new model-specific cases]
```

### Key Design Decisions for Templates

| Decision | Rationale |
|----------|-----------|
| `allowed-tools` includes Read/Grep/Glob | Model needs filesystem access to analyze config files. v3.0 only allowed Bash for CLI calls. |
| `disable-model-invocation: false` (or removed) | v3.0 set `disable-model-invocation: true` because the CLI did all work. v4.0 needs model reasoning. |
| Calibration examples use IS/NOT pairs | Research from Anthropic's prompt engineering best practices: providing both positive and negative examples dramatically improves classification accuracy. |
| Per-scanner severity definitions | Prevents the model from over-flagging. "This is a SUGGESTION, not a PROBLEM" boundaries. |
| Scanner sections are ordered by impact | Highest-impact scanners first ensures they get most attention if context is limited. |

### Template Size Budget

| Component | Estimated Lines | Notes |
|-----------|----------------|-------|
| Frontmatter + overview | 30 | Carried from v3.0 |
| Per-scanner guidance (7 scanners) | 280 (40 per scanner) | New content |
| Output format | 50 | Carried from v3.0 |
| Calibration examples | 40 | New content |
| Error handling + edge cases | 30 | Carried from v3.0 |
| **Total** | **~430 lines** | Within Claude Code's effective context budget |

**Risk: Template too large?** Research indicates Claude Code loads `.claude/commands/*.md` fully into context. GSD's workflow documents are 200-400 lines each without issues. ECC has skills exceeding 500 lines. 430 lines is well within safe territory. However, monitor for quality degradation and split into sub-templates if needed.

---

## Open-Source Ecosystem Comparison (Research for v4.0 Feature)

This section informs the "ecosystem comparison" feature requirement -- not a stack decision, but context the roadmap needs.

### Competitive Landscape (April 2026)

| Tool | GitHub Stars | Approach | Scanner/Audit | Self-Improving |
|------|-------------|----------|---------------|----------------|
| **Everything Claude Code** | ~82K+ | Agent harness optimization system | `/harness-audit` (deterministic scoring), `/security-scan` (102 rules) | No -- static rule sets |
| **GSD** | 5K+ (est.) | Spec-driven development workflow | No scanner -- different problem domain | No -- workflow orchestration |
| **Cog** | 1K+ (est.) | Cognitive architecture, tiered memory | `/evolve` (audit architecture + rule effectiveness) | Yes -- `/reflect` mines patterns |
| **Singularity-Claude** | 500+ (est.) | Self-evolving skill engine | Gap detection for skills | Yes -- score/repair/crystallize loop |
| **Claude-Mem** | 1K+ (est.) | Session capture + AI compression | No scanner | No -- memory only |
| **Total Recall** | 500+ (est.) | Tiered memory with write gates | No scanner | No -- memory only |
| **harness-evolve** | <100 | Self-iteration engine, pattern detection | 7 scanners (moving to model-driven) | Yes -- captures patterns, routes optimizations |

### What to Borrow

| From | Pattern | How to Apply |
|------|---------|-------------|
| GSD | Layered document architecture (PROJECT > CONTEXT > PLAN) | Scanner guidance docs follow this layering: overview > per-scanner > calibration |
| GSD | Fresh subagent contexts to avoid context rot | Already used via slash commands (each invocation is a fresh context) |
| ECC | Deterministic scoring for audits | Keep a deterministic scoring summary alongside model-driven findings |
| ECC | Manifest-driven installation | Already have init system; can add manifest for scanner guidance doc versions |
| Singularity | IS/NOT calibration pattern | Adopt for scanner guidance: "IS a finding" vs "NOT a finding" examples |
| Singularity | Maturity stages for skills | Could apply to scanner guidance docs: draft > tested > hardened |
| Cog | `/reflect` pattern mining | harness-evolve's background analysis pipeline already does this |

### What NOT to Borrow

| Pattern | Why Not |
|---------|---------|
| ECC's 119 skills + 60 commands | Bloat. harness-evolve is focused on one thing (config optimization), not a Swiss army knife. |
| Singularity's shell-only approach | harness-evolve already has TypeScript infrastructure. Going shell-only would be a regression. |
| Cog's multi-tier memory | Out of scope. harness-evolve routes TO memory systems, doesn't build one. |
| ECC's red-team/blue-team/auditor pipeline | Overkill for config audit. Three model invocations per scan is expensive and slow. |

---

## Installation (v4.0 Changes)

### New Dev Dependency

```bash
npm install -D yaml@^2.7.0
```

### Production Dependencies: No Changes

```bash
# Nothing to install. v4.0 is a refactoring + documentation milestone.
```

---

## Performance Budget (v4.0 Update)

| Operation | v3.0 Target | v4.0 Target | Notes |
|-----------|-------------|-------------|-------|
| `/evolve:scan` via slash command | <5s (CLI + 7 scanners) | 15-45s (model analysis) | Model reads files + reasons. Slower but dramatically more accurate. Acceptable for on-demand scan. |
| `npx harness-evolve scan` CLI | <5s | <5s (simplified) | CLI path stays fast -- reduced scanner set or text summary only. |
| `/evolve:apply` | Unchanged | Unchanged | Apply pipeline doesn't change. |
| Hook latency | Unchanged | Unchanged | Hook capture pipeline doesn't change. |

**Key tradeoff:** Model-driven scanning is 3-10x slower than hardcoded scanners, but eliminates false positives and catches issues that regex never could. This is the right tradeoff for an on-demand analysis tool (not a real-time hook).

---

## Integration Points

### How v4.0 Changes Connect to Existing Stack

| Change | Integrates With | How |
|--------|-----------------|-----|
| Expanded scan template | `src/commands/evolve-scan.ts` | Template generator function grows from 171 to ~430 lines |
| Simplified context builder | `src/scan/context-builder.ts` | Produces text summary instead of (or alongside) JSON ScanContext |
| Scanner deprecation | `src/scan/scanners/*.ts` | 7 scanner files deprecated or removed |
| `allowed-tools` expansion | Slash command frontmatter | Add Read, Grep, Glob to allowed tools list |
| `disable-model-invocation` removal | Slash command frontmatter | Remove or set to false -- model must reason |
| Recommendation storage | `src/delivery/recommendation-store.ts` | Model outputs recommendations in same schema -- apply pipeline unchanged |

### What the Model Outputs

The model-driven scan must produce output that the existing `/evolve:apply` pipeline can consume. Two options:

| Option | How | Tradeoff |
|--------|-----|----------|
| **A: Model outputs structured JSON** | Template instructs model to output `Recommendation[]`-compatible JSON after analysis | Tight coupling to schema, but seamless apply pipeline integration |
| **B: Model outputs human-readable text** | Template specifies a markdown output format; CLI doesn't store results | Simpler, but breaks `/evolve:apply` pipeline |

**Recommendation: Option A.** The `/evolve:apply` pipeline is valuable and should not be broken. The scan template will instruct the model to output findings in a JSON format that matches the existing `Recommendation` schema, then the template instructs the model to call `npx harness-evolve store-scan <json>` (new CLI subcommand) to persist results for the apply pipeline.

This requires one new CLI subcommand:

```typescript
// In src/cli.ts -- new subcommand
program
  .command('store-scan')
  .description('Store scan results from model-driven analysis')
  .action(async () => {
    // Read JSON from stdin, validate with Zod, write to recommendations file
  });
```

No new dependencies -- uses existing Zod validation and write-file-atomic.

---

## Confidence Assessment

| Decision | Confidence | Basis |
|----------|------------|-------|
| Zero new production dependencies | HIGH | Architectural analysis of current codebase. Model-driven scanning delegates analysis to the Claude Code model, not to application code. |
| `yaml` as dev dependency | HIGH | 23M weekly downloads, standard YAML parser, test-only usage. Low risk. |
| Template size (~430 lines) viable | MEDIUM | GSD and ECC demonstrate templates of similar size work well. No direct measurement with harness-evolve-specific content yet. |
| Model-driven scanning is more accurate | MEDIUM | Logical inference from LLM capabilities vs regex matching. Not yet empirically validated with harness-evolve's specific scanners. Phase-specific research recommended. |
| `store-scan` CLI subcommand approach | MEDIUM | Cleanest integration with existing apply pipeline. Alternative: model writes directly to recommendation file (less structured). |
| No NLP libraries needed | HIGH | Model IS the NLP engine. Adding local NLP contradicts the architectural direction. |
| Ecosystem comparison data accuracy | LOW | GitHub star counts from web search, may be stale. Feature descriptions from README/docs, may not reflect current state. |

---

## Sources

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Official hook docs, agent/prompt hook types (HIGH confidence)
- [Claude Code Common Workflows](https://code.claude.com/docs/en/common-workflows) -- Slash command patterns, allowed-tools (HIGH confidence)
- [GSD (Get Shit Done)](https://github.com/gsd-build/get-shit-done) -- Workflow document architecture, layered context pattern (HIGH confidence)
- [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) -- Harness audit, deterministic scoring, manifest-driven install (MEDIUM confidence)
- [Singularity-Claude](https://github.com/Shmayro/singularity-claude) -- Self-evolving skills, score/repair loop, zero-dependency pattern (MEDIUM confidence)
- [Cog](https://github.com/marciopuga/cog) -- Cognitive architecture, /reflect pattern mining (MEDIUM confidence)
- [Claude-Mem](https://github.com/thedotmack/claude-mem) -- Session capture + compression (MEDIUM confidence)
- [Anthropic Prompt Engineering Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) -- Calibration example patterns (HIGH confidence)
- [Beating Context Rot with GSD (The New Stack)](https://thenewstack.io/beating-the-rot-and-getting-stuff-done/) -- GSD architecture deep dive (MEDIUM confidence)
- [GSD Framework Deep Dive (codecentric)](https://www.codecentric.de/en/knowledge-hub/blog/the-anatomy-of-claude-code-workflows-turning-slash-commands-into-an-ai-development-system) -- GSD workflow document patterns (MEDIUM confidence)
- [How Claude Code Builds a System Prompt](https://www.dbreunig.com/2026/04/04/how-claude-code-builds-a-system-prompt.html) -- Context engineering internals (MEDIUM confidence)
- [yaml npm package](https://www.npmjs.com/package/yaml) -- YAML parser for Node.js (HIGH confidence)
