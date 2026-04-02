---
phase: 5
slug: delivery-user-interaction
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose --coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | DEL-01 | unit | `npx vitest run tests/unit/delivery/renderer.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | DEL-04 | unit | `npx vitest run tests/unit/delivery/renderer.test.ts -t "full detail" -x` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | QUA-03 | unit | `npx vitest run tests/unit/delivery/renderer.test.ts -t "confidence" -x` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 1 | DEL-05 | unit | `npx vitest run tests/unit/delivery/state.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 1 | QUA-02 | unit | `npx vitest run tests/unit/delivery/rotator.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | DEL-02 | unit | `npx vitest run tests/unit/delivery/notification.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | DEL-03 | unit | `npx vitest run tests/unit/delivery/notification.test.ts -t "disabled" -x` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | TRG-03 | integration | `npx vitest run tests/integration/delivery-pipeline.test.ts -t "evolve" -x` | ❌ W0 | ⬜ pending |
| 05-02-04 | 02 | 1 | TRG-04 | integration | `npx vitest run tests/integration/delivery-pipeline.test.ts -t "coexist" -x` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | DEL-06 | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -x` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | QUA-01 | unit | `npx vitest run tests/unit/delivery/auto-apply.test.ts -t "default disabled" -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/delivery/renderer.test.ts` — stubs for DEL-01, DEL-04, QUA-03
- [ ] `tests/unit/delivery/state.test.ts` — stubs for DEL-05
- [ ] `tests/unit/delivery/rotator.test.ts` — stubs for QUA-02
- [ ] `tests/unit/delivery/notification.test.ts` — stubs for DEL-02, DEL-03
- [ ] `tests/unit/delivery/auto-apply.test.ts` — stubs for DEL-06, QUA-01
- [ ] `tests/integration/delivery-pipeline.test.ts` — stubs for TRG-03, TRG-04

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UserPromptSubmit stdout appears as Claude context | DEL-02 | Requires live Claude Code session | Submit prompt, check if notification text appears in Claude's awareness |
| /evolve skill invocation | TRG-03 | Requires live Claude Code skill system | Type /evolve in Claude Code, verify analysis runs and results display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
