# Phase 1: Foundation & Storage - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Persistent infrastructure for harness-evolve: directory structure (~/.harness-evolve/), config schema with defaults, JSONL log format with daily rotation, atomic file-based counter, secret scrubbing on write, and zero-config installation. This phase delivers the storage layer so hooks (Phase 2) can write data and analysis (Phase 3+) can read it.

</domain>

<decisions>
## Implementation Decisions

### Secret scrubbing
- **D-01:** Scrub on write — disk never contains plaintext secrets. Even if log files are copied/leaked, no sensitive data is exposed.
- **D-02:** Scrubbed content replaced with `[REDACTED:type]` markers (e.g., `[REDACTED:aws_key]`, `[REDACTED:bearer_token]`)

### Log schema & organization
- **D-03:** Separate directories by log type: `logs/prompts/`, `logs/tools/`, `logs/permissions/`, `logs/sessions/`
- **D-04:** Each directory contains JSONL files with daily rotation (e.g., `2026-03-31.jsonl`)

### Claude's Discretion
- Secret scrubbing regex ruleset — Claude decides which patterns to cover (AWS keys, Bearer tokens, API keys, passwords, private keys, JWT, etc.) and false positive tolerance
- Log rotation size limits — whether to split files beyond daily rotation
- Config schema design — structure of config.json, what's configurable, defaults, validation approach
- Project scaffolding — package structure, entry points for hooks vs CLI, src/ layout, test structure
- JSONL field schemas per log type — exact fields for prompt entries, tool entries, permission entries

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements
- `.planning/REQUIREMENTS.md` — Full v1 requirements. Phase 1 requirements: CAP-05 (log persistence), CAP-06 (secret scrubbing), CAP-07 (atomic writes), TRG-01 (counter), ONB-01 (zero-config), ONB-03 (configurable thresholds)
- `.planning/PROJECT.md` — Project vision, technical gray areas #1-4, ecosystem positioning, key decisions

### Technology stack
- `CLAUDE.md` §Recommended Stack — All technology choices with versions and rationale (Node 22, TS ~6.0, Zod 4, write-file-atomic, Commander.js, tsup, Vitest)

### Success criteria
- `.planning/ROADMAP.md` §Phase 1 — 5 success criteria including directory structure verification, secret scrubbing test, concurrent counter test (200 from 2×100), zero-config install, stdout injection validation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns will be established in this phase

### Integration Points
- Claude Code hooks system — hooks will be registered in user's `~/.claude/settings.json` or project `.claude/settings.json`
- `~/.harness-evolve/` — all persistent data lives here, outside the project repo
- `write-file-atomic` — chosen for atomic writes (CAP-07, counter race condition)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-storage*
*Context gathered: 2026-03-31*
