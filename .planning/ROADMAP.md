# Roadmap: harness-evolve

## Milestones

- **v1.0 Self-Iteration Engine** — Phases 1-8 (shipped 2026-04-02) | [Archive](milestones/v1.0-ROADMAP.md)
- **v1.1 Stabilization & Production** — Phases 9-11 (shipped 2026-04-04) | [Archive](milestones/v1.1-ROADMAP.md)
- **v2.0 Deep Scan & Auto-Generation** — Phases 12-16 (in progress)

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

<details>
<summary>v1.1 Stabilization & Production (Phases 9-11) — SHIPPED 2026-04-04</summary>

- [x] Phase 9: Tech Debt & Auto-Apply Expansion (3/3 plans) — completed 2026-04-03
- [x] Phase 10: npm Package & CI/CD Pipeline (2/2 plans) — completed 2026-04-03
- [x] Phase 11: CLI Commands & Install Experience (2/2 plans) — completed 2026-04-04

</details>

### v2.0 Deep Scan & Auto-Generation (In Progress)

**Milestone Goal:** Eliminate cold-start problem, close the auto-apply loop for all target types, and upgrade harness-evolve from a background tool to an interactive optimization assistant.

- [x] **Phase 12: Deep Scan Infrastructure** - Scan existing user config to detect redundancy, missing mechanization, and stale references (completed 2026-04-04)
- [x] **Phase 13: Auto-Generators** - Generate skill, hook, and CLAUDE.md draft artifacts from detected patterns (completed 2026-04-04)
- [x] **Phase 14: Auto-Apply Closure** - Register HOOK and CLAUDE_MD appliers into the strategy pattern registry for full auto-apply coverage (completed 2026-04-04)
- [ ] **Phase 15: Slash Commands & Interactive Apply** - Install slash commands and provide interactive recommendation review workflow
- [ ] **Phase 16: UX Polish** - Concise notifications, improved init display, impact-ordered recommendations

## Phase Details

### Phase 12: Deep Scan Infrastructure
**Goal**: Users get immediate Day 0 value by scanning their existing Claude Code configuration for quality issues
**Depends on**: Phase 11 (CLI init command exists as entry point)
**Requirements**: SCN-01, SCN-02, SCN-03
**Success Criteria** (what must be TRUE):
  1. Running `harness-evolve init` scans CLAUDE.md, .claude/rules/, settings.json, and .claude/commands/ and produces a config quality report
  2. The scan detects redundant rules (same constraint in multiple files), missing mechanization (operations in rules that should be hooks), and stale config (references to non-existent files or commands)
  3. Scan results output as structured recommendations using the existing recommendation format and delivery pipeline
  4. Scan can be triggered programmatically (not yet via slash command -- that comes in Phase 15)
**Plans**: 3 plans
Plans:
- [x] 12-01-PLAN.md — Scan schemas, context-builder, and patternType extension
- [x] 12-02-PLAN.md — Redundancy, mechanization, and staleness scanners
- [x] 12-03-PLAN.md — Scan orchestrator, init integration, and public API exports

### Phase 13: Auto-Generators
**Goal**: The system can produce ready-to-use artifact drafts (skills, hooks, CLAUDE.md patches) from detected patterns
**Depends on**: Phase 12 (scan infrastructure provides detection context)
**Requirements**: GEN-01, GEN-02, GEN-03
**Success Criteria** (what must be TRUE):
  1. When repeated long-prompt patterns are detected, a `.claude/commands/<name>.md` skill file draft is generated with the extracted prompt template
  2. When mechanizable operation patterns are detected, a shell command hook script draft is generated with the appropriate lifecycle event binding
  3. When project-level config suggestions are detected, a CLAUDE.md patch is generated in diff format that the user can review before applying
  4. Generated artifacts follow Claude Code conventions (correct directory structure, valid format, appropriate metadata)
**Plans**: 2 plans
Plans:
- [x] 13-01-PLAN.md — Generator schemas, shared utilities, and skill generator (GEN-01)
- [x] 13-02-PLAN.md — Hook generator, CLAUDE.md patch generator, and public API exports (GEN-02, GEN-03)

### Phase 14: Auto-Apply Closure
**Goal**: HIGH-confidence HOOK and CLAUDE_MD recommendations can be automatically applied without user intervention, completing the auto-apply loop for all generated artifact types
**Depends on**: Phase 13 (generators must exist before appliers can use them)
**Requirements**: GEN-04, GEN-05
**Success Criteria** (what must be TRUE):
  1. A HOOK auto-applier is registered in the strategy pattern applier registry and can write hook scripts + update settings.json hook registration
  2. A CLAUDE_MD auto-applier is registered in the strategy pattern applier registry and can apply diff patches to CLAUDE.md files
  3. Both appliers integrate with the existing backup/audit/confidence pipeline (backup before apply, JSONL audit log, only HIGH confidence triggers auto-apply)
**Plans**: 1 plan
Plans:
- [x] 14-01-PLAN.md — HookApplier, ClaudeMdApplier implementation and registry wiring (GEN-04, GEN-05)

### Phase 15: Slash Commands & Interactive Apply
**Goal**: Users can interact with harness-evolve through Claude Code slash commands for scanning, reviewing, and applying recommendations
**Depends on**: Phase 14 (auto-apply closure needed for /evolve:apply to have full capability)
**Requirements**: CMD-01, CMD-02, CMD-03, SCN-04
**Success Criteria** (what must be TRUE):
  1. `harness-evolve init` installs `/evolve:scan` and `/evolve:apply` slash command files into the project's `.claude/commands/` directory
  2. `/evolve:scan` triggers a deep config scan at any time (not just during init), outputting structured recommendations
  3. `/evolve:apply` presents pending recommendations one-by-one, allowing the user to apply, skip, or permanently ignore each
  4. `harness-evolve uninstall` removes installed slash command files in addition to existing hook cleanup
**Plans**: 2 plans
Plans:
- [x] 15-01-PLAN.md — Slash command templates and init/uninstall wiring (CMD-01, CMD-03)
- [x] 15-02-PLAN.md — CLI scan, pending, apply-one, dismiss subcommands (SCN-04, CMD-02)

### Phase 16: UX Polish
**Goal**: The recommendation experience is concise, informative, and prioritized so users see the highest-impact suggestions first
**Depends on**: Phase 15 (all functional features complete; polish layer on top)
**Requirements**: UX-01, UX-02, UX-03
**Success Criteria** (what must be TRUE):
  1. After analysis completes, the next UserPromptSubmit injects a one-line notification (e.g., "Found N new suggestions, /evolve:apply to review") instead of dumping full recommendation text
  2. `harness-evolve init` displays a one-line purpose description next to each registered hook
  3. Recommendations are sorted by impact (HIGH confidence first, then MEDIUM, then LOW) rather than flat listing
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 12 -> 13 -> 14 -> 15 -> 16

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
| 13. Auto-Generators | v2.0 | 2/2 | Complete    | 2026-04-04 |
| 14. Auto-Apply Closure | v2.0 | 1/1 | Complete    | 2026-04-04 |
| 15. Slash Commands & Interactive Apply | v2.0 | 1/2 | In Progress|  |
| 16. UX Polish | v2.0 | 0/? | Not started | - |
