---
phase: 7
slug: integration-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | TRG-02 | unit | `npx vitest run tests/unit/hooks/stop.test.ts -x` | Wave 0 | pending |
| 07-01-02 | 01 | 1 | TRG-02 | unit | `npx vitest run tests/unit/hooks/stop.test.ts -x` | Wave 0 | pending |
| 07-02-01 | 02 | 1 | DEL-06 | integration | `npx vitest run tests/integration/e2e-flows.test.ts -x` | Wave 0 | pending |
| 07-02-02 | 02 | 1 | QUA-04 | integration | `npx vitest run tests/integration/e2e-flows.test.ts -x` | Wave 0 | pending |
| 07-03-01 | 03 | 2 | ALL | integration | `npx vitest run tests/integration/e2e-flows.test.ts -x` | Wave 0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/hooks/stop.test.ts` — stubs for TRG-02 (Stop hook handler unit tests)
- [ ] `tests/integration/e2e-flows.test.ts` — covers TRG-02, DEL-06, QUA-04 (all 5 E2E flows)
- [ ] Fix `tests/integration/delivery-pipeline.test.ts` mock to include `outcomeHistory` path

*Existing infrastructure covers test framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stop hook fires after Claude response | TRG-02 | Requires live Claude Code runtime | Register hook in settings.json, submit prompts until counter >= threshold, verify analysis runs |
| /evolve auto-apply modifies settings.json | DEL-06 | Requires live filesystem with real settings | Set fullAuto=true, run /evolve, verify settings.json updated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
