---
phase: 1
slug: foundation-storage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | ONB-01 | unit | `npx vitest run tests/unit/config.test.ts -t "defaults"` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | ONB-03 | unit | `npx vitest run tests/unit/config.test.ts -t "overrides"` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | CAP-06 | unit | `npx vitest run tests/unit/scrubber.test.ts` | ❌ W0 | ⬜ pending |
| 01-03-01 | 03 | 1 | CAP-05 | unit | `npx vitest run tests/unit/logger.test.ts -t "append"` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 1 | TRG-01 | unit | `npx vitest run tests/unit/counter.test.ts` | ❌ W0 | ⬜ pending |
| 01-04-02 | 04 | 2 | CAP-07 | integration | `npx vitest run tests/integration/concurrent-counter.test.ts` | ❌ W0 | ⬜ pending |
| 01-05-01 | 05 | 2 | Gray#1 | manual + smoke | Manual: verify stdout injection in Claude Code session | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — project setup with all dependencies
- [ ] `tsconfig.json` — TypeScript configuration
- [ ] `vitest.config.ts` — Vitest configuration for Node.js
- [ ] `tsup.config.ts` — build configuration
- [ ] `tests/unit/config.test.ts` — covers ONB-01, ONB-03
- [ ] `tests/unit/scrubber.test.ts` — covers CAP-06
- [ ] `tests/unit/logger.test.ts` — covers CAP-05
- [ ] `tests/unit/counter.test.ts` — covers TRG-01
- [ ] `tests/integration/concurrent-counter.test.ts` — covers CAP-07

*Wave 0 creates project scaffold + all test stubs (RED phase of TDD).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| UserPromptSubmit stdout injection | Gray Area #1 | Requires live Claude Code session | 1. Register a UserPromptSubmit hook that writes to stdout. 2. Submit a prompt. 3. Verify output appears in context. 4. Document result in RESEARCH.md. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
