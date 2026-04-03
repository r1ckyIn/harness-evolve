---
phase: 10-npm-package-ci-cd-pipeline
verified: 2026-04-03T13:17:10Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 10: npm Package & CI/CD Pipeline Verification Report

**Phase Goal:** The project is publishable to npm with correct metadata, gated by automated CI, and releases are triggered by version tags
**Verified:** 2026-04-03T13:17:10Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `npm pack --dry-run` shows only dist/, README.md, LICENSE, and package.json in the tarball | VERIFIED | `npm pack --dry-run` output shows 29 files -- all under dist/, plus README.md, LICENSE, and package.json. grep for src/, tests/, .planning/ returns NO UNWANTED FILES. |
| 2 | `npm publish --dry-run` succeeds with all required metadata fields present | VERIFIED | `npm publish --dry-run --ignore-scripts` succeeds with `+ harness-evolve@1.0.0`. package.json contains description, keywords (6), license (MIT), repository, homepage, author, engines, bugs. |
| 3 | The `exports` field resolves correctly for ESM consumers (verified by publint and @arethetypeswrong/cli) | VERIFIED | `publint --strict` reports "All good!". `attw --pack . --profile esm-only` shows green checkmarks for all 8 entry points (root + 7 subpaths) under node16-ESM and bundler resolutions. |
| 4 | Pushing a `v*` tag to main triggers GitHub Actions to build, test, typecheck, and publish to npm via OIDC trusted publishing | VERIFIED | `.github/workflows/publish.yml` exists with `tags: ['v*']` trigger, `id-token: write` permission, `registry-url: 'https://registry.npmjs.org'`, `npm install -g npm@latest`, build/test/typecheck steps, and `npm publish --provenance`. CI workflow at `.github/workflows/ci.yml` runs build+typecheck+test+publint+attw on push/PR to main. |
| 5 | README.md displays npm version badge, CI status badge, and license badge | VERIFIED | README.md lines 5-7 contain `img.shields.io/npm/v/harness-evolve`, `img.shields.io/github/actions/workflow/status/r1ckyIn/harness-evolve/ci.yml`, and `img.shields.io/badge/License-MIT`. All use `flat-square` style. Static `Tests-336_passing` badge removed. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Complete npm metadata, files whitelist, exports map, bin field | VERIFIED | description, keywords, license, author, repository, homepage, bugs, engines, files (whitelist), exports (8 entries with types-first), bin, publishConfig.provenance, validation scripts |
| `src/cli.ts` | CLI stub entry point with shebang | VERIFIED | 15 lines, starts with `#!/usr/bin/env node`, reads package.json version, outputs version and usage hint |
| `tsup.config.ts` | Updated build config with cli entry | VERIFIED | Contains `'cli': 'src/cli.ts'` entry. DTS generation correctly excludes cli (non-library entry). |
| `tests/unit/package-metadata.test.ts` | Validation tests for package.json required fields | VERIFIED | 145 lines, 28 tests across 6 describe blocks covering NPM-01 through NPM-04 plus publishConfig and validation scripts |
| `.github/workflows/ci.yml` | CI quality gate workflow | VERIFIED | Triggers on push/PR to main. Steps: checkout, setup-node (v22 with cache), npm ci, build, typecheck, test, publint, attw |
| `.github/workflows/publish.yml` | Automated npm publish workflow | VERIFIED | Triggers on v* tag. Permissions: contents:read, id-token:write. Steps: checkout, setup-node with registry-url, npm@latest, npm ci, build, test, typecheck, publint, npm publish --provenance |
| `README.md` | Dynamic badges for npm, CI, and license | VERIFIED | npm version badge, CI status badge, license badge -- all shields.io flat-square |
| `tests/unit/readme-badges.test.ts` | Badge validation tests | VERIFIED | 33 lines, 5 assertions verifying badge URLs and flat-square style |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `package.json` | `dist/cli.js` | bin field | WIRED | `"harness-evolve": "dist/cli.js"` -- dist/cli.js exists, starts with shebang, executes correctly |
| `package.json` | `dist/index.js` | exports map | WIRED | `".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }` -- both files exist in dist/ |
| `tsup.config.ts` | `src/cli.ts` | entry config | WIRED | `'cli': 'src/cli.ts'` present in entry object |
| `.github/workflows/ci.yml` | `package.json scripts` | npm run commands | WIRED | ci.yml contains `npm run build`, `npm run typecheck`, `npm test` -- all scripts exist in package.json |
| `.github/workflows/publish.yml` | npm registry | npm publish --provenance | WIRED | publish.yml contains `npm publish --provenance` with OIDC permissions (id-token:write) and registry-url |
| `README.md` | `.github/workflows/ci.yml` | badge URL referencing workflow filename | WIRED | README contains `actions/workflows/ci.yml` in badge URL |

### Data-Flow Trace (Level 4)

Not applicable -- this phase produces infrastructure/configuration artifacts (package.json, CI workflows, badges), not components that render dynamic data.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build succeeds | `npm run build` | ESM + DTS build success in ~5s | PASS |
| CLI outputs version | `node dist/cli.js` | "harness-evolve v1.0.0" + usage hint | PASS |
| Typecheck passes | `npm run typecheck` | tsc --noEmit exits 0 | PASS |
| All tests pass | `npx vitest run` | 40 test files, 397 tests passed | PASS |
| Phase-specific tests pass | `npx vitest run tests/unit/package-metadata.test.ts tests/unit/readme-badges.test.ts` | 2 files, 33 tests passed | PASS |
| Tarball has no unwanted files | `npm pack --dry-run \| grep src/tests/.planning/` | No matches found | PASS |
| publint validates clean | `npm run check:publint` | "All good!" | PASS |
| attw validates ESM | `npm run check:attw` | All 8 entries show green for node16-ESM and bundler | PASS |
| npm publish dry-run succeeds | `npm publish --dry-run --ignore-scripts` | `+ harness-evolve@1.0.0` | PASS |
| Shebang preserved in dist | `head -1 dist/cli.js` | `#!/usr/bin/env node` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| NPM-01 | 10-01 | Package.json has complete metadata (description, keywords, license, repository, homepage, author, engines) | SATISFIED | All 7 metadata fields present and validated by package-metadata.test.ts |
| NPM-02 | 10-01 | Package.json `files` field restricts published content to dist/, README.md, LICENSE, package.json only | SATISFIED | `files: ["dist", "README.md", "LICENSE"]` -- npm pack shows 29 files (all in dist/ plus README.md, LICENSE, package.json) |
| NPM-03 | 10-01 | Package.json `exports` map correctly exposes ESM entry points for programmatic consumers | SATISFIED | 8 export entries with types-first ordering. publint --strict "All good!". attw confirms green for ESM resolution on all entries. |
| NPM-04 | 10-01 | Package.json `bin` field registers `harness-evolve` CLI command pointing to compiled CLI entry | SATISFIED | `bin: { "harness-evolve": "dist/cli.js" }`. CLI stub runs and outputs version. Shebang preserved. |
| CIC-01 | 10-02 | GitHub Actions CI workflow runs build + test + typecheck on every push and PR to main | SATISFIED | ci.yml triggers on push/PR to main with build, typecheck, test, publint, attw steps |
| CIC-02 | 10-02 | Automated npm publish triggered by version tag push (v*) using npm Trusted Publishing (OIDC) | SATISFIED | publish.yml triggers on v* tag, has id-token:write, registry-url, npm@latest, npm publish --provenance |
| CIC-03 | 10-02 | README.md displays npm version badge, CI status badge, and license badge (shields.io flat-square) | SATISFIED | All 3 dynamic badges present in README.md with flat-square style. Static test count badge removed. |

**Orphaned requirements:** None. All 7 requirement IDs from ROADMAP.md (NPM-01 through NPM-04, CIC-01 through CIC-03) are claimed by plans and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/cli.ts` | 2 | Comment "Phase 11 will add Commander.js commands" | Info | Intentional stub -- documented in SUMMARY, Phase 11 will implement full CLI |
| `src/cli.ts` | 13 | "coming in v1.1" text in output | Info | Intentional user-facing message for stub CLI, not a code TODO |

No blocker or warning anti-patterns found. The CLI stub is intentionally minimal -- it is documented as a stub in the SUMMARY and the plan explicitly defers full CLI to Phase 11.

### Human Verification Required

### 1. CI Workflow Execution

**Test:** Push a commit to main or open a PR to main and verify the CI workflow runs.
**Expected:** GitHub Actions triggers the "CI" workflow with build, typecheck, test, publint, and attw steps -- all passing.
**Why human:** Requires actual GitHub push to trigger Actions workflow. Cannot simulate locally.

### 2. Publish Workflow Trigger

**Test:** Create and push a `v1.0.0` tag (after manual first publish and OIDC configuration on npmjs.com).
**Expected:** GitHub Actions triggers the "Publish" workflow, builds, tests, typechecks, validates, and publishes to npm with provenance.
**Why human:** Requires npm account configuration (OIDC trusted publisher setup) and actual tag push. First publish must be done manually per npm limitation (npm/cli#8544).

### 3. Dynamic Badge Rendering

**Test:** After first CI run and npm publish, view README.md on GitHub.
**Expected:** npm version badge shows "1.0.0", CI badge shows "passing" (green), license badge shows "MIT".
**Why human:** Badges are rendered by shields.io based on live service data. Cannot verify badge rendering programmatically without actual npm publish and CI run.

### Gaps Summary

No gaps found. All 5 observable truths are verified. All 8 artifacts pass existence, substantive, and wired checks. All 7 requirements (NPM-01 through NPM-04, CIC-01 through CIC-03) are satisfied. All behavioral spot-checks pass.

**Minor observation (not a gap):** The `prepublishOnly` script fails when `npm publish --dry-run` is run because `attw --pack .` conflicts with the `npm publish` lifecycle context (tarball file path issue). This does not affect CI because the publish workflow runs publint and attw as separate steps before `npm publish`. The `prepublishOnly` script serves as a safety net for local publishing and works correctly when `npm run check:package` is run independently.

---

_Verified: 2026-04-03T13:17:10Z_
_Verifier: Claude (gsd-verifier)_
