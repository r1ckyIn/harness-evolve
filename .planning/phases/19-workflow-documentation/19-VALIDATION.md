---
phase: 19
slug: workflow-documentation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
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
| 19-01-01 | 01 | 1 | WFL-01 | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "workflow"` | Needs update (W0) | pending |
| 19-01-02 | 01 | 1 | WFL-01 | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "workflow"` | Needs update (W0) | pending |
| 19-01-03 | 01 | 1 | WFL-02 | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "self-contained"` | Needs creation (W0) | pending |
| 19-01-04 | 01 | 1 | WFL-02 | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "version"` | Needs creation (W0) | pending |

*Status: pending · green · red · flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/commands/templates.test.ts` — extend with tests for: workflow section completeness (error handling, output format, edge cases, prerequisites), self-containment verification (no CLAUDE.md dependency), template version tracking

*Existing test file covers the right scope, just needs more assertions.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slash command produces consistent Claude behavior | WFL-01 | Requires invoking Claude Code with the command | Invoke `/evolve:scan` in a test project, verify Claude follows workflow steps |
| Context injection works without CLAUDE.md | WFL-02 | Requires Claude Code runtime | Invoke `/evolve:scan` in a project without harness-evolve CLAUDE.md entries, verify behavior is identical |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
