# Phase 16: UX Polish - Research

**Researched:** 2026-04-04
**Domain:** CLI UX, notification delivery, recommendation ordering
**Confidence:** HIGH

## Summary

Phase 16 is a pure polish phase with three well-scoped requirements. All three touch existing, stable code that needs modification rather than creation of new modules. The codebase already has the necessary infrastructure: the notification system (UX-01), the init command display (UX-02), and the recommendation sorting logic (UX-03). The changes are localized to 4-6 source files with minimal cross-cutting concerns.

**UX-01** requires changing `buildNotification()` to reference `/evolve:apply` instead of the file path, making the notification truly concise and actionable. The current notification text already mentions `/evolve` but also includes the file path -- the fix is to simplify to just the slash command. The UserPromptSubmit hook already correctly reads the notification flag and outputs to stdout.

**UX-02** requires adding a description map for hook events in `src/cli/init.ts` and printing each description next to the event name during the "Planned hook registrations" display. The `HOOK_REGISTRATIONS` array in `src/cli/utils.ts` has all 6 events; descriptions can be added there or in init.ts.

**UX-03** requires sorting the `pending` CLI subcommand output by confidence (HIGH first). The analyzer already sorts by confidence before writing `analysis-result.json`, but `pending` in `src/cli/apply.ts` filters by status without re-sorting. The fix is to sort the filtered pending list by confidence before output. The renderer already groups by confidence tier (HIGH/MEDIUM/LOW) for the markdown file, but the JSON output from `pending` preserves insertion order from the analysis result, which is already sorted -- so the primary concern is ensuring this order survives the filter step, plus adding explicit sorting to the `pending` and `scan` outputs.

**Primary recommendation:** Three targeted modifications -- one to `notification.ts` (change message text), one to `cli/init.ts` + `cli/utils.ts` (add hook descriptions), one to `cli/apply.ts` (sort pending output). No new dependencies, no new modules.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Concise one-line notification after analysis (use `/evolve:apply`, not full text dump) | Current `buildNotification()` in `src/delivery/notification.ts` already builds a one-liner but references the file path. Change to reference `/evolve:apply`. Current UserPromptSubmit hook in `src/hooks/user-prompt-submit.ts` already injects the notification correctly. |
| UX-02 | `harness-evolve init` shows one-line purpose description next to each hook | `HOOK_REGISTRATIONS` in `src/cli/utils.ts` defines all 6 hooks. `runInit()` in `src/cli/init.ts` prints them in the "Planned hook registrations" section. Add a `description` field to each registration and display it. |
| UX-03 | Recommendations sorted by impact (HIGH first, then MEDIUM, then LOW) | `analyze()` in `src/analysis/analyzer.ts` already sorts by confidence. `pending` subcommand in `src/cli/apply.ts` preserves this order when filtering. Explicit sorting should be added to `pending` and `scan` outputs to guarantee ordering regardless of analysis-result state. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Code comments must be pure English (no Chinese)
- Vitest for testing, tsup for build, TypeScript ~6.0
- Commander.js ^14.x for CLI
- Zod ^4.x for validation
- All CLI subcommands output structured JSON for slash command consumption (Phase 15 decision)
- Performance budget: UserPromptSubmit hook must stay under 100ms for injection
- Never block Claude Code -- all errors swallowed in hooks

## Standard Stack

No new libraries needed for this phase. All changes use the existing stack:

### Core (already installed)
| Library | Version | Purpose | Role in Phase 16 |
|---------|---------|---------|-------------------|
| Commander.js | ^14.0.3 | CLI framework | Init command display, pending command sorting |
| Zod | ^4.3.6 | Schema validation | No schema changes needed |
| write-file-atomic | ^7.0.0 | Atomic file writes | No changes needed |
| Vitest | ^4.1.2 | Testing | Test updates for modified behavior |

## Architecture Patterns

### Files to Modify

```
src/
  delivery/
    notification.ts       # UX-01: Change buildNotification() message text
  cli/
    utils.ts              # UX-02: Add description field to HOOK_REGISTRATIONS
    init.ts               # UX-02: Display hook descriptions during init
    apply.ts              # UX-03: Sort pending output by confidence
    scan.ts               # UX-03: Sort scan output by confidence (consistency)
tests/
  unit/
    delivery/
      notification.test.ts  # UX-01: Update expected notification text
    cli/
      init.test.ts          # UX-02: Test hook descriptions in output
      apply.test.ts         # UX-03: Test pending ordering
      scan.test.ts          # UX-03: Test scan ordering
```

### Pattern 1: Notification Text Change (UX-01)

**What:** Modify `buildNotification()` to output `/evolve:apply` reference instead of file path.

**Current behavior** (src/delivery/notification.ts:13-16):
```typescript
export function buildNotification(pendingCount: number, filePath: string): string {
  const plural = pendingCount === 1 ? '' : 's';
  return `[harness-evolve] ${pendingCount} new recommendation${plural} available. See ${filePath} or run /evolve to review.`;
}
```

**Target behavior:**
```typescript
export function buildNotification(pendingCount: number): string {
  const plural = pendingCount === 1 ? '' : 's';
  return `[harness-evolve] ${pendingCount} new suggestion${plural} found. Run /evolve:apply to review.`;
}
```

**Key changes:**
- Remove `filePath` parameter (no longer needed)
- Use "suggestion" instead of "recommendation" (more concise, user-friendly)
- Reference `/evolve:apply` specifically (not generic `/evolve`)
- Update caller in `user-prompt-submit.ts` line 46 to not pass `paths.recommendations`

**Caller update** (src/hooks/user-prompt-submit.ts):
```typescript
// Before:
const msg = buildNotification(pendingCount, paths.recommendations);
// After:
const msg = buildNotification(pendingCount);
```

### Pattern 2: Hook Description Display (UX-02)

**What:** Add purpose descriptions to each hook registration and display them during init.

**Implementation approach:** Add a `description` field to the `HookRegistration` interface in `src/cli/utils.ts`.

```typescript
export interface HookRegistration {
  event: string;
  hookFile: string;
  timeout: number;
  async: boolean;
  description: string;  // NEW: one-line purpose description
}
```

**Hook descriptions (all 6 events):**

| Event | Description |
|-------|-------------|
| UserPromptSubmit | Captures prompts and delivers optimization notifications |
| PreToolUse | Tracks tool usage patterns before execution |
| PostToolUse | Records tool outcomes for pattern analysis |
| PostToolUseFailure | Logs tool failures to detect correction patterns |
| PermissionRequest | Monitors permission decisions for auto-approval suggestions |
| Stop | Triggers analysis when interaction threshold is reached |

**Init display change** (src/cli/init.ts):
```typescript
// Before:
console.log(`  ${hc.event}${asyncLabel}`);
console.log(`    -> ${hc.command}`);

// After:
console.log(`  ${hc.event}${asyncLabel} -- ${hc.description}`);
console.log(`    -> ${hc.command}`);
```

Note: The description comes from the HOOK_REGISTRATIONS array, not from the hookCommands local variable. Either propagate it through or look it up from the registrations.

### Pattern 3: Recommendation Sorting (UX-03)

**What:** Ensure pending and scan outputs are sorted by confidence (HIGH -> MEDIUM -> LOW).

**Current state:** The analyzer (`src/analysis/analyzer.ts`) already sorts by confidence then evidence count before writing to `analysis-result.json`. When `pending` in `src/cli/apply.ts` reads the analysis result and filters, the relative order is preserved by `.filter()`. So the output is already effectively sorted in most cases.

However, explicit sorting should be added for robustness:

```typescript
// Confidence ordering constant (reusable)
const CONFIDENCE_ORDER: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

function sortByConfidence(a: Recommendation, b: Recommendation): number {
  return (CONFIDENCE_ORDER[a.confidence] ?? 3) - (CONFIDENCE_ORDER[b.confidence] ?? 3);
}
```

**Apply to:**
1. `src/cli/apply.ts` -- `registerPendingCommand()`: sort `pending` array before output
2. `src/cli/scan.ts` -- `registerScanCommand()`: sort `result.recommendations` before output

The same constant exists in `src/analysis/analyzer.ts` but is not exported. Either export it or duplicate it in a shared utility. Given it is a 4-line constant, duplication is acceptable to avoid coupling CLI to analyzer internals.

### Anti-Patterns to Avoid

- **Changing the analysis-result.json schema:** UX-03 is purely about output ordering, not about changing how data is stored. The analyzer already sorts correctly.
- **Breaking the notification flag contract:** UX-01 changes only the message text. The flag file mechanism (write/read/clear) must remain unchanged.
- **Adding new CLI output formats:** Phase 15 established that all CLI subcommands output structured JSON. Do not introduce non-JSON output in `pending` or `scan`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Confidence sorting | Custom sort in every output point | Shared `sortByConfidence` function | Already implemented in analyzer.ts; same pattern, reusable |
| Notification text formatting | Template engine | Simple string interpolation | The message is a single line -- no need for template complexity |

## Common Pitfalls

### Pitfall 1: Breaking Existing Notification Tests
**What goes wrong:** Changing `buildNotification()` signature (removing `filePath` parameter) breaks the 4 existing tests in `tests/unit/delivery/notification.test.ts` that pass a file path argument.
**Why it happens:** The tests explicitly call `buildNotification(3, '~/.harness-evolve/recommendations.md')`.
**How to avoid:** Update all test calls to match the new signature. Also update the UserPromptSubmit notification injection tests that check for 'recommendation' in output -- the text now says 'suggestion'.
**Warning signs:** Test assertion failures on string matching.

### Pitfall 2: Init Test Expectations on Console Output
**What goes wrong:** Tests for `runInit()` capture console.log output. Adding hook descriptions changes the output format, potentially breaking assertions that check for specific strings.
**Why it happens:** The init test doesn't explicitly test the hook listing format, but the slash command tests check for "already installed" messages.
**How to avoid:** Review all init tests that capture console.log output. The existing tests mostly check for "Hooks registered successfully!", "Backup created:", and "Aborted." -- these are unaffected by description additions.
**Warning signs:** Integration test failures on output matching.

### Pitfall 3: Pending Sort Order After Filter
**What goes wrong:** Assuming `.filter()` preserves sort order when the source data might not be sorted.
**Why it happens:** The analyzer sorts before writing, but if someone manually edits analysis-result.json or if a future change removes the analyzer sort, the pending output would be unordered.
**How to avoid:** Add explicit `.sort()` after `.filter()` in the pending command -- defensive programming.
**Warning signs:** Pending output showing LOW confidence items before HIGH ones.

### Pitfall 4: Hook Description Not Propagated to hookCommands
**What goes wrong:** The init command builds `hookCommands` from `HOOK_REGISTRATIONS.map(...)` but only extracts `event`, `command`, `timeout`, `async`. The description is lost.
**Why it happens:** The `hookCommands` local variable has a different shape than `HookRegistration`.
**How to avoid:** Either (a) add `description` to the hookCommands mapping, or (b) look up description from the original `HOOK_REGISTRATIONS` array by event name when printing.
**Warning signs:** Description shows as `undefined` in init output.

## Code Examples

### UX-01: Updated buildNotification
```typescript
// Source: src/delivery/notification.ts
export function buildNotification(pendingCount: number): string {
  const plural = pendingCount === 1 ? '' : 's';
  return `[harness-evolve] ${pendingCount} new suggestion${plural} found. Run /evolve:apply to review.`;
}
```

### UX-02: Hook Registration with Description
```typescript
// Source: src/cli/utils.ts
export interface HookRegistration {
  event: string;
  hookFile: string;
  timeout: number;
  async: boolean;
  description: string;
}

export const HOOK_REGISTRATIONS: HookRegistration[] = [
  {
    event: 'UserPromptSubmit',
    hookFile: 'user-prompt-submit.js',
    timeout: 10,
    async: false,
    description: 'Captures prompts and delivers optimization notifications',
  },
  // ... etc
];
```

### UX-03: Confidence-Sorted Pending Output
```typescript
// Source: src/cli/apply.ts (inside registerPendingCommand action)
const CONFIDENCE_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const pending = allRecs
  .filter(rec => {
    const status = statusMap.get(rec.id);
    return status === undefined || status === 'pending';
  })
  .sort((a, b) =>
    (CONFIDENCE_ORDER[a.confidence] ?? 3) - (CONFIDENCE_ORDER[b.confidence] ?? 3)
  );
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01a | buildNotification returns concise message with /evolve:apply | unit | `npx vitest run tests/unit/delivery/notification.test.ts -t "buildNotification" -x` | Exists (needs update) |
| UX-01b | buildNotification takes only pendingCount param (no filePath) | unit | `npx vitest run tests/unit/delivery/notification.test.ts -t "buildNotification" -x` | Exists (needs update) |
| UX-01c | UserPromptSubmit hook outputs updated notification text | unit | `npx vitest run tests/unit/delivery/notification.test.ts -t "UserPromptSubmit" -x` | Exists (needs update) |
| UX-02a | HOOK_REGISTRATIONS entries have description field | unit | `npx vitest run tests/unit/cli/init.test.ts -t "HOOK_REGISTRATIONS" -x` | Exists (needs new assertion) |
| UX-02b | Init output displays description next to each hook event | unit | `npx vitest run tests/unit/cli/init.test.ts -t "init command" -x` | Exists (needs update) |
| UX-03a | Pending command output is sorted HIGH -> MEDIUM -> LOW | unit | `npx vitest run tests/unit/cli/apply.test.ts -t "pending" -x` | Exists (needs new assertion) |
| UX-03b | Scan command output is sorted by confidence | unit | `npx vitest run tests/unit/cli/scan.test.ts -x` | Exists (needs new assertion) |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && npx tsc --noEmit`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None -- existing test infrastructure covers all phase requirements. Tests need updating (assertions change), not creation of new test files.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/delivery/notification.ts`, `src/hooks/user-prompt-submit.ts`, `src/cli/init.ts`, `src/cli/utils.ts`, `src/cli/apply.ts`, `src/cli/scan.ts`, `src/analysis/analyzer.ts`
- Existing tests: `tests/unit/delivery/notification.test.ts`, `tests/unit/cli/init.test.ts`, `tests/unit/cli/apply.test.ts`, `tests/unit/cli/scan.test.ts`
- Phase 15 decisions in STATE.md: "All new CLI subcommands output structured JSON for slash command consumption"

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, all changes in existing code
- Architecture: HIGH - All modification points clearly identified with line numbers
- Pitfalls: HIGH - Identified from direct test analysis; all pitfalls are test-update related

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable -- no external dependency changes)
