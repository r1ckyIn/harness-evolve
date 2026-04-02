# Phase 6: Onboarding & Quality Polish - Research

**Researched:** 2026-04-01
**Domain:** User experience tiering, outcome tracking, recommendation quality feedback loops
**Confidence:** HIGH

## Summary

Phase 6 closes the final two v1 requirements: ONB-02 (tiered onboarding) and QUA-04 (outcome tracking). Both are relatively contained features that build on the existing infrastructure without introducing new dependencies. The codebase already has all the building blocks: environment-scanner.ts discovers installed tools/rules/skills/hooks/plugins, state.ts tracks recommendation status (pending/applied/dismissed), and the classifier system is extensible via the classifiers array.

**ONB-02 (Tiered Onboarding)** requires computing a "user experience level" from the environment snapshot -- counting installed tools, rules, skills, hooks, plugins, and CLAUDE.md files to determine whether the user is a newcomer or a power user. This level then influences how recommendations are generated: newcomers get "start here" recommendations (create your first hook, add basic rules), while power users get "optimize what you have" recommendations (detect redundancy, suggest mechanization upgrades). The natural implementation is a new classifier that runs after environment scanning and produces tier-appropriate recommendations. The experience level computation should be a pure function on EnvironmentSnapshot, testable without filesystem access.

**QUA-04 (Outcome Tracking)** requires monitoring whether applied recommendations persist or get reverted. The existing state.ts already tracks `applied` status with timestamps. The new behavior is: when a recommendation was marked `applied`, subsequent analysis runs should check whether the recommended change still exists in the environment. If it persists for 5+ sessions (or equivalent time period), record a positive outcome; if the change is reverted, record a negative outcome. This outcome history then feeds back into the analyzer to adjust future recommendation confidence -- patterns with high revert rates get lower confidence, patterns with high persistence get higher confidence. The implementation is a new module (outcome-tracker.ts) that cross-references recommendation state with environment snapshots, plus an outcome history file.

**Primary recommendation:** Implement the experience level detector as a pure function on EnvironmentSnapshot, wire it through the analyzer as a new classifier for tier-appropriate recommendations (ONB-02). Implement outcome tracking as a post-analysis step that cross-references applied recommendations against the current environment snapshot, persisting outcomes in a JSONL file and feeding back via confidence adjustments (QUA-04).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ONB-02 | Tiered onboarding -- detect existing config level (zero-config newbie vs power user) and adapt recommendations | Experience level computed from EnvironmentSnapshot counts (hooks, rules, skills, plugins, CLAUDE.md). New classifier produces tier-appropriate recommendations. Pure function on snapshot, no new I/O. |
| QUA-04 | Outcome tracking -- when user applies a recommendation, track whether it persists or gets reverted (informs future recommendation quality) | New outcome-tracker module cross-references applied recommendations in state.json against current environment snapshot. Outcomes persisted in JSONL file. Confidence adjustment applied in analyzer based on outcome history. |
</phase_requirements>

## Standard Stack

### Core (Already Installed -- No Changes)
| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| Node.js | >=22.14.0 | Runtime | v22.14.0 installed |
| TypeScript | ~6.0 | Type safety | In devDependencies |
| Zod | ^4.3.6 | Schema validation for new outcome schemas, experience level schema | In dependencies |
| write-file-atomic | ^7.0.0 | Atomic writes for outcome history file | In dependencies |
| Vitest | ^4.1.2 | Unit and integration testing | In devDependencies |
| tsup | ^8.5.1 | Bundle TS to JS | In devDependencies |

### New for Phase 6
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | -- | -- | All Phase 6 needs are covered by existing dependencies |

**No new dependencies needed.** Phase 6 uses existing stack: Zod for schemas, write-file-atomic for atomic outcome history writes, native fs for reads.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple count-based experience level | ML-based profiling | Overkill -- counts of installed tools are a reliable, deterministic proxy |
| JSONL outcome history | SQLite | Out of scope per project constraints (plain files only) |
| Session-count-based persistence check | Time-based check | Session counting requires additional session tracking; time-based (using existing timestamps) is simpler and sufficient |

## Architecture Patterns

### Recommended Project Structure (Phase 6 Additions)
```
src/
  analysis/
    experience-level.ts       # Pure function: EnvironmentSnapshot -> ExperienceLevel
    outcome-tracker.ts         # Cross-reference applied recs against environment
    classifiers/
      onboarding.ts            # Tier-aware classifier (ONB-02)
  schemas/
    onboarding.ts              # ExperienceLevel, OnboardingTier, OutcomeEntry schemas
  delivery/
    (no changes to existing files -- outcome tracking is analysis-side)
```

### Pattern 1: Experience Level as Pure Function
**What:** Compute a deterministic experience level from the environment snapshot without any additional I/O.
**When to use:** Every time the analyzer runs (both threshold-triggered and manual /evolve).
**Why pure:** Fully testable with mock snapshots; no filesystem access needed in tests.

```typescript
// src/analysis/experience-level.ts

export type ExperienceTier = 'newcomer' | 'intermediate' | 'power_user';

export interface ExperienceLevel {
  tier: ExperienceTier;
  score: number;          // 0-100 normalized score
  breakdown: {
    hooks: number;
    rules: number;
    skills: number;
    plugins: number;
    claude_md: number;
    ecosystems: number;
  };
}

/**
 * Compute user experience level from environment snapshot.
 * This is a pure function -- no I/O, fully deterministic, easy to test.
 */
export function computeExperienceLevel(
  snapshot: EnvironmentSnapshot,
): ExperienceLevel {
  const hooks = snapshot.installed_tools.hooks.length;
  const rules = snapshot.installed_tools.rules.length;
  const skills = snapshot.installed_tools.skills.length;
  const plugins = snapshot.installed_tools.plugins.length;
  const claudeMd = snapshot.installed_tools.claude_md.filter(c => c.exists).length;
  const ecosystems = snapshot.detected_ecosystems.length;

  // Weighted score: hooks and rules count most (active configuration)
  const score = Math.min(100,
    hooks * 8 +
    rules * 6 +
    skills * 5 +
    plugins * 10 +
    claudeMd * 3 +
    ecosystems * 7
  );

  const tier: ExperienceTier =
    score === 0 ? 'newcomer' :
    score < 30 ? 'intermediate' :
    'power_user';

  return {
    tier,
    score,
    breakdown: { hooks, rules, skills, plugins, claude_md: claudeMd, ecosystems },
  };
}
```

### Pattern 2: Onboarding Classifier
**What:** A new classifier that produces tier-appropriate recommendations based on experience level.
**When to use:** Registered in the classifiers array, runs during every analysis.
**Key design:** Newcomers get "start here" suggestions; power users get "optimize" suggestions.

```typescript
// src/analysis/classifiers/onboarding.ts

export function classifyOnboarding(
  summary: Summary,
  snapshot: EnvironmentSnapshot,
  config: AnalysisConfig,
): Recommendation[] {
  const level = computeExperienceLevel(snapshot);
  const recommendations: Recommendation[] = [];

  if (level.tier === 'newcomer') {
    // Suggest foundational hooks, first rules, CLAUDE.md creation
    // Based on what's MISSING from their setup
    if (level.breakdown.hooks === 0) {
      recommendations.push(makeNewcomerHookRec(/* ... */));
    }
    if (level.breakdown.claude_md === 0) {
      recommendations.push(makeNewcomerClaudeMdRec(/* ... */));
    }
    // ...
  } else if (level.tier === 'power_user') {
    // Suggest redundancy detection, mechanization upgrades
    // This complements (not replaces) config-drift classifier
    // Focus on "upgrade path" recommendations
  }

  return recommendations;
}
```

### Pattern 3: Outcome Tracking as Post-Analysis Step
**What:** After analysis completes, check whether previously applied recommendations still exist in the environment.
**When to use:** Called after `analyze()` in the trigger pipeline.
**Key design:** Does NOT modify the analysis result. Instead, persists outcome data to a separate JSONL file that the analyzer can read on future runs.

```typescript
// src/analysis/outcome-tracker.ts

export interface OutcomeEntry {
  recommendation_id: string;
  applied_at: string;          // ISO timestamp from state
  checked_at: string;          // ISO timestamp of this check
  persisted: boolean;          // true = still in environment, false = reverted
  sessions_since_applied: number;
  outcome: 'positive' | 'negative' | 'monitoring';
}

/**
 * Check whether applied recommendations still exist in the environment.
 * Cross-references state.json (applied entries) against current snapshot.
 */
export async function trackOutcomes(
  snapshot: EnvironmentSnapshot,
): Promise<OutcomeEntry[]> {
  const state = await loadState();
  const applied = state.entries.filter(e => e.status === 'applied');
  // For each applied recommendation, check if the change persists
  // ...
}
```

### Pattern 4: Confidence Adjustment from Outcome History
**What:** Read the outcome history file and adjust recommendation confidence based on historical success/revert rates for similar pattern types.
**When to use:** As a post-processing step in the analyzer, before returning results.
**Key design:** Operates on `pattern_type` level, not individual recommendation IDs (since IDs change between runs).

```typescript
// In analyzer.ts, after classifiers run:
// 1. Load outcome history
// 2. Compute success rate per pattern_type
// 3. Downgrade confidence for pattern_types with >30% revert rate
// 4. Upgrade confidence for pattern_types with >80% persistence rate
```

### Anti-Patterns to Avoid
- **Anti-pattern: Hardcoded experience tiers** -- Do not hardcode specific tool combinations as "newcomer" or "power user." Use a scoring system based on counts that naturally scales.
- **Anti-pattern: Modifying recommendation state during tracking** -- Outcome tracking should be read-only on the state file and write to its own outcome history file. Never mutate recommendation state from the tracker.
- **Anti-pattern: Blocking analysis for outcome tracking** -- Outcome tracking is informational. If it fails, analysis should still complete successfully. Wrap in try/catch, log failures silently.
- **Anti-pattern: Checking persistence by re-scanning the entire filesystem** -- The environment snapshot already contains all needed data. Outcome tracking should compare against the snapshot, not do additional filesystem scans.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes for outcome JSONL | Custom file locking | `write-file-atomic` + `fs.appendFile` | Already established pattern in the project (counter, state file, auto-apply log) |
| Schema validation for outcome entries | Manual type assertions | Zod v4 schemas | Consistent with entire codebase; TypeScript inference comes free |
| Date comparison for persistence window | Custom date math | Native `Date` math with ISO string comparison | Already established pattern (rotator.ts uses this exact approach) |

## Common Pitfalls

### Pitfall 1: Circular Dependency Between Outcome Tracker and State
**What goes wrong:** outcome-tracker.ts imports from state.ts, and if state.ts were to import from outcome-tracker.ts, a circular dependency would form.
**Why it happens:** Temptation to have state updates trigger outcome checks.
**How to avoid:** Outcome tracker reads state (one-way dependency). State module never imports outcome tracker. The trigger pipeline orchestrates the sequence: analyze -> track outcomes -> (optionally) adjust confidence.
**Warning signs:** TypeScript import cycle errors; undefined exports at runtime.

### Pitfall 2: Experience Level Score Boundaries
**What goes wrong:** A user with 1 CLAUDE.md and 1 hook registers as "newcomer" when they should be "intermediate."
**Why it happens:** Weight coefficients are arbitrary without real-world calibration.
**How to avoid:** Define clear, testable tier boundaries with specific test cases. Document the scoring formula. Make weights configurable in the analysis config if needed (but start with sensible defaults).
**Warning signs:** Test cases at tier boundaries failing unexpectedly.

### Pitfall 3: Outcome Persistence Detection for Non-Settings Recommendations
**What goes wrong:** The outcome tracker can easily verify SETTINGS changes (check if tool is in allowedTools), but verifying HOOK, RULE, SKILL, or CLAUDE_MD changes requires heuristic matching.
**Why it happens:** The recommendation says "create a hook for X" but the environment scanner only knows hook events exist, not their specific logic.
**How to avoid:** For v1, limit persistence detection to what the environment snapshot can observe: (1) allowedTools entries in settings (SETTINGS target), (2) hook event presence (HOOK target), (3) rule directory presence (RULE target), (4) skill directory presence (SKILL target), (5) CLAUDE.md file existence (CLAUDE_MD target). Do not attempt to verify the content of what was created -- only presence.
**Warning signs:** False negatives (reporting "reverted" when user created the hook but named it differently).

### Pitfall 4: Outcome JSONL Growth Without Bounds
**What goes wrong:** Outcome entries accumulate indefinitely.
**Why it happens:** No rotation mechanism for outcome history.
**How to avoid:** Apply the same rotation pattern as the recommendation archive (rotator.ts): outcomes older than N days get archived. The outcome history only needs recent data (last 30-90 days) for confidence adjustment.
**Warning signs:** Outcome file growing beyond 1MB.

### Pitfall 5: Newcomer Recommendations Competing with Existing Classifiers
**What goes wrong:** A newcomer gets both "create your first hook" (from onboarding classifier) and "repeated prompt detected, create a hook" (from repeated-prompts classifier), causing duplicate/confusing recommendations.
**Why it happens:** Onboarding classifier doesn't know about other classifiers' output.
**How to avoid:** The onboarding classifier should produce recommendations for what's MISSING from the user's setup (no hooks at all, no rules, no CLAUDE.md), not for specific patterns. The existing classifiers handle pattern-specific recommendations. The onboarding classifier handles "you should know about this capability" meta-recommendations.
**Warning signs:** Two recommendations both suggesting hook creation for different reasons.

## Code Examples

Verified patterns from the existing codebase:

### Experience Level Scoring (Pure Function Pattern)
```typescript
// Follows the exact pattern of existing classifier functions:
// pure function, receives snapshot, returns typed data.
// See: src/analysis/classifiers/repeated-prompts.ts for reference.

import type { EnvironmentSnapshot } from './schemas.js';

export type ExperienceTier = 'newcomer' | 'intermediate' | 'power_user';

export interface ExperienceLevel {
  tier: ExperienceTier;
  score: number;
  breakdown: {
    hooks: number;
    rules: number;
    skills: number;
    plugins: number;
    claude_md: number;
    ecosystems: number;
  };
}

export function computeExperienceLevel(
  snapshot: EnvironmentSnapshot,
): ExperienceLevel {
  const hooks = snapshot.installed_tools.hooks.length;
  const rules = snapshot.installed_tools.rules.length;
  const skills = snapshot.installed_tools.skills.length;
  const plugins = snapshot.installed_tools.plugins.length;
  const claudeMd = snapshot.installed_tools.claude_md.filter(c => c.exists).length;
  const ecosystems = snapshot.detected_ecosystems.length;

  // Weighted scoring -- plugins and hooks carry more weight
  // because they represent active automation investment
  const score = Math.min(100,
    hooks * 8 + rules * 6 + skills * 5 +
    plugins * 10 + claudeMd * 3 + ecosystems * 7,
  );

  const tier: ExperienceTier =
    score === 0 ? 'newcomer' :
    score < 30 ? 'intermediate' :
    'power_user';

  return { tier, score, breakdown: { hooks, rules, skills, plugins, claude_md: claudeMd, ecosystems } };
}
```

### Outcome Entry Schema (Zod v4 Pattern)
```typescript
// Follows the exact schema pattern from src/schemas/delivery.ts
import { z } from 'zod/v4';

export const outcomeEntrySchema = z.object({
  recommendation_id: z.string(),
  pattern_type: z.string(),
  target: z.string(),
  applied_at: z.iso.datetime(),
  checked_at: z.iso.datetime(),
  persisted: z.boolean(),
  outcome: z.enum(['positive', 'negative', 'monitoring']),
});
export type OutcomeEntry = z.infer<typeof outcomeEntrySchema>;

export const outcomeSummarySchema = z.object({
  pattern_type: z.string(),
  total_applied: z.number(),
  total_persisted: z.number(),
  total_reverted: z.number(),
  persistence_rate: z.number(), // 0.0 to 1.0
});
export type OutcomeSummary = z.infer<typeof outcomeSummarySchema>;
```

### Appending Outcome Entries (JSONL Pattern)
```typescript
// Follows the exact pattern from src/delivery/auto-apply.ts (appendFile for JSONL)
import { appendFile } from 'node:fs/promises';
import { paths } from '../storage/dirs.js';

export async function appendOutcome(entry: OutcomeEntry): Promise<void> {
  await appendFile(
    paths.outcomeHistory,
    JSON.stringify(entry) + '\n',
    'utf-8',
  );
}
```

### Classifier Registration Pattern
```typescript
// From src/analysis/classifiers/index.ts -- simply push to array
import { classifyOnboarding } from './onboarding.js';

export const classifiers: Classifier[] = [
  classifyRepeatedPrompts,
  classifyLongPrompts,
  classifyPermissionPatterns,
  classifyCodeCorrections,
  classifyPersonalInfo,
  classifyConfigDrift,
  classifyEcosystemAdaptations,
  classifyOnboarding,  // New: ONB-02
];
```

### Persistence Detection Heuristic
```typescript
// Check if an applied recommendation's effect still exists in the snapshot.
// This uses the same EnvironmentSnapshot structure already produced by scanEnvironment().

function checkPersistence(
  recId: string,
  target: string,
  patternType: string,
  appliedDetails: string | undefined,
  snapshot: EnvironmentSnapshot,
): boolean {
  switch (target) {
    case 'SETTINGS':
      // For permission-always-approved: check allowedTools
      if (patternType === 'permission-always-approved' && appliedDetails) {
        const match = appliedDetails.match(/Added (\w+) to allowedTools/);
        if (match) {
          const settings = snapshot.settings.user as Record<string, unknown> | null;
          const allowed = Array.isArray(settings?.allowedTools)
            ? settings.allowedTools as string[]
            : [];
          return allowed.includes(match[1]);
        }
      }
      return true; // Assume persisted when can't verify

    case 'HOOK':
      // Check if any hook exists (can't verify specific content)
      return snapshot.installed_tools.hooks.length > 0;

    case 'RULE':
      return snapshot.installed_tools.rules.length > 0;

    case 'SKILL':
      return snapshot.installed_tools.skills.length > 0;

    default:
      return true; // Can't verify -- assume persisted
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-tier recommendations for all users | Tiered onboarding (newcomer/intermediate/power_user) | Phase 6 (this phase) | Recommendations now context-aware to user's experience level |
| Fire-and-forget recommendations | Outcome tracking with feedback loop | Phase 6 (this phase) | Future recommendation quality improves based on real-world persistence data |

**No deprecated/outdated patterns to address.** All existing code is current and Phase 6 extends without replacing.

## Open Questions

1. **What constitutes "5+ sessions" for positive outcome?**
   - What we know: The success criterion says "persists for 5+ sessions." The counter.json tracks session data and the state.json tracks timestamps.
   - What's unclear: Whether to count literal session UUIDs or use a time-based proxy (e.g., 5 days = ~5 sessions for a daily user).
   - Recommendation: Use a check count approach: each time outcome tracking runs (during analysis), increment a "checks_since_applied" counter. After 5 checks where the recommendation persists, mark as positive. This is simpler than session counting and naturally adapts to usage frequency.

2. **Confidence adjustment magnitude**
   - What we know: Patterns with high revert rates should get lower confidence.
   - What's unclear: How much to adjust (one tier down? percentage reduction?).
   - Recommendation: Use tier-based adjustment. If a pattern_type has >30% revert rate in the last 30 days, downgrade confidence by one tier (HIGH->MEDIUM, MEDIUM->LOW). If >80% persistence, maintain or upgrade. Keep it simple for v1 -- more sophisticated ML-based adjustments are v2 material.

3. **Newcomer "start here" recommendation content**
   - What we know: Newcomers should get foundational suggestions.
   - What's unclear: What exactly constitutes the "start here" set.
   - Recommendation: Three categories for newcomers: (1) Create CLAUDE.md if none exists, (2) Consider basic hooks if none exist (suggest starting with auto-format or test-on-save), (3) Learn about skills if none exist. Keep recommendations at MEDIUM confidence since they're generic guidance, not pattern-based evidence.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONB-02-a | computeExperienceLevel returns correct tier for zero-config snapshot | unit | `npx vitest run tests/unit/analysis/experience-level.test.ts -t "newcomer" -x` | Wave 0 |
| ONB-02-b | computeExperienceLevel returns correct tier for power-user snapshot | unit | `npx vitest run tests/unit/analysis/experience-level.test.ts -t "power_user" -x` | Wave 0 |
| ONB-02-c | onboarding classifier produces "start here" recs for newcomer | unit | `npx vitest run tests/unit/analysis/classifiers/onboarding.test.ts -t "newcomer" -x` | Wave 0 |
| ONB-02-d | onboarding classifier produces "optimize" recs for power user | unit | `npx vitest run tests/unit/analysis/classifiers/onboarding.test.ts -t "power_user" -x` | Wave 0 |
| ONB-02-e | onboarding classifier produces no recs for intermediate (already getting pattern-specific recs) | unit | `npx vitest run tests/unit/analysis/classifiers/onboarding.test.ts -t "intermediate" -x` | Wave 0 |
| QUA-04-a | trackOutcomes detects persisted recommendation in snapshot | unit | `npx vitest run tests/unit/analysis/outcome-tracker.test.ts -t "persisted" -x` | Wave 0 |
| QUA-04-b | trackOutcomes detects reverted recommendation (missing from snapshot) | unit | `npx vitest run tests/unit/analysis/outcome-tracker.test.ts -t "reverted" -x` | Wave 0 |
| QUA-04-c | outcome history persisted as JSONL and readable | unit | `npx vitest run tests/unit/analysis/outcome-tracker.test.ts -t "persist" -x` | Wave 0 |
| QUA-04-d | confidence adjustment downgrades pattern_type with high revert rate | unit | `npx vitest run tests/unit/analysis/analyzer.test.ts -t "confidence" -x` | Wave 0 |
| QUA-04-e | full pipeline: apply rec -> track outcome -> confidence adjusted on next run | integration | `npx vitest run tests/integration/outcome-pipeline.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/analysis/experience-level.test.ts` -- covers ONB-02-a, ONB-02-b
- [ ] `tests/unit/analysis/classifiers/onboarding.test.ts` -- covers ONB-02-c, ONB-02-d, ONB-02-e
- [ ] `tests/unit/analysis/outcome-tracker.test.ts` -- covers QUA-04-a, QUA-04-b, QUA-04-c
- [ ] `tests/integration/outcome-pipeline.test.ts` -- covers QUA-04-e
- [ ] Existing `tests/unit/analysis/analyzer.test.ts` needs extension for QUA-04-d

## Project Constraints (from CLAUDE.md)

- **Technology stack locked:** Node.js >=22.14.0, TypeScript ~6.0, Zod ^4.3.6, write-file-atomic ^7.0.0, Vitest ^4.1.2, tsup ^8.5.1
- **Persistence:** Plain files only. No database (SQLite, vector DB). JSONL for append-only logs.
- **Code comments:** Pure English only, no Chinese
- **Commit messages:** Conventional commit format with GSD scope: `<type>(<phase>-<plan>): <description>`
- **Testing:** TDD approach -- write tests first, then implement
- **Atomic writes:** Use write-file-atomic for any file that could be read concurrently
- **Performance budget:** Hook handlers must stay within latency targets (<50ms for capture, <5s for analysis)
- **Zod v4 patterns:** Use factory function defaults for nested objects, z.record(z.string(), z.unknown()) for two-arg requirement
- **Module pattern:** Export handler functions for direct test invocation; vi.mock dirs.js with getter pattern for temp directory isolation
- **ignoreDeprecations:** "6.0" must be set in tsconfig.json for TypeScript 6 compatibility with tsup DTS builds

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/analysis/environment-scanner.ts` -- EnvironmentSnapshot structure used for experience level computation
- Existing codebase: `src/delivery/state.ts` -- RecommendationState tracking used for outcome cross-referencing
- Existing codebase: `src/analysis/classifiers/index.ts` -- Classifier registration pattern for onboarding classifier
- Existing codebase: `src/delivery/auto-apply.ts` -- JSONL append pattern for outcome history
- Existing codebase: `src/analysis/analyzer.ts` -- Analysis orchestration where confidence adjustment integrates
- Existing codebase: `src/schemas/delivery.ts` -- Schema patterns for new outcome schemas

### Secondary (MEDIUM confidence)
- Existing codebase: `src/analysis/classifiers/config-drift.ts` -- Complementary classifier (onboarding classifier must not duplicate its work)
- Existing codebase: `src/analysis/classifiers/ecosystem-adapter.ts` -- Ecosystem-aware pattern that onboarding classifier should follow

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing patterns
- Architecture: HIGH -- natural extension of existing classifier and state patterns
- Pitfalls: HIGH -- identified from direct codebase analysis, not speculation

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable, no external dependency changes expected)
