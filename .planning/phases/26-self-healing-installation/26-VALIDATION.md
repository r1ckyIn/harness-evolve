---
phase: 26
slug: self-healing-installation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/unit/hooks/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/hooks/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | HEAL-01 | unit | `npx vitest run tests/unit/hooks/` | ❌ W0 | ⬜ pending |
| 26-01-02 | 01 | 1 | HEAL-01 | unit | `npx vitest run tests/unit/hooks/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/hooks/session-start-heal.test.ts` — test for self-healing detection and repair logic
- [ ] Test fixtures for missing/incomplete slash command scenarios

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SessionStart hook detects missing commands in live Claude Code session | HEAL-01 | Requires live Claude Code runtime with hooks | Delete `~/.claude/commands/evolve/`, start new Claude Code session, verify repair message or auto-reinstall |
| No user-visible latency on healthy installation | HEAL-01 | Requires timing measurement in real session | Run `/clear` in Claude Code with healthy install, verify no noticeable delay |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
