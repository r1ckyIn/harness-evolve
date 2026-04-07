# Domain Pitfalls

**Domain:** Migrating code-based scanners to model-driven analysis (Claude Code configuration audit)
**Researched:** 2026-04-06 (v4.0 milestone -- model-driven scanner migration)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or total regression of existing functionality.

---

### Pitfall 31: The Hybrid Boundary Problem -- Removing Code Scanners Before Model-Driven Ones Are Proven

**What goes wrong:** The team removes or guts the 7 existing code-based scanners (redundancy, mechanization, staleness, conflict, structure, hooks-redundancy, commands) to "replace" them with model-driven analysis. The model-driven analysis is not ready, or produces inconsistent results. 734 tests now have nothing to assert against because the code path they tested no longer exists.

**Why it happens:** The architecture change (ARCH-01 in TODOS.md) recommends replacing hardcoded scanners with Claude-driven analysis. The natural impulse is "out with the old, in with the new." But the existing scanners, despite their limitations (BUG-01 proves fragility), produce deterministic, testable, sub-second results. Model-driven analysis is probabilistic, latency-sensitive, and untestable with traditional assertions.

**Consequences:**
- 734 tests become meaningless or must be deleted
- E2E dirty-config test (`dirty-config-e2e.test.ts`) loses its foundation -- it asserts exact `pattern_type` strings from 7 specific scanners
- Users who upgrade from v3.0 to v4.0 lose the reliable, fast scan they depend on
- If model-driven analysis fails (rate limit, offline, wrong model), users get zero analysis instead of partial analysis

**Prevention:**
1. **Keep code-based scanners as the baseline layer.** They run first, always, deterministically. Model-driven analysis runs second as an enhancement layer that can add findings the code-based scanners miss (semantic conflicts, nuanced staleness, etc.)
2. **Do not modify the `Scanner` type signature** (`(context: ScanContext) => Recommendation[]`). The model-driven layer produces the same `Recommendation[]` output through a different path.
3. **Test strategy:** Existing 734 tests continue testing code-based scanners unchanged. New tests for model-driven analysis use schema validation (structure correct?) + golden-file comparison (output within expected range?) rather than exact-match assertions.
4. **Feature flag:** `--model-scan` or `--enhanced` flag for model-driven scan. Users opt in. Code-based scan remains the default until model-driven proves stable across >= 50 real-world configs.

**Detection:** If `runDeepScan` returns zero recommendations on a config that v3.0 would have flagged, the migration broke something.

**Severity:** Critical
**Phase relevance:** Must be the architectural decision in Phase 1 of v4.0 -- hybrid, not replacement.

---

### Pitfall 32: Model Output Format Drift -- Different Models Produce Different JSON Structures

**What goes wrong:** The `/evolve:scan` template tells Claude to produce structured analysis output. This works perfectly with Claude Sonnet 4.5 during development. Then a user runs it with Claude Haiku 3.5 (cheaper, faster, smaller context). Haiku omits fields, changes severity labels from "problem" to "issue," renames JSON keys, or wraps the output in explanatory prose instead of clean JSON.

**Why it happens:** Claude Code users run different models depending on their subscription tier, cost preferences, and session settings. The slash command template is a natural language instruction -- it cannot enforce a JSON schema at the sampling level the way the API's `strict: true` tool use can. Slash commands execute via model inference, not constrained decoding.

**Consequences:**
- CLI `harness-evolve scan` parses the model's output as JSON. If the JSON is malformed or has unexpected keys, the parse fails silently or crashes.
- `recommendationSchema.parse()` (Zod v4) rejects recommendations missing required fields (`pattern_type`, `confidence`, `severity`). Users see zero results instead of partial results.
- Inconsistency across users: the same config produces different findings depending on which model they use.

**Prevention:**
1. **Do not rely on the model to produce raw `Recommendation[]` JSON.** Instead, have the model output a simplified analysis format (human-readable findings list) and use code to convert model findings into validated `Recommendation` objects.
2. **Provide explicit JSON schema in the template** with field-by-field descriptions and a concrete example. Research shows providing a complete example reduces format drift by ~80% across model sizes.
3. **Validate with Zod and graceful degradation.** If a finding fails schema validation, log the failure and skip that finding rather than aborting the entire scan. Output: "7 findings detected, 5 passed validation, 2 skipped due to format issues."
4. **Pin minimum model capability.** Document that model-driven scan requires Claude Sonnet 4 or better. If the active model is below this threshold, skip model-driven analysis and fall back to code-based only.
5. **Use `disable-model-invocation: true` on scan template** (already done in v3.0) so the scan only runs when explicitly invoked, preventing auto-invocation with unexpected model contexts.

**Detection:** Add a validation pass rate metric to scanner_meta: `{ model_findings: 7, valid_findings: 5, validation_failures: 2 }`.

**Severity:** Critical
**Phase relevance:** Template design phase. Must be addressed before any model-driven scanning ships.

**Sources:**
- [LLM Structured Output in 2026](https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk) (MEDIUM confidence)
- [The guide to structured outputs and function calling with LLMs](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms) (MEDIUM confidence)
- [Structured outputs - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) (HIGH confidence)

---

### Pitfall 33: Template Bloat Degrades Scan Quality -- The "Lost in the Middle" Effect

**What goes wrong:** The scan guidance document grows to 2000+ lines as developers add checklists, severity definitions, output format specs, edge case handling, and examples for all 7 scanner domains. The model's attention degrades on the actual config analysis because the instructions themselves consume a disproportionate share of the context window. Research shows LLM accuracy drops 30%+ when critical information sits in the middle of a long context.

**Why it happens:** Each scanner domain (redundancy, mechanization, staleness, conflict, structure, hooks, commands) needs its own checklist. Adding examples, edge cases, and severity rubrics for each domain easily reaches 200-300 lines per domain. 7 domains x 250 lines = 1,750 lines of guidance. Plus output format, error handling, and general instructions adds another 300-500 lines.

**Consequences:**
- Claude Code's slash command character budget is 1% of context window (fallback: 8,000 characters). A 2000-line template could exceed 40,000 characters, blowing past the budget and getting truncated.
- Even if loaded, the "lost in the middle" effect means the model gives disproportionate attention to the beginning (general instructions) and end (output format) while neglecting middle sections (specific scanner checklists for domains 3-5).
- Template exceeding budget causes Claude to truncate skill descriptions, potentially hiding the scan skill from auto-discovery entirely.

**Prevention:**
1. **Progressive disclosure architecture.** Keep `SKILL.md` (the scan template) under 500 lines focused on orchestration: what to do, output format, error handling. Move scanner-specific guidance into separate reference files:
   ```
   evolve-scan/
   ├── SKILL.md              (orchestration, < 500 lines)
   ├── guidance/
   │   ├── redundancy.md     (domain-specific checklist)
   │   ├── mechanization.md
   │   ├── staleness.md
   │   ├── conflicts.md
   │   ├── structure.md
   │   ├── hooks.md
   │   └── commands.md
   └── examples/
       └── sample-output.json
   ```
2. **Reference files are loaded on demand.** SKILL.md says: "For redundancy analysis, read guidance/redundancy.md." Claude loads only what it needs.
3. **Measure actual token usage.** Before shipping, count the template tokens. If total exceeds 4,000 tokens (including guidance files Claude might load), trim.
4. **Front-load critical instructions.** Output format and severity definitions go at the TOP, not the bottom. Scanner-specific guidance goes in reference files.
5. **Budget 40 lines per scanner area.** 7 scanners x 40 = 280 lines for inline guidance if keeping it in one file. Each section self-contained so the model can process area N without reading areas 1 through N-1.

**Detection:** Run `/evolve:scan` with a known-dirty config. If findings from middle-listed scanner domains (e.g., staleness, structure) are consistently missing while first and last domains (redundancy, commands) are detected, the lost-in-the-middle effect is occurring.

**Severity:** Critical
**Phase relevance:** Template architecture phase -- must be designed before any guidance content is written.

**Sources:**
- [Extend Claude with skills - Claude Code Docs](https://code.claude.com/docs/en/slash-commands) (HIGH confidence -- official docs say "Keep SKILL.md under 500 lines")
- [Why Long System Prompts Hurt Context Windows](https://medium.com/data-science-collective/why-long-system-prompts-hurt-context-windows-and-how-to-fix-it-7a3696e1cdf9) (MEDIUM confidence)
- [Effective context engineering for AI agents - Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) (HIGH confidence)
- [Claude Context Engineering Principles](https://01.me/en/2025/12/context-engineering-from-claude/) (MEDIUM confidence)

---

### Pitfall 34: Testing Model-Driven Analysis Is Fundamentally Non-Deterministic

**What goes wrong:** Developers write tests like `expect(findings).toContainEqual(expect.objectContaining({ pattern_type: 'scan_rule_conflict' }))` for model-driven output. The test passes 90% of the time but fails randomly in CI because the model occasionally misses a conflict or reclassifies its severity. The team adds `retry: 3` to all model-driven tests, masking genuine regressions behind probabilistic noise.

**Why it happens:** Traditional scanners are pure functions: same input always produces same output. Model-driven analysis is probabilistic: the same config can produce different findings on different runs, especially with temperature > 0 or different model versions. Silent model updates (e.g., Claude Sonnet 4.5 -> 4.5.1) can shift behavior without any code change.

**Consequences:**
- Flaky CI undermines confidence in the test suite. The team stops trusting test failures.
- Genuine regressions (model template broke, schema changed) are dismissed as "just model randomness."
- Test maintenance becomes a constant tax: every model update requires golden-file review.

**Prevention:**
1. **Separate deterministic and probabilistic test suites.** Existing 734 tests remain in the deterministic suite (code-based scanners). Model-driven tests go in a separate `tests/model/` directory with different CI treatment.
2. **Test structure, not content.** For model-driven output:
   - Assert schema validity: every finding passes `recommendationSchema.parse()`
   - Assert structural properties: findings count > 0 for known-dirty config, findings count == 0 for known-clean config
   - Assert field presence: every finding has `title`, `description`, `severity`, `suggested_action`
   - Do NOT assert exact `title` text or exact `pattern_type` values
3. **Golden-file comparison with tolerance.** Save a reference output for a known config. On each run, compare: "did the model find at least 5 of the 7 expected issues?" Not "did it find exactly these 7 with these exact titles?"
4. **Run model tests in a dedicated CI job** with explicit model version pinning and `retry: 2`. Tag as `@model-dependent` so failures are reviewed differently from deterministic test failures.
5. **Evaluation harness, not unit tests.** Treat model-driven analysis like an ML pipeline: use an evaluation set of 10-20 known configs with expected findings ranges, and track pass rates over time. A drop from 95% to 80% triggers investigation.

**Detection:** If model-driven test flakiness exceeds 10% (fails 1 in 10 runs), the assertions are too tight or the template needs improvement.

**Severity:** Critical
**Phase relevance:** Must be designed in Phase 1 (architecture). Retrofitting probabilistic test infrastructure after writing dozens of deterministic-style tests is painful.

**Sources:**
- [LLM Testing in 2026: Top Methods and Strategies](https://www.confident-ai.com/blog/llm-testing-in-2024-top-methods-and-strategies) (MEDIUM confidence)
- [Prompt regression testing: Preventing quality decay](https://www.statsig.com/perspectives/slug-prompt-regression-testing) (MEDIUM confidence)
- [LLM Testing - Langfuse](https://langfuse.com/blog/2025-10-21-testing-llm-applications) (MEDIUM confidence)

---

### Pitfall 35: Backward Compatibility Break -- v3.0 Users Lose Working `/evolve:scan` on Upgrade

**What goes wrong:** v4.0 ships a new scan template that changes the CLI invocation, output format, or workflow. Users who run `harness-evolve init` to update get the new template. Their existing workflow (`/evolve:scan` -> parse JSON -> `/evolve:apply`) breaks because the JSON structure changed, or because the template now requires a model invocation step that didn't exist before.

**Why it happens:** v3.0's scan template has `disable-model-invocation: true` and uses `npx harness-evolve scan` for all analysis (pure CLI). If v4.0 changes this to a hybrid workflow where the template instructs Claude to also run model-driven analysis, the behavior changes fundamentally. Users expect `/evolve:scan` to work the same way it always has.

**Consequences:**
- Users who upgraded lose confidence in harness-evolve and stop using it
- The apply pipeline (`/evolve:apply`) breaks if recommendation IDs or format changed
- Version-aware template updates (already built in v3.0 via `template-version: 3`) force-update the template, so users cannot stay on v3.0 templates with v4.0 CLI

**Prevention:**
1. **Additive changes only.** The v4.0 scan template must produce a superset of v3.0 output. All existing JSON fields remain. New fields are added, never renamed.
2. **CLI output contract is versioned.** Add `"output_version": 2` to scan JSON. CLI consumers check the version and handle both formats.
3. **Template version bump with migration path.** `template-version: 4` triggers update, but the new template's behavior must be backward-compatible with v3.0 expectations unless the user explicitly opts into enhanced scanning.
4. **The `--enhanced` or `--model` flag pattern.** Default `/evolve:scan` behavior is identical to v3.0 (code-based only). Model-driven analysis only activates when explicitly requested.
5. **Integration test with frozen v3.0 output.** Add a test that parses v4.0 scan output with v3.0's expected structure and verifies all v3.0 fields are present.

**Detection:** After upgrading, if `/evolve:apply` shows "No pending recommendations" despite `/evolve:scan` having run, the recommendation ID or storage format broke.

**Severity:** Critical
**Phase relevance:** Template design phase (Phase 1). Output contract must be defined before implementation begins.

---

### Pitfall 36: Scanner Guidance Quality IS Scanner Quality

**What goes wrong:** The model-driven scanner's accuracy is entirely determined by the quality of the guidance document. Vague guidance produces vague findings. Missing edge cases produce false positives. Poorly calibrated severity rules produce inconsistent problem/suggestion classification.

**Why it happens:** In the code-based scanner, the developer writes explicit regex and conditions -- the logic is transparent and testable. In the model-driven scanner, the "logic" is natural language instructions. Writing good instructions is harder than writing code because failures are probabilistic, not deterministic.

**Consequences:** Users lose trust in the scanner. False positives (v3.0 already had 21 from BUG-01) return in different forms. Users stop using `/evolve:scan`.

**Prevention:**
1. **Use IS/NOT calibration pairs for every scan area.** "This IS a finding: [example]. This is NOT a finding: [example]." Concrete positive and negative examples dramatically reduce ambiguity.
2. **Test guidance against at minimum 3 diverse real-world configs** (power user, beginner, GSD user) before removing old scanners.
3. **Keep severity rules concrete with measurable criteria**, not subjective ("if exact text duplicated across files" vs "if it seems redundant").
4. **Iterate guidance based on actual model outputs** -- run scan, review findings, adjust guidance, repeat until false positive rate < 5%.

**Detection:** Run the same scan on the same config twice. If findings differ significantly, guidance is too ambiguous.

**Severity:** Critical
**Phase relevance:** Guidance document writing phase. Each guidance document is a critical deliverable, not boilerplate.

---

## Moderate Pitfalls

Issues that cause confusion, wasted effort, or degraded quality but are recoverable.

---

### Pitfall 37: The BUG-01 Lesson -- Model-Based Parsing Has Different Failure Modes Than Code-Based Parsing

**What goes wrong:** BUG-01 proves that code-based hook parsing is fragile: `extractHooksFromAllSettings` (context-builder.ts:266-298) assumes flat `{type, command}` arrays but real Claude Code uses nested `{matcher, hooks: [{type, command}]}`. The temptation is to say "model-driven analysis will handle this because Claude understands JSON structure." But model-based parsing fails differently: instead of a crash or empty array (detectable), the model might silently misinterpret the structure and produce plausible-but-wrong findings (undetectable).

**Why it happens:** Code-based parsing fails loudly or returns empty results (21 false positives in BUG-01 -- visible). Model-based parsing fails quietly by generating confident-sounding findings based on misread data.

**Consequences:**
- False positives that look like real findings. Users act on them and make unnecessary changes.
- False negatives where the model sees the nested structure but doesn't detect the actual problem.
- Debugging becomes harder: with code scanners you can set a breakpoint; with model analysis the reasoning is opaque.

**Prevention:**
1. **Fix BUG-01 in code first** before adding model-driven analysis. The context-builder must correctly parse both flat and nested hook formats. This ensures `ScanContext.hooks_registered` is accurate before it reaches any scanner.
2. **Model-driven analysis reads from `ScanContext`, not raw files.** The context-builder is the single source of truth. If it's wrong, both scanners are consistently wrong, and the fix is in one place.
3. **Support both formats in the fix:** check for `hooks` sub-array first (nested), fall back to direct `{type, command}` parsing (flat). Test with fixtures for: nested format, flat format, mixed format, empty events.
4. **Add a "context integrity" pre-check.** Before model-driven analysis, verify `ScanContext` is internally consistent.

**Detection:** Compare model-driven findings against code-based findings for the same config. If they diverge significantly on hook-related findings, one is parsing wrong.

**Severity:** Moderate (but BUG-01 fix itself is Critical -- prerequisite for v4.0)
**Phase relevance:** BUG-01 fix must be Phase 0 (before any model-driven work begins).

---

### Pitfall 38: Context Rot in Long Scan Sessions -- Accumulated Findings Pollute Later Analysis

**What goes wrong:** If the model-driven scan processes all 7 scanner domains sequentially in a single turn, the findings from early domains accumulate in the conversation context. By the time the model analyzes domain 6 (hooks) and domain 7 (commands), its context is polluted with findings from domains 1-5. This causes cross-contamination, attention dilution, and repetitive findings.

**Why it happens:** Anthropic's context engineering research identifies "context poisoning" and "context distraction" as key failure modes. When the model generates analysis for domain 1 and that stays in context for domain 7, domain 7 analysis is conditioned on domain 1's output rather than purely on the source config.

**Prevention:**
1. **Isolate scanner domains.** Each domain gets its own model invocation or subagent with `context: fork`.
2. **If sequential analysis is necessary,** explicitly instruct: "Ignore previous findings and analyze ONLY the following aspect." But this is unreliable -- isolation is better.
3. **Merge findings in code, not in the model.** Each domain produces its own `Recommendation[]`. Code merges, deduplicates, and validates.

**Detection:** If findings from later domains echo or reference findings from earlier domains ("as previously noted..."), context rot is occurring.

**Severity:** Moderate
**Phase relevance:** Architecture phase -- sequential vs. parallel model invocation decision.

---

### Pitfall 39: Over-Reliance on Model Judgment for Severity Classification

**What goes wrong:** The guidance tells Claude to classify findings as "problem" or "suggestion" based on semantic judgment. Claude misclassifies: an empty rule file (clearly a problem) gets labeled "suggestion," while a minor style preference (clearly a suggestion) gets labeled "problem." Users lose trust in severity labels.

**Why it happens:** Severity classification requires domain expertise that varies across configurations. What's a "problem" in one project might be intentional in another.

**Consequences:**
- Users ignore "problem" labels because they've seen false alarms
- The `apply-one` confidence gate in CLI treats severity differently -- misclassification changes auto-apply behavior

**Prevention:**
1. **Hardcode severity for deterministic categories.** Empty files = problem. Missing references = problem. Style preferences = suggestion. Don't leave these to model judgment.
2. **Provide a severity rubric in the guidance** with concrete examples for each level. Not "use your judgment" but "empty file in .claude/rules/ is ALWAYS severity: problem."
3. **Test severity distribution.** The dirty-config test should verify known problems are classified as problems.

**Severity:** Moderate
**Phase relevance:** Guidance document design phase.

---

### Pitfall 40: Slash Command Template Character Budget Exhaustion

**What goes wrong:** The project installs two slash commands. In v4.0, scan becomes more complex with guidance references. Combined with other user-installed skills, the total skill descriptions exceed the 1% context window budget (fallback: 8,000 characters). Claude truncates or drops skill descriptions. `/evolve:scan` disappears from the skill listing.

**Why it happens:** The current v3.0 scan template is ~170 lines (~4,500 characters). v4.0 guidance integration could push this to 300+ lines (~8,000 characters) -- already consuming the entire default budget for just one skill.

**Prevention:**
1. **Keep scan SKILL.md lean.** Under 200 lines. All domain-specific guidance in reference files.
2. **Front-load the description** within 250 characters (the hard cap for skill listing display).
3. **Use `disable-model-invocation: true`** (already set) so the skill description isn't included in always-loaded context.
4. **Test with the budget.** Set `SLASH_COMMAND_TOOL_CHAR_BUDGET=8000` and install 5 other skills. Verify `/evolve:scan` still appears.

**Detection:** User reports `/evolve:scan` not appearing in autocomplete.

**Severity:** Moderate
**Phase relevance:** Template size management -- continuous concern during v4.0 development.

**Sources:**
- [Extend Claude with skills - Claude Code Docs](https://code.claude.com/docs/en/slash-commands) (HIGH confidence -- budget: 1% of context, fallback 8,000 chars, description cap 250 chars)

---

### Pitfall 41: Model-Generated Finding IDs Don't Match Apply Pipeline Expectations

**What goes wrong:** The model generates finding IDs (e.g., `scan-redundancy-0`) that don't match the existing `rec-scan-redundancy-0` pattern. The apply pipeline's `apply-one <id>` command cannot find the recommendation.

**Prevention:**
1. Specify the exact ID format in the guidance document: `"rec-scan-{area}-{index}"`.
2. Store-findings should normalize IDs to match the expected pattern, not reject them.
3. Test the full cycle: scan -> store findings -> pending -> apply-one with model-generated findings.

**Severity:** Moderate
**Phase relevance:** Integration between scan template and apply pipeline.

---

### Pitfall 42: Scanner Guidance Documents Become Stale -- No Mechanism to Keep Them Updated

**What goes wrong:** Guidance documents define what Claude should look for. Claude Code's configuration format evolves: new settings keys, new hook events, new frontmatter fields. The guidance documents don't get updated because there's no automated staleness detection.

**Why it happens:** Unlike code scanners (which fail to compile when their expectations don't match reality), guidance documents are natural language. There's no compiler to flag "your guidance references `PreToolUse` but the new event is `PreToolCall`."

**Prevention:**
1. **Version-pin the guidance.** Each document has a `<!-- verified-against: claude-code-hooks-2026-03 -->` comment. CI warns if not re-verified after Claude Code releases.
2. **Include "what to look for" and "what NOT to flag" sections.** The "NOT" section is where staleness shows first.
3. **Quarterly review cadence.** Re-verify against current Claude Code docs every 3 months.

**Severity:** Moderate
**Phase relevance:** Ongoing maintenance -- must be part of the release process.

---

## Minor Pitfalls

Issues that are annoying but easily fixed once identified.

---

### Pitfall 43: Model-Driven Scan Latency Surprises Users Expecting Sub-Second Code Scans

**What goes wrong:** v3.0's `npx harness-evolve scan` completes in <1 second. v4.0's model-driven enhancement adds 5-30 seconds. Users perceive this as a regression.

**Prevention:**
1. Show progress indicators: "Running code-based scan... done (0.3s). Running model-enhanced scan..."
2. Stream partial results -- show code-based findings immediately, append model-driven findings later.
3. Make model-driven scan optional. Default is fast code-based scan. `--enhanced` adds model analysis.

**Severity:** Minor
**Phase relevance:** UX design for hybrid scan workflow.

---

### Pitfall 44: Race Condition Between Code-Based and Model-Based Scanners on Same Finding

**What goes wrong:** Both code-based and model-driven scanners detect the same issue. The user sees duplicate findings with different IDs and slightly different titles.

**Prevention:**
1. **Deduplication pass after merge.** Compare `pattern_type` + affected files. Keep code-based finding (deterministic), discard model-driven duplicate.
2. **Tag findings with source:** `source: 'code'` or `source: 'model'`.
3. **Guidance should say:** "Do NOT report issues detectable by simple pattern matching (duplicate headings, empty files, broken references). Focus on semantic issues requiring understanding of intent."

**Severity:** Minor
**Phase relevance:** Merge/dedup logic in scan orchestrator.

---

### Pitfall 45: Template Version Bump Forgotten After Rewrite

**What goes wrong:** The scan template is rewritten from v3 to v4, but `SCAN_TEMPLATE_VERSION` is not bumped. Existing users don't get the updated template.

**Prevention:** Bump `SCAN_TEMPLATE_VERSION` from `'3'` to `'4'` as part of the template rewrite. One-line change, critical for delivery.

**Severity:** Minor
**Phase relevance:** Template rewrite checklist item.

---

### Pitfall 46: `ScanContext` Schema Becomes a Bottleneck -- Model Needs More Context Than Code Scanners Did

**What goes wrong:** The current `ScanContext` extracts headings, references, frontmatter, and settings -- sufficient for regex-based scanners. Model-driven analysis wants richer context: file relationships, hook script content, referenced file content. Expanding `ScanContext` bloats the object.

**Prevention:**
1. **Don't expand `ScanContext` for model analysis.** Have the model read files directly using `Read`, `Glob`, `Grep` tools available in the slash command.
2. **`ScanContext` remains the contract for code-based scanners** -- optimized for parsed, structured, pre-extracted data.
3. **If `ScanContext` must grow,** add optional fields with `z.optional()` so existing scanners and tests don't break.

**Severity:** Minor
**Phase relevance:** Architecture phase -- decide early whether model reads from ScanContext or from files.

---

### Pitfall 47: Guidance Documents Written in Chinese Get Interpreted Differently

**What goes wrong:** Project CLAUDE.md specifies Chinese for technical discussion, English for code. If guidance docs are written in Chinese, the model might produce Chinese findings despite the scan template specifying English output.

**Prevention:** All scanner guidance documents in English. They are code-adjacent technical specifications. Keep the existing "Language: Default to English" instruction.

**Severity:** Minor
**Phase relevance:** Guidance document writing phase.

---

### Pitfall 48: Deprecation Notice Without Migration Path for CLI Users

**What goes wrong:** The old `npx harness-evolve scan` prints a deprecation notice saying "use /evolve:scan instead" but the user is running from a terminal, not Claude Code.

**Prevention:** The deprecation notice should explain both paths: "For model-driven analysis, use `/evolve:scan` in Claude Code. For CLI scanning, `npx harness-evolve scan` still works with code-based scanners."

**Severity:** Minor
**Phase relevance:** CLI output messaging.

---

## Integration Pitfalls (Cross-Phase for v4.0)

### Integration Pitfall D: Template Update Forces All Users Onto Model-Driven Scan Simultaneously

v3.0 built a version-aware template update mechanism. When `template-version` bumps from 3 to 4, `harness-evolve init` replaces the old template. If the new template changes scan behavior fundamentally, all users who run `init` are forced onto the new behavior with no rollback path.

**Mitigation:** Template version 4 must be backward-compatible in default behavior. Model-driven features activate via flag or argument, not by default. The template's behavior when invoked as `/evolve:scan` (no arguments) must produce output indistinguishable from v3.0's template.

### Integration Pitfall E: Guidance Reference Files Not Installed by CLI Init

v3.0's `harness-evolve init` installs two files: `scan.md` and `apply.md` to `.claude/commands/evolve/`. If v4.0 adds 7+ guidance reference files, `init` must also install those or the skill won't work. The `generateScanCommand()` function currently returns a single string -- it doesn't create a directory structure.

**Mitigation:** Migrate from `.claude/commands/evolve/scan.md` (single file) to `.claude/skills/evolve-scan/SKILL.md` (directory with supporting files). This is a structural change that requires updating uninstall as well.

### Integration Pitfall F: Model-Driven Findings Cannot Be Stored or Applied by Existing Pipeline

The existing apply pipeline (`npx harness-evolve pending` -> `npx harness-evolve apply-one <id>`) works with `Recommendation` objects stored in `~/.harness-evolve/recommendations.json`. If model-driven analysis produces findings in the slash command context (model's response) but doesn't write them to the recommendations file, they're ephemeral -- lost when the conversation ends.

**Mitigation:** The scan template must instruct Claude to run the CLI to persist findings. Either: (a) model-driven findings are passed to a new CLI command like `npx harness-evolve add-finding '{"json"}'`, or (b) the template instructs Claude to write findings to the recommendations file directly via Bash. Option (a) is cleaner because the CLI can validate the finding against the Zod schema before storing.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Phase 0: BUG-01 Fix | Breaks flat format (#37) | **Critical** | Support both nested and flat format |
| Phase 1: Architecture | Removing code scanners (#31) | **Critical** | Hybrid architecture: code baseline + model enhancement |
| Phase 1: Architecture | Context rot in sequential analysis (#38) | Moderate | Isolate domains, merge in code |
| Phase 1: Architecture | ScanContext bottleneck (#46) | Minor | Model reads files directly |
| Phase 2: Template | Template bloat (#33) | **Critical** | Progressive disclosure, < 500 lines, reference files |
| Phase 2: Template | Budget exhaustion (#40) | Moderate | Test with budget limit |
| Phase 2: Template | Version bump forgotten (#45) | Minor | Checklist item |
| Phase 3: Guidance | Quality = accuracy (#36) | **Critical** | IS/NOT pairs, 3+ real config tests |
| Phase 3: Guidance | Severity misclassification (#39) | Moderate | Hardcode deterministic categories |
| Phase 3: Guidance | Staleness risk (#42) | Moderate | Version-pin, quarterly review |
| Phase 3: Guidance | Language conflicts (#47) | Minor | All guidance in English |
| Phase 4: Integration | Output format drift (#32) | **Critical** | Simplified model output + code conversion |
| Phase 4: Integration | ID format mismatch (#41) | Moderate | Specify format, normalize on store |
| Phase 4: Integration | Duplicate findings (#44) | Minor | Dedup pass with source tagging |
| Phase 5: Testing | Non-deterministic tests (#34) | **Critical** | Separate suites, schema validation |
| Phase 5: Backward compat | v3.0 users break (#35) | **Critical** | Additive changes, --enhanced flag |
| Phase 5: UX | Latency surprise (#43) | Minor | Progress indicators, streaming |
| Cross-Phase | Forced template update (D) | Moderate | Default behavior = v3.0 compatible |
| Cross-Phase | Reference files not installed (E) | Moderate | Migrate to skills directory structure |
| Cross-Phase | Findings not persisted (F) | Moderate | CLI command for persisting model findings |
| Cross-Phase | Deprecation messaging (#48) | Minor | Explain both CLI and slash command paths |

---

## v1.0-v3.0 Pitfalls Status

| Range | Status |
|-------|--------|
| #1-5 (v1.0 Critical) | RESOLVED -- all mitigated |
| #6-15 (v1.0 Moderate/Minor) | Most RESOLVED; #9 (version compat), #11 (hook duplicates), #14, #15 remain ONGOING |
| #16-30 (v1.1 Pitfalls) | All RESOLVED in v1.1-v3.0 milestones |

---

## Sources

### Official Documentation (HIGH confidence)
- [Extend Claude with skills - Claude Code Docs](https://code.claude.com/docs/en/slash-commands) -- Skill architecture, character budgets (1% context, 8K fallback, 250-char description cap), progressive disclosure, reference files
- [Structured outputs - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) -- JSON schema guarantees, strict mode, constrained decoding
- [Effective context engineering for AI agents - Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- Context rot, system prompt design, tool descriptions

### LLM Output Consistency Research (MEDIUM confidence)
- [LLM Structured Output in 2026 - DEV Community](https://dev.to/pockit_tools/llm-structured-output-in-2026-stop-parsing-json-with-regex-and-do-it-right-34pk) -- Production structured output pitfalls
- [The guide to structured outputs and function calling with LLMs - Agenta](https://agenta.ai/blog/the-guide-to-structured-outputs-and-function-calling-with-llms) -- Schema validation best practices
- [Structured Output Challenges - tamingllms.com](https://www.tamingllms.com/notebooks/structured_output.html) -- Deep dive on format consistency
- [5 System-Level Strategies to Mitigate LLM Hallucinations](https://earezki.com/ai-news/2026-03-25-5-practical-techniques-to-detect-and-mitigate-llm-hallucinations-beyond-prompt-engineering/) -- Production hallucination mitigation
- [Practical Implementation of LLM Structured Outputs - INDX](https://indx.jp/en/blog/llm-structured-outputs) -- Implementation patterns

### LLM Testing (MEDIUM confidence)
- [LLM Testing in 2026 - Confident AI](https://www.confident-ai.com/blog/llm-testing-in-2024-top-methods-and-strategies) -- Deterministic vs probabilistic strategies
- [Prompt regression testing - Statsig](https://www.statsig.com/perspectives/slug-prompt-regression-testing) -- Preventing quality decay from model updates
- [LLM Testing - Langfuse](https://langfuse.com/blog/2025-10-21-testing-llm-applications) -- Practical testing for LLM applications
- [LLM Evals - LangChain](https://www.langchain.com/articles/llm-evals) -- Production monitoring to regression tests

### Context Engineering (MEDIUM-HIGH confidence)
- [Claude Context Engineering Principles](https://01.me/en/2025/12/context-engineering-from-claude/) -- Progressive disclosure, context rot types, "say less, mean more"
- [The Impact of Prompt Bloat on LLM Output Quality - MLOps Community](https://mlops.community/the-impact-of-prompt-bloat-on-llm-output-quality/) -- Prompt size impact research
- [Prompt Length vs Context Window - DEV Community](https://dev.to/superorange0707/prompt-length-vs-context-window-the-real-limits-behind-llm-performance-3h20) -- Lost-in-the-middle attention degradation

### Project Codebase Analysis (HIGH confidence)
- `src/scan/index.ts` -- ScanResult interface, ScannerMeta, scan orchestration loop
- `src/scan/scanners/index.ts` -- Scanner registry (7 scanners), Scanner type signature
- `src/scan/context-builder.ts` -- BUG-01 root cause (line 266-298), extractHooksFromAllSettings
- `src/scan/schemas.ts` -- ScanContext Zod v4 schema
- `src/schemas/recommendation.ts` -- Recommendation schema, PatternType enum (21 values), severity enum
- `src/commands/evolve-scan.ts` -- Current scan template (~170 lines, version 3)
- `src/commands/evolve-apply.ts` -- Current apply template (version 3)
- `src/scan/scanners/conflict.ts` -- Opposition-pair regex pattern (representative of code-based scanner logic)
- `src/scan/scanners/mechanization.ts` -- Indicator-list pattern (representative of code-based scanner logic)
- `tests/integration/dirty-config-e2e.test.ts` -- 10 E2E scenarios asserting exact pattern_type values from 7 scanners
- `.planning/TODOS.md` -- BUG-01, ARCH-01, ARCH-02 definitions
