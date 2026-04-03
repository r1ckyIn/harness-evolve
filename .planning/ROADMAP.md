# Roadmap: harness-evolve

## Milestones

- **v1.0 Self-Iteration Engine** — Phases 1-8 (shipped 2026-04-02) | [Archive](milestones/v1.0-ROADMAP.md)
- **v1.1 Stabilization & Production** — Phases 9-11 (in progress)

## Phases

<details>
<summary>v1.0 Self-Iteration Engine (Phases 1-8) — SHIPPED 2026-04-02</summary>

- [x] Phase 1: Foundation & Storage (3/3 plans) — completed 2026-03-31
- [x] Phase 2: Collection Hooks (3/3 plans) — completed 2026-03-31
- [x] Phase 3: Pre-Processing & Environment Discovery (3/3 plans) — completed 2026-03-31
- [x] Phase 4: Analysis Engine & Routing (3/3 plans) — completed 2026-03-31
- [x] Phase 5: Delivery & User Interaction (3/3 plans) — completed 2026-04-01
- [x] Phase 6: Onboarding & Quality Polish (2/2 plans) — completed 2026-04-01
- [x] Phase 7: Integration Wiring (3/3 plans) — completed 2026-04-01
- [x] Phase 8: Fix Permission Constants Mismatch (1/1 plan) — completed 2026-04-01

</details>

### v1.1 Stabilization & Production (In Progress)

**Milestone Goal:** Fix tech debt from v1.0 audit, make the project production-ready for npm publish with CI/CD, and provide a one-command install experience.

- [ ] **Phase 9: Tech Debt & Auto-Apply Expansion** - Fix string mismatches, flaky test, and expand auto-apply with strategy pattern
- [ ] **Phase 10: npm Package & CI/CD Pipeline** - Complete package.json metadata, CI quality gate, and automated publish
- [ ] **Phase 11: CLI Commands & Install Experience** - Commander.js CLI with init/status/uninstall commands and npx support

## Phase Details

### Phase 9: Tech Debt & Auto-Apply Expansion
**Goal**: The self-iteration feedback loop works for all 8 classifiers, tests pass deterministically, and auto-apply supports rule creation beyond permissions
**Depends on**: Phase 8 (v1.0 codebase)
**Requirements**: TDT-01, TDT-02, TDT-03
**Success Criteria** (what must be TRUE):
  1. Running the analysis pipeline with any of the 8 classifier pattern types produces correct outcome tracking entries (no "unknown" or mismatched types)
  2. The concurrent-counter integration test passes 10/10 consecutive runs on a 2-vCPU environment without flaking
  3. A HIGH-confidence recommendation with target RULE triggers auto-creation of a `.claude/rules/*.md` file (not just SETTINGS modifications)
  4. All existing tests (336+) continue to pass after changes
**Plans**: TBD

### Phase 10: npm Package & CI/CD Pipeline
**Goal**: The project is publishable to npm with correct metadata, gated by automated CI, and releases are triggered by version tags
**Depends on**: Phase 9 (deterministic tests required for CI reliability)
**Requirements**: NPM-01, NPM-02, NPM-03, NPM-04, CIC-01, CIC-02, CIC-03
**Success Criteria** (what must be TRUE):
  1. `npm pack --dry-run` shows only dist/, README.md, LICENSE, and package.json in the tarball (no tests, no .planning/, no source)
  2. `npm publish --dry-run` succeeds with all required metadata fields present (description, keywords, license, repository, homepage, author, engines)
  3. The `exports` field resolves correctly for ESM consumers (verified by publint and @arethetypeswrong/cli)
  4. Pushing a `v*` tag to main triggers GitHub Actions to build, test, typecheck, and publish to npm via OIDC trusted publishing
  5. README.md displays npm version badge, CI status badge, and license badge
**Plans**: TBD

### Phase 11: CLI Commands & Install Experience
**Goal**: Users can install and set up harness-evolve with a single command, manage it through CLI subcommands, and remove it cleanly
**Depends on**: Phase 10 (bin field, exports map, and CI validation required)
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05
**Success Criteria** (what must be TRUE):
  1. `npx harness-evolve init` downloads the package, displays planned hook registrations, and writes them to settings.json after user confirmation (or with `--yes`)
  2. Hook command paths in settings.json resolve correctly regardless of install method (global `npm i -g`, local `npx`, git clone)
  3. `harness-evolve status` displays interaction count, last analysis timestamp, pending recommendations count, and hook registration status
  4. `harness-evolve uninstall` removes all hook entries from settings.json and optionally deletes the ~/.harness-evolve/ data directory
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Storage | v1.0 | 3/3 | Complete | 2026-03-31 |
| 2. Collection Hooks | v1.0 | 3/3 | Complete | 2026-03-31 |
| 3. Pre-Processing & Environment Discovery | v1.0 | 3/3 | Complete | 2026-03-31 |
| 4. Analysis Engine & Routing | v1.0 | 3/3 | Complete | 2026-03-31 |
| 5. Delivery & User Interaction | v1.0 | 3/3 | Complete | 2026-04-01 |
| 6. Onboarding & Quality Polish | v1.0 | 2/2 | Complete | 2026-04-01 |
| 7. Integration Wiring | v1.0 | 3/3 | Complete | 2026-04-01 |
| 8. Fix Permission Constants Mismatch | v1.0 | 1/1 | Complete | 2026-04-01 |
| 9. Tech Debt & Auto-Apply Expansion | v1.1 | 0/? | Not started | - |
| 10. npm Package & CI/CD Pipeline | v1.1 | 0/? | Not started | - |
| 11. CLI Commands & Install Experience | v1.1 | 0/? | Not started | - |
