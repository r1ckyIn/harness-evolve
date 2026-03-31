# harness-evolve

## What This Is

An open-source, environment-agnostic self-iteration engine for Claude Code. It observes how users interact with Claude Code, detects patterns, and outputs optimization recommendations routed to the most appropriate configuration tool (hooks, skills, rules, CLAUDE.md, memory, settings, or any future mechanism). The system dynamically discovers what tools are available in the user's environment and adapts its recommendations accordingly.

## Core Value

**Make Claude Code harnesses self-improving without manual analysis.** Users shouldn't need to notice that they've typed the same command 20 times before creating a hook — the system should surface that insight and suggest the fix.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Capture user prompts via UserPromptSubmit hook with timestamps and session tracking
- [ ] Capture permission approval/denial patterns via PermissionRequest hook
- [ ] Capture tool usage patterns via PreToolUse/PostToolUse hooks
- [ ] Access full conversation transcripts via transcript_path for context enrichment
- [ ] Persist interaction logs across sessions in ~/.harness-evolve/logs/
- [ ] Count interactions per session with file-based counter
- [ ] Trigger automated pattern analysis at configurable threshold (default: 50 interactions)
- [ ] Support manual on-demand analysis via /evolve command
- [ ] Non-invasive recommendation delivery: inject suggestions via UserPromptSubmit stdout on the interaction after threshold, Claude presents them before handling user's actual request
- [ ] Provide full-auto mode option for users who don't want to be interrupted
- [ ] Dynamically discover user's installed tools by scanning settings.json, .claude/ directory, enabledPlugins, and plugin metadata
- [ ] Classify detected patterns using an extensible routing decision tree
- [ ] Output structured recommendations to ~/.harness-evolve/recommendations.md
- [ ] Recommend hook creation for patterns requiring 100% reliable execution
- [ ] Recommend skill creation for repeated multi-step workflows (>200 words prompts)
- [ ] Recommend rule creation for recurring code preferences
- [ ] Recommend memory entries for personal/contextual information
- [ ] Recommend permission additions for frequently approved tools
- [ ] Recommend CLAUDE.md updates for project-level configuration
- [ ] Adapt routing targets when new Claude Code features are detected (version check)
- [ ] Tiered onboarding: detect existing config level (zero-config for new users, enhancement for power users)
- [ ] Pre-processing layer to compress large log data before agent analysis
- [ ] Cross-session pattern aggregation (not just within single sessions)

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
| Agnostic layer, not absorb/replace | Future-proof — adapts to any new tool without rebuilding | — Active |
| Open-source from start | Community validation + contributions on routing heuristics | — Active |
| Non-invasive recommendation delivery | Respect user flow — inject at natural break points, not interrupt mid-task | — Active |
| File-based counter (not in-memory) | Must survive across sessions and Claude Code restarts | — Active |
| Pre-processing before agent analysis | 50 sessions of logs can exceed agent context window | — Active |
| Tiered onboarding | Zero-config for beginners, enhancement mode for power users | — Active |

## Technical Gray Areas (Needs Validation)

| # | Area | Risk | Validation Plan |
|---|------|------|-----------------|
| 1 | UserPromptSubmit stdout injection for recommendations | Claude may not reliably "present first, then answer" — probabilistic behavior | Test with structured format markers, iterate on prompt engineering |
| 2 | Dynamic plugin capability discovery | No official API to list installed plugins + their capabilities | Parse enabledPlugins from settings.json + read SKILL.md metadata from marketplace paths |
| 3 | Multi-instance counter race condition | Concurrent Claude Code instances may corrupt file-based counter | Use atomic file operations or accept as low-probability edge case |
| 4 | Agent context window for large log analysis | 50 sessions of data may exceed Stop hook agent's context | Shell pre-processing extracts top-N patterns with frequency counts, feeds compressed summary to agent |

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
*Last updated: 2026-03-31 after initialization*
