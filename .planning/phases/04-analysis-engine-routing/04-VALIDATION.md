---
phase: 4
slug: analysis-engine-routing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npx vitest run tests/unit/analysis/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/analysis/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | ANL-02, RTG-01 | unit | `npx vitest run tests/unit/analysis/analyzer.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | ANL-03, RTG-02 | unit | `npx vitest run tests/unit/analysis/classifiers/repeated-prompts.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | ANL-04, RTG-03 | unit | `npx vitest run tests/unit/analysis/classifiers/long-prompts.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | ANL-05, RTG-07 | unit | `npx vitest run tests/unit/analysis/classifiers/permission-patterns.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | ANL-06, RTG-04 | unit | `npx vitest run tests/unit/analysis/classifiers/code-corrections.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | ANL-07, RTG-06 | unit | `npx vitest run tests/unit/analysis/classifiers/personal-info.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 2 | ANL-09 | unit | `npx vitest run tests/unit/analysis/classifiers/config-drift.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-02-04 | 02 | 2 | RTG-09, RTG-10 | unit | `npx vitest run tests/unit/analysis/classifiers/ecosystem-adapter.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | TRG-02 | unit | `npx vitest run tests/unit/analysis/trigger.test.ts -x` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | SC-01..SC-05 | integration | `npx vitest run tests/integration/analysis-pipeline.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/schemas/recommendation.ts` — Zod schemas for Recommendation, AnalysisResult, RoutingTarget, Confidence, AnalysisConfig
- [ ] `src/analysis/analyzer.ts` — Main analyze() function stub
- [ ] `src/analysis/classifiers/index.ts` — Classifier registry stub
- [ ] `src/analysis/classifiers/repeated-prompts.ts` — ANL-03 classifier stub
- [ ] `src/analysis/classifiers/long-prompts.ts` — ANL-04 classifier stub
- [ ] `src/analysis/classifiers/permission-patterns.ts` — ANL-05 classifier stub
- [ ] `src/analysis/classifiers/code-corrections.ts` — ANL-06 classifier stub
- [ ] `src/analysis/classifiers/personal-info.ts` — ANL-07 classifier stub
- [ ] `src/analysis/classifiers/config-drift.ts` — ANL-09 classifier stub
- [ ] `src/analysis/classifiers/ecosystem-adapter.ts` — RTG-09/RTG-10 classifier stub
- [ ] `src/analysis/trigger.ts` — Threshold trigger stub
- [ ] `tests/unit/analysis/analyzer.test.ts` — Analyzer test stubs
- [ ] `tests/unit/analysis/classifiers/*.test.ts` — Per-classifier test stubs
- [ ] `tests/unit/analysis/trigger.test.ts` — Trigger test stubs
- [ ] `tests/integration/analysis-pipeline.test.ts` — Pipeline test stubs

*Existing infrastructure covers test framework, build config, and Zod schemas.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
