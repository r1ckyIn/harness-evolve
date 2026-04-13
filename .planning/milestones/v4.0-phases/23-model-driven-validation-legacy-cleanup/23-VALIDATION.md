---
phase: 23
slug: model-driven-validation-legacy-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | MODEL-01 | manual | Live Claude Code session with semantic conflict test config | N/A | ⬜ pending |
| 23-01-02 | 01 | 1 | MODEL-02 | manual | Live Claude Code session with cross-file inconsistency test config | N/A | ⬜ pending |
| 23-01-03 | 01 | 1 | MODEL-03 | manual | Live Claude Code session with natural-language hookable operations test config | N/A | ⬜ pending |
| 23-01-04 | 01 | 1 | MODEL-04 | manual | Add guidance .md section, re-run /evolve:scan, verify inclusion | N/A | ⬜ pending |
| 23-02-01 | 02 | 2 | SCAN-03 | unit | `npx vitest run` | ✅ | ⬜ pending |
| 23-02-02 | 02 | 2 | SCAN-03 | integration | `npx vitest run` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or fixture setup needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Semantic conflict detection | MODEL-01 | Requires live LLM inference in Claude Code session | Create test config with "use ESM" + "use CommonJS" contradiction, run /evolve:scan, verify finding detected |
| Cross-file inconsistency detection | MODEL-02 | Requires live LLM reading multiple config files | Create rules/ file contradicting settings.json, run /evolve:scan, verify cross-file finding |
| Natural-language hookable operation detection | MODEL-03 | Requires live LLM NLP on config prose | Add "always run tests before committing" to CLAUDE.md, run /evolve:scan, verify hook suggestion |
| Guidance extensibility | MODEL-04 | Requires live LLM consuming updated guidance template | Add new analysis section to guidance .md, run /evolve:scan, verify new area appears in output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
