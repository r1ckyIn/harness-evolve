# Codebase Concerns

**Analysis Date:** 2026-04-16

---

## Known Bugs

**BUG-01: Hooks parsing in `context-builder.ts` generates false positives on real Claude Code configs (UNRESOLVED):**
- Symptoms: `extractHooksFromAllSettings()` at `src/scan/context-builder.ts:272-330` was fixed for v4 model-driven scan but the environment-scanner's separate `extractHooksFromSettings()` at `src/analysis/environment-scanner.ts:309-328` still uses a different implementation. The scan pipeline (model-driven) is fine. The automated analysis pipeline's environment snapshot (`checkAndTriggerAnalysis` → `scanEnvironment`) uses the environment-scanner variant, which may still miss nested `{matcher, hooks: [...]}` format.
- Files: `src/analysis/environment-scanner.ts` lines 292-328, `src/scan/context-builder.ts` lines 272-330
- Trigger: Background analysis triggered via Stop hook when user has real Claude Code settings with nested hook format
- Impact: Classifier outputs incorrect hook counts → downstream classifiers (`classifyRepeatedPrompts`, `classifyEcosystemAdaptations`) may miss hook-related recommendations
- Workaround: Model-driven `/evolve:scan` is unaffected (uses `context-builder.ts`)

**Persistence check heuristics are coarse-grained and produce false "persisted" judgments:**
- Symptoms: `checkPersistence()` in `src/analysis/outcome-tracker.ts:101-135` uses only prefix-based ID heuristics: any `rec-repeated-*` recommendation is considered "persisted" if `snapshot.installed_tools.hooks.length > 0` — even if the specific hook recommended was never created
- Files: `src/analysis/outcome-tracker.ts` lines 118-134
- Impact: `OutcomeSummary.persistence_rate` is inflated → `adjustConfidence()` in `src/analysis/analyzer.ts:40-65` under-downgrades confidence → recommendations that users consistently ignore appear more confident than warranted
- Fix approach: Store the specific artifact path or tool name in `applied_details` and verify that exact artifact exists in the snapshot

---

## Tech Debt

**Pre-Phase-18 scanners (redundancy, mechanization, staleness) omit `severity` field:**
- Files: Any remaining classifier in `src/analysis/classifiers/` that predates Phase 18
- Issue: Recommendation objects from older classifiers lack the `severity` key in JSON output. CLI grouping (`suggestions` vs `problems`) works correctly because it falls back gracefully, but raw JSON output from `paths.analysisResult` is inconsistent.
- Impact: Consumers of `analysis-result.json` who inspect `severity` directly get `undefined` for ~3 classifier types
- Fix: Add `severity: 'suggestion'` to the 3 pre-Phase-18 classifiers, or add a Zod parse/coerce step in `runAnalysis()` in `src/analysis/trigger.ts`
- Source: `.planning/v3.0-MILESTONE-AUDIT.md` line 14-16 (AUD-03 severity field gap)

**Missing barrel exports in `src/index.ts` for Phase 18 scanner functions:**
- Files: `src/index.ts`
- Issue: Some Phase 18 scanner functions and severity types are not exported from the public barrel — internal use only, but breaks programmatic consumers who import from `harness-evolve`
- Impact: Low — internal only. Affects downstream integrators, not end-users
- Source: `.planning/v3.0-MILESTONE-AUDIT.md` line 26

**REQUIREMENTS.md traceability table stale (WFL-01, WFL-02 show "Planned"):**
- Files: `.planning/REQUIREMENTS.md` (lines ~59-60)
- Issue: WFL-01 and WFL-02 appear as "Planned" in the table but are complete per VERIFICATION.md. Last-updated timestamp predates Phase 19 completion.
- Impact: Audit confusion only, no runtime impact

**Nyquist VALIDATION.md files exist but are not compliant across all milestones:**
- Files: Validation files in `.planning/phases/` for Phases 17, 18, 19, 21, 22, 23
- Issue: All have `nyquist_compliant: false`, `wave_0_complete: false` in frontmatter — documentation infrastructure in place but never completed
- Impact: GSD audit tooling reports PARTIAL compliance; no runtime impact

---

## Fragile Areas

**`ensureInit()` module-level singleton is process-scoped and not safe across parallel hook invocations:**
- Files: `src/storage/dirs.ts` lines 30-48
- Why fragile: `initialized` is a module-level boolean. Since each hook invocation spawns a new Node.js process (Claude Code runs hooks as child processes), this is safe in practice. However, any future refactor that imports multiple hooks into a single long-lived process (e.g., a test harness or a plugin architecture) would hit a race condition where `initialized=true` prevents directory creation for later callers.
- Safe modification: The flag is reset by `resetInit()` in tests. Continue using per-process hooks; do not merge hook entry points into a shared long-lived process.
- Test coverage: Covered in unit tests via `resetInit()`.

**Version compatibility range in `environment-scanner.ts` is hardcoded and will expire:**
- Files: `src/analysis/environment-scanner.ts` lines 17-18
- Code: `KNOWN_COMPATIBLE_MIN = '2.1.0'`, `KNOWN_COMPATIBLE_MAX = '2.1.99'`
- Why fragile: Any Claude Code release above 2.1.99 will cause `compatible: false` in every environment snapshot. Classifiers in `classifyEcosystemAdaptations` (`src/analysis/classifiers/ecosystem-adapter.ts`) check `snapshot.claude_code.compatible` — this produces false "compatibility unknown" recommendations for all users on new Claude Code versions.
- Impact: Medium — not a crash but persistent false recommendations after Claude Code updates
- Fix approach: Replace with a min-only floor (`>= 2.1.0`) or query a remotely-maintained compatibility list

**Notification flag file is not atomic and has a TOCTOU race:**
- Files: `src/delivery/notification.ts` lines 22-55
- Why fragile: `hasNotificationFlag()` uses `existsSync()` (synchronous) while `writeNotificationFlag()` and `clearNotificationFlag()` use async `writeFile`/`unlink`. If two concurrent `UserPromptSubmit` hook invocations both pass the `existsSync` check before either clears the flag, the notification is injected twice into consecutive prompts.
- Impact: Low probability (requires two prompts submitted in rapid succession), but user-visible duplicate notification messages
- Fix approach: Use a lock around the read-inject-clear sequence, or replace the flag with an atomic rename pattern

**Hook entry points call `loadConfig()` on every invocation — no config caching:**
- Files: `src/hooks/user-prompt-submit.ts:23`, `src/hooks/pre-tool-use.ts:21`, `src/hooks/post-tool-use.ts:21`, `src/hooks/permission-request.ts:18`, `src/hooks/post-tool-use-failure.ts:21`
- Why fragile: `loadConfig()` in `src/storage/config.ts` reads `~/.harness-evolve/config.json` from disk and runs Zod parse on every hook invocation. On slow disks or when the `~/.harness-evolve/` directory is on a network filesystem (e.g., Docker volume mounts, WSL), this adds measurable latency.
- Performance budget risk: The target is `<50ms` for UserPromptSubmit capture. Config read + Zod parse + log append + counter lock-increment is at least 3 serial async disk operations. Network filesystem users will exceed budget.
- Mitigation present: `loadConfig()` auto-creates defaults silently — no crash on missing config. But no in-process cache exists.
- Fix approach: Cache config with a TTL of ~5 seconds using a module-level Map keyed by file mtime

**`inferPatternType()` and `inferTarget()` in `outcome-tracker.ts` are ID-prefix string heuristics:**
- Files: `src/analysis/outcome-tracker.ts` (functions `inferPatternType`, `inferTarget` — not shown but referenced in lines 67-75)
- Why fragile: Recommendation IDs use `rec-{target}-{N}` format by convention. If ID generation changes or a future classifier uses a different naming scheme, these inference functions silently return wrong values.
- Impact: Outcome confidence adjustment is silently wrong for mismatched IDs
- Historical precedent: v1.0 RETROSPECTIVE (`src/analysis/classifiers` string mismatch in `inferPatternType`) was the same class of bug — see `.planning/RETROSPECTIVE.md` line 33-34

---

## Security Considerations

**High-entropy detection is disabled by default (`highEntropyDetection: false`):**
- Files: `src/scrubber/patterns.ts` line 83-86, `src/schemas/config.ts` line 26
- Risk: User prompts that contain API keys or secrets in formats not matching the 14 hardcoded patterns (e.g., hex-encoded keys, base64 tokens, custom service tokens) pass through unredacted to `~/.harness-evolve/logs/prompts/YYYY-MM-DD.jsonl`
- Current mitigation: 14 regex patterns cover common formats (AWS, GitHub, Slack, JWT, Stripe, Google, database URLs)
- Recommendation: Provide clearer user documentation that high-entropy detection exists and how to enable it. Consider enabling it by default in a future major version with opt-out.

**Generated hook scripts are written without write-file-atomic protection:**
- Files: `src/delivery/appliers/hook-applier.ts` line 67
- Code: `await writeFile(scriptPath, artifact.content, 'utf-8')` — plain writeFile, not atomic
- Risk: If the process is killed mid-write, the hook script is partially written. Claude Code may then attempt to execute a malformed bash script, causing unexpected hook behavior.
- Current mitigation: Create-only guard (never overwrites existing scripts) limits blast radius
- Fix approach: Use `writeFileAtomic` for all hook script writes

**`process.env.HOME ?? ''` falls back to empty string in containers/CI:**
- Files: `src/storage/dirs.ts` line 4, `src/delivery/appliers/hook-applier.ts` lines 45, 75, `src/delivery/appliers/rule-applier.ts` line 26, `src/delivery/appliers/settings-applier.ts` line 41
- Risk: When `HOME` is unset (some Docker images, CI runners), all paths resolve under the process working directory (e.g., `/hooks`, `/settings.json`) — potentially writing config files to the filesystem root or unexpected locations.
- Current mitigation: Claude Code itself sets `HOME`; this is only a risk for tests or unusual CI environments.
- Fix approach: Throw an explicit error if `HOME` is unset rather than silently falling back to empty string.

---

## Performance Bottlenecks

**Stop hook runs full analysis pipeline synchronously on the hot path:**
- Files: `src/hooks/stop.ts:22`, `src/analysis/trigger.ts:112-151`
- Problem: `checkAndTriggerAnalysis()` chains: `readCounter` → `loadConfig` → `preProcess` (reads all JSONL files for 30 days) → `scanEnvironment` (7 parallel filesystem scans + `execFileSync('claude', ['--version'])`) → `analyze` → `writeAnalysisResult` → `writeNotificationFlag`
- The performance budget for Stop hook is `<5s`. `preProcess` reads up to 30 days of JSONL files — a heavy user with 100+ sessions per day would have 3,000+ JSONL files per log type, each needing to be read and line-parsed.
- Cause: No size guard or sample cap on `readLogEntries`. Default window is 30 days with no file-count limit.
- Risk threshold: Users with `> 30 days × N sessions/day` entries will experience latency spikes
- Improvement path: Add a file-count cap (e.g., max 90 files) and a line-count cap per file in `src/analysis/jsonl-reader.ts`

**`execFileSync('claude', ['--version'])` is a synchronous blocking call:**
- Files: `src/analysis/environment-scanner.ts` lines 98-103
- Problem: `execFileSync` blocks the Node.js event loop for up to `timeout: 3000` ms while waiting for the claude process to start and respond. This is called inside `scanEnvironment()`, which is called synchronously inside `runAnalysis()`.
- Current mitigation: 3-second timeout + try/catch prevents hang-forever. But on slow systems or PATH lookup delays, this can add 1-3 seconds to the Stop hook's analysis path.
- Fix approach: Replace with `execFile` (async) or cache the version result between analysis runs

---

## Concurrency Concerns

**`appendLogEntry` relies on POSIX append atomicity claim for writes <4KB:**
- Files: `src/storage/logger.ts` lines 40-53
- Issue: The comment states "appendFile is atomic for writes <4KB on POSIX." This is true for single-byte appends via kernel `O_APPEND`, but Node.js `appendFile` makes two syscalls (open + write). On Linux it uses `O_APPEND` and is safe. On macOS (the primary target platform), `O_APPEND` behavior is also correct per POSIX. However, if a JSONL line exceeds 4096 bytes (possible for long prompts before truncation), the atomicity guarantee is lost.
- Risk: Concurrent `UserPromptSubmit` and `PreToolUse` hooks could produce interleaved partial JSONL lines in the same file (same second → same daily file).
- Current mitigation: Tool input is truncated to 200 chars (`src/hooks/shared.ts` line 3); prompt entries include `prompt_length` but the actual prompt is not truncated before writing, so a 10,000-character prompt creates a large JSONL line.
- Fix approach: Truncate prompt field in the log entry itself (not just for analysis), or accept the theoretical risk as acceptable for logging use case.

**Counter file lock timeout can add up to ~51 seconds to hook latency in worst case:**
- Files: `src/storage/counter.ts` lines 49-52, `src/analysis/trigger.ts` lines 79-82
- Issue: `lock()` retry config: `retries: 50, minTimeout: 20, maxTimeout: 1000`. Worst-case total wait: 50 × 1000ms = 50 seconds + stale threshold of 10 seconds. If a previous hook died holding the lock (process killed), subsequent hooks wait until stale=10000ms before breaking the lock.
- Current mitigation: `stale: 10000` is the safety valve; all errors are swallowed so Claude Code is never blocked.
- Impact: Low probability but measurable: a user who force-kills Claude Code mid-hook will experience all hooks silently failing for up to 10 seconds.
- Fix approach: The current design is correct; document the stale window clearly for operators.

---

## Scaling Limits

**Log directory grows unboundedly — no automatic rotation or pruning:**
- Files: `src/storage/logger.ts`, `src/storage/dirs.ts`
- Current capacity: Daily JSONL files accumulate in `~/.harness-evolve/logs/{prompts,tools,permissions,sessions}/`. No maximum file age or total size limit is enforced.
- Limit: `preProcess()` defaults to 30 days and reads all files in that window. After several months of use, the log directory could exceed hundreds of MB.
- Scaling path: Implement a background pruning step that deletes daily log files older than `config.analysis.threshold` days. The date-range filter in `readLogEntries` already handles the reading side; writing the pruner is the missing piece.

**`recommendation-state.json` is a single unbounded JSON array:**
- Files: `src/delivery/state.ts`, `src/schemas/delivery.ts`
- Current capacity: All recommendation state entries are loaded into memory on every `loadState()` call. The `rotator.ts` archives entries after `archiveAfterDays: 7`, which mitigates growth.
- Limit: If archiving is disabled or the rotator is not called, the state file grows indefinitely and every state read/write includes full deserialization.
- Scaling path: Already partially addressed by `src/delivery/rotator.ts` — ensure it is called regularly.

---

## Dependencies at Risk

**`proper-lockfile@4.1.2` is unmaintained:**
- Risk: The package has had no releases since 2020 and no active maintainer. While the core mkdir-based locking algorithm is correct and stable on macOS, there is no security patching or Node.js version compatibility commitment.
- Impact: The counter increment and trigger lock paths depend on it. A Node.js change that breaks `mkdir`-based locking would silently degrade counter accuracy.
- Migration plan: Consider replacing with `proper-lockfile` fork that is actively maintained, or implement the mkdir-lock pattern natively (it is only ~50 lines of code).

---

## Test Coverage Gaps

**Concurrent hook execution (multiple simultaneous Stop hooks) is not tested:**
- What's not tested: The scenario where 2-3 Claude Code instances fire Stop hooks simultaneously and both attempt `incrementCounter()` and `checkAndTriggerAnalysis()` at the same time
- Files: `src/storage/counter.ts`, `src/analysis/trigger.ts`
- Risk: Double-trigger of analysis, counter drift, or lockfile contention under real multi-instance use
- Priority: Medium — the lock logic is tested in isolation but not under concurrent process spawn

**`HOME` unset edge case is not covered in applier tests:**
- What's not tested: Behavior of `HookApplier`, `RuleApplier`, `SettingsApplier` when `process.env.HOME` is undefined
- Files: `src/delivery/appliers/hook-applier.ts:45`, `src/delivery/appliers/rule-applier.ts:26`, `src/delivery/appliers/settings-applier.ts:41`
- Risk: Silent writes to filesystem root (`/hooks`, `/settings.json`) in CI environments
- Priority: Low — Claude Code always sets HOME in production

**Notification flag TOCTOU race has no test coverage:**
- What's not tested: Two concurrent `UserPromptSubmit` hooks both seeing the flag before either clears it
- Files: `src/delivery/notification.ts`, `src/hooks/user-prompt-submit.ts:39-51`
- Risk: Duplicate notification injection — user sees the same notification twice in rapid succession
- Priority: Low — difficult to trigger but user-visible

---

## Open Feature Gaps (from `.planning/TODOS.md`)

**OBS-2: `/evolve:apply` uses free-form text input instead of numbered options:**
- Problem: The current apply command asks users to type recommendation IDs as free-form text. The TODOS.md notes that numbered options (like GSD) would be significantly better UX.
- Files: `src/commands/evolve-apply.ts`, `src/cli/apply.ts`
- Blocks: Approachable UX for non-technical users

**OBS-3: Scan output lacks "areas scanned" summary:**
- Problem: The scan output shows issues found but not a coverage summary (e.g., "7 scanners checked, N issues in M areas"). Users cannot tell whether a clean scan means no issues or no coverage.
- Files: `src/commands/evolve-scan.ts`
- Blocks: User confidence in scan completeness

**ARCH-01/ARCH-02: No regression path if model-driven scan produces inconsistent findings:**
- Problem: The v4+ pipeline is fully model-driven — there are no code-based fallback scanners. If Claude produces malformed JSON or violates the schema contract, `store-findings` rejects it but the user has no alternative scan path.
- Files: `src/cli/store-findings.ts`, `src/commands/evolve-scan.ts`
- Blocks: Offline/CI scan use-cases; scan reliability when model output degrades

---

*Concerns audit: 2026-04-16*
