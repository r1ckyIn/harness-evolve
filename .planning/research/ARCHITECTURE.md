# Architecture Patterns

**Domain:** Self-improving Claude Code harness system (harness-evolve)
**Researched:** 2026-03-31

## Recommended Architecture

### High-Level System Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Claude Code Runtime                                 │
│                                                                            │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ SessionStart │  │UserPromptSub.│  │  PreToolUse  │  │  PostToolUse  │  │
│  │    Hook      │  │    Hook      │  │    Hook      │  │    Hook       │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └───────┬──────┘  │
│         │                 │                  │                   │         │
│  ┌──────┴─────────────────┴──────────────────┴───────────────────┴──────┐  │
│  │                     Hook Dispatch Layer                              │  │
│  │  (4 command hooks registered in settings.json, all write to logs)   │  │
│  └─────────────────────────────┬───────────────────────────────────────┘  │
│                                │                                          │
│  ┌─────────────────────────────┴───────────────────────────────────────┐  │
│  │  ┌──────────┐  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  │  │
│  │  │ Stop Hook│  │PermissionReq.│  │SessionEnd │  │ FileChanged  │  │  │
│  │  │ (analyze)│  │    Hook      │  │   Hook    │  │   Hook       │  │  │
│  │  └──────────┘  └──────────────┘  └───────────┘  └──────────────┘  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
         │                                                    │
         │ write (append)                                     │ read (analyze)
         ▼                                                    ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                    ~/.harness-evolve/                                       │
│                                                                            │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │                  Log Storage Layer                    │                  │
│  │                                                      │                  │
│  │  logs/                                               │                  │
│  │  ├── prompts/                                        │                  │
│  │  │   ├── 2026-03-31.jsonl     (user prompts)         │                  │
│  │  │   └── ...                                         │                  │
│  │  ├── tools/                                          │                  │
│  │  │   ├── 2026-03-31.jsonl     (tool use patterns)    │                  │
│  │  │   └── ...                                         │                  │
│  │  ├── permissions/                                    │                  │
│  │  │   ├── 2026-03-31.jsonl     (approval/denial)      │                  │
│  │  │   └── ...                                         │                  │
│  │  └── sessions/                                       │                  │
│  │      ├── <session_id>.meta.json (session metadata)   │                  │
│  │      └── ...                                         │                  │
│  └──────────────────────────────────────────────────────┘                  │
│                                                                            │
│  ┌──────────────┐  ┌────────────────┐  ┌───────────────────────────────┐  │
│  │ counter.json │  │  state.json    │  │  environment-snapshot.json    │  │
│  │ (interaction │  │ (last analysis │  │  (discovered tools/plugins)   │  │
│  │  count)      │  │  timestamp)    │  │                               │  │
│  └──────────────┘  └────────────────┘  └───────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────┐                  │
│  │              Analysis Output Layer                   │                  │
│  │                                                      │                  │
│  │  analysis/                                           │                  │
│  │  ├── latest-patterns.json   (compressed patterns)    │                  │
│  │  ├── history/               (past analysis results)  │                  │
│  │  └── pre-processed/         (shell-compressed logs)  │                  │
│  │                                                      │                  │
│  │  recommendations.md         (human-readable output)  │                  │
│  │  recommendations.json       (structured for routing) │                  │
│  └──────────────────────────────────────────────────────┘                  │
└────────────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | Implementation |
|-----------|---------------|-------------------|----------------|
| **Hook Dispatch Layer** | Capture raw events from Claude Code lifecycle | Log Storage (write), Counter (increment) | Shell scripts (command hooks) |
| **Log Storage** | Append-only structured event storage, organized by type and date | Hook Dispatch (receives), Pre-Processor (read by) | JSONL files on disk |
| **Interaction Counter** | Track interaction count across sessions, trigger analysis threshold | Hook Dispatch (incremented by), Analysis Trigger (read by) | Single JSON file with flock-based atomic writes |
| **Environment Scanner** | Discover installed tools, plugins, settings; build capability map | Analysis Engine (provides context to) | Shell script scanning known paths |
| **Pre-Processing Layer** | Compress large log data into frequency-counted pattern summaries | Log Storage (reads from), Analysis Engine (feeds into) | Shell script (awk/jq/sort pipeline) |
| **Analysis Engine** | Detect patterns, classify into recommendation categories | Pre-Processor (receives from), Recommendation Classifier (outputs to) | Agent hook (Claude as analyzer) |
| **Recommendation Classifier** | Route each pattern to the correct configuration target | Analysis Engine (receives from), Delivery Mechanism (outputs to) | Decision tree within agent prompt |
| **Delivery Mechanism** | Surface recommendations to user at natural break points | Classifier (receives from), UserPromptSubmit stdout (injects via) | UserPromptSubmit hook + recommendations.md file |

### Data Flow

```
1. USER INTERACTS WITH CLAUDE CODE
   │
   ├── UserPromptSubmit fires ──────────► prompts/YYYY-MM-DD.jsonl (append)
   │   └── stdout: inject recommendations (if pending and threshold met)
   │
   ├── PreToolUse fires ────────────────► tools/YYYY-MM-DD.jsonl (append)
   │
   ├── PostToolUse fires ───────────────► tools/YYYY-MM-DD.jsonl (append)
   │
   ├── PermissionRequest fires ─────────► permissions/YYYY-MM-DD.jsonl (append)
   │
   └── ALL hooks increment ────────────► counter.json (+1, atomic)

2. THRESHOLD REACHED (counter >= 50)
   │
   ├── Stop hook activates analysis pipeline:
   │   │
   │   ├── [Shell] Pre-processor reads logs/
   │   │   └── Extracts: top-N repeated prompts, tool frequency,
   │   │       permission patterns, session durations
   │   │   └── Outputs: analysis/pre-processed/summary.json
   │   │
   │   ├── [Shell] Environment scanner reads:
   │   │   └── ~/.claude/settings.json (enabledPlugins, hooks)
   │   │   └── .claude/settings.json (project-level)
   │   │   └── .claude/skills/ (installed skills)
   │   │   └── .claude/rules/ (existing rules)
   │   │   └── CLAUDE.md files (traversed parents)
   │   │   └── Plugin metadata (SKILL.md files)
   │   │   └── Outputs: environment-snapshot.json
   │   │
   │   ├── [Agent] Analysis Engine receives:
   │   │   └── pre-processed/summary.json + environment-snapshot.json
   │   │   └── Classifies patterns into recommendation categories
   │   │   └── Outputs: recommendations.json + recommendations.md
   │   │
   │   └── [Shell] Reset counter, update state.json
   │
   └── counter.json reset to 0

3. NEXT USER INTERACTION
   │
   └── UserPromptSubmit hook checks for pending recommendations
       └── If recommendations.json exists and is undelivered:
           └── stdout injects formatted summary
           └── Claude presents recommendations before handling prompt
           └── Mark recommendations as delivered
```

## Component Deep Dives

### Component 1: Hook Dispatch Layer (Data Collection)

**What it captures and why:**

| Hook Event | Data Captured | Pattern Signal |
|------------|--------------|----------------|
| `UserPromptSubmit` | User prompt text, timestamp, session_id | Repeated commands, long prompts (skill candidates), preferences |
| `PreToolUse` | tool_name, tool_input | Tool usage frequency, common argument patterns |
| `PostToolUse` | tool_name, tool_input, tool_response (truncated) | Success/failure patterns, output patterns |
| `PermissionRequest` | tool_name, tool_input, user decision (from transcript) | Frequently approved tools (permission rule candidates) |
| `Stop` | session_id, interaction_count, last_assistant_message | Session boundary, trigger analysis |
| `SessionStart` | session_id, source (startup/resume/clear/compact) | Session frequency, resume patterns |

**Critical design decision:** All collection hooks are `command` type (shell scripts), not `agent` type. Agents consume API tokens on every invocation. Collection must be zero-cost -- pure file I/O. Only the analysis step uses an agent hook.

**Hook registration location:** `~/.claude/settings.json` (global scope) so it works across all projects. The plugin architecture provides `CLAUDE_PLUGIN_DATA` for persistent storage, which maps to `~/.harness-evolve/`.

### Component 2: Log Storage Layer

**Format:** JSONL (one JSON object per line), matching Claude Code's own transcript format convention. Append-only -- never modify existing lines.

**Schema per event type:**

```jsonc
// prompts/YYYY-MM-DD.jsonl
{
  "ts": "2026-03-31T14:22:01Z",
  "session_id": "abc123",
  "prompt": "fix the login bug in auth.ts",
  "prompt_length": 35,
  "project_dir": "/Users/user/project"
}

// tools/YYYY-MM-DD.jsonl
{
  "ts": "2026-03-31T14:22:05Z",
  "session_id": "abc123",
  "event": "PreToolUse|PostToolUse",
  "tool_name": "Bash",
  "tool_input_summary": "npm test",  // truncated for storage
  "tool_success": true  // only for PostToolUse
}

// permissions/YYYY-MM-DD.jsonl
{
  "ts": "2026-03-31T14:22:03Z",
  "session_id": "abc123",
  "tool_name": "Bash",
  "tool_input_summary": "npm install express",
  "decision": "allow"  // reconstructed from transcript or PermissionRequest hook
}
```

**Why JSONL over SQLite:** Claude-mem uses SQLite + Chroma (vector DB), which requires a running worker service on port 37777. That's heavyweight for a data collection layer. JSONL files are:
- Appendable from shell scripts with zero dependencies
- Readable by jq/awk for pre-processing
- Readable by agent hooks for analysis
- Greppable for manual inspection
- No daemon process needed

**Retention:** Date-partitioned files enable simple rotation (delete files older than N days). Default: 30 days.

### Component 3: Interaction Counter

**Why file-based:** Must survive across sessions and Claude Code restarts. In-memory counters reset when processes die.

**Atomic write pattern (prevents race conditions with concurrent Claude Code instances):**

```bash
#!/bin/bash
# Uses flock for kernel-level file locking
COUNTER_FILE="$HOME/.harness-evolve/counter.json"
LOCK_FILE="$HOME/.harness-evolve/counter.lock"

(
  flock -w 5 200 || exit 1

  if [ -f "$COUNTER_FILE" ]; then
    count=$(jq -r '.count' "$COUNTER_FILE")
  else
    count=0
  fi

  count=$((count + 1))

  # Atomic write via temp file + rename
  tmp=$(mktemp "$COUNTER_FILE.XXXXXX")
  echo "{\"count\": $count, \"last_updated\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > "$tmp"
  mv "$tmp" "$COUNTER_FILE"

  echo "$count"  # Return current count to caller
) 200>"$LOCK_FILE"
```

**Threshold check:** The Stop hook reads counter.json. If count >= threshold (default 50), it triggers the analysis pipeline and resets the counter.

### Component 4: Environment Scanner

**What it discovers and where:**

| Target | Location | What to Extract |
|--------|----------|----------------|
| Enabled plugins | `~/.claude/settings.json` → `enabledPlugins` | Plugin names, which tools are already covered |
| Plugin capabilities | Plugin install dirs → `skills/`, `hooks/hooks.json`, `agents/` | What each plugin can do (avoid duplicate recommendations) |
| Existing hooks | `~/.claude/settings.json` → `hooks` | What's already automated |
| Project hooks | `.claude/settings.json` → `hooks` | Project-level automation |
| Installed skills | `.claude/skills/` and `~/.claude/skills/` | Existing slash commands |
| Rules | `.claude/rules/` | Existing behavioral rules |
| CLAUDE.md | Current dir + parent traversal | Existing project instructions |
| Memory files | `~/.claude/projects/*/memory/` | If auto-memory is active |
| GSD artifacts | `.planning/` directory | Whether GSD workflow is in use |
| Cog artifacts | `memory/hot-memory.md` | Whether Cog is installed |

**Output:** `environment-snapshot.json` -- a capability map the analysis engine uses to avoid recommending what already exists.

### Component 5: Pre-Processing Layer

**Why this exists:** 50 sessions of raw logs can easily exceed 100K+ lines. An agent hook with Claude Haiku has useful but limited context. Shell pre-processing extracts the signal before the agent sees it.

**Pre-processing pipeline (shell, no AI):**

```bash
# 1. Top repeated prompts (exact + fuzzy via normalized text)
jq -r '.prompt' logs/prompts/*.jsonl | \
  tr '[:upper:]' '[:lower:]' | sort | uniq -c | sort -rn | head -20

# 2. Tool usage frequency
jq -r '.tool_name' logs/tools/*.jsonl | sort | uniq -c | sort -rn

# 3. Permission approval frequency (candidates for auto-allow rules)
jq -r 'select(.decision=="allow") | .tool_name + "|" + .tool_input_summary' \
  logs/permissions/*.jsonl | sort | uniq -c | sort -rn | head -20

# 4. Long prompts (skill candidates: prompts > 200 chars)
jq -r 'select(.prompt_length > 200) | .prompt[:100]' logs/prompts/*.jsonl | head -10

# 5. Session duration patterns
# (computed from session metadata)
```

**Output:** `analysis/pre-processed/summary.json` -- a compressed summary small enough for an agent's context.

### Component 6: Analysis Engine (Agent Hook)

**Trigger:** Stop hook, when counter >= threshold.

**Implementation:** `agent` type hook on the Stop event. Spawns a Claude subagent (Haiku for cost efficiency) with Read/Glob/Grep tools available.

**Agent prompt structure:**

```
You are a harness optimization analyst. Given:
1. Pre-processed interaction patterns (summary.json)
2. Environment snapshot (environment-snapshot.json)

Classify each detected pattern into one of these routing targets:
- HOOK: Pattern requires 100% reliable, deterministic execution
- SKILL: Pattern is a repeated multi-step workflow (>200 word prompts)
- RULE: Pattern reflects a recurring code preference or behavioral guideline
- MEMORY: Pattern is personal/contextual information
- PERMISSION: Pattern shows frequently approved tool+args combinations
- CLAUDE_MD: Pattern is project-level configuration or instruction
- SETTINGS: Pattern requires settings.json modification
- NONE: Pattern is noise or already covered by existing config

For each recommendation, output structured JSON with:
- pattern_description, evidence_count, confidence, routing_target,
  suggested_implementation, priority (high/medium/low)
```

### Component 7: Recommendation Classifier (Decision Tree)

The classification logic lives within the analysis agent's prompt but follows an explicit decision tree:

```
Pattern detected
│
├── Is it already covered by environment snapshot?
│   └── YES → NONE (skip)
│
├── Does it require guaranteed execution (no AI discretion)?
│   └── YES → HOOK
│       Examples: "always run tests before commit",
│                 "block force-push to main"
│
├── Is it a multi-step workflow repeated 3+ times?
│   └── YES → SKILL
│       Examples: "create PR with specific template",
│                 "run migration + seed + verify"
│
├── Is it a code style/quality preference?
│   └── YES → RULE
│       Examples: "always use TypeScript strict mode",
│                 "prefer functional components"
│
├── Is it a frequently approved permission pattern?
│   └── YES → PERMISSION
│       Examples: "always allow npm test",
│                 "always allow git status"
│
├── Is it project-specific configuration?
│   └── YES → CLAUDE_MD
│       Examples: "this project uses pnpm not npm",
│                 "API base URL is /api/v2"
│
├── Is it personal/contextual information?
│   └── YES → MEMORY
│       Examples: "user prefers verbose output",
│                 "user timezone is AEST"
│
└── Is it a settings-level change?
    └── YES → SETTINGS
        Examples: "change default model",
                  "enable specific feature flag"
```

### Component 8: Delivery Mechanism

**Two delivery modes:**

**Mode A: Non-invasive (default)**
- Recommendations written to `~/.harness-evolve/recommendations.md` (human-readable) and `recommendations.json` (structured)
- On the next UserPromptSubmit after analysis completes, the hook checks for undelivered recommendations
- Injects a formatted summary via stdout: `"[harness-evolve] 3 optimization recommendations ready. Review at ~/.harness-evolve/recommendations.md or ask me to apply them."`
- Claude reads the stdout injection and presents it before handling the user's actual prompt
- Marks recommendations as delivered in state.json

**Mode B: Full-auto (opt-in)**
- Analysis engine directly applies recommendations (create hooks, write rules, update CLAUDE.md)
- Still logs what it changed in recommendations.md for auditability
- Requires explicit opt-in via config: `{"auto_apply": true}`

**Why stdout injection over Stop hook agent:** The Stop hook fires when Claude is about to stop -- there's no further conversation. UserPromptSubmit fires at the start of the NEXT interaction, which is the natural break point where recommendations should surface.

## Patterns to Follow

### Pattern 1: Append-Only Event Sourcing

**What:** All data collection hooks append to JSONL files. Never modify existing entries. Analysis reads the full log.

**When:** All data capture operations.

**Why:** Matches Claude Code's own transcript format philosophy. Enables replay, re-analysis, and auditing. Shell-friendly (just `echo >> file`). No corruption risk from concurrent writes (lines are atomic at small sizes on POSIX systems).

**Example:**
```bash
#!/bin/bash
# PostToolUse collection hook
INPUT=$(cat)  # Read JSON from stdin

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input | tostring' | head -c 200)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')
DATE=$(date -u +%Y-%m-%d)
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

LOG_DIR="$HOME/.harness-evolve/logs/tools"
mkdir -p "$LOG_DIR"

echo "{\"ts\":\"$TS\",\"session_id\":\"$SESSION_ID\",\"event\":\"PostToolUse\",\"tool_name\":\"$TOOL_NAME\",\"tool_input_summary\":$(echo "$TOOL_INPUT" | jq -Rs .),\"tool_success\":true}" \
  >> "$LOG_DIR/$DATE.jsonl"
```

### Pattern 2: Shell Collection, Agent Analysis

**What:** Collection hooks are pure shell (command type). Only the analysis step uses an agent hook.

**When:** Always. This is a hard architectural boundary.

**Why:** Collection fires on EVERY interaction -- potentially hundreds of times per session. Agent hooks spawn Claude subagents that consume API tokens. Shell hooks are free. Only the periodic analysis (every ~50 interactions) justifies agent cost.

**Cost model:**
- Shell hook execution: ~5ms, $0.00
- Agent hook (Haiku): ~2s, ~$0.01-0.05
- 50 shell collections + 1 agent analysis = ~$0.03 total per analysis cycle
- 50 agent collections + 1 agent analysis = ~$2.55 total (85x more expensive)

### Pattern 3: Two-Phase Analysis (Shell Compress + Agent Classify)

**What:** Shell scripts extract frequency counts and top-N patterns. Agent receives the compressed summary, not raw logs.

**When:** Every analysis cycle.

**Why:** 30 days of logs at 100 interactions/day = 3000 JSONL lines. Agent context is precious. Shell pre-processing reduces this to ~50 lines of high-signal data.

**Inspired by:** Claude-mem's three-layer retrieval (search index -> review -> full details) and Auto Dream's four-phase consolidation (orient -> gather -> consolidate -> prune).

### Pattern 4: Capability-Aware Routing

**What:** The environment scanner builds a map of what's already installed. The classifier uses this map to avoid recommending what already exists and to route to the most appropriate target.

**When:** Every analysis cycle (environment can change between analyses).

**Why:** A user with Cog installed should get memory recommendations routed to Cog's `memory/` structure. A user with no plugins should get vanilla CLAUDE.md recommendations. This is the core differentiator of harness-evolve vs. single-purpose tools.

### Pattern 5: Plugin Architecture for Installability

**What:** Package as a Claude Code plugin with hooks/hooks.json, skills/, and CLAUDE_PLUGIN_DATA for persistent storage.

**When:** From the start -- this is the distribution format.

**Why:** Plugins provide:
- One-command install: `/plugin marketplace add r1ckyIn/harness-evolve`
- Automatic `CLAUDE_PLUGIN_DATA` directory for persistent storage
- `CLAUDE_PLUGIN_ROOT` for referencing bundled scripts
- SessionStart hooks for initialization
- Lifecycle management (install, update, uninstall)

## Anti-Patterns to Avoid

### Anti-Pattern 1: Agent Hooks for Data Collection

**What:** Using `"type": "agent"` hooks to capture user prompts or tool usage.

**Why bad:** Fires on every interaction. At ~$0.01-0.05 per agent invocation, 100 interactions/day = $1-5/day. Users will uninstall within a week. Claude-mem avoids this by using command hooks for capture and only using agents for compression.

**Instead:** Pure shell command hooks for all collection. Agent only for periodic analysis.

### Anti-Pattern 2: Running a Persistent Daemon

**What:** Claude-mem runs a worker service on port 37777 with SQLite + Chroma vector DB.

**Why bad for harness-evolve:** Adds operational complexity (port conflicts, process management, startup time). Claude-mem needs it for semantic search; harness-evolve does frequency-based pattern detection which shell tools handle well. A daemon is justified only when the analysis requires vector similarity or real-time queries.

**Instead:** File-based storage + shell pre-processing + periodic agent analysis. Zero running processes.

### Anti-Pattern 3: Storing Full Tool Responses

**What:** Capturing complete `tool_response` from PostToolUse (can be megabytes for Read operations).

**Why bad:** Disk usage explodes. A single `Read` of a large file could be 50KB+ in the response. 100 tool uses/day = 5MB/day of mostly useless data.

**Instead:** Capture only: tool_name, truncated tool_input (first 200 chars), success/failure boolean. The pattern signal is in the frequency and combination, not in the full content.

### Anti-Pattern 4: Analyzing on Every Interaction

**What:** Running pattern analysis after each prompt or tool use.

**Why bad:** Singularity-Claude scores after every skill execution because skills run infrequently. User interactions happen hundreds of times per session. Analysis is expensive (agent cost) and disruptive (latency).

**Instead:** Counter-based threshold (default 50) with analysis only at session Stop. Manual override via `/evolve` skill for on-demand analysis.

### Anti-Pattern 5: Modifying External Tool Files

**What:** Directly writing to Cog's `memory/` directory, GSD's `.planning/`, or other tools' data directories.

**Why bad:** Violates tool boundaries. Could corrupt state that other tools depend on. Creates coupling that breaks when tools update.

**Instead:** Output recommendations that tell the user (or auto-mode) what to add WHERE. The recommendation specifies the target tool and the content, but harness-evolve never writes to external tool directories.

## Prior Art Architecture Comparison

### How Existing Tools Structure Their Data Flow

| Tool | Collection | Storage | Analysis | Output |
|------|-----------|---------|----------|--------|
| **Cog** | Manual (`/reflect`) | Markdown files in `memory/` (hot/warm/glacier tiers) | Convention-based (Claude reads CLAUDE.md rules) | Memory files updated in-place |
| **Claude-Mem** | PostToolUse + SessionStart hooks | SQLite + Chroma vector DB, worker on port 37777 | AI compression via agent-sdk | MCP tools for retrieval, 3-layer search |
| **Singularity-Claude** | Post-execution telemetry scripts | JSON files in `~/.claude/singularity/scores/` + `telemetry/` | Haiku assessor agent (5-dimension scoring) | Skill rewrites, version bumps |
| **claude-user-input-logger** | PreToolUse hook | Text log files + JSON stats | None (pure capture) | Log files for manual review |
| **claude-meta** | Human judgment ("reflect on this mistake") | CLAUDE.md file directly | Claude reflection (single prompt) | CLAUDE.md rule additions |
| **Auto Dream** | Auto-memory during sessions | MEMORY.md in `~/.claude/projects/*/memory/` | Consolidation agent (4-phase) | Pruned, deduplicated MEMORY.md |
| **harness-evolve** (proposed) | 4 lifecycle hooks (shell) | JSONL files in `~/.harness-evolve/logs/` | Shell pre-process + agent classify | recommendations.md + UserPromptSubmit injection |

### Key Architectural Insights from Prior Art

1. **Cog proves convention-only works for individuals** but doesn't scale -- requires manual `/reflect` invocation and doesn't detect patterns automatically.

2. **Claude-Mem proves hooks-based capture works** but its SQLite+Chroma+worker architecture is overengineered for pattern detection (it's optimized for semantic retrieval, which is a different problem).

3. **Singularity-Claude proves automated quality loops work** -- its score-repair-crystallize cycle is the closest analog to harness-evolve's detect-classify-recommend cycle, but it only targets skills.

4. **Auto Dream proves periodic consolidation at threshold is the right trigger model** -- its dual-gate (24h + 5 sessions) prevents unnecessary analysis while ensuring regular cleanup. harness-evolve's counter threshold serves the same purpose.

5. **claude-meta proves that CLAUDE.md-as-learning-system is powerful but human-dependent** -- it requires the user to notice the mistake and issue the reflection prompt. harness-evolve automates the "noticing" part.

## Suggested Build Order

Based on component dependencies, the system should be built in this order:

```
Phase 1: Foundation (no dependencies)
├── Directory structure + config schema
├── Log Storage Layer (JSONL format, directory creation)
├── Interaction Counter (atomic file ops)
└── Plugin manifest (hooks/hooks.json skeleton)

Phase 2: Collection Hooks (depends on Phase 1: storage + counter)
├── UserPromptSubmit hook (prompt capture + counter increment)
├── PostToolUse hook (tool usage capture + counter increment)
├── PermissionRequest hook (approval/denial capture + counter increment)
└── SessionStart hook (session tracking)

Phase 3: Pre-Processing (depends on Phase 2: logs exist to process)
├── Shell pre-processor scripts (frequency extraction, top-N patterns)
├── Environment Scanner (capability map builder)
└── Stop hook with threshold check (triggers pre-processing)

Phase 4: Analysis Engine (depends on Phase 3: pre-processed data exists)
├── Agent hook configuration (Haiku model for cost efficiency)
├── Analysis prompt engineering (classification decision tree)
├── Recommendation output format (JSON + Markdown)
└── Integration: Stop hook chains pre-process → agent analysis

Phase 5: Delivery Mechanism (depends on Phase 4: recommendations exist)
├── UserPromptSubmit stdout injection (non-invasive mode)
├── Recommendation state tracking (delivered/pending)
├── /evolve skill (manual on-demand analysis trigger)
└── Full-auto mode (opt-in direct application)

Phase 6: Polish + Ecosystem Integration
├── Tiered onboarding (detect existing config level)
├── Cross-session pattern aggregation
├── Retention/rotation policies
└── GSD/Cog/Claude-Mem-aware routing refinements
```

**Dependency rationale:**
- Phase 1 must come first: everything depends on the storage format and directory structure.
- Phase 2 before Phase 3: pre-processing needs actual logs to process. Without collection hooks, there's nothing to analyze.
- Phase 3 before Phase 4: the agent needs compressed data, not raw logs. Building the agent first would require feeding it raw data, then retrofitting the pre-processor -- wasteful.
- Phase 4 before Phase 5: delivery needs recommendations to deliver. Building delivery first means building a shell with no content.
- Phase 6 is enhancement: the core loop (collect -> pre-process -> analyze -> deliver) works without ecosystem-specific routing.

**Critical path for MVP:** Phases 1-5 form a complete feedback loop. Phase 6 is polish. The system delivers value at Phase 5 completion.

## Scalability Considerations

| Concern | 1 User / 1 Project | 1 User / 10 Projects | Power User (100+ sessions) |
|---------|--------------------|-----------------------|----------------------------|
| **Storage** | ~100KB/day JSONL | ~1MB/day (separate project dirs) | 30-day rotation keeps under 30MB |
| **Counter races** | No issue | flock handles concurrent instances | flock handles concurrent instances |
| **Analysis cost** | ~$0.03/cycle (Haiku) | ~$0.03/cycle per project | Same -- pre-processing keeps agent input small |
| **Hook latency** | <10ms per shell hook | <10ms (hooks are per-instance) | <10ms (file I/O doesn't degrade) |
| **Pre-processing** | <1s for 30 days of logs | <1s per project | <5s (shell tools handle millions of lines) |
| **Log format** | JSONL sufficient | JSONL sufficient | Consider project-level log separation |

## Sources

### HIGH Confidence (Official Documentation)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Complete lifecycle events, handler types, JSON schemas
- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference) -- CLAUDE_PLUGIN_DATA, CLAUDE_PLUGIN_ROOT, plugin architecture

### MEDIUM Confidence (Verified GitHub Repositories)
- [Cog - Cognitive Architecture for Claude Code](https://github.com/marciopuga/cog) -- Three-tier memory, convention-based, /reflect /evolve skills
- [Claude-Mem](https://github.com/thedotmack/claude-mem) -- SQLite + Chroma, 6 hooks, worker service architecture
- [Singularity-Claude](https://github.com/Shmayro/singularity-claude) -- Score-repair-crystallize loop, telemetry-based skill evolution
- [claude-user-input-logger](https://github.com/Bucurenciu-Cristian/claude-user-input-logger) -- PreToolUse capture, JSONL logging, usage analytics
- [claude-meta](https://github.com/aviadr1/claude-meta) -- Self-improving CLAUDE.md via meta-rules and reflection prompts

### MEDIUM Confidence (Verified Third-Party Analysis)
- [Auto Memory and Auto Dream Architecture](https://antoniocortes.com/en/2026/03/30/auto-memory-and-auto-dream-how-claude-code-learns-and-consolidates-its-memory/) -- MEMORY.md location, dual-gate trigger (24h + 5 sessions), four-phase consolidation
- [Claude Code Hooks Production Patterns](https://www.pixelmojo.io/blogs/claude-code-hooks-production-quality-ci-cd-patterns) -- Handler types, matcher patterns, exit code behavior

### LOW Confidence (Single Source / Training Data)
- Atomic file operations via flock -- well-established POSIX pattern but not verified against Claude Code multi-instance behavior specifically
- JSONL append atomicity for small lines on POSIX -- generally true but filesystem-dependent
