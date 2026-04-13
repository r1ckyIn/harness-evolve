# Phase 25: Template Execution Pipeline - Research

**Researched:** 2026-04-11
**Domain:** Claude Code slash command template authoring for model-driven pipeline execution
**Confidence:** HIGH

## Summary

Phase 25 rewrites the `/evolve:scan` and `/evolve:apply` slash command templates (v4 to v5) to make the model execute them as strict step-by-step pipelines rather than treating them as documentation it can freestyle from. The core challenge is prompt engineering: crafting imperative language, verification gates, and explicit command allowlists that constrain model behavior within the template.

The existing codebase has a clean, well-established pattern: templates are pure string-returning functions in `src/commands/evolve-scan.ts` and `src/commands/evolve-apply.ts`, version-tracked via `<!-- template-version: N -->` comments, and auto-updated by `init.ts` when the version bumps. No new libraries, CLIs, or infrastructure are needed. This is a pure template content rewrite within existing architecture.

The key technical insight from official Claude Code docs is that skill content (including slash commands) enters the conversation as a single message and stays there for the session. The `disable-model-invocation: true` frontmatter is already correctly set. The `allowed-tools` restriction to `Bash(npx harness-evolve *)` is the right pattern. The work is entirely about improving the instruction quality within these templates.

**Primary recommendation:** Rewrite both template generator functions with imperative pipeline language, inline verification gates per step, explicit "DO NOT" command lists per step, and first-scan/subsequent-scan branching in the scan template. Bump TEMPLATE_VERSION constants from 4 to 5. Update existing unit tests to match v5 assertions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Rewrite scan template with strict imperative language: "EXECUTE this command", "DO NOT skip", "MANDATORY" markers
- Add a preamble section: "You are executing a pipeline. Follow each step exactly. Do not improvise or run commands not listed here."
- Reduce scan template from ~350 lines to ~250 lines by tightening prose while keeping all 7 analysis area checklists
- Each step ends with a verification check ("If the output shows X, proceed. Otherwise, stop and report error.")
- Bump both template versions from 4 to 5
- Template instructs model to check `ls ~/.harness-evolve/analysis/pre-processed/summary.json 2>/dev/null` at the start
- If file absent (first scan): Only analyze configuration files using the 7 scan-context areas
- If file present (subsequent scan): Also read summary.json and include historical prompt pattern insights alongside config analysis
- The scan-context CLI itself is unchanged -- branching is template-level logic only
- Strengthen "process ONE recommendation at a time" with explicit "DO NOT present multiple recommendations at once"
- Keep the existing 4-option flow (Apply/Skip/Dismiss/Let Claude decide) -- it matches TMPL-02 exactly
- Add "After each decision, confirm the result before moving to the next recommendation"
- Keep the filter argument support (all/high/medium/low)
- Inline error handling per step (not a separate section at the bottom)
- scan-context failure -> stop and report (no fallback)
- store-findings validation errors -> show which fields failed, fix, re-pipe
- Apply failures -> show error, offer skip/dismiss as alternatives

### Claude's Discretion
- Exact wording of imperative markers ("MANDATORY", "CRITICAL", etc.) is at Claude's discretion
- How to format the first-scan/subsequent-scan branching in the template (conditional sections vs separate flows)
- Whether to add `allowed-tools` changes or keep the existing `Bash(npx harness-evolve *)` pattern
- Any additional edge case handling beyond current coverage

### Deferred Ideas (OUT OF SCOPE)
- Missing SKILL and MEMORY appliers (not in Phase 25 scope -- schema accepts them but apply-one will error; a future phase could add them)
- Template localization beyond English (current approach: JSON always English, summary can be localized)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TMPL-01 | `/evolve:scan` template is treated by the model as mandatory instructions, executing the 3-step pipeline (scan-context -> analyze -> store-findings) rather than free-styling or running legacy `pending` command | Rewrite with imperative preamble, per-step verification gates, explicit "ONLY run these commands" allowlists, and "DO NOT run harness-evolve scan or harness-evolve pending" blocklists |
| TMPL-02 | `/evolve:apply` template is executed as interactive 4-option flow (Apply/Skip/Dismiss/Let Claude decide), processing each pending recommendation one-by-one | Strengthen one-at-a-time processing with "DO NOT present multiple recommendations at once", add per-decision confirmation gates, inline error handling per step |
| TMPL-03 | First scan only analyzes configuration files without mixing in historical prompt pattern suggestions | Add branching logic at template start: `ls ~/.harness-evolve/analysis/pre-processed/summary.json` check determines whether to include historical data or config-only analysis |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Code comments must be in pure English (no Chinese, no bilingual)
- Use GSD workflow for all changes
- Commit message format: `<type>(<phase>-<plan>): <description>` (validated by hook)
- Do NOT add Co-Authored-By (hook will block)
- Verification loop: Build -> Test -> Lint -> TypeCheck after each code change
- Build command: `tsup` (via `npm run build`)
- Test command: `vitest run` (via `npm test`)

## Standard Stack

No new libraries needed. This phase modifies existing TypeScript string template generators.

### Core (Existing -- No Changes)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| TypeScript | ~6.0 | Type safety | Unchanged |
| tsup | ^8.5.1 | Bundle TypeScript | Unchanged |
| Vitest | ^4.1.2 | Unit/integration testing | Unchanged |

### Files Modified
| File | Purpose | Change Type |
|------|---------|-------------|
| `src/commands/evolve-scan.ts` | Scan template generator | Content rewrite + version bump |
| `src/commands/evolve-apply.ts` | Apply template generator | Content rewrite + version bump |
| `tests/unit/commands/templates.test.ts` | Template unit tests | Update assertions for v5 |

**No new dependencies. No `npm install` needed.**

## Architecture Patterns

### Existing Pattern: Template Generator Functions

The established pattern is pure functions returning template strings. This phase follows it exactly.

```typescript
// Source: src/commands/evolve-scan.ts (existing pattern)
const SCAN_TEMPLATE_VERSION = '5'; // Bump from '4'

export function getScanTemplateVersion(): string {
  return SCAN_TEMPLATE_VERSION;
}

export function generateScanCommand(): string {
  return `---
name: scan
description: Run a model-driven harness-evolve configuration analysis
disable-model-invocation: true
allowed-tools: Bash(npx harness-evolve *)
---
<!-- template-version: ${SCAN_TEMPLATE_VERSION} -->

... template content ...
`;
}
```

### Pattern: Template Version Auto-Update

`init.ts` already handles version comparison. When TEMPLATE_VERSION bumps from 4 to 5, the next `harness-evolve init` run will auto-update installed slash command files. No changes to `init.ts` needed.

```typescript
// Source: src/cli/init.ts (existing -- extractInstalledVersion)
// Regex: /<!-- template-version: (\d+) -->/
// Comparison: parseInt(installedVersion) < parseInt(currentVersion) -> overwrite
```

### Pattern: Imperative Template Structure (v5 New)

The v5 templates introduce a new structural pattern: imperative pipeline with verification gates.

```
PREAMBLE
  "You are executing a pipeline. Follow each step exactly."

BRANCHING GATE (scan only)
  Check for summary.json -> set mode (first-scan vs subsequent-scan)

STEP N: [Title]
  MANDATORY: [action description]
  Command: `npx harness-evolve <subcommand>`
  DO NOT: [explicit blocklist of wrong commands]
  Verification: "If output shows X, proceed. Otherwise, stop and report error."

ERROR HANDLING (inline per step, not bottom section)
```

### Anti-Patterns to Avoid
- **Separate error handling section at the bottom:** Moved inline per step in v5. Models ignore end-of-document error handling.
- **Suggestive language ("you may want to", "consider"):** Replace with imperative ("EXECUTE", "DO NOT", "MANDATORY").
- **Assuming model reads the full template before acting:** Each step must be self-contained with its own verification gate.
- **Listing deprecated commands anywhere in the template:** Even in "do not use" sections, models sometimes latch onto command names. Use explicit "ONLY use" allowlists rather than blocklists where possible.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template version tracking | Custom version comparison logic | Existing `extractInstalledVersion` + `installSlashCommands` in init.ts | Already battle-tested, handles edge cases |
| First-scan detection | Custom Node.js detection script | `ls ~/.harness-evolve/analysis/pre-processed/summary.json 2>/dev/null` in template | Template-level shell check is simpler, no CLI changes needed |
| CLI pipeline (scan-context, store-findings, pending, etc.) | Any new CLI subcommands | Existing CLI subcommands unchanged | Phase 24 already cleaned up the CLI; Phase 25 is template-only |

## Common Pitfalls

### Pitfall 1: Template Line Count Target vs Content Completeness
**What goes wrong:** Aggressively reducing from ~350 to ~250 lines removes important analysis area checklists, causing the model to miss scan categories.
**Why it happens:** Prose tightening can accidentally merge or remove area-specific "Do NOT Flag" and "Severity Rules" subsections.
**How to avoid:** Count lines after rewrite. Keep all 7 analysis areas with their 4 subsections (What to Check, Severity Rules, Confidence, Do NOT Flag). Tighten the non-area prose (prerequisites, error handling, output format, boundary conditions).
**Warning signs:** Template test `defines 7 analysis areas` or `each analysis area has What to Check subsection` failing.

### Pitfall 2: Test Assertions Hardcoded to Version 4
**What goes wrong:** Existing tests assert `<!-- template-version: 4 -->` and line count ranges. Version bump to 5 and line reduction to ~250 break these.
**Why it happens:** Tests were written for the v4 template structure.
**How to avoid:** Update version assertion tests first (change `4` to `5`), then update line count range (from `250-400` to the new target range), then rewrite template content.
**Warning signs:** `vitest run` fails on version or line count assertions immediately after bump.

### Pitfall 3: Model Latching onto Deprecated Command Names
**What goes wrong:** Including `harness-evolve scan` even in a "do not use" context causes the model to sometimes run it.
**Why it happens:** Models pattern-match on command strings regardless of surrounding negation context.
**How to avoid:** In the scan template, list ONLY the allowed commands per step (`npx harness-evolve scan-context`, `npx harness-evolve store-findings`). Do not mention the deprecated `scan` or `pending` subcommands at all, even as warnings.
**Warning signs:** Dogfooding shows model running `harness-evolve scan` or `harness-evolve pending` during `/evolve:scan`.

### Pitfall 4: First-Scan Detection Shell Command Failure
**What goes wrong:** The `ls` check for `summary.json` may behave differently across shells (bash, zsh, fish).
**Why it happens:** Different shells handle `2>/dev/null` differently, or the path expansion may fail.
**How to avoid:** Use a simple `ls` with explicit path and `2>/dev/null` redirect. The `allowed-tools: Bash(npx harness-evolve *)` already ensures the model uses Bash. The detection command itself is not a harness-evolve CLI call, so it should use a separate Bash call.
**Warning signs:** Template test should verify the detection command string is present in generated output.

### Pitfall 5: Apply Template "One at a Time" Enforcement
**What goes wrong:** Model presents all recommendations at once in a bulleted list, ignoring the one-at-a-time instruction.
**Why it happens:** Models tend to batch similar items for efficiency. Soft instructions like "present each one" are easily overridden.
**How to avoid:** Use explicit "MANDATORY: Present exactly ONE recommendation. Wait for user response before showing the next. DO NOT present multiple recommendations at once." Include the exact card format inline so the model doesn't need to improvise formatting.
**Warning signs:** Dogfooding shows model dumping all recommendations in one response.

## Code Examples

### Scan Template v5 Preamble Pattern
```typescript
// Pattern for the imperative preamble (exact wording is Claude's discretion)
`# Evolve Scan

> You are executing a pipeline. Follow each step exactly.
> Do not improvise, skip steps, or run commands not listed here.
> The ONLY commands you may run are: \`npx harness-evolve scan-context\` and \`npx harness-evolve store-findings\`.

## Step 0: Detect Scan Mode

MANDATORY: Determine whether this is a first scan or a subsequent scan.

\`\`\`bash
ls ~/.harness-evolve/analysis/pre-processed/summary.json 2>/dev/null
\`\`\`

- If the file DOES NOT exist: This is a **first scan**. Analyze configuration files only (Steps 1-4).
- If the file EXISTS: This is a **subsequent scan**. Read its contents and include historical insights alongside configuration analysis.
`
```

### Apply Template v5 One-at-a-Time Pattern
```typescript
// Pattern for enforcing sequential processing
`### Step 3: Present ONE Recommendation

MANDATORY: Present exactly ONE recommendation using the card format below.
DO NOT present multiple recommendations at once.
DO NOT summarize all recommendations before asking for decisions.

[Card format here]

### Step 4: Process User Decision

MANDATORY: Wait for user to choose 1-4.
After processing the choice, confirm the result.
ONLY THEN proceed to the next recommendation.
DO NOT batch multiple decisions.
`
```

### First-Scan vs Subsequent-Scan Branching
```typescript
// Two approaches for template branching (Claude's discretion on which to use):

// Approach A: Conditional sections with markers
`## Step 2: Analyze Configuration
// ... always-present analysis guidance ...

## Step 2b: Include Historical Insights (SUBSEQUENT SCAN ONLY)

If you determined in Step 0 that summary.json exists, ALSO read it now:
\`\`\`bash
cat ~/.harness-evolve/analysis/pre-processed/summary.json
\`\`\`
Include patterns from this historical data in your analysis alongside configuration findings.
If Step 0 determined this is a first scan, SKIP this step entirely.
`

// Approach B: Explicit fork in the flow
`If this is a FIRST SCAN (summary.json absent):
  - Proceed to Step 2-FIRST
If this is a SUBSEQUENT SCAN (summary.json present):
  - Proceed to Step 2-SUBSEQUENT
`
```

## State of the Art

| Old Approach (v4) | Current Approach (v5) | Why Changed |
|--------------------|-----------------------|-------------|
| Descriptive/suggestive language | Imperative pipeline with MANDATORY markers | Models treat soft instructions as suggestions |
| Error handling at bottom of template | Inline error handling per step | Models ignore end-of-document sections |
| No first-scan/subsequent-scan distinction | Branching gate at Step 0 | First scans were polluted with non-existent historical data |
| Implicit command allowlist via frontmatter only | Explicit per-step "ONLY run" + "DO NOT run" | Models sometimes ran deprecated commands |
| "Present each recommendation" | "Present exactly ONE... DO NOT present multiple" | Models batched recommendations despite soft instruction |

**Key insight from Claude Code docs (HIGH confidence):** Skill content enters the conversation as a single message and stays for the session. Auto-compaction carries invoked skills forward, keeping first 5,000 tokens. This means the preamble and early steps are most reliably retained. Critical instructions should be front-loaded.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/unit/commands/templates.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TMPL-01 | Scan template has imperative preamble, v5 version, 3-step pipeline commands, no deprecated commands | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "generateScanCommand"` | Exists (update needed) |
| TMPL-02 | Apply template has one-at-a-time enforcement, 4 options, v5 version, per-decision confirmation | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "generateApplyCommand"` | Exists (update needed) |
| TMPL-03 | Scan template contains first-scan detection command (ls summary.json), branching logic | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "generateScanCommand"` | Exists (update needed) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/unit/commands/templates.test.ts`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Update `tests/unit/commands/templates.test.ts` -- existing tests assert v4-specific content (version `4`, line count `250-400`). Must update to v5 assertions.
- [ ] Add new test cases for: imperative preamble presence, first-scan detection command, DO NOT markers, per-step verification gates, one-at-a-time enforcement text, inline error handling.

## Open Questions

1. **Exact `allowed-tools` for first-scan detection**
   - What we know: The `allowed-tools: Bash(npx harness-evolve *)` frontmatter restricts to harness-evolve CLI commands. The `ls` and `cat` commands for summary.json detection are not harness-evolve commands.
   - What's unclear: Whether the model can run `ls` and `cat` via Bash without them matching the `allowed-tools` pattern. The `allowed-tools` field grants permission without prompting but does NOT restrict which tools are available (confirmed from official docs).
   - Recommendation: Keep `allowed-tools: Bash(npx harness-evolve *)` as-is. The model can still run `ls` and `cat` -- it just needs user permission for those. OR add `Bash(ls *) Bash(cat *)` to the allowed-tools list. This is in Claude's discretion per CONTEXT.md.

2. **Line count target achievability**
   - What we know: Current scan template is ~320 lines of content (351 lines including TS wrapper). Target is ~250 lines of content.
   - What's unclear: Whether keeping all 7 analysis areas with 4 subsections each while adding branching logic and verification gates can fit in ~250 lines.
   - Recommendation: Prioritize content completeness over line count. If the template lands at 260-270 lines with all required content, that's acceptable. The spirit of the reduction is tighter prose, not cutting content.

## Sources

### Primary (HIGH confidence)
- [Claude Code Slash Commands / Skills Documentation](https://code.claude.com/docs/en/slash-commands) -- Frontmatter reference, allowed-tools semantics, disable-model-invocation behavior, skill content lifecycle (auto-compaction keeps first 5,000 tokens)
- Source code: `src/commands/evolve-scan.ts` (v4 scan template, 351 lines)
- Source code: `src/commands/evolve-apply.ts` (v4 apply template, 196 lines)
- Source code: `src/cli/init.ts` (version-aware template update mechanism)
- Source code: `src/storage/dirs.ts` (paths.summary = `~/.harness-evolve/analysis/pre-processed/summary.json`)
- Source code: `src/cli/store-findings.ts` (stdin JSON validation and persistence)
- Source code: `src/cli/apply.ts` (pending, apply-one, dismiss subcommands)
- Source code: `src/cli/scan.ts` (removed scan subcommand, hard error in v5.0)
- Source code: `tests/unit/commands/templates.test.ts` (existing v4 test assertions)

### Secondary (MEDIUM confidence)
- [GitHub Issue #26251](https://github.com/anthropics/claude-code/issues/26251) -- Known bug where `disable-model-invocation: true` prevented even user-invoked execution; confirms the field is active and respected

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries, purely template content changes in existing files
- Architecture: HIGH - Pattern established in v4, v5 follows identical structure
- Pitfalls: HIGH - Based on dogfooding observations documented in CONTEXT.md and known LLM prompt engineering patterns

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable -- no external dependency changes expected)
