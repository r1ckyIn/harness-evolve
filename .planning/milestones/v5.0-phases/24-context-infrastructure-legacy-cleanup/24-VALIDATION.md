---
phase: 24
slug: context-infrastructure-legacy-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/scan/ tests/unit/cli/scan` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/scan/ tests/unit/cli/scan`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | LEGACY-02 | unit | `npx vitest run tests/unit/scan/context-builder.test.ts` | Needs update | pending |
| 24-01-02 | 01 | 1 | LEGACY-02 | unit | `npx vitest run tests/unit/scan/schemas.test.ts` | Needs update | pending |
| 24-01-03 | 01 | 1 | LEGACY-01 | unit | `npx vitest run tests/unit/cli/scan.test.ts` | Needs update | pending |
| 24-01-04 | 01 | 1 | LEGACY-01, LEGACY-02 | integration | `npx vitest run tests/integration/cli-scan.test.ts` | Needs update | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] Update `tests/unit/cli/scan.test.ts` — test new error behavior for removed `scan` CLI
- [ ] Add scope tests to `tests/unit/scan/context-builder.test.ts` — global commands, scope_summary
- [ ] Update test mocks using `commands: []` to include `scope` field
- [ ] Update `tests/integration/scan-pipeline-v4.test.ts` for schema changes

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| None | — | — | All behaviors have automated verification |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
