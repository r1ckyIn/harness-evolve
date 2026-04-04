---
phase: 12
slug: deep-scan-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/unit/scan/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/scan/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | SCN-01 | unit | `npx vitest run tests/unit/scan/context-builder.test.ts -x` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | SCN-01 | unit | `npx vitest run tests/unit/scan/index.test.ts -x` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | SCN-02 | unit | `npx vitest run tests/unit/scan/scanners/redundancy.test.ts -x` | ❌ W0 | ⬜ pending |
| 12-02-02 | 02 | 1 | SCN-02 | unit | `npx vitest run tests/unit/scan/scanners/mechanization.test.ts -x` | ❌ W0 | ⬜ pending |
| 12-02-03 | 02 | 1 | SCN-02 | unit | `npx vitest run tests/unit/scan/scanners/staleness.test.ts -x` | ❌ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | SCN-01, SCN-03 | integration | `npx vitest run tests/integration/cli-scan.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/scan/context-builder.test.ts` — stubs for SCN-01 (context builder)
- [ ] `tests/unit/scan/index.test.ts` — stubs for SCN-01, SCN-03 (scan orchestrator)
- [ ] `tests/unit/scan/scanners/redundancy.test.ts` — stubs for SCN-02 (redundancy detection)
- [ ] `tests/unit/scan/scanners/mechanization.test.ts` — stubs for SCN-02 (mechanization detection)
- [ ] `tests/unit/scan/scanners/staleness.test.ts` — stubs for SCN-02 (staleness detection)
- [ ] `tests/integration/cli-scan.test.ts` — stubs for SCN-01 integration

*Existing infrastructure covers test framework. Wave 0 only needs test file stubs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Init displays scan results in terminal | SCN-01 | Terminal output formatting | Run `npx tsx src/cli/index.ts init` in a project directory and verify scan section appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
