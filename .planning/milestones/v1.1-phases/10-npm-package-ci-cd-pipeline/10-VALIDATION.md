---
phase: 10
slug: npm-package-ci-cd-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-03
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run && npm run typecheck` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run && npm run typecheck && npm run build && npx publint --strict`
- **Before `/gsd:verify-work`:** Full suite must be green + `npm pack --dry-run` correct + `npx attw --pack . --profile esm-only` passes
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | NPM-01 | unit | `npx vitest run tests/unit/package-metadata.test.ts -x` | No -- Wave 0 | ⬜ pending |
| 10-01-02 | 01 | 1 | NPM-02 | integration | `npm pack --dry-run 2>&1 \| grep "npm notice"` | No -- script | ⬜ pending |
| 10-01-03 | 01 | 1 | NPM-03 | integration | `npx publint --strict && npx attw --pack . --profile esm-only` | No -- Wave 0 | ⬜ pending |
| 10-01-04 | 01 | 1 | NPM-04 | integration | `node dist/cli.js` | No -- Wave 0 | ⬜ pending |
| 10-02-01 | 02 | 2 | CIC-01 | manual-only | Push to branch, check Actions tab | N/A | ⬜ pending |
| 10-02-02 | 02 | 2 | CIC-02 | manual-only | Create v* tag, verify publish workflow | N/A | ⬜ pending |
| 10-02-03 | 02 | 2 | CIC-03 | unit | `npx vitest run tests/unit/readme-badges.test.ts -x` | No -- Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/package-metadata.test.ts` — validates package.json has all NPM-01 required fields
- [ ] `tests/unit/readme-badges.test.ts` — validates README.md contains required badge patterns
- [ ] Install dev dependencies: `npm install -D publint @arethetypeswrong/cli`
- [ ] Add npm scripts: `check:publint`, `check:attw`, `check:package`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CI workflow runs on push/PR | CIC-01 | Requires actual GitHub Actions run | Push to branch, verify workflow runs in Actions tab |
| v* tag triggers publish | CIC-02 | Requires actual tag push to GitHub | Create and push `v1.1.0-rc.1` tag, verify publish workflow triggers |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
