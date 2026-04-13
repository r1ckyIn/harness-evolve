# Phase 26: Self-Healing Installation - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Users never get stuck with broken slash commands — the system detects and repairs missing installation automatically. Detection at a natural trigger point (SessionStart hook or /evolve skill invocation) without adding user-visible latency.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from requirement HEAL-01:
- Detection must happen at SessionStart hook or /evolve skill invocation
- Must not add user-visible latency to normal operations
- When `~/.claude/commands/evolve/` directory is missing or incomplete, the system detects this
- Response: auto-reinstall OR prompt user to run `harness-evolve init`
- Templates were finalized in Phase 25 (v5) — auto-reinstall installs the correct v5 versions

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — infrastructure phase.

</deferred>
