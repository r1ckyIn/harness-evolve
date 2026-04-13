# Phase 7: Integration Wiring - Research

**Researched:** 2026-04-01
**Domain:** Integration wiring -- connecting implemented-but-disconnected modules into production execution paths
**Confidence:** HIGH

## Summary

Phase 7 is a pure wiring phase. All 3 target modules (trigger, auto-apply, outcome-tracker) are fully implemented and tested (38+ unit tests across them). The work is entirely about connecting existing call sites: creating one new Stop hook file, adding two function calls in existing files (`run-evolve.ts` and `trigger.ts`), and updating the build configuration to bundle the new hook.

The v1.0 milestone audit identified 3 requirement gaps (TRG-02, DEL-06, QUA-04) and 3 broken E2E flows (Flow 2, 4, 5). All three gaps share the same root cause: the module exists but no production code path invokes it. The fixes are surgical -- each gap requires 1-5 lines of wiring code plus corresponding integration tests.

**Primary recommendation:** Create `src/hooks/stop.ts` as a command hook that calls `checkAndTriggerAnalysis(cwd)`, wire `autoApplyRecommendations()` into `run-evolve.ts`, wire `trackOutcomes()` + `computeOutcomeSummaries()` into `runAnalysis()` in `trigger.ts`, add tsup entry for the Stop hook, and write E2E integration tests validating all 5 flows.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRG-02 | Trigger automated analysis at configurable threshold (default: 50 interactions) | `checkAndTriggerAnalysis()` in `trigger.ts` fully implemented with threshold check, cooldown, and counter reset. Gap: no hook calls it. Fix: create `src/hooks/stop.ts` Stop hook that invokes it. |
| DEL-06 | Full-auto mode (opt-in) -- auto-apply HIGH confidence recommendations, log what was applied | `autoApplyRecommendations()` in `auto-apply.ts` fully implemented with config gating, backup, JSONL logging. Gap: `run-evolve.ts` never calls it. Fix: add call after `renderRecommendations()`. |
| QUA-04 | Outcome tracking -- when user applies a recommendation, track whether it persists or gets reverted | `trackOutcomes()`, `loadOutcomeHistory()`, `computeOutcomeSummaries()` in `outcome-tracker.ts` fully implemented. `adjustConfidence()` in `analyzer.ts` works. Gap: no production code calls them. Fix: wire into `runAnalysis()` pipeline. |
</phase_requirements>

## Standard Stack

No new libraries needed. This phase uses only existing project dependencies.

### Core (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Node.js | >=22.14.0 | Runtime | Installed |
| TypeScript | ~6.0 | Type safety | Installed |
| Zod | ^4.3.6 | Schema validation | Installed |
| tsup | ^8.5.1 | Bundling | Installed |
| Vitest | ^4.1.2 | Testing | Installed |
| write-file-atomic | ^7.0.0 | Atomic writes | Installed |
| proper-lockfile | ^4.1.2 | Cross-process locking | Installed |

### Alternatives Considered
None. This is a wiring phase with no new dependencies.

## Architecture Patterns

### Current Project Structure (Relevant Files)
```
src/
├── hooks/
│   ├── shared.ts                    # Shared utilities (readStdin, etc.)
│   ├── user-prompt-submit.ts        # UserPromptSubmit hook
│   ├── pre-tool-use.ts              # PreToolUse hook
│   ├── post-tool-use.ts             # PostToolUse hook
│   ├── post-tool-use-failure.ts     # PostToolUseFailure hook
│   ├── permission-request.ts        # PermissionRequest hook
│   └── [NEW] stop.ts               # Stop hook (TRG-02)
├── analysis/
│   ├── trigger.ts                   # checkAndTriggerAnalysis + runAnalysis
│   ├── analyzer.ts                  # analyze() + adjustConfidence()
│   └── outcome-tracker.ts           # trackOutcomes + computeOutcomeSummaries
├── delivery/
│   ├── run-evolve.ts                # /evolve entry point
│   └── auto-apply.ts                # autoApplyRecommendations()
└── index.ts                         # Library exports
```

### Pattern 1: Hook Handler Pattern (Existing Convention)
**What:** Every hook handler follows a consistent structure: export handler function for testability, main() calls readStdin + handler, swallow all errors.
**When to use:** Creating the new Stop hook.
**Example:**
```typescript
// Source: existing pattern from src/hooks/user-prompt-submit.ts
export async function handleStop(rawJson: string): Promise<void> {
  try {
    const input = stopInputSchema.parse(JSON.parse(rawJson));
    // Guard against infinite loop: stop_hook_active means we're
    // already in a stop hook chain -- do not re-trigger analysis
    if (input.stop_hook_active) return;
    await checkAndTriggerAnalysis(input.cwd);
  } catch {
    // Never block Claude Code
  }
}

async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    await handleStop(raw);
  } catch {
    // Never block Claude Code
  }
  process.exit(0);
}

main();
```

### Pattern 2: Wiring Into Existing Pipeline
**What:** Add function calls to existing orchestrator functions without changing their signatures.
**When to use:** Wiring auto-apply into run-evolve, wiring outcome tracking into runAnalysis.
**Example for run-evolve.ts:**
```typescript
// After renderRecommendations + writeNotificationFlag:
// Wire auto-apply (DEL-06)
const autoResults = await autoApplyRecommendations(result.recommendations);
// Include auto-apply results in stdout summary
```

**Example for trigger.ts runAnalysis():**
```typescript
// Before analyze():
// Wire outcome tracking (QUA-04)
const snapshot = await scanEnvironment(cwd);
const outcomeHistory = await loadOutcomeHistory();
const outcomeSummaries = computeOutcomeSummaries(outcomeHistory);
await trackOutcomes(snapshot);

// Pass outcomeSummaries to analyze()
const result = analyze(summary, snapshot, undefined, outcomeSummaries);
```

### Anti-Patterns to Avoid
- **Breaking existing function signatures:** `runAnalysis()` and `analyze()` already accept optional `outcomeSummaries`. Use the existing parameter -- do not create a new function.
- **Swallowing critical errors silently in wiring code:** Auto-apply and outcome tracking failures should be logged but not block the main pipeline. Use try-catch around the new wiring code within run-evolve.ts, but let the main pipeline continue.
- **Triggering analysis from the Stop hook when `stop_hook_active` is true:** This causes infinite loops. The Stop hook MUST check `stop_hook_active` and return early if true.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stop hook infinite loop prevention | Custom recursion guard | `stop_hook_active` field from Claude Code | Claude Code provides this field specifically for this purpose |
| Atomic counter reset | Custom file lock | `resetCounterWithTimestamp()` in trigger.ts | Already implemented with proper-lockfile |
| Settings backup before auto-apply | Custom backup logic | `autoApplyRecommendations()` in auto-apply.ts | Already creates backups before modification |
| Outcome persistence | Custom file writer | `trackOutcomes()` in outcome-tracker.ts | Already appends to JSONL with proper error handling |

**Key insight:** Everything is already built. The only work is calling existing functions from the right places.

## Common Pitfalls

### Pitfall 1: Stop Hook Infinite Loop
**What goes wrong:** Stop hook triggers analysis, which spawns an agent or writes output, which triggers another Stop event, causing infinite recursion.
**Why it happens:** The Stop hook fires every time Claude finishes responding, including after subagent responses.
**How to avoid:** Check `input.stop_hook_active === true` at the top of the handler and return immediately. This field is `true` when the Stop hook itself caused Claude to continue.
**Warning signs:** CPU spike, recursive analysis invocations, multiple analysis-result.json writes within seconds.

### Pitfall 2: Auto-Apply Race Condition with Notification Flag
**What goes wrong:** Auto-apply modifies recommendation state (marks as applied), but the notification count was already computed from the pre-apply state. Result: notification says "3 pending" but 1 was auto-applied.
**Why it happens:** In run-evolve.ts, the notification flag is written before auto-apply runs.
**How to avoid:** Call `autoApplyRecommendations()` BEFORE computing pending count and writing the notification flag. Or recompute pending count after auto-apply. The simplest approach: move auto-apply call before the notification flag write.
**Warning signs:** Notification count inconsistent with actual pending recommendations.

### Pitfall 3: Outcome Tracking Before Snapshot
**What goes wrong:** `trackOutcomes(snapshot)` is called before `scanEnvironment()` returns, or with a stale snapshot.
**Why it happens:** The `runAnalysis()` pipeline already calls `scanEnvironment()`. The outcome tracker needs the same snapshot.
**How to avoid:** In `runAnalysis()`, call `scanEnvironment()` first (already happens), then pass the snapshot to both `trackOutcomes()` and `analyze()`. The snapshot variable is already available in the pipeline scope.
**Warning signs:** Outcome entries show incorrect persistence status.

### Pitfall 4: delivery-pipeline.test.ts Mock Missing outcomeHistory
**What goes wrong:** The existing integration test mock for dirs.ts does not include `outcomeHistory` path. After wiring outcome tracking, any code path that touches `paths.outcomeHistory` will fail in the delivery-pipeline test.
**Why it happens:** The mock was written before outcome tracking existed (Phase 5 predates Phase 6).
**How to avoid:** Update the mock in `delivery-pipeline.test.ts` to include `outcomeHistory` path. This is already flagged as tech debt in the v1.0 audit.
**Warning signs:** delivery-pipeline tests fail with "Cannot read property 'outcomeHistory' of undefined".

### Pitfall 5: Stop Hook Performance Budget
**What goes wrong:** The Stop hook runs `checkAndTriggerAnalysis()` which includes full pre-processing and analysis. This could take several seconds.
**Why it happens:** Analysis involves reading all log files and running classifiers.
**How to avoid:** This is acceptable because: (1) The Stop hook fires AFTER Claude finishes responding, not blocking user interaction; (2) `checkAndTriggerAnalysis()` has a 60-second cooldown preventing rapid re-triggering; (3) The existing hooks reference specifies Stop hook as <5s budget. However, ensure the hook's `process.exit(0)` is called after analysis completes (not fire-and-forget), so Claude Code knows the hook finished.
**Warning signs:** Hook timeout errors from Claude Code.

## Code Examples

### Example 1: Stop Hook Handler (New File)

```typescript
// Source: existing hook pattern from src/hooks/*.ts + Claude Code hooks docs
import { readStdin } from './shared.js';
import { checkAndTriggerAnalysis } from '../analysis/trigger.js';
import { z } from 'zod/v4';
import { hookCommonSchema } from '../schemas/hook-input.js';

// Stop hook input schema
export const stopInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('Stop'),
  stop_hook_active: z.boolean(),
  last_assistant_message: z.string().optional(),
});
export type StopInput = z.infer<typeof stopInputSchema>;

export async function handleStop(rawJson: string): Promise<void> {
  try {
    const input = stopInputSchema.parse(JSON.parse(rawJson));
    // Prevent infinite loop: if this Stop was triggered by a stop hook,
    // do not re-trigger analysis
    if (input.stop_hook_active) return;
    await checkAndTriggerAnalysis(input.cwd);
  } catch {
    // Never block Claude Code
  }
}

async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    await handleStop(raw);
  } catch {
    // Never block Claude Code
  }
  process.exit(0);
}

main();
```

### Example 2: Wiring Auto-Apply into run-evolve.ts

```typescript
// Source: existing run-evolve.ts + auto-apply.ts
// After analysis runs and recommendations are rendered:
import { autoApplyRecommendations } from './auto-apply.js';

// ... existing analysis + render code ...

// Wire auto-apply (DEL-06): call after analysis, before notification
try {
  const autoResults = await autoApplyRecommendations(result.recommendations);
  // Auto-applied recommendations change the pending count
  // Recompute pendingCount from the updated state
} catch {
  // Auto-apply failure should not break the /evolve flow
}
```

### Example 3: Wiring Outcome Tracking into runAnalysis()

```typescript
// Source: existing trigger.ts + outcome-tracker.ts
import { trackOutcomes, loadOutcomeHistory, computeOutcomeSummaries } from './outcome-tracker.js';

export async function runAnalysis(cwd: string): Promise<AnalysisResult> {
  const summary = await preProcess();
  const snapshot = await scanEnvironment(cwd);

  // Wire outcome tracking (QUA-04): track before analysis
  let outcomeSummaries: OutcomeSummary[] | undefined;
  try {
    await trackOutcomes(snapshot);
    const history = await loadOutcomeHistory();
    outcomeSummaries = computeOutcomeSummaries(history);
  } catch {
    // Outcome tracking failure should not block analysis
  }

  const result = analyze(summary, snapshot, undefined, outcomeSummaries);
  await writeAnalysisResult(result);
  return result;
}
```

### Example 4: tsup Entry Point Addition

```typescript
// Source: existing tsup.config.ts
export default defineConfig({
  entry: {
    // ... existing entries ...
    'hooks/stop': 'src/hooks/stop.ts',  // NEW: Stop hook bundle
  },
  // ... rest unchanged ...
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 4 research suggested UserPromptSubmit for threshold trigger | v1.0 audit requires Stop hook approach | v1.0 audit (2026-04-01) | Stop hook is cleaner -- fires after response ends, not blocking prompt submission |
| `analyze()` takes no outcome summaries | `analyze()` already accepts optional `outcomeSummaries` parameter | Phase 6 (2026-04-01) | Parameter exists, just needs to be passed |
| `runAnalysis()` ignores outcome history | `loadOutcomeHistory()` + `computeOutcomeSummaries()` exist | Phase 6 (2026-04-01) | Functions exist, need wiring into `runAnalysis()` |

## Open Questions

1. **Stop hook ordering with other hooks**
   - What we know: Claude Code fires Stop once per response completion. The Stop hook receives `stop_hook_active` to prevent loops.
   - What's unclear: If multiple Stop hooks are registered (e.g., by other plugins), execution order is undefined. Our hook should be idempotent.
   - Recommendation: Guard with cooldown (already in `checkAndTriggerAnalysis()` -- 60s cooldown prevents duplicate analysis). No additional work needed.

2. **Auto-apply notification consistency**
   - What we know: Auto-apply changes recommendation state from pending to applied. The notification flag shows pending count.
   - What's unclear: Should the stdout notification reflect pre-apply or post-apply pending count?
   - Recommendation: Post-apply count is more accurate. Move auto-apply before notification flag write in run-evolve.ts. Recompute pending count after auto-apply.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRG-02 | Stop hook calls checkAndTriggerAnalysis when counter >= threshold | unit | `npx vitest run tests/unit/hooks/stop.test.ts -x` | Wave 0 |
| TRG-02 | Stop hook prevents infinite loop via stop_hook_active guard | unit | `npx vitest run tests/unit/hooks/stop.test.ts -x` | Wave 0 |
| DEL-06 | run-evolve calls autoApplyRecommendations when fullAuto=true | integration | `npx vitest run tests/integration/e2e-flows.test.ts -x` | Wave 0 |
| QUA-04 | runAnalysis passes outcomeSummaries to analyze() | integration | `npx vitest run tests/integration/e2e-flows.test.ts -x` | Wave 0 |
| ALL | All 5 E2E flows pass | integration | `npx vitest run tests/integration/e2e-flows.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/hooks/stop.test.ts` -- covers TRG-02 (Stop hook handler unit tests)
- [ ] `tests/integration/e2e-flows.test.ts` -- covers TRG-02, DEL-06, QUA-04 (all 5 E2E flows)
- [ ] Fix `tests/integration/delivery-pipeline.test.ts` mock to include `outcomeHistory` path (tech debt from v1.0 audit)

## Wiring Inventory

This section documents every connection that must be made, with exact file paths and line-level precision.

### Gap 1: Stop Hook -> checkAndTriggerAnalysis() (TRG-02)

| Item | Detail |
|------|--------|
| **New file** | `src/hooks/stop.ts` |
| **Calls** | `checkAndTriggerAnalysis(cwd)` from `src/analysis/trigger.ts` |
| **Input schema** | Extend `hookCommonSchema` with `stop_hook_active: boolean`, `last_assistant_message: string` |
| **Schema location** | Add `stopInputSchema` to `src/schemas/hook-input.ts` (follows existing convention) |
| **Guard** | `if (input.stop_hook_active) return;` -- prevents infinite loops |
| **tsup entry** | Add `'hooks/stop': 'src/hooks/stop.ts'` to `tsup.config.ts` |
| **Exports** | Add `stopInputSchema` and `StopInput` to `src/index.ts` |
| **Performance** | <5s budget (Stop hook runs after response, non-blocking) |

### Gap 2: run-evolve.ts -> autoApplyRecommendations() (DEL-06)

| Item | Detail |
|------|--------|
| **File to modify** | `src/delivery/run-evolve.ts` |
| **Import to add** | `import { autoApplyRecommendations } from './auto-apply.js'` |
| **Insertion point** | After `renderRecommendations()` call, BEFORE notification flag write |
| **Call** | `const autoResults = await autoApplyRecommendations(result.recommendations)` |
| **Error handling** | Wrap in try-catch; auto-apply failure must not break /evolve |
| **Pending count** | Recompute after auto-apply to reflect correct notification count |
| **Config gate** | Already handled inside `autoApplyRecommendations()` (returns `[]` when fullAuto=false) |

### Gap 3: runAnalysis() -> outcome tracking (QUA-04)

| Item | Detail |
|------|--------|
| **File to modify** | `src/analysis/trigger.ts` |
| **Imports to add** | `trackOutcomes`, `loadOutcomeHistory`, `computeOutcomeSummaries` from `./outcome-tracker.js` |
| **Insertion point** | In `runAnalysis()`, after `scanEnvironment()` and before `analyze()` |
| **Calls** | (1) `await trackOutcomes(snapshot)`, (2) `const history = await loadOutcomeHistory()`, (3) `const summaries = computeOutcomeSummaries(history)` |
| **Pass to analyze** | Change `analyze(summary, snapshot)` to `analyze(summary, snapshot, undefined, summaries)` |
| **Error handling** | Wrap outcome calls in try-catch; outcome failure must not block analysis |
| **Type import** | `import type { OutcomeSummary } from '../schemas/onboarding.js'` |

### Supporting Changes

| File | Change | Reason |
|------|--------|--------|
| `src/schemas/hook-input.ts` | Add `stopInputSchema` and `StopInput` | Schema for Stop hook input validation |
| `src/index.ts` | Export `stopInputSchema`, `StopInput`, and `handleStop` | Library API completeness |
| `tsup.config.ts` | Add stop hook entry point | Build the Stop hook as a standalone bundle |
| `tests/integration/delivery-pipeline.test.ts` | Add `outcomeHistory` to dirs mock | Fix tech debt: mock missing path |

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Stop hook schema (session_id, cwd, stop_hook_active, last_assistant_message, hook_event_name), hook handler types, settings.json format
- Existing codebase -- `src/analysis/trigger.ts`, `src/delivery/auto-apply.ts`, `src/delivery/run-evolve.ts`, `src/analysis/outcome-tracker.ts`, `src/analysis/analyzer.ts` (direct code inspection)
- v1.0 Milestone Audit (`.planning/v1.0-MILESTONE-AUDIT.md`) -- gap identification, flow analysis, fix recommendations
- Phase 4 Research (`.planning/phases/04-analysis-engine-routing/04-RESEARCH.md`) -- Stop hook infinite loop prevention via `stop_hook_active`

### Secondary (MEDIUM confidence)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) -- Practical hook patterns, threshold triggering

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all libraries already verified
- Architecture: HIGH -- all target functions exist with established patterns; wiring is mechanical
- Pitfalls: HIGH -- Stop hook infinite loop is well-documented; race conditions identified from code reading
- Wiring inventory: HIGH -- exact file paths, function signatures, and insertion points identified from source code

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- no external dependency changes expected)
