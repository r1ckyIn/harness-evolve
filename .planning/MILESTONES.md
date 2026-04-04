# Milestones

## v2.0 Deep Scan & Auto-Generation (Shipped: 2026-04-04)

**Phases completed:** 5 phases, 10 plans, 20 tasks

**Key accomplishments:**

- ScanContext Zod schema with context-builder reading CLAUDE.md, rules, settings, commands, and hooks from filesystem, plus Scanner type and patternType extension
- Three scanner functions detecting redundancy, missing mechanization, and stale references in Claude Code configuration, all producing valid Recommendation[] and registered in scanner array
- runDeepScan orchestrator wiring context-builder to scanners, integrated into CLI init with advisory scan results display, and full public API export for programmatic scan access
- GeneratedArtifact Zod schema with toSlug/escapeYaml utilities, plus generateSkill() converting long_prompt SKILL recommendations into .claude/commands/<slug>.md drafts
- Hook script generator (GEN-02) and CLAUDE.md patch generator (GEN-03) with public API barrel module exporting all three generators for Phase 14 applier consumption
- HookApplier and ClaudeMdApplier complete the auto-apply pipeline for 4 of 6 routing targets (SETTINGS, RULE, HOOK, CLAUDE_MD)
- Pure-function slash command template generators for /evolve:scan and /evolve:apply wired into init/uninstall CLI with create-only guard and graceful cleanup
- Four CLI subcommands (scan, pending, apply-one, dismiss) providing JSON backend for /evolve:scan and /evolve:apply slash commands
- Notification text now references /evolve:apply with 'suggestion' wording; init output shows hook purpose descriptions
- Pending and scan CLI outputs now sort recommendations HIGH -> MEDIUM -> LOW using explicit CONFIDENCE_ORDER constant

---

## v1.1 Stabilization & Production (Shipped: 2026-04-04)

**Phases completed:** 3 phases, 7 plans, 12 tasks

**Key accomplishments:**

- PatternType Zod enum with 13 values fixes broken self-iteration feedback loop by correcting inferPatternType string mismatches for 7/8 classifiers
- Hardened proper-lockfile retry config (50 retries, 20-1000ms jitter backoff) to eliminate ELOCKED flakes in concurrent-counter integration test
- 1. [Rule 1 - Bug] Updated existing test for non-applier target filtering
- Complete npm package.json with metadata, files whitelist, ESM exports map, CLI stub bin entry, and validation tooling (publint + attw)
- Commander.js CLI framework with init command for hook registration in settings.json, supporting global/npx/git-clone install paths via import.meta.dirname resolution
- Status command displaying interaction metrics and hook registration, uninstall command with selective hook removal and --purge data cleanup, integration-tested end-to-end

---

## v1.0 Self-Iteration Engine (Shipped: 2026-04-02)

**Phases completed:** 8 phases, 21 plans, 39 tasks

**Key accomplishments:**

- TypeScript project scaffold with Zod v4 schemas for all data structures, init-on-first-use directory manager, and config loader providing zero-config defaults with user-override support
- 14-pattern secret scrubber with recursive object walking, and JSONL logger implementing validate-scrub-append pipeline with daily rotation
- Atomic interaction counter with proper-lockfile cross-process locking, proven by 2 x 100 = 200 concurrent integration test
- Zod v4 input schemas for all 5 Claude Code hook events plus shared stdin reader and tool input summarizer with 200-char truncation
- 5 Claude Code lifecycle hook handlers capturing prompts, tool usage with duration correlation, permission requests, and failure events via Phase 1 storage pipeline
- tsup multi-entry build for 5 hook entry points plus end-to-end integration tests proving full capture pipeline (prompts, tools with duration, permissions, counter accumulation)
- Zod v4 output schemas (summary + environment snapshot) and generic streaming JSONL reader with date-range filtering
- Map-based frequency counting with cross-session aggregation, prompt normalization, and atomic summary.json output under 50KB
- Filesystem-based environment scanner discovering installed Claude Code tools across user/project scopes with version compatibility checking, plus end-to-end integration test validating the full pre-processing pipeline
- Recommendation schemas, analyzer orchestrator with classifier chain, and three core classifiers (repeated-prompts->HOOK, long-prompts->SKILL, permission-patterns->SETTINGS) with configurable thresholds
- Four secondary classifiers (code-corrections, personal-info, config-drift, ecosystem-adapter) completing the 7-classifier chain with keyword matching, heuristic thresholds, and ecosystem-aware routing
- Threshold trigger with 60s cooldown, locked counter reset, full pipeline orchestration (preProcess->scanEnvironment->analyze->writeResult), and 6 integration tests proving HOOK/SKILL/SETTINGS routing end-to-end
- Delivery schemas, tiered markdown renderer, state lifecycle tracking, and bounded rotation for recommendation output
- Stdout notification injection in UserPromptSubmit hook and /evolve skill with run-evolve entry point for on-demand analysis
- Full-auto mode for HIGH-confidence SETTINGS recommendations with backup, JSONL audit logging, and complete Phase 5 library exports
- Experience level computation with weighted scoring and onboarding classifier producing tier-appropriate start-here/optimize recommendations
- Outcome tracker with persistence detection, JSONL history, and analyzer confidence adjustment creating a feedback loop for recommendation quality improvement
- Stop hook handler wiring checkAndTriggerAnalysis() into Claude Code lifecycle with infinite loop guard
- Wired autoApplyRecommendations() into /evolve pipeline and trackOutcomes()/computeOutcomeSummaries() into analysis pipeline, closing the last two integration gaps
- 5 E2E integration tests validating Stop hook trigger, infinite loop guard, cooldown, outcome tracking, and auto-apply across the full self-improving pipeline
- Aligned permission classifier ID prefix and pattern_type with auto-apply/outcome-tracker consumers, rewrote E2E Flow 5 to use real classifier pipeline

---
