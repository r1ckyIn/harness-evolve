# Domain Pitfalls

**Domain:** Self-improving AI agent configuration harness (Claude Code hooks/plugins ecosystem)
**Researched:** 2026-03-31

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or system-level failures.

---

### Pitfall 1: UserPromptSubmit stdout Injection Is Unreliable

**What goes wrong:** The core delivery mechanism for recommendations -- injecting context via UserPromptSubmit hook stdout -- has documented bugs across multiple Claude Code versions. Stdout from UserPromptSubmit hooks triggers "UserPromptSubmit hook error" despite the docs claiming it is "added as context." Additionally, plugin-sourced hooks have a separate bug where the output capture pipeline skips stdout entirely. A false-positive "prompt injection attack" detection also fires when the hook injects nested JSON structures.

**Why it happens:** Claude Code's hook execution pipeline treats UserPromptSubmit specially (stdout becomes context), but the implementation has had regressions since at least v2.0.69. The error-handling path intercepts stdout before the context-injection path in certain conditions (first message of new session, subdirectory launches, plugin hooks).

**Consequences:** The entire recommendation delivery mechanism (PROJECT.md requirement: "Non-invasive recommendation delivery: inject suggestions via UserPromptSubmit stdout") may silently fail. Users see errors instead of recommendations. If this is the only delivery path, the system appears broken with no fallback.

**Warning signs:**
- `UserPromptSubmit hook error` appearing in verbose mode (Ctrl+O)
- Recommendations never surfacing despite threshold being met
- Hook works in home directory but not in project subdirectories
- Works for non-plugin hooks but not when installed as a plugin

**Prevention:**
1. Build a **dual delivery mechanism** from day one: UserPromptSubmit stdout (primary) AND file-based output to `~/.harness-evolve/recommendations.md` (fallback)
2. Include a **health check** in the SessionStart hook that verifies UserPromptSubmit stdout is functional by writing a canary value and checking if Claude acknowledges it
3. Log every recommendation delivery attempt and outcome to detect silent failures
4. Pin minimum Claude Code version in documentation; maintain a compatibility matrix

**Detection:** Automated self-test on installation that triggers a UserPromptSubmit hook and verifies the output appears in Claude's context.

**Phase mapping:** Phase 1 (hook infrastructure) must validate this mechanism before building the analysis engine on top of it.

**Sources:**
- [UserPromptSubmit stdout causes error - Issue #13912](https://github.com/anthropics/claude-code/issues/13912)
- [Plugin hook output not captured - Issue #12151](https://github.com/anthropics/claude-code/issues/12151)
- [False positive injection detection - Issue #17804](https://github.com/anthropics/claude-code/issues/17804)
- [hookSpecificOutput error on first message - Issue #17550](https://github.com/anthropics/claude-code/issues/17550)
- Confidence: **HIGH** (multiple confirmed GitHub issues, reproducible)

---

### Pitfall 2: File-Based Counter Race Condition in Multi-Instance Setups

**What goes wrong:** When multiple Claude Code instances run concurrently (common for power users with Agent Teams or parallel terminal sessions), the file-based interaction counter at `~/.harness-evolve/logs/` gets corrupted. Two instances read the same counter value, both increment, both write -- one write is lost. Worse, if JSON log files are being appended concurrently, partial writes produce invalid JSON that crashes the analysis pipeline.

**Why it happens:** Claude Code itself has this exact bug with `.claude.json` -- reported 8+ times since June 2025, all closed without resolution. The root cause is non-atomic file writes with no locking. The harness-evolve project inherits this same class of bug if it uses naive file I/O.

**Consequences:** Inaccurate interaction counts (threshold triggers too early or too late). Corrupted log files that crash the pattern analysis agent. Lost interaction data producing incomplete pattern detection. In worst case, the analysis agent spends its context window parsing corrupted data instead of finding patterns.

**Warning signs:**
- Counter jumps backwards or skips numbers
- JSON parse errors in log files
- Different Claude Code instances showing different interaction counts
- Analysis agent errors related to malformed input

**Prevention:**
1. Use **atomic file operations**: write to temp file, fsync, rename into place (standard POSIX pattern)
2. Use **per-session log files** (e.g., `{session-id}.jsonl`) rather than a single shared file -- this eliminates most contention
3. For the counter specifically, use a **lock file** (`flock` on Linux, `shlock` or advisory locks on macOS) or accept that the counter is approximate (trigger at "~50 interactions" not "exactly 50")
4. Implement a **log file validator** that runs before analysis to skip/quarantine corrupted entries
5. Use JSONL format (one JSON object per line) not monolithic JSON -- partial writes only corrupt one line, not the whole file

**Detection:** Include a `sequence_number` field in each log entry. If the analysis pipeline finds gaps or duplicates in the sequence, log a warning.

**Phase mapping:** Phase 1 (data capture infrastructure). This must be designed correctly from the start -- retrofitting atomic writes is painful.

**Sources:**
- [.claude.json race condition corruption - Issue #28847](https://github.com/anthropics/claude-code/issues/28847)
- [8 reports closed without resolution - Issue #28922](https://github.com/anthropics/claude-code/issues/28922)
- [Task master race condition - Issue #1567](https://github.com/eyaltoledano/claude-task-master/issues/1567)
- Confidence: **HIGH** (documented in Claude Code core, directly applicable)

---

### Pitfall 3: Context Window Pollution from Hook-Injected Recommendations

**What goes wrong:** Every byte of stdout from UserPromptSubmit hooks becomes permanent context in Claude's conversation window. If the harness-evolve system injects verbose recommendations (e.g., "Here are 5 suggestions with full rationale and code examples"), it consumes thousands of tokens from the user's working context. Over multiple interactions in a session, accumulated recommendation text causes earlier conversation content to be compacted or lost, degrading Claude's performance on the user's actual task.

**Why it happens:** Claude Code's context window (200K default, 1M with Opus 4.6) has a buffer of ~33K tokens reserved for system prompts. Compaction triggers at ~83.5% usage. UserPromptSubmit stdout is injected as context that persists for the entire conversation, not as ephemeral output. There is no mechanism to mark injected content as "low priority" for compaction.

**Consequences:** Users experience degraded Claude performance (forgetting earlier decisions, contradicting prior code). Power users who interact heavily with Claude hit compaction sooner. The very act of trying to improve the user's experience (recommendations) actively degrades it (context pollution). Users disable the system entirely.

**Warning signs:**
- Claude starts forgetting context in sessions where recommendations were injected
- Users report "Claude got worse after installing harness-evolve"
- Compaction happening earlier than expected in sessions
- Recommendation text appearing in compacted summaries instead of user's actual work

**Prevention:**
1. **Extreme brevity**: Recommendations injected via stdout must be under 200 tokens total. Use a one-line summary format: `[harness-evolve] 3 suggestions ready. Run /evolve to review.`
2. **Pointer, not payload**: Inject a pointer to the full recommendations file, not the recommendations themselves
3. **One-shot injection**: Only inject once per session (when threshold is met), never repeatedly
4. **File-based delivery as primary**: Write to `~/.harness-evolve/recommendations.md` and let users pull when ready, rather than pushing into context
5. **Measure impact**: Track context window usage before and after injection to validate the overhead is acceptable

**Detection:** Monitor the token count of injected content. Alert if any single injection exceeds 300 tokens.

**Phase mapping:** Phase 2 (recommendation delivery). Design the delivery format to be minimal from the start.

**Sources:**
- [Claude Code Context Buffer: The 33K-45K Token Problem](https://claudefa.st/blog/guide/mechanics/context-buffer-management)
- [Claude's 1M Context Window Guide](https://karozieminski.substack.com/p/claude-1-million-context-window-guide-2026)
- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks)
- Confidence: **HIGH** (well-understood context window mechanics)

---

### Pitfall 4: Recommendation Quality Degeneration (Feedback Loop Drift)

**What goes wrong:** The system's pattern analysis produces increasingly irrelevant or harmful recommendations over time. This manifests as: (a) Goodhart's Law -- the system optimizes for proxy metrics (frequency of command usage) rather than actual user intent; (b) echo chamber effects where early recommendations bias future interaction patterns, which produces more of the same recommendations; (c) "verbose confidence" where the LLM-based analyzer rewards its own verbose, confident-sounding analysis over actually useful insights.

**Why it happens:** Self-improving systems are susceptible to degenerate feedback loops. If the system recommends creating a hook, and the user creates the hook, the system sees more hook-related activity and recommends more hooks -- even when a skill or rule would be more appropriate. The routing decision tree becomes biased toward whatever category it recommended first. Additionally, LLM-based evaluation naturally favors verbose, structured outputs over terse but correct ones.

**Consequences:** Users receive redundant recommendations they have already acted on. The system over-recommends one category (e.g., hooks) while under-recommending others (e.g., memory, settings). Over time, user trust erodes and the system is disabled. In extreme cases, recommendations actively degrade the user's harness configuration (e.g., creating hooks that should be rules).

**Warning signs:**
- Same recommendation appearing multiple times after the user has already acted on it
- 80%+ of recommendations going to a single routing target (e.g., all hooks)
- Users dismissing recommendations without reading them
- Recommendations conflicting with each other

**Prevention:**
1. **Track recommendation outcomes**: Did the user act on it? Dismiss it? If dismissed, do not re-recommend the same pattern
2. **Routing diversity check**: If more than 60% of recent recommendations target the same mechanism, flag for review
3. **Cooldown periods**: After a recommendation is delivered, suppress similar recommendations for N sessions
4. **Ground truth validation**: Include concrete testable criteria in recommendations (e.g., "This hook should reduce approval prompts from ~5/session to 0") so effectiveness can be verified
5. **User feedback signal**: A simple thumbs-up/down on recommendations feeds back into the routing heuristics
6. **Pre-processing filters**: Before LLM analysis, apply deterministic rules to filter obvious patterns (e.g., "same command typed 10+ times" is clearly a hook candidate) rather than relying solely on LLM judgment

**Detection:** Maintain a `recommendation_history.jsonl` that tracks what was recommended, to which target, and whether it was acted upon. Dashboard/report showing distribution across routing targets.

**Phase mapping:** Phase 3 (pattern analysis + routing). Build the tracking infrastructure alongside the recommendation engine, not after.

**Sources:**
- [How to build self-improving coding agents - Part 1](https://ericmjl.github.io/blog/2026/1/17/how-to-build-self-improving-coding-agents-part-1/)
- [Degenerate Feedback Loops in Recommender Systems](https://www.researchgate.net/publication/334385975_Degenerate_Feedback_Loops_in_Recommender_Systems)
- [Future of AI Models: Model collapse](https://arxiv.org/html/2511.05535v1)
- Confidence: **MEDIUM** (well-studied in recommender systems, untested in this specific domain)

---

### Pitfall 5: Log Data Contains Secrets and Sensitive Information

**What goes wrong:** The interaction logs captured by hooks (UserPromptSubmit, PreToolUse, PostToolUse) inevitably contain sensitive data: API keys typed in prompts, database credentials in tool outputs, proprietary code in conversation transcripts, and personal information in natural language. Storing all of this in plaintext files at `~/.harness-evolve/logs/` creates a security and privacy liability.

**Why it happens:** The system's value proposition requires capturing user interactions comprehensively. But "comprehensively" means capturing everything -- including the prompt where the user says "my AWS key is AKIA..." or the tool output containing production database URLs. The hooks system provides raw access to all of this data.

**Consequences:** Plaintext credential exposure on disk. If the user's machine is compromised, all captured interactions are immediately readable. If the project is used in enterprise environments, it may violate compliance requirements (SOC 2, GDPR). If log files are accidentally committed to git or shared, sensitive data leaks. The analysis agent itself processes these logs, potentially echoing secrets in recommendations.

**Warning signs:**
- Log files containing strings matching common secret patterns (AKIA*, ghp_*, sk-*)
- Users reporting credentials visible in recommendation output
- Compliance teams flagging the tool during security audits

**Prevention:**
1. **Secret scrubbing pipeline**: Before writing any log entry to disk, run a regex-based scrubber that redacts common secret patterns (AWS keys, GitHub tokens, API keys, passwords in connection strings). Use established patterns from tools like `truffleHog` or `detect-secrets`
2. **Minimal capture by default**: Only log the data needed for pattern analysis -- command names and frequency, not full command output. Capture the shape of interactions, not the content
3. **Configurable capture levels**: `minimal` (command names + timestamps only), `standard` (commands + truncated args), `full` (everything, user opt-in only)
4. **File permissions**: Set log files to `0600` (owner read/write only) on creation
5. **Retention policy**: Auto-delete logs older than 30 days (matching Claude Code's own `cleanupPeriodDays`)
6. **Never include raw log content in recommendations**: The analysis agent should reference patterns ("you ran `git commit` 47 times"), not raw captured data
7. **Add `~/.harness-evolve/` to global .gitignore template** in documentation

**Detection:** Include a `secrets_detected` counter in the health report. Run the scrubber on existing logs periodically and report any unredacted secrets found.

**Phase mapping:** Phase 1 (data capture). The scrubbing pipeline must exist before the first log entry is written. Retrofitting is dangerous because unredacted logs already exist on disk.

**Sources:**
- [Secure agentic AI end-to-end - Microsoft Security Blog](https://www.microsoft.com/en-us/security/blog/2026/03/20/secure-agentic-ai-end-to-end/)
- [Agentic AI Governance in 2026](https://www.semnet.co/post/agentic-ai-governance-in-2026-preventing-data-leaks-and-cves)
- [AI Agent Security in 2026](https://beam.ai/agentic-insights/ai-agent-security-in-2026-the-risks-most-enterprises-still-ignore)
- Confidence: **HIGH** (universal security concern, well-understood)

---

## Moderate Pitfalls

---

### Pitfall 6: Hook Performance Overhead Degrades User Experience

**What goes wrong:** Every UserPromptSubmit hook fires synchronously before Claude processes the user's prompt. If the harness-evolve hook reads log files, checks the counter, and performs any processing, it adds latency to every single interaction. At 200ms this is imperceptible; at 500ms it is noticeable; at 1000ms+ users disable the hook.

**Why it happens:** The temptation is to do "just a little processing" in the hook itself -- check the counter, maybe scan the last few log entries, format the output. But shell script I/O is slow, and the hook runs on every prompt submission. One developer reports running 95 hooks without issues because each completes in under 200ms. The budget is real and tight.

**Prevention:**
1. **Strict 100ms budget** for UserPromptSubmit hooks: read counter, increment counter, exit. No analysis, no file scanning
2. **All analysis in the Stop hook** (or manually triggered via /evolve): the Stop hook has a 600-second default timeout and runs after the conversation, not during it
3. **Use the `if` conditional field** on PreToolUse/PostToolUse hooks to narrow the matcher and avoid spawning processes for irrelevant tool calls
4. **Benchmark on first install**: Time the hook execution and warn if it exceeds 200ms
5. **Async hooks for non-blocking side effects**: PostToolUse logging hooks should be async so they never block the user

**Detection:** Include a `hook_latency_ms` field in log entries. Alert if average latency exceeds 150ms.

**Phase mapping:** Phase 1 (hook infrastructure). Set the performance budget as a hard constraint before writing any hook code.

**Sources:**
- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks)
- [Claude Code Hooks Tutorial](https://blakecrosley.com/blog/claude-code-hooks-tutorial)
- Confidence: **HIGH** (documented behavior, consistent community reports)

---

### Pitfall 7: Unbounded Log Growth Consumes Disk Space

**What goes wrong:** Capturing every interaction across every session produces logs that grow without bound. Claude Code's own `.claude/` directory has been reported to grow to 300GB+ and consume all available disk space, causing cascade failures. The harness-evolve system adds another unbounded growth vector at `~/.harness-evolve/logs/`.

**Why it happens:** Each interaction log entry is small (1-5KB), but a power user generating 200+ interactions per day across multiple projects accumulates 50-100MB per month. Over months without cleanup, this compounds. If full tool outputs are captured (PostToolUse), a single file read can be 100KB+, and the growth becomes aggressive.

**Prevention:**
1. **Mandatory retention policy**: Delete logs older than 30 days by default (configurable)
2. **Size cap per log file**: Rotate when a file exceeds 10MB
3. **Total storage cap**: If `~/.harness-evolve/` exceeds 500MB, trigger aggressive cleanup
4. **Pre-aggregation**: After analysis, compress raw logs into aggregated pattern summaries and delete the raw data
5. **Startup health check**: On SessionStart, check disk usage of the log directory and warn if excessive

**Detection:** SessionStart hook checks directory size. If exceeding threshold, inject a warning: `[harness-evolve] Log directory is ${size}MB. Run /evolve --cleanup to manage.`

**Phase mapping:** Phase 1 (data capture). Implement retention from the first version.

**Sources:**
- [~/.claude grows unbounded - Issue #24207](https://github.com/anthropics/claude-code/issues/24207)
- [Large JSONL files cause RAM exhaustion - Issue #22365](https://github.com/anthropics/claude-code/issues/22365)
- [Background task ate 324GB - RD Blog](https://rdiachenko.com/posts/troubleshooting/claude-code-bg-task-disk-bug/)
- Confidence: **HIGH** (documented in Claude Code core)

---

### Pitfall 8: Exit Code Confusion Causes Silent Security Failures

**What goes wrong:** A hook that should block an action uses `exit 1` instead of `exit 2`. The hook appears to work during testing (a warning prints), but the action proceeds anyway. This is the #1 documented hook mistake in the Claude Code ecosystem. For harness-evolve, this means a PermissionRequest hook that should deny a request instead warns and allows, or a PreToolUse validation hook that should block a command instead logs and continues.

**Why it happens:** In standard Unix convention, `exit 1` means error/failure. In Claude Code's hook system, `exit 1` is a non-blocking warning (stderr shown in verbose mode only), while `exit 2` is the actual blocking signal. This is counter-intuitive and poorly understood by developers new to the hooks system.

**Prevention:**
1. **Document prominently**: Every hook file should have a comment header explaining the exit code semantics
2. **Use named constants**: `EXIT_SUCCESS=0; EXIT_BLOCK=2; EXIT_WARN=1` at the top of every shell script
3. **Integration tests**: For every blocking hook, test that the blocked action was actually prevented, not just warned about
4. **Linting**: A pre-commit check that scans hook scripts for bare `exit 1` and warns if it might be intended as `exit 2`

**Detection:** Review all hook scripts for `exit 1` usage. If found in a security-critical path, escalate.

**Phase mapping:** Phase 1 (hook infrastructure). Establish the exit code convention in the first hook written.

**Sources:**
- [The Silent Failure Mode in Claude Code Hooks](https://thinkingthroughcode.medium.com/the-silent-failure-mode-in-claude-code-hook-every-dev-should-know-about-0466f139c19f)
- [Hooks reference - exit code behavior](https://code.claude.com/docs/en/hooks)
- Confidence: **HIGH** (official documentation, confirmed behavior)

---

### Pitfall 9: Claude Code Version Incompatibility Breaks Hooks

**What goes wrong:** Claude Code ships updates frequently (137 versions between v2.0.14 and v2.1.88 as of March 2026). Hook behavior has had regressions: hooks firing twice from home directories (v2.0.x), hooks non-functional in subdirectories (v2.0.27), hooks stopping after 2.5 hours (Issue #16047), and UserPromptSubmit breaking between versions. A harness-evolve installation that works on v2.1.80 may break on v2.1.85.

**Why it happens:** The hooks API is relatively new and evolving rapidly. Anthropic adds new hook events, changes exit code semantics for specific events, and refactors the hook execution pipeline. There is no formal stability guarantee or versioned API contract for hooks. Plugin hooks specifically have had a separate code path with distinct bugs.

**Prevention:**
1. **Version detection on startup**: SessionStart hook checks `claude --version` and compares against a known-compatible range
2. **Feature detection over version pinning**: Instead of "requires v2.1.80+", test whether specific behavior works (e.g., "does UserPromptSubmit stdout injection work?")
3. **Compatibility matrix in README**: Maintain a tested-versions table that is updated with each Claude Code release
4. **Graceful degradation**: If a hook feature is broken in the detected version, fall back to alternative delivery (file-based recommendations instead of stdout injection)
5. **CI testing against multiple Claude Code versions**: If feasible, test hooks against the last 3 stable releases

**Detection:** SessionStart hook runs a quick self-test and logs the Claude Code version. If the version is untested, inject a warning.

**Phase mapping:** Phase 1 (hook infrastructure). Build version detection into the foundation.

**Sources:**
- [Hook events fired twice - Issue #3465](https://github.com/anthropics/claude-code/issues/3465)
- [Hooks non-functional in subdirectories - Issue #10367](https://github.com/anthropics/claude-code/issues/10367)
- [Hooks stop after 2.5 hours - Issue #16047](https://github.com/anthropics/claude-code/issues/16047)
- [Plugin hooks not updated on version change - Issue #18517](https://github.com/anthropics/claude-code/issues/18517)
- Confidence: **HIGH** (documented regressions across multiple versions)

---

### Pitfall 10: Over-Automation Erodes User Trust and Control

**What goes wrong:** The system makes recommendations that feel intrusive, presumptuous, or wrong. Users feel surveilled ("it's tracking everything I type"). Automatic application of recommendations (full-auto mode) changes the user's configuration without their deep understanding, leading to confusion when behavior changes unexpectedly. The system creates hooks/rules/skills the user does not understand and cannot debug.

**Why it happens:** The system's goal (make the harness self-improving) is inherently in tension with user agency. The more automated it is, the less the user understands their own configuration. This is the "auto-approval fatigue" problem: after approving 10 recommendations without reading them, the user is no longer meaningfully in the loop.

**Prevention:**
1. **Recommendation-only by default**: Never auto-apply. Show recommendations and require explicit user action. Full-auto mode should be buried in settings, not the default
2. **Explain the "why"**: Every recommendation must include what pattern was detected, why this routing target was chosen, and what the expected improvement is
3. **Undo mechanism**: Every applied recommendation should be reversible with a single command (`/evolve --undo last`)
4. **Transparency log**: Users can run `/evolve --history` to see exactly what was recommended, when, and whether it was applied
5. **Progressive trust building**: Start with the most conservative, obviously-correct recommendations (e.g., "you approved `Bash(npm test)` 47 times, add it to allowed tools?"). Only escalate to complex recommendations (skill creation, rule refactoring) after the user has accepted simpler ones
6. **Opt-in data capture escalation**: Start with minimal capture (command names + frequency). Only capture full content if the user explicitly enables `full` capture mode

**Detection:** Track the ratio of accepted vs. dismissed recommendations. If dismissal rate exceeds 50%, the system is producing low-value recommendations and should reduce frequency.

**Phase mapping:** Phase 2 (recommendation delivery) and Phase 3 (routing). The delivery format determines user trust.

**Sources:**
- [Claude Code Auto Mode: Autonomous Permission Guide](https://www.digitalapplied.com/blog/claude-code-auto-mode-autonomous-permission-decisions-guide)
- [When Should AI Agents Run Unsupervised?](https://medium.com/@cenrunzhe/claude-code-auto-mode-and-the-new-question-when-should-ai-agents-run-unsupervised-0d9333517d8a)
- [6 Ways to Ruin a Perfectly Good AI Agent - Salesforce](https://www.salesforce.com/blog/ai-implementation-pitfalls/?bc=OTH)
- Confidence: **HIGH** (well-studied UX pattern in automation systems)

---

## Minor Pitfalls

---

### Pitfall 11: Hook Duplicate Execution from Directory Traversal

**What goes wrong:** Claude Code merges hooks from multiple settings.json files (user-level, project-level, local-level). If harness-evolve installs hooks at the user level (`~/.claude/settings.json`) AND a project also defines hooks for the same events, both fire. If the user installs harness-evolve as a plugin AND manually adds hooks, deduplication may not catch semantically-identical but textually-different commands.

**Prevention:**
1. Install hooks at exactly one level (user-level recommended for a global tool)
2. Use unique command paths that are easy to deduplicate
3. Document clearly: "Do not manually add harness-evolve hooks if installed as a plugin"

**Sources:**
- [Hook events fired twice - Issue #3465](https://github.com/anthropics/claude-code/issues/3465)
- [Hook regression showing duplicate messages - Issue #9602](https://github.com/anthropics/claude-code/issues/9602)

---

### Pitfall 12: Analysis Agent Context Window Overflow

**What goes wrong:** The Stop hook spawns an agent to analyze 50+ sessions of interaction logs. The accumulated log data exceeds the agent's context window, causing truncation, hallucinated patterns, or outright failure.

**Prevention:**
1. Shell-based pre-processing (the project already plans this): extract top-N patterns with frequency counts before feeding to the agent
2. Cap the input to the analysis agent at 50K tokens regardless of available log data
3. Use structured summaries, not raw logs: `{command: "git commit", count: 47, sessions: 12}` not 47 individual log entries

**Sources:**
- [PROJECT.md Technical Gray Area #4](file://PROJECT.md)

---

### Pitfall 13: Dynamic Plugin Discovery Fragility

**What goes wrong:** The system scans `settings.json`, `.claude/` directory, and `enabledPlugins` to discover installed tools. But the plugin marketplace has known bugs: stale cached clones, schema validation failures blocking entire marketplace loads, and version paths changing without hook updates. The discovery scan may report incorrect or stale plugin states.

**Prevention:**
1. Treat discovery results as hints, not truth. Recommendations should be phrased as "If you have GSD installed, consider..." rather than "GSD detected, creating..."
2. Cache discovery results per session, not across sessions
3. Include a `/evolve --discover` command for manual re-scan

**Sources:**
- [Plugin refresh - no way to pull latest - Issue #38271](https://github.com/anthropics/claude-code/issues/38271)
- [Plugin update doesn't refresh marketplace clone - Issue #36317](https://github.com/anthropics/claude-code/issues/36317)

---

### Pitfall 14: cleanupPeriodDays Setting Misbehavior

**What goes wrong:** Setting `cleanupPeriodDays: 0` in Claude Code's settings.json completely prevents session transcripts from being written, rather than disabling cleanup as documented. If harness-evolve relies on reading Claude Code's own conversation transcripts (via `transcript_path`), a user with this setting will have no transcripts to analyze.

**Prevention:**
1. On startup, check the user's `cleanupPeriodDays` setting
2. If set to 0, warn: "Transcript analysis requires cleanupPeriodDays > 0"
3. Do not depend solely on Claude Code's transcripts; maintain independent logs via hooks

**Sources:**
- [cleanupPeriodDays: 0 disables persistence - Issue #23710](https://github.com/anthropics/claude-code/issues/23710)

---

### Pitfall 15: Long Session Hook Degradation

**What goes wrong:** Hooks silently stop executing after approximately 2.5 hours of continuous session use. No error messages, no warnings -- they simply stop firing. If the user has a long coding session (common for complex tasks), the harness-evolve hooks stop capturing data partway through.

**Prevention:**
1. Include a periodic "heartbeat" check: the SessionStart hook writes a timestamp, and if the user runs `/evolve`, it checks how long ago the last log entry was written
2. Document this limitation clearly
3. Consider recommending `/clear` at natural break points (which starts a new session and reactivates hooks)

**Sources:**
- [Hooks stop executing after ~2.5 hours - Issue #16047](https://github.com/anthropics/claude-code/issues/16047)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Phase 1: Hook Infrastructure | UserPromptSubmit stdout unreliability (Pitfall 1) | **Critical** | Dual delivery mechanism; feature detection over version pinning |
| Phase 1: Hook Infrastructure | File-based counter race condition (Pitfall 2) | **Critical** | Atomic writes; per-session log files |
| Phase 1: Hook Infrastructure | Exit code confusion (Pitfall 8) | **Moderate** | Named constants; integration tests for blocking behavior |
| Phase 1: Hook Infrastructure | Hook performance overhead (Pitfall 6) | **Moderate** | 100ms budget; async for non-blocking hooks |
| Phase 1: Data Capture | Secret leakage in logs (Pitfall 5) | **Critical** | Scrubbing pipeline before first write; minimal capture default |
| Phase 1: Data Capture | Unbounded log growth (Pitfall 7) | **Moderate** | Retention policy; size caps; startup health check |
| Phase 2: Recommendation Delivery | Context window pollution (Pitfall 3) | **Critical** | Pointer-not-payload; 200 token budget for injected text |
| Phase 2: Recommendation Delivery | Over-automation trust erosion (Pitfall 10) | **Moderate** | Recommendation-only default; explain the "why"; undo mechanism |
| Phase 3: Pattern Analysis | Quality degeneration/feedback drift (Pitfall 4) | **Critical** | Track outcomes; routing diversity checks; cooldown periods |
| Phase 3: Pattern Analysis | Analysis agent context overflow (Pitfall 12) | **Moderate** | Shell pre-processing; 50K token cap on agent input |
| Phase 3: Dynamic Discovery | Plugin discovery fragility (Pitfall 13) | **Minor** | Treat as hints; per-session cache; manual re-scan |
| Cross-cutting | Claude Code version incompatibility (Pitfall 9) | **Moderate** | Feature detection; graceful degradation; compatibility matrix |
| Cross-cutting | Long session hook degradation (Pitfall 15) | **Minor** | Heartbeat checks; document limitation |

---

## Summary Severity Matrix

| Severity | Count | Pitfalls |
|----------|-------|----------|
| Critical | 5 | #1 (stdout unreliability), #2 (race conditions), #3 (context pollution), #4 (quality drift), #5 (secret leakage) |
| Moderate | 5 | #6 (performance), #7 (disk growth), #8 (exit codes), #9 (version compat), #10 (over-automation) |
| Minor | 5 | #11 (duplicate hooks), #12 (context overflow), #13 (discovery fragility), #14 (cleanup setting), #15 (long session degradation) |

---

## Sources Index

### Official Documentation
- [Hooks reference - Claude Code Docs](https://code.claude.com/docs/en/hooks)
- [Claude Code settings](https://code.claude.com/docs/en/settings)

### Confirmed Bug Reports (GitHub Issues)
- [#13912 - UserPromptSubmit stdout error](https://github.com/anthropics/claude-code/issues/13912)
- [#12151 - Plugin hook output not captured](https://github.com/anthropics/claude-code/issues/12151)
- [#17804 - False positive injection detection](https://github.com/anthropics/claude-code/issues/17804)
- [#17550 - hookSpecificOutput error on first message](https://github.com/anthropics/claude-code/issues/17550)
- [#28847 - .claude.json race condition](https://github.com/anthropics/claude-code/issues/28847)
- [#28922 - 8 race condition reports closed](https://github.com/anthropics/claude-code/issues/28922)
- [#3465 - Hook events fired twice](https://github.com/anthropics/claude-code/issues/3465)
- [#9602 - Duplicate hook messages regression](https://github.com/anthropics/claude-code/issues/9602)
- [#10367 - Hooks non-functional in subdirectories](https://github.com/anthropics/claude-code/issues/10367)
- [#16047 - Hooks stop after 2.5 hours](https://github.com/anthropics/claude-code/issues/16047)
- [#18517 - Plugin hooks not updated on version change](https://github.com/anthropics/claude-code/issues/18517)
- [#24207 - ~/.claude grows unbounded](https://github.com/anthropics/claude-code/issues/24207)
- [#22365 - Large JSONL files cause RAM exhaustion](https://github.com/anthropics/claude-code/issues/22365)
- [#23710 - cleanupPeriodDays: 0 disables persistence](https://github.com/anthropics/claude-code/issues/23710)
- [#38271 - Plugin refresh broken](https://github.com/anthropics/claude-code/issues/38271)

### Community Sources
- [The Silent Failure Mode in Claude Code Hooks](https://thinkingthroughcode.medium.com/the-silent-failure-mode-in-claude-code-hook-every-dev-should-know-about-0466f139c19f)
- [Claude Code Context Buffer Analysis](https://claudefa.st/blog/guide/mechanics/context-buffer-management)
- [How to build self-improving coding agents](https://ericmjl.github.io/blog/2026/1/17/how-to-build-self-improving-coding-agents-part-1/)
- [Background task ate 324GB](https://rdiachenko.com/posts/troubleshooting/claude-code-bg-task-disk-bug/)
