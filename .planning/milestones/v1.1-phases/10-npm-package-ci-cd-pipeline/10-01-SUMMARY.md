---
phase: 10-npm-package-ci-cd-pipeline
plan: 01
subsystem: infra
tags: [npm, package.json, exports-map, publint, attw, cli, tsup, esm]

requires:
  - phase: 09-tech-debt-auto-apply
    provides: stable codebase with 8 tsup entry points and 364 passing tests
provides:
  - Complete npm metadata (description, keywords, license, author, repository, homepage, bugs)
  - files whitelist restricting tarball to dist/, README.md, LICENSE
  - ESM exports map with 8 subpath entries (root + 7 hook/delivery)
  - bin field with CLI stub entry point
  - publishConfig with provenance
  - Package validation scripts (publint, attw)
  - Package-metadata test suite (28 tests)
affects: [10-02-ci-cd-badges, 11-cli-commands]

tech-stack:
  added: [publint, "@arethetypeswrong/cli"]
  patterns: [files-whitelist, exports-map-types-first, cli-stub-with-shebang, dts-entry-exclusion]

key-files:
  created:
    - src/cli.ts
    - tests/unit/package-metadata.test.ts
  modified:
    - package.json
    - tsup.config.ts
    - package-lock.json

key-decisions:
  - "Exclude CLI entry from tsup DTS generation -- bin entries are not imported as libraries, avoids tsup DTS worker isolation errors"
  - "Shebang preserved natively by esbuild/tsup -- no postbuild script needed"
  - "Files whitelist approach over .npmignore -- explicit control, safer"

patterns-established:
  - "exports map with types condition before default for TypeScript resolution"
  - "DTS entry exclusion for non-library entry points (bin stubs)"

requirements-completed: [NPM-01, NPM-02, NPM-03, NPM-04]

duration: 4min
completed: 2026-04-03
---

# Phase 10 Plan 01: npm Package Metadata Summary

**Complete npm package.json with metadata, files whitelist, ESM exports map, CLI stub bin entry, and validation tooling (publint + attw)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T13:02:26Z
- **Completed:** 2026-04-03T13:06:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Package.json enriched with all required npm metadata fields (NPM-01)
- Tarball restricted to dist/, README.md, LICENSE via files whitelist -- down from 211 files to 29 (NPM-02)
- ESM exports map with 8 subpath entries, types-first ordering validated by publint + attw (NPM-03)
- CLI stub with shebang outputs version and usage hint, linked via bin field (NPM-04)
- 28 new package-metadata tests validate all fields programmatically
- Package validation scripts added: check:publint, check:attw, check:package, prepublishOnly

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dev deps, create package-metadata test, update package.json** - `65ab61d` (feat)
2. **Task 2: Create CLI stub, update tsup config, build and validate** - `d88fd68` (feat)

## Files Created/Modified

- `package.json` - Complete npm metadata, files whitelist, exports map, bin field, validation scripts, publishConfig
- `src/cli.ts` - CLI entry point with shebang, version display, usage hint
- `tsup.config.ts` - Added cli entry, DTS exclusion for non-library entries
- `tests/unit/package-metadata.test.ts` - 28 tests validating all package.json fields
- `package-lock.json` - Updated with publint and @arethetypeswrong/cli

## Decisions Made

1. **Exclude CLI from DTS generation** - The tsup DTS worker runs in isolated context that doesn't resolve node: imports correctly for standalone scripts. Since CLI bin entries are never imported as libraries, excluding from DTS is correct and avoids the build error.
2. **No postbuild script for shebang** - esbuild (via tsup) natively preserves the `#!/usr/bin/env node` shebang from the TypeScript source. Tested and confirmed in dist/cli.js output.
3. **Files whitelist over .npmignore** - Explicit inclusion via `files` field is safer than blacklist approach. Tarball reduced from 548KB/211 files to 178.9KB/29 files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Excluded CLI entry from tsup DTS generation**
- **Found during:** Task 2 (Build and validate)
- **Issue:** tsup's DTS worker fails on src/cli.ts with "Cannot find name 'node:fs'" errors despite tsc --noEmit passing. The DTS worker runs in an isolated context that doesn't properly resolve Node.js built-in types for standalone scripts.
- **Fix:** Changed `dts: true` to `dts: { entry: { ... } }` listing only the 8 library entries, excluding cli
- **Files modified:** tsup.config.ts
- **Verification:** `npm run build` succeeds, all .d.ts files generated for library entries, no cli.d.ts (not needed)
- **Committed in:** d88fd68 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed vitest -x flag to --bail 1**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** Plan specified `npx vitest run tests/... -x` but vitest 4.x does not support `-x` flag (CACError: Unknown option)
- **Fix:** Used `--bail 1` instead of `-x` for fail-fast behavior
- **Files modified:** None (runtime command only)
- **Verification:** Tests run successfully with --bail 1

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for correct build and test execution. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

- `src/cli.ts` - Intentional CLI stub that prints version and "commands coming in v1.1". Phase 11 will replace with full Commander.js CLI implementation.

## Next Phase Readiness

- Package is now publishable to npm with correct metadata and validated exports
- Plan 10-02 can proceed with CI/CD workflows knowing the package validation scripts exist
- Phase 11 can build on the CLI stub with Commander.js commands
- First manual `npm publish` still required before OIDC trusted publishing (documented limitation)

## Self-Check: PASSED

All files verified present:
- FOUND: package.json
- FOUND: src/cli.ts
- FOUND: tsup.config.ts
- FOUND: tests/unit/package-metadata.test.ts
- FOUND: .planning/phases/10-npm-package-ci-cd-pipeline/10-01-SUMMARY.md

All commits verified:
- FOUND: 65ab61d (Task 1)
- FOUND: d88fd68 (Task 2)
- FOUND: bed957e (docs)

---
*Phase: 10-npm-package-ci-cd-pipeline*
*Completed: 2026-04-03*
