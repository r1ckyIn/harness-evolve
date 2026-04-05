---
phase: 18
slug: comprehensive-config-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/scan` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/scan`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01-01 | 01 | 0 | AUD-03 | unit | `npx vitest run tests/unit/schemas/recommendation.test.ts -x` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 0 | AUD-01a | unit | `npx vitest run tests/unit/scan/scanners/conflict.test.ts -x` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 0 | AUD-01b | unit | `npx vitest run tests/unit/scan/scanners/structure.test.ts -x` | ❌ W0 | ⬜ pending |
| 18-01-04 | 01 | 0 | AUD-01c | unit | `npx vitest run tests/unit/scan/scanners/hooks-redundancy.test.ts -x` | ❌ W0 | ⬜ pending |
| 18-01-05 | 01 | 0 | AUD-01d | unit | `npx vitest run tests/unit/scan/scanners/commands.test.ts -x` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | AUD-03 | unit | `npx vitest run tests/unit/cli/scan.test.ts -x` | Extend | ⬜ pending |
| 18-02-02 | 02 | 1 | AUD-ALL | integration | `npx vitest run tests/integration/cli-scan.test.ts -x` | Extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/scan/scanners/conflict.test.ts` — covers AUD-01a conflict detection
- [ ] `tests/unit/scan/scanners/structure.test.ts` — covers AUD-01b structure audit
- [ ] `tests/unit/scan/scanners/hooks-redundancy.test.ts` — covers AUD-01c hooks redundancy
- [ ] `tests/unit/scan/scanners/commands.test.ts` — covers AUD-01d commands convention
- [ ] Update scanner registry test from 3 to 7
- [ ] Update `tests/integration/cli-scan.test.ts` with new scanner scenarios
