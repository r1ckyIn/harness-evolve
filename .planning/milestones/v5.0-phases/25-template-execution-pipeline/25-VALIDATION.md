---
phase: 25
slug: template-execution-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts |
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
| 25-01-01 | 01 | 1 | TMPL-01 | unit | `npx vitest run tests/unit/commands/templates.test.ts` | ✅ | ⬜ pending |
| 25-01-02 | 01 | 1 | TMPL-03 | unit | `npx vitest run tests/unit/commands/templates.test.ts` | ✅ | ⬜ pending |
| 25-02-01 | 02 | 1 | TMPL-02 | unit | `npx vitest run tests/unit/commands/templates.test.ts` | ✅ | ⬜ pending |
| 25-03-01 | 03 | 2 | TMPL-01,02,03 | integration | `npx vitest run tests/integration/` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Vitest 4.x already configured with template tests in `tests/unit/commands/templates.test.ts`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Model executes 3-step scan pipeline | TMPL-01 | Model behavior — requires live Claude Code session | Run `/evolve:scan` in a test project, verify scan-context → analyze → store-findings sequence |
| Model presents 4 numbered options in apply | TMPL-02 | Model behavior — requires live Claude Code session | Run `/evolve:apply` after a scan, verify card format + options |
| First scan excludes historical patterns | TMPL-03 | Model behavior — requires fresh install with no history | Run `/evolve:scan` with empty `~/.harness-evolve/`, verify no prompt pattern suggestions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
