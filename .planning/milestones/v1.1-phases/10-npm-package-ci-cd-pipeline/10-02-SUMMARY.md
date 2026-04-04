---
phase: 10-npm-package-ci-cd-pipeline
plan: 02
subsystem: infra
tags: [github-actions, ci-cd, npm-publish, oidc, shields-io, badges]

# Dependency graph
requires:
  - phase: 10-01
    provides: "package.json metadata, exports map, files whitelist, publint + attw dev dependencies"
provides:
  - "CI quality gate workflow (build + test + typecheck + publint + attw)"
  - "Automated npm publish workflow with OIDC trusted publishing"
  - "Dynamic README badges (npm version, CI status, license)"
affects: [11-cli-install-experience]

# Tech tracking
tech-stack:
  added: [github-actions, actions/checkout@v4, actions/setup-node@v4]
  patterns: ["CI workflow with matrix node version strategy", "OIDC trusted publishing with provenance", "Dynamic shields.io badges"]

key-files:
  created:
    - .github/workflows/ci.yml
    - .github/workflows/publish.yml
    - tests/unit/readme-badges.test.ts
  modified:
    - README.md

key-decisions:
  - "CI runs publint + attw in addition to build/test/typecheck for comprehensive package validation"
  - "Publish workflow includes npm install -g npm@latest to ensure OIDC-compatible npm version in CI"

patterns-established:
  - "CI workflow pattern: checkout -> setup-node with cache -> npm ci -> build -> typecheck -> test -> publint -> attw"
  - "Publish workflow pattern: v* tag trigger -> OIDC permissions -> build -> test -> publish --provenance"

requirements-completed: [CIC-01, CIC-02, CIC-03]

# Metrics
duration: 2min
completed: 2026-04-03
---

# Phase 10 Plan 02: CI/CD Workflows & Dynamic Badges Summary

**GitHub Actions CI quality gate (build+test+typecheck+publint+attw) and OIDC-based npm publish on v* tag, with dynamic shields.io badges replacing static test count**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T13:02:28Z
- **Completed:** 2026-04-03T13:04:37Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- CI workflow runs build, test, typecheck, publint, and attw on every push/PR to main
- Publish workflow triggers on v* tag push with OIDC trusted publishing (id-token:write) and provenance attestation
- README badges updated from static (hardcoded "336 passing") to dynamic (npm version from registry, CI status from Actions)
- Badge test validates all required badge URLs exist and static badge is removed

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing README badge tests** - `83d59ff` (test)
2. **Task 1 (GREEN): Create CI/CD workflows and update README badges** - `e08e7bc` (feat)

## Files Created/Modified
- `.github/workflows/ci.yml` - CI quality gate workflow (push/PR to main)
- `.github/workflows/publish.yml` - Automated npm publish with OIDC on v* tag
- `tests/unit/readme-badges.test.ts` - Badge validation tests (5 assertions)
- `README.md` - Dynamic badges replacing static test count badge

## Decisions Made
- CI includes publint + attw validation steps beyond basic build/test/typecheck for comprehensive ESM package validation
- Publish workflow adds `npm install -g npm@latest` step to ensure CI runner has OIDC-compatible npm (>=11.5.1)
- Kept Language and Runtime badges alongside new npm version and CI badges for complete project info display

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Vitest 4 does not support `-x` flag (plan used `npx vitest run ... -x`); used `--bail 1` instead. Informational only, did not affect outcomes.

## Known Stubs

None - all files are fully implemented.

## User Setup Required

None - no external service configuration required. Note: the first npm publish must be done manually by the repository owner (`npm login` + `npm publish`). After that, OIDC trusted publishing must be configured on npmjs.com for the GitHub Actions workflow to handle subsequent publishes.

## Next Phase Readiness
- CI/CD pipeline ready; CI will run on next push/PR to main
- Publish workflow ready for v* tag push once first manual publish is complete and OIDC is configured
- Phase 11 (CLI + install experience) can proceed independently

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 10-npm-package-ci-cd-pipeline*
*Completed: 2026-04-03*
