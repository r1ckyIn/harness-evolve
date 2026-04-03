# Project Research Summary

**Project:** harness-evolve
**Domain:** npm distribution, CI/CD, and production readiness for a Claude Code hook-based TypeScript CLI tool
**Researched:** 2026-04-02
**Confidence:** HIGH

## Executive Summary

harness-evolve v1.0 shipped a fully functional self-iteration engine (8 classifiers, dual-channel delivery, auto-apply, outcome tracking, 336 tests). v1.1 is a stabilization milestone that transforms this developer-only codebase into an installable, CI-gated npm package. The work breaks cleanly into four domains: (1) fix two known tech debt items that break the feedback loop and CI reliability, (2) set up GitHub Actions CI/CD with npm OIDC trusted publishing, (3) build a Commander.js CLI so users can run `npx harness-evolve init` to register hooks, and (4) optionally expand auto-apply beyond permissions. No new analysis features; no new classifiers.

The recommended approach is to fix tech debt first (string mismatch in `inferPatternType` and flaky concurrent-counter test), then stand up CI as a quality gate, then build the CLI and npm publish configuration together, and finally expand auto-apply if time allows. This order is dictated by hard dependencies: CI cannot gate reliably with known flaky tests, the CLI depends on correct package.json metadata, and auto-apply expansion depends on the shared `PatternType` enum created by the string mismatch fix.

The dominant risk is **hook path resolution after npm install** (Pitfall #16). When users install via npm/npx, the `dist/hooks/*.js` paths that work in development no longer resolve. The `init` command must dynamically resolve absolute paths via `import.meta.url`. If this fails, the product silently does nothing -- no errors, no feedback, just a "broken" tool. Secondary risks are settings.json corruption during `init` (Pitfall #22) and `exports` field type-order mistakes breaking TypeScript consumers (Pitfall #19). All three are preventable with specific CI validation steps (publint, attw, smoke-test the packed artifact).

## Key Findings

### Recommended Stack

v1.1 adds minimal new dependencies to the validated v1.0 stack. The only new runtime dependency is Commander.js v14 (already in the approved stack, just not installed). Three dev dependencies are added for publish validation: publint, @arethetypeswrong/cli, and @commander-js/extra-typings. CI/CD is pure YAML configuration with no npm dependencies.

**Core additions:**
- **Commander.js ^14.0.3**: CLI argument parsing for `harness-evolve init/status/config` -- already validated in v1.0 stack research, decade of stability
- **publint ^0.3.x**: Pre-publish validation of package.json exports/types fields -- catches misconfigured exports before they reach users
- **@arethetypeswrong/cli ^0.18.x**: Validates TypeScript types resolve correctly for consumers under different `moduleResolution` settings
- **GitHub Actions (checkout@v4 + setup-node@v4)**: Standard CI toolchain; v4 is the battle-tested stable channel

**Key decisions:**
- ESM-only publish (no CJS dual-publish) -- project targets Node 22+, all consumers are ESM
- npm OIDC trusted publishing over long-lived NPM_TOKEN -- more secure, no secrets to rotate
- Manual tag-based releases over semantic-release -- appropriate for v1.x release cadence
- No `np`, `changesets`, `husky`, or `lint-staged` -- each would duplicate existing functionality

### Expected Features

**Must have (table stakes -- blocks release):**
- T1: npm-publishable package.json (exports, files, bin, metadata)
- T2: CLI entry point with shebang and bin field
- T3: `harness-evolve init` command for hook registration
- T4: GitHub Actions CI pipeline (build + test + typecheck)
- T5: Fix inferPatternType string mismatch (7/8 classifiers' feedback loop broken)
- T6: Fix flaky concurrent-counter test (CI will false-fail)
- T7: `files` field to prevent publishing source/planning docs

**Should have (differentiators -- high value, low risk):**
- D1: `npx harness-evolve init` zero-install setup (free with T2+T3)
- D4: Automated npm publish on tag push via OIDC
- D7: README with badges and install documentation

**Defer (v1.2+):**
- D5: `harness-evolve status` command -- useful but not blocking
- D6: `harness-evolve uninstall` command -- trust-building but not urgent
- D3: Expanded auto-apply beyond permissions -- valuable but needs careful design; limit to RULE create-only if included
- D2: Plugin-format distribution (.claude-plugin/) -- future-proofing, not v1.1 critical

### Architecture Approach

v1.1 extends the existing clean layered architecture with a new `src/cli/` module and a new `src/delivery/appliers/` strategy pattern. The CLI is a separate tsup entry point (`src/cli.ts` with shebang) that does NOT cross-import with hook entry points. The init command reuses existing `storage/` and `schemas/` modules. Auto-apply expansion uses a strategy pattern with per-target appliers that share a common interface (backup, apply, idempotency check).

**Major new components:**
1. **CLI entry (`src/cli.ts` + `src/cli/`)** -- Commander.js subcommands for init, status, config; new tsup entry producing `dist/cli.js`
2. **Applier registry (`src/delivery/appliers/`)** -- Strategy pattern replacing inline pattern_type check in auto-apply.ts; settings-applier (extracted), rule-applier (new)
3. **Pattern types enum (`src/schemas/pattern-types.ts`)** -- Shared Zod enum for all 8 classifier pattern_type values; eliminates string constant drift
4. **CI/CD workflows (`.github/workflows/`)** -- ci.yml (push/PR gate) and publish.yml (tag-triggered npm publish with OIDC)

### Critical Pitfalls

1. **#16 Hook paths break after npm install** -- `init` must resolve absolute paths dynamically via `import.meta.url`; test the full install-to-hook-invocation chain with `npm pack` -> install -> init -> verify hooks fire
2. **#22 settings.json corruption** -- Backup before every write; reject JSONC gracefully; re-read and validate after write; use write-file-atomic
3. **#17 Missing `files` field ships source/planning to npm** -- Add `"files": ["dist", "LICENSE", "README.md"]` as the very first npm publish task; validate with `npm pack --dry-run` and publint
4. **#18 Auto-apply expansion corrupts user configs** -- Limit v1.1 to RULE create-only (zero corruption risk); strategy pattern with per-target appliers; mandatory backup + dry-run mode
5. **#20 OIDC publish silently fails** -- `repository.url` must match exactly; never set empty `NODE_AUTH_TOKEN`; explicit `id-token: write` permission

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Tech Debt Fixes
**Rationale:** These two bugs block CI reliability and the feedback loop. Fixing them first eliminates noise in all subsequent development.
**Delivers:** Working outcome tracking for all 8 classifiers; deterministic test suite.
**Addresses:** T5 (inferPatternType fix), T6 (flaky test fix)
**Avoids:** Pitfall #24 (outcome history compatibility -- low risk, old data was unreachable), Pitfall #23 (module-level paths evaluation in tests)
**Estimated scope:** ~3 files changed, ~50 LOC. New `src/schemas/pattern-types.ts` shared enum.

### Phase 2: npm Package & CI/CD Pipeline
**Rationale:** CI must exist before building user-facing features so it gates quality. Package metadata is prerequisite for both CI publish validation and CLI bin entry.
**Delivers:** Complete package.json with exports/files/bin/metadata; GitHub Actions ci.yml and publish.yml; publint + attw validation in CI; prepublishOnly safety net.
**Addresses:** T1 (package.json metadata), T4 (CI/CD pipeline), T7 (files field), D4 (automated publish)
**Avoids:** Pitfall #17 (missing files field), Pitfall #19 (exports type order), Pitfall #20 (OIDC failure), Pitfall #25 (prepare vs prepublishOnly), Pitfall #27 (bin vs exports confusion), Pitfall #30 (Node version drift)

### Phase 3: CLI Commands & Install Experience
**Rationale:** The CLI is the entire user-facing value of v1.1. It depends on Phase 2 (correct bin entry, CI validation) and Phase 1 (shared pattern types for potential future use).
**Delivers:** `harness-evolve init` command with dynamic path resolution; `npx harness-evolve init` zero-install; optional `status` and `uninstall` subcommands; README with badges.
**Addresses:** T2 (CLI bin entry), T3 (init command), D1 (npx zero-install), D5 (status, optional), D6 (uninstall, optional), D7 (README)
**Avoids:** Pitfall #16 (hook path resolution), Pitfall #21 (shebang stripped), Pitfall #22 (settings.json corruption), Pitfall #28 (Commander leaks into hooks)

### Phase 4: Auto-Apply Expansion (Optional)
**Rationale:** This is the highest-risk feature in v1.1. It should come last so all other table stakes are shippable even if this phase is deferred. Limit scope to RULE create-only applier.
**Delivers:** Strategy pattern applier registry; settings-applier (extracted from existing code); rule-applier (create new .claude/rules/*.md files); config gate `autoApplyTargets`.
**Addresses:** D3 (expanded auto-apply -- RULE target only)
**Avoids:** Pitfall #18 (config corruption -- create-only eliminates modification risk)

### Phase Ordering Rationale

- **Phase 1 before Phase 2:** CI must not be blocked by flaky tests or known bugs. The flaky concurrent-counter test will cause CI noise; the inferPatternType fix introduces the shared PatternType enum that Phase 4 uses.
- **Phase 2 before Phase 3:** CI validates CLI implementation as it's built. The bin field and exports map from Phase 2 are prerequisites for CLI functionality.
- **Phase 3 before Phase 4:** Phase 3 is the primary deliverable. Phase 4 is optional and refactors the delivery module -- shipping it after the CLI is stable reduces risk.
- **Phase 4 is optional:** All table stakes (T1-T7) and high-value differentiators (D1, D4, D7) are delivered by Phases 1-3. Phase 4 is valuable but can be deferred to v1.2 without blocking the release.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (CLI + Install):** The `init` command's dynamic path resolution across installation methods (global, local, npx, git clone) is the riskiest implementation detail. Needs a manual verification checklist: `npm pack` -> install -> init -> verify hooks fire. No automated test can fully cover this.
- **Phase 4 (Auto-Apply Expansion):** The strategy pattern applier interface and create-only constraint for RULE target need careful design to ensure forward compatibility with future targets (HOOK, MEMORY, CLAUDE_MD).

Phases with standard patterns (skip research-phase):
- **Phase 1 (Tech Debt):** Simple string constant alignment and test timing fix. Well-understood problems with clear solutions from v1.0 audit.
- **Phase 2 (npm + CI/CD):** Extremely well-documented patterns. GitHub Actions ci.yml, package.json exports, OIDC publish -- all have official docs and multiple verified guides.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Minimal additions to validated v1.0 stack. Commander.js already approved. publint/attw are dev-only validators with low risk. All sources are official docs or verified ecosystem guides. |
| Features | HIGH | Feature set derived from v1.0 audit findings and npm ecosystem standards. No speculative features. Clear dependency graph with validated critical path. |
| Architecture | HIGH | CLI integration follows established Commander.js subcommand patterns. Applier strategy pattern is textbook OOP. All new components are additive -- no risky refactors to core modules. |
| Pitfalls | HIGH | 15 new pitfalls (16-30) identified with specific prevention strategies. Top 5 critical pitfalls all have CI-enforceable mitigations. Source quality high -- combination of official docs, known tool issues, and direct codebase analysis. |

**Overall confidence:** HIGH

### Gaps to Address

- **Plugin format (D2) timing:** Claude Code plugin system is in public beta. The research identifies it as the future distribution path but recommends deferring to v1.2+. If the plugin system stabilizes during v1.1 development, revisit this decision.
- **Cross-platform path resolution:** The `init` command uses `import.meta.url` for path resolution. This is tested on macOS (development) and Ubuntu (CI). Windows behavior is not validated -- low priority since Claude Code's primary audience is macOS/Linux, but worth noting.
- **Auto-apply dry-run mode:** Pitfall #18 recommends "dry-run as first-class feature before any new target type ships." The architecture research does not detail the dry-run UX. This needs design during Phase 4 planning.
- **Concurrent Claude Code instances:** Multiple Claude Code sessions running simultaneously could race on `init` writing to settings.json. write-file-atomic handles the atomic write, but there is no lock. Low probability, low severity -- document as known limitation.

## Sources

### Primary (HIGH confidence)
- [npm Trusted Publishing Docs](https://docs.npmjs.com/trusted-publishers/) -- OIDC setup, GA since July 2025
- [npm package.json docs](https://docs.npmjs.com/files/package.json/) -- files, bin, exports fields
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Hook events, handler types, settings.json format
- [Claude Code Plugins](https://code.claude.com/docs/en/plugins) -- Plugin structure, manifest, hooks.json format
- [tsup Documentation](https://tsup.egoist.dev/) -- Shebang handling, multi-entry builds
- [Commander.js](https://github.com/tj/commander.js) -- CLI framework, subcommands
- [Vitest 4.0](https://vitest.dev/blog/vitest-4) -- Test runner configuration
- [publint](https://publint.dev/docs/) -- Package.json validation
- [Are The Types Wrong](https://arethetypeswrong.github.io/) -- TypeScript type resolution validator
- [GitHub Actions setup-node](https://github.com/actions/setup-node) -- CI Node.js setup

### Secondary (MEDIUM confidence)
- [Publishing ESM-based npm packages with TypeScript](https://2ality.com/2025/02/typescript-esm-packages.html) -- ESM-only patterns
- [Things you need to do for npm trusted publishing](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/) -- Practical OIDC setup
- [Create a Modern npm Package in 2026](https://jsmanifest.com/create-modern-npm-package-2026) -- Package structure guide
- [Building CLI apps with TypeScript in 2026](https://hackers.pub/@hongminhee/2026/typescript-cli-2026) -- Ecosystem overview
- [Guide to package.json exports field](https://hirok.io/posts/package-json-exports) -- Comprehensive exports guide
- [CCharness](https://github.com/elct9620/ccharness) -- npx-based CLI pattern reference
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code) -- Ecosystem overview

### Project Codebase (HIGH confidence)
- `src/storage/dirs.ts` -- module-level path evaluation pattern
- `src/delivery/auto-apply.ts` -- current v1 scope restriction
- `tests/integration/concurrent-counter.test.ts` -- flaky test mechanism
- `tsup.config.ts` -- current 8 entry points, ESM-only output
- `package.json` -- missing fields inventory
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` -- known tech debt

---
*Research completed: 2026-04-02*
*Ready for roadmap: yes*
