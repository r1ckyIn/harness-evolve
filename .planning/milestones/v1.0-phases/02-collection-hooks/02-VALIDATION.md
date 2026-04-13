---
phase: 2
slug: collection-hooks
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npx tsc --noEmit` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CAP-01 | unit | `npx vitest run tests/unit/hooks/user-prompt-submit.test.ts -t "captures prompt"` | Wave 0 | pending |
| 02-01-02 | 01 | 1 | CAP-04 | unit | `npx vitest run tests/unit/hooks/user-prompt-submit.test.ts -t "stores transcript_path"` | Wave 0 | pending |
| 02-01-03 | 01 | 1 | CAP-02 | unit | `npx vitest run tests/unit/hooks/permission-request.test.ts -t "captures permission"` | Wave 0 | pending |
| 02-01-04 | 01 | 1 | CAP-03 | unit | `npx vitest run tests/unit/hooks/tool-use.test.ts -t "captures tool usage"` | Wave 0 | pending |
| 02-01-05 | 01 | 1 | CAP-03 | unit | `npx vitest run tests/unit/hooks/tool-use.test.ts -t "calculates duration"` | Wave 0 | pending |
| 02-02-01 | 02 | 2 | PERF | integration | `npx vitest run tests/integration/hook-performance.test.ts` | Wave 0 | pending |
| 02-02-02 | 02 | 2 | BUILD | integration | `npx tsup && ls dist/hooks/` | Wave 0 | pending |
| 02-02-03 | 02 | 2 | CONFIG | unit | `npx vitest run tests/unit/hooks/ -t "respects config"` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/hooks/user-prompt-submit.test.ts` -- stubs for CAP-01, CAP-04
- [ ] `tests/unit/hooks/pre-tool-use.test.ts` -- stubs for CAP-03 (pre event)
- [ ] `tests/unit/hooks/post-tool-use.test.ts` -- stubs for CAP-03 (post event, duration)
- [ ] `tests/unit/hooks/permission-request.test.ts` -- stubs for CAP-02
- [ ] `tests/unit/hooks/shared.test.ts` -- stubs for shared stdin reader, summarizeToolInput
- [ ] `tests/integration/hook-performance.test.ts` -- stubs for performance budget verification

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hook invoked by real Claude Code session | CAP-01/02/03 | Requires live Claude Code environment | Start Claude Code, submit a prompt, verify JSONL entry appears in logs/prompts/ |
| PermissionRequest fires on actual permission dialog | CAP-02 | Requires user interaction with permission UI | Use a tool requiring approval, check logs/permissions/ |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
