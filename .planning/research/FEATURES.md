# Feature Landscape

**Domain:** Self-improving AI coding agent harness configuration systems
**Researched:** 2026-03-31
**Overall Confidence:** MEDIUM-HIGH (based on GitHub repos, official docs, ecosystem articles)

---

## Competitive Landscape Summary

Before defining features, here is how the ecosystem divides:

| Tool | Primary Focus | Config Targets | Stars (approx) |
|------|--------------|----------------|-----------------|
| **Cog** | Tiered memory + self-reflection | Memory files only | ~2K |
| **Claude-Mem** | Session capture + AI compression | Memory (SQLite + vector DB) | ~21K |
| **Singularity-Claude** | Self-evolving skills with scoring | Skills only | ~1K |
| **claude-reflect** (BayramAnnakov) | Correction capture + skill discovery | CLAUDE.md + skills | ~3K |
| **claude-reflect-system** (Haddock) | Continual learning from corrections | CLAUDE.md (YAML-based) | ~500 |
| **Everything Claude Code** | Harness audit + instincts + security | All config types + security | ~82K |
| **Auto Dream** (Anthropic) | Memory consolidation between sessions | Native memory files | Built-in |
| **Self-improving CLAUDE.md** (seed prompts) | Bootstrap → pattern → promote to rule | CLAUDE.md + rules | Gist-level |
| **dream-skill** | Replicate Auto Dream as a skill | Memory files | ~500 |

**The gap harness-evolve fills:** No existing tool covers ALL configuration targets (hooks, skills, rules, memory, CLAUDE.md, settings, permissions) with automated pattern detection from user interactions. Each tool addresses 1-2 targets; harness-evolve routes to ALL of them.

---

## Table Stakes

Features users expect. Missing = product feels incomplete or undifferentiated.

| # | Feature | Why Expected | Complexity | Confidence | Notes |
|---|---------|-------------|------------|------------|-------|
| T1 | **Interaction capture via hooks** | Every competitor captures some data. Claude-Mem uses 5 hooks; claude-reflect uses UserPromptSubmit. Without capture, there is no data to analyze. | Low | HIGH | Use UserPromptSubmit, PreToolUse, PostToolUse at minimum. PermissionRequest and Stop add value but are secondary. |
| T2 | **Cross-session persistence** | Claude sessions are ephemeral. Every tool in this space persists data to files. Users expect accumulated knowledge, not per-session amnesia. | Low | HIGH | File-based storage in ~/.harness-evolve/. SQLite is overkill for v1 -- plain JSON/JSONL or markdown. |
| T3 | **Pattern detection / analysis** | The core value proposition. Cog does /reflect, claude-reflect detects corrections, Singularity-Claude scores skills. Without pattern detection, it is just a logger. | High | HIGH | This is THE differentiating engine. Must identify: repeated prompts, repeated tool approvals, recurring correction patterns, workflow sequences. |
| T4 | **Structured recommendations output** | Every tool produces actionable output (Cog -> memory tiers, claude-reflect -> CLAUDE.md entries, Singularity -> skill repairs). Raw data without recommendations is useless. | Medium | HIGH | Write to ~/.harness-evolve/recommendations.md with clear structure: what was detected, what is recommended, why, and how to apply. |
| T5 | **Human-in-the-loop approval** | claude-reflect requires human review before syncing. Self-improving CLAUDE.md seed uses AskUserQuestion before structural changes. Auto-executing changes without user awareness is universally considered an anti-feature. | Low | HIGH | Surface recommendations, never auto-apply without explicit opt-in. The seed prompt's "triage into Apply Now / Capture / Dismiss" pattern is excellent UX. |
| T6 | **Non-invasive delivery mechanism** | Users reject tools that interrupt workflow. Cog and claude-reflect wait for explicit /commands. Hooks that inject context at natural breakpoints (session start, after compaction) are the established pattern. | Medium | MEDIUM | Inject via UserPromptSubmit stdout at threshold crossings. Must not feel like an interruption -- present BEFORE handling user's actual request. |
| T7 | **Zero-config installation** | Claude-Mem's "smart install" pre-hook validates dependencies. Cog requires only dropping files. Users in this space expect `claude plugin add` or dropping a directory. | Low | HIGH | Must work immediately after install with sensible defaults. No database setup, no external services. |
| T8 | **Configurable thresholds** | Singularity-Claude exposes autoRepairThreshold, crystallizationThreshold in config.json. Every tool allows tuning sensitivity. | Low | HIGH | Configurable interaction count before analysis (default 50), analysis depth, which hooks to enable. Store in ~/.harness-evolve/config.json. |

---

## Differentiators

Features that set harness-evolve apart. Not expected (competitors lack them), but highly valued.

| # | Feature | Value Proposition | Complexity | Confidence | Notes |
|---|---------|-------------------|------------|------------|-------|
| D1 | **Multi-target routing (hooks/skills/rules/memory/CLAUDE.md/settings/permissions)** | THE core differentiator. Cog routes only to memory. Singularity-Claude routes only to skills. claude-reflect routes to CLAUDE.md + skills. No tool routes to ALL 7+ configuration targets. This is what makes harness-evolve unique. | High | HIGH | Requires a classification engine that can distinguish: "this pattern needs a hook" (deterministic, must happen every time) vs "this pattern needs a skill" (multi-step workflow) vs "this pattern needs a rule" (domain-specific preference) vs "this pattern needs a memory entry" (contextual fact). |
| D2 | **Dynamic environment discovery** | No competitor scans what tools the user actually has installed. Everything-Claude-Code audits configurations but doesn't adapt recommendations. Harness-evolve discovers Cog, Claude-Mem, GSD, etc. and adjusts routing accordingly. | Medium | MEDIUM | Scan settings.json (enabledPlugins), .claude/ directory structure, plugin SKILL.md metadata. If user has Cog installed, recommend memory-tier entries. If user has GSD, recommend .planning/ patterns. |
| D3 | **Permission pattern analysis** | No competitor explicitly analyzes PermissionRequest hook data. Repeated "always allow" approvals for the same tool are a clear signal to recommend adding that tool to allowedTools in settings.json. | Low-Medium | HIGH | Low-hanging fruit differentiator. Count permission approvals per tool per session. If tool X is approved >10 times across 3+ sessions, recommend adding to allowedTools. |
| D4 | **Routing decision tree with extensibility** | Cog evolves memory conventions. Singularity-Claude has a fixed scoring rubric. Neither has an extensible classification system that adapts when Claude Code adds new configuration mechanisms (e.g., if Anthropic adds a new hook type or config target). | High | MEDIUM | The decision tree must be data-driven, not hard-coded. When a new config target appears, the tree should accommodate it without code changes. |
| D5 | **Tiered onboarding (zero-config vs power user)** | Claude-Mem has "smart install" but treats all users the same. Cog's /setup asks about domains but doesn't adapt to existing config complexity. Detecting whether a user has 0 rules or 50 rules and adjusting recommendations accordingly is novel. | Medium | MEDIUM | Scan existing .claude/ structure on first run. Zero-config users get "start here" recommendations. Power users get "optimize what you have" recommendations (redundancy detection, mechanization opportunities). |
| D6 | **Log pre-processing / compression before analysis** | Claude-Mem compresses with AI. Cog uses progressive condensation. But neither addresses the specific problem of feeding 50 sessions of raw hook data into an analysis agent. Shell-based pre-processing (frequency counts, top-N extraction) before agent analysis is novel. | Medium | MEDIUM | Use shell scripts (grep, sort, uniq -c, head) to extract statistical summaries from raw logs. Feed compressed summaries to analysis agent, not raw data. Keeps agent context window manageable. |
| D7 | **Prompt-to-command detection** | claude-reflect discovers skills from session history. But harness-evolve can detect when a user's prompt exceeds 200 words and is essentially a manual skill invocation, recommending skill creation. Also detect repeated short prompts that should become hooks or aliases. | Medium | HIGH | Threshold-based: >200 word prompts repeated 2+ times -> suggest skill. Same 1-line prompt >5 times -> suggest alias/hook. Same correction pattern >3 times -> suggest rule. |
| D8 | **Configuration drift / redundancy detection** | Everything-Claude-Code audits for security issues. The self-improving CLAUDE.md seed has anti-proliferation guardrails (context budgets, <100 line CLAUDE.md). But no tool specifically detects when rules contradict CLAUDE.md, or when a memory entry duplicates a rule. | High | MEDIUM | Compare content across .claude/rules/, CLAUDE.md, memory files, and settings.json. Flag: contradictions, duplications, rules that should be hooks, memories that should be rules. |
| D9 | **Full-auto mode (opt-in)** | All competitors require manual triggers (/reflect, /evolve, /housekeeping). Power users who trust the system should be able to opt into automatic application of HIGH-confidence recommendations. | Low | HIGH | Gate behind explicit config flag (autoApply: true). Only auto-apply recommendations above a confidence threshold. Always log what was applied. |

---

## Anti-Features

Features to explicitly NOT build. These are tempting but harmful.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|-------------|-----------|-------------------|
| AF1 | **Auto-executing recommendations without awareness** | The self-improving CLAUDE.md seed's biggest lesson: "Before structural changes, Claude uses AskUserQuestion to validate evolution with the user rather than drifting silently." Silent mutation of user configs erodes trust. Even Auto Dream, an Anthropic first-party feature, generated controversy for silently modifying memory files. | Always surface recommendations first. Full-auto mode is opt-in and still logs everything. Default is "recommend, don't apply." |
| AF2 | **Building a web UI or dashboard** | Claude Code is CLI-native. Users in this ecosystem work in terminals. Claude-Mem's localhost:37777 web viewer exists but is not its core value. A dashboard adds maintenance burden and splits the interface. | Stay text-based. Markdown output files, CLI commands, stdout injection. If visualization is needed, generate ASCII tables or point users to their existing tools. |
| AF3 | **Replacing existing tools (Cog, Claude-Mem, GSD)** | The ecosystem has 9,600+ repositories. Users are invested in their tools. Trying to absorb or replace creates friction and enemies. Everything-Claude-Code's 82K stars came from complementing, not competing. | Be an agnostic layer. Detect what is installed, route recommendations to existing tools. If user has Cog, recommend Cog memory entries. If user has nothing, recommend native Claude Code configs. |
| AF4 | **Requiring external services or databases** | Claude-Mem requires SQLite + Chroma + Bun. Cog requires nothing beyond files. The lower the dependency count, the higher the adoption. Every external dependency is a failure point and an installation barrier. | Plain files only for v1. JSON/JSONL logs, markdown recommendations. No SQLite, no vector DB, no HTTP servers, no external runtimes beyond what Claude Code already provides. |
| AF5 | **Capturing and storing full conversation content** | Privacy concern. Claude-Mem captures full tool I/O. Storing complete prompts and responses in plaintext raises security issues (API keys, credentials, personal data may appear in prompts). | Capture metadata only: prompt length, tool names, timestamps, session IDs, permission decisions. Use transcript_path for analysis but do not copy transcript content to harness-evolve's own storage. |
| AF6 | **Building a vector database for semantic search** | Claude-Mem uses Chroma. This is powerful but overkill for pattern detection. Semantic similarity is not needed when you are counting frequency of exact or near-exact patterns. | Use frequency counting and simple string matching for v1. Shell tools (grep, sort, uniq -c) are sufficient for statistical pattern extraction. Semantic analysis can happen in the agent step, not in storage. |
| AF7 | **Supporting non-Claude-Code agents** | Everything-Claude-Code expanded to Codex, OpenCode, Cursor. This dilutes focus and multiplies the API surface. Claude Code's hooks system is unique and specific. | Stay Claude Code exclusive. The hooks API, settings.json format, and CLAUDE.md conventions are Claude-specific. Generalizing loses the deep integration advantage. |
| AF8 | **Excessive memory file proliferation** | Auto Dream exists specifically to solve the problem of memory files growing out of control. The self-improving CLAUDE.md seed enforces: "CLAUDE.md stays <100 lines; rules remain <200 total." Creating more files does not equal more intelligence. | Enforce output budgets. Recommendations go to ONE file. Logs rotate and compress. Never create unbounded file growth. Recommend consolidation, not proliferation. |
| AF9 | **Real-time interruption during active tasks** | Injecting recommendations mid-coding-flow breaks concentration. Even claude-reflect's post-commit reminders were cited as friction by some users. The worst UX is "I was mid-thought and the tool interrupted me." | Inject only at natural breakpoints: session start, after compaction, at threshold crossings on the NEXT user prompt (before Claude processes it). Never mid-response or mid-tool-execution. |
| AF10 | **Complex scoring rubrics for recommendations** | Singularity-Claude's 5-dimension x 20-point scoring system works for skill evolution but is overengineered for configuration recommendations. Users do not need a 0-100 score; they need "do this, here's why." | Use simple confidence tiers: HIGH (strong signal, high frequency), MEDIUM (moderate signal), LOW (weak signal, suggest monitoring). No numeric scores -- just tiers with explanations. |

---

## Feature Dependencies

```
T1 (Interaction capture) ──────┐
                               ├──> T3 (Pattern detection) ──> T4 (Recommendations)
T2 (Cross-session persistence) ┘                                     │
                                                                      ├──> T5 (Human approval)
                                                                      ├──> T6 (Non-invasive delivery)
                                                                      └──> D9 (Full-auto mode, opt-in)

D2 (Environment discovery) ──> D1 (Multi-target routing)
                                     │
                                     ├──> D3 (Permission pattern analysis)
                                     ├──> D7 (Prompt-to-command detection)
                                     └──> D8 (Config drift detection)

T7 (Zero-config install) ──> D5 (Tiered onboarding)

D6 (Log pre-processing) ──> T3 (Pattern detection)
                             (required when log volume exceeds agent context)

T8 (Configurable thresholds) ──> standalone, no dependencies
D4 (Extensible decision tree) ──> standalone, enhances D1
```

### Critical Path

```
T1 + T2 → T3 → D1 → T4 → T5/T6
```

Interaction capture and persistence are prerequisites for everything. Pattern detection is the engine. Multi-target routing is the differentiator. Recommendations + delivery are the user-facing output.

---

## MVP Recommendation

### Phase 1: Foundation (Must Ship)

Prioritize these table stakes to be a functional tool:

1. **T1 - Interaction capture** (UserPromptSubmit + PermissionRequest hooks)
2. **T2 - Cross-session persistence** (file-based logging to ~/.harness-evolve/logs/)
3. **T7 - Zero-config installation** (drop-in hooks, no setup required)
4. **T8 - Configurable thresholds** (config.json with sensible defaults)

### Phase 2: Intelligence (Core Value)

Add the analysis engine that makes this more than a logger:

5. **T3 - Pattern detection** (frequency analysis, repeated prompt detection, permission patterns)
6. **D6 - Log pre-processing** (shell-based compression before agent analysis)
7. **T4 - Structured recommendations** (output to recommendations.md)
8. **T5 - Human approval flow** (surface recommendations, user decides)

### Phase 3: Differentiation (Competitive Advantage)

Features no competitor has:

9. **D1 - Multi-target routing** (the routing decision tree)
10. **D2 - Dynamic environment discovery** (scan for installed tools)
11. **D3 - Permission pattern analysis** (settings.json allowedTools recommendations)
12. **T6 - Non-invasive delivery** (UserPromptSubmit stdout injection)

### Phase 4: Power Features

Polish and depth:

13. **D5 - Tiered onboarding** (detect config complexity level)
14. **D7 - Prompt-to-command detection** (skill/hook suggestion from prompt patterns)
15. **D8 - Configuration drift detection** (redundancy/contradiction finder)
16. **D9 - Full-auto mode** (opt-in automatic application)

### Defer Indefinitely

- **D4 - Extensible decision tree** - Premature abstraction. Hard-code the routing logic for known targets first. Make it extensible only when a new target actually appears.
- Web UI, database layer, vector search, multi-agent support.

---

## Sources

### Primary (GitHub Repositories -- HIGH confidence)
- [Cog - Cognitive Architecture for Claude Code](https://github.com/marciopuga/cog)
- [Claude-Mem - Session Memory Plugin](https://github.com/thedotmack/claude-mem)
- [Singularity-Claude - Self-Evolving Skills](https://github.com/Shmayro/singularity-claude)
- [claude-reflect - Self-Learning System](https://github.com/BayramAnnakov/claude-reflect)
- [claude-reflect-system - Continual Learning](https://github.com/haddock-development/claude-reflect-system)
- [Everything Claude Code - Harness Optimization](https://github.com/affaan-m/everything-claude-code)
- [dream-skill - Memory Consolidation](https://github.com/grandamenium/dream-skill)
- [Self-Improving CLAUDE.md Seed Prompt](https://gist.github.com/ChristopherA/fd2985551e765a86f4fbb24080263a2f)

### Official Documentation (HIGH confidence)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide)
- [Claude Code Memory](https://code.claude.com/docs/en/memory)
- [Claude Code Skills](https://code.claude.com/docs/en/skills)
- [Claude Code Settings](https://code.claude.com/docs/en/settings)

### Articles and Analysis (MEDIUM confidence)
- [Claude-Mem Plugin Review 2026](https://trigidigital.com/blog/claude-mem-plugin-review-2026/)
- [Claude Code Dreams: Auto Dream Feature](https://claudefa.st/blog/guide/mechanics/auto-dream)
- [Harness Engineering Complete Guide 2026](https://www.nxcode.io/resources/news/what-is-harness-engineering-complete-guide-2026)
- [Rules vs Skills in Claude Code](https://dev.to/jeffreese/rules-vs-skills-in-claude-code-5cfi)
- [Self-Improving Agentic System with Claude](https://www.productcompass.pm/p/self-improving-claude-system)
- [Auto Memory is Not Learning](https://medium.com/@brentwpeterson/automatic-memory-is-not-learning-4191f548df4c)

### Ecosystem Data (MEDIUM confidence)
- [Awesome Claude Code Toolkit](https://github.com/rohitg00/awesome-claude-code-toolkit) - 9,602+ repositories tracked
- [Awesome Claude Plugins](https://github.com/quemsah/awesome-claude-plugins) - adoption metrics
- [HN Discussion: Cog](https://news.ycombinator.com/item?id=47524704)
