# Roadmap: harness-evolve

## Milestones

- v1.0 Self-Iteration Engine -- Phases 1-8 (shipped 2026-04-02) | [Archive](milestones/v1.0-ROADMAP.md)
- v1.1 Stabilization & Production -- Phases 9-11 (shipped 2026-04-04) | [Archive](milestones/v1.1-ROADMAP.md)
- v2.0 Deep Scan & Auto-Generation -- Phases 12-16 (shipped 2026-04-04) | [Archive](milestones/v2.0-ROADMAP.md)
- v3.0 Reliability & Config Audit -- Phases 17-20 (shipped 2026-04-06) | [Archive](milestones/v3.0-ROADMAP.md)
- v4.0 Intelligent Scanner & Ecosystem Learning -- Phases 21-23 (shipped 2026-04-11) | [Archive](milestones/v4.0-ROADMAP.md)

## Phases

<details>
<summary>v1.0 Self-Iteration Engine (Phases 1-8) -- SHIPPED 2026-04-02</summary>

- [x] Phase 1: Foundation & Storage (3/3 plans) -- completed 2026-03-31
- [x] Phase 2: Collection Hooks (3/3 plans) -- completed 2026-03-31
- [x] Phase 3: Pre-Processing & Environment Discovery (3/3 plans) -- completed 2026-03-31
- [x] Phase 4: Analysis Engine & Routing (3/3 plans) -- completed 2026-03-31
- [x] Phase 5: Delivery & User Interaction (3/3 plans) -- completed 2026-04-01
- [x] Phase 6: Onboarding & Quality Polish (2/2 plans) -- completed 2026-04-01
- [x] Phase 7: Integration Wiring (3/3 plans) -- completed 2026-04-01
- [x] Phase 8: Fix Permission Constants Mismatch (1/1 plan) -- completed 2026-04-01

</details>

<details>
<summary>v1.1 Stabilization & Production (Phases 9-11) -- SHIPPED 2026-04-04</summary>

- [x] Phase 9: Tech Debt & Auto-Apply Expansion (3/3 plans) -- completed 2026-04-03
- [x] Phase 10: npm Package & CI/CD Pipeline (2/2 plans) -- completed 2026-04-03
- [x] Phase 11: CLI Commands & Install Experience (2/2 plans) -- completed 2026-04-04

</details>

<details>
<summary>v2.0 Deep Scan & Auto-Generation (Phases 12-16) -- SHIPPED 2026-04-04</summary>

- [x] Phase 12: Deep Scan Infrastructure (3/3 plans) -- completed 2026-04-04
- [x] Phase 13: Auto-Generators (2/2 plans) -- completed 2026-04-04
- [x] Phase 14: Auto-Apply Closure (1/1 plan) -- completed 2026-04-04
- [x] Phase 15: Slash Commands & Interactive Apply (2/2 plans) -- completed 2026-04-04
- [x] Phase 16: UX Polish (2/2 plans) -- completed 2026-04-04

</details>

<details>
<summary>v3.0 Reliability & Config Audit (Phases 17-20) -- SHIPPED 2026-04-06</summary>

- [x] Phase 17: Bug Fixes & Reliability (2/2 plans) -- completed 2026-04-04
- [x] Phase 18: Comprehensive Config Audit (2/2 plans) -- completed 2026-04-05
- [x] Phase 19: Workflow Documentation (2/2 plans) -- completed 2026-04-05
- [x] Phase 19.1: Developer Full Integration Testing (3/3 plans) -- completed 2026-04-05
- [x] Phase 20: Scanner UX & Coverage Polish (2/2 plans) -- completed 2026-04-06

</details>

<details>
<summary>v4.0 Intelligent Scanner & Ecosystem Learning (Phases 21-23) -- SHIPPED 2026-04-11</summary>

- [x] Phase 21: Foundation & Context Infrastructure (3/3 plans) -- completed 2026-04-07
- [x] Phase 22: Ecosystem Learning & Scanner Guidance (2/2 plans) -- completed 2026-04-08
- [x] Phase 23: Model-Driven Validation & Legacy Cleanup (3/3 plans) -- completed 2026-04-06

</details>

### v5.0 Scan Pipeline Reliability & UX (In Progress)

**Milestone Goal:** Fix the model-driven scan/apply pipeline so templates are executed as instructions (not treated as documentation), clean up legacy CLI confusion, and add self-healing slash command installation.

- [ ] **Phase 24: Context Infrastructure & Legacy Cleanup** - Fix scan-context scope labeling and remove deprecated scan CLI
- [x] **Phase 25: Template Execution Pipeline** - Rewrite scan/apply templates so the model reliably executes the structured pipeline (completed 2026-04-11)
- [ ] **Phase 26: Self-Healing Installation** - Auto-detect and reinstall missing slash commands

## Phase Details

### Phase 24: Context Infrastructure & Legacy Cleanup
**Goal**: scan-context output clearly separates project vs user scope, and deprecated CLI paths no longer confuse users or the model
**Depends on**: Nothing (first phase of v5.0)
**Requirements**: LEGACY-01, LEGACY-02
**Success Criteria** (what must be TRUE):
  1. Running `harness-evolve scan-context` outputs JSON where each config source is labeled with its scope (project or user)
  2. Running `harness-evolve scan` either errors with a clear message pointing to `/evolve:scan`, or is fully removed as a subcommand
  3. No CLI subcommand produces false-positive scan findings on its own (raw context only, analysis left to model)
**Plans:** 2 plans

Plans:
- [x] 24-01-PLAN.md -- Add scope labeling to scan-context output (commands scope, rules scope, scope_summary)
- [ ] 24-02-PLAN.md -- Remove deprecated scan CLI (hard error with redirect message)

### Phase 25: Template Execution Pipeline
**Goal**: The model reliably executes scan and apply templates as step-by-step instructions, producing consistent structured output
**Depends on**: Phase 24 (clean scan-context output is prerequisite for template rewrites)
**Requirements**: TMPL-01, TMPL-02, TMPL-03
**Success Criteria** (what must be TRUE):
  1. When a user invokes `/evolve:scan`, the model executes the 3-step pipeline (scan-context, analyze, store-findings) without free-styling or running deprecated commands
  2. When a user invokes `/evolve:apply`, the model presents each pending recommendation with 4 numbered options and processes them one-by-one
  3. A first-time scan (no prior analysis history) only analyzes configuration files -- no historical prompt pattern suggestions appear in the output
  4. A subsequent scan (with prior history) includes both configuration analysis and historical pattern insights
**Plans:** 2/2 plans complete

Plans:
- [x] 25-01-PLAN.md -- Rewrite scan template to v5 imperative pipeline with first-scan detection
- [x] 25-02-PLAN.md -- Rewrite apply template to v5 with strict one-at-a-time enforcement

### Phase 26: Self-Healing Installation
**Goal**: Users never get stuck with broken slash commands -- the system detects and repairs missing installation automatically
**Depends on**: Phase 25 (templates must be finalized before auto-reinstall can install correct versions)
**Requirements**: HEAL-01
**Success Criteria** (what must be TRUE):
  1. When `~/.claude/commands/evolve/` directory is missing or incomplete, the system detects this and either auto-reinstalls or prompts the user to run `harness-evolve init`
  2. Detection happens at a natural trigger point (SessionStart hook or `/evolve` skill invocation) without adding user-visible latency to normal operations
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-8 | v1.0 | 21/21 | Complete | 2026-04-02 |
| 9-11 | v1.1 | 7/7 | Complete | 2026-04-04 |
| 12-16 | v2.0 | 10/10 | Complete | 2026-04-04 |
| 17-20 | v3.0 | 11/11 | Complete | 2026-04-06 |
| 21-23 | v4.0 | 8/8 | Complete | 2026-04-11 |
| 24. Context & Legacy | v5.0 | 1/2 | Executing | - |
| 25. Template Pipeline | v5.0 | 2/2 | Complete   | 2026-04-11 |
| 26. Self-Healing | v5.0 | 0/TBD | Not started | - |
