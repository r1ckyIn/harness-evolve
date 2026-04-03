# Phase 9: Tech Debt & Auto-Apply Expansion - Research

**Researched:** 2026-04-03
**Domain:** Pattern type string consistency, concurrent file locking, strategy-pattern auto-apply expansion
**Confidence:** HIGH

## Summary

Phase 9 addresses three distinct tech debt items from the v1.0 audit. The research reveals that all three are well-scoped, low-risk refactors with clear paths to implementation. The primary complexity is in TDT-03 (auto-apply expansion), where introducing a strategy pattern applier registry requires careful design to avoid corrupting user files (Pitfall 18 from project research).

TDT-01 is a straightforward enum introduction: the `inferPatternType()` function in outcome-tracker.ts returns hardcoded strings that do not match the actual `pattern_type` values produced by the 8 classifiers. This means the outcome tracking feedback loop (confidence adjustment based on persistence rates) silently fails -- it groups outcomes by wrong keys, so adjustments never match real recommendations. The fix is to define a shared `PatternType` enum/const and use it in both classifiers and the outcome tracker.

TDT-02 is a concurrency fix: the `concurrent-counter.test.ts` fails intermittently because `proper-lockfile` v4.1.2's retry configuration (`retries: 10, minTimeout: 50, maxTimeout: 500`) is insufficient under high contention -- 200 sequential lock/unlock cycles across 2 workers exhaust retries and throw `ELOCKED`. The fix is to increase retry parameters (more retries, longer backoff).

TDT-03 requires adding a `RULE` applier to the auto-apply module. Per Pitfall 18 and the requirements, this must be create-only (never modify existing rule files). The strategy pattern applier registry is the correct architecture: define an `Applier` interface, register appliers by target type, and dispatch in `autoApplyRecommendations`.

**Primary recommendation:** Implement all three as separate plan waves -- TDT-01 first (unblocks correct outcome tracking), TDT-02 second (unblocks CI reliability for Phase 10), TDT-03 third (builds on the PatternType enum from TDT-01).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TDT-01 | Fix inferPatternType to return correct pattern_type strings matching all 8 classifiers' actual values, using a shared PatternType enum | Exact mismatch table documented below; shared enum approach confirmed as correct fix; 15 distinct pattern_type values identified across classifiers |
| TDT-02 | Fix flaky concurrent-counter.test.ts to pass deterministically on CI (2-vCPU runners with higher lock contention) | Root cause identified as insufficient proper-lockfile retry params (10 retries, 50-500ms backoff for 200 rapid lock cycles); fix is to increase retries and backoff range |
| TDT-03 | Expand auto-apply beyond permissions-only: add strategy pattern applier registry with RULE create-only target for HIGH-confidence recommendations | Current auto-apply architecture analyzed; strategy pattern interface designed; RULE create-only constraint validated against Pitfall 18 |
</phase_requirements>

## Standard Stack

No new dependencies needed. Phase 9 works entirely within the existing stack.

### Core (existing, unchanged)
| Library | Version | Purpose | Role in Phase 9 |
|---------|---------|---------|-----------------|
| Zod | ^4.3.6 | Schema validation | PatternType enum schema for TDT-01 |
| proper-lockfile | ^4.1.2 | Cross-process file locking | Retry config tuning for TDT-02 |
| write-file-atomic | ^7.0.0 | Atomic file writes | Used by new RULE applier for TDT-03 |
| Vitest | ^4.1.2 | Testing | All requirement verification |

## Architecture Patterns

### TDT-01: Shared PatternType Enum

The current architecture has a critical string mismatch between classifiers and outcome tracking.

**Classifier pattern_type values** (what classifiers actually produce):

| Classifier File | ID Prefix | pattern_type Value(s) |
|-----------------|-----------|----------------------|
| repeated-prompts.ts | `rec-repeated-` | `repeated_prompt` |
| long-prompts.ts | `rec-long-` | `long_prompt` |
| permission-patterns.ts | `rec-permission-always-approved-` | `permission-always-approved` |
| code-corrections.ts | `rec-correction-` | `code_correction` |
| personal-info.ts | `rec-personal-` | `personal_info` |
| config-drift.ts | `rec-drift-` | `config_drift` |
| ecosystem-adapter.ts | `rec-ecosystem-` | `version_update`, `ecosystem_gsd`, `ecosystem_cog` |
| onboarding.ts | `rec-onboarding-` | `onboarding_start_hooks`, `onboarding_start_rules`, `onboarding_start_claudemd`, `onboarding_optimize` |

**inferPatternType() in outcome-tracker.ts** (what outcome tracking produces -- MISMATCHED):

| ID Prefix Matched | Returns | Actual Classifier Value | Status |
|-------------------|---------|------------------------|--------|
| `rec-repeated-` | `repeated-prompt` | `repeated_prompt` | WRONG (dash vs underscore) |
| `rec-long-` | `long-prompt-workflow` | `long_prompt` | WRONG (completely different) |
| `rec-permission-always-approved-` | `permission-always-approved` | `permission-always-approved` | CORRECT |
| `rec-correction-` | `code-correction-pattern` | `code_correction` | WRONG (completely different) |
| `rec-ecosystem-` | `ecosystem-adapter` | `version_update` / `ecosystem_gsd` / `ecosystem_cog` | WRONG (returns generic, classifier uses specific) |
| `rec-tool-preference-` | `tool-preference` | (NO CLASSIFIER PRODUCES THIS) | ORPHAN |
| `rec-onboarding-` | `onboarding` | `onboarding_start_hooks` / etc. | WRONG (returns generic) |
| `rec-personal-*` | NOT HANDLED -> `unknown` | `personal_info` | MISSING |
| `rec-drift-*` | NOT HANDLED -> `unknown` | `config_drift` | MISSING |

**Impact:** The `adjustConfidence()` function in analyzer.ts uses `pattern_type` as the join key between outcome summaries and recommendations. Since outcome tracking writes `repeated-prompt` but the classifier produces `repeated_prompt`, the confidence adjustment lookup `rateByType.get(rec.pattern_type)` always returns `undefined` for mismatched types -- meaning the self-iteration feedback loop is silently broken for 7 of 8 classifiers.

**Fix approach:**

1. Define a `PatternType` const enum (or Zod enum) in `src/schemas/recommendation.ts` listing ALL 15 valid values
2. Type the `pattern_type` field in `recommendationSchema` as this enum instead of `z.string()`
3. Type the `pattern_type` field in `outcomeEntrySchema` and `outcomeSummarySchema` as this enum
4. Remove `inferPatternType()` entirely -- the recommendation already carries its correct `pattern_type`, so the outcome tracker should copy it from the recommendation directly (available through the state entry -> recommendation lookup)
5. Update `inferTarget()` to handle `rec-personal-*` and `rec-drift-*` prefixes

**Alternative approach (simpler, less invasive):** Keep `inferPatternType()` but fix its return values to match classifiers exactly. This avoids changing the recommendation schema type from `z.string()` to an enum. However, the enum approach is better because it provides compile-time safety against future mismatches.

**Recommended:** Use the enum approach. The recommendation schema already uses `z.enum` for `target` and `confidence`, so adding `PatternType` is consistent.

### TDT-02: Concurrent Counter Lock Contention Fix

**Root cause identified:** The test spawns 2 workers, each doing 100 sequential `incrementCounter` calls. Each call acquires a lock, reads, increments, writes atomically, then releases. With 200 total lock acquisitions across 2 competing processes, the current retry config is:

```typescript
retries: { retries: 10, minTimeout: 50, maxTimeout: 500 }
```

On a 2-vCPU CI runner (or the user's machine under load), 10 retries with 50-500ms exponential backoff is insufficient. The `proper-lockfile` library uses `p-retry` internally with exponential backoff. With only 10 retries and max 500ms timeout, the total wait budget is approximately 2-3 seconds. Under sustained contention (100 sequential lock operations per worker), this exhausts easily.

**Error observed:**
```
Error: Lock file is already being held
  code: 'ELOCKED'
```

**Fix approach:**

1. Increase retry parameters in `src/storage/counter.ts`:
   ```typescript
   retries: { retries: 50, minTimeout: 20, maxTimeout: 1000 }
   ```
   This gives ~30 seconds of total retry budget, more than sufficient for 200 operations.

2. Also increase in `src/analysis/trigger.ts` (same lock pattern):
   ```typescript
   retries: { retries: 50, minTimeout: 20, maxTimeout: 1000 }
   ```

3. Consider adding a jitter strategy: `proper-lockfile` supports `factor` and `randomize` options through `p-retry`. Adding `randomize: true` helps avoid lock convoys where both workers retry at the same time.

**Testing approach:** Run the test 10 times consecutively to verify deterministic passing:
```bash
for i in $(seq 1 10); do npx vitest run tests/integration/concurrent-counter.test.ts; done
```

**Performance impact:** Increasing retries does NOT slow down the happy path. Retries only trigger when the lock is held. The `minTimeout: 20` is actually lower than current `50`, so first retries are faster.

### TDT-03: Strategy Pattern Applier Registry

**Current architecture:**

`autoApplyRecommendations()` in `src/delivery/auto-apply.ts`:
- Filters: `confidence === 'HIGH' && target === 'SETTINGS' && status === 'pending'`
- Dispatches to `applySingleRecommendation()` which has a single code path
- Hard-coded guard: `if (rec.pattern_type !== 'permission-always-approved')` returns skip

**Target architecture (strategy pattern):**

```
src/delivery/
  auto-apply.ts          # Orchestrator (existing, refactored)
  appliers/
    index.ts             # Applier interface + registry
    settings-applier.ts  # Extracted from current auto-apply.ts
    rule-applier.ts      # NEW: create-only .claude/rules/*.md
```

**Applier interface:**
```typescript
export interface Applier {
  readonly target: RoutingTarget;
  canApply(rec: Recommendation): boolean;
  apply(rec: Recommendation, options?: ApplierOptions): Promise<AutoApplyResult>;
}
```

**Registry dispatch:**
```typescript
const appliers: Map<RoutingTarget, Applier> = new Map();
// Register: appliers.set('SETTINGS', new SettingsApplier());
//           appliers.set('RULE', new RuleApplier());
```

**RULE applier constraints (from Pitfall 18):**
1. CREATE-ONLY: never modify existing `.claude/rules/*.md` files
2. File naming: derive from recommendation ID, e.g., `evolve-{pattern_type}.md`
3. Content: write the `suggested_action` as markdown rule content
4. Guard: if file already exists, skip (no overwrite)
5. Backup: not needed for create-only (just delete to undo)
6. Log: append to auto-apply-log.jsonl with `target: 'RULE'`

**Changes to filter logic:**
Currently: `rec.confidence === 'HIGH' && rec.target === 'SETTINGS'`
After: `rec.confidence === 'HIGH' && appliers.has(rec.target)`

This means recommendations with `target === 'RULE'` and `confidence === 'HIGH'` will now be auto-applied. Currently, no classifier produces HIGH-confidence RULE recommendations (code_correction and config_drift are both LOW, onboarding_start_rules is MEDIUM). For testing, the RULE applier will be verified with constructed HIGH-confidence RULE recommendations.

### Anti-Patterns to Avoid

- **Modifying existing rule files:** The RULE applier must NEVER read-modify-write existing `.md` files. Create-only or skip.
- **Changing the recommendation schema without updating tests:** 336 tests reference pattern_type strings. The enum change must update all test fixtures.
- **Silently swallowing lock errors:** The counter retry fix should log when retries are exhausted, not just throw `ELOCKED`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File locking | Custom flock/semaphore | `proper-lockfile` (already used) | Cross-platform, handles stale locks |
| Atomic writes | `fs.writeFile` | `write-file-atomic` (already used) | Crash-safe rename pattern |
| Schema validation | Manual type checks | Zod enum (already used) | Compile-time + runtime safety |

## Common Pitfalls

### Pitfall 1: Pattern Type Enum Breaks Existing Outcome History
**What goes wrong:** Changing `outcomeEntrySchema.pattern_type` from `z.string()` to `z.enum([...])` causes `loadOutcomeHistory()` to reject existing JSONL entries that have the old (wrong) string values.
**Why it happens:** Users who ran v1.0 may have outcome-history.jsonl files with values like `repeated-prompt` (the wrong string from inferPatternType).
**How to avoid:** Keep `outcomeEntrySchema.pattern_type` as `z.string()` for backward compatibility. Only change the `recommendationSchema.pattern_type` and `outcomeSummarySchema.pattern_type` to the enum. The outcome history reader already uses `safeParse` and skips invalid lines.
**Warning signs:** `loadOutcomeHistory()` tests fail after adding the enum constraint.

### Pitfall 2: RULE Applier Path Resolution
**What goes wrong:** The RULE applier creates `.claude/rules/*.md` relative to CWD, but CWD during hook execution may not be the project root.
**Why it happens:** Claude Code hooks are invoked from the user's project directory, but the auto-apply module is invoked from the `/evolve` skill which sets `$PWD` explicitly. However, `.claude/rules/` is always relative to the user's HOME for user-scope rules or project root for project-scope rules.
**How to avoid:** Use the same `process.env.HOME` path resolution as `dirs.ts`. For v1.1 scope, create rules in `~/.claude/rules/` (user scope) only. Project-scope rules are deferred to v2.0.
**Warning signs:** Files created in wrong directory during integration tests.

### Pitfall 3: Test Count Regression
**What goes wrong:** Refactoring auto-apply.ts into multiple files breaks existing mocks in `tests/unit/delivery/auto-apply.test.ts`.
**Why it happens:** Tests mock `../../../src/delivery/auto-apply.js` imports. Moving code to `appliers/` changes import paths.
**How to avoid:** Keep the public API surface (`autoApplyRecommendations`) in `auto-apply.ts`. Internal refactoring (applier registry) should be imported by auto-apply.ts, not exported as the primary interface. Existing tests continue to import from the same path.
**Warning signs:** Existing auto-apply tests fail with "module not found" errors.

### Pitfall 4: Concurrent Counter Test Becomes TOO Slow
**What goes wrong:** Increasing retry parameters makes the test pass but also makes it much slower (60s+ timeout).
**Why it happens:** More retries = longer total possible wait time. If the retry configuration is too generous, even the happy path may be slow due to frequent lock contention causing many retries.
**How to avoid:** Keep `minTimeout` low (20ms) and set `randomize: true` to avoid convoy effects. The total test time should stay under 15 seconds for 200 operations. Monitor test duration after the fix.
**Warning signs:** Test passes but takes >30 seconds consistently.

## Code Examples

### PatternType Enum Definition (TDT-01)
```typescript
// src/schemas/recommendation.ts
// Source: analysis of all 8 classifiers in src/analysis/classifiers/

export const patternTypeSchema = z.enum([
  // repeated-prompts.ts
  'repeated_prompt',
  // long-prompts.ts
  'long_prompt',
  // permission-patterns.ts
  'permission-always-approved',
  // code-corrections.ts
  'code_correction',
  // personal-info.ts
  'personal_info',
  // config-drift.ts
  'config_drift',
  // ecosystem-adapter.ts
  'version_update',
  'ecosystem_gsd',
  'ecosystem_cog',
  // onboarding.ts
  'onboarding_start_hooks',
  'onboarding_start_rules',
  'onboarding_start_claudemd',
  'onboarding_optimize',
]);
export type PatternType = z.infer<typeof patternTypeSchema>;
```

### Fixed Lock Config (TDT-02)
```typescript
// src/storage/counter.ts
// Fix: increase retries, lower minTimeout, add randomize

const release = await lock(paths.counter, {
  retries: { retries: 50, minTimeout: 20, maxTimeout: 1000, randomize: true },
  stale: 10000,
});
```

### Applier Interface (TDT-03)
```typescript
// src/delivery/appliers/index.ts

import type { Recommendation } from '../../schemas/recommendation.js';
import type { AutoApplyResult } from '../auto-apply.js';

export interface ApplierOptions {
  settingsPath?: string;
  rulesDir?: string;
}

export interface Applier {
  readonly target: string;
  canApply(rec: Recommendation): boolean;
  apply(rec: Recommendation, options?: ApplierOptions): Promise<AutoApplyResult>;
}
```

### RULE Applier (TDT-03)
```typescript
// src/delivery/appliers/rule-applier.ts

import { writeFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Applier, ApplierOptions } from './index.js';
import type { Recommendation } from '../../schemas/recommendation.js';
import type { AutoApplyResult } from '../auto-apply.js';

export class RuleApplier implements Applier {
  readonly target = 'RULE';

  canApply(rec: Recommendation): boolean {
    return rec.confidence === 'HIGH' && rec.target === 'RULE';
  }

  async apply(
    rec: Recommendation,
    options?: ApplierOptions,
  ): Promise<AutoApplyResult> {
    const rulesDir = options?.rulesDir
      ?? join(process.env.HOME ?? '', '.claude', 'rules');
    const fileName = `evolve-${rec.pattern_type}.md`;
    const filePath = join(rulesDir, fileName);

    // Create-only guard: never overwrite existing files
    try {
      await access(filePath);
      // File exists -- skip
      return {
        recommendation_id: rec.id,
        success: false,
        details: `Rule file already exists: ${fileName}`,
      };
    } catch {
      // File does not exist -- proceed
    }

    await mkdir(rulesDir, { recursive: true });

    const content = [
      `# ${rec.title}`,
      '',
      rec.description,
      '',
      `## Action`,
      '',
      rec.suggested_action,
      '',
      `---`,
      `*Auto-generated by harness-evolve (${rec.id})*`,
    ].join('\n');

    await writeFile(filePath, content, 'utf-8');

    return {
      recommendation_id: rec.id,
      success: true,
      details: `Created rule file: ${fileName}`,
    };
  }
}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TDT-01 | PatternType enum used in classifiers + outcome tracker, no "unknown" returns | unit | `npx vitest run tests/unit/analysis/outcome-tracker.test.ts -x` | Exists (update needed) |
| TDT-01 | Classifier pattern_types match enum values (compile-time) | unit | `npx tsc --noEmit` | N/A (type check) |
| TDT-01 | Analysis pipeline produces correct outcome entries end-to-end | integration | `npx vitest run tests/integration/outcome-pipeline.test.ts -x` | Exists (update needed) |
| TDT-02 | Concurrent counter 2x100 = 200 exact, 10/10 passes | integration | `npx vitest run tests/integration/concurrent-counter.test.ts -x` | Exists (fix needed) |
| TDT-03 | RULE applier creates .claude/rules/*.md file | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -x` | Exists (add tests) |
| TDT-03 | RULE applier refuses to overwrite existing file | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -x` | Wave 0 |
| TDT-03 | Strategy registry dispatches to correct applier | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -x` | Wave 0 |
| TDT-03 | Existing SETTINGS auto-apply tests still pass | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -x` | Exists |
| ALL | All 336+ existing tests continue to pass | full suite | `npx vitest run` | Exists |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. New tests will be added within existing test files (outcome-tracker.test.ts and auto-apply.test.ts).

## Open Questions

1. **Should PatternType enum be strict or extensible?**
   - What we know: There are exactly 15 pattern_type values across 8 classifiers today. Future classifiers may add more.
   - What's unclear: Should the enum be a closed set (breaks if new classifiers don't update it) or allow string fallthrough?
   - Recommendation: Use strict Zod enum. New classifiers must add their pattern_type to the enum -- this is intentional compile-time enforcement that prevents future string mismatches. The whole point of TDT-01 is to prevent exactly this class of bug.

2. **Should RULE applier use user-scope or project-scope rules?**
   - What we know: `.claude/rules/` exists at both `~/.claude/rules/` (user scope) and `<project>/.claude/rules/` (project scope). The environment scanner detects both.
   - What's unclear: Which scope is appropriate for auto-generated rules?
   - Recommendation: User scope (`~/.claude/rules/`). Auto-generated rules are personal workflow optimizations, not project conventions. Using project scope would create git-tracked files in the user's repo, which is undesirable. Can be reconsidered in v2.0.

3. **How many classifier pattern_types could realistically reach HIGH confidence?**
   - What we know: Currently only `permission-always-approved` can be HIGH (from permission-patterns classifier thresholds). Code correction, config drift, and onboarding rules are all LOW or MEDIUM.
   - What's unclear: Will RULE recommendations ever organically reach HIGH confidence?
   - Recommendation: This is fine -- TDT-03 builds the infrastructure. Confidence thresholds can be adjusted later. The immediate test will use constructed HIGH-confidence RULE recommendations.

## Sources

### Primary (HIGH confidence)
- Source code analysis of all 8 classifiers in `src/analysis/classifiers/` -- pattern_type values extracted directly
- Source code analysis of `src/analysis/outcome-tracker.ts` -- inferPatternType() return values compared
- Source code analysis of `src/delivery/auto-apply.ts` -- current filter and dispatch logic
- Source code analysis of `src/storage/counter.ts` -- proper-lockfile configuration
- Live test run output: `npx vitest run` -- 1 failed (concurrent-counter), 335 passed (336 total)
- `.planning/research/PITFALLS.md` -- Pitfall 18 (auto-apply corruption risk) directly informs TDT-03 design

### Secondary (MEDIUM confidence)
- proper-lockfile npm docs -- retry configuration options (`retries`, `minTimeout`, `maxTimeout`, `randomize`, `factor`)
- p-retry behavior -- proper-lockfile uses p-retry internally for exponential backoff

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, existing stack fully sufficient
- Architecture (TDT-01): HIGH - exact mismatch table built from source code analysis
- Architecture (TDT-02): HIGH - root cause confirmed by live test failure reproduction
- Architecture (TDT-03): HIGH - strategy pattern is textbook; Pitfall 18 explicitly guides create-only constraint
- Pitfalls: HIGH - derived from direct code analysis and existing project research

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- internal refactoring, no external dependencies changing)
