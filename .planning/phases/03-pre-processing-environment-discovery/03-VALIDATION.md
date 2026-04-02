---
phase: 3
slug: pre-processing-environment-discovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | vitest.config.ts (exists) |
| **Quick run command** | `npx vitest run tests/unit/analysis/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/analysis/ tests/integration/pre-processor-pipeline.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | ANL-01 | unit | `npx vitest run tests/unit/analysis/jsonl-reader.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | ANL-01, ANL-08 | unit | `npx vitest run tests/unit/analysis/pre-processor.test.ts -t "frequency" -x` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | ANL-01 | unit | `npx vitest run tests/unit/analysis/pre-processor.test.ts -t "summary size" -x` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | ANL-08 | unit | `npx vitest run tests/unit/analysis/pre-processor.test.ts -t "cross-session" -x` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | RTG-08 | unit | `npx vitest run tests/unit/analysis/environment-scanner.test.ts -t "tool types" -x` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | ONB-04 | unit | `npx vitest run tests/unit/analysis/environment-scanner.test.ts -t "version" -x` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | E2E | integration | `npx vitest run tests/integration/pre-processor-pipeline.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/analysis/jsonl-reader.test.ts` — stubs for JSONL streaming, date filtering, malformed line handling
- [ ] `tests/unit/analysis/pre-processor.test.ts` — stubs for ANL-01, ANL-08 (frequency counts, cross-session, summary size)
- [ ] `tests/unit/analysis/environment-scanner.test.ts` — stubs for RTG-08, ONB-04 (tool discovery, version detection)
- [ ] `tests/integration/pre-processor-pipeline.test.ts` — stubs for end-to-end pipeline with real file I/O
- [ ] `src/analysis/schemas.ts` — Zod schemas for summary.json and environment-snapshot.json

*Existing infrastructure (Vitest, vitest.config.ts) covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `claude --version` output | ONB-04 | Requires actual Claude Code CLI | Run `claude --version` and verify scanner parses it correctly |
| Real `~/.claude/` discovery | RTG-08 | Requires actual user environment | Run scanner on real machine, verify snapshot matches installed tools |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
