---
phase: 01-foundation-storage
plan: 01
subsystem: infra
tags: [typescript, zod, vitest, tsup, node22, config, storage]

# Dependency graph
requires: []
provides:
  - "TypeScript project scaffold with Node 22 + ESM build toolchain"
  - "Zod v4 schemas for config, log entries, counter, and hook input"
  - "Init-on-first-use directory manager for ~/.harness-evolve/"
  - "Config loader with zero-config defaults and user override merging"
affects: [01-02, 01-03, 02-collection-hooks]

# Tech tracking
tech-stack:
  added: [typescript-6.0, zod-4.3.6, write-file-atomic-7, proper-lockfile-4, tsup-8.5, vitest-4.1, tsx-4.21]
  patterns: [init-on-first-use, zod-schema-with-defaults, strict-schema-validation, atomic-file-writes]

key-files:
  created:
    - package.json
    - tsconfig.json
    - vitest.config.ts
    - tsup.config.ts
    - .gitignore
    - src/index.ts
    - src/schemas/config.ts
    - src/schemas/log-entry.ts
    - src/schemas/counter.ts
    - src/schemas/hook-input.ts
    - src/storage/dirs.ts
    - src/storage/config.ts
    - tests/unit/config.test.ts
  modified: []

key-decisions:
  - "Used explicit default values in Zod v4 .default() instead of empty objects for TypeScript 6 compatibility"
  - "Added ignoreDeprecations 6.0 to tsconfig.json for tsup DTS generation compatibility with TypeScript 6"
  - "Added passWithNoTests to vitest config for clean exit when no tests exist"
  - "Used zod/v4 import path as specified in plan"

patterns-established:
  - "Init-on-first-use: ensureInit() with idempotent flag for lazy directory creation"
  - "Schema-with-defaults: Zod .default() on every field for zero-config (ONB-01)"
  - "Strict schema: .strict() on config to reject unknown fields"
  - "Config loader: parse-or-fallback pattern with atomic write of defaults"
  - "Test isolation: vi.stubEnv(HOME) + vi.resetModules() + mkdtemp for temp directories"

requirements-completed: [ONB-01, ONB-03]

# Metrics
duration: 6min
completed: 2026-03-31
---

# Phase 01 Plan 01: Project Scaffold, Zod Schemas, and Config Loader Summary

**TypeScript project scaffold with Zod v4 schemas for all data structures, init-on-first-use directory manager, and config loader providing zero-config defaults with user-override support**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-31T11:28:03Z
- **Completed:** 2026-03-31T11:34:08Z
- **Tasks:** 3
- **Files created:** 13

## Accomplishments
- Greenfield TypeScript project with Node 22, ESM, tsup build, and Vitest testing all working
- Four Zod v4 schemas: configSchema (with full defaults), log entry schemas (prompt/tool/permission/session), counterSchema, and hook input schema
- Init-on-first-use directory manager creating the complete ~/.harness-evolve/ tree (5 subdirectories)
- Config loader that creates default config.json when none exists and merges partial user overrides with defaults
- 9 unit tests covering schema validation, directory creation, and config file handling -- all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create project scaffold and build toolchain** - `5fc5dc4` (feat)
2. **Task 2: Create Zod schemas for config, log entries, counter, and hook input** - `56cbd16` (feat)
3. **Task 3: Create storage dirs module, config loader, and tests** - `7be3351` (feat)

## Files Created/Modified
- `package.json` - Project manifest with all dependencies (zod, write-file-atomic, proper-lockfile)
- `tsconfig.json` - TypeScript 6 config targeting ES2024 with strict mode
- `vitest.config.ts` - Vitest 4 test configuration
- `tsup.config.ts` - ESM bundler targeting node22
- `.gitignore` - Standard ignores including CLAUDE.md
- `src/index.ts` - Barrel export for all schemas and storage modules
- `src/schemas/config.ts` - Config schema with zero-config defaults (threshold=50, all captures enabled)
- `src/schemas/log-entry.ts` - JSONL entry schemas for prompts, tools, permissions, sessions
- `src/schemas/counter.ts` - Counter schema with session tracking
- `src/schemas/hook-input.ts` - Claude Code UserPromptSubmit hook input schema
- `src/storage/dirs.ts` - Directory paths and init-on-first-use creator
- `src/storage/config.ts` - Config loader with defaults merge and atomic write
- `tests/unit/config.test.ts` - 9 unit tests for schemas, dirs, and config loader

## Decisions Made
- **Zod v4 .default() with explicit values:** TypeScript 6 requires the default value to match the output type. `{}` is not assignable to an object with required fields. Used explicit default values like `{ threshold: 50, enabled: true }` instead.
- **ignoreDeprecations for TS6 + tsup:** tsup's DTS generation uses `baseUrl` internally, which is deprecated in TypeScript 6. Added `"ignoreDeprecations": "6.0"` to tsconfig.json to allow DTS builds.
- **passWithNoTests in vitest config:** Vitest exits with code 1 when no test files exist. Added `passWithNoTests: true` so the scaffold verifies clean before tests are written.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tsup DTS build failing with TypeScript 6 baseUrl deprecation**
- **Found during:** Task 1 (project scaffold)
- **Issue:** `npx tsup` failed with TS5101 "Option 'baseUrl' is deprecated" because tsup internally sets baseUrl for DTS generation
- **Fix:** Added `"ignoreDeprecations": "6.0"` to tsconfig.json compilerOptions
- **Files modified:** tsconfig.json
- **Verification:** `npx tsup` produces dist/index.js and dist/index.d.ts successfully
- **Committed in:** 5fc5dc4

**2. [Rule 1 - Bug] Zod v4 .default({}) incompatible with TypeScript 6 strict typing**
- **Found during:** Task 2 (Zod schemas)
- **Issue:** `z.object({...}).default({})` caused TS2769 because `{}` doesn't match the inferred output type with all required fields
- **Fix:** Provided explicit default values matching the output type for each nested object default
- **Files modified:** src/schemas/config.ts
- **Verification:** `npx tsc --noEmit` exits 0, configSchema.parse({}) produces full defaults
- **Committed in:** 56cbd16

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes are TypeScript 6 compatibility issues. No scope creep. Schema behavior matches plan specification exactly.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Zod schemas in place for 01-02 (secret scrubber and JSONL logger)
- Storage dirs module ready for 01-03 (atomic counter)
- Config loader ready for any module needing user configuration
- Build toolchain (tsc, vitest, tsup) all verified working

## Self-Check: PASSED

- All 13 created files verified present
- All 3 task commits verified in git log (5fc5dc4, 56cbd16, 7be3351)
- SUMMARY.md verified present

---
*Phase: 01-foundation-storage*
*Completed: 2026-03-31*
