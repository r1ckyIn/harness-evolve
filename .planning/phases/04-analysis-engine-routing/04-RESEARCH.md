# Phase 4: Analysis Engine & Routing - Research

**Researched:** 2026-04-01
**Domain:** Pattern classification, routing decision tree, confidence tiers, threshold-triggered analysis, configuration drift detection
**Confidence:** HIGH

## Summary

Phase 4 is the intelligence layer of harness-evolve. It consumes the compressed `summary.json` (top-20 repeated prompts, tool frequencies, permission patterns, long prompts) and `environment-snapshot.json` (installed tools, settings, detected ecosystems) produced by Phase 3, and classifies each detected pattern into the most appropriate configuration target (hook, skill, rule, CLAUDE.md, memory, settings, or ecosystem-specific). The output is a structured recommendations array with evidence and confidence tiers (HIGH/MEDIUM/LOW).

This phase has two architectural concerns: (1) the **analysis engine** -- a pure TypeScript module that applies deterministic classification rules to the pre-processed summary data, and (2) the **trigger mechanism** -- integrating with the existing counter to auto-trigger analysis when the interaction threshold (default 50) is reached. The engine does NOT use an LLM/agent for classification at this stage -- it applies a rule-based decision tree to the summary statistics. The "agent-based" classification described in ANL-02 refers to the fact that the recommendations will eventually be presented by an agent hook (Phase 5 delivery), but the classification logic itself is deterministic code for v1. This is the correct approach because: (a) the patterns are already quantified (counts, sessions, word lengths), (b) the routing rules are well-defined in PROJECT.md's iteration routing table, and (c) deterministic classification is testable, predictable, and free (no API credits).

The configuration drift detection (ANL-09) compares environment snapshot data against known patterns: conflicting rules, redundant CLAUDE.md entries, and settings that overlap with existing hooks or rules. This is heuristic-based -- not NLP or semantic analysis.

**Primary recommendation:** Implement the analysis engine as a pure function `analyze(summary, snapshot) => Recommendation[]` with no side effects. Each classifier function handles one pattern type (repeated short prompts, long prompts, permission approvals, tool patterns, code corrections, personal info, drift). The routing decision tree is a chain of if-then-else rules with clear thresholds. Trigger mechanism is a lightweight check in the UserPromptSubmit hook: if `counter.total >= config.analysis.threshold`, spawn pre-processing + analysis. All new code goes in `src/analysis/`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ANL-02 | Agent-based classifier reads compressed summaries and classifies patterns using routing decision tree | Pure function `analyze()` reads `summary.json` + `environment-snapshot.json`, applies rule-based decision tree. Classification is deterministic code, not LLM. Output is `Recommendation[]` with target, confidence, evidence |
| ANL-03 | Detect repeated prompts (>5 occurrences of similar short prompts -> suggest hook/alias) | `summary.top_repeated_prompts` already has count + sessions. Classifier: count >= threshold (configurable, default 5) AND prompt is short (<50 words) -> route to HOOK with confidence based on count |
| ANL-04 | Detect long repeated prompts (>200 words, repeated 2+ times -> suggest skill creation) | `summary.long_prompts` already has length + count. Classifier: length > 200 words AND count >= 2 -> route to SKILL |
| ANL-05 | Detect repeated permission approvals (same tool approved >10 times across 3+ sessions -> suggest adding to allowedTools) | `summary.permission_patterns` has count + sessions. Classifier: count >= 10 AND sessions >= 3 -> route to SETTINGS (allowedTools) |
| ANL-06 | Detect recurring code preferences/corrections (>3 same correction pattern -> suggest rule) | Requires analyzing tool usage patterns (e.g., repeated Edit after Write to same file type). Use `summary.tool_frequency` combined with heuristic: if PostToolUseFailure count for specific tool is high -> suggest rule. This is LOW confidence detection in v1 |
| ANL-07 | Detect personal/contextual information mentions -> suggest memory entry | Heuristic-based: scan prompt text for patterns like names, locations, preferences appearing across sessions. Uses `summary.top_repeated_prompts` with keyword matching. LOW confidence in v1 -- flag for future NLP enhancement |
| ANL-09 | Configuration drift detection -- compare content across rules, CLAUDE.md, memory, settings for contradictions and redundancies | Compare `environment-snapshot.installed_tools` against recommendation targets. Detect: hooks that duplicate rules, settings that conflict with hooks, CLAUDE.md entries that are already in rules. Heuristic comparison |
| RTG-01 | Extensible routing decision tree that classifies each pattern to the most appropriate config target | Decision tree as array of classifier functions, each returning `Recommendation | null`. New classifiers added by appending to the array. Routing targets are an enum/union type |
| RTG-02 | Route to hooks for patterns requiring 100% reliable execution | Short repeated prompts (count >= threshold) -> HOOK. Permission auto-approvals -> HOOK (PermissionRequest). Build/test commands -> HOOK |
| RTG-03 | Route to skills for repeated multi-step workflows | Long prompts (>200 words, count >= 2) -> SKILL. Multi-step prompt sequences (future) -> SKILL |
| RTG-04 | Route to rules for code preferences and naming conventions | Repeated corrections on same file type -> RULE. Code style patterns -> RULE. Low confidence in v1 |
| RTG-05 | Route to CLAUDE.md for project-level configuration | Project-specific patterns not fitting other targets -> CLAUDE_MD. Environmental preferences -> CLAUDE_MD |
| RTG-06 | Route to memory for short-term contextual/personal information | Personal info patterns (names, locations) -> MEMORY. Session-specific context -> MEMORY |
| RTG-07 | Route to settings.json for permissions and global configuration | Permission approvals (count >= 10, sessions >= 3) -> SETTINGS. Global preferences -> SETTINGS |
| RTG-09 | Adapt routing when installed tools are detected (GSD -> suggest GSD patterns; Cog -> suggest memory tiers; etc.) | `environment-snapshot.detected_ecosystems` array. If "gsd" present -> include GSD-specific recommendations (slash commands, planning patterns). If "cog" present -> route memory to Cog tiers instead of raw memory |
| RTG-10 | Adapt routing when new Claude Code features are detected (version check comparison) | `environment-snapshot.claude_code.version` and `.compatible`. If newer version detected with known new features -> recommend leveraging them. Version-feature mapping table |
| TRG-02 | Trigger automated analysis at configurable threshold (default: 50 interactions) | Check `counter.total >= config.analysis.threshold` in UserPromptSubmit hook. When triggered: run pre-processor, then analyzer, reset counter's `last_analysis` timestamp. Use `config.analysis.threshold` (default 50) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Code comments**: Pure English only, no bilingual, no Chinese
- **Technical discussion**: Chinese preferred for communication
- **GSD workflow**: All edits through GSD commands
- **Testing**: Vitest 4.x, TDD where applicable
- **Build**: tsup 8.x to ESM, target node22
- **Validation**: Zod v4 (import from 'zod/v4')
- **Persistence**: File-based only, no databases, no daemons
- **Atomic writes**: write-file-atomic + proper-lockfile for shared files
- **Performance**: Stop hook analysis must complete in <5s async
- **Commit messages**: GSD format `type(phase-plan): description`
- **No Co-Authored-By** in commits (hook enforced)
- **Shell hooks for collection (free), agent only for analysis (paid)** -- hard architectural boundary from ROADMAP

## Standard Stack

### Core (Already Installed -- No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:fs/promises` | (built-in) | Read summary.json, environment-snapshot.json, write recommendations | Already used throughout codebase |
| Zod v4 | ^4.3.6 | Validate recommendation output schemas, analyzer config | Established pattern from Phase 1-3 |
| write-file-atomic | ^7.0.0 | Write recommendations.json atomically | Established pattern from Phase 1 |

### Supporting (Already Installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| proper-lockfile | ^4.1.2 | Lock counter during threshold check + reset | Already used in counter.ts |
| tsx | ^4.21.0 | Dev-time execution | Development only |

### No New Dependencies Required

Phase 4 requires zero new npm packages. The analysis engine is a pure data transformation layer operating on JSON objects (summary + snapshot -> recommendations). All classification logic is if-then-else rules on numeric thresholds and string comparisons.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rule-based decision tree | LLM agent classification | Costs API credits per analysis run, unpredictable, untestable. Save agent for Phase 5 delivery presentation |
| Hardcoded thresholds | User-configurable thresholds | Add config section in Phase 4 for power users, use sensible defaults for zero-config |
| Single monolithic analyzer | Classifier function array | Extensibility. New classifiers can be added without modifying existing ones |

## Architecture Patterns

### Recommended Project Structure (New Files)

```
src/
  analysis/
    schemas.ts                  # MODIFY: add Recommendation, AnalysisResult schemas
    pre-processor.ts            # EXISTING (Phase 3)
    environment-scanner.ts      # EXISTING (Phase 3)
    jsonl-reader.ts             # EXISTING (Phase 3)
    analyzer.ts                 # NEW: main analyze() function, orchestrates classifiers
    classifiers/                # NEW: individual pattern classifiers
      index.ts                  # Export all classifiers as array
      repeated-prompts.ts       # ANL-03: short repeated prompts -> HOOK
      long-prompts.ts           # ANL-04: long repeated prompts -> SKILL
      permission-patterns.ts    # ANL-05: repeated approvals -> SETTINGS
      code-corrections.ts       # ANL-06: correction patterns -> RULE
      personal-info.ts          # ANL-07: personal info -> MEMORY
      config-drift.ts           # ANL-09: drift detection -> varies
      ecosystem-adapter.ts      # RTG-09, RTG-10: ecosystem-aware routing
    trigger.ts                  # NEW: threshold check + analysis orchestration
  schemas/
    recommendation.ts           # NEW: Recommendation, RoutingTarget schemas
tests/
  unit/
    analysis/
      analyzer.test.ts          # NEW: analyzer unit tests
      classifiers/              # NEW: per-classifier tests
        repeated-prompts.test.ts
        long-prompts.test.ts
        permission-patterns.test.ts
        code-corrections.test.ts
        personal-info.test.ts
        config-drift.test.ts
        ecosystem-adapter.test.ts
      trigger.test.ts           # NEW: threshold trigger tests
  integration/
    analysis-pipeline.test.ts   # NEW: end-to-end analysis integration test
```

### Pattern 1: Classifier Chain (Strategy Pattern)

**What:** Each pattern type is an independent classifier function with the same signature. The analyzer iterates through all classifiers, collecting recommendations.

**When to use:** When classification rules are independent and extensible.

**Example:**

```typescript
// Each classifier has the same interface
export type Classifier = (
  summary: Summary,
  snapshot: EnvironmentSnapshot,
  config: AnalysisConfig,
) => Recommendation[];

// Analyzer iterates all classifiers
export function analyze(
  summary: Summary,
  snapshot: EnvironmentSnapshot,
  config?: AnalysisConfig,
): AnalysisResult {
  const defaultConfig = getDefaultAnalysisConfig();
  const mergedConfig = { ...defaultConfig, ...config };
  const recommendations: Recommendation[] = [];

  for (const classify of classifiers) {
    const results = classify(summary, snapshot, mergedConfig);
    recommendations.push(...results);
  }

  // Sort by confidence (HIGH first), then by evidence strength
  recommendations.sort(sortByConfidenceAndEvidence);

  return {
    generated_at: new Date().toISOString(),
    summary_period: summary.period,
    recommendations,
    metadata: { classifier_count: classifiers.length, ... },
  };
}
```

### Pattern 2: Routing Target Enum

**What:** A union type of all valid routing targets, with each target having a specific format for the recommendation.

```typescript
export const routingTargetSchema = z.enum([
  'HOOK',        // RTG-02: 100% reliable execution
  'SKILL',       // RTG-03: multi-step workflows
  'RULE',        // RTG-04: code preferences
  'CLAUDE_MD',   // RTG-05: project-level config
  'MEMORY',      // RTG-06: contextual/personal info
  'SETTINGS',    // RTG-07: permissions, global config
]);
export type RoutingTarget = z.infer<typeof routingTargetSchema>;

export const confidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type Confidence = z.infer<typeof confidenceSchema>;

export const recommendationSchema = z.object({
  id: z.string(),                    // Unique ID: "rec-{timestamp}-{index}"
  target: routingTargetSchema,
  confidence: confidenceSchema,
  pattern_type: z.string(),          // "repeated_prompt", "long_prompt", "permission_approval", etc.
  title: z.string(),                 // Human-readable title
  description: z.string(),           // Detailed explanation
  evidence: z.object({
    count: z.number(),               // How many times pattern detected
    sessions: z.number().optional(),  // Across how many sessions
    examples: z.array(z.string()).max(3),  // Up to 3 example instances
  }),
  suggested_action: z.string(),      // Concrete suggestion (e.g., "Add hook: ...")
  ecosystem_context: z.string().optional(), // GSD/Cog-specific suggestion
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const analysisResultSchema = z.object({
  generated_at: z.iso.datetime(),
  summary_period: z.object({
    since: z.string(),
    until: z.string(),
    days: z.number(),
  }),
  recommendations: z.array(recommendationSchema),
  metadata: z.object({
    classifier_count: z.number(),
    patterns_evaluated: z.number(),
    environment_ecosystems: z.array(z.string()),
    claude_code_version: z.string(),
  }),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
```

### Pattern 3: Confidence Assignment Rules

**What:** Deterministic rules for assigning confidence levels based on evidence strength.

```
HIGH confidence:
  - Repeated short prompt: count >= 10 AND sessions >= 3
  - Permission approval: count >= 15 AND sessions >= 4
  - Long prompt repetition: count >= 3 AND length >= 300 words

MEDIUM confidence:
  - Repeated short prompt: count >= 5 AND sessions >= 2
  - Permission approval: count >= 10 AND sessions >= 3
  - Long prompt repetition: count >= 2 AND length >= 200 words

LOW confidence:
  - Code correction patterns (heuristic-based)
  - Personal info detection (keyword-based)
  - Configuration drift (comparison-based)
```

### Pattern 4: Ecosystem-Aware Routing

**What:** When ecosystem tools are detected, adapt recommendations to leverage them.

```typescript
function adaptForEcosystem(
  recommendation: Recommendation,
  ecosystems: string[],
): Recommendation {
  if (ecosystems.includes('gsd') && recommendation.target === 'SKILL') {
    recommendation.ecosystem_context =
      'GSD detected: Consider using /gsd slash commands or .planning patterns instead of a standalone skill';
  }
  if (ecosystems.includes('cog') && recommendation.target === 'MEMORY') {
    recommendation.ecosystem_context =
      'Cog detected: Route to Cog memory tiers (/reflect, /evolve) instead of raw CLAUDE.md memory';
  }
  return recommendation;
}
```

### Pattern 5: Threshold Trigger Integration

**What:** The UserPromptSubmit hook checks the counter after incrementing. If threshold reached, spawn async analysis.

```typescript
// In trigger.ts
export async function checkAndTriggerAnalysis(
  counter: Counter,
  config: Config,
): Promise<boolean> {
  if (!config.analysis.enabled) return false;
  if (counter.total < config.analysis.threshold) return false;

  // Check if analysis was already run recently (prevent re-trigger)
  if (counter.last_analysis) {
    const lastAnalysisTime = new Date(counter.last_analysis).getTime();
    const now = Date.now();
    const COOLDOWN_MS = 60_000; // 1 minute cooldown
    if (now - lastAnalysisTime < COOLDOWN_MS) return false;
  }

  // Run analysis (pre-process + analyze + write results)
  const summary = await preProcess();
  const snapshot = await scanEnvironment(process.cwd());
  const result = analyze(summary, snapshot);

  // Write analysis result atomically
  await writeAnalysisResult(result);

  // Update counter with last_analysis timestamp
  await updateLastAnalysis();

  return true;
}
```

### Anti-Patterns to Avoid

- **LLM classification in v1:** The analysis engine must be deterministic rule-based code, not LLM calls. LLM is for Phase 5 delivery presentation only. Rule-based is testable, free, and predictable.
- **Modifying user files directly:** The analyzer outputs recommendations. It NEVER modifies hooks, rules, settings, or CLAUDE.md directly. That is Phase 5/6 (full-auto mode with user opt-in).
- **Blocking the UserPromptSubmit hook:** Threshold check must be non-blocking. If analysis fails, swallow the error and continue. The hook's primary job is data capture, not analysis.
- **Coupling classifiers:** Each classifier must be independent. Classifier A's output should not depend on Classifier B running first.
- **Unbounded recommendations:** Cap recommendations at a reasonable limit (e.g., 20) to prevent the output from growing unboundedly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom JSON validators | Zod v4 schemas | Already established pattern, type-safe, 14x faster in v4 |
| Atomic file writes | Manual rename-on-close | write-file-atomic | Race conditions from concurrent Claude instances |
| Cross-process locking | mkdir-based custom locks | proper-lockfile | Already used in counter.ts, handles stale locks |
| Semver comparison | Custom string parsing | Existing `compareSemver()` in environment-scanner.ts | Already implemented and tested |

## Common Pitfalls

### Pitfall 1: Threshold Re-triggering

**What goes wrong:** Counter reaches 50, analysis triggers. Next interaction increments to 51, analysis triggers again. Every subsequent interaction re-triggers analysis.
**Why it happens:** No cooldown or "already analyzed" state tracking.
**How to avoid:** After analysis completes, update `counter.last_analysis` timestamp. In the trigger check, skip if `last_analysis` is recent (within cooldown period). Also consider resetting the counter to 0 after analysis, or tracking `last_analysis_at_count`.
**Warning signs:** Multiple `analysis-result.json` files being written in rapid succession.

### Pitfall 2: Analysis Blocking the Hook

**What goes wrong:** Pre-processing + analysis takes >5s, blocking the UserPromptSubmit hook. Claude Code shows latency.
**Why it happens:** Analysis is synchronous in the hook's main path.
**How to avoid:** Run analysis asynchronously. The trigger check itself is fast (read counter, compare threshold). Only the actual analysis can be slow. Option 1: Use `async` flag on the hook. Option 2: The trigger writes a "pending analysis" marker file, and a separate Stop hook or SessionEnd hook runs the actual analysis. Option 3: Fork a child process for analysis.
**Warning signs:** Hook latency exceeding 100ms on the UserPromptSubmit path.

### Pitfall 3: Empty Summary Data

**What goes wrong:** Analyzer crashes or produces meaningless recommendations when summary has zero entries.
**Why it happens:** New installation, logs rotated, or date range misalignment.
**How to avoid:** Guard every classifier with early return if relevant data is empty. Test with empty summary and empty snapshot explicitly.
**Warning signs:** Recommendations array contains entries with count=0 or sessions=0.

### Pitfall 4: Stale Environment Snapshot

**What goes wrong:** Environment snapshot was generated days ago, but user has since installed/removed tools. Recommendations reference non-existent tools.
**Why it happens:** Snapshot is cached and not refreshed before analysis.
**How to avoid:** Always regenerate environment snapshot as part of the analysis trigger pipeline. Never read a cached snapshot for analysis purposes.
**Warning signs:** Recommendations mention tools the user has uninstalled.

### Pitfall 5: Infinite Stop Hook Loop

**What goes wrong:** If analysis is triggered via a Stop hook agent, the agent's own Stop event re-triggers analysis.
**Why it happens:** Stop hooks fire whenever Claude finishes responding, including subagent stops.
**How to avoid:** Use `stop_hook_active` field to detect re-entry. Or better: trigger analysis from the UserPromptSubmit hook path (threshold check), not from Stop. The Stop hook was originally planned for analysis, but threshold-based triggering from UserPromptSubmit is simpler and avoids this trap.
**Warning signs:** CPU spike, recursive analysis invocations.

### Pitfall 6: Prompt Normalization Mismatch

**What goes wrong:** The classifier uses different normalization than the pre-processor, causing threshold mismatches.
**Why it happens:** Normalization logic duplicated across modules.
**How to avoid:** The pre-processor already normalizes (trim/lowercase/whitespace-collapse). The classifier receives already-normalized data in `summary.json`. Do NOT re-normalize in classifiers.
**Warning signs:** Classifier thresholds not matching expected counts from summary.

## Code Examples

### Example 1: Repeated Short Prompt Classifier

```typescript
// Source: project-specific design from REQUIREMENTS.md ANL-03, RTG-02
import type { Summary, EnvironmentSnapshot } from './schemas.js';
import type { Recommendation, AnalysisConfig } from '../schemas/recommendation.js';

export function classifyRepeatedPrompts(
  summary: Summary,
  _snapshot: EnvironmentSnapshot,
  config: AnalysisConfig,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const threshold = config.thresholds.repeated_prompt_min_count; // default: 5

  for (const entry of summary.top_repeated_prompts) {
    if (entry.count < threshold) continue;

    // Short prompts (< 50 words) -> HOOK
    const wordCount = entry.prompt.split(/\s+/).length;
    if (wordCount > 50) continue; // Long prompts handled by long-prompts classifier

    const confidence = entry.count >= 10 && entry.sessions >= 3
      ? 'HIGH'
      : entry.count >= 5 && entry.sessions >= 2
        ? 'MEDIUM'
        : 'LOW';

    recommendations.push({
      id: `rec-repeated-${Date.now()}-${recommendations.length}`,
      target: 'HOOK',
      confidence,
      pattern_type: 'repeated_prompt',
      title: `Repeated prompt detected: "${entry.prompt}"`,
      description: `This prompt has been used ${entry.count} times across ${entry.sessions} sessions. Consider creating a hook or alias to automate this.`,
      evidence: {
        count: entry.count,
        sessions: entry.sessions,
        examples: [entry.prompt],
      },
      suggested_action: `Create a UserPromptSubmit hook that detects "${entry.prompt}" and auto-executes the intended action.`,
    });
  }

  return recommendations;
}
```

### Example 2: Permission Approval Classifier

```typescript
// Source: project-specific design from REQUIREMENTS.md ANL-05, RTG-07
export function classifyPermissionPatterns(
  summary: Summary,
  _snapshot: EnvironmentSnapshot,
  config: AnalysisConfig,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const entry of summary.permission_patterns) {
    if (entry.count < config.thresholds.permission_approval_min_count) continue;
    if (entry.sessions < config.thresholds.permission_approval_min_sessions) continue;

    const confidence = entry.count >= 15 && entry.sessions >= 4
      ? 'HIGH'
      : 'MEDIUM';

    recommendations.push({
      id: `rec-perm-${Date.now()}-${recommendations.length}`,
      target: 'SETTINGS',
      confidence,
      pattern_type: 'permission_approval',
      title: `Frequently approved tool: ${entry.tool_name}`,
      description: `You have approved "${entry.tool_name}" ${entry.count} times across ${entry.sessions} sessions. Consider adding it to allowedTools in settings.json.`,
      evidence: {
        count: entry.count,
        sessions: entry.sessions,
        examples: [`${entry.tool_name} approved ${entry.count} times`],
      },
      suggested_action: `Add "${entry.tool_name}" to the "allow" array in ~/.claude/settings.json permissions.`,
    });
  }

  return recommendations;
}
```

### Example 3: Threshold Trigger in UserPromptSubmit Hook

```typescript
// Source: project-specific design from counter.ts + config.ts
// This modifies the existing UserPromptSubmit hook to add threshold checking
export async function handleUserPromptSubmit(rawJson: string): Promise<void> {
  try {
    const config = await loadConfig();
    if (!config.hooks.capturePrompts) return;

    const input = userPromptSubmitInputSchema.parse(JSON.parse(rawJson));

    await appendLogEntry('prompts', { /* ... existing logic ... */ });

    const newTotal = await incrementCounter(input.session_id);

    // TRG-02: Check threshold for auto-analysis
    if (config.analysis.enabled && newTotal >= config.analysis.threshold) {
      // Fire-and-forget: analysis runs async, never blocks the hook
      triggerAnalysis(input.cwd).catch(() => {
        // Swallow errors -- analysis failure must never block user
      });
    }
  } catch {
    // Never block Claude Code on capture errors
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| LLM classification for every pattern | Rule-based classification with LLM delivery | March 2026 (project decision) | Free analysis, predictable output, testable |
| Stop hook agent for analysis | UserPromptSubmit threshold trigger | Phase 4 design (this research) | Avoids infinite loop risk, simpler architecture |
| Single monolithic analyzer | Classifier chain (Strategy pattern) | Phase 4 design | Extensible, testable per-classifier |
| Hardcoded thresholds only | Configurable thresholds with sensible defaults | Phase 4 design | Power users can tune, zero-config for beginners |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run tests/unit/analysis/` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANL-02 | Analyzer reads summary + snapshot, produces Recommendation[] | unit | `npx vitest run tests/unit/analysis/analyzer.test.ts -x` | Wave 0 |
| ANL-03 | Repeated short prompt (count>=5) -> HOOK | unit | `npx vitest run tests/unit/analysis/classifiers/repeated-prompts.test.ts -x` | Wave 0 |
| ANL-04 | Long prompt (>200 words, count>=2) -> SKILL | unit | `npx vitest run tests/unit/analysis/classifiers/long-prompts.test.ts -x` | Wave 0 |
| ANL-05 | Permission approval (count>=10, sessions>=3) -> SETTINGS | unit | `npx vitest run tests/unit/analysis/classifiers/permission-patterns.test.ts -x` | Wave 0 |
| ANL-06 | Code correction pattern -> RULE | unit | `npx vitest run tests/unit/analysis/classifiers/code-corrections.test.ts -x` | Wave 0 |
| ANL-07 | Personal info mention -> MEMORY | unit | `npx vitest run tests/unit/analysis/classifiers/personal-info.test.ts -x` | Wave 0 |
| ANL-09 | Config drift detection | unit | `npx vitest run tests/unit/analysis/classifiers/config-drift.test.ts -x` | Wave 0 |
| RTG-01 | Extensible routing decision tree | unit | `npx vitest run tests/unit/analysis/analyzer.test.ts -x` | Wave 0 |
| RTG-02 | Route to HOOK for 100% reliable patterns | unit | Covered by repeated-prompts.test.ts | Wave 0 |
| RTG-03 | Route to SKILL for multi-step workflows | unit | Covered by long-prompts.test.ts | Wave 0 |
| RTG-04 | Route to RULE for code preferences | unit | Covered by code-corrections.test.ts | Wave 0 |
| RTG-05 | Route to CLAUDE_MD for project config | unit | Covered by analyzer.test.ts (routing logic) | Wave 0 |
| RTG-06 | Route to MEMORY for personal info | unit | Covered by personal-info.test.ts | Wave 0 |
| RTG-07 | Route to SETTINGS for permissions | unit | Covered by permission-patterns.test.ts | Wave 0 |
| RTG-09 | Adapt routing for detected ecosystems | unit | `npx vitest run tests/unit/analysis/classifiers/ecosystem-adapter.test.ts -x` | Wave 0 |
| RTG-10 | Adapt routing for Claude Code version | unit | Covered by ecosystem-adapter.test.ts | Wave 0 |
| TRG-02 | Auto-trigger analysis at threshold | unit | `npx vitest run tests/unit/analysis/trigger.test.ts -x` | Wave 0 |
| SC-01 | Prompt repeated 10x -> HOOK with HIGH confidence | integration | `npx vitest run tests/integration/analysis-pipeline.test.ts -x` | Wave 0 |
| SC-02 | 300-word prompt repeated 3x -> SKILL | integration | Covered by analysis-pipeline.test.ts | Wave 0 |
| SC-03 | "npm test" approved 15x across 4 sessions -> SETTINGS | integration | Covered by analysis-pipeline.test.ts | Wave 0 |
| SC-04 | GSD detected -> GSD-specific routing | integration | Covered by analysis-pipeline.test.ts | Wave 0 |
| SC-05 | Counter threshold triggers analysis | integration | Covered by analysis-pipeline.test.ts | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit/analysis/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/schemas/recommendation.ts` -- Zod schemas for Recommendation, AnalysisResult, RoutingTarget, Confidence, AnalysisConfig
- [ ] `src/analysis/analyzer.ts` -- Main analyze() function
- [ ] `src/analysis/classifiers/index.ts` -- Classifier registry
- [ ] `src/analysis/classifiers/repeated-prompts.ts` -- ANL-03 classifier
- [ ] `src/analysis/classifiers/long-prompts.ts` -- ANL-04 classifier
- [ ] `src/analysis/classifiers/permission-patterns.ts` -- ANL-05 classifier
- [ ] `src/analysis/classifiers/code-corrections.ts` -- ANL-06 classifier
- [ ] `src/analysis/classifiers/personal-info.ts` -- ANL-07 classifier
- [ ] `src/analysis/classifiers/config-drift.ts` -- ANL-09 classifier
- [ ] `src/analysis/classifiers/ecosystem-adapter.ts` -- RTG-09, RTG-10
- [ ] `src/analysis/trigger.ts` -- TRG-02 threshold trigger
- [ ] `tests/unit/analysis/analyzer.test.ts`
- [ ] `tests/unit/analysis/classifiers/*.test.ts` -- per-classifier tests
- [ ] `tests/unit/analysis/trigger.test.ts`
- [ ] `tests/integration/analysis-pipeline.test.ts`

## Open Questions

1. **Counter reset after analysis**
   - What we know: Counter needs to avoid re-triggering analysis immediately
   - What's unclear: Should we reset counter.total to 0, or track `last_analysis_at_count` to trigger at next threshold multiple (50, 100, 150...)?
   - Recommendation: Reset total to 0 after analysis for simplicity. The counter tracks interaction velocity between analysis runs. If the user wants more frequent analysis, they lower the threshold.

2. **ANL-06 (code corrections) detection quality**
   - What we know: The pre-processor summary does not directly track "correction patterns" (e.g., repeated Edit after Write to same file)
   - What's unclear: How much signal can we extract from `tool_frequency` alone without tracking per-file edit sequences?
   - Recommendation: For v1, use a simple heuristic: if PostToolUseFailure count for a tool is high relative to PostToolUse success count, suggest a RULE for that tool pattern. Flag as LOW confidence. Mark for enhancement in v2 with per-file sequence tracking.

3. **ANL-07 (personal info) detection quality**
   - What we know: We only have prompt text previews (truncated to 100 chars) in the summary
   - What's unclear: How to detect "personal info" from truncated prompt text without NLP
   - Recommendation: For v1, skip this classifier or implement with keyword-only matching (e.g., "my name is", "I live in", "I prefer"). Flag as LOW confidence. Mark for v2 NLP enhancement.

4. **Analysis trigger location: UserPromptSubmit vs Stop**
   - What we know: PROJECT.md originally planned Stop hook for analysis (<5s async budget). But Stop hooks have infinite loop risks and fire on every Claude response (including subagent stops)
   - What's unclear: Is UserPromptSubmit the better trigger point?
   - Recommendation: Use UserPromptSubmit for the threshold check (fast: read counter, compare). If threshold reached, write a marker file. Use SessionEnd hook to run actual analysis (no loop risk, runs once when session ends). Alternatively, run analysis inline but fire-and-forget with .catch() in UserPromptSubmit. UserPromptSubmit is the simplest approach and matches the "every Nth interaction" trigger model.

5. **Recommendations file location**
   - What we know: DEL-01 (Phase 5) specifies `~/.harness-evolve/recommendations.md`
   - What's unclear: Should Phase 4 write JSON (for machine consumption by Phase 5) or markdown (for human reading)?
   - Recommendation: Phase 4 writes `~/.harness-evolve/analysis/analysis-result.json` as structured JSON. Phase 5 converts to `recommendations.md` for delivery. This separates analysis output from delivery format.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.14.0 | -- |
| TypeScript | Type checking | Yes | 6.0.2 | -- |
| Vitest | Testing | Yes | 4.1.2 | -- |
| tsup | Build | Yes | 8.5.1 | -- |

No external dependencies beyond what is already installed. Phase 4 is purely code-level work.

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Hook event types, Stop hook behavior, agent hook type, command hook I/O, `stop_hook_active` field, `async` flag
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) -- Practical hook patterns, threshold-based triggering examples, infinite loop prevention
- [Claude Code Settings](https://code.claude.com/docs/en/settings) -- allowedTools configuration, permission rules, settings hierarchy
- Existing codebase (`src/analysis/schemas.ts`, `src/analysis/pre-processor.ts`, `src/analysis/environment-scanner.ts`, `src/storage/counter.ts`, `src/schemas/config.ts`) -- Phase 3 outputs that Phase 4 consumes

### Secondary (MEDIUM confidence)
- [Claude Code Permissions Guide](https://www.eesel.ai/blog/claude-code-permissions) -- allowedTools patterns, permission rule evaluation order
- [Configuration drift detection patterns](https://github.com/hesreallyhim/awesome-claude-code/issues/1170) -- Community patterns for detecting CLAUDE.md drift

### Tertiary (LOW confidence)
- ANL-06 (code corrections) and ANL-07 (personal info) classification approaches -- based on project-specific heuristics, not established patterns. Flagged for v2 enhancement.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all tools verified and already in use
- Architecture (classifier chain): HIGH -- Strategy pattern is well-established, aligns with extensibility requirement
- Routing decision tree: HIGH -- rules are clearly defined in REQUIREMENTS.md with numeric thresholds
- Threshold trigger: HIGH -- counter and config infrastructure already exists from Phase 1
- ANL-06 code corrections: LOW -- heuristic-based, limited signal from current summary data
- ANL-07 personal info: LOW -- keyword-only detection without NLP
- ANL-09 config drift: MEDIUM -- comparison logic is straightforward but edge cases are many

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- no external dependencies, all internal)
