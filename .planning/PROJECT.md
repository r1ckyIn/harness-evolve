# harness-evolve

## What This Is

An open-source, environment-agnostic self-iteration engine for Claude Code. It observes how users interact with Claude Code via lifecycle hooks, detects patterns through 8 classifiers, and outputs optimization recommendations routed to the most appropriate configuration tool (hooks, skills, rules, CLAUDE.md, memory, settings, permissions). The system dynamically discovers what tools are available in the user's environment and adapts its recommendations accordingly. Full pipeline operational: capture -> store -> pre-process -> classify -> route -> deliver -> track outcomes.

## Core Value

**Make Claude Code harnesses self-improving without manual analysis.** Users shouldn't need to notice that they've typed the same command 20 times before creating a hook — the system should surface that insight and suggest the fix.

## Requirements

### Validated

- [x] Capture user prompts via UserPromptSubmit hook with timestamps and session tracking — Validated in Phase 2: collection-hooks
- [x] Capture permission approval/denial patterns via PermissionRequest hook — Validated in Phase 2: collection-hooks
- [x] Capture tool usage patterns via PreToolUse/PostToolUse hooks — Validated in Phase 2: collection-hooks
- [x] Access full conversation transcripts via transcript_path for context enrichment — Validated in Phase 2: collection-hooks
- [x] Persist interaction logs across sessions in ~/.harness-evolve/logs/ — Validated in Phase 1: foundation-storage
- [x] Count interactions per session with file-based counter — Validated in Phase 1: foundation-storage
- [x] Pre-processing layer to compress large log data before agent analysis — Validated in Phase 3: pre-processing-environment-discovery
- [x] Cross-session pattern aggregation (not just within single sessions) — Validated in Phase 3: pre-processing-environment-discovery
- [x] Dynamically discover user's installed tools by scanning settings.json, .claude/ directory, enabledPlugins, and plugin metadata — Validated in Phase 3: pre-processing-environment-discovery
- [x] Adapt routing targets when new Claude Code features are detected (version check) — Validated in Phase 3: pre-processing-environment-discovery
- [x] Trigger automated pattern analysis at configurable threshold (default: 50 interactions) — Validated in Phase 4: analysis-engine-routing
- [x] Classify detected patterns using an extensible routing decision tree — Validated in Phase 4: analysis-engine-routing
- [x] Recommend hook creation for patterns requiring 100% reliable execution — Validated in Phase 4: analysis-engine-routing
- [x] Recommend skill creation for repeated multi-step workflows (>200 words prompts) — Validated in Phase 4: analysis-engine-routing
- [x] Recommend rule creation for recurring code preferences — Validated in Phase 4: analysis-engine-routing
- [x] Recommend memory entries for personal/contextual information — Validated in Phase 4: analysis-engine-routing
- [x] Recommend permission additions for frequently approved tools — Validated in Phase 4: analysis-engine-routing
- [x] Recommend CLAUDE.md updates for project-level configuration — Validated in Phase 4: analysis-engine-routing
- [x] Support manual on-demand analysis via /evolve command — Validated in Phase 5: delivery-user-interaction
- [x] Non-invasive recommendation delivery via UserPromptSubmit stdout injection — Validated in Phase 5: delivery-user-interaction
- [x] Provide full-auto mode option for HIGH-confidence recommendations — Validated in Phase 5: delivery-user-interaction
- [x] Output structured recommendations to ~/.harness-evolve/recommendations.md — Validated in Phase 5: delivery-user-interaction
- [x] Tiered onboarding: detect existing config level (zero-config for new users, enhancement for power users) — Validated in Phase 6: onboarding-quality-polish
- [x] Recommendation outcome tracking: monitor persistence/reversion, adjust future confidence — Validated in Phase 6: onboarding-quality-polish

- [x] Fix inferPatternType string mismatches for 7/8 classifiers via shared PatternType enum — Validated in Phase 9: tech-debt-auto-apply
- [x] Fix flaky concurrent-counter test with hardened lock retry config — Validated in Phase 9: tech-debt-auto-apply
- [x] Expand auto-apply with strategy pattern applier registry (SETTINGS + RULE targets) — Validated in Phase 9: tech-debt-auto-apply
- [x] Complete npm package.json metadata, files whitelist, ESM exports map — Validated in Phase 10: npm-package-ci-cd-pipeline
- [x] CLI bin entry pointing to compiled Commander.js program — Validated in Phase 10: npm-package-ci-cd-pipeline
- [x] GitHub Actions CI (build+test+typecheck+publint+attw) — Validated in Phase 10: npm-package-ci-cd-pipeline
- [x] Automated npm publish via OIDC trusted publishing on v* tags — Validated in Phase 10: npm-package-ci-cd-pipeline
- [x] Commander.js CLI with init subcommand for hook registration — Validated in Phase 11: cli-commands-install-experience
- [x] Hook path resolution for global, npx, and git clone installs — Validated in Phase 11: cli-commands-install-experience
- [x] Status command showing interaction count, last analysis, pending recommendations, hook registration — Validated in Phase 11: cli-commands-install-experience
- [x] Uninstall command removing hooks from settings.json with optional data purge — Validated in Phase 11: cli-commands-install-experience
- [x] Full init -> status -> uninstall CLI lifecycle — Validated in Phase 11: cli-commands-install-experience

- [x] Deep scan: `harness-evolve init` scans CLAUDE.md, rules, settings, commands and generates config quality report — Validated in Phase 12: deep-scan-infrastructure
- [x] Deep scan detects redundancy, missing mechanization, and staleness across config files — Validated in Phase 12: deep-scan-infrastructure
- [x] Scan results output as structured Recommendation[], reusing existing delivery pipeline — Validated in Phase 12: deep-scan-infrastructure

- [x] Generate .claude/commands/<name>.md skill file drafts from long_prompt SKILL recommendations — Validated in Phase 13: auto-generators
- [x] Generate shell command hook script drafts from mechanization/repeated_prompt HOOK recommendations — Validated in Phase 13: auto-generators
- [x] Generate CLAUDE.md patches in diff format from CLAUDE_MD-targeted recommendations — Validated in Phase 13: auto-generators

- [x] Auto-apply HIGH-confidence HOOK recommendations: write script to disk with +x, register in settings.json — Validated in Phase 14: auto-apply-closure
- [x] Auto-apply HIGH-confidence CLAUDE_MD recommendations: append section to CLAUDE.md with atomic write — Validated in Phase 14: auto-apply-closure

- [x] `harness-evolve init` installs `/evolve:scan` and `/evolve:apply` slash commands to `.claude/commands/evolve/` — Validated in Phase 15: slash-commands-interactive-apply
- [x] On-demand deep scan via `harness-evolve scan` CLI, outputting structured JSON recommendations — Validated in Phase 15: slash-commands-interactive-apply
- [x] Interactive apply workflow: `pending`, `apply-one <id>`, `dismiss <id>` CLI subcommands for `/evolve:apply` — Validated in Phase 15: slash-commands-interactive-apply
- [x] `harness-evolve uninstall` removes slash command files with graceful cleanup — Validated in Phase 15: slash-commands-interactive-apply

- [x] Post-analysis notification is a concise one-liner referencing /evolve:apply, not a file path — Validated in Phase 16: ux-polish
- [x] `harness-evolve init` displays a one-line purpose description next to each hook event — Validated in Phase 16: ux-polish
- [x] Recommendations sorted by impact (HIGH → MEDIUM → LOW) in CLI output — Validated in Phase 16: ux-polish

- [x] Slash commands install to global ~/.claude/commands/evolve/ (works in any directory) — Validated in Phase 17: bug-fixes-reliability
- [x] Scanner filters npm scoped packages and URL @ patterns from false positives — Validated in Phase 17: bug-fixes-reliability
- [x] apply-one CLI skips confidence gate for user-initiated applies — Validated in Phase 17: bug-fixes-reliability
- [x] Stop hook analysis writes notification flag for UserPromptSubmit — Validated in Phase 17: bug-fixes-reliability

- [x] Scanner performs full-spectrum config audit: CLAUDE.md conflict detection, rules structure audit, hooks redundancy analysis, commands convention check — Validated in Phase 18: comprehensive-config-audit
- [x] Each audit finding includes concrete optimization suggestion with expected effect text — Validated in Phase 18: comprehensive-config-audit
- [x] Audit output separates problems (broken/conflicting) from suggestions (optional improvements) with severity labels — Validated in Phase 18: comprehensive-config-audit

- [x] Each slash command (/evolve:scan, /evolve:apply) has a comprehensive workflow .md document with structured sections (Prerequisites, Instructions, Output Format, Error Handling, Edge Cases) — Validated in Phase 19: workflow-documentation
- [x] Workflow documentation injected via slash command template (self-contained, no CLAUDE.md preload dependency), with allowed-tools frontmatter and version tracking — Validated in Phase 19: workflow-documentation
- [x] Version-aware template update mechanism ensures existing users get updated workflow docs on next init — Validated in Phase 19: workflow-documentation

### Active

(All v3.0 requirements validated — milestone complete)

## Current Milestone: v3.0 Reliability & Config Audit

**Goal:** 修复 v2.0 dogfooding 发现的 bug，将 scanner 从浅层检测升级为全面配置审计

**Target features:**
- 斜杠命令全局安装（~/.claude/commands/）
- Scanner 误报修复（过滤 npm 包名、URL 中的 @）
- apply-one 移除 confidence 门槛（用户主动选择不限制）
- Stop hook 分析后自动设置通知标记
- 全面配置审计（整体质量分析，不只 stale reference）
- GSD 风格 workflow 文档（每个命令有完整 .md 规范行为）
- Version-aware 模板更新（已有用户 re-init 后自动获取新版 workflow）

## Shipped Milestones

### v2.0 Deep Scan & Auto-Generation (shipped 2026-04-04)
Deep scan infrastructure, auto-generators (skill/hook/CLAUDE.md), auto-apply closure (4 appliers), slash commands (/evolve:scan, /evolve:apply), UX polish. 5 phases, 10 plans. Published to npm as `harness-evolve@1.0.0`.

### v1.1 Stabilization & Production (shipped 2026-04-04)
Tech debt fixes, npm publish readiness, CI/CD pipeline, Commander.js CLI with init/status/uninstall. 3 phases, 7 plans.

### v1.0 Self-Iteration Engine (shipped 2026-04-02)
Full pipeline: capture -> store -> pre-process -> classify -> route -> deliver -> track outcomes. 8 phases, 21 plans, 2 days.

### Out of Scope

- Replacing existing tools (GSD, Cog, Claude-Mem) — complement, not compete
- Auto-executing recommendations without user awareness (always surface first, auto-execute only if user opts in)
- Modifying files in external tool directories (only suggest, never touch GSD's .planning/ etc.)
- Building a web UI or dashboard — CLI-native, text-based
- Supporting non-Claude-Code AI coding agents (Cursor, Copilot) — Claude Code specific

## Context

### Origin

Born from a real harness engineering optimization session where a user's Claude Code configuration had accumulated significant redundancy, conflicts, and missed mechanization opportunities across CLAUDE.md files, rules, settings, and skills. The manual audit revealed patterns that should have been caught automatically.

### Technical Environment

- Claude Code hooks system (21 lifecycle events, 4 handler types as of March 2026)
- Key hooks: UserPromptSubmit (user input), PermissionRequest (approval patterns), PreToolUse/PostToolUse (tool patterns), Stop (session end), SessionStart (initialization)
- Conversation history stored in ~/.claude/projects/[hash]/[uuid].jsonl
- Configuration hierarchy: ~/.claude/settings.json > project .claude/settings.json > .claude/settings.local.json
- CLAUDE.md and .claude/rules/ traverse parent directories; settings.json and skills do NOT

### Ecosystem Positioning

Agnostic layer — works with any combination of workflow tools:
- No GSD? Works standalone with hooks/skills/rules/CLAUDE.md
- Has GSD? Recommendations include GSD-specific suggestions (slash commands, planning patterns)
- Has Cog? Leverages Cog's memory tiers in recommendations
- Has Claude-Mem? Considers captured observations in analysis
- Has unknown Tool X? Detects its presence, reads its metadata, incorporates into routing

### Prior Art

| Tool | What it does | How we differ |
|------|-------------|---------------|
| Cog | Tiered memory + /reflect + /evolve | We route to ALL config tools, not just memory |
| Claude-Mem | Capture tool usage + AI compress | We capture user input too + classify into routing targets |
| Singularity-Claude | Self-evolving skills | We cover hooks/rules/settings/memory, not just skills |
| Auto Dream (Anthropic) | Memory consolidation between sessions | We go beyond memory — we optimize the entire harness |
| Self-Improving CLAUDE.md | Memory → pattern → promote to rule | We mechanize the detection + add hooks/skills/settings as targets |

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Agnostic layer, not absorb/replace | Future-proof — adapts to any new tool without rebuilding | Good — ecosystem scanner detects GSD/Cog/plugins dynamically |
| Open-source from start | Community validation + contributions on routing heuristics | Active |
| Non-invasive recommendation delivery | Respect user flow — inject at natural break points, not interrupt mid-task | Good — stdout injection + /evolve dual-channel works |
| File-based counter (not in-memory) | Must survive across sessions and Claude Code restarts | Good — proper-lockfile proven with concurrent test |
| Pre-processing before agent analysis | 50 sessions of logs can exceed agent context window | Good — summary.json under 50KB target |
| Tiered onboarding | Zero-config for beginners, enhancement mode for power users | Good — 3-tier scoring with weighted factors |
| Zod v4 for all schemas | 14x faster than v3, TypeScript-first | Good — clean inference with .default() pattern |
| proper-lockfile for cross-process locking | macOS Ventura lacks flock | Good — retry-based with stale detection |
| v1 auto-apply scope limited to permissions only | Minimize blast radius for auto-modifications | Expanded in Phase 9 — strategy pattern applier registry with SETTINGS + RULE appliers |
| ESM-only npm publish | Node 22+ target, Claude Code is ESM | Good — publint + attw validate exports |
| npm OIDC trusted publishing | No static tokens in CI | Good — v* tag triggers automated publish |
| Commander.js 14 over oclif | Lightweight for ~5 commands | Good — 3 commands registered, extensible |
| import.meta.dirname for hook path resolution | ESM-native, works across install methods | Good — global, npx, git clone all resolve correctly |

## Technical Gray Areas (v1.0 Resolution)

| # | Area | Risk | Resolution |
|---|------|------|------------|
| 1 | UserPromptSubmit stdout injection | Probabilistic behavior | Implemented with config-gated flag + /evolve fallback. Needs human validation. |
| 2 | Dynamic plugin capability discovery | No official API | Filesystem scanner reads settings.json + .claude/ + plugin metadata. Working. |
| 3 | Multi-instance counter race condition | File corruption | proper-lockfile with retries. Concurrent test proves 2x100=200 exact. |
| 4 | Agent context window for large logs | Exceeds context | Shell pre-processing compresses to <50KB summary.json. Resolved. |

## Current State (Phase 19.1 complete — v3.0 integration testing done)

- **Codebase:** ~21,000 LOC TypeScript (src + tests)
- **Tests:** 708 passing across 62 test files
- **npm:** Published as `harness-evolve@1.0.0`
- **Build:** tsup produces 9 entry points (5 hooks + stop + run-evolve + cli + index)
- **Classifiers:** 8 (repeated-prompts, long-prompts, permission-patterns, code-corrections, personal-info, config-drift, ecosystem-adapter, onboarding)
- **Scanners:** 7 (redundancy, mechanization, staleness, conflict, structure, hooks-redundancy, commands) — comprehensive config audit
- **Generators:** 3 (skill, hook, claude-md-patch) — pure functions, no filesystem access
- **Appliers:** 4 (settings, rule, hook, claude-md) — strategy pattern registry, auto-apply pipeline complete
- **npm:** Publishable with complete metadata, exports map (8 subpaths), bin field, files whitelist
- **CI/CD:** GitHub Actions CI (build+test+typecheck+publint+attw) + Publish (OIDC v* tag)
- **CLI:** Commander.js with 3 commands (init, status, uninstall), hook path resolution for all install methods
- **Slash commands:** /evolve:scan and /evolve:apply with comprehensive GSD-style workflow documents (143/163 lines), version-aware template updates, allowed-tools frontmatter
- **UX:** Concise notifications, hook descriptions in init, severity-grouped output, self-contained slash command behavior

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 — Phase 19.1 integration testing complete (39/39 tests passed). v3.0 milestone fully verified end-to-end.*
