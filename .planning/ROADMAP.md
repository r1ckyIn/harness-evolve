# Roadmap: harness-evolve

## Milestones

- v1.0 Self-Iteration Engine -- Phases 1-8 (shipped 2026-04-02) | [Archive](milestones/v1.0-ROADMAP.md)
- v1.1 Stabilization & Production -- Phases 9-11 (shipped 2026-04-04) | [Archive](milestones/v1.1-ROADMAP.md)
- v2.0 Deep Scan & Auto-Generation -- Phases 12-16 (shipped 2026-04-04) | [Archive](milestones/v2.0-ROADMAP.md)
- v3.0 Reliability & Config Audit -- Phases 17-19 (in progress)

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

### v3.0 Reliability & Config Audit (In Progress)

**Milestone Goal:** Fix v2.0 dogfooding bugs, upgrade scanner from shallow detection to comprehensive config audit, and make slash commands globally accessible with proper workflow documentation.

- [x] **Phase 17: Bug Fixes & Reliability** - Fix 4 dogfooding bugs: global slash commands, scanner false positives, apply-one confidence gate, stop hook notification (completed 2026-04-04)
- [x] **Phase 18: Comprehensive Config Audit** - Upgrade scanner from shallow stale/redundancy checks to full Claude Code configuration quality analysis (completed 2026-04-05)
- [x] **Phase 19: Workflow Documentation** - GSD-style workflow .md for each slash command, injected via command template rather than CLAUDE.md preload (completed 2026-04-05)

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

## Progress

**Execution Order:**
Phases execute in numeric order: 17 -> 18 -> 19 -> 19.1

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
| 17. Bug Fixes & Reliability | v3.0 | 2/2 | Complete    | 2026-04-04 |
| 18. Comprehensive Config Audit | v3.0 | 2/2 | Complete    | 2026-04-05 |
| 19. Workflow Documentation | v3.0 | 2/2 | Complete    | 2026-04-05 |

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
**Plans:** 2/3 plans executed

Plans:
- [x] 19.1-01-PLAN.md -- Fix DTS build error and pre-Phase-18 scanner severity gaps
- [x] 19.1-02-PLAN.md -- Create and execute automated CLI verification script (init through uninstall)
- [ ] 19.1-03-PLAN.md -- Hook simulation + manual Claude Code runtime verification (checkpoint)
