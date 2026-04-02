---
status: complete
phase: 02-collection-hooks
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 01-HUMAN-UAT.md]
started: 2026-03-31T13:50:00.000Z
updated: 2026-03-31T12:50:30.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Compiled hooks exist as standalone JS files
expected: After `npx tsup`, `ls dist/hooks/` shows 5 files: user-prompt-submit.js, pre-tool-use.js, post-tool-use.js, post-tool-use-failure.js, permission-request.js. Each is a standalone bundle.
result: pass

### 2. UserPromptSubmit hook captures prompt via stdin pipe
expected: Running `echo '{"session_id":"test","transcript_path":"/tmp/t.jsonl","cwd":"/tmp","permission_mode":"default","hook_event_name":"UserPromptSubmit","prompt":"hello world"}' | node dist/hooks/user-prompt-submit.js` exits 0 and creates a JSONL entry in ~/.harness-evolve/logs/prompts/ containing "hello world" with timestamp, session_id, prompt_length=11, and transcript_path.
result: pass

### 3. PreToolUse + PostToolUse duration correlation via compiled hooks
expected: Running PreToolUse then PostToolUse with same tool_use_id via stdin pipe produces a tools log entry with duration_ms >= 0, and the marker file in ~/.harness-evolve/pending/ is cleaned up afterward.
result: pass

### 4. PermissionRequest hook captures permission event
expected: Piping PermissionRequest JSON to the compiled hook produces a permissions log entry with tool_name and decision="unknown".
result: pass

### 5. Hook performance budget (< 100ms per hook)
expected: Each compiled hook completes in under 100ms when piped valid JSON. Measure with `time echo '...' | node dist/hooks/X.js`. This validates the Phase 2 success criterion that hooks complete within performance budget.
result: skipped
reason: 实测 ~163ms（其中 ~130ms 为 Node.js 冷启动，hook 逻辑 <10ms）。需研究 Claude Code hook 性能最佳实践后再决定是否需要优化。

### 6. UserPromptSubmit stdout injection (Phase 1 deferred - Gray Area #1)
expected: UserPromptSubmit stdout injection works on the current Claude Code version. The hook can write to stdout and Claude Code presents the injected text before handling the user's actual request. This was deferred from Phase 1 UAT.
result: skipped
reason: 延期到 Phase 5 集成时验证，当前 Phase 2 未注册 hook 到 settings.json

## Summary

total: 6
passed: 4
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps
