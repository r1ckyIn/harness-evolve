# Roadmap: harness-evolve

## Overview

harness-evolve delivers a self-improving engine for Claude Code by building a complete feedback pipeline: capture user interactions via hooks, persist and compress log data, detect patterns through shell pre-processing and agent classification, route recommendations to the most appropriate config target (hooks, skills, rules, memory, CLAUDE.md, settings, permissions), and deliver them non-invasively. The system is built bottom-up -- each phase completes one pipeline stage and unblocks the next, with the full loop closing at Phase 5.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Storage** - Directory structure, config schema, JSONL log format, atomic counter, secret scrubbing, plugin manifest
- [ ] **Phase 2: Collection Hooks** - Four lifecycle hooks capturing prompts, tools, permissions, and transcripts
- [ ] **Phase 3: Pre-Processing & Environment Discovery** - Shell-based log compression, cross-session aggregation, environment scanner, version detection
- [ ] **Phase 4: Analysis Engine & Routing** - Agent-based pattern classification, routing decision tree, all seven+ routing targets
- [ ] **Phase 5: Delivery & User Interaction** - Dual delivery mechanism, /evolve skill, recommendation state tracking, full-auto mode
- [ ] **Phase 6: Onboarding & Quality Polish** - Tiered onboarding detection, recommendation outcome tracking

## Phase Details

### Phase 1: Foundation & Storage
**Goal**: The persistent infrastructure exists so hooks can write data and analysis can read it -- with safety guarantees from the first byte
**Depends on**: Nothing (first phase)
**Requirements**: CAP-05, CAP-06, CAP-07, TRG-01, ONB-01, ONB-03
**Success Criteria** (what must be TRUE):
  1. Running `ls ~/.harness-evolve/` shows the complete directory structure (logs/prompts, logs/tools, logs/permissions, logs/sessions, analysis/, config.json, counter.json)
  2. Writing a test log entry containing a known secret pattern (e.g., "AKIAIOSFODNN7EXAMPLE") results in a scrubbed entry on disk with the secret redacted
  3. Two concurrent processes incrementing the counter 100 times each produce a counter value of exactly 200 (no lost writes)
  4. Installing the plugin with default config.json works immediately -- no manual configuration required
  5. UserPromptSubmit stdout injection works on the current Claude Code version (Gray Area #1 validated or documented as broken with fallback plan)
**Plans**: TBD

### Phase 2: Collection Hooks
**Goal**: Every user interaction with Claude Code generates a structured log entry automatically
**Depends on**: Phase 1
**Requirements**: CAP-01, CAP-02, CAP-03, CAP-04
**Success Criteria** (what must be TRUE):
  1. After submitting 5 prompts to Claude Code, `wc -l ~/.harness-evolve/logs/prompts/$(date +%Y-%m-%d).jsonl` shows 5 entries, each containing timestamp, session_id, cwd, and prompt text
  2. After using 3 tools, the tools log contains PreToolUse and PostToolUse entries with tool_name, input summary, and duration
  3. After approving 2 permission requests, the permissions log contains entries with tool_name and decision
  4. The counter.json value has incremented by 10 (5 prompts + 3 tool uses + 2 permissions) and each hook completes in under 100ms
**Plans**: TBD

### Phase 3: Pre-Processing & Environment Discovery
**Goal**: Raw logs are compressed into pattern summaries that fit in an agent's context, and the user's installed tools are mapped
**Depends on**: Phase 2
**Requirements**: ANL-01, ANL-08, RTG-08, ONB-04
**Success Criteria** (what must be TRUE):
  1. Running the pre-processor on 30 days of accumulated logs produces a summary.json under 50KB containing top-20 repeated prompts, tool frequency counts, and permission approval patterns
  2. The environment scanner correctly identifies at least 3 types of installed tools (e.g., existing hooks, rules, plugins) and outputs environment-snapshot.json
  3. Cross-session patterns are aggregated -- a prompt repeated 3 times in session A and 4 times in session B appears as 7 total occurrences in the summary
  4. Claude Code version is detected and compared against known compatible versions, with a warning logged if version is untested
**Plans**: TBD

### Phase 4: Analysis Engine & Routing
**Goal**: Detected patterns are classified into the correct configuration target with evidence and confidence tiers
**Depends on**: Phase 3
**Requirements**: ANL-02, ANL-03, ANL-04, ANL-05, ANL-06, ANL-07, ANL-09, RTG-01, RTG-02, RTG-03, RTG-04, RTG-05, RTG-06, RTG-07, RTG-09, RTG-10, TRG-02
**Success Criteria** (what must be TRUE):
  1. Given test logs containing a prompt repeated 10 times, the analyzer recommends a HOOK with HIGH confidence and includes the evidence count
  2. Given test logs containing a 300-word prompt repeated 3 times, the analyzer recommends a SKILL with the prompt pattern identified
  3. Given test logs with "npm test" approved 15 times across 4 sessions, the analyzer recommends adding to allowedTools in SETTINGS
  4. Given test logs plus an environment-snapshot showing GSD installed, the analyzer includes GSD-specific routing in its recommendations
  5. The analysis triggers automatically when counter reaches the configured threshold (default 50)
**Plans**: TBD

### Phase 5: Delivery & User Interaction
**Goal**: Users receive recommendations at natural breakpoints and can act on them through multiple channels
**Depends on**: Phase 4
**Requirements**: DEL-01, DEL-02, DEL-03, DEL-04, DEL-05, DEL-06, TRG-03, TRG-04, QUA-01, QUA-02, QUA-03
**Success Criteria** (what must be TRUE):
  1. After analysis completes, `~/.harness-evolve/recommendations.md` contains structured recommendations with confidence tiers (HIGH/MEDIUM/LOW) and explanations
  2. On the next user prompt after analysis, a one-line notification (under 200 tokens) appears pointing to the recommendations file -- OR if stdout injection is broken, /evolve is the documented primary path
  3. Running `/evolve` triggers on-demand analysis and displays recommendations regardless of counter threshold
  4. Recommendations have state tracking (pending/applied/dismissed) and the file stays bounded (old recommendations rotate)
  5. Enabling full-auto mode in config causes HIGH-confidence recommendations to be auto-applied with a log of what changed
**Plans**: TBD
**UI hint**: yes

### Phase 6: Onboarding & Quality Polish
**Goal**: The system adapts to each user's experience level and improves its own recommendation quality over time
**Depends on**: Phase 5
**Requirements**: ONB-02, QUA-04
**Success Criteria** (what must be TRUE):
  1. A new user with zero existing config receives "start here" recommendations (basic hooks, first rules), while a power user with 50+ rules and 3 plugins receives "optimize what you have" recommendations (redundancy detection, mechanization)
  2. When a user applies a recommendation that persists for 5+ sessions, it is tracked as a positive outcome; when reverted, it is tracked as negative -- and future recommendations are influenced by this history
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Storage | 0/? | Not started | - |
| 2. Collection Hooks | 0/? | Not started | - |
| 3. Pre-Processing & Environment Discovery | 0/? | Not started | - |
| 4. Analysis Engine & Routing | 0/? | Not started | - |
| 5. Delivery & User Interaction | 0/? | Not started | - |
| 6. Onboarding & Quality Polish | 0/? | Not started | - |
