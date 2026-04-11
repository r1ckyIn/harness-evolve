# Requirements -- harness-evolve

## Core Value

Make Claude Code harnesses self-improving without manual analysis -- with a reliable model-driven scan/apply pipeline.

---

## v5.0 Requirements

### Template Execution (TMPL)

- [x] **TMPL-01**: `/evolve:scan` template is treated by the model as mandatory instructions, executing the 3-step pipeline (scan-context → analyze → store-findings) rather than free-styling or running legacy `pending` command
- [x] **TMPL-02**: `/evolve:apply` template is executed as interactive 4-option flow (Apply/Skip/Dismiss/Let Claude decide), processing each pending recommendation one-by-one
- [x] **TMPL-03**: First scan only analyzes configuration files (CLAUDE.md, rules, settings, hooks, commands) without mixing in historical prompt pattern suggestions

### Legacy Cleanup (LEGACY)

- [ ] **LEGACY-01**: Deprecated `harness-evolve scan` CLI subcommand is removed or redirected to `scan-context`, no longer producing false-positive findings
- [x] **LEGACY-02**: `harness-evolve scan-context` output distinguishes project-level config from user-global config, labeling each config source (project/user scope)

### Self-Healing (HEAL)

- [x] **HEAL-01**: SessionStart hook or `/evolve` skill detects whether `~/.claude/commands/evolve/` exists, auto-reinstalling slash commands or prompting user to run init when missing

---

## Future Requirements (v6.0+)

- Cross-project pattern aggregation (user-level, not project-level)
- Configuration health score (0-100 + Top 3 improvements)
- Drift detection (alert when applied recommendations are reverted)
- Community shared routing rule marketplace

---

## Out of Scope

- Web visualization dashboard -- CLI-native positioning unchanged
- Calling Anthropic API directly -- harness-evolve doesn't call APIs, user's Claude Code session provides the model
- Supporting non-Claude Code AI coding agents -- Claude Code specific
- NLP libraries for semantic analysis -- model itself is the NLP engine

---

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| TMPL-01 | Phase 25 | Complete |
| TMPL-02 | Phase 25 | Complete |
| TMPL-03 | Phase 25 | Complete |
| LEGACY-01 | Phase 24 | Pending |
| LEGACY-02 | Phase 24 | Complete |
| HEAL-01 | Phase 26 | Complete |

---
*Last updated: 2026-04-11 -- v5.0 roadmap created, 6 requirements mapped to 3 phases*
