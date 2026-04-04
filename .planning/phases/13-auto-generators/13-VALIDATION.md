---
phase: 13
slug: auto-generators
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-04
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/generators/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/generators/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | GEN-01 | unit | `npx vitest run tests/unit/generators/skill-generator.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-01-02 | 01 | 1 | GEN-01 | unit | `npx vitest run tests/unit/generators/skill-generator.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-01-03 | 01 | 1 | GEN-02 | unit | `npx vitest run tests/unit/generators/hook-generator.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-01-04 | 01 | 1 | GEN-02 | unit | `npx vitest run tests/unit/generators/hook-generator.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-01-05 | 01 | 1 | GEN-03 | unit | `npx vitest run tests/unit/generators/claude-md-generator.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-01-06 | 01 | 1 | GEN-03 | unit | `npx vitest run tests/unit/generators/claude-md-generator.test.ts -x` | ❌ W0 | ⬜ pending |
| 13-01-07 | 01 | 1 | ALL | unit | `npx vitest run tests/unit/generators/schemas.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/generators/skill-generator.test.ts` — stubs for GEN-01
- [ ] `tests/unit/generators/hook-generator.test.ts` — stubs for GEN-02
- [ ] `tests/unit/generators/claude-md-generator.test.ts` — stubs for GEN-03
- [ ] `tests/unit/generators/schemas.test.ts` — GeneratedArtifact schema validation

*Existing test infrastructure (Vitest) covers framework needs. Only test files need creation.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
