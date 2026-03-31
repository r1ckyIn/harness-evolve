# Requirements — harness-evolve v1

## Origin Context

This project was born from a real harness optimization session (2026-03-31) where 10 problems were manually identified and fixed in a multi-project Claude Code setup. The 10 problems and their manual solutions are documented in `~/claude/obsidian/300 Resources/320 References/harness-engineering-session-report.md`. harness-evolve automates the detection and routing of these exact types of problems.

## Core Value

Make Claude Code harnesses self-improving without manual analysis.

---

## v1 Requirements

### Data Collection

- [ ] **CAP-01**: Capture user prompts via UserPromptSubmit hook with timestamp, session_id, cwd, prompt text
- [ ] **CAP-02**: Capture permission approval/denial patterns via PermissionRequest hook with tool_name and decision
- [ ] **CAP-03**: Capture tool usage patterns via PreToolUse/PostToolUse hooks with tool_name, input summary, duration
- [ ] **CAP-04**: Access full conversation transcripts via transcript_path for context enrichment during analysis (read-only, never copy to own storage)
- [ ] **CAP-05**: Persist interaction logs to ~/.harness-evolve/logs/ as JSONL with daily rotation
- [ ] **CAP-06**: Secret scrubbing — strip API keys, tokens, passwords from captured prompts before writing to log
- [ ] **CAP-07**: Atomic file writes to prevent corruption from concurrent Claude Code instances

### Counting & Triggers

- [ ] **TRG-01**: File-based interaction counter per session, persisted in ~/.harness-evolve/counter
- [ ] **TRG-02**: Trigger automated analysis at configurable threshold (default: 50 interactions)
- [ ] **TRG-03**: Support manual on-demand analysis via /evolve skill
- [ ] **TRG-04**: Both auto-threshold and manual triggers coexist

### Pattern Analysis

- [ ] **ANL-01**: Shell pre-processing layer extracts frequency counts, top-N patterns, and statistical summaries from raw logs before agent analysis
- [ ] **ANL-02**: Agent-based classifier reads compressed summaries and classifies patterns using routing decision tree
- [ ] **ANL-03**: Detect repeated prompts (>5 occurrences of similar short prompts -> suggest hook/alias)
- [ ] **ANL-04**: Detect long repeated prompts (>200 words, repeated 2+ times -> suggest skill creation)
- [ ] **ANL-05**: Detect repeated permission approvals (same tool approved >10 times across 3+ sessions -> suggest adding to allowedTools)
- [ ] **ANL-06**: Detect recurring code preferences/corrections (>3 same correction pattern -> suggest rule)
- [ ] **ANL-07**: Detect personal/contextual information mentions -> suggest memory entry
- [ ] **ANL-08**: Cross-session pattern aggregation — analyze accumulated data across sessions, not just current session
- [ ] **ANL-09**: Configuration drift detection — compare content across rules, CLAUDE.md, memory, settings for contradictions and redundancies

### Multi-Target Routing

- [ ] **RTG-01**: Extensible routing decision tree that classifies each pattern to the most appropriate config target
- [ ] **RTG-02**: Route to hooks for patterns requiring 100% reliable execution
- [ ] **RTG-03**: Route to skills for repeated multi-step workflows
- [ ] **RTG-04**: Route to rules for code preferences and naming conventions
- [ ] **RTG-05**: Route to CLAUDE.md for project-level configuration
- [ ] **RTG-06**: Route to memory for short-term contextual/personal information
- [ ] **RTG-07**: Route to settings.json for permissions and global configuration
- [ ] **RTG-08**: Dynamic environment discovery — scan settings.json (enabledPlugins), .claude/ directory, plugin SKILL.md metadata to detect installed tools
- [ ] **RTG-09**: Adapt routing when installed tools are detected (GSD -> suggest GSD patterns; Cog -> suggest memory tiers; etc.)
- [ ] **RTG-10**: Adapt routing when new Claude Code features are detected (version check comparison)

### Recommendation Delivery

- [ ] **DEL-01**: Write structured recommendations to ~/.harness-evolve/recommendations.md with confidence tiers (HIGH/MEDIUM/LOW)
- [ ] **DEL-02**: Non-invasive delivery via UserPromptSubmit stdout injection — inject one-line notification pointer (< 200 tokens) on the interaction after threshold
- [ ] **DEL-03**: File fallback — if stdout injection is unreliable (known bug), use /evolve command as primary
- [ ] **DEL-04**: Dual delivery — stdout pointer + full detail in file, never payload in stdout
- [ ] **DEL-05**: Recommendation state tracking — applied/dismissed/pending
- [ ] **DEL-06**: Full-auto mode (opt-in) — auto-apply HIGH confidence recommendations, log what was applied

### Onboarding & Configuration

- [ ] **ONB-01**: Zero-config installation — works immediately with sensible defaults
- [ ] **ONB-02**: Tiered onboarding — detect existing config level (zero-config newbie vs power user) and adapt recommendations
- [ ] **ONB-03**: Configurable thresholds via ~/.harness-evolve/config.json (interaction count, analysis depth, enabled hooks)
- [ ] **ONB-04**: Claude Code version change detection — notify user and suggest reviewing changelog for new capabilities

### Quality & Safety

- [ ] **QUA-01**: Recommend only, never auto-execute without awareness (default mode)
- [ ] **QUA-02**: Output budget enforcement — recommendations file stays bounded, logs rotate
- [ ] **QUA-03**: Confidence tiers (HIGH/MEDIUM/LOW) with explanations, no numeric scores
- [ ] **QUA-04**: Outcome tracking — when user applies a recommendation, track whether it persists or gets reverted (informs future recommendation quality)

---

## v2 Requirements (Deferred)

- Multi-language support for recommendation text
- Web-based visualization dashboard
- Community-shared routing heuristics marketplace
- Integration test suite for hook reliability across Claude Code versions
- Collaborative recommendations (multiple users in same project contributing patterns)

---

## Out of Scope

- Replacing existing tools (GSD, Cog, Claude-Mem) — complement, not compete
- Supporting non-Claude-Code agents — Claude Code specific
- Building a database (SQLite, vector DB) — plain files only
- Copying full transcript content to own storage — privacy concern
- Real-time interruption during active tasks — only at natural breakpoints

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| CAP-01 | Phase 2 | Pending |
| CAP-02 | Phase 2 | Pending |
| CAP-03 | Phase 2 | Pending |
| CAP-04 | Phase 2 | Pending |
| CAP-05 | Phase 1 | Pending |
| CAP-06 | Phase 1 | Pending |
| CAP-07 | Phase 1 | Pending |
| TRG-01 | Phase 1 | Pending |
| TRG-02 | Phase 4 | Pending |
| TRG-03 | Phase 5 | Pending |
| TRG-04 | Phase 5 | Pending |
| ANL-01 | Phase 3 | Pending |
| ANL-02 | Phase 4 | Pending |
| ANL-03 | Phase 4 | Pending |
| ANL-04 | Phase 4 | Pending |
| ANL-05 | Phase 4 | Pending |
| ANL-06 | Phase 4 | Pending |
| ANL-07 | Phase 4 | Pending |
| ANL-08 | Phase 3 | Pending |
| ANL-09 | Phase 4 | Pending |
| RTG-01 | Phase 4 | Pending |
| RTG-02 | Phase 4 | Pending |
| RTG-03 | Phase 4 | Pending |
| RTG-04 | Phase 4 | Pending |
| RTG-05 | Phase 4 | Pending |
| RTG-06 | Phase 4 | Pending |
| RTG-07 | Phase 4 | Pending |
| RTG-08 | Phase 3 | Pending |
| RTG-09 | Phase 4 | Pending |
| RTG-10 | Phase 4 | Pending |
| DEL-01 | Phase 5 | Pending |
| DEL-02 | Phase 5 | Pending |
| DEL-03 | Phase 5 | Pending |
| DEL-04 | Phase 5 | Pending |
| DEL-05 | Phase 5 | Pending |
| DEL-06 | Phase 5 | Pending |
| ONB-01 | Phase 1 | Pending |
| ONB-02 | Phase 6 | Pending |
| ONB-03 | Phase 1 | Pending |
| ONB-04 | Phase 3 | Pending |
| QUA-01 | Phase 5 | Pending |
| QUA-02 | Phase 5 | Pending |
| QUA-03 | Phase 5 | Pending |
| QUA-04 | Phase 6 | Pending |

---
*Last updated: 2026-03-31 -- Traceability added by roadmapper*
