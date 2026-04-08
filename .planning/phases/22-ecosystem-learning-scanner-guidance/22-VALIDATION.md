---
phase: 22
slug: ecosystem-learning-scanner-guidance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-08
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/commands/templates.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/commands/templates.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | SCAN-01 | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "scan-context"` | Partial | ⬜ pending |
| 22-01-02 | 01 | 1 | SCAN-02 | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "analysis area"` | No (W0) | ⬜ pending |
| 22-01-03 | 01 | 1 | ECO-01 | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "structured output"` | No (W0) | ⬜ pending |
| 22-01-04 | 01 | 1 | ECO-02 | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "severity classification"` | No (W0) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/commands/templates.test.ts` — needs new assertions for: scan-context reference, store-findings reference, 7 analysis areas, severity classification section, boundary conditions, structured output contract, template version 4

*Existing infrastructure covers framework and config. Only new test assertions needed in existing file.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scan template produces coherent model output in live Claude Code session | SCAN-01 | Requires real Claude Code runtime + model execution | Invoke `/evolve:scan` in a live session, verify model reads scan-context and produces structured findings |
| Guidance extensibility without code changes | SCAN-02 / MODEL-04 | Requires editing .md and re-running scan to verify model picks up new area | Add a new analysis area to guidance, run `/evolve:scan`, verify new area appears in output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
