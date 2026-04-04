---
phase: 16
slug: ux-polish
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-04
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | UX-01 | unit | `npx vitest run tests/unit/delivery/notification.test.ts -t "buildNotification" -x` | Exists (update) | ⬜ pending |
| 16-01-02 | 01 | 1 | UX-01 | unit | `npx vitest run tests/unit/delivery/notification.test.ts -x` | Exists (update) | ⬜ pending |
| 16-02-01 | 02 | 1 | UX-02 | unit | `npx vitest run tests/unit/cli/init.test.ts -x` | Exists (update) | ⬜ pending |
| 16-03-01 | 03 | 1 | UX-03 | unit | `npx vitest run tests/unit/cli/apply.test.ts -t "pending" -x` | Exists (update) | ⬜ pending |
| 16-03-02 | 03 | 1 | UX-03 | unit | `npx vitest run tests/unit/cli/scan.test.ts -x` | Exists (update) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files or framework installs needed — only assertion updates in existing test files.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
