# Phase 17: Bug Fixes & Reliability - Research

**Researched:** 2026-04-05
**Domain:** Bug fixes for v2.0 dogfooding issues (CLI, scanner, applier, notification)
**Confidence:** HIGH

## Summary

Phase 17 addresses four discrete bugs discovered during v2.0 dogfooding. Each bug is well-localized with a clear root cause identified through direct source code analysis. No new dependencies or architectural changes are required -- all fixes are surgical modifications to existing modules.

The four bugs span different subsystems but are all straightforward: (1) slash commands install to project-local instead of global directory, (2) the `extractReferences` regex matches npm scoped packages and URL @ patterns as file references, (3) all four appliers gate `canApply()` on `rec.confidence === 'HIGH'` even when the user explicitly asks to apply, (4) the Stop hook analysis path never writes the notification flag that the UserPromptSubmit hook reads.

**Primary recommendation:** Fix each bug independently with focused unit tests. The fixes are orthogonal and can be developed in any order within a single branch.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-01 | Slash commands install to global `~/.claude/commands/evolve/` instead of project-level `.claude/commands/evolve/` | Root cause: `installSlashCommands()` in `src/cli/init.ts` line 47 uses `projectDir` (defaults to `process.cwd()`) instead of `$HOME/.claude/`. Fix: change target to `~/.claude/commands/evolve/`. Claude Code docs confirm `~/.claude/commands/` is the global personal commands directory. |
| FIX-02 | Scanner false positives for npm scoped packages (`@scope/package`) and URL user paths (`@user/path`) | Root cause: `extractReferences()` in `src/scan/context-builder.ts` uses regex `/@([\w./-]+)/g` which matches any `@word/path` pattern. Email filter only checks preceding word char. Fix: add exclusion patterns for npm scoped packages (preceded by `"` or space in package contexts) and URL paths (preceded by `/` or `:`). |
| FIX-03 | `apply-one` CLI subcommand rejects MEDIUM/LOW confidence recommendations | Root cause: All 4 appliers (`SettingsApplier`, `RuleApplier`, `HookApplier`, `ClaudeMdApplier`) include `rec.confidence === 'HIGH'` in their `canApply()` method. The `apply-one` CLI path (user-initiated) goes through `getApplier(rec.target)` then `applier.canApply(rec)`, hitting the same gate. Fix: distinguish auto-apply (keeps HIGH gate) from manual apply-one (skips confidence gate). |
| FIX-04 | Stop hook analysis does not trigger notification on next prompt | Root cause: `checkAndTriggerAnalysis()` in `src/analysis/trigger.ts` calls `runAnalysis()` but never calls `writeNotificationFlag()`. The `/evolve` skill (`run-evolve.ts`) does write the flag, but the Stop hook path does not. Fix: after successful `runAnalysis()` in `checkAndTriggerAnalysis()`, compute pending count and write notification flag. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Language**: Code comments in English only; technical discussion in Chinese
- **Stack**: Node.js 22 + TypeScript 6.0 + tsup + Vitest 4.x + Zod 4.x + Commander 14
- **Testing**: Vitest (`npm run test` = `vitest run`); TDD approach
- **Build**: `npm run build` = `tsup`; `npm run typecheck` = `tsc --noEmit`
- **Commit**: Use `/commit` skill; conventional commits format; no Co-Authored-By
- **GSD workflow**: One phase = one feature branch = one PR
- **Verification loop**: Build -> Test -> Lint -> TypeCheck; fail = stop + fix + re-verify all

## Standard Stack

No new dependencies needed. All fixes use the existing stack:

### Core (existing, no changes)
| Library | Version | Purpose | Role in This Phase |
|---------|---------|---------|-------------------|
| Node.js | >=22.14.0 | Runtime | No change |
| TypeScript | ~6.0 | Type safety | No change |
| Zod | ^4.3.6 | Schema validation | No change |
| Commander.js | ^14.0.3 | CLI framework | No change |
| write-file-atomic | ^7.0.0 | Atomic file writes | Used in notification flag write |
| Vitest | ^4.1.2 | Testing | New tests for each fix |

**Installation:** No new packages to install.

## Architecture Patterns

### Relevant Project Structure
```
src/
├── cli/
│   ├── init.ts          # FIX-01: installSlashCommands() target path
│   ├── apply.ts         # FIX-03: apply-one command flow
│   └── utils.ts         # Shared CLI utilities
├── scan/
│   ├── context-builder.ts  # FIX-02: extractReferences() regex
│   └── scanners/
│       └── staleness.ts    # FIX-02: consumes references from context
├── delivery/
│   ├── appliers/
│   │   ├── index.ts        # FIX-03: Applier interface
│   │   ├── settings-applier.ts  # FIX-03: canApply() confidence gate
│   │   ├── rule-applier.ts      # FIX-03: canApply() confidence gate
│   │   ├── hook-applier.ts      # FIX-03: canApply() confidence gate
│   │   └── claude-md-applier.ts # FIX-03: canApply() confidence gate
│   ├── auto-apply.ts    # FIX-03: auto-apply keeps HIGH gate
│   └── notification.ts  # FIX-04: writeNotificationFlag() exists but not called from Stop
├── analysis/
│   └── trigger.ts       # FIX-04: checkAndTriggerAnalysis() missing notification
└── hooks/
    ├── stop.ts           # FIX-04: calls checkAndTriggerAnalysis()
    └── user-prompt-submit.ts  # FIX-04: reads notification flag
```

### Pattern 1: Applier Strategy with Dual Context (FIX-03)
**What:** Distinguish auto-apply (system-initiated, needs HIGH confidence gate) from manual apply-one (user-initiated, any confidence).
**When to use:** When the same Applier is called from both automatic and manual paths.
**Approach:** Add an `options.skipConfidenceGate` flag to `ApplierOptions`, pass `true` from `apply-one` CLI, `false` (default) from `autoApplyRecommendations()`.

```typescript
// In appliers/index.ts - add to ApplierOptions:
export interface ApplierOptions {
  settingsPath?: string;
  rulesDir?: string;
  hooksDir?: string;
  claudeMdPath?: string;
  skipConfidenceGate?: boolean;  // NEW: true when user explicitly invokes apply-one
}

// In each applier's canApply():
canApply(rec: Recommendation, options?: ApplierOptions): boolean {
  const confidenceOk = options?.skipConfidenceGate || rec.confidence === 'HIGH';
  return confidenceOk && rec.target === 'SETTINGS' && rec.pattern_type === 'permission-always-approved';
}
```

### Pattern 2: Reference Extraction Filtering (FIX-02)
**What:** Filter out non-file-reference @ patterns from the extracted references list.
**When to use:** When `extractReferences()` encounters content with npm scoped packages or URLs.
**Approach:** Add heuristic filters that detect common non-reference @ patterns:

```typescript
// In context-builder.ts extractReferences():
// Filter: npm scoped packages -- @scope/package patterns preceded by " or space
// that look like package names (no file extension, no deep path)
function isNpmScopedPackage(ref: string, content: string, matchIndex: number): boolean {
  // Check if preceded by " (JSON/import context)
  if (matchIndex > 0) {
    const prevChar = content[matchIndex - 1];
    if (prevChar === '"' || prevChar === "'") return true;
  }
  // Check pattern: single slash, no file extension in the segment after /
  const parts = ref.split('/');
  if (parts.length === 2 && !parts[1].includes('.')) return true;
  return false;
}

// Filter: URL user paths -- @user/path preceded by / or : (URL context)
function isUrlUserPath(content: string, matchIndex: number): boolean {
  if (matchIndex > 0) {
    const prevChar = content[matchIndex - 1];
    if (prevChar === '/' || prevChar === ':') return true;
  }
  return false;
}
```

### Anti-Patterns to Avoid
- **Modifying the Applier interface signature for canApply**: Adding `options` param to `canApply()` requires updating the interface and all implementations. Instead, pass `skipConfidenceGate` through the existing `ApplierOptions` on `apply()`, or add it to `canApply()` as an optional second parameter.
- **Regex-only filtering for FIX-02**: Don't try to build a single perfect regex. Use simple heuristic functions that are easy to test and extend.
- **Coupling notification logic to trigger.ts**: The notification write should be called after `runAnalysis()` returns, not deep inside `runAnalysis()` itself, to keep separation of concerns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom rename-swap | `write-file-atomic` (already in deps) | Race conditions between concurrent Claude Code sessions |
| Path resolution for `~/.claude/` | Hardcoded string concat | `join(process.env.HOME, '.claude', ...)` (already in use) | Cross-platform safety |

**Key insight:** All fixes are modifications to existing code paths, not new subsystems. The existing patterns (applier registry, notification flag, extractReferences) are well-structured -- the bugs are missing connections, not missing architecture.

## Common Pitfalls

### Pitfall 1: Breaking Auto-Apply When Fixing Manual Apply (FIX-03)
**What goes wrong:** Removing the confidence gate from `canApply()` unconditionally would make auto-apply process MEDIUM/LOW recommendations automatically, violating the safety design (QUA-01).
**Why it happens:** The same `canApply()` is called from both auto-apply and manual apply-one paths.
**How to avoid:** Always pass `skipConfidenceGate` only from the manual CLI path (`apply-one` command). Auto-apply in `auto-apply.ts` already pre-filters to `rec.confidence === 'HIGH'` (line 59), providing a double safety net.
**Warning signs:** Tests that verify auto-apply only processes HIGH recs start failing.

### Pitfall 2: Over-Filtering References in FIX-02
**What goes wrong:** Filtering too aggressively causes real stale `@docs/guide.md` references to be missed.
**Why it happens:** The heuristics for npm/URL patterns are too broad.
**How to avoid:** Only filter patterns that clearly match npm scoped packages (exactly 2 path segments, no file extension) or URL contexts (preceded by `:` or `/`). Require real file references to have a file extension (`.md`, `.ts`, etc.) or look like directory paths.
**Warning signs:** Existing staleness scanner tests stop detecting known stale references.

### Pitfall 3: Notification Race Condition (FIX-04)
**What goes wrong:** The notification flag is written by the Stop hook but read by the UserPromptSubmit hook in the next interaction. If analysis is slow and the user types quickly, the flag might not be written yet.
**Why it happens:** The Stop hook runs async and analysis can take up to 5 seconds.
**How to avoid:** This is acceptable behavior -- the notification will appear on the NEXT prompt after analysis completes, not necessarily the immediate next one. The existing design already handles this gracefully. The bug is that the flag is never written at all, not that it's written too late.
**Warning signs:** N/A -- the race condition is by design.

### Pitfall 4: Global Commands Directory May Not Exist (FIX-01)
**What goes wrong:** First-time users won't have `~/.claude/commands/` directory.
**Why it happens:** The directory is only created when the user or a tool creates it.
**How to avoid:** Use `mkdir(commandsDir, { recursive: true })` (already done in `installSlashCommands`). Just need to change the base path.
**Warning signs:** `ENOENT` errors during init.

### Pitfall 5: Canary Break -- Existing Slash Commands in Project Directories
**What goes wrong:** Users who already ran `harness-evolve init` have commands in their project `.claude/commands/evolve/`. After the fix, new init will install globally, but old project-level commands remain as stale files.
**Why it happens:** Migration from project-level to global was not considered.
**How to avoid:** During init, after installing global commands, check if project-level `{cwd}/.claude/commands/evolve/` exists and warn the user to remove it (or auto-remove with confirmation). Also, since skills take precedence over commands, and the project already has `.claude/skills/evolve/SKILL.md`, there's no functional conflict -- just stale files.
**Warning signs:** User sees duplicate `/evolve:scan` entries.

## Code Examples

### FIX-01: Change installSlashCommands target path

```typescript
// Source: src/cli/init.ts -- current (broken)
async function installSlashCommands(projectDir: string): Promise<void> {
  const commandsDir = join(projectDir, '.claude', 'commands', 'evolve');
  // ...
}

// Fixed: install to global ~/.claude/commands/evolve/
async function installSlashCommands(): Promise<void> {
  const home = process.env.HOME ?? '';
  const commandsDir = join(home, '.claude', 'commands', 'evolve');
  await mkdir(commandsDir, { recursive: true });
  // ... rest unchanged
}
```

### FIX-02: Filter non-reference @ patterns

```typescript
// Source: src/scan/context-builder.ts -- extractReferences()
// Add filtering after regex match:

// Skip npm scoped packages: @scope/package (no file extension in second segment)
const parts = ref.split('/');
if (parts.length === 2 && !parts[1].includes('.')) {
  // Likely @scope/package -- check surrounding context
  if (idx > 0 && (content[idx - 1] === '"' || content[idx - 1] === "'")) continue;
  // Also skip if no file extension at all (packages don't have .md, .ts, etc.)
  if (!/\.\w+$/.test(ref)) continue;
}

// Skip URL user paths: preceded by / or :
if (idx > 0 && (content[idx - 1] === '/' || content[idx - 1] === ':')) continue;
```

### FIX-03: Skip confidence gate for manual apply-one

```typescript
// Source: src/delivery/appliers/index.ts
export interface ApplierOptions {
  settingsPath?: string;
  rulesDir?: string;
  hooksDir?: string;
  claudeMdPath?: string;
  skipConfidenceGate?: boolean; // NEW
}

// Source: src/delivery/appliers/settings-applier.ts
canApply(rec: Recommendation, options?: ApplierOptions): boolean {
  const confidenceOk = options?.skipConfidenceGate || rec.confidence === 'HIGH';
  return confidenceOk && rec.target === 'SETTINGS' && rec.pattern_type === 'permission-always-approved';
}

// Source: src/cli/apply.ts -- apply-one command
const result = await applier.apply(rec, { skipConfidenceGate: true });
```

### FIX-04: Write notification flag after Stop hook analysis

```typescript
// Source: src/analysis/trigger.ts
import { writeNotificationFlag } from '../delivery/notification.js';
import { getStatusMap } from '../delivery/state.js';

export async function checkAndTriggerAnalysis(cwd: string): Promise<boolean> {
  // ... existing threshold/cooldown checks ...

  let result: AnalysisResult;
  try {
    result = await runAnalysis(cwd);
  } catch {
    return false;
  }

  // NEW: Write notification flag for pending recommendations
  try {
    const stateMap = await getStatusMap();
    const pendingCount = result.recommendations.filter(
      (r) => (stateMap.get(r.id) ?? 'pending') === 'pending',
    ).length;
    if (pendingCount > 0) {
      await writeNotificationFlag(pendingCount);
    }
  } catch {
    // Notification failure must not block analysis flow
  }

  await resetCounterWithTimestamp();
  return true;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.claude/commands/` (legacy) | `.claude/skills/` (recommended) | Claude Code latest | Skills take precedence over commands; both still work |
| Project-level commands only | Global `~/.claude/commands/` for personal commands | Claude Code GA | Enables cross-project slash commands |

**Note:** The project already uses skills (`.claude/skills/evolve/SKILL.md`) for the `/evolve` command. The slash commands (`/evolve:scan`, `/evolve:apply`) use the legacy `commands/` approach, which still works. Moving them to global `~/.claude/commands/evolve/` is the correct fix for FIX-01 since these are personal developer tools, not project-specific.

## Open Questions

1. **Should old project-level commands be cleaned up during init?**
   - What we know: Users who ran `init` before will have stale `.claude/commands/evolve/` in their project.
   - What's unclear: Should `init` auto-remove them, warn, or ignore?
   - Recommendation: Print a warning if detected. Don't auto-remove (too aggressive for a CLI tool). Let the user clean up manually.

2. **Should `canApply()` interface change or should the gate be in `apply()` instead?**
   - What we know: Currently `canApply()` is called before `apply()` in both auto-apply and manual paths. Adding `options` to `canApply()` changes the interface.
   - What's unclear: Whether to modify `canApply()` signature or handle the gate in `apply()`.
   - Recommendation: Add optional `options` parameter to `canApply()` in the `Applier` interface. This is cleaner than duplicating the gate logic and makes the intent explicit. The `canApply(rec, options?)` signature is backward-compatible.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | `installSlashCommands()` writes to `~/.claude/commands/evolve/` | unit | `npx vitest run tests/unit/cli/init.test.ts -x` | Exists (needs new cases) |
| FIX-02 | `extractReferences()` skips npm scoped packages and URL @ patterns | unit | `npx vitest run tests/unit/scan/context-builder.test.ts -x` | Exists (needs new cases) |
| FIX-02 | `scanStaleness()` produces zero false positives for `@scope/package` | unit | `npx vitest run tests/unit/scan/scanners/staleness.test.ts -x` | Exists (needs new cases) |
| FIX-03 | `apply-one` applies MEDIUM/LOW confidence recs when user invokes | unit | `npx vitest run tests/unit/cli/apply.test.ts -x` | Exists (needs new cases) |
| FIX-03 | Auto-apply still only processes HIGH confidence recs | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -x` | Exists (needs regression case) |
| FIX-03 | Each applier's `canApply()` respects `skipConfidenceGate` option | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -x` | Exists (needs new cases) |
| FIX-04 | `checkAndTriggerAnalysis()` writes notification flag after analysis | unit | `npx vitest run tests/unit/analysis/trigger.test.ts -x` | Exists (needs new cases) |
| FIX-04 | `UserPromptSubmit` reads flag and outputs notification | unit | `npx vitest run tests/unit/hooks/user-prompt-submit.test.ts -x` | Exists (already covered) |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- None -- existing test infrastructure covers all phase requirements. Each test file exists; only new test cases need to be added within existing describe blocks.

## Sources

### Primary (HIGH confidence)
- Source code analysis of `src/cli/init.ts`, `src/scan/context-builder.ts`, `src/delivery/appliers/*.ts`, `src/analysis/trigger.ts`, `src/delivery/notification.ts`, `src/hooks/stop.ts`, `src/hooks/user-prompt-submit.ts`, `src/delivery/run-evolve.ts`
- [Claude Code Slash Commands / Skills docs](https://code.claude.com/docs/en/slash-commands) -- Confirmed `~/.claude/commands/` is global personal commands directory; skills take precedence over commands
- Existing test suite: 58 files, 607 tests, all passing

### Secondary (MEDIUM confidence)
- None needed -- all findings are from direct source code analysis

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new deps needed; existing stack verified via test suite
- Architecture: HIGH - All bugs have clear root causes in source code with exact line numbers
- Pitfalls: HIGH - Each pitfall identified from actual code paths and tested behaviors

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- bug fixes with clear root causes)
