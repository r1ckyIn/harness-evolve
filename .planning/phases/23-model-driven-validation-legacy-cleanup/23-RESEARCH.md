# Phase 23: Model-Driven Validation & Legacy Cleanup - Research

**Researched:** 2026-04-06
**Domain:** Model-driven scanner validation, legacy code removal, test migration
**Confidence:** HIGH

## Summary

Phase 23 is the final phase of v4.0. By the time it executes, Phase 21 has delivered working `scan-context` and `store-findings` CLI commands with the BUG-01 hooks parsing fix, and Phase 22 has delivered the comprehensive guidance docs embedded in the rewritten `/evolve:scan` template. Phase 23's job is twofold: (1) validate that the model-driven approach is at least as capable as the old code-based scanners, and (2) safely remove the 7 legacy TypeScript scanner functions and their ~94 associated tests.

The core challenge is designing **validation test configs** that exercise the five success criteria -- semantic conflict detection, cross-file inconsistency detection, natural-language hookable operation identification, guidance extensibility without code changes, and clean removal of legacy code with passing test suite. Each criterion needs a concrete test config that proves the capability.

The removal is surgical but wide: 8 scanner source files (904 LOC), 7 scanner unit test files (1520 LOC), the E2E dirty-config test (535 LOC), the CLI scan integration test, the scan orchestrator and its tests, plus updates to `src/index.ts` public exports, `src/cli/init.ts` (uses `runDeepScan`), and generators/appliers that reference specific `scan_*` pattern types. The pattern_type enum values must stay in the schema (model-driven findings will use them), but the code that produced them goes away.

**Primary recommendation:** Create a set of 4-5 intentionally crafted test configurations (dirty configs) that exercise each MODEL-* requirement. Run the model-driven `/evolve:scan` against them and verify findings match or exceed what old scanners would produce. Only after this validation passes, remove legacy scanner code in a single atomic step.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MODEL-01 | Model detects semantic-level config conflicts (e.g., "use ESM" vs "use CommonJS"), not just keyword opposition pairs | Validated by test config with semantic contradictions that old conflict.ts regex cannot catch (no always/never keyword pair). See "Validation Test Configs" section. |
| MODEL-02 | Model evaluates cross-file consistency across CLAUDE.md + rules + settings + commands, detecting contradictions or redundancies | Validated by test config with rule in `.claude/rules/` contradicting a hook in `settings.json` -- requires reading multiple files together. See "Cross-File Coherence" test config. |
| MODEL-03 | Model identifies hookable operations described in natural language without fixed keyword lists | Validated by test config with varied phrasing ("ensure tests pass before pushing", "formatting must be checked automatically") that old mechanization.ts 6-regex approach misses. |
| MODEL-04 | User adds new scan area by editing guidance .md, next `/evolve:scan` includes it without code changes | Validated by adding a test "Area 8" section to the guidance doc embedded in the scan template, then verifying model produces findings for that new area. Requires Phase 22's template to be extensible. |
| SCAN-03 | Remove all 7 legacy TS scanner functions and pass test suite with model-driven replacements | 8 source files (904 LOC) + 8 test files removed. Orchestrator simplified. Public exports updated. Generators/appliers retain pattern_type references (values stay in enum). New tests validate model output format. |
</phase_requirements>

## Standard Stack

### Core

No new dependencies. Phase 23 is a validation + removal phase using existing infrastructure.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^4.1.2 | Test framework for new validation tests | Already in project, 734 tests passing |
| Zod | ^4.3.6 | Schema validation for model-driven findings | Already in project, Recommendation schema unchanged |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| write-file-atomic | ^7.0.0 | Atomic writes during store-findings | Already in project, used by store-findings CLI (Phase 21) |

No `npm install` needed. All dependencies already present.

## Architecture Patterns

### Removal Impact Map

The 7 scanner functions have tendrils throughout the codebase. Here is the complete dependency graph for removal:

```
FILES TO DELETE (source):
  src/scan/scanners/redundancy.ts       (92 LOC)
  src/scan/scanners/mechanization.ts    (91 LOC)
  src/scan/scanners/staleness.ts        (124 LOC)
  src/scan/scanners/conflict.ts         (172 LOC)
  src/scan/scanners/structure.ts        (138 LOC)
  src/scan/scanners/hooks-redundancy.ts (114 LOC)
  src/scan/scanners/commands.ts         (136 LOC)
  src/scan/scanners/index.ts            (37 LOC)
  Total: 904 LOC

FILES TO DELETE (tests):
  tests/unit/scan/scanners/redundancy.test.ts       (218 LOC)
  tests/unit/scan/scanners/mechanization.test.ts    (177 LOC)
  tests/unit/scan/scanners/staleness.test.ts        (249 LOC)
  tests/unit/scan/scanners/conflict.test.ts         (254 LOC)
  tests/unit/scan/scanners/structure.test.ts        (243 LOC)
  tests/unit/scan/scanners/hooks-redundancy.test.ts (142 LOC)
  tests/unit/scan/scanners/commands.test.ts         (237 LOC)
  Total: 1520 LOC, ~63 tests

FILES TO MODIFY:
  src/scan/index.ts           -- Remove scanner imports, simplify runDeepScan or replace
  src/index.ts                -- Remove 3 scanner public exports (scanRedundancy, scanMechanization, scanStaleness)
  src/cli/scan.ts             -- Deprecate or simplify (no longer calls runDeepScan with scanners)
  src/cli/init.ts             -- Line 183: uses runDeepScan for post-init scan; replace with scan-context
  src/cli.ts                  -- May need to register new commands (if not done in Phase 21)

FILES THAT REFERENCE scan_* pattern_types BUT DO NOT NEED CODE CHANGES:
  src/schemas/recommendation.ts         -- pattern_type enum: KEEP all scan_* values (model uses them)
  src/delivery/appliers/claude-md-applier.ts -- DESTRUCTIVE_PATTERNS set: KEEP (model findings still use these types)
  src/generators/hook-generator.ts      -- References scan_missing_mechanization: KEEP
  src/generators/claude-md-generator.ts -- Switch on scan_stale_reference, scan_redundancy: KEEP

TESTS TO MODIFY:
  tests/unit/scan/index.test.ts         -- Mocks scanners array; must be rewritten or deleted
  tests/unit/cli/scan.test.ts           -- Mocks runDeepScan; must adapt to new behavior
  tests/integration/dirty-config-e2e.test.ts  -- Asserts 7 scanner pattern_types; REPLACE entirely
  tests/integration/cli-scan.test.ts    -- Uses runDeepScan; adapt to new scan behavior
  tests/unit/scan/context-builder.test.ts -- Imports from scanners/index.ts; remove that import
```

### Pattern 1: Validation-Before-Removal

**What:** Create comprehensive validation tests FIRST, verify they pass with model-driven scan, THEN remove legacy code.
**When to use:** Always for Phase 23 -- this is the safety pattern.
**Rationale:** If validation tests are written after removal, there is no baseline to compare against. The test configs can first be run against old scanners to establish expected findings, then against model-driven scan to verify equivalence or superiority.

### Pattern 2: Test Config Design for Semantic Detection

**What:** Each MODEL-* requirement needs a deliberately crafted config that is ONLY detectable by semantic understanding, not regex.
**When to use:** For MODEL-01, MODEL-02, MODEL-03 validation.
**Key principle:** The test config must demonstrate that the old scanner would MISS the issue but the model catches it. This is the proof of capability improvement.

Example for MODEL-01 (semantic conflict):
```
CLAUDE.md:
  "This project uses ES modules exclusively. All imports use import/export syntax."

.claude/rules/build-config.md:
  "Configure tsconfig.json with module: commonjs for maximum compatibility."
```

The old conflict scanner checks for keyword opposition pairs (always/never, enable/disable, require/forbid). "ES modules" vs "commonjs" has no such pair -- only a model understands the semantic contradiction.

### Pattern 3: Graceful Orchestrator Simplification

**What:** `runDeepScan()` in `src/scan/index.ts` goes from "build context + run 7 scanners" to "build context only" (or removed entirely, with callers using `buildScanContext` directly).
**When to use:** After scanner removal.

```typescript
// BEFORE: orchestrates 7 scanners
export async function runDeepScan(cwd: string, home?: string): Promise<ScanResult> {
  const scanContext = await buildScanContext(cwd, home);
  // ... runs 7 scanners ...
  return { scan_context: scanContext, recommendations, scanner_meta };
}

// AFTER: simplified or replaced by scan-context CLI
// Option A: Keep runDeepScan as thin wrapper for backward compat
export async function runDeepScan(cwd: string, home?: string): Promise<ScanResult> {
  const scanContext = await buildScanContext(cwd, home);
  return {
    generated_at: new Date().toISOString(),
    scan_context: scanContext,
    recommendations: [],  // Model fills these via store-findings
    scanner_meta: [],
  };
}

// Option B: Remove runDeepScan entirely, update all callers
// Preferred -- cleaner, no phantom function
```

### Pattern 4: E2E Test Replacement Strategy

**What:** The existing `dirty-config-e2e.test.ts` (535 LOC, 10 scenarios) asserts exact pattern_type values from 7 scanners. This test is fundamentally incompatible with model-driven scanning because model output is non-deterministic.
**Replacement:** New validation tests focus on schema conformity and capability proof, not exact output matching.

```typescript
// NEW: Model-driven validation test structure
describe('Model-driven scan validation', () => {
  it('scan-context CLI outputs valid ScanContext JSON', async () => {
    // Deterministic: test that scan-context produces valid schema output
    // This replaces the "run scanners" portion of old E2E
  });

  it('store-findings validates and persists model findings', async () => {
    // Deterministic: test that store-findings accepts valid Recommendation[]
    // and rejects invalid ones
  });

  it('pattern_type enum includes all scan areas', () => {
    // Deterministic: enum still has all 7 scan_* values
  });

  it('generators handle scan_* pattern types', () => {
    // Deterministic: claude-md-generator and hook-generator
    // still produce output for scan_* recommendations
  });
});
```

### Anti-Patterns to Avoid

- **Removing scanners before validation tests pass:** No safety net if something goes wrong.
- **Trying to write deterministic assertions for model output:** Model findings are non-deterministic; test structure, not content.
- **Removing pattern_type enum values:** The `scan_*` values in `patternTypeSchema` MUST stay. Model-driven findings use them. Only the TypeScript functions that produce them are removed.
- **Forgetting to update src/index.ts exports:** Three scanner functions are public exports (`scanRedundancy`, `scanMechanization`, `scanStaleness`). These are breaking API changes if anyone imports them. Since this is a new project (no external consumers yet), this is safe but must be documented.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deterministic assertion on model output | Assert exact findings text | Schema validation + structural assertions | Model output is probabilistic; testing exact text causes flaky tests |
| Custom test runner for model validation | A/B comparison framework | Simple before/after test configs with manual review | Over-engineering for 4-5 test configs |
| Migration script for test files | Automated scanner->model test converter | Manual deletion + new test files | Scanner tests are fundamentally different from model validation tests |

## Common Pitfalls

### Pitfall 1: Removing Scanners Without Updating All Import Sites

**What goes wrong:** Delete `src/scan/scanners/` directory, build fails because `src/index.ts` still exports `scanRedundancy`, `scanMechanization`, `scanStaleness`. Also `src/scan/index.ts` imports from `./scanners/index.js` and `tests/unit/scan/context-builder.test.ts` imports `Scanner` type from scanners.
**Why it happens:** Multiple files import from the scanner module, not just the orchestrator.
**How to avoid:** Use the complete import map from this research (see "Removal Impact Map" above). Build must pass after removal -- `npm run build` is the gate.
**Warning signs:** TypeScript compile errors mentioning missing modules.

### Pitfall 2: Breaking the Generators/Appliers

**What goes wrong:** Someone removes `scan_missing_mechanization` from the pattern_type enum "because the scanner is gone." The hook-generator then cannot handle model-driven findings that use this pattern type.
**Why it happens:** Confusing "scanner function removed" with "pattern type removed." The pattern types are OUTPUT categories, not tied to specific scanner implementations.
**How to avoid:** Keep ALL `scan_*` values in `patternTypeSchema`. The model produces findings with these exact pattern types. The generators/appliers consume them unchanged.
**Warning signs:** `store-findings` rejecting model findings with "invalid pattern_type."

### Pitfall 3: CLI init Regression

**What goes wrong:** `src/cli/init.ts` line 183 calls `runDeepScan()`. If `runDeepScan` is removed or returns empty recommendations, the post-init scan step silently stops working.
**Why it happens:** `init` has a "Scanning configuration..." step that runs the old code-based scan. After Phase 23, this needs a new strategy.
**How to avoid:** Either (a) have `init` call `buildScanContext()` and output a summary without analysis, or (b) remove the scan-on-init step entirely (scan is now via `/evolve:scan` only). Option (b) is cleaner.
**Warning signs:** `harness-evolve init` output changes or errors.

### Pitfall 4: E2E Test Loss Without Replacement

**What goes wrong:** `dirty-config-e2e.test.ts` is deleted (it asserts old scanner behavior) but no replacement integration test exists. The project loses its end-to-end validation of the scan pipeline.
**Why it happens:** Model-driven scan is invoked via slash command (interactive), not via programmatic API. Traditional E2E tests cannot invoke a Claude Code slash command.
**How to avoid:** Replace with: (a) `scan-context` CLI output validation (deterministic), (b) `store-findings` round-trip test (deterministic), (c) manual validation checklist for model-driven scan capability.
**Warning signs:** Test count drops dramatically without explanation.

### Pitfall 5: Scanner Unit Test Count Drop Alarm

**What goes wrong:** Test count drops from 734 to ~640 (losing ~94 tests). This looks like a regression to anyone tracking metrics.
**Why it happens:** 63 scanner unit tests + ~31 integration/E2E tests that depend on scanner code are removed.
**How to avoid:** Document the expected test count delta in PLAN.md. Add replacement tests (scan-context validation, store-findings pipeline, schema integrity) to partially offset.
**Warning signs:** If test count drops more than expected (~94), something beyond scanners was accidentally broken.

## Validation Test Configs

These are the concrete test configurations needed to validate each MODEL-* requirement.

### Config 1: Semantic Conflict (MODEL-01)

**Purpose:** Prove model detects semantic contradictions that regex opposition pairs miss.

```
CLAUDE.md:
  "This project uses ES modules exclusively. All imports must use import/export syntax.
   TypeScript is configured with module: esnext."

.claude/rules/compatibility.md:
  "## Compatibility
   For backward compatibility, configure tsconfig with module: commonjs.
   Use require() for dynamic imports in scripts."
```

**Why old scanner misses it:** `conflict.ts` checks 3 opposition pairs: always/never, enable/disable, require/forbid. "ES modules" vs "commonjs" has none of these keywords.

**Expected model finding:** Semantic conflict between ESM-only mandate and CommonJS configuration directive.

### Config 2: Cross-File Inconsistency (MODEL-02)

**Purpose:** Prove model can correlate information across multiple config files.

```
.claude/rules/testing.md:
  "## Testing
   Always run pytest before committing. Tests must pass."

.claude/settings.json:
  {
    "hooks": {
      "PreToolUse": [
        { "matcher": "Bash", "hooks": [
          { "type": "command", "command": "npm test" }
        ]}
      ]
    }
  }
```

**Why old scanner misses it:** No single scanner correlates a rule mentioning "pytest" (Python) with a hook running "npm test" (JavaScript). The mechanization scanner would see the rule is already mechanized (hooks exist) and suppress the finding. But the inconsistency (Python tests vs JS hook) is invisible.

**Expected model finding:** Cross-file inconsistency -- rule expects pytest (Python) but hook runs npm test (JavaScript).

### Config 3: Natural Language Hookable Operation (MODEL-03)

**Purpose:** Prove model detects hookable operations in varied phrasing beyond the 6 fixed regex patterns.

```
CLAUDE.md:
  "Code formatting must be verified automatically before any file is saved.
   Ensure the branch naming convention is enforced on every push.
   Type checking should never be skipped during development."
```

**Why old scanner misses it:** `mechanization.ts` uses 6 regex patterns: `/always\s+run/i`, `/before\s+committing/i`, `/before\s+saving/i`, `/after\s+every\s+edit/i`, `/must\s+always/i`, `/automatically\s+run/i`. The phrasing "must be verified automatically" and "should never be skipped" and "enforced on every push" do not match any of these patterns.

**Expected model finding:** 3 mechanization opportunities detected without keyword matching.

### Config 4: Guidance Extensibility (MODEL-04)

**Purpose:** Prove new scan areas can be added by editing the guidance .md alone.

**Method:** After Phase 22 delivers the guidance-embedded scan template, manually add an "Area 8: Documentation Coverage" section to the template:

```markdown
### Area 8: Documentation Coverage
**What to check:**
- Does the project have a README.md?
- Do rules files have meaningful descriptions?
- Are hook commands documented somewhere?

**Severity rules:**
- PROBLEM if no README.md exists
- SUGGESTION if hooks lack documentation
```

Then run `/evolve:scan` on a config without README.md. The model should produce a finding from this new area. No TypeScript code was changed.

**Validation approach:** This is a manual test that cannot be automated (requires model invocation). Document as a checklist item in verification.

## Code Examples

### Example 1: Simplified scan/index.ts After Scanner Removal

```typescript
// Deep scan context builder: reads config files and returns structured context.
// Scanner functions removed in v4.0 -- analysis is now model-driven via /evolve:scan.

import { buildScanContext } from './context-builder.js';
import type { ScanContext } from './schemas.js';

export interface ScanResult {
  generated_at: string;
  scan_context: ScanContext;
}

/**
 * Build scan context from Claude Code configuration at the given directory.
 * Returns raw context data for model-driven analysis.
 *
 * In v3.0, this function ran 7 code-based scanners. In v4.0, analysis
 * is performed by the model via /evolve:scan guidance docs.
 */
export async function buildScanResult(
  cwd: string,
  home?: string,
): Promise<ScanResult> {
  const scanContext = await buildScanContext(cwd, home);
  return {
    generated_at: new Date().toISOString(),
    scan_context: scanContext,
  };
}

// Re-export for consumers
export type { ScanContext } from './schemas.js';
```

### Example 2: Updated src/index.ts Exports

```typescript
// Phase 12: Deep Scan -- simplified after v4.0 scanner removal
export { buildScanResult } from './scan/index.js';
export type { ScanResult, ScanContext } from './scan/index.js';
export { scanContextSchema } from './scan/schemas.js';
export { buildScanContext } from './scan/context-builder.js';
// REMOVED: scanRedundancy, scanMechanization, scanStaleness exports
// REMOVED: Scanner type export (no longer exists)
```

### Example 3: Updated cli/init.ts Post-Init Scan

```typescript
// Replace runDeepScan with buildScanContext for post-init health check
import { buildScanContext } from '../scan/context-builder.js';

// In the init action:
try {
  console.log('\nScanning configuration...\n');
  const context = await buildScanContext(process.cwd());
  const totalFiles = context.claude_md_files.length + context.rules.length
    + context.commands.length;
  const hookCount = context.hooks_registered.length;
  console.log(`Found ${totalFiles} config file(s) and ${hookCount} hook(s).`);
  console.log('Run /evolve:scan for detailed analysis.\n');
} catch (err) {
  console.error(`Warning: Configuration scan failed: ${err instanceof Error ? err.message : String(err)}`);
}
```

### Example 4: Replacement Integration Test (scan-context + store-findings pipeline)

```typescript
// Integration test: scan-context outputs valid ScanContext, store-findings persists
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildScanContext } from '../../src/scan/context-builder.js';
import { scanContextSchema } from '../../src/scan/schemas.js';

describe('scan-context pipeline validation', () => {
  let tempDir: string;

  beforeEach(async () => { /* create temp config */ });
  afterEach(async () => { /* cleanup */ });

  it('buildScanContext produces schema-valid output with all config sections', async () => {
    // Create a rich config with CLAUDE.md, rules, settings, hooks, commands
    // Verify the output passes scanContextSchema.parse()
    // Verify hooks_registered includes nested-format hooks (BUG-01 fix)
  });

  it('pattern_type enum retains all scan_* values for model compatibility', () => {
    // Verify enum still contains all 7 scan_* pattern types
    // Model-driven findings use these; they must not be removed
  });

  it('generators handle scan_* pattern types from model findings', () => {
    // Create mock Recommendation with scan_missing_mechanization
    // Verify hook-generator produces valid output
    // Create mock with scan_stale_reference
    // Verify claude-md-generator produces valid output
  });
});
```

## State of the Art

| Old Approach (v3.0) | New Approach (v4.0 after Phase 23) | When Changed | Impact |
|----------------------|-------------------------------------|--------------|--------|
| 7 TypeScript regex scanners (904 LOC) | Model-driven analysis via guidance docs | Phase 23 | ~94 deterministic tests removed, replaced by schema validation + manual verification |
| `runDeepScan()` orchestrates scanners | `buildScanContext()` provides data only | Phase 23 | Callers (`cli/scan.ts`, `cli/init.ts`) must update |
| `dirty-config-e2e.test.ts` asserts 7 pattern_types | Schema validation + capability proof configs | Phase 23 | Non-deterministic model output cannot be E2E tested traditionally |
| Scanner exports in `src/index.ts` | Only context-builder exports | Phase 23 | Breaking API change (no external consumers) |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MODEL-01 | Semantic conflict detection | manual-only | Manual: run /evolve:scan on Config 1, verify finding | N/A -- model invocation |
| MODEL-02 | Cross-file inconsistency detection | manual-only | Manual: run /evolve:scan on Config 2, verify finding | N/A -- model invocation |
| MODEL-03 | Natural language hookable detection | manual-only | Manual: run /evolve:scan on Config 3, verify finding | N/A -- model invocation |
| MODEL-04 | Guidance extensibility | manual-only | Manual: add Area 8 to template, verify model scans it | N/A -- requires template edit + model |
| SCAN-03 | Legacy scanner removal + build passes | unit + build | `npx vitest run && npm run build` | Wave 0 (new tests needed) |

**Justification for manual-only MODEL tests:** MODEL-01 through MODEL-04 validate that a language model, when given guidance docs and config context, produces appropriate findings. This requires invoking the model through `/evolve:scan` slash command in a live Claude Code session. Vitest cannot invoke Claude Code slash commands. These are validated by running the slash command and inspecting output -- documented as a checklist.

### Sampling Rate

- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run && npm run build`
- **Phase gate:** Full suite green + manual MODEL checklist signed off before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/integration/scan-pipeline-v4.test.ts` -- scan-context schema validation, store-findings pipeline, pattern_type enum integrity, generator compatibility
- [ ] `tests/unit/scan/index.test.ts` -- rewrite to test simplified scan module (no scanners)
- [ ] Manual validation checklist (in PLAN.md) for MODEL-01 through MODEL-04

## Open Questions

1. **Should `runDeepScan` be removed entirely or kept as a thin wrapper?**
   - What we know: `cli/scan.ts` and `cli/init.ts` call it. If Phase 21 delivers `scan-context` CLI, the `scan` CLI becomes a deprecated wrapper.
   - What's unclear: Whether to keep backward compat or do a clean break.
   - Recommendation: Remove `runDeepScan` entirely. Replace `cli/scan.ts` with deprecation notice pointing to `/evolve:scan`. Replace `cli/init.ts` usage with `buildScanContext` summary. This is a breaking change for the `scan` CLI subcommand, but the model-driven `/evolve:scan` is the replacement path.

2. **How to handle the `dirty-config-e2e.test.ts` replacement?**
   - What we know: 10 scenarios, 535 LOC, all assert exact pattern_types from code scanners.
   - What's unclear: Whether to delete entirely or convert to scan-context validation.
   - Recommendation: Delete the existing file entirely. Create a new `scan-pipeline-v4.test.ts` that tests the deterministic parts: scan-context schema validity, store-findings round-trip, pattern_type enum integrity, generator/applier compatibility with scan_* types. This replaces the "does the pipeline work?" assurance without testing model output.

3. **Should the `scan` CLI subcommand be deprecated or removed?**
   - What we know: Phase 21 adds `scan-context` and `store-findings`. The old `scan` subcommand runs code-based scanners.
   - What's unclear: Whether external users depend on `npx harness-evolve scan`.
   - Recommendation: Keep `scan` subcommand but have it output a deprecation notice + the scan-context JSON. This preserves CLI behavior while redirecting to `/evolve:scan`.

## Sources

### Primary (HIGH confidence)

- Codebase analysis: all 7 scanner files, orchestrator, context-builder, CLI scan, CLI init, index.ts exports, recommendation schema, generators, appliers
- `tests/integration/dirty-config-e2e.test.ts` -- 10 E2E scenarios, exact assertion patterns documented
- `tests/unit/scan/scanners/*.test.ts` -- 7 unit test files, 63 tests, 1520 LOC total
- `src/schemas/recommendation.ts` -- pattern_type enum with 7 scan_* values
- `src/delivery/appliers/claude-md-applier.ts` -- DESTRUCTIVE_PATTERNS set references scan_stale_reference, scan_redundancy
- `src/generators/hook-generator.ts` -- references scan_missing_mechanization
- `src/generators/claude-md-generator.ts` -- switch on scan_stale_reference, scan_redundancy

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` -- Pitfalls 31-48 directly relevant to this phase
- `.planning/research/ARCHITECTURE.md` -- Component-level change plan and data flow diagrams
- `.planning/research/FEATURES.md` -- Guidance document inventory and GSD patterns

### Tertiary (LOW confidence)

- Phase 21/22 deliverables assumed but not yet built -- research assumes they deliver stated outputs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing
- Architecture: HIGH -- complete removal impact map built from codebase grep
- Pitfalls: HIGH -- derived from actual code analysis, not speculation
- Validation test configs: MEDIUM -- configs are designed but untested against model; require Phase 22 template

**Research date:** 2026-04-06
**Valid until:** 2026-04-20 (depends on Phase 21-22 delivering stated outputs)
