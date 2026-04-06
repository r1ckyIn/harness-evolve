---
phase: 20
slug: scanner-ux-coverage-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/cli/scan.test.ts tests/unit/commands/templates.test.ts -x` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/cli/scan.test.ts tests/unit/commands/templates.test.ts -x`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | UX-01 | unit | `npx vitest run tests/unit/commands/templates.test.ts -x` | Exists (needs assertion) | ⬜ pending |
| 20-01-02 | 01 | 1 | UX-02 | unit | `npx vitest run tests/unit/commands/templates.test.ts -x` | Exists (needs assertion) | ⬜ pending |
| 20-01-03 | 01 | 1 | UX-03 | unit | `npx vitest run tests/unit/cli/scan.test.ts -x` | Exists (needs assertion) | ⬜ pending |
| 20-02-01 | 02 | 2 | UX-04 | integration | `npx vitest run tests/integration/dirty-config-e2e.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/integration/dirty-config-e2e.test.ts` -- E2E dirty config test covering all 7 scanners (UX-04)
- No framework install needed -- Vitest already configured and passing (708 tests)

*Existing infrastructure covers UX-01, UX-02, UX-03 requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/evolve:scan` renders in English in a Chinese session | UX-01 | Requires live Claude Code session with Chinese language | Run `/evolve:scan` in Chinese Claude Code session, verify output headings are English |
| `/evolve:apply` shows numbered options and accepts number input | UX-02 | Requires live Claude Code interactive session | Run `/evolve:apply`, verify numbered list appears, respond with "1" |

---

*Phase: 20-scanner-ux-coverage-polish*
*Validation strategy created: 2026-04-06*
