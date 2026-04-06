# Phase 20: Scanner UX & Coverage Polish - Research

**Researched:** 2026-04-06
**Domain:** CLI UX, scan output formatting, slash command templates, integration testing
**Confidence:** HIGH

## Summary

Phase 20 addresses 4 UX issues discovered during Phase 19.1 live dogfooding (OBS-1 through OBS-4 in the integration report). All 4 issues are well-scoped modifications to existing code with no new dependencies required. The codebase has 708 passing tests, 7 scanners, 2 slash command templates, and a clean architecture that makes all changes straightforward.

**UX-01** (English scan output) is a slash command template change -- the scan template must instruct Claude to present findings in English regardless of session language. The CLI itself already outputs JSON; it is Claude's rendering that follows session language. **UX-02** (interactive apply options) is also a template change -- the apply template must specify numbered option format (1/2/3/4) instead of the current free-form "Choose: [Apply] [Skip] [Dismiss]". **UX-03** (areas-scanned summary) requires modifying the CLI scan output to include scanner metadata (total scanners run, areas with findings). **UX-04** (E2E dirty-config test) requires a new integration test that constructs intentionally broken config triggering multiple scanner types.

**Primary recommendation:** All 4 changes are localized. UX-01 and UX-02 are template text changes (bump template version). UX-03 is a small addition to `src/cli/scan.ts` output format. UX-04 is a new test file in `tests/integration/`. No schema changes or new dependencies needed.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Scan output defaults to English regardless of Claude Code session language | Template text change in `src/commands/evolve-scan.ts` -- add explicit "Always present results in English" instruction in Output Format section |
| UX-02 | `/evolve:apply` presents numbered options (apply/skip/dismiss/let Claude decide) with interactive selection | Template text change in `src/commands/evolve-apply.ts` -- replace free-form "Choose: [Apply] [Skip] [Dismiss]" with numbered option format |
| UX-03 | Scan output includes summary line with scanner count and areas-with-findings count | Code change in `src/cli/scan.ts` -- add `scanner_count`, `areas_scanned`, `areas_with_findings` to JSON output |
| UX-04 | E2E dirty-config integration test validates all 7 scanners detect issues | New test file `tests/integration/dirty-config-e2e.test.ts` -- constructs intentionally broken config triggering all 7 pattern types |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Code comments MUST be in pure English (no Chinese, no bilingual)
- Technical discussion in Chinese, code in English
- Vitest for testing, Zod for validation, TypeScript ~6.0
- Test with `npx vitest run`
- Build with `npm run build`
- GSD workflow enforcement -- all changes through GSD commands

## Standard Stack

No new dependencies required. Phase 20 uses the existing stack exclusively:

### Core (existing, no changes)
| Library | Version | Purpose | Phase 20 Usage |
|---------|---------|---------|----------------|
| TypeScript | ~6.0 | Type safety | Type the new summary fields |
| Vitest | ^4.1.2 | Testing | UX-04 E2E test |
| Zod | ^4.3.6 | Schema validation | Existing recommendation schema unchanged |
| Commander.js | ^14.0.3 | CLI framework | Existing scan subcommand |

### No New Dependencies
Phase 20 is purely code/template changes using existing infrastructure. No `npm install` needed.

## Architecture Patterns

### Current Scan Architecture (unchanged)
```
src/
├── cli/
│   ├── scan.ts              # UX-03: Add summary fields to JSON output
│   └── apply.ts             # No changes (apply-one/pending/dismiss untouched)
├── commands/
│   ├── evolve-scan.ts       # UX-01: Add English-only instruction to template
│   └── evolve-apply.ts      # UX-02: Replace free-form with numbered options
├── scan/
│   ├── index.ts             # UX-03: Return scanner metadata from runDeepScan
│   ├── context-builder.ts   # No changes
│   ├── schemas.ts           # No changes
│   └── scanners/
│       ├── index.ts          # UX-03: Export scanner names/count
│       ├── redundancy.ts     # UX-04: E2E test triggers this
│       ├── mechanization.ts  # UX-04: E2E test triggers this
│       ├── staleness.ts      # UX-04: E2E test triggers this
│       ├── conflict.ts       # UX-04: E2E test triggers this
│       ├── structure.ts      # UX-04: E2E test triggers this
│       ├── hooks-redundancy.ts # UX-04: E2E test triggers this
│       └── commands.ts       # UX-04: E2E test triggers this
tests/
├── integration/
│   └── dirty-config-e2e.test.ts  # UX-04: New file
└── unit/
    ├── cli/scan.test.ts          # UX-03: Add summary field assertions
    └── commands/templates.test.ts # UX-01, UX-02: Template content assertions
```

### Pattern 1: Scan Summary Metadata (UX-03)

**What:** Add scanner execution metadata to the CLI scan JSON output.

**Current output shape:**
```typescript
{
  generated_at: string;
  recommendation_count: number;
  problems: Recommendation[];
  suggestions: Recommendation[];
  recommendations: Recommendation[];
}
```

**New output shape (backward compatible addition):**
```typescript
{
  generated_at: string;
  recommendation_count: number;
  scanner_summary: {
    total_scanners: number;        // Always 7 (current registry size)
    scanners_with_findings: number; // How many produced at least 1 recommendation
    areas_scanned: string[];       // Names of all scanner areas
    areas_with_findings: string[]; // Names of areas that found issues
  },
  problems: Recommendation[];
  suggestions: Recommendation[];
  recommendations: Recommendation[];
}
```

**How to implement:** The scan orchestrator (`src/scan/index.ts`) must track per-scanner results. Two approaches:

**Approach A (recommended -- minimal change):** Modify `runDeepScan` to return per-scanner metadata. Change the scanner loop to track which scanners produced results:

```typescript
// In src/scan/index.ts
export interface ScannerMeta {
  name: string;
  finding_count: number;
}

export interface ScanResult {
  generated_at: string;
  scan_context: ScanContext;
  recommendations: Recommendation[];
  scanner_meta: ScannerMeta[];  // NEW
}
```

**Approach B (even simpler -- derive in CLI):** Leave `runDeepScan` unchanged. In `src/cli/scan.ts`, derive the summary from the `pattern_type` field on recommendations. Each scanner uses a unique pattern_type prefix:

```typescript
// Pattern type -> scanner area name mapping
const SCANNER_AREAS: Record<string, string> = {
  'scan_redundancy': 'redundancy',
  'scan_missing_mechanization': 'mechanization',
  'scan_stale_reference': 'staleness',
  'scan_rule_conflict': 'conflicts',
  'scan_structure_issue': 'structure',
  'scan_hooks_redundancy': 'hooks',
  'scan_command_convention': 'commands',
};
const TOTAL_SCANNERS = 7;
const areasWithFindings = new Set(
  sorted.map(r => SCANNER_AREAS[r.pattern_type]).filter(Boolean)
);
```

**Recommendation: Use Approach A.** It is cleaner and keeps the scan orchestrator as the single source of truth about scanner execution. Approach B silently breaks if a scanner produces a recommendation with an unexpected pattern_type.

### Pattern 2: Template Language Instruction (UX-01)

**What:** Add explicit English-language instruction to the scan template.

**Where the problem occurs:** The `/evolve:scan` template instructs Claude to "Present the results using the exact Output Format". Claude follows this, but when the session language is Chinese, Claude renders the markdown sections in Chinese (translating "Problems", "Suggestions", etc.). The JSON output from the CLI is already in English -- it is purely Claude's rendering that adapts to session language.

**Fix:** Add a single line in the Output Format section:

```markdown
## Output Format

**IMPORTANT: Always present scan results in English, regardless of the user's session language.**
```

This is the standard Claude Code pattern for slash commands that need consistent output language.

### Pattern 3: Numbered Interactive Options (UX-02)

**What:** Replace free-form text options with numbered selection in the apply template.

**Current template (Step 4):**
```markdown
Choose: [Apply] [Skip] [Dismiss]
```

**Problem:** Claude presents this as a free-form question ("What would you like to do?"), which requires the user to type "Apply" or "Skip". The user expects numbered options like GSD workflow uses.

**New template (Step 4):**
```markdown
Present the options as a numbered list. Ask the user to respond with a number:

1. **Apply** -- Execute this recommendation now
2. **Skip** -- Leave it pending for later
3. **Dismiss** -- Permanently remove this recommendation
4. **Let Claude decide** -- Apply if HIGH confidence, skip if MEDIUM/LOW

User responds with a number (1-4). If the user responds with text instead of a number, map it to the closest option.
```

**Option 4 ("Let Claude decide")** is from OBS-2 in the integration report -- the user mentioned wanting this as a fourth option. It adds real value: Claude can auto-apply HIGH confidence items without user friction.

### Pattern 4: E2E Dirty Config Test (UX-04)

**What:** Create a test that constructs intentionally broken Claude Code configuration and verifies that `runDeepScan` detects issues from ALL 7 scanner types.

**Key insight:** The existing integration test (`tests/integration/cli-scan.test.ts`) only tests redundancy, staleness, structure, and hooks-redundancy. It does NOT cover conflict, mechanization, or commands scanners. This is exactly the gap OBS-4 identified.

**How to trigger each scanner:**

| Scanner | Pattern Type | Trigger Config |
|---------|-------------|----------------|
| 1. Redundancy | `scan_redundancy` | CLAUDE.md heading "## Git Rules" + rule file with same heading |
| 2. Mechanization | `scan_missing_mechanization` | Rule with "always run lint" text but NO PreToolUse hook registered |
| 3. Staleness | `scan_stale_reference` | CLAUDE.md with `@docs/missing.md` reference to non-existent file |
| 4. Conflict | `scan_rule_conflict` | CLAUDE.md "always use TypeScript" + rule "never use TypeScript" |
| 5. Structure | `scan_structure_issue` | Empty rule file (0 bytes) |
| 6. Hooks redundancy | `scan_hooks_redundancy` | settings.json with duplicate hook (same event, same scope, same command) |
| 7. Commands | `scan_command_convention` | Empty command file in .claude/commands/ |

**Test structure:** Use temp directories (same pattern as existing integration tests), write all 7 trigger files, run `runDeepScan`, assert all 7 `pattern_type` values appear in results.

### Anti-Patterns to Avoid

- **Modifying the Recommendation schema for UX-03:** The summary is a scan-level concept, not a per-recommendation field. Add it to `ScanResult` or derive it in the CLI.
- **Hardcoding scanner count:** Use `scanners.length` from the registry, not a magic number 7. This future-proofs for new scanners.
- **Breaking backward compatibility in scan JSON:** The existing fields (`problems`, `suggestions`, `recommendations`) must remain. Add `scanner_summary` as a new top-level field.
- **Making the dirty-config test depend on file paths:** Use `mkdtemp` and write files programmatically (same pattern as existing integration tests). Never reference real user config.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scanner name mapping | Manual string mapping in CLI | Export names from scanner registry | Registry is the source of truth |
| Temp directory management | Manual mkdir/cleanup | `mkdtemp` + `afterEach` cleanup (existing pattern) | Already established in integration tests |
| Language enforcement | Custom locale detection | Template instruction to Claude | Claude follows explicit instructions; no runtime code needed |

## Common Pitfalls

### Pitfall 1: Template Version Not Bumped
**What goes wrong:** Changed template content but forgot to increment `SCAN_TEMPLATE_VERSION` / `APPLY_TEMPLATE_VERSION`. Users who already have the old template installed will not get the update on next `init`.
**Why it happens:** Template versioning is a manual string constant.
**How to avoid:** Increment version constant in EVERY commit that changes template content. Current versions: scan=2, apply=2.
**Warning signs:** `init` runs without updating templates despite content changes.

### Pitfall 2: E2E Test Triggers Too Few Scanners
**What goes wrong:** The dirty-config test appears to cover all 7 scanners but actually only triggers 5 because some trigger conditions are subtle (e.g., mechanization requires specific regex matches AND no hooks registered for the event).
**How to avoid:** Assert `pattern_type` count explicitly -- require exactly 7 unique pattern types in the result. If a scanner is NOT triggered, the test fails loudly.
**Warning signs:** Test passes but `pattern_type` set has fewer than 7 entries.

### Pitfall 3: Scanner Summary Breaks Slash Command Template
**What goes wrong:** Adding new fields to scan JSON output, but the slash command template's "Output Format" section doesn't mention them. Claude ignores the summary data.
**How to avoid:** Update BOTH `src/cli/scan.ts` (JSON output) AND `src/commands/evolve-scan.ts` (template Output Format section) to include the summary line.
**Warning signs:** Running `/evolve:scan` shows findings but no summary line.

### Pitfall 4: Conflict Scanner Regex Sensitivity
**What goes wrong:** The conflict scanner's opposition pair regexes require specific keyword patterns. A dirty-config test file that says "use TypeScript" won't trigger the conflict scanner -- it needs "always use TypeScript" (the regex is `\b(?:always|must)\s+(?:use|allow|always)\s+(\S+)`).
**Why it happens:** The opposition pair regex has intermediate verb groups.
**How to avoid:** Check the actual regex in `src/scan/scanners/conflict.ts` and craft test content that matches.
**Warning signs:** Conflict pattern_type missing from E2E test results.

## Code Examples

### UX-01: English Language Instruction (add to evolve-scan.ts template)

```typescript
// In the Output Format section of generateScanCommand(), add before the summary line:
`
## Output Format

**IMPORTANT: Always present scan results in English, regardless of the user's session language or locale. All section headings, labels, and descriptions must be in English.**

Start with a summary line:
`
```

### UX-02: Numbered Options (replace Step 4 in evolve-apply.ts template)

```typescript
// Replace the current "Choose: [Apply] [Skip] [Dismiss]" with:
`
### Step 4: Ask User to Choose

For each recommendation, present numbered options:

**Choose an action:**
1. Apply -- Execute this recommendation
2. Skip -- Leave pending for later
3. Dismiss -- Permanently remove
4. Let Claude decide -- Apply if HIGH confidence, skip otherwise

Wait for the user to respond with a number (1-4). If user types text, map to closest option.
`
```

### UX-03: Scanner Summary in CLI Output

```typescript
// In src/scan/index.ts, modify ScanResult:
export interface ScannerMeta {
  name: string;
  finding_count: number;
}

export interface ScanResult {
  generated_at: string;
  scan_context: ScanContext;
  recommendations: Recommendation[];
  scanner_meta: ScannerMeta[];
}

// In the runDeepScan function loop:
const scannerMeta: ScannerMeta[] = [];
for (let i = 0; i < scanners.length; i++) {
  const scanner = scanners[i];
  const name = scannerNames[i]; // Export from scanners/index.ts
  try {
    const result = await scanner(scanContext);
    recommendations.push(...result);
    scannerMeta.push({ name, finding_count: result.length });
  } catch (err) {
    console.error(`Scanner error (${name}): ${err instanceof Error ? err.message : String(err)}`);
    scannerMeta.push({ name, finding_count: 0 });
  }
}
```

### UX-03: Scanner Summary in CLI scan.ts Output

```typescript
// In src/cli/scan.ts, add scanner_summary to output:
const scannersWithFindings = result.scanner_meta.filter(s => s.finding_count > 0);
const output = {
  generated_at: result.generated_at,
  recommendation_count: sorted.length,
  scanner_summary: {
    total_scanners: result.scanner_meta.length,
    scanners_with_findings: scannersWithFindings.length,
    areas_scanned: result.scanner_meta.map(s => s.name),
    areas_with_findings: scannersWithFindings.map(s => s.name),
  },
  problems,
  suggestions,
  recommendations: sorted,
};
```

### UX-03: Update Scan Template to Show Summary

```typescript
// In evolve-scan.ts template, update Output Format:
`
Start with a scanner coverage summary line:

> **X** scanners checked, **Y** issue(s) in **Z** area(s).

Where X = scanner_summary.total_scanners, Y = recommendation_count, Z = scanner_summary.scanners_with_findings.

Then show:

> Found **P** problem(s) and **S** suggestion(s).
`
```

### UX-04: E2E Dirty Config Test Structure

```typescript
// tests/integration/dirty-config-e2e.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runDeepScan } from '../../src/scan/index.js';

let tempDir: string;
let fakeHome: string;

beforeEach(async () => {
  const base = await mkdtemp(join(tmpdir(), 'dirty-config-e2e-'));
  tempDir = join(base, 'project');
  fakeHome = join(base, 'home');
  await mkdir(tempDir, { recursive: true });
  await mkdir(join(fakeHome, '.claude'), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  await rm(fakeHome, { recursive: true, force: true }).catch(() => {});
});

describe('E2E dirty config -- all 7 scanners detect issues', () => {
  it('detects issues from all 7 scanner types in one pass', async () => {
    // 1. Redundancy: duplicate heading in CLAUDE.md and rule
    await writeFile(join(tempDir, 'CLAUDE.md'), [
      '# Project Config',
      '',
      '## Git Rules',
      'Always use TypeScript',  // Also triggers conflict with rule below
      'See @docs/missing-file.md for details.',  // Triggers staleness
      'Before committing, run lint',  // Triggers mechanization (no PreToolUse hook)
    ].join('\n'));

    // 2. Rules dir with triggers
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    // Redundancy: same heading as CLAUDE.md
    await writeFile(join(tempDir, '.claude', 'rules', 'git-rules.md'),
      '## Git Rules\nNever use TypeScript\n'); // Conflict: "never use" vs "always use"
    // Structure: empty rule file
    await writeFile(join(tempDir, '.claude', 'rules', 'empty.md'), '');

    // 3. Settings with duplicate hooks
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    await writeFile(join(tempDir, '.claude', 'settings.json'), JSON.stringify({
      hooks: {
        Stop: [
          { type: 'command', command: 'node analyze.js' },
          { type: 'command', command: 'node analyze.js' },
        ],
      },
    }));

    // 4. Commands: empty command file
    await mkdir(join(tempDir, '.claude', 'commands'), { recursive: true });
    await writeFile(join(tempDir, '.claude', 'commands', 'broken.md'), '');

    const result = await runDeepScan(tempDir, fakeHome);

    // Collect all unique pattern_types
    const patternTypes = new Set(result.recommendations.map(r => r.pattern_type));

    // Must have findings from all 7 scanners
    expect(patternTypes.has('scan_redundancy')).toBe(true);
    expect(patternTypes.has('scan_missing_mechanization')).toBe(true);
    expect(patternTypes.has('scan_stale_reference')).toBe(true);
    expect(patternTypes.has('scan_rule_conflict')).toBe(true);
    expect(patternTypes.has('scan_structure_issue')).toBe(true);
    expect(patternTypes.has('scan_hooks_redundancy')).toBe(true);
    expect(patternTypes.has('scan_command_convention')).toBe(true);

    expect(patternTypes.size).toBe(7);
  });
});
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/unit/cli/scan.test.ts -x` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UX-01 | Scan template contains English-only instruction | unit | `npx vitest run tests/unit/commands/templates.test.ts -x` | Exists (needs new assertion) |
| UX-02 | Apply template contains numbered option format | unit | `npx vitest run tests/unit/commands/templates.test.ts -x` | Exists (needs new assertion) |
| UX-03 | Scan CLI output includes scanner_summary field | unit | `npx vitest run tests/unit/cli/scan.test.ts -x` | Exists (needs new assertion) |
| UX-03b | runDeepScan returns scanner_meta array | unit | `npx vitest run tests/unit/scan/index.test.ts -x` | Exists (needs new assertion) |
| UX-04 | E2E dirty config triggers all 7 scanner types | integration | `npx vitest run tests/integration/dirty-config-e2e.test.ts -x` | Wave 0 (create) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/cli/scan.test.ts tests/unit/commands/templates.test.ts -x`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/integration/dirty-config-e2e.test.ts` -- covers UX-04 (all 7 scanners)
- No framework install needed -- Vitest already configured and passing

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Free-form apply options | Numbered interactive selection | Phase 20 (now) | Better UX for option selection |
| No scanner summary | Scanner coverage metadata in output | Phase 20 (now) | Users see what was checked, not just what was found |
| Language follows session | Explicit English instruction | Phase 20 (now) | Consistent output across locales |

## Open Questions

1. **"Let Claude decide" option scope**
   - What we know: User requested this in OBS-2. HIGH confidence items are generally safe to auto-apply.
   - What's unclear: Should "Let Claude decide" auto-apply MEDIUM items too, or only HIGH?
   - Recommendation: Only HIGH for safety. MEDIUM items get skipped with a note. This is the conservative path.

2. **Scanner names for summary**
   - What we know: Scanner registry (`src/scan/scanners/index.ts`) exports functions but not names.
   - What's unclear: Whether to add a name property to each scanner function, or maintain a parallel names array.
   - Recommendation: Export a parallel `scannerNames` array alongside the `scanners` array. Simpler than refactoring all 7 scanner signatures. Keep them co-located in the same file for maintenance.

## Sources

### Primary (HIGH confidence)
- `src/cli/scan.ts` -- Current scan CLI output format (JSON, no summary)
- `src/scan/index.ts` -- Scan orchestrator, ScanResult interface
- `src/scan/scanners/index.ts` -- Scanner registry (7 scanners)
- `src/commands/evolve-scan.ts` -- Scan slash command template (version 2)
- `src/commands/evolve-apply.ts` -- Apply slash command template (version 2)
- `src/scan/scanners/*.ts` -- All 7 scanner implementations (verified trigger conditions)
- `tests/integration/cli-scan.test.ts` -- Existing integration test pattern
- `.planning/phases/19.1-developer-full-integration-testing/19.1-INTEGRATION-REPORT.md` -- OBS-1 through OBS-4 observations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing code
- Architecture: HIGH -- all 4 changes are well-scoped to known files
- Pitfalls: HIGH -- verified scanner trigger conditions against actual regex patterns
- E2E test design: HIGH -- verified trigger conditions for each of the 7 scanners by reading source

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- internal project, no external dependency changes)
