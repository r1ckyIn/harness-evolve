# Roadmap: harness-evolve

## Milestones

- v1.0 Self-Iteration Engine -- Phases 1-8 (shipped 2026-04-02) | [Archive](milestones/v1.0-ROADMAP.md)
- v1.1 Stabilization & Production -- Phases 9-11 (shipped 2026-04-04) | [Archive](milestones/v1.1-ROADMAP.md)
- v2.0 Deep Scan & Auto-Generation -- Phases 12-16 (shipped 2026-04-04) | [Archive](milestones/v2.0-ROADMAP.md)
- v3.0 Reliability & Config Audit -- Phases 17-20 (shipped 2026-04-06) | [Archive](milestones/v3.0-ROADMAP.md)
- v4.0 Intelligent Scanner & Ecosystem Learning -- Phases 21-23 (in progress)

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

### v4.0 Intelligent Scanner & Ecosystem Learning (In Progress)

**Milestone Goal:** Upgrade the scanner from code-based regex detection to model-driven intelligent analysis. Fix the hooks parsing bug, add CLI bridge commands for model-code interaction, research ecosystem patterns, create comprehensive guidance documents that turn the model itself into the scanner, validate model-driven capabilities, and remove legacy scanner code.

- [x] **Phase 21: Foundation & Context Infrastructure** - Fix hooks parsing bug, add scan-context/store-findings CLI commands, and streamline init experience (completed 2026-04-07)
- [ ] **Phase 22: Ecosystem Learning & Scanner Guidance** - Research GSD/open-source patterns and rewrite /evolve:scan template with model-driven guidance docs
- [x] **Phase 23: Model-Driven Validation & Legacy Cleanup** - Validate model capabilities against real configs and remove old TypeScript scanners (completed 2026-04-06)

## Phase Details

### Phase 17: Bug Fixes & Reliability
**Goal**: All v2.0 dogfooding bugs are resolved -- slash commands work globally, scanner reports are accurate, apply-one respects user intent, and analysis notifications flow automatically
**Depends on**: Phase 16 (v2.0 shipped)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04
**Success Criteria** (what must be TRUE):
  1. User launches Claude Code in any directory and can invoke `/evolve:scan` and `/evolve:apply` without running init in that project first (commands live in `~/.claude/commands/evolve/`)
  2. Running a scan on a project that uses npm scoped packages (`@scope/package`) or URLs with `@user/path` produces zero false-positive stale reference warnings for those patterns
  3. User can `apply-one <id>` on a MEDIUM or LOW confidence recommendation and it applies successfully without being rejected by a confidence gate
  4. After the Stop hook completes background analysis with new recommendations, the next user prompt automatically shows a notification line without the user having to manually run `/evolve`
**Plans:** 2/2 plans complete
Plans:
- [x] 17-01-PLAN.md -- Fix global slash command path (FIX-01) and scanner false positives (FIX-02)
- [x] 17-02-PLAN.md -- Fix apply-one confidence gate (FIX-03) and stop hook notification (FIX-04)

### Phase 18: Comprehensive Config Audit
**Goal**: The scanner performs a full-spectrum audit of Claude Code configuration quality, giving users actionable insights beyond stale references
**Depends on**: Phase 17 (FIX-02 fixes scanner false positives, ensuring audit results are trustworthy)
**Requirements**: AUD-01, AUD-02, AUD-03
**Success Criteria** (what must be TRUE):
  1. Running `harness-evolve scan` analyzes CLAUDE.md for rule conflicts, audits `.claude/rules/` directory structure, checks `settings.json` hooks for redundancy, and inspects `.claude/commands/` for convention violations
  2. Each audit finding includes a concrete optimization suggestion with expected effect (e.g., "Move this rule to a hook for 100% enforcement -- currently probabilistic")
  3. Audit output clearly separates "problems" (things that are broken or conflicting) from "optimization suggestions" (things that work but could be better), with distinct severity labels
  4. User reviews audit findings and confirms before any changes are applied -- no silent modifications
**Plans:** 2/2 plans complete
Plans:
- [x] 18-01-PLAN.md -- Schema extension (severity field + audit pattern types) + conflict scanner + structure scanner
- [x] 18-02-PLAN.md -- Hooks redundancy scanner + commands scanner + registry wiring + CLI output grouping

### Phase 19: Workflow Documentation
**Goal**: Each slash command has a complete workflow .md that defines Claude's behavior, eliminating context pollution from CLAUDE.md preloading
**Depends on**: Phase 17 (FIX-01 moves commands to global path; workflow docs must target the same location)
**Requirements**: WFL-01, WFL-02
**Success Criteria** (what must be TRUE):
  1. `/evolve:scan` and `/evolve:apply` each have a corresponding workflow .md document that fully specifies Claude's step-by-step behavior when the command is invoked
  2. The workflow documentation is injected into Claude's context via the slash command template itself (embedded in the .md file that IS the command), not via CLAUDE.md rules or preloaded files
  3. Invoking a slash command produces consistent, predictable Claude behavior as defined by the workflow doc, regardless of what project CLAUDE.md contains
**Plans:** 2/2 plans complete
Plans:
- [x] 19-01-PLAN.md -- Rewrite scan and apply template generators with comprehensive workflow content
- [x] 19-02-PLAN.md -- Version-aware template update mechanism + global uninstall cleanup

### Phase 19.1: Developer Full Integration Testing (INSERTED)

**Goal:** All v3.0 features verified end-to-end through real CLI execution and Claude Code runtime testing -- clean build, all 7 CLI subcommands, all 6 hooks, both slash commands, and the notification pipeline
**Depends on:** Phase 19
**Requirements**: INT-01, INT-02, INT-03, INT-04
**Success Criteria** (what must be TRUE):
  1. `npm run build` exits 0 (DTS build error resolved, all severity fields present)
  2. All 7 CLI subcommands (init, status, scan, pending, apply-one, dismiss, uninstall) produce correct output against real file system state
  3. All 6 hooks capture data when fed valid JSON via stdin simulation
  4. Slash commands (/evolve:scan, /evolve:apply) render correctly in a live Claude Code session
  5. Notification pipeline works: Stop hook analysis -> notification flag -> UserPromptSubmit notification injection
**Plans:** 3/3 plans complete

Plans:
- [x] 19.1-01-PLAN.md -- Fix DTS build error and pre-Phase-18 scanner severity gaps
- [x] 19.1-02-PLAN.md -- Create and execute automated CLI verification script (init through uninstall)
- [x] 19.1-03-PLAN.md -- Hook simulation + manual Claude Code runtime verification (checkpoint)

### Phase 20: Scanner UX & Coverage Polish

**Goal:** Fix 4 UX issues discovered during Phase 19.1 dogfooding -- scan defaults to English output, apply uses interactive option selection, scan shows areas-scanned summary, and E2E dirty-config test validates all 7 scanners
**Depends on:** Phase 19.1
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. Running `harness-evolve scan` outputs findings in English regardless of the Claude Code session language
  2. `/evolve:apply` presents numbered options (apply/skip/dismiss/let Claude decide) that user selects interactively, not free-form text
  3. Scan output includes a summary line showing how many areas were scanned and how many had findings (e.g., "7 scanners checked, 3 issues in 2 areas")
  4. An E2E integration test creates an intentionally broken Claude Code config and verifies `scan` detects issues from multiple scanner types (not just hooks)
**Plans:** 2/2 plans complete

Plans:
- [x] 20-01-PLAN.md -- Template UX (English scan output, numbered apply options) + scanner summary metadata
- [x] 20-02-PLAN.md -- E2E dirty-config integration test validating all 7 scanners

### Phase 21: Foundation & Context Infrastructure
**Goal**: The context-builder correctly handles real-world Claude Code hook configurations, two new CLI commands bridge code-model interaction for the scanner pipeline, and first-time users have a frictionless onboarding path
**Depends on**: Phase 20 (v3.0 shipped)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. Running `harness-evolve scan` on a real user config with nested hooks `{matcher, hooks: [{type, command}]}` produces zero false positives from the hooks parser
  2. `harness-evolve scan-context` outputs a complete JSON object containing CLAUDE.md content, rules, settings, hooks, and commands -- ready for model consumption without additional processing
  3. `harness-evolve store-findings` accepts a JSON array of findings from stdin, validates each against the Recommendation schema, and persists valid findings to the apply pipeline (available via `pending`)
  4. A user who installs harness-evolve for the first time can invoke `/evolve:scan` within their first Claude Code session without a separate manual `harness-evolve init` step, or is guided to run init automatically
**Plans:** 1/1 plans complete
Plans:
- [x] 21-01-PLAN.md -- Fix nested hooks parsing bug + add matcher field to schema (INFRA-01)
- [ ] 21-02-PLAN.md -- Add scan-context CLI subcommand (INFRA-02, INFRA-04)
- [x] 21-03-PLAN.md -- Add store-findings CLI subcommand (INFRA-03, INFRA-04)

### Phase 22: Ecosystem Learning & Scanner Guidance
**Goal**: The `/evolve:scan` slash command template contains a comprehensive, model-executable guidance document informed by GSD workflow patterns and open-source best practices -- making the model itself the scanner
**Depends on**: Phase 21 (needs working `scan-context` CLI for the template to reference)
**Requirements**: ECO-01, ECO-02, SCAN-01, SCAN-02
**Success Criteria** (what must be TRUE):
  1. The `/evolve:scan` template embeds structured analysis guidance that instructs the model to read scan-context output and produce findings -- not display pre-computed CLI results
  2. The guidance document defines 7 analysis areas with per-area checklists, severity classification rules (problem vs suggestion), output format specs, and explicit boundary conditions (what NOT to flag)
  3. At least 3 design patterns or structural techniques borrowed from GSD workflow .md files or other open-source projects are identifiable in the scan/apply templates (e.g., structured output contracts, severity tiers, edge case handling sections)
  4. The scan template can be extended with new analysis areas by editing the guidance .md content alone, without modifying any TypeScript source code
**Plans**: TBD

### Phase 23: Model-Driven Validation & Legacy Cleanup
**Goal**: Model-driven scanning is validated against real-world configs to be at least as accurate as code-based scanners, and all 7 legacy TypeScript scanner functions are removed from the codebase
**Depends on**: Phase 22 (guidance docs must exist before validation)
**Requirements**: MODEL-01, MODEL-02, MODEL-03, MODEL-04, SCAN-03
**Success Criteria** (what must be TRUE):
  1. Model detects a semantic conflict (e.g., "use ESM" contradicting "use CommonJS") in a test config that the old regex-based scanners would miss
  2. Model identifies cross-file inconsistencies (e.g., a rule in `.claude/rules/` that contradicts a setting in `settings.json`) by analyzing multiple config files together
  3. Model identifies a hookable operation described in natural language (e.g., "always run tests before committing") without relying on fixed keyword lists
  4. A user adds a new analysis area by creating/editing a guidance .md section, and the next `/evolve:scan` invocation includes that new area without any code changes or rebuilds
  5. All 7 legacy scanner TypeScript functions (redundancy, mechanization, staleness, conflict, structure, hooks-redundancy, commands) are removed, and the test suite passes with model-driven replacements
**Plans:** 3/3 plans complete

Plans:
- [x] 23-01-PLAN.md -- Replacement integration tests (scan pipeline v4.0) + model validation test config fixtures
- [x] 23-02-PLAN.md -- Legacy scanner removal (8 source + 7 test + 1 E2E files) + scan orchestrator + CLI updates
- [x] 23-03-PLAN.md -- Human verification checkpoint for MODEL-01 through MODEL-04

## Progress

**Execution Order:**
Phases execute in numeric order: 21 -> 22 -> 23

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
| 9. Tech Debt & Auto-Apply Expansion | v1.1 | 3/3 | Complete | 2026-04-03 |
| 10. npm Package & CI/CD Pipeline | v1.1 | 2/2 | Complete | 2026-04-03 |
| 11. CLI Commands & Install Experience | v1.1 | 2/2 | Complete | 2026-04-04 |
| 12. Deep Scan Infrastructure | v2.0 | 3/3 | Complete | 2026-04-04 |
| 13. Auto-Generators | v2.0 | 2/2 | Complete | 2026-04-04 |
| 14. Auto-Apply Closure | v2.0 | 1/1 | Complete | 2026-04-04 |
| 15. Slash Commands & Interactive Apply | v2.0 | 2/2 | Complete | 2026-04-04 |
| 16. UX Polish | v2.0 | 2/2 | Complete | 2026-04-04 |
| 17. Bug Fixes & Reliability | v3.0 | 2/2 | Complete | 2026-04-04 |
| 18. Comprehensive Config Audit | v3.0 | 2/2 | Complete | 2026-04-05 |
| 19. Workflow Documentation | v3.0 | 2/2 | Complete | 2026-04-05 |
| 19.1. Developer Full Integration Testing | v3.0 | 3/3 | Complete | 2026-04-05 |
| 20. Scanner UX & Coverage Polish | v3.0 | 2/2 | Complete | 2026-04-06 |
| 21. Foundation & Context Infrastructure | v4.0 | 1/1 | Complete   | 2026-04-07 |
| 22. Ecosystem Learning & Scanner Guidance | v4.0 | 0/0 | Not started | - |
| 23. Model-Driven Validation & Legacy Cleanup | v4.0 | 3/3 | Complete    | 2026-04-06 |
