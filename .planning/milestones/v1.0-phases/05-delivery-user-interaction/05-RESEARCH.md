# Phase 5: Delivery & User Interaction - Research

**Researched:** 2026-04-01
**Domain:** Recommendation delivery, stdout injection, CLI commands, state tracking, file rotation, auto-apply
**Confidence:** HIGH

## Summary

Phase 5 closes the feedback loop: users receive recommendations produced by the Phase 4 analysis engine, can act on them through multiple channels, and the system tracks recommendation lifecycle states. The phase has three major delivery mechanisms: (1) structured markdown file at `~/.harness-evolve/recommendations.md`, (2) one-line stdout injection via UserPromptSubmit hook, and (3) on-demand `/evolve` skill invocation. Additionally, the phase implements recommendation state tracking (pending/applied/dismissed), file rotation to keep recommendations bounded, and an opt-in full-auto mode for HIGH-confidence auto-application.

The most critical technical risk is Gray Area #1 -- UserPromptSubmit stdout injection reliability. Phase 1 research documented historical bugs in v2.0.69 and v2.1.4. Current official documentation (2026) states plaintext stdout IS added as context for UserPromptSubmit hooks with exit code 0. The `additionalContext` JSON field is an alternative path that adds context "more discretely." However, there remain reports of edge-case issues (false positive prompt injection detection in v2.1.5, issue #17804). The system MUST gracefully degrade: if stdout injection is unreliable or disabled in config, `/evolve` becomes the primary delivery path. The architecture should treat stdout injection as an enhancement, not a requirement.

The `/evolve` command should be implemented as a Claude Code skill (SKILL.md) rather than a standalone Commander.js CLI binary. Skills are the native mechanism for slash commands in Claude Code (since v2.1.3 merger), and they can reference supporting scripts via `${CLAUDE_SKILL_DIR}`. The skill's SKILL.md tells Claude to run the analysis pipeline and present results. Commander.js is deferred to Phase 6 or later for standalone CLI use cases outside Claude Code sessions.

**Primary recommendation:** Build the markdown renderer first (DEL-01), then state tracking (DEL-05), then the `/evolve` skill (TRG-03), then the notification injection in UserPromptSubmit (DEL-02/03/04), and finally full-auto mode (DEL-06). Keep stdout injection as a config-gated optional enhancement with `/evolve` as the reliable primary path.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEL-01 | Write structured recommendations to ~/.harness-evolve/recommendations.md with confidence tiers | Markdown renderer transforms AnalysisResult into structured markdown with HIGH/MEDIUM/LOW sections, evidence, and suggested actions |
| DEL-02 | Non-invasive delivery via UserPromptSubmit stdout injection (< 200 tokens) | Plain text stdout on exit 0 is added as context per official docs; use one-line notification pointer, config-gated |
| DEL-03 | File fallback -- if stdout injection unreliable, use /evolve as primary | Config `delivery.stdoutInjection` flag; /evolve skill always works regardless of injection state |
| DEL-04 | Dual delivery -- stdout pointer + full detail in file, never payload in stdout | Stdout writes only a pointer message (< 200 tokens); full recommendations always in .md file |
| DEL-05 | Recommendation state tracking -- applied/dismissed/pending | JSON state file at ~/.harness-evolve/analysis/recommendation-state.json with per-recommendation status |
| DEL-06 | Full-auto mode -- auto-apply HIGH confidence recommendations, log what was applied | Config flag `delivery.fullAuto`; restricted to specific action types (settings.json allowedTools); auto-apply log persisted |
| TRG-03 | Support manual on-demand analysis via /evolve skill | Claude Code skill (SKILL.md) that triggers runAnalysis + renders recommendations |
| TRG-04 | Both auto-threshold and manual triggers coexist | runAnalysis() is callable from both trigger.ts (threshold) and /evolve skill (manual); no conflict |
| QUA-01 | Recommend only, never auto-execute without awareness (default mode) | Default config has fullAuto=false; recommendations.md is read-only suggestions |
| QUA-02 | Output budget enforcement -- recommendations file stays bounded, logs rotate | Max recommendations cap (existing: 20), rotation of old recommendation batches, file size check |
| QUA-03 | Confidence tiers (HIGH/MEDIUM/LOW) with explanations, no numeric scores | Already in recommendation schema; markdown renderer groups by tier with evidence excerpts |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Verified |
|---------|---------|---------|----------|
| Node.js | >=22.14.0 | Runtime | v22.14.0 installed |
| TypeScript | ~6.0 | Type safety | In devDependencies |
| Zod | ^4.3.6 | Schema validation for state tracking, config extensions | In dependencies |
| write-file-atomic | ^7.0.0 | Atomic writes for recommendations.md, state file | 7.0.1 on npm |
| Vitest | ^4.1.2 | Unit and integration testing | In devDependencies |
| tsup | ^8.5.1 | Bundle TS to JS | In devDependencies |

### New for Phase 5
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | -- | -- | All Phase 5 needs are covered by existing dependencies |

### Not Needed Yet
| Library | Reason for Deferral |
|---------|---------------------|
| Commander.js ^14.0.3 | /evolve is a Claude Code skill (SKILL.md), not a standalone CLI. Commander deferred to Phase 6+ for standalone CLI use outside Claude Code sessions |
| @commander-js/extra-typings | Same -- deferred with Commander |

**No new dependencies needed.** Phase 5 uses existing stack: Zod for schemas, write-file-atomic for file writes, native fs for reads, existing analysis engine for pipeline.

## Architecture Patterns

### Recommended Project Structure (Phase 5 Additions)
```
src/
  delivery/
    renderer.ts          # AnalysisResult -> recommendations.md markdown
    state.ts             # Recommendation state tracking (pending/applied/dismissed)
    rotator.ts           # Old recommendations rotation, file bounding
    auto-apply.ts        # Full-auto mode: apply HIGH-confidence recs
    notification.ts      # Stdout injection message builder (< 200 tokens)
    index.ts             # Re-exports
  schemas/
    delivery.ts          # New schemas: RecommendationState, AutoApplyLog, DeliveryConfig
  hooks/
    user-prompt-submit.ts  # Modified: add notification injection after counter check
.claude/
  skills/
    evolve/
      SKILL.md           # /evolve skill definition
```

### Pattern 1: Markdown Renderer (AnalysisResult -> .md)
**What:** Pure function that takes an AnalysisResult and produces a structured markdown string, grouped by confidence tier.
**When to use:** After every analysis run (both threshold-triggered and manual /evolve).
**Example:**
```typescript
// Source: Project-specific pattern
export function renderRecommendations(
  result: AnalysisResult,
  states: Map<string, RecommendationStatus>,
): string {
  const lines: string[] = [];
  lines.push('# harness-evolve Recommendations');
  lines.push('');
  lines.push(`*Generated: ${result.generated_at}*`);
  lines.push(`*Period: ${result.summary_period.since} to ${result.summary_period.until} (${result.summary_period.days} days)*`);
  lines.push('');

  for (const tier of ['HIGH', 'MEDIUM', 'LOW'] as const) {
    const recs = result.recommendations.filter(r => r.confidence === tier);
    if (recs.length === 0) continue;
    lines.push(`## ${tier} Confidence`);
    lines.push('');
    for (const rec of recs) {
      const status = states.get(rec.id) ?? 'pending';
      lines.push(`### [${status.toUpperCase()}] ${rec.title}`);
      lines.push(`**Target:** ${rec.target} | **Pattern:** ${rec.pattern_type}`);
      lines.push(`**Evidence:** ${rec.evidence.count} occurrences across ${rec.evidence.sessions ?? '?'} sessions`);
      lines.push('');
      lines.push(rec.description);
      lines.push('');
      lines.push(`**Suggested action:** ${rec.suggested_action}`);
      if (rec.ecosystem_context) {
        lines.push(`**Ecosystem note:** ${rec.ecosystem_context}`);
      }
      lines.push('');
    }
  }
  return lines.join('\n');
}
```

### Pattern 2: State Tracking (JSON File)
**What:** A JSON file that tracks per-recommendation status independently from the recommendations themselves.
**When to use:** Every time recommendations are rendered, and when user applies/dismisses a recommendation.
**Why separate file:** The AnalysisResult is regenerated on each analysis run. State must persist across regenerations. Keying by recommendation ID allows matching even when analysis re-runs produce the same pattern.
**Example:**
```typescript
// Source: Project-specific pattern
export const recommendationStatusSchema = z.enum(['pending', 'applied', 'dismissed']);
export type RecommendationStatus = z.infer<typeof recommendationStatusSchema>;

export const recommendationStateEntrySchema = z.object({
  id: z.string(),
  status: recommendationStatusSchema,
  updated_at: z.iso.datetime(),
  applied_details: z.string().optional(), // What was applied (for auto-apply log)
});

export const recommendationStateSchema = z.object({
  entries: z.array(recommendationStateEntrySchema),
  last_updated: z.iso.datetime(),
});
export type RecommendationState = z.infer<typeof recommendationStateSchema>;
```

### Pattern 3: Notification Builder (< 200 Tokens)
**What:** A function that produces a one-line stdout message pointing to recommendations.md.
**When to use:** In UserPromptSubmit hook, ONLY when: (1) analysis has completed since last notification, (2) config.delivery.stdoutInjection is true, (3) there are pending recommendations.
**Critical constraint:** MUST be under 200 tokens. Plain text, not JSON. One line.
**Example:**
```typescript
// Source: Project-specific pattern, informed by Claude Code hooks docs
export function buildNotification(pendingCount: number, filePath: string): string {
  return `[harness-evolve] ${pendingCount} new recommendation${pendingCount === 1 ? '' : 's'} available. See ${filePath} or run /evolve to review.`;
}
```

### Pattern 4: /evolve Skill (SKILL.md)
**What:** A Claude Code skill that triggers on-demand analysis and presents results.
**When to use:** User types `/evolve` in Claude Code session.
**Why skill not CLI:** Skills are the native slash-command mechanism in Claude Code since v2.1.3. They can reference scripts via `${CLAUDE_SKILL_DIR}`, run shell commands via `` !`command` `` syntax, and Claude presents the results conversationally.
**Example:**
```yaml
---
name: evolve
description: Run harness-evolve analysis and show optimization recommendations for your Claude Code configuration
disable-model-invocation: true
---

# harness-evolve: On-Demand Analysis

Run the harness-evolve analysis pipeline and present recommendations.

## Steps

1. Run the analysis pipeline:
   !`node "${CLAUDE_SKILL_DIR}/../../dist/delivery/run-evolve.js" "$PWD" 2>/dev/null`

2. Read the recommendations file and present the results to the user.
   The file is at `~/.harness-evolve/recommendations.md`.

3. For each recommendation, ask the user what action to take:
   - **Apply**: Implement the suggested change
   - **Dismiss**: Mark as dismissed (won't show again)
   - **Skip**: Leave as pending for later

4. After the user decides, update the recommendation state.
```

### Pattern 5: Rotation and Bounding
**What:** Keep recommendations.md bounded by rotating old recommendation batches.
**When to use:** Before writing new recommendations, check if the file would exceed bounds.
**Strategy:**
- Keep at most `max_recommendations` (default 20) in the current file
- When new analysis runs, stale recommendations (applied/dismissed older than 7 days) are archived to `~/.harness-evolve/analysis/recommendations-archive/YYYY-MM-DD.json`
- The .md file only shows current pending + recently applied/dismissed

### Anti-Patterns to Avoid
- **Never put full recommendation payload in stdout:** Stdout injection is for the one-line notification pointer only. Full details always in the .md file. This avoids token budget issues and stdout reliability problems.
- **Never auto-apply without logging:** Full-auto mode MUST write an auto-apply log entry before making any change. If the apply fails, the log shows what was attempted.
- **Never modify files outside ~/.harness-evolve/ automatically:** Auto-apply for settings.json changes (e.g., allowedTools) modifies the user's Claude Code settings. This requires extreme caution -- always back up before modifying, and only modify specific keys, never overwrite the entire file.
- **Never block UserPromptSubmit for analysis:** Notification injection must be fast (< 100ms). If reading recommendation state takes too long, skip the notification silently.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom temp+rename | write-file-atomic | Already in deps, handles edge cases |
| Markdown rendering | Template engine (handlebars, etc.) | String concatenation | Output is simple structured markdown; a template engine is overkill for ~50 lines of output |
| Recommendation ID matching | Custom diffing across analysis runs | Deterministic ID scheme (already exists: `rec-{pattern_type}-{N}`) | IDs are already deterministic per Phase 4 decision |
| Config extension | Separate config file for delivery | Extend existing configSchema with delivery fields | Config already has `delivery` section with `stdoutInjection` and `maxTokens` |

**Key insight:** Phase 5 is mostly glue code connecting the existing analysis engine output to user-facing delivery channels. The hard work (pattern detection, routing, confidence assignment) is done. This phase is about rendering, state management, and I/O.

## Common Pitfalls

### Pitfall 1: UserPromptSubmit Stdout Injection Unreliability
**What goes wrong:** Stdout from UserPromptSubmit hooks may not reliably appear as context for Claude. Historical bugs in v2.0.69, v2.1.4, and prompt injection false positives in v2.1.5.
**Why it happens:** Claude Code's hook stdout processing has had multiple iterations. Plain text works more reliably than JSON hookSpecificOutput, but edge cases remain.
**How to avoid:** (1) Always use plain text stdout, never JSON hookSpecificOutput for UserPromptSubmit. (2) Config-gate the feature (`delivery.stdoutInjection`). (3) Design the notification as a pointer ("see file X"), not a payload. (4) /evolve skill is the reliable fallback that works regardless.
**Warning signs:** Users report not seeing notifications; check Claude Code version and test manually.

### Pitfall 2: Recommendations.md Growing Unbounded
**What goes wrong:** Every analysis run appends recommendations without removing old ones. File grows indefinitely.
**Why it happens:** No rotation logic; recommendations accumulate across runs.
**How to avoid:** (1) Cap at `max_recommendations` (default 20). (2) Archive applied/dismissed recommendations older than 7 days. (3) Each analysis run regenerates the full .md file from current AnalysisResult + state, not appending.
**Warning signs:** recommendations.md exceeds 50KB.

### Pitfall 3: State File Losing Sync with Recommendations
**What goes wrong:** State file references recommendation IDs that no longer exist in the latest analysis, or new recommendations have no state entry.
**Why it happens:** Analysis runs generate new IDs; state file has old IDs from previous runs.
**How to avoid:** (1) When rendering, default unknown IDs to "pending". (2) When archiving, clean up state entries for archived recommendations. (3) Use deterministic IDs (Phase 4 pattern: `rec-{type}-{N}`) so same patterns get same IDs across runs.
**Warning signs:** State file grows without bound; recommendations show wrong status.

### Pitfall 4: Full-Auto Mode Corrupting User Config
**What goes wrong:** Auto-apply modifies settings.json or CLAUDE.md incorrectly, breaking the user's configuration.
**Why it happens:** JSON merge is not idempotent; markdown insertion loses formatting.
**How to avoid:** (1) Phase 5 v1: restrict auto-apply to ONLY settings.json `allowedTools` additions (safest, most atomic operation). (2) Always back up before modifying. (3) Validate the resulting file before writing. (4) Log exactly what was changed with a diff.
**Warning signs:** User's Claude Code stops working after auto-apply.

### Pitfall 5: Notification Injection Slowing Down UserPromptSubmit
**What goes wrong:** Reading state file, checking for pending recommendations, and building notification adds latency to every prompt submission.
**Why it happens:** Additional I/O in the critical path.
**How to avoid:** (1) Use a simple flag file (`~/.harness-evolve/analysis/has-pending-notifications`) that the analysis pipeline sets. The hook only reads this one file (stat check), not the full state. (2) If flag doesn't exist, skip immediately. (3) Full state read only happens when flag exists.
**Warning signs:** UserPromptSubmit hook exceeds 100ms budget.

### Pitfall 6: /evolve Skill Not Finding Compiled JS
**What goes wrong:** The /evolve skill references a compiled JS entry point that doesn't exist because tsup wasn't configured for it.
**Why it happens:** tsup.config.ts has specific entry points; new files need to be added.
**How to avoid:** Add the delivery entry point to tsup.config.ts: `'delivery/run-evolve': 'src/delivery/run-evolve.ts'`.
**Warning signs:** `/evolve` throws "Cannot find module" error.

## Code Examples

### Notification Injection in UserPromptSubmit Hook
```typescript
// Source: Extending existing src/hooks/user-prompt-submit.ts
// Add after incrementCounter() call:

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { paths } from '../storage/dirs.js';

// Check for pending notification flag (fast path)
const notificationFlagPath = join(paths.analysis, 'has-pending-notifications');
if (config.delivery.stdoutInjection && existsSync(notificationFlagPath)) {
  try {
    const flagContent = await readFile(notificationFlagPath, 'utf-8');
    const pendingCount = parseInt(flagContent.trim(), 10) || 0;
    if (pendingCount > 0) {
      const msg = `[harness-evolve] ${pendingCount} new recommendation${pendingCount === 1 ? '' : 's'} available. See ~/.harness-evolve/recommendations.md or run /evolve to review.`;
      process.stdout.write(msg + '\n');
      // Remove flag after notification
      await unlink(notificationFlagPath).catch(() => {});
    }
  } catch {
    // Never block Claude Code on notification errors
  }
}
```

### Config Schema Extension
```typescript
// Source: Extending existing src/schemas/config.ts delivery section
delivery: z.object({
  stdoutInjection: z.boolean().default(true),
  maxTokens: z.number().default(200),
  fullAuto: z.boolean().default(false),
  maxRecommendationsInFile: z.number().default(20),
  archiveAfterDays: z.number().default(7),
}).default({
  stdoutInjection: true,
  maxTokens: 200,
  fullAuto: false,
  maxRecommendationsInFile: 20,
  archiveAfterDays: 7,
}),
```

### Run-Evolve Entry Point (for /evolve skill)
```typescript
// Source: src/delivery/run-evolve.ts
// Entry point for /evolve skill -- runs analysis and writes recommendations.md
import { runAnalysis } from '../analysis/trigger.js';
import { renderRecommendations } from './renderer.js';
import { loadState } from './state.js';
import { paths, ensureInit } from '../storage/dirs.js';
import writeFileAtomic from 'write-file-atomic';
import { join } from 'node:path';

async function main(): Promise<void> {
  const cwd = process.argv[2] || process.cwd();
  await ensureInit();

  const result = await runAnalysis(cwd);
  const state = await loadState();
  const stateMap = new Map(state.entries.map(e => [e.id, e.status]));
  const markdown = renderRecommendations(result, stateMap);

  const recPath = join(paths.base, 'recommendations.md');
  await writeFileAtomic(recPath, markdown);

  // Output summary for the skill to present
  const pending = result.recommendations.filter(
    r => (stateMap.get(r.id) ?? 'pending') === 'pending'
  );
  console.log(JSON.stringify({
    total: result.recommendations.length,
    pending: pending.length,
    high: pending.filter(r => r.confidence === 'HIGH').length,
    medium: pending.filter(r => r.confidence === 'MEDIUM').length,
    low: pending.filter(r => r.confidence === 'LOW').length,
    file: recPath,
  }));
}

main().catch(() => process.exit(1));
```

### Paths Extension for Phase 5
```typescript
// Source: Extending src/storage/dirs.ts
export const paths = {
  // ... existing paths ...
  recommendations: join(BASE_DIR, 'recommendations.md'),
  recommendationState: join(BASE_DIR, 'analysis', 'recommendation-state.json'),
  recommendationArchive: join(BASE_DIR, 'analysis', 'recommendations-archive'),
  notificationFlag: join(BASE_DIR, 'analysis', 'has-pending-notifications'),
  autoApplyLog: join(BASE_DIR, 'analysis', 'auto-apply-log.jsonl'),
} as const;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Slash commands (.claude/commands/) | Skills (.claude/skills/) with SKILL.md | Claude Code v2.1.3 (Jan 2026) | Skills support frontmatter, supporting files, subagent execution. Commands still work but skills are preferred. |
| UserPromptSubmit JSON hookSpecificOutput | Plain text stdout preferred | v2.1.x (Jan 2026) | JSON hookSpecificOutput had first-message bug. Plain text is more reliable. |
| Custom CLI for Claude Code extensions | Skills + hooks + plugins | 2026 | Skills provide native /command interface without separate CLI installation |

**Deprecated/outdated:**
- `.claude/commands/` directory: Still works but `.claude/skills/` is recommended (same functionality + more features)
- JSON `hookSpecificOutput.additionalContext` for UserPromptSubmit: Works but plain text stdout is safer

## Open Questions

1. **UserPromptSubmit stdout on current Claude Code version**
   - What we know: Official docs say plaintext stdout is added as context. Historical bugs exist but are closed. Issue #17804 (false positive injection detection) was closed as inactive, not explicitly fixed.
   - What's unclear: Whether the current installed version handles all edge cases correctly.
   - Recommendation: Config-gate the feature. Test empirically during Phase 5 execution. /evolve is the reliable fallback.

2. **Auto-apply scope for v1**
   - What we know: DEL-06 requires auto-apply for HIGH confidence recommendations. The safest auto-apply target is settings.json allowedTools (adding a single key to an array).
   - What's unclear: Should v1 auto-apply also cover CLAUDE.md additions? Rule file creation?
   - Recommendation: v1 restricts auto-apply to ONLY settings.json allowedTools additions. Other targets are "recommended but manual." This minimizes risk while proving the mechanism.

3. **Skill distribution path**
   - What we know: The /evolve skill needs to be in `.claude/skills/evolve/SKILL.md`. For the plugin model, it would be under the plugin's `skills/` directory.
   - What's unclear: Whether the project distributes as a plugin (with skills/) or as a standalone tool where users copy the skill.
   - Recommendation: Include the skill in the repo at `.claude/skills/evolve/SKILL.md` for project-local use. The plugin distribution path is a Phase 6+ concern.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEL-01 | renderRecommendations produces valid markdown with confidence tiers | unit | `npx vitest run tests/unit/delivery/renderer.test.ts -x` | Wave 0 |
| DEL-02 | Notification injection writes < 200 token message to stdout | unit | `npx vitest run tests/unit/delivery/notification.test.ts -x` | Wave 0 |
| DEL-03 | When stdoutInjection=false, no stdout written | unit | `npx vitest run tests/unit/delivery/notification.test.ts -t "disabled" -x` | Wave 0 |
| DEL-04 | Stdout message is pointer only, full detail in .md file | unit | `npx vitest run tests/unit/delivery/renderer.test.ts -t "full detail" -x` | Wave 0 |
| DEL-05 | State tracking: pending/applied/dismissed lifecycle | unit | `npx vitest run tests/unit/delivery/state.test.ts -x` | Wave 0 |
| DEL-06 | Full-auto applies HIGH recs and logs changes | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -x` | Wave 0 |
| TRG-03 | run-evolve entry point triggers analysis and writes .md | integration | `npx vitest run tests/integration/delivery-pipeline.test.ts -t "evolve" -x` | Wave 0 |
| TRG-04 | Both auto and manual triggers produce same output format | integration | `npx vitest run tests/integration/delivery-pipeline.test.ts -t "coexist" -x` | Wave 0 |
| QUA-01 | Default mode is recommend-only, no auto-execute | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "default disabled" -x` | Wave 0 |
| QUA-02 | File rotation keeps recommendations.md bounded | unit | `npx vitest run tests/unit/delivery/rotator.test.ts -x` | Wave 0 |
| QUA-03 | Confidence tiers rendered with explanations, no numeric scores | unit | `npx vitest run tests/unit/delivery/renderer.test.ts -t "confidence" -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/delivery/renderer.test.ts` -- covers DEL-01, DEL-04, QUA-03
- [ ] `tests/unit/delivery/notification.test.ts` -- covers DEL-02, DEL-03
- [ ] `tests/unit/delivery/state.test.ts` -- covers DEL-05
- [ ] `tests/unit/delivery/auto-apply.test.ts` -- covers DEL-06, QUA-01
- [ ] `tests/unit/delivery/rotator.test.ts` -- covers QUA-02
- [ ] `tests/integration/delivery-pipeline.test.ts` -- covers TRG-03, TRG-04

## Project Constraints (from CLAUDE.md)

- **Code comments:** Pure English only, no Chinese, no bilingual
- **Commit messages:** GSD format: `<type>(<phase>-<plan>): <description>` (since `.planning/` exists)
- **No Co-Authored-By:** Hook blocks this
- **TDD default:** Business logic tasks default `tdd="true"`
- **Verification loop:** Build -> Test -> Lint -> TypeCheck after every change
- **Performance budget:** UserPromptSubmit capture < 50ms, injection < 100ms
- **Search before build:** Check for existing solutions before implementing common functionality
- **Technology stack locked:** Node.js 22, TypeScript ~6.0, Zod 4, write-file-atomic 7, tsup 8, Vitest 4
- **File-based persistence only:** No databases, no SQLite, no vector DB -- plain files
- **Zod v4 patterns:** Use factory function defaults for nested objects (Phase 4 decision)
- **Testable handler pattern:** Export handleX(rawJson) for direct test invocation (Phase 2 pattern)

## Sources

### Primary (HIGH confidence)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- UserPromptSubmit stdout behavior, exit codes, JSON output format, hook lifecycle
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) -- Practical examples, additionalContext vs plain text, troubleshooting
- [Claude Code Skills](https://code.claude.com/docs/en/skills) -- SKILL.md frontmatter schema, skill directories, dynamic context injection, `${CLAUDE_SKILL_DIR}` substitution
- Existing codebase: src/analysis/trigger.ts (runAnalysis), src/schemas/recommendation.ts (AnalysisResult), src/schemas/config.ts (delivery config)

### Secondary (MEDIUM confidence)
- [GitHub Issue #13912](https://github.com/anthropics/claude-code/issues/13912) -- UserPromptSubmit stdout error in v2.0.69 (CLOSED)
- [GitHub Issue #17804](https://github.com/anthropics/claude-code/issues/17804) -- False positive prompt injection detection in v2.1.5 (CLOSED - NOT PLANNED)
- [GitHub Issue #27365](https://github.com/anthropics/claude-code/issues/27365) -- Feature request for updatedPrompt in UserPromptSubmit (confirms current stdout behavior)
- [Claude Code Skills vs Slash Commands 2026](https://yingtu.ai/en/blog/claude-code-skills-vs-slash-commands) -- Skills/commands merger context
- Phase 1 Research (01-RESEARCH.md) -- Gray Area #1 analysis, stdout injection recommendation

### Tertiary (LOW confidence)
- None -- all findings verified against primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies needed, all existing
- Architecture: HIGH -- delivery patterns are straightforward I/O and rendering based on well-understood Phase 4 output
- Pitfalls: HIGH -- stdout injection risks well-documented through GitHub issues and Phase 1 research; rotation/state patterns are standard
- Skill system: HIGH -- official docs thoroughly document SKILL.md format and capabilities
- Auto-apply: MEDIUM -- scope restrictions (settings.json only) are a judgment call, not verified against user expectations

**Research date:** 2026-04-01
**Valid until:** 2026-04-30 (stable domain -- file I/O, markdown rendering, skill system)
