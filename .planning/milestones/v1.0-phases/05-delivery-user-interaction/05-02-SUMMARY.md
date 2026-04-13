---
phase: 05-delivery-user-interaction
plan: 02
subsystem: delivery
tags: [notification, stdout-injection, skill, tsup, integration-test]

requires:
  - phase: 05-delivery-user-interaction
    provides: Renderer, state management, rotator, delivery schemas, config extensions
  - phase: 04-analysis-engine-routing
    provides: AnalysisResult, runAnalysis, checkAndTriggerAnalysis
provides:
  - Notification module (buildNotification, flag management)
  - UserPromptSubmit hook with config-gated stdout notification injection
  - run-evolve entry point for /evolve skill invocation
  - /evolve SKILL.md slash command definition
  - tsup build config with delivery/run-evolve entry
  - Delivery pipeline integration test (evolve, coexist, notification flag, state round-trip)
affects: [05-03, user-facing-delivery, installation-docs]

tech-stack:
  added: []
  patterns: [flag-file-signaling, config-gated-injection, skill-entry-point]

key-files:
  created:
    - src/delivery/notification.ts
    - src/delivery/run-evolve.ts
    - .claude/skills/evolve/SKILL.md
    - tests/unit/delivery/notification.test.ts
    - tests/integration/delivery-pipeline.test.ts
  modified:
    - src/hooks/user-prompt-submit.ts
    - src/delivery/index.ts
    - tsup.config.ts
    - .gitignore

key-decisions:
  - "Flag file signaling: notification flag file stores pending count as plain text, read by UserPromptSubmit hook"
  - "Config-gated injection: stdoutInjection config flag controls whether hook writes to stdout"
  - "Gitignore negation: .claude/skills/ tracked for distribution while rest of .claude/ remains ignored"

patterns-established:
  - "Flag-file signaling: write-file -> has-file -> read-file -> clear-file lifecycle for cross-process notification"
  - "Config-gated side effects: check config before performing optional operations in hooks"
  - "Skill entry point pattern: standalone TS file that imports pipeline modules and outputs JSON for skill consumption"

requirements-completed: [DEL-02, DEL-03, DEL-04, TRG-03, TRG-04]

duration: 16min
completed: 2026-04-01
---

# Phase 5 Plan 02: Notification Injection and /evolve Skill Summary

**Stdout notification injection in UserPromptSubmit hook and /evolve skill with run-evolve entry point for on-demand analysis**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-01T03:27:23Z
- **Completed:** 2026-04-01T03:43:34Z
- **Tasks:** 2 (Task 1 TDD: test + feat commits; Task 2: feat commit)
- **Files modified:** 9

## Accomplishments
- Notification module with buildNotification (singular/plural, under 200 chars, /evolve reference), flag write/has/clear/read lifecycle
- UserPromptSubmit hook extended with config-gated notification injection that reads pending count from flag file, writes one-line stdout, and clears flag
- run-evolve.ts entry point wiring analysis -> renderer -> state -> rotator -> notification flag with JSON summary output
- /evolve SKILL.md defining step-by-step instructions for Claude Code skill invocation
- Delivery pipeline integration test validating evolve flow, auto/manual trigger coexistence, notification flag, and state round-trip

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED):** `a80add0` (test) - Failing tests for notification module and UserPromptSubmit injection
2. **Task 1 (GREEN):** `f938579` (feat) - Notification module and UserPromptSubmit injection
3. **Task 2:** `c0b0ba9` (feat) - Run-evolve entry point, /evolve skill, tsup config, integration test

## Files Created/Modified
- `src/delivery/notification.ts` - buildNotification, writeNotificationFlag, hasNotificationFlag, clearNotificationFlag, readNotificationFlagCount
- `src/delivery/run-evolve.ts` - Entry point: runAnalysis -> renderRecommendations -> write file -> set notification flag -> output JSON
- `src/hooks/user-prompt-submit.ts` - Extended with notification injection after counter increment (config-gated, flag-gated)
- `src/delivery/index.ts` - Added notification function re-exports
- `.claude/skills/evolve/SKILL.md` - /evolve slash command with frontmatter and step-by-step instructions
- `tsup.config.ts` - Added delivery/run-evolve entry point
- `.gitignore` - Changed .claude/ to .claude/* with !.claude/skills/ negation for distribution
- `tests/unit/delivery/notification.test.ts` - 12 tests: buildNotification format, flag management, UserPromptSubmit injection
- `tests/integration/delivery-pipeline.test.ts` - 4 tests: evolve flow, coexist validation, notification flag, state round-trip

## Decisions Made
- Flag file signaling pattern: the notification flag file stores the pending count as plain text. UserPromptSubmit reads this count to build the notification message. This avoids needing to re-run analysis or load state in the fast-path hook.
- Config-gated injection: the `config.delivery.stdoutInjection` flag controls whether the hook writes to stdout. When false, no notification is ever emitted, matching the must-have truth.
- Gitignore negation for skills distribution: changed `.claude/` to `.claude/*` with `!.claude/skills/` so that skill definitions can be tracked in git while keeping other `.claude/` files (worktrees, etc.) ignored.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] .gitignore preventing SKILL.md from being tracked**
- **Found during:** Task 2 (commit stage)
- **Issue:** `.claude/` in .gitignore blocked `.claude/skills/evolve/SKILL.md` from being committed
- **Fix:** Changed `.claude/` to `.claude/*` with `!.claude/skills/` negation pattern
- **Files modified:** .gitignore
- **Verification:** `git check-ignore` confirms SKILL.md is NOT ignored
- **Committed in:** c0b0ba9 (Task 2 commit)

**2. [Rule 1 - Bug] Integration test using runAnalysis(tempDir) picked up real environment**
- **Found during:** Task 2 (test verification)
- **Issue:** `runAnalysis` uses default 30-day window and real environment scanner, producing LOW confidence config_drift recommendations instead of HIGH repeated_prompt recommendations from test data
- **Fix:** Changed integration tests to use `preProcess` + `analyze` with controlled date range and minimal snapshot, isolating from real environment
- **Files modified:** tests/integration/delivery-pipeline.test.ts
- **Verification:** All 4 integration tests pass consistently
- **Committed in:** c0b0ba9 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Notification injection and /evolve skill complete, closing the user-facing delivery loop
- Plan 03 (auto-apply and library exports) already completed in parallel
- All 48 delivery tests pass (12 notification + 22 renderer/state/rotator/auto-apply + 4 integration + 6 analysis-pipeline + 4 delivery-pipeline)
- TypeScript compilation clean, tsup build successful with new entry point

## Self-Check: PASSED

- All 9 created/modified files verified present on disk
- Commit a80add0 (test), f938579 (feat), c0b0ba9 (feat) verified in git log
- 16/16 notification + delivery-pipeline tests passing
- 48/48 total delivery tests passing
- TypeScript compilation clean (0 errors)
- tsup build successful with delivery/run-evolve.d.ts output

---
*Phase: 05-delivery-user-interaction*
*Completed: 2026-04-01*
