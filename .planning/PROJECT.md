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

### Active

(Defined in REQUIREMENTS.md for v1.1)

## Current Milestone: v1.1 Stabilization & Production

**Goal:** Fix tech debt from v1.0 audit, make the project production-ready for npm publish with CI/CD

**Target features:**
- Fix inferPatternType string mismatch (7/8 classifiers)
- Expand auto-apply scope beyond permissions-only
- Fix flaky concurrent-counter test
- npm publish setup (package.json metadata, bin entry, install docs)
- CI/CD pipeline (GitHub Actions: build + test + typecheck)
- CLI command (`harness-evolve init` for hook registration)
- Installation experience optimization (npx support)

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

## Technical Gray Areas (v1.0 Resolution)

| # | Area | Risk | Resolution |
|---|------|------|------------|
| 1 | UserPromptSubmit stdout injection | Probabilistic behavior | Implemented with config-gated flag + /evolve fallback. Needs human validation. |
| 2 | Dynamic plugin capability discovery | No official API | Filesystem scanner reads settings.json + .claude/ + plugin metadata. Working. |
| 3 | Multi-instance counter race condition | File corruption | proper-lockfile with retries. Concurrent test proves 2x100=200 exact. |
| 4 | Agent context window for large logs | Exceeds context | Shell pre-processing compresses to <50KB summary.json. Resolved. |

## Current State (Phase 10 complete)

- **Codebase:** ~12,000 LOC TypeScript (src + tests)
- **Tests:** 397 passing across 40 test files
- **Build:** tsup produces 9 entry points (5 hooks + stop + run-evolve + cli + index)
- **Classifiers:** 8 (repeated-prompts, long-prompts, permission-patterns, code-corrections, personal-info, config-drift, ecosystem-adapter, onboarding)
- **npm:** Publishable with complete metadata, exports map (8 subpaths), bin field, files whitelist
- **CI/CD:** GitHub Actions CI (build+test+typecheck+publint+attw) + Publish (OIDC v* tag)
- **CLI:** Stub entry point (`harness-evolve` command) — Phase 11 adds Commander.js commands

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
*Last updated: 2026-04-03 after Phase 10 completion — npm publishable, CI/CD configured, dynamic badges*
