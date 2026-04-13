# Phase 24: Context Infrastructure & Legacy Cleanup - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

scan-context output clearly separates project vs user scope, and deprecated CLI paths no longer confuse users or the model. This phase delivers clean context infrastructure that Phase 25's template rewrites depend on.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key constraints from dogfooding:
- `harness-evolve scan-context` currently outputs user-global settings (all hooks, MCP permissions) mixed with project-level config — this confuses analysis when run in a project subdirectory
- `harness-evolve scan` (deprecated) still produces 21 false-positive findings about "empty hooks" and "duplicate registrations" because it runs old code-based scanners that were removed in v4.0
- The deprecated `scan` CLI should either error with a message pointing to `/evolve:scan`, or be fully removed

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
