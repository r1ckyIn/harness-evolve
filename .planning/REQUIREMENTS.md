# Requirements — harness-evolve v1.1

## Core Value

Make Claude Code harnesses self-improving without manual analysis — now installable by anyone with one command.

---

## v1.1 Requirements

### Tech Debt

- [x] **TDT-01**: Fix inferPatternType to return correct pattern_type strings matching all 8 classifiers' actual values, using a shared PatternType enum
- [x] **TDT-02**: Fix flaky concurrent-counter.test.ts to pass deterministically on CI (2-vCPU runners with higher lock contention)
- [x] **TDT-03**: Expand auto-apply beyond permissions-only: add strategy pattern applier registry with RULE create-only target for HIGH-confidence recommendations

### npm Package

- [x] **NPM-01**: Package.json has complete metadata (description, keywords, license, repository, homepage, author, engines) for npm registry listing
- [x] **NPM-02**: Package.json `files` field restricts published content to dist/, README.md, LICENSE, package.json only (no tests, no .planning/)
- [x] **NPM-03**: Package.json `exports` map correctly exposes ESM entry points for programmatic consumers
- [x] **NPM-04**: Package.json `bin` field registers `harness-evolve` CLI command pointing to compiled CLI entry

### CLI Commands

- [x] **CLI-01**: `harness-evolve init` detects settings.json location, displays planned hook registrations, and applies after user confirmation (or `--yes` flag)
- [x] **CLI-02**: `harness-evolve init` resolves hook command paths dynamically based on actual install location (works for both global install and npx)
- [ ] **CLI-03**: `harness-evolve status` shows interaction count, last analysis timestamp, pending recommendations count, and hook registration status
- [ ] **CLI-04**: `harness-evolve uninstall` removes hook entries from settings.json and optionally deletes ~/.harness-evolve/ data directory
- [x] **CLI-05**: `npx harness-evolve init` works as zero-install setup (download, run init, register hooks, exit)

### CI/CD

- [x] **CIC-01**: GitHub Actions CI workflow runs build + test + typecheck on every push and PR to main
- [x] **CIC-02**: Automated npm publish triggered by version tag push (v*) using npm Trusted Publishing (OIDC)
- [x] **CIC-03**: README.md displays npm version badge, CI status badge, and license badge (shields.io flat-square)

---

## Future Requirements (v2.0)

- Multi-language support for recommendation text
- Web-based visualization dashboard
- Community-shared routing heuristics marketplace
- Plugin-format distribution (.claude-plugin/)
- New classifiers (semantic similarity, prompt clustering)
- CLAUDE.md and HOOK auto-apply targets
- Integration test suite for hook reliability across Claude Code versions

---

## Out of Scope

- postinstall hooks in npm package — security concern, require explicit `harness-evolve init`
- CJS + ESM dual format build — ESM-only is correct for Node 22+ and Claude Code
- Monorepo / workspace structure — single package at 3,765 LOC
- Docker-based CI — no external dependencies, setup-node is sufficient
- New classifiers or analysis features — stabilization first
- Homebrew tap distribution — npm covers 100% of target audience
- Web-based marketplace listing — GitHub README sufficient for npm discovery

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| TDT-01 | Phase 9 | Complete |
| TDT-02 | Phase 9 | Complete |
| TDT-03 | Phase 9 | Complete |
| NPM-01 | Phase 10 | Complete |
| NPM-02 | Phase 10 | Complete |
| NPM-03 | Phase 10 | Complete |
| NPM-04 | Phase 10 | Complete |
| CLI-01 | Phase 11 | Complete |
| CLI-02 | Phase 11 | Complete |
| CLI-03 | Phase 11 | Pending |
| CLI-04 | Phase 11 | Pending |
| CLI-05 | Phase 11 | Complete |
| CIC-01 | Phase 10 | Complete |
| CIC-02 | Phase 10 | Complete |
| CIC-03 | Phase 10 | Complete |

---
*Last updated: 2026-04-03 — Phase 10 complete*
