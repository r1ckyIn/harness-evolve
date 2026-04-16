# Architecture

**Analysis Date:** 2026-04-16

## Pattern Overview

**Overall:** Event-driven pipeline with layered capture → aggregate → analyze → recommend → inject

**Key Characteristics:**
- Each Claude Code hook event triggers a thin capture handler that writes to JSONL and exits immediately (<50ms budget)
- Analysis runs asynchronously on a threshold+cooldown trigger, decoupled from the capture path
- Recommendations are stored as JSON and delivered via markdown file + stdout injection — Claude Code is never blocked
- All errors are swallowed at hook boundaries: the invariant is "never block Claude Code"
- All file writes go through `write-file-atomic` (full file replace) or `fs.appendFile` (JSONL append-only)

## Layers

**Hook Entry Layer:**
- Purpose: Receive Claude Code events via stdin JSON, capture data, and exit immediately
- Location: `src/hooks/`
- Contains: One file per hook event type; each exports a testable `handle*` function plus a `main()` entry point
- Depends on: Storage layer, Delivery notification module (for injection), Schema layer
- Used by: Claude Code directly via `settings.json` hook registration → `dist/hooks/*.js`

**Storage Layer:**
- Purpose: Atomic JSONL append, counter increment with lock, config loading, directory initialization
- Location: `src/storage/`
- Key files: `src/storage/logger.ts` (JSONL pipeline), `src/storage/counter.ts` (cross-process safe counter), `src/storage/dirs.ts` (path constants + `ensureInit`), `src/storage/config.ts` (config loader)
- Depends on: `write-file-atomic`, `proper-lockfile`, `scrubber/`
- Used by: Hook layer, Analysis layer

**Scrubber:**
- Purpose: Regex-based PII/secret redaction applied to all log writes before they touch disk
- Location: `src/scrubber/`
- Key files: `src/scrubber/scrub.ts`, `src/scrubber/patterns.ts`
- Pattern: `raw data → scrubObject() → [REDACTED:type] markers → write`
- Depends on: Nothing (pure functions)
- Used by: `src/storage/logger.ts`

**Analysis Layer:**
- Purpose: Pre-process JSONL logs into compact summary, scan environment, run classifier ensemble, produce ranked recommendations
- Location: `src/analysis/`
- Key files: `src/analysis/trigger.ts` (orchestrator), `src/analysis/pre-processor.ts` (log aggregation), `src/analysis/analyzer.ts` (classifier dispatch), `src/analysis/environment-scanner.ts` (tool discovery), `src/analysis/classifiers/index.ts` (registry), `src/analysis/outcome-tracker.ts` (feedback loop)
- Depends on: Storage layer, Delivery notification module, Schema layer
- Used by: Hook stop handler (threshold trigger), Delivery `run-evolve.ts` (on-demand)

**Classifier Sub-layer:**
- Purpose: Each classifier is a pure function `(Summary, EnvironmentSnapshot, AnalysisConfig) → Recommendation[]`
- Location: `src/analysis/classifiers/`
- Classifiers: `repeated-prompts`, `long-prompts`, `permission-patterns`, `code-corrections`, `personal-info`, `config-drift`, `ecosystem-adapter`, `onboarding`
- Registry: `src/analysis/classifiers/index.ts` exports `classifiers: Classifier[]` array — add new classifiers by importing and pushing

**Schema Layer:**
- Purpose: Zod schemas that act as runtime contracts for all inter-module data
- Location: `src/schemas/`
- Key files: `src/schemas/recommendation.ts` (RoutingTarget, Confidence, PatternType, Recommendation, AnalysisResult), `src/schemas/hook-input.ts` (per-event input shapes), `src/schemas/log-entry.ts`, `src/schemas/config.ts`, `src/schemas/delivery.ts`
- Depends on: Nothing (Zod only)
- Used by: All layers

**Scan Layer:**
- Purpose: Model-driven deep scan — reads all Claude Code config files (CLAUDE.md, rules, settings, commands, hooks) into a `ScanContext` for model analysis
- Location: `src/scan/`
- Key files: `src/scan/context-builder.ts` (filesystem reader), `src/scan/index.ts` (buildScanResult), `src/scan/schemas.ts`
- Note: v4.0 removed code-based scanners; analysis is performed by Claude model via `/evolve:scan` slash command

**Generator Layer:**
- Purpose: Produce new configuration artifacts (hook scripts, skills, CLAUDE.md patches) from recommendations
- Location: `src/generators/`
- Key files: `src/generators/hook-generator.ts`, `src/generators/skill-generator.ts`, `src/generators/claude-md-generator.ts`, `src/generators/schemas.ts` (GeneratedArtifact schema)
- Depends on: Schema layer
- Used by: Delivery appliers

**Delivery Layer:**
- Purpose: Render recommendations to markdown, track applied/dismissed state, auto-apply HIGH-confidence recs, inject notifications into Claude Code prompts
- Location: `src/delivery/`
- Key files: `src/delivery/run-evolve.ts` (on-demand full pipeline entry point), `src/delivery/renderer.ts` (markdown), `src/delivery/state.ts` (status tracking), `src/delivery/auto-apply.ts` (strategy dispatch), `src/delivery/notification.ts` (flag file for injection), `src/delivery/rotator.ts` (archive old recs), `src/delivery/appliers/` (strategy implementations)
- Depends on: Analysis layer, Generator layer, Storage layer, Schema layer
- Used by: `src/delivery/run-evolve.ts` (slash command), CLI apply subcommands

**Applier Sub-layer:**
- Purpose: Strategy pattern implementations for auto-applying specific recommendation targets
- Location: `src/delivery/appliers/`
- Appliers: `SettingsApplier` (SETTINGS target), `RuleApplier` (RULE target), `HookApplier` (HOOK target), `ClaudeMdApplier` (CLAUDE_MD target)
- Registry: `src/delivery/appliers/index.ts` — `registerApplier()` + `getApplier(target)` map

**CLI Layer:**
- Purpose: `harness-evolve` CLI binary with subcommands for init, status, scan, apply, dismiss, uninstall
- Location: `src/cli.ts` (Commander.js root), `src/cli/` (subcommand handlers)
- Key files: `src/cli/init.ts`, `src/cli/status.ts`, `src/cli/scan.ts`, `src/cli/apply.ts`, `src/cli/uninstall.ts`
- Depends on: Analysis, Delivery, Storage, Scan layers

**Commands Layer:**
- Purpose: Slash command template generators — produce versioned Markdown files for `~/.claude/commands/evolve/`
- Location: `src/commands/`
- Key files: `src/commands/evolve-scan.ts`, `src/commands/evolve-apply.ts`
- Used by: `src/hooks/session-start.ts` (auto-repair on session start)

## Data Flow

**Capture Path (realtime, <50ms):**

1. Claude Code fires hook event → pipes JSON to `dist/hooks/{event}.js` via stdin
2. Hook reads stdin via `readStdin()` in `src/hooks/shared.ts`
3. Zod schema in `src/schemas/hook-input.ts` validates the JSON
4. Data is scrubbed (`scrubObject()`) and appended to JSONL at `~/.harness-evolve/logs/{type}/YYYY-MM-DD.jsonl` via `src/storage/logger.ts`
5. Counter at `~/.harness-evolve/counter.json` is incremented with `proper-lockfile` for cross-process safety
6. `UserPromptSubmit` additionally checks `delivery/notification.ts` for a pending flag and writes to stdout if set
7. Hook exits with `process.exit(0)` — never blocks Claude Code

**Analysis Path (threshold-triggered, async):**

1. `Stop` hook fires → `src/hooks/stop.ts` calls `checkAndTriggerAnalysis(cwd)` in `src/analysis/trigger.ts`
2. Trigger reads counter; if `total >= config.analysis.threshold` (default 20) and cooldown (60s) has passed, proceeds
3. `preProcess()` reads all JSONL logs for last 30 days, computes frequency maps, writes `~/.harness-evolve/analysis/pre-processed/summary.json`
4. `scanEnvironment()` discovers installed plugins/skills/rules/hooks/CLAUDE.md files, writes `environment-snapshot.json`
5. `trackOutcomes()` compares current snapshot to prior to detect applied/reverted changes
6. `analyze(summary, snapshot)` iterates all 8 classifiers, collects `Recommendation[]`, adjusts confidence via outcome history, sorts and caps at `max_recommendations`
7. `AnalysisResult` written atomically to `~/.harness-evolve/analysis/analysis-result.json`
8. Pending count written as notification flag to `~/.harness-evolve/analysis/has-pending-notifications`
9. Counter reset with `last_analysis` timestamp

**Delivery Path (on-demand via /evolve skill):**

1. `/evolve` skill invokes `dist/delivery/run-evolve.js` as a command
2. Runs full analysis pipeline (`runAnalysis`)
3. Loads recommendation state map from `recommendation-state.json`
4. Rotates old recommendations to archive
5. Renders markdown via `renderRecommendations()`, writes to `~/.harness-evolve/recommendations.md`
6. Auto-applies HIGH-confidence recs if `config.delivery.fullAuto=true` (dispatches to registered `Applier` implementations)
7. Outputs JSON summary to stdout for the skill to present to the user

**Interactive Apply Path (via /evolve:apply slash command):**

1. `/evolve:apply` invokes `harness-evolve pending` → reads `analysis-result.json`, returns pending list as JSON
2. User selects a recommendation ID
3. `/evolve:apply` invokes `harness-evolve apply-one <id>` → looks up applier for `rec.target`, calls `applier.apply(rec)`
4. State updated to `applied` in `recommendation-state.json`

**State Management:**
- Counter: `~/.harness-evolve/counter.json` — total interaction count with per-session breakdown and `last_analysis` timestamp
- Logs: `~/.harness-evolve/logs/{prompts,tools,permissions,sessions}/YYYY-MM-DD.jsonl` — daily rotating JSONL files
- Analysis artifacts: `~/.harness-evolve/analysis/` — summary, environment snapshot, analysis result, recommendation state, archive, auto-apply log, outcome history
- Config: `~/.harness-evolve/config.json` — feature flags (`hooks.capturePrompts`, `analysis.enabled`, `delivery.fullAuto`, etc.)

## Key Abstractions

**Classifier:**
- Purpose: Pure function that detects a specific usage pattern and emits zero or more `Recommendation` objects
- Examples: `src/analysis/classifiers/repeated-prompts.ts`, `src/analysis/classifiers/permission-patterns.ts`
- Pattern: `(Summary, EnvironmentSnapshot, AnalysisConfig) => Recommendation[]`
- Registry: `src/analysis/classifiers/index.ts` — push to `classifiers[]` to register

**Recommendation:**
- Purpose: Structured output from the analysis engine with routing target, confidence, evidence, and suggested action
- Schema: `src/schemas/recommendation.ts` — fields: `id`, `target` (HOOK|SKILL|RULE|CLAUDE_MD|MEMORY|SETTINGS), `confidence` (HIGH|MEDIUM|LOW), `pattern_type`, `title`, `description`, `evidence`, `suggested_action`

**Applier:**
- Purpose: Strategy implementation that materializes a Recommendation into actual config file changes
- Interface: `src/delivery/appliers/index.ts` — `canApply(rec)`, `apply(rec, options) → AutoApplyResult`
- Implementations: `src/delivery/appliers/settings-applier.ts`, `src/delivery/appliers/rule-applier.ts`, `src/delivery/appliers/hook-applier.ts`, `src/delivery/appliers/claude-md-applier.ts`

**EnvironmentSnapshot:**
- Purpose: Point-in-time view of what Claude Code tools the user has installed — drives ecosystem-aware recommendations
- Schema: `src/analysis/schemas.ts` — contains `installed_tools`, `detected_ecosystems`, `claude_code.version`

## Entry Points

**Hook Entry Points (invoked by Claude Code directly):**
- `dist/hooks/user-prompt-submit.js` → captures prompt + injects notification
- `dist/hooks/stop.js` → threshold analysis trigger
- `dist/hooks/pre-tool-use.js` → tool start marker + log
- `dist/hooks/post-tool-use.js` → tool completion log with duration
- `dist/hooks/post-tool-use-failure.js` → tool failure log
- `dist/hooks/permission-request.js` → permission pattern log
- `dist/hooks/session-start.js` → auto-repair slash commands (`/evolve:scan`, `/evolve:apply`)

**Delivery Entry Point (invoked by /evolve skill):**
- `dist/delivery/run-evolve.js` → full analysis + render + auto-apply pipeline; outputs JSON to stdout

**CLI Binary:**
- `dist/cli.js` (`harness-evolve` command) → subcommands: `init`, `status`, `scan`, `scan-context`, `pending`, `apply-one`, `dismiss`, `store-findings`, `uninstall`

**Library Entry Point (for programmatic use):**
- `dist/index.js` / `dist/index.d.ts` → re-exports all public types, schemas, and functions across all phases

## Error Handling

**Strategy:** Swallow-all at hook boundaries; let errors propagate within internal modules

**Patterns:**
- All `main()` functions in `src/hooks/` wrap everything in `try/catch` and call `process.exit(0)` — failures are silent
- Inner `handle*` functions also wrap in `try/catch` for defense-in-depth
- Notification and auto-apply operations are wrapped in separate `try/catch` blocks within already-wrapped handlers
- Analysis trigger errors preserve the counter (no reset) so the system retries at the next threshold crossing
- Appliers return `AutoApplyResult` with `success: false` rather than throwing

## Cross-Cutting Concerns

**Scrubbing:** Applied at log write time (`src/storage/logger.ts` calls `scrubObject()` before `appendFile`)
**Concurrency:** `write-file-atomic` for file replacement; `proper-lockfile` for counter reads/writes; `fs.appendFile` for JSONL (atomic for <4KB on POSIX)
**File Layout:** All runtime data under `~/.harness-evolve/` (defined in `src/storage/dirs.ts`); source code under `src/`; compiled output under `dist/`
**Validation:** All inter-module boundaries use Zod `.parse()` — invalid data is rejected early

---

*Architecture analysis: 2026-04-16*
