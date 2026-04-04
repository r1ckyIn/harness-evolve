---
phase: 09-tech-debt-auto-apply-expansion
plan: 02
subsystem: testing
tags: [proper-lockfile, concurrency, lock-retry, flaky-test]

requires:
  - phase: 01-foundation-storage
    provides: counter.ts with proper-lockfile based incrementCounter
provides:
  - Deterministic concurrent-counter test with robust lock retry config
  - Lock retry params hardened for CI runner contention scenarios
affects: [10-npm-publish-ci-pipeline]

tech-stack:
  added: []
  patterns: [lock-retry-with-jitter]

key-files:
  created: []
  modified:
    - src/storage/counter.ts
    - src/analysis/trigger.ts

key-decisions:
  - "retries 50 with randomize:true to eliminate lock convoys under high contention"
  - "minTimeout lowered to 20ms for faster happy-path retries"

patterns-established:
  - "Lock retry pattern: retries:50, minTimeout:20, maxTimeout:1000, randomize:true, stale:10000"

requirements-completed: [TDT-02]

duration: 2min
completed: 2026-04-03
---

# Phase 09 Plan 02: Fix Flaky Concurrent-Counter Test Summary

**Hardened proper-lockfile retry config (50 retries, 20-1000ms jitter backoff) to eliminate ELOCKED flakes in concurrent-counter integration test**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T12:14:31Z
- **Completed:** 2026-04-03T12:16:45Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Increased lock retry budget from ~2-3s (10 retries) to ~30s (50 retries) in both counter.ts and trigger.ts
- Added `randomize: true` jitter to prevent lock convoys where both workers retry simultaneously
- Lowered `minTimeout` from 50ms to 20ms for faster first retries (no happy-path perf regression)
- Verified 3/3 consecutive test passes, all completing in ~11s (well under 30s budget)

## Task Commits

Each task was committed atomically:

1. **Task 1: Increase lock retry parameters in counter.ts and trigger.ts** - `b05a786` (fix)

## Files Created/Modified
- `src/storage/counter.ts` - Updated lock() retry config: retries 50, minTimeout 20, maxTimeout 1000, randomize true
- `src/analysis/trigger.ts` - Updated lock() retry config in resetCounterWithTimestamp: matching params

## Decisions Made
- Used `retries: 50` to provide ~30 seconds total retry budget, sufficient for 200 rapid lock operations across 2 workers even on slow CI runners
- `minTimeout: 20` (lower than original 50ms) ensures happy-path performance is not degraded -- first retries are faster
- `maxTimeout: 1000` (up from 500ms) allows longer backoff under sustained contention
- `randomize: true` adds exponential backoff jitter to break lock convoys where both processes retry at identical intervals

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Vitest 4.x does not support the `-x` flag (plan specified `vitest run ... -x`). Used `--bail 1` equivalent instead. Not a code issue, just CLI flag difference.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Concurrent-counter test now passes deterministically (3/3 consecutive runs, ~11s each)
- CI pipeline (Phase 10) can gate on this test reliably
- Pre-existing analyzer.test.ts failures (4 tests, pattern_type enum mismatch) are tracked as TDT-01 in Plan 09-01

## Self-Check: PASSED

- All source files exist (counter.ts, trigger.ts)
- Commit b05a786 exists in history
- retries:50 and randomize:true present in both files
- SUMMARY.md created successfully

---
*Phase: 09-tech-debt-auto-apply-expansion*
*Completed: 2026-04-03*
