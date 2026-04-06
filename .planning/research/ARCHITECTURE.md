# Architecture Patterns -- v4.0 Model-Driven Scanner

**Domain:** Self-improving Claude Code harness system (harness-evolve)
**Researched:** 2026-04-06
**Focus:** Restructuring scanner from code-based regex analysis to model-driven analysis
**Confidence:** HIGH (based on codebase analysis + GSD workflow pattern study + official Claude Code docs)

## Executive Summary

The current scanner architecture uses 7 TypeScript functions that perform regex/string matching against a `ScanContext` object to detect config quality issues. This approach is fundamentally brittle: BUG-01 proves that hardcoded parsing logic breaks against real-world format variations, and regex-based conflict detection cannot understand semantic contradictions (e.g., "use ESM" vs "use CommonJS").

The redesign moves **analysis and judgment** to the model while keeping **file reading, context assembly, and output parsing** as code. The model receives raw config file contents plus structured guidance documents (checklists, severity definitions, output format specs) and produces structured findings. Code validates and routes the model's output through the existing Recommendation pipeline.

This mirrors the GSD pattern: GSD workflows use `.md` documents to structure model behavior with precise output format specs, severity rules, and edge case handling -- achieving consistent, repeatable results from probabilistic model outputs.

## Current Architecture (What Exists)

```
/evolve:scan slash command
    |
    v
CLI: `npx harness-evolve scan`
    |
    v
runDeepScan(cwd, home)
    |
    +--> buildScanContext(cwd, home)
    |        |
    |        +--> readClaudeMdFiles()     -- reads CLAUDE.md from 3 scopes
    |        +--> readRuleFiles()         -- recursively reads .claude/rules/
    |        +--> readAllSettings()       -- reads settings.json from 3 scopes
    |        +--> readCommandFiles()      -- reads .claude/commands/
    |        +--> extractHooksFromAllSettings()  -- BUG-01: breaks on nested format
    |        |
    |        v
    |    ScanContext (validated by Zod)
    |
    +--> scanners[0..6](context) --> Recommendation[]
    |        |
    |        +--> scanRedundancy()       -- heading comparison across files
    |        +--> scanMechanization()    -- regex for "always run", "before committing"
    |        +--> scanStaleness()        -- checks @references exist on disk
    |        +--> scanConflicts()        -- opposition pairs: always/never, enable/disable
    |        +--> scanStructure()        -- empty/oversized/headingless rules
    |        +--> scanHooksRedundancy()  -- duplicate hook registrations
    |        +--> scanCommands()         -- frontmatter/convention checks
    |
    v
ScanResult { scan_context, recommendations[], scanner_meta[] }
    |
    v
CLI outputs JSON to stdout
    |
    v
/evolve:scan template tells model how to present results
```

### What Each Scanner Actually Does (Analysis of Code)

| Scanner | Detection Method | Limitation |
|---------|-----------------|------------|
| **redundancy** | Compares normalized heading strings across files | Cannot detect semantic overlap (same concept, different headings) |
| **mechanization** | 6 regex patterns (always run, before committing, etc.) | Misses natural language variations; can't reason about intent |
| **staleness** | Checks @references against filesystem | Works well; filesystem checks are deterministic |
| **conflict** | 3 opposition pairs (always/never, enable/disable, require/forbid) | Cannot detect semantic conflicts; only catches keyword opposites |
| **structure** | Line counts, heading counts, subdirectory checks | Works well; structural metrics are deterministic |
| **hooks-redundancy** | Compares event+scope+command strings | BUG-01: cannot parse nested `{matcher, hooks: [...]}` format |
| **commands** | Frontmatter parsing, content length checks | Works well; format checks are deterministic |

### Key Observation: Two Categories of Scanners

**Deterministic scanners** (staleness, structure, commands, hooks-redundancy): Check factual properties -- file exists, line count > 200, frontmatter present. These work reliably and benefit from code execution. The only code bug is BUG-01 in hooks parsing.

**Judgment scanners** (redundancy, mechanization, conflict): Attempt semantic analysis via regex/string matching. These are inherently limited because regex cannot understand meaning. A model would excel here.

## Target Architecture (What To Build)

```
/evolve:scan slash command (REWRITTEN -- embeds guidance docs)
    |
    v
Model reads guidance, runs CLI for context, performs analysis, outputs structured findings
    |
    +--> Step 1: `npx harness-evolve scan-context`  (NEW CLI command)
    |        |
    |        +--> buildScanContext(cwd, home)  (MODIFIED -- fix BUG-01)
    |        |
    |        v
    |    JSON context output to stdout (raw file contents + metadata)
    |
    +--> Step 2: Model analyzes context using embedded guidance docs
    |        |
    |        +--> Redundancy analysis      (model judgment)
    |        +--> Mechanization analysis    (model judgment)
    |        +--> Conflict detection        (model judgment)
    |        +--> Structure audit           (model judgment, replaces deterministic checks)
    |        +--> Hooks analysis            (model judgment, BUG-01 irrelevant)
    |        +--> Commands audit            (model judgment)
    |        +--> Cross-file coherence      (NEW -- impossible with regex)
    |
    +--> Step 3: Model outputs structured JSON findings
    |
    v
/evolve:scan template validates output format, presents to user
    |
    v
Optional: `npx harness-evolve store-findings '...'` (NEW -- persists for /evolve:apply)
```

### Why This Works

1. **Context building stays as code** because file I/O is deterministic and fast (<100ms). The model should not waste tokens on `readFile` calls.

2. **Analysis moves to the model** because judgment about config quality requires understanding natural language semantics, not pattern matching.

3. **Output formatting stays in the template** because the slash command document controls how the model presents results (GSD-proven pattern).

4. **Persistence stays as code** because writing JSON to disk is a side-effect that should be deterministic.

## Component-by-Component Change Plan

### 1. `context-builder.ts` -- MODIFY (fix BUG-01 + simplify output)

**What changes:**
- Fix `extractHooksFromAllSettings()` to handle the nested `{matcher, hooks: [{type, command}]}` format that Claude Code actually uses (BUG-01)
- Simplify the ScanContext output: include raw file contents rather than extracted headings/references, because the model can extract these itself
- Keep the file-reading logic -- this is the code's core value

**BUG-01 Fix (nested hooks parsing):**

Current broken code in `extractHooksFromAllSettings` at line 280:
```typescript
// CURRENT (broken): assumes flat {type, command} array elements
for (const def of defs) {
  const hookDef = def as Record<string, unknown>;
  const type = String(hookDef.type ?? 'command');
  const command = typeof hookDef.command === 'string' ? hookDef.command : undefined;
  hooks.push({ event, scope, type, command });
}
```

Real Claude Code hooks format:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "script.sh" }
        ]
      }
    ]
  }
}
```

**Fix approach:** Check if each array element has a `hooks` sub-array (nested format) or is a direct hook def (legacy flat format). Support both:

```typescript
for (const def of defs) {
  if (!def || typeof def !== 'object') continue;
  const entry = def as Record<string, unknown>;

  if (Array.isArray(entry.hooks)) {
    // Nested format: { matcher?: string, hooks: [{type, command}] }
    const matcher = typeof entry.matcher === 'string' ? entry.matcher : '*';
    for (const innerHook of entry.hooks as Array<Record<string, unknown>>) {
      if (!innerHook || typeof innerHook !== 'object') continue;
      hooks.push({
        event,
        scope,
        type: String(innerHook.type ?? 'command'),
        command: typeof innerHook.command === 'string' ? innerHook.command : undefined,
        matcher,
      });
    }
  } else {
    // Flat format (legacy): { type, command }
    hooks.push({
      event,
      scope,
      type: String(entry.type ?? 'command'),
      command: typeof entry.command === 'string' ? entry.command : undefined,
      matcher: '*',
    });
  }
}
```

**Why fix in code instead of letting model handle:** The context-builder must still produce valid `hooks_registered` data for the CLI `status` command and for `apply-one` to know what hooks exist. This is not just a scanner concern -- it is infrastructure.

### 2. Scanner Functions (`src/scan/scanners/*`) -- REMOVE (7 files)

**All 7 scanner files become unnecessary.** The model performs the analysis that these functions attempted with regex. The scanner registry (`scanners/index.ts`) and all individual scanner files are deleted.

**Files to remove:**
- `src/scan/scanners/redundancy.ts`
- `src/scan/scanners/mechanization.ts`
- `src/scan/scanners/staleness.ts`
- `src/scan/scanners/conflict.ts`
- `src/scan/scanners/structure.ts`
- `src/scan/scanners/hooks-redundancy.ts`
- `src/scan/scanners/commands.ts`
- `src/scan/scanners/index.ts`

**Their test files also go.** But we add new integration tests that validate the model-driven output format.

### 3. Scan Orchestrator (`src/scan/index.ts`) -- SIMPLIFY

**Before:** Orchestrates 7 scanners sequentially, merges results.
**After:** Exports only `buildScanContext` for the CLI and removes scanner orchestration.

The new `runDeepScan()` is replaced by a simpler `getScanContext()` that just calls `buildScanContext` and returns JSON. The model does the analysis step that code previously did.

Alternatively, `runDeepScan()` could remain but delegate to the model -- however, this would require an API call from within the CLI, which contradicts the design principle of hooks/CLI being fast, offline code. The model invocation happens in the slash command context, not in the CLI process.

### 4. New CLI Command: `scan-context` -- NEW

**Purpose:** Output the raw ScanContext as JSON to stdout, without running any analysis. The model calls this to get the data it will analyze.

```typescript
// src/cli/scan-context.ts
export function registerScanContext(program: Command): void {
  program
    .command('scan-context')
    .description('Output raw config context for model-driven analysis')
    .action(async () => {
      const context = await buildScanContext(process.cwd());
      console.log(JSON.stringify(context, null, 2));
    });
}
```

The existing `scan` CLI command is preserved but deprecated -- it runs the old code-based scanners. Users who call `scan` directly get a deprecation notice pointing to `/evolve:scan`.

### 5. New CLI Command: `store-findings` -- NEW

**Purpose:** Accept structured findings JSON from the model and persist them as Recommendation[] for `/evolve:apply`.

```typescript
// src/cli/store-findings.ts
export function registerStoreFindings(program: Command): void {
  program
    .command('store-findings')
    .description('Store model-generated scan findings for /evolve:apply')
    .argument('<json>', 'JSON string of findings array')
    .action(async (jsonStr: string) => {
      const findings = JSON.parse(jsonStr);
      // Validate against Recommendation schema
      // Write to recommendations state
      // Output confirmation
    });
}
```

### 6. `/evolve:scan` Template (`src/commands/evolve-scan.ts`) -- REWRITE

This is the most significant change. The template transforms from a thin "run CLI, present results" wrapper into a comprehensive model guidance document. The template becomes the scanner itself.

**Current template flow:**
1. Run `npx harness-evolve scan`
2. Parse JSON output
3. Present results in formatted sections

**New template flow:**
1. Run `npx harness-evolve scan-context` to get raw config data
2. Analyze config using embedded guidance checklist (model does the analysis)
3. Output findings in specified structured format
4. Run `npx harness-evolve store-findings '...'` to persist findings

### 7. Scanner Guidance Docs -- NEW (embedded in template)

These are the structured guidance documents that replace the 7 scanner functions. They define:
- **What to check** (checklist per analysis area)
- **Severity classification** (problem vs suggestion, with rules)
- **Confidence assignment** (HIGH/MEDIUM/LOW, with criteria)
- **Output format** (exact JSON structure per finding)
- **Edge cases** (what NOT to flag)

See "Guidance Document Architecture" section below.

### 8. `/evolve:apply` Template -- MINOR MODIFY

The apply template works with Recommendation objects. Since the model-driven scanner outputs the same Recommendation schema (via `store-findings`), the apply template needs no structural changes. Only the `allowed-tools` frontmatter may need updating to include the new CLI commands.

## Guidance Document Architecture

### How GSD Structures Model Behavior (Research Findings)

After analyzing GSD workflows, the following patterns emerge for getting consistent model outputs:

**Pattern 1: Role + Context + Process separation**
GSD uses `<purpose>`, `<available_agent_types>`, and `<process>` blocks. The model knows WHY it exists, WHAT tools it has, and HOW to use them. Apply this to scanner guidance.

**Pattern 2: Step-by-step with named steps**
GSD uses `<step name="..." priority="...">`. Each step has clear inputs, expected actions, and outputs. The model follows a sequential process. Apply this to scan analysis areas.

**Pattern 3: Exact output format specifications**
GSD workflows (especially `verify-work.md`) specify exact output formats with templates and field-by-field descriptions. The model produces parseable, consistent output. Critical for scan results.

**Pattern 4: Edge case enumeration**
GSD templates include explicit "Edge Cases" sections that tell the model what situations to handle specially. Prevents false positives. Apply to scanner edge cases.

**Pattern 5: Error handling with fallback**
GSD specifies what to do when things go wrong (CLI fails, output unparseable, etc.). Apply to scan failure modes.

### Guidance Document Structure

The scanner guidance is embedded directly in the `/evolve:scan` template (not as a separate file). This follows the GSD pattern where the slash command `.md` IS the complete behavioral spec.

```markdown
## Analysis Areas

### Area 1: Redundancy Detection
**What to check:**
- Same instruction appearing in CLAUDE.md AND a rule file
- Multiple rule files covering the same topic (even with different headings)
- Settings that duplicate what rules already enforce

**How to detect:**
- Read each CLAUDE.md section and each rule file
- Look for semantic overlap, not just heading matches
- Two files about "git branching" are redundant even if headings differ

**Severity rules:**
- PROBLEM if exact text is duplicated (copy-paste redundancy)
- SUGGESTION if topics overlap but content differs

**Confidence rules:**
- HIGH if clear verbatim duplication
- MEDIUM if topical overlap with different wording
- LOW if ambiguous (could be intentional complementary content)

**Edge cases -- do NOT flag:**
- A CLAUDE.md that references a rule (e.g., "> See rules/git.md") is not redundancy
- A rule that explicitly extends CLAUDE.md content is not redundancy
- Index/summary files that list rules by name are not redundant with the rules

### Area 2: Mechanization Opportunities
**What to check:**
- Rules or CLAUDE.md instructions that describe operations requiring 100% reliability
- Patterns like "always run X before Y", "never allow Z", "must check W"
- Formatting/linting enforcement described in text

**How to detect:**
- Read the intent behind each instruction
- If an instruction would be better served by a hook (deterministic, automatic), flag it
- Consider whether the operation can be expressed as a shell command

**Severity rules:**
- SUGGESTION always (these are optimization opportunities, not problems)

**Edge cases -- do NOT flag:**
- Instructions about coding style or architecture (model judgment, not hookable)
- Instructions that reference context-dependent decisions
- Meta-instructions about how Claude should communicate

### Area 3: Conflict Detection
[... semantic conflict rules ...]

### Area 4: Staleness Detection
[... broken reference rules ...]

### Area 5: Structure Quality
[... file structure rules ...]

### Area 6: Hooks Configuration
[... hooks analysis rules ...]

### Area 7: Commands Convention
[... commands quality rules ...]

### Area 8: Cross-File Coherence (NEW)
**What to check:**
- Do CLAUDE.md, rules, settings, and hooks tell a coherent story?
- Are there instructions that assume capabilities not configured?
- Are there hooks that enforce things not documented in rules?

**This area is impossible with regex scanners.** It requires reading all config as a whole
and reasoning about whether the parts form a coherent system.
```

### Output Format Specification (Embedded in Template)

```markdown
## Output Format

For each finding, produce a JSON object with these exact fields:

{
  "id": "scan-{area}-{index}",          // e.g., "scan-redundancy-0"
  "target": "RULE|HOOK|SETTINGS|CLAUDE_MD",  // which config to fix
  "confidence": "HIGH|MEDIUM|LOW",
  "pattern_type": "scan_{area_name}",   // e.g., "scan_redundancy"
  "severity": "problem|suggestion",
  "title": "Short title (under 80 chars)",
  "description": "Full description of the issue.",
  "evidence": {
    "count": 1,
    "examples": ["file path or text excerpt (max 3)"]
  },
  "suggested_action": "Concrete action to fix. Include expected effect."
}

Collect all findings into a JSON array. If zero issues found, output an empty array [].
```

## Data Flow: Before vs After

### Before (Code-Driven)

```
User: /evolve:scan
  -> Model runs `npx harness-evolve scan`
  -> CLI calls buildScanContext()       [code reads files]
  -> CLI runs 7 scanner functions       [code does regex analysis]
  -> CLI outputs ScanResult JSON        [structured output]
  -> Model formats JSON for display     [presentation only]
```

**Model role:** Passive presenter. Formats code output.

### After (Model-Driven)

```
User: /evolve:scan
  -> Model runs `npx harness-evolve scan-context`
  -> CLI calls buildScanContext()       [code reads files, same as before]
  -> CLI outputs ScanContext JSON       [raw data only, no analysis]
  -> Model reads embedded guidance docs [behavioral spec]
  -> Model analyzes context per guidance [model does semantic analysis]
  -> Model outputs structured findings  [model produces Recommendation JSON]
  -> Model runs `npx harness-evolve store-findings '...'`  [code persists]
  -> Model presents findings to user    [presentation]
```

**Model role:** Active analyst. Reads config, applies judgment, produces findings.

## Schema Changes

### ScanContext Schema -- MODIFY

Add `matcher` field to hooks_registered:

```typescript
hooks_registered: z.array(
  z.object({
    event: z.string(),
    scope: z.enum(['user', 'project', 'local']),
    type: z.string(),
    command: z.string().optional(),
    matcher: z.string().optional(),    // NEW: from nested format
  }),
),
```

Consider adding raw settings content for model inspection:

```typescript
settings_raw: z.object({
  user: z.string().nullable(),     // raw JSON string, not parsed
  project: z.string().nullable(),
  local: z.string().nullable(),
}),
```

This lets the model see the exact settings structure (including nested hooks) without relying on the code's parsing.

### PatternType Enum -- EXTEND

Add new pattern types for model-driven scan areas:

```typescript
// Add to existing enum:
'scan_cross_file_coherence',   // NEW area only model can do
```

### Recommendation Schema -- NO CHANGE

The existing Recommendation schema is the output contract. The model produces data matching this schema. No changes needed -- this is a key architectural win.

## New vs Modified vs Removed Components

### New Components

| Component | Path | Purpose |
|-----------|------|---------|
| scan-context CLI | `src/cli/scan-context.ts` | Output raw ScanContext as JSON |
| store-findings CLI | `src/cli/store-findings.ts` | Persist model findings as Recommendation[] |

### Modified Components

| Component | Change | Risk |
|-----------|--------|------|
| `src/scan/context-builder.ts` | Fix BUG-01 nested hooks parsing; add `matcher` field; optionally add `settings_raw` | LOW -- additive change + bug fix |
| `src/scan/schemas.ts` | Add `matcher` to hooks_registered; optionally add `settings_raw` | LOW -- backward compatible |
| `src/scan/index.ts` | Simplify to only export context building; remove scanner orchestration | MEDIUM -- breaking change for `runDeepScan()` callers |
| `src/commands/evolve-scan.ts` | Complete rewrite with embedded guidance docs | HIGH -- most impactful change |
| `src/cli.ts` | Register new `scan-context` and `store-findings` commands | LOW -- additive |
| `src/schemas/recommendation.ts` | Add `scan_cross_file_coherence` to PatternType enum | LOW -- additive |
| Existing `scan` CLI command | Add deprecation notice, keep functional | LOW |

### Removed Components

| Component | Why Remove |
|-----------|------------|
| `src/scan/scanners/redundancy.ts` | Replaced by model analysis |
| `src/scan/scanners/mechanization.ts` | Replaced by model analysis |
| `src/scan/scanners/staleness.ts` | Replaced by model analysis |
| `src/scan/scanners/conflict.ts` | Replaced by model analysis |
| `src/scan/scanners/structure.ts` | Replaced by model analysis |
| `src/scan/scanners/hooks-redundancy.ts` | Replaced by model analysis |
| `src/scan/scanners/commands.ts` | Replaced by model analysis |
| `src/scan/scanners/index.ts` | Registry no longer needed |
| All scanner test files | Replaced by integration tests against model output format |

### Unchanged Components

| Component | Why Unchanged |
|-----------|---------------|
| `src/commands/evolve-apply.ts` | Consumes Recommendation[] -- same schema |
| `src/delivery/*` | Applier pipeline unchanged -- receives same Recommendation type |
| `src/hooks/*` | Hook handlers unrelated to scan |
| `src/analysis/*` | Background analysis pipeline separate from deep scan |
| `src/storage/*` | Storage layer unchanged |
| `src/cli/init.ts` | Hook registration unchanged (but benefits from BUG-01 fix via shared context-builder) |

## Integration Points

### Integration Point 1: scan-context CLI <-> /evolve:scan template

The template calls `npx harness-evolve scan-context` and receives JSON. The JSON must contain enough raw data for the model to perform analysis. Key requirement: include raw file contents, not just extracted metadata.

### Integration Point 2: Model findings <-> store-findings CLI

The model produces a JSON array of findings. `store-findings` validates each finding against the Recommendation schema (Zod) and persists valid findings. Invalid findings are reported as warnings.

### Integration Point 3: store-findings <-> /evolve:apply

`store-findings` writes to the same recommendation state file that `pending` reads. The apply pipeline treats model-generated findings identically to code-generated findings.

### Integration Point 4: Existing `scan` CLI <-> backward compatibility

The existing `npx harness-evolve scan` command must continue working during transition. It can run the old code-based scanners (with BUG-01 fixed) and produce ScanResult. The deprecation notice guides users to `/evolve:scan`.

## Suggested Build Order

```
Phase A: BUG-01 Fix + Context Enhancement (foundation, no breaking changes)
  1. Fix extractHooksFromAllSettings() for nested format
  2. Add matcher field to hooks_registered schema
  3. Add settings_raw to ScanContext (optional, for model inspection)
  4. Add scan-context CLI command
  5. Update existing tests for new hooks format
  Rationale: Everything else depends on correct context data

Phase B: Scanner Guidance Docs + Template Rewrite (the core change)
  1. Design and write the complete scanner guidance document
  2. Rewrite /evolve:scan template with embedded guidance
  3. Add store-findings CLI command
  4. Add scan_cross_file_coherence to PatternType enum
  5. Test with real user configs
  Rationale: This is the architectural pivot -- must be right

Phase C: Cleanup + Removal (safe only after Phase B proven)
  1. Remove 7 scanner function files
  2. Remove scanner registry
  3. Simplify scan/index.ts
  4. Remove scanner unit tests
  5. Add integration tests for model output format
  6. Add deprecation notice to `scan` CLI
  Rationale: Only remove old code after new approach is validated

Phase D: Polish + Ecosystem Learning (optional, depends on research)
  1. Study similar open-source projects for patterns to adopt
  2. Add cross-file coherence analysis guidance
  3. Tune severity/confidence rules based on real-world testing
  4. Document the guidance doc authoring pattern for extensibility
```

**Phase ordering rationale:**
- A before B: Template needs working `scan-context` CLI to call
- B before C: Never remove old scanners until new approach is proven
- C depends on B validation: If model-driven analysis has gaps, old scanners remain as fallback
- D is independent research that improves Phase B guidance quality

## Performance Considerations

| Aspect | Code Scanners (current) | Model-Driven (target) |
|--------|------------------------|----------------------|
| Latency | <500ms | 5-30s (model inference) |
| Token cost | Zero | ~2K-5K tokens per scan |
| Accuracy (semantic) | LOW (regex) | HIGH (model judgment) |
| Accuracy (structural) | HIGH (deterministic) | HIGH (model can count lines too) |
| Offline capability | YES | NO (requires model context) |
| False positives | HIGH (21 from BUG-01 alone) | LOW (model understands format) |

**Trade-off:** Scan becomes slower but dramatically more accurate. This is acceptable because scan is an infrequent, user-initiated operation (not a hot-path hook).

**Offline fallback:** The old `scan` CLI command (with BUG-01 fixed) remains available for offline/CI use. The model-driven `/evolve:scan` is the primary path.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Model Calling readFile Directly

**What:** Having the model use Bash/Read tools to read each config file individually.
**Why bad:** Wastes model tokens on I/O. Slow. The model doesn't know where all config files are.
**Instead:** Code reads all files into a single JSON context. Model receives one structured input.

### Anti-Pattern 2: Unstructured Model Output

**What:** Letting the model output findings in free-form text and parsing with regex.
**Why bad:** Defeats the purpose. We're replacing regex parsing, not creating more of it.
**Instead:** Specify exact JSON output format in the guidance doc. Model outputs parseable JSON.

### Anti-Pattern 3: Trying to Keep Scanner Functions as Validation

**What:** Running code scanners first, then having the model validate/supplement.
**Why bad:** Two analysis passes are redundant. The code scanners' findings would need to be reconciled with model findings.
**Instead:** One analysis pass by the model. Code handles only I/O and persistence.

### Anti-Pattern 4: Splitting Guidance Across Multiple Files

**What:** Putting scanner guidance in separate .md files that the template references.
**Why bad:** Slash commands are self-contained -- the .md body IS the injected context. External file references add fragility and require the model to read additional files.
**Instead:** Embed all guidance directly in the /evolve:scan template. One file, complete spec.

### Anti-Pattern 5: Model-Driven Analysis Without Format Validation

**What:** Trusting model output without schema validation.
**Why bad:** Models occasionally produce malformed JSON or missing fields.
**Instead:** `store-findings` validates each finding against the Recommendation Zod schema. Invalid findings are warned, not silently accepted.

## Sources

### HIGH Confidence (Official Documentation + Codebase Analysis)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Nested `{matcher, hooks: [...]}` format confirmed as the standard structure
- Codebase analysis of all 7 scanner files (src/scan/scanners/*.ts) -- detailed regex patterns and limitations documented above
- Codebase analysis of context-builder.ts -- BUG-01 root cause identified at line 280
- Codebase analysis of cli/utils.ts mergeHooks() -- confirms harness-evolve already writes nested format correctly (line 183-185)

### HIGH Confidence (GSD Workflow Pattern Analysis)
- GSD execute-phase.md -- `<step name="..." priority="...">` pattern for structured process
- GSD new-project.md -- `<available_agent_types>` pattern for declaring capabilities
- GSD verify-work.md -- Exact output format specifications for consistent model output
- GSD quick.md -- Composable flags pattern for configuration
- GSD executor agent (gsd-executor.md) -- `<role>`, `<execution_flow>`, `<project_context>` separation pattern

### MEDIUM Confidence (Architecture Inference)
- The "code for I/O, model for judgment" split is an emerging pattern in AI-augmented tools. No single authoritative source, but consistent with how GSD, Cog, and similar tools structure their model interactions.
- Performance estimates (5-30s latency) are based on typical Claude model response times for structured analysis tasks of this size (~2K-5K input tokens).
