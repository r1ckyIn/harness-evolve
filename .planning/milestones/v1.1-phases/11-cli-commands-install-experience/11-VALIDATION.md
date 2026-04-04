---
phase: 11
slug: cli-commands-install-experience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/unit/cli` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/cli`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | CLI-01, CLI-02 | unit | `npx vitest run tests/unit/cli/init.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | CLI-03 | unit | `npx vitest run tests/unit/cli/status.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | CLI-04 | unit | `npx vitest run tests/unit/cli/uninstall.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 2 | CLI-05 | integration | `npx vitest run tests/integration/cli-init.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/cli/init.test.ts` — stubs for CLI-01, CLI-02
- [ ] `tests/unit/cli/status.test.ts` — stubs for CLI-03
- [ ] `tests/unit/cli/uninstall.test.ts` — stubs for CLI-04
- [ ] `tests/integration/cli-init.test.ts` — stubs for CLI-05
- [ ] `npm install commander @commander-js/extra-typings` — production deps

*Existing Vitest infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| npx downloads and runs init | CLI-05 | Requires actual npm registry interaction | Run `npx harness-evolve init` in a clean directory |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
