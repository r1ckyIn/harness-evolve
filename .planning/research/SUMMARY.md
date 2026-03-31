# Research Summary: harness-evolve

**Domain:** Self-improving Claude Code harness configuration system
**Researched:** 2026-03-31
**Overall confidence:** MEDIUM-HIGH

## Executive Summary

The Claude Code self-improvement ecosystem is maturing rapidly but remains fragmented. As of March 2026, at least 9 distinct tools address pieces of the "make Claude Code better over time" problem: Cog (tiered memory + reflection), Claude-Mem (session capture + AI compression + vector retrieval), Singularity-Claude (self-evolving skills with scoring loops), claude-meta (CLAUDE.md self-improvement via reflection prompts), claude-user-input-logger (raw interaction capture), claude-reflect (correction detection), and Anthropic's own Auto Dream (memory consolidation between sessions). Each tool focuses on 1-2 configuration targets. None covers all seven+ targets (hooks, skills, rules, memory, CLAUDE.md, settings, permissions) with automated detection.

The architecture of harness-evolve follows a pipeline pattern validated by multiple prior art systems: **collect (hooks) -> store (JSONL) -> compress (shell pre-processing) -> analyze (agent classification) -> route (decision tree) -> deliver (stdout injection + file)**. This pipeline separates the zero-cost collection layer (shell command hooks firing on every interaction) from the expensive analysis layer (agent hook firing only at threshold boundaries). The two-phase analysis pattern -- shell extracts frequency statistics, agent classifies into routing targets -- is inspired by Claude-Mem's three-layer retrieval and Auto Dream's four-phase consolidation, adapted for the different problem of pattern detection vs. semantic retrieval.

The technology stack discussion surfaced a meaningful tension between pure shell scripts (zero dependencies, 5ms latency, but limited expressiveness) and Node.js + TypeScript (better schema validation, type safety, but adds runtime dependency and cold-start latency). The STACK.md research recommends Node.js/TypeScript for the full system; the ARCHITECTURE.md research recommends shell for collection hooks specifically. The resolution is likely a hybrid: compiled TypeScript for the core system (counter, pre-processor, environment scanner, recommendation formatter) distributed as a plugin, with the hot-path collection hooks kept as thin shell scripts that delegate to the compiled core. This aligns with how Claude-Mem implements its hooks (shell wrappers calling into a worker) while keeping the latency budget under 100ms.

The most critical pitfalls are: (1) UserPromptSubmit stdout injection has documented bugs across multiple Claude Code versions -- a dual delivery mechanism is mandatory; (2) file-based counters face race conditions with concurrent instances -- atomic writes via flock/mkdir are required; (3) injected recommendations pollute the context window -- a "pointer not payload" approach keeps injections under 200 tokens; (4) captured logs inevitably contain secrets -- a scrubbing pipeline must exist before the first log entry; (5) the recommendation quality can degenerate through feedback loops -- tracking recommendation outcomes and enforcing routing diversity are essential safeguards.

## Key Findings

**Stack:** Node.js 22 + TypeScript 6 + Zod 4 for the core system; shell command hooks for zero-cost collection; Claude Haiku for the analysis agent. Plugin architecture for distribution. No database, no daemon, no vector DB.

**Architecture:** 8-component pipeline: Hook Dispatch Layer -> Log Storage (JSONL) -> Interaction Counter -> Environment Scanner -> Pre-Processing Layer (shell) -> Analysis Engine (agent) -> Recommendation Classifier (decision tree) -> Delivery Mechanism (stdout + file). The critical boundary is between collection (shell, every interaction, free) and analysis (agent, periodic, paid).

**Critical pitfall:** UserPromptSubmit stdout injection is unreliable across Claude Code versions (Issues #13912, #12151, #17804). Must have file-based fallback from day one.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Foundation + Plugin Skeleton** - Establish directory structure, config schema, JSONL log format, atomic counter, and plugin manifest
   - Addresses: T2 (cross-session persistence), T7 (zero-config install), T8 (configurable thresholds)
   - Avoids: Pitfall 2 (race conditions -- solved at foundation), Pitfall 5 (secrets -- scrubbing built in), Pitfall 7 (disk growth -- retention from start)

2. **Collection Hooks** - Implement UserPromptSubmit, PostToolUse, PermissionRequest, SessionStart hooks as shell command hooks
   - Addresses: T1 (interaction capture)
   - Avoids: Pitfall 6 (performance -- strict 100ms budget), Pitfall 8 (exit codes -- named constants), Pitfall 11 (duplicates -- single install location)

3. **Pre-Processing + Environment Scanner** - Shell-based frequency extraction, capability map builder, Stop hook with threshold trigger
   - Addresses: D6 (log pre-processing), D2 (environment discovery)
   - Avoids: Pitfall 12 (context overflow -- pre-processing caps agent input)

4. **Analysis Engine + Routing** - Agent hook on Stop, classification decision tree, multi-target routing
   - Addresses: T3 (pattern detection), D1 (multi-target routing), D3 (permission analysis)
   - Avoids: Pitfall 4 (quality drift -- outcome tracking + diversity checks from start)

5. **Delivery + User Interaction** - Dual delivery (stdout + file), /evolve skill, recommendation state tracking
   - Addresses: T4 (structured recommendations), T5 (human approval), T6 (non-invasive delivery), D9 (full-auto opt-in)
   - Avoids: Pitfall 1 (stdout unreliability -- dual mechanism), Pitfall 3 (context pollution -- pointer-not-payload), Pitfall 10 (trust -- recommendation-only default)

6. **Polish + Ecosystem** - Tiered onboarding, cross-session aggregation, GSD/Cog/Claude-Mem-aware routing refinements
   - Addresses: D5 (tiered onboarding), D7 (prompt-to-command), D8 (config drift)
   - Avoids: Pitfall 13 (discovery fragility -- treats results as hints)

**Phase ordering rationale:**
- Phase 1 before Phase 2: Collection hooks need storage and counter to write to.
- Phase 2 before Phase 3: Pre-processing needs actual logs to process.
- Phase 3 before Phase 4: The agent needs compressed data, not raw logs. Building the agent before the pre-processor means feeding it raw data and retrofitting later.
- Phase 4 before Phase 5: Delivery needs recommendations to deliver. Building delivery first means building a shell with no content.
- Phase 6 is polish: The core feedback loop (collect -> compress -> analyze -> deliver) works without ecosystem-specific routing.

**Research flags for phases:**
- Phase 1: Needs validation of UserPromptSubmit stdout behavior on current Claude Code version (Gray Area #1 in PROJECT.md)
- Phase 2: Standard hook patterns, unlikely to need additional research
- Phase 3: May need research into optimal pre-processing thresholds (how many top-N patterns to extract)
- Phase 4: Likely needs prompt engineering research for the classification agent (what prompt structure produces the best routing decisions)
- Phase 5: Needs validation of stdout injection reliability after Phase 1 validation (may need to adjust delivery strategy)
- Phase 6: Needs phase-specific research into each ecosystem tool's current API/format for routing

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Node.js/TypeScript is well-understood; shell hook patterns verified via claude-user-input-logger and Claude-Mem. Tension between shell vs TS for hooks needs resolution during Phase 1. |
| Features | HIGH | Feature landscape well-mapped via 9+ competitor analysis. Table stakes and differentiators clearly identified. MVP priority is evidence-based. |
| Architecture | HIGH | Pipeline pattern validated by 6 prior art systems. Component boundaries, data flow, and build order all grounded in how existing tools actually work. |
| Pitfalls | HIGH | 15 pitfalls identified with specific GitHub issue references. Critical pitfalls (#1 stdout bugs, #2 race conditions, #5 secrets) are confirmed bugs, not theoretical risks. |

## Gaps to Address

- **UserPromptSubmit stdout injection reliability**: The most critical Gray Area. Must be validated hands-on in Phase 1 before building the delivery mechanism on it. If broken, the entire delivery strategy pivots to file-based only + /evolve skill pull.
- **Optimal analysis threshold**: Default of 50 interactions is a guess. Real-world testing needed to calibrate signal-to-noise ratio.
- **PermissionRequest hook data**: The hook provides the tool_name and tool_input but NOT the user's decision (allow/deny). Capturing the decision may require reading the transcript after the PermissionRequest fires, which adds complexity. Needs validation.
- **macOS flock availability**: The user runs macOS Ventura (Intel). macOS does not ship flock. Need to use mkdir-based locking or install flock via Homebrew. This affects the counter implementation.
- **Classification prompt quality**: The routing decision tree is conceptually sound but the agent prompt needs iterative refinement with real data. This is a Phase 4 research task.
- **Shell vs TypeScript hook implementation**: STACK.md recommends compiled TS hooks; ARCHITECTURE.md recommends pure shell. Need to benchmark cold-start latency of `node dist/hooks/user-prompt.js` vs a bash script on the user's hardware to resolve.
