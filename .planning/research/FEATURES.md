# Feature Landscape

**Domain:** Model-driven Claude Code configuration analysis and self-iteration engine
**Researched:** 2026-04-06
**Milestone:** v4.0 Intelligent Scanner & Ecosystem Learning

---

## Context: What Already Ships (v1.0 -- v3.0)

| Component | Status | Relevant to v4.0? |
|-----------|--------|-------------------|
| 7 code-based scanners (redundancy, mechanization, staleness, conflict, structure, hooks-redundancy, commands) | Shipped v3.0 | YES -- being replaced by model-driven analysis |
| `/evolve:scan` and `/evolve:apply` slash commands with self-contained workflow templates | Shipped v3.0 | YES -- scan template will embed guidance docs |
| Context builder (`buildScanContext`) reads CLAUDE.md, rules, settings, commands, hooks | Shipped v2.0 | YES -- feeds config data to model analyzer |
| Recommendation schema (`{id, target, confidence, pattern_type, severity, title, description, evidence, suggested_action}`) | Shipped v2.0 | YES -- model output must conform to this |
| Apply pipeline (apply-one, dismiss, pending) with 4 appliers (settings, rule, hook, claude-md) | Shipped v2.0-v3.0 | YES -- unchanged, consumes model output |
| Outcome tracking (apply/dismiss/revert feedback) | Shipped v1.0 | YES -- can inform guidance doc refinement |
| Version-aware template updates (`harness-evolve init` refreshes templates) | Shipped v3.0 | YES -- same mechanism for guidance doc updates |

**v4.0 replaces the 7 scanner functions with model-driven analysis guided by structured documents. Everything downstream (apply, dismiss, outcome tracking, CLI output) stays the same.**

---

## Table Stakes

Features users expect from a model-driven config scanner. Missing any of these makes the tool feel broken or unreliable.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Zero false positives on common configs** | BUG-01 proved regex scanners generate 21 false positives on real configs with nested hooks format `{matcher, hooks: [{type, command}]}`. Users immediately lose trust on first false positive. | Med | context-builder.ts fix | Blocking -- must fix before any model work. The nested hooks parsing bug is a data quality issue that affects model-driven analysis too, because the model reads ScanContext. |
| **`scan-context` CLI command** | Model needs structured config data to analyze. Code reads all files, model receives one JSON blob. Thin wrapper around existing `buildScanContext()`. | Low | BUG-01 fix | Avoids model calling readFile/Bash for each config file. Single I/O boundary. |
| **Scanner guidance document** | Replaces 7 TypeScript scanner functions with model instructions. The core deliverable -- template quality = scan quality. | High | New artifact, core of v4.0 | Each analysis category gets structured prose: what to check, severity rules, confidence calibration, edge cases, output format. |
| **`/evolve:scan` template rewrite** | Changes flow from "run CLI, present results" to "read config context, follow guidance, produce structured findings." | High | scan-context CLI, guidance docs | Must remain self-contained per GSD pattern (no CLAUDE.md dependency). |
| **`store-findings` CLI command** | Persists model-generated findings into the existing recommendation pipeline. Validates against Recommendation Zod schema before storing. | Med | Recommendation schema | Bridge between model output and existing apply/dismiss/pending workflow. |
| **Semantic conflict detection** | Current conflict scanner uses keyword regex pairs (always/never, enable/disable). Cannot detect "use ESM" vs "use CommonJS" contradictions. Users expect config analysis to understand intent, not just keywords. | High | Model-driven scanner | Core motivation for v4.0. ECC does this with 102 static rules -- harness-evolve does it with model intelligence instead. |
| **Structured, actionable output format** | Every finding must have: what is wrong, where it is, how to fix it, what improves after fixing. Already in v3.0 but must survive the architecture change. | Low | Existing Recommendation schema | Preserve current `{title, description, suggested_action, severity, confidence}` shape. Model output must conform to this contract. |
| **Backward-compatible `/evolve:apply`** | Apply pipeline must work identically with model-generated findings as with code-generated findings. Same schema, same CLI commands. | Low | Same Recommendation schema | Should work without changes if model output conforms to schema. |
| **Consistent English output regardless of session language** | Model may respond in session language. Scan output must default to English. | Low | Scan template instructions | Explicit language instruction in guidance doc. Already partially solved in v3.0 template. |
| **No hallucinated file paths or config keys** | Model must only reference files/keys that actually exist in the scan context. Hallucinating a non-existent rule file destroys credibility. | Med | Guidance doc constraints | Guidance doc must instruct model to reference ONLY files provided in context, never fabricate paths. This is the #1 risk of model-driven analysis. |

---

## Differentiators

Features that set harness-evolve apart from competitors. Not expected, but create real value.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **GSD-style behavioral guidance documents** | Instead of 102 static rules (ECC approach), harness-evolve provides structured guidance docs that teach the model HOW to analyze configs. This scales without code changes -- new analysis categories added by writing prose, not TypeScript. | High | New guidance doc system | GSD's core innovation: 56 workflow .md files regulate model behavior through structured XML-like sections (`<purpose>`, `<criteria>`, `<severity_rules>`, `<edge_cases>`). harness-evolve adopts this pattern. See "GSD Patterns Worth Adopting" section below. |
| **Cross-file semantic reasoning** | Model can detect contradictions across CLAUDE.md, rules, and settings that span different phrasings. "Always use pnpm" in CLAUDE.md + hooks running `npm install` = conflict. Regex cannot catch this; LLM can. | High | Model-driven scanner | Key differentiator vs ECC (static rules), Claude Reflect (captures corrections but does not audit existing config), and Claude Code Harness (guardrails on execution, not config quality). |
| **Cross-file coherence analysis** | Evaluate whether CLAUDE.md + rules + settings tell a coherent story. NEW analysis area impossible with code scanners. | Med | Guidance docs | e.g., CLAUDE.md says "Python project" but all rules are TypeScript-focused. |
| **Natural language mechanization detection** | Find "should always lint before commit" in any phrasing, not just regex-matched keywords like "always" + "lint". Model reads intent, not patterns. | Low | Model-driven scanner | Current mechanization scanner regex misses most real opportunities. |
| **Redundancy detection across different headings** | Two files about "git branching" flagged even if headings are "Git Rules" vs "Branch Strategy". Semantic overlap instead of string matching. | Low | Model-driven scanner | Current redundancy scanner only matches identical heading text. |
| **Checklist-driven analysis categories** | Each analysis area gets a checklist document. Model follows checklists systematically. | Med | Guidance docs | Analogous to GSD's `verify-work.md`. The checklist IS the scanner. |
| **Environment-aware routing recommendations** | Existing ecosystem scanner detects GSD/Cog/plugins. Model-driven scanner factors this into recommendations. | Med | Existing ecosystem scanner | Already have environment discovery from v1.0. Guidance docs include routing decision tree. |
| **Confidence calibration with evidence** | Model must justify confidence level with specific evidence. "HIGH because same hook command appears in 3 settings scopes" vs "MEDIUM because wording suggests redundancy but content differs." | Med | Guidance doc calibration section | Prevents "everything is HIGH" failure mode. ECC does not calibrate -- static severity per rule. |
| **Extensible via guidance editing** | Add new scan areas by editing the template .md, not writing TypeScript. Lowers barrier for community contributions. | Med | Template system | The guidance doc IS the extension mechanism. No plugin API needed. |
| **Learning from apply outcomes** | Track what recommendations users apply vs dismiss. Feedback improves guidance doc quality over time. | High | Existing outcome tracking | Outcome tracking exists but is not fed back. Defer from v4.0 MVP to v4.1+. |

---

## Anti-Features

Features to explicitly NOT build. Each has a clear reason and alternative.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Model calling readFile/Bash for each config file** | Wastes model tokens on I/O; slow; model does not know all file locations. | Code reads all files into JSON via `scan-context` CLI. Model receives one structured input blob. Single I/O boundary. |
| **Dual analysis (code scanners + model)** | Redundant passes; findings need reconciliation; doubled maintenance burden. | One analysis pass by model. Code handles only I/O and persistence. Keep old CLI with deprecation notice until validated. |
| **102+ static analysis rules (ECC approach)** | Maintenance burden scales linearly with rule count. Every new Claude Code feature requires new rules. | Write 7-10 guidance documents (one per analysis category). New categories = new doc section, not new code. |
| **Guidance docs as separate runtime files** | Slash commands must be self-contained; external file refs add fragility and version mismatch risk. | Embed all guidance in `/evolve:scan` template directly. GSD proves large embedded templates work (43KB discuss-phase.md). |
| **Free-form model output parsed by regex** | Defeats the purpose of replacing regex. Unreliable parsing. | Strict JSON output format specified in guidance with exact field names matching Recommendation schema. |
| **Auto-calling /evolve:scan on every session** | Model-driven scan costs 15-45s + tokens. Not appropriate for hot paths. | Keep as user-initiated command only. Background hooks continue with existing lightweight code. |
| **Adding Anthropic API SDK** | harness-evolve does NOT call Claude API directly. The user's Claude Code session provides the model. | No API key management or billing. The slash command template IS the model interface. |
| **NLP libraries for semantic analysis** | The model IS the NLP engine. Adding local NLP contradicts the architecture and adds dependencies. | Model handles all semantic analysis natively. winkNLP deferred since v1.0, no longer relevant. |
| **Security vulnerability scanning** | ECC already does CVE/dependency analysis with AgentShield (102 rules, 1282 tests). Duplicating this dilutes positioning. | Focus on config quality. Recommend ECC for security scanning. |
| **Self-modifying guidance documents** | Unauditable feedback loop where guidance quality can silently degrade. | Version-controlled guidance docs. Humans update based on outcome tracking data. |
| **Removing old `scan` CLI before validation** | No fallback if model-driven approach has gaps. | Keep old CLI with deprecation notice until validated with real configs. |
| **Scanner plugin/extension system** | Over-engineering. The guidance doc system IS the extension mechanism. | Guidance docs are the plugin system. Just markdown with structured sections. |

---

## Feature Dependencies

```
BUG-01 fix (context-builder.ts) ──┬──> scan-context CLI command
                                   │
                                   └──> Fixes hooks_registered data quality
                                              │
scan-context CLI ─────────────────────> /evolve:scan template rewrite
                                              │
/evolve:scan template ────────────────> scanner guidance docs (embedded)
                                              │
                                         store-findings CLI command
                                              │
store-findings CLI ───────────────────> /evolve:apply compatibility (verify)
                                              │
All above validated ──────────────────> real config validation (zero false positives)
                                              │
Validated ────────────────────────────> old scanner deprecation
                                              │
                                         cross-file coherence (incremental)
```

### Dependency Chain Details

1. **BUG-01 fix** is prerequisite for everything. `extractHooksFromAllSettings` (context-builder.ts:266-298) assumes flat `{type, command}` array elements but real Claude Code format is `{matcher, hooks: [{type, command}]}`. Without this fix, the ScanContext fed to the model contains wrong data.

2. **`scan-context` CLI command** is a thin wrapper around `buildScanContext()` that dumps structured JSON to stdout. This is how the `/evolve:scan` template gets config data into the model without making the model read files individually.

3. **Guidance docs** are the core new artifact. They replace 7 TypeScript scanner functions (~800 LOC across 7 files) with structured prose. Each doc defines: what to check, severity classification, confidence calibration, edge cases, output format.

4. **`store-findings` CLI command** takes model-generated JSON findings, validates against Recommendation Zod schema, and persists them into `~/.harness-evolve/recommendations.md`. This bridges model output to the existing apply pipeline.

5. **Recommendation schema compatibility** ensures the existing apply pipeline, outcome tracking, and CLI output continue working. Model output must parse into `Recommendation[]`.

---

## Analysis: GSD Behavioral Guidance Patterns Worth Adopting

GSD regulates model behavior through structured workflow documents (56 workflow files, 16 reference files, 34 template files totaling 500KB+). Key patterns for harness-evolve's scanner guidance:

### Pattern 1: XML-like Section Structure

GSD uses `<purpose>`, `<philosophy>`, `<process>`, `<step>` XML tags within markdown. Each section has a clear role. Scanner guidance docs should use:

```xml
<purpose>Detect redundant configuration across CLAUDE.md, rules, and settings</purpose>

<criteria>
  - Check 1: Same heading text in CLAUDE.md and a rule file
  - Check 2: Same directive repeated across settings scopes
  ...
</criteria>

<severity_rules>
  - PROBLEM: Direct contradiction between files
  - SUGGESTION: Redundancy that wastes context window but causes no errors
</severity_rules>

<confidence_calibration>
  - HIGH: Exact same text in 2+ locations
  - MEDIUM: Similar text with minor wording differences
  - LOW: Thematic overlap but substantively different content
</confidence_calibration>

<edge_cases>
  - DO NOT flag @references that naturally repeat
  - DO NOT flag npm scoped packages as file references
</edge_cases>

<output_format>
  Each finding must populate: id, target, title, description,
  suggested_action, severity, confidence, evidence
</output_format>
```

### Pattern 2: Downstream Consumer Awareness

GSD's `discuss-phase.md` includes `<downstream_awareness>` explaining exactly who reads output and what they need. Scanner guidance docs should state: "Your output feeds into `/evolve:apply`, which presents findings as interactive cards. Missing any field breaks the workflow."

### Pattern 3: Scope Guardrails

GSD has explicit `<scope_guardrail>` with "Allowed" and "Not allowed" examples. Guidance docs must include:
- "ONLY analyze files provided in the scan context."
- "ONLY flag issues you can cite evidence for."
- "Do NOT suggest new tools or architectural changes."
- "Do NOT fabricate file paths."

### Pattern 4: Self-Contained Templates

GSD's slash command templates are fully self-contained with `disable-model-invocation: true` frontmatter. Already adopted in v3.0. v4.0 preserves this.

### Pattern 5: LLM-as-Judge Rubric Pattern (from Promptfoo ecosystem)

Each severity and confidence level should have explicit anchor examples:
```
HIGH confidence, problem: "CLAUDE.md line 15 says 'always use pnpm' but
  settings.json hooks contain 'npm install'. Directly contradictory."

MEDIUM confidence, suggestion: "Rule 'git-rules.md' and CLAUDE.md both
  contain 'Branch Naming' section. Similar but not identical content."
```

---

## Competitive Landscape

| Competitor | Stars | What They Do | Gap harness-evolve Fills |
|------------|-------|-------------|--------------------------|
| **ECC** | 82K | 102 static rules, 47 agents, 181 skills, security scanning, multi-platform | Model-driven semantic analysis vs pattern-matched static rules. Zero maintenance for new patterns. |
| **Claude Reflect** | ~5K | Captures user corrections via hooks, persists to skills | Proactive audit of EXISTING config. Reflect only captures FUTURE corrections. Complementary. |
| **Claude Code Harness** | ~3K | TypeScript guardrail engine (13 rules R01-R13), Plan/Work/Review | Different domain. We audit configs, they guard execution. |
| **OpenSpace** | ~2K | MCP server: AUTO-FIX/AUTO-IMPROVE/AUTO-LEARN for skills | We optimize entire harness (7 config tool types), not just skills. |
| **claude-code-templates** | 22K | CLI + marketplace for installing configs | Provides configs. We AUDIT configs. Users need both. |

**No existing tool does model-driven semantic analysis of the complete Claude Code configuration surface with structured guidance documents.** This is harness-evolve v4.0's unique position.

---

## Guidance Document Inventory (Proposed)

Each replaces one TypeScript scanner function. All share the same XML-structured format.

| # | Document | Replaces | Key Checks | Est. Lines |
|---|----------|----------|------------|------------|
| 1 | Redundancy guidance | `scanners/redundancy.ts` (93 LOC) | Duplicate headings, duplicate rule files, repeated directives across scopes | ~150 |
| 2 | Mechanization guidance | `scanners/mechanization.ts` | Operations in rules/CLAUDE.md that should be hooks (lint, format, branch protection) | ~120 |
| 3 | Staleness guidance | `scanners/staleness.ts` | @references to non-existent files, outdated commands, deprecated features | ~100 |
| 4 | Conflict guidance | `scanners/conflict.ts` (173 LOC) | Contradictory directives (semantic, not keyword), incompatible settings across scopes | ~180 |
| 5 | Structure guidance | `scanners/structure.ts` | Empty rules, oversized rules (>200 lines), unscoped subdirectory rules, missing frontmatter | ~100 |
| 6 | Hooks guidance | `scanners/hooks-redundancy.ts` | Duplicate registrations, empty commands, non-existent scripts, overlapping matchers | ~120 |
| 7 | Commands guidance | `scanners/commands.ts` | Missing frontmatter, empty commands, missing descriptions, missing allowed-tools | ~100 |

**Total: ~870 lines of guidance docs replacing ~800 lines of TypeScript scanner code.** Similar volume, but prose (maintainable by anyone) instead of code (requires TypeScript expertise).

---

## MVP Recommendation

Prioritize for v4.0:

1. **Fix BUG-01** -- eliminates 21 false positives, prerequisite for all work
2. **`scan-context` CLI command** -- enables model-driven analysis path
3. **Scanner guidance document + template rewrite** -- the core architectural shift
4. **`store-findings` CLI command** -- connects model findings to apply pipeline
5. **Validate with real configs** -- zero false positives on actual user configurations

### Defer to v4.1+:

- **Outcome-based guidance refinement**: Requires data collection. Ship scanner first, collect apply/dismiss patterns, then refine.
- **Cross-file coherence analysis**: Can be added as an incremental guidance doc section after core categories are validated.
- **Old scanner removal**: Keep with deprecation notice until model-driven approach is fully validated.

---

## Sources

### Competitor Projects (Analyzed Directly)
- [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) -- 82K stars, 102 static rules, 47 agents (HIGH confidence)
- [ECC Analysis](https://medium.com/@tentenco/everything-claude-code-inside-the-82k-star-agent-harness-thats-dividing-the-developer-community-4fe54feccbc1) -- Feature breakdown (MEDIUM confidence)
- [Claude Reflect System](https://github.com/haddock-development/claude-reflect-system) -- Self-learning via correction capture (HIGH confidence)
- [Claude Reflect (BayramAnnakov)](https://github.com/BayramAnnakov/claude-reflect) -- Alternative reflect implementation (MEDIUM confidence)
- [Claude Code Harness](https://github.com/Chachamaru127/claude-code-harness) -- TypeScript guardrail engine (MEDIUM confidence)
- [Awesome Claude Code Toolkit](https://github.com/rohitg00/awesome-claude-code-toolkit) -- Ecosystem overview (MEDIUM confidence)

### GSD Workflow Analysis (Read Directly from Filesystem)
- `~/.claude/get-shit-done/workflows/execute-phase.md` -- Wave-based parallel execution, structured steps (HIGH confidence)
- `~/.claude/get-shit-done/workflows/discuss-phase.md` -- Downstream awareness, scope guardrails (HIGH confidence)
- `~/.claude/get-shit-done/workflows/verify-work.md` -- UAT verification with structured criteria (HIGH confidence)
- `~/.claude/get-shit-done/workflows/quick.md` -- Composable flags, agent spawning (HIGH confidence)
- `~/.claude/get-shit-done/templates/phase-prompt.md` -- Plan template with must_haves (HIGH confidence)
- `~/.claude/get-shit-done/templates/context.md` -- Decision capture for downstream consumers (HIGH confidence)

### Model-Driven Analysis Patterns
- [LLM-as-Judge Rubric (Promptfoo)](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/) -- Rubric scoring (MEDIUM confidence)
- [LLM-as-Judge 2026 Guide](https://labelyourdata.com/articles/llm-as-a-judge) -- Evaluation patterns (MEDIUM confidence)
- [Agent-as-Judge (arXiv)](https://arxiv.org/html/2508.02994v1) -- Agent evaluating agent outputs (MEDIUM confidence)

### Claude Code Documentation
- [Claude Code Skills](https://code.claude.com/docs/en/skills) -- Slash command/skill docs (HIGH confidence)
- [Claude Code Hooks](https://code.claude.com/docs/en/hooks) -- Hook events and config (HIGH confidence)
- [Harness Engineering (HumanLayer)](https://www.humanlayer.dev/blog/skill-issue-harness-engineering-for-coding-agents) -- Design patterns (MEDIUM confidence)
