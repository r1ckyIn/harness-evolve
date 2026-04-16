# Codebase Structure

**Analysis Date:** 2026-04-16

## Directory Layout

```
harness-evolve/
├── src/                        # TypeScript source
│   ├── hooks/                  # Claude Code hook entry points (7 hooks)
│   ├── analysis/               # Analysis engine + classifiers
│   │   └── classifiers/        # Pattern classifier functions (8 classifiers)
│   ├── delivery/               # Recommendation rendering, state, auto-apply
│   │   └── appliers/           # Strategy implementations per routing target
│   ├── scan/                   # Deep scan context builder
│   ├── generators/             # Artifact generators (hook, skill, CLAUDE.md)
│   ├── storage/                # JSONL logger, counter, config, dir paths
│   ├── scrubber/               # PII/secret redaction
│   ├── schemas/                # Zod schemas (shared contracts)
│   ├── cli/                    # CLI subcommand handlers
│   ├── commands/               # Slash command template generators
│   ├── index.ts                # Library public API (all re-exports)
│   └── cli.ts                  # CLI entry point (Commander.js root)
├── dist/                       # Compiled output (tsup, ESM, committed to npm)
│   ├── hooks/                  # Compiled hook entry points (+ .d.ts)
│   ├── delivery/               # Compiled delivery modules (+ .d.ts)
│   ├── index.js / index.d.ts   # Library entry point
│   └── cli.js                  # CLI binary
├── tests/
│   ├── unit/                   # Mirror of src/ structure
│   │   ├── hooks/
│   │   ├── analysis/
│   │   │   └── classifiers/
│   │   ├── delivery/
│   │   ├── generators/
│   │   ├── scan/
│   │   ├── schemas/
│   │   └── cli/
│   ├── integration/            # Pipeline-level tests
│   ├── fixtures/               # Test fixture files
│   │   └── model-validation/   # Fixture harness configs for scan tests
│   └── helpers/                # Test utilities (e.g., increment-worker.ts)
├── .claude/
│   ├── skills/evolve/          # /evolve GSD skill
│   └── commands/               # Slash command files
├── .planning/                  # GSD planning artifacts
├── .github/workflows/          # CI configuration
├── package.json                # npm manifest, bin, exports map
├── tsconfig.json               # TypeScript config
├── tsup.config.ts              # Build config (multi-entry ESM)
├── vitest.config.ts            # Test runner config
└── CLAUDE.md                   # Project-level Claude config
```

## Directory Purposes

**`src/hooks/`:**
- Purpose: Hook handler entry points — one file per Claude Code hook event
- Contains: `user-prompt-submit.ts`, `stop.ts`, `pre-tool-use.ts`, `post-tool-use.ts`, `post-tool-use-failure.ts`, `permission-request.ts`, `session-start.ts`, `shared.ts`
- Pattern: Each file exports a testable `handle*` function + a `main()` that reads stdin and calls it
- Key file: `src/hooks/shared.ts` — `readStdin()`, `readFromStream()`, `summarizeToolInput()`

**`src/analysis/`:**
- Purpose: Full analysis pipeline from raw logs to structured recommendations
- Key files: `src/analysis/trigger.ts` (orchestrator), `src/analysis/pre-processor.ts` (JSONL → Summary), `src/analysis/analyzer.ts` (classifier dispatch), `src/analysis/environment-scanner.ts` (tool discovery), `src/analysis/jsonl-reader.ts` (streaming reader), `src/analysis/outcome-tracker.ts` (feedback loop), `src/analysis/schemas.ts` (Summary + EnvironmentSnapshot types)

**`src/analysis/classifiers/`:**
- Purpose: Independent pattern detectors, each returning zero or more recommendations
- Contains: `repeated-prompts.ts`, `long-prompts.ts`, `permission-patterns.ts`, `code-corrections.ts`, `personal-info.ts`, `config-drift.ts`, `ecosystem-adapter.ts`, `onboarding.ts`, `index.ts`
- Key file: `src/analysis/classifiers/index.ts` — defines `Classifier` type and `classifiers[]` registry

**`src/delivery/`:**
- Purpose: Everything from analysis result → user
- Key files: `src/delivery/run-evolve.ts` (on-demand pipeline entry), `src/delivery/renderer.ts` (markdown), `src/delivery/state.ts` (applied/dismissed tracking), `src/delivery/notification.ts` (flag file for prompt injection), `src/delivery/auto-apply.ts` (strategy dispatch), `src/delivery/rotator.ts` (archive)

**`src/delivery/appliers/`:**
- Purpose: One `Applier` class per `RoutingTarget`
- Contains: `index.ts` (interface + registry), `settings-applier.ts`, `rule-applier.ts`, `hook-applier.ts`, `claude-md-applier.ts`

**`src/scan/`:**
- Purpose: Model-driven deep scan — gathers all Claude Code config into `ScanContext`
- Key files: `src/scan/context-builder.ts` (reads CLAUDE.md, rules, settings, commands, hooks), `src/scan/index.ts` (buildScanResult), `src/scan/schemas.ts`

**`src/generators/`:**
- Purpose: Generate new config artifacts from recommendation data
- Key files: `src/generators/hook-generator.ts`, `src/generators/skill-generator.ts`, `src/generators/claude-md-generator.ts`, `src/generators/schemas.ts` (GeneratedArtifact)

**`src/storage/`:**
- Purpose: All filesystem I/O for runtime data
- Key files: `src/storage/dirs.ts` (ALL path constants + `ensureInit`), `src/storage/logger.ts` (JSONL append with scrub), `src/storage/counter.ts` (atomic increment), `src/storage/config.ts` (config loader)

**`src/scrubber/`:**
- Purpose: PII/secret redaction applied before any log write
- Key files: `src/scrubber/scrub.ts` (`scrubString`, `scrubObject`), `src/scrubber/patterns.ts` (`SCRUB_PATTERNS`)

**`src/schemas/`:**
- Purpose: Shared Zod schemas — the cross-cutting contracts between all modules
- Key files: `src/schemas/recommendation.ts` (RoutingTarget, Recommendation, AnalysisResult), `src/schemas/hook-input.ts` (one schema per hook event), `src/schemas/log-entry.ts`, `src/schemas/config.ts`, `src/schemas/counter.ts`, `src/schemas/delivery.ts`, `src/schemas/onboarding.ts`

**`src/cli/`:**
- Purpose: Commander.js subcommand implementations
- Key files: `src/cli/init.ts`, `src/cli/status.ts`, `src/cli/scan.ts`, `src/cli/scan-context.ts`, `src/cli/apply.ts` (pending/apply-one/dismiss), `src/cli/store-findings.ts`, `src/cli/uninstall.ts`, `src/cli/utils.ts`

**`src/commands/`:**
- Purpose: Slash command Markdown template generators (versioned, auto-repaired by SessionStart hook)
- Key files: `src/commands/evolve-scan.ts`, `src/commands/evolve-apply.ts`

**`dist/`:**
- Purpose: Compiled ESM output, not hand-edited
- Generated: Yes
- Committed: Yes (shipped to npm)
- Key published entries: `dist/cli.js` (bin), `dist/index.js` (library), `dist/hooks/*.js` (hook binaries), `dist/delivery/run-evolve.js` (slash command runner)

**`tests/unit/`:**
- Purpose: Mirrors `src/` structure exactly — one `.test.ts` per source file
- Pattern: `tests/unit/analysis/analyzer.test.ts` tests `src/analysis/analyzer.ts`

**`tests/integration/`:**
- Purpose: Pipeline-level tests that exercise multiple modules together
- Key files: `tests/integration/analysis-pipeline.test.ts`, `tests/integration/hook-pipeline.test.ts`, `tests/integration/delivery-pipeline.test.ts`, `tests/integration/e2e-flows.test.ts`, `tests/integration/scan-pipeline-v4.test.ts`, `tests/integration/concurrent-counter.test.ts`

**`tests/fixtures/model-validation/`:**
- Purpose: Fixture Claude Code harness directories used by scan tests
- Contains: `cross-file-inconsistency/`, `guidance-extensibility/`, `natural-language-hookable/`, `semantic-conflict/` — each with realistic CLAUDE.md, rules, and settings

## Key File Locations

**Entry Points:**
- `src/cli.ts`: CLI root (Commander.js, registers all subcommands)
- `src/index.ts`: Library public API (all module re-exports organized by phase)
- `src/hooks/user-prompt-submit.ts`: Highest-frequency hook (every user prompt)
- `src/hooks/stop.ts`: Analysis trigger hook
- `src/delivery/run-evolve.ts`: `/evolve` skill on-demand pipeline

**Configuration:**
- `src/storage/dirs.ts`: ALL runtime path constants — single source of truth for `~/.harness-evolve/` layout
- `src/schemas/config.ts`: Config schema (Zod) — defines all feature flag names and defaults
- `tsup.config.ts`: Build entries list (one entry per hook + cli + run-evolve + index)
- `package.json`: `exports` map mirrors `tsup.config.ts` entries

**Core Logic:**
- `src/analysis/trigger.ts`: `checkAndTriggerAnalysis()` and `runAnalysis()` — the analysis orchestrator
- `src/analysis/analyzer.ts`: `analyze()` — iterates classifier registry, adjusts confidence, caps results
- `src/analysis/classifiers/index.ts`: Classifier registry — add new pattern detectors here
- `src/delivery/appliers/index.ts`: Applier registry — add new auto-apply strategies here
- `src/schemas/recommendation.ts`: `RoutingTarget` and `PatternType` enums — extend when adding new recommendation types

**Testing:**
- `vitest.config.ts`: Test config
- `tests/unit/`: Unit tests mirroring `src/`
- `tests/integration/`: Pipeline integration tests
- `tests/helpers/increment-worker.ts`: Worker thread helper for concurrent counter tests

## Naming Conventions

**Files:**
- kebab-case for all source files: `pre-processor.ts`, `hook-generator.ts`, `claude-md-applier.ts`
- Classifier files named after the pattern they detect: `repeated-prompts.ts`, `permission-patterns.ts`
- Applier files suffixed with `-applier`: `settings-applier.ts`, `hook-applier.ts`
- Test files: `{source-file-name}.test.ts` co-located by mirror structure in `tests/`

**Functions:**
- Hook handlers: `handle{EventName}()` — e.g., `handleUserPromptSubmit`, `handleStop`
- Classifiers: `classify{PatternName}()` — e.g., `classifyRepeatedPrompts`, `classifyPermissionPatterns`
- CLI registrations: `register{Command}Command(program)` — e.g., `registerInitCommand`
- Storage ops: verb+noun — `appendLogEntry`, `incrementCounter`, `loadConfig`, `ensureInit`

**Types/Schemas:**
- Zod schemas: `{thing}Schema` — e.g., `recommendationSchema`, `analysisResultSchema`
- TypeScript types: PascalCase inferred from schema — e.g., `Recommendation`, `AnalysisResult`
- Routing targets: SCREAMING_SNAKE_CASE string enum — `HOOK`, `SKILL`, `RULE`, `CLAUDE_MD`, `MEMORY`, `SETTINGS`

## Where to Add New Code

**New classifier (new pattern to detect):**
1. Create `src/analysis/classifiers/{pattern-name}.ts` exporting `classify{PatternName}(summary, snapshot, config): Recommendation[]`
2. Add `pattern_type` string to the enum in `src/schemas/recommendation.ts`
3. Register in `src/analysis/classifiers/index.ts` by importing and pushing to `classifiers[]`
4. Add unit test at `tests/unit/analysis/classifiers/{pattern-name}.test.ts`

**New applier (new auto-apply target):**
1. Create `src/delivery/appliers/{target-name}-applier.ts` implementing the `Applier` interface
2. Import and call `registerApplier(new {Target}Applier())` in `src/delivery/auto-apply.ts`
3. Add unit test at `tests/unit/delivery/appliers/{target-name}-applier.test.ts`

**New hook event:**
1. Create `src/hooks/{event-name}.ts` with `handle{EventName}()` + `main()`
2. Add input schema to `src/schemas/hook-input.ts`
3. Add entry to `tsup.config.ts` entry list
4. Add `exports` entry in `package.json`
5. Register in user's `settings.json` pointing to `dist/hooks/{event-name}.js`

**New CLI subcommand:**
1. Create `src/cli/{command-name}.ts` exporting `register{Command}Command(program)`
2. Import and call in `src/cli.ts`
3. Add unit test at `tests/unit/cli/{command-name}.test.ts`

**New runtime data path:**
1. Add to `paths` object in `src/storage/dirs.ts`
2. Add `mkdir` call in `ensureInit()` if it's a directory

## Special Directories

**`dist/`:**
- Purpose: Compiled ESM output shipped to npm
- Generated: Yes (via `npm run build` / tsup)
- Committed: Yes (required for `npm publish`)
- Do not hand-edit; regenerate with `npm run build`

**`~/.harness-evolve/`:**
- Purpose: All runtime data (logs, analysis artifacts, config, counter)
- Generated: Yes (created lazily by `ensureInit()`)
- Committed: No (user data, not in repo)
- Layout defined entirely in `src/storage/dirs.ts`

**`tests/fixtures/`:**
- Purpose: Static fixture harness configs for scan/model-validation tests
- Generated: No (hand-crafted)
- Committed: Yes

---

*Structure analysis: 2026-04-16*
