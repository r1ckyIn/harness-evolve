---
phase: 17
slug: bug-fixes-reliability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 1 | FIX-01 | unit | `npx vitest run tests/unit/cli/init.test.ts -x` | Exists (needs new cases) | ⬜ pending |
| 17-01-02 | 01 | 1 | FIX-02 | unit | `npx vitest run tests/unit/scan/context-builder.test.ts -x` | Exists (needs new cases) | ⬜ pending |
| 17-01-03 | 01 | 1 | FIX-02 | unit | `npx vitest run tests/unit/scan/scanners/staleness.test.ts -x` | Exists (needs new cases) | ⬜ pending |
| 17-02-01 | 02 | 1 | FIX-03 | unit | `npx vitest run tests/unit/cli/apply.test.ts -x` | Exists (needs new cases) | ⬜ pending |
| 17-02-02 | 02 | 1 | FIX-03 | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -x` | Exists (needs regression case) | ⬜ pending |
| 17-03-01 | 03 | 1 | FIX-04 | unit | `npx vitest run tests/unit/analysis/trigger.test.ts -x` | Exists (needs new cases) | ⬜ pending |
| 17-03-02 | 03 | 1 | FIX-04 | unit | `npx vitest run tests/unit/hooks/user-prompt-submit.test.ts -x` | Exists (already covered) | ⬜ pending |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Each test file exists; only new test cases need to be added within existing describe blocks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Global commands visible from any directory | FIX-01 | Requires multi-directory Claude Code session | Start Claude Code in a non-project dir, verify `/evolve:scan` available |
| Notification appears on next prompt | FIX-04 | Requires full Claude Code session lifecycle | Run analysis via stop hook, start new prompt, check notification output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
