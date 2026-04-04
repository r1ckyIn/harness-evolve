---
phase: 13-auto-generators
plan: 02
subsystem: generators
tags: [bash-hooks, unified-diff, pure-functions, hook-generation, claude-md-patch]

requires:
  - phase: 13-auto-generators plan 01
    provides: GeneratedArtifact schema, toSlug, GENERATOR_VERSION, nowISO, generateSkill pattern
provides:
  - generateHook() pure function converting HOOK recommendations to bash script drafts
  - generateClaudeMdPatch() pure function converting CLAUDE_MD recommendations to unified diff patches
  - src/generators/index.ts barrel module re-exporting all generators and schemas
  - Phase 13 exports in src/index.ts for library consumers
affects: [14-auto-apply-expansion]

tech-stack:
  added: []
  patterns: [extractHookEvent regex cascade with fallback, pattern_type-based switch for diff format selection, barrel module pattern for generator public API]

key-files:
  created:
    - src/generators/hook-generator.ts
    - src/generators/claude-md-generator.ts
    - src/generators/index.ts
    - tests/unit/generators/hook-generator.test.ts
    - tests/unit/generators/claude-md-generator.test.ts
  modified:
    - src/index.ts

key-decisions:
  - "Hook event extraction uses regex cascade: description -> suggested_action -> PreToolUse fallback"
  - "CLAUDE.md patches use simplified unified diff format (--- a/ +++ b/ @@ markers) not full git diff"
  - "All generators exported both through generators/index.ts barrel and directly from src/index.ts"

patterns-established:
  - "Hook event extraction: regex /suitable for a (\\w+) hook/i on description, /Create a (\\w+) hook/i on action, PreToolUse fallback"
  - "Patch generation: pattern_type-based switch (stale -> removal, redundancy -> consolidation, default -> generic addition)"
  - "Generator barrel: generators/index.ts re-exports all generators + schemas + types + utilities"

requirements-completed: [GEN-02, GEN-03]

duration: 3min
completed: 2026-04-04
---

# Phase 13 Plan 02: Hook Generator and CLAUDE.md Patch Generator Summary

**Hook script generator (GEN-02) and CLAUDE.md patch generator (GEN-03) with public API barrel module exporting all three generators for Phase 14 applier consumption**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-04T07:36:28Z
- **Completed:** 2026-04-04T07:39:29Z
- **Tasks:** 2
- **Files created:** 5
- **Files modified:** 1

## Accomplishments
- generateHook() produces bash hook script drafts from both scan_missing_mechanization and repeated_prompt HOOK recommendations with correct shebang, stdin reading, and exit codes
- generateClaudeMdPatch() produces simplified unified diff patches for stale references (removal), redundancy (consolidation), and generic CLAUDE_MD recommendations (section addition)
- extractHookEvent() cascades through description and suggested_action regex patterns with PreToolUse fallback
- Public API wired: all generators, schemas, types, and utilities exported through src/generators/index.ts and src/index.ts
- 23 new unit tests (12 hook generator + 11 CLAUDE.md patch generator), full suite 547 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement hook generator and CLAUDE.md patch generator (GEN-02, GEN-03)** - `5bd5859` (feat)
2. **Task 2: Wire public API exports for generator module** - `7f23552` (feat)

## Files Created/Modified
- `src/generators/hook-generator.ts` - generateHook() pure function with extractHookEvent() helper
- `src/generators/claude-md-generator.ts` - generateClaudeMdPatch() pure function with stale/redundancy/generic patch builders
- `src/generators/index.ts` - Barrel module re-exporting all generators, schemas, types, and utilities
- `src/index.ts` - Added Phase 13 export block for library consumers
- `tests/unit/generators/hook-generator.test.ts` - 12 tests covering mechanization + repeated_prompt recs, event extraction, guards, schema validation
- `tests/unit/generators/claude-md-generator.test.ts` - 11 tests covering stale/redundancy/generic patches, guards, schema validation

## Decisions Made
- Hook event extraction uses a regex cascade: first tries `rec.description` for "suitable for a X hook", then `rec.suggested_action` for "Create a X hook", finally falls back to 'PreToolUse'. This handles both mechanization scanner and repeated-prompts classifier output formats.
- CLAUDE.md patches use simplified unified diff format with --- a/CLAUDE.md, +++ b/CLAUDE.md headers and @@ context markers. Not full git diff format -- these are human-readable drafts for review.
- All generators exported both via generators/index.ts barrel (for internal module use) and directly from src/index.ts (for library consumers).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three generators complete: generateSkill (GEN-01), generateHook (GEN-02), generateClaudeMdPatch (GEN-03)
- Public API ready for Phase 14 appliers to import and use
- Generator pattern established: pure function (Recommendation) => GeneratedArtifact | null
- All 547 tests pass, build succeeds with all new exports

## Self-Check: PASSED

All 6 source/test files exist. Both task commits (5bd5859, 7f23552) verified in git log. All acceptance criteria verified. 23/23 new generator tests pass. 547/547 full suite tests pass. Build succeeds.

---
*Phase: 13-auto-generators*
*Completed: 2026-04-04*
