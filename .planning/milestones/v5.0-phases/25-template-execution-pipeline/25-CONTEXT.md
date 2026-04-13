# Phase 25: Template Execution Pipeline - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto-generated (--auto flag, all recommendations accepted)

<domain>
## Phase Boundary

Rewrite /evolve:scan and /evolve:apply slash command templates so the model reliably executes them as step-by-step instructions, producing consistent structured output. Covers TMPL-01 (scan pipeline execution), TMPL-02 (apply interactive flow), and TMPL-03 (first-scan vs subsequent-scan branching).

</domain>

<decisions>
## Implementation Decisions

### Template Structure & Imperative Language
- Rewrite scan template with strict imperative language: "EXECUTE this command", "DO NOT skip", "MANDATORY" markers
- Add a preamble section: "You are executing a pipeline. Follow each step exactly. Do not improvise or run commands not listed here."
- Reduce scan template from ~350 lines to ~250 lines by tightening prose while keeping all 7 analysis area checklists
- Each step ends with a verification check ("If the output shows X, proceed. Otherwise, stop and report error.")
- Bump both template versions from 4 to 5

### First-Scan vs Subsequent-Scan Detection
- Template instructs model to check `ls ~/.harness-evolve/analysis/pre-processed/summary.json 2>/dev/null` at the start
- If file absent (first scan): Only analyze configuration files using the 7 scan-context areas
- If file present (subsequent scan): Also read summary.json and include historical prompt pattern insights alongside config analysis
- The scan-context CLI itself is unchanged — branching is template-level logic only

### Apply Template Flow
- Strengthen "process ONE recommendation at a time" with explicit "DO NOT present multiple recommendations at once"
- Keep the existing 4-option flow (Apply/Skip/Dismiss/Let Claude decide) — it matches TMPL-02 exactly
- Add "After each decision, confirm the result before moving to the next recommendation"
- Keep the filter argument support (all/high/medium/low)

### Pipeline Error Handling
- Inline error handling per step (not a separate section at the bottom)
- scan-context failure → stop and report (no fallback)
- store-findings validation errors → show which fields failed, fix, re-pipe
- Apply failures → show error, offer skip/dismiss as alternatives

### Claude's Discretion
- Exact wording of imperative markers ("MANDATORY", "CRITICAL", etc.) is at Claude's discretion
- How to format the first-scan/subsequent-scan branching in the template (conditional sections vs separate flows)
- Whether to add `allowed-tools` changes or keep the existing `Bash(npx harness-evolve *)` pattern
- Any additional edge case handling beyond current coverage

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/commands/evolve-scan.ts` — Current scan template generator (v4, 351 lines)
- `src/commands/evolve-apply.ts` — Current apply template generator (v4, 196 lines)
- `src/cli/init.ts` — Template installation with version-aware updates (extractInstalledVersion regex)
- `src/storage/dirs.ts` — All file paths including `summary` at `~/.harness-evolve/analysis/pre-processed/summary.json`

### Established Patterns
- Templates are string literals returned by generator functions (generateScanCommand, generateApplyCommand)
- Template version tracked via `<!-- template-version: N -->` comment and TEMPLATE_VERSION const
- `init.ts` compares installed version vs current version to decide whether to update
- All scan output is structured JSON; human-readable summaries are model-generated at presentation time
- `disable-model-invocation: true` frontmatter ensures templates are treated as instructions

### Integration Points
- Template version change (4→5) will trigger auto-update on next `harness-evolve init`
- scan-context CLI output is the same — templates consume it differently based on first/subsequent scan
- store-findings CLI is unchanged — templates pipe the same JSON format
- Test files in `tests/` cover template generation, scan-context output, store-findings validation

</code_context>

<specifics>
## Specific Ideas

- TMPL-03 requires first-scan detection: the file `~/.harness-evolve/analysis/pre-processed/summary.json` is the historical data marker (produced by background analysis hooks after interaction threshold)
- Dogfooding revealed that the model sometimes runs `harness-evolve scan` (deprecated, now errors) or `harness-evolve pending` (during scan instead of apply) — template must explicitly list ONLY the allowed commands per step
- The `allowed-tools` frontmatter already restricts to `Bash(npx harness-evolve *)` — this is sufficient

</specifics>

<deferred>
## Deferred Ideas

- Missing SKILL and MEMORY appliers (not in Phase 25 scope — schema accepts them but apply-one will error; a future phase could add them)
- Template localization beyond English (current approach: JSON always English, summary can be localized)

</deferred>
