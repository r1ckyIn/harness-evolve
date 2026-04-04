---
phase: 15
slug: slash-commands-interactive-apply
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | CMD-01 | unit | `npx vitest run tests/unit/cli/init.test.ts -t "slash commands" -x` | Extend existing | ⬜ pending |
| 15-01-02 | 01 | 1 | CMD-03 | unit | `npx vitest run tests/unit/cli/uninstall.test.ts -t "slash commands" -x` | Extend existing | ⬜ pending |
| 15-02-01 | 02 | 1 | SCN-04 | unit | `npx vitest run tests/unit/cli/scan.test.ts -x` | Wave 0 | ⬜ pending |
| 15-02-02 | 02 | 1 | CMD-02 | unit | `npx vitest run tests/unit/cli/apply.test.ts -x` | Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/cli/scan.test.ts` — stubs for SCN-04 (CLI scan subcommand)
- [ ] `tests/unit/cli/apply.test.ts` — stubs for CMD-02 (pending, apply-one, dismiss commands)
- [ ] `tests/unit/commands/templates.test.ts` — stubs for CMD-01 (slash command template content validation)
- [ ] Extend `tests/unit/cli/init.test.ts` — covers CMD-01 (install slash commands during init)
- [ ] Extend `tests/unit/cli/uninstall.test.ts` — covers CMD-03 (remove slash commands during uninstall)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/evolve:scan` command works in Claude Code | SCN-04 | Requires Claude Code runtime | Install to test project, invoke `/evolve:scan`, verify output |
| `/evolve:apply` interactive flow | CMD-02 | Requires Claude Code + user interaction | Install, invoke `/evolve:apply`, test apply/skip/ignore actions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
