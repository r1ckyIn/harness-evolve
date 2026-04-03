# Technology Stack — v1.1 Additions

**Project:** harness-evolve
**Researched:** 2026-04-02
**Scope:** Stack additions for npm publish, CI/CD pipeline, and CLI entry point. Existing stack (TypeScript 6.0, Node.js 22, Zod v4, tsup 8.x, Vitest 4, proper-lockfile, write-file-atomic) is validated and NOT re-researched.

---

## New Stack Requirements

v1.1 adds three capabilities that need stack decisions:

1. **npm publish setup** — package.json metadata, `exports` field, `files` whitelist, `bin` entry
2. **CI/CD pipeline** — GitHub Actions workflows for build/test/typecheck + future publish
3. **CLI entry point** — `harness-evolve init` command for hook registration

---

## 1. npm Publish Configuration

### package.json Changes (No New Dependencies)

The current package.json needs structural changes, not new libraries.

| Field | Current | Needed | Why |
|-------|---------|--------|-----|
| `exports` | (missing) | Conditional exports map | Modern Node.js resolution. Replaces `main`/`types` as the authoritative entry point map. All supported Node.js versions (22+) use `exports` over `main`. |
| `files` | (missing) | `["dist", "bin"]` | Whitelist for npm publish. Prevents accidental inclusion of `src/`, `tests/`, `.planning/`, `CLAUDE.md`. Security and package size optimization. |
| `bin` | (missing) | `{"harness-evolve": "./dist/cli.js"}` | Enables `npx harness-evolve init` and global install `harness-evolve init`. Points to compiled ESM output. |
| `keywords` | (missing) | Array of discovery terms | npm search discoverability. |
| `description` | (missing) | One-line description | npm registry listing. |
| `repository` | (missing) | GitHub URL object | Links npm page to GitHub. Required for npm provenance. |
| `license` | (missing) | `"MIT"` | npm registry metadata. |
| `author` | (missing) | Author object | npm registry metadata. |

#### Recommended `exports` Field

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./hooks/*": {
      "types": "./dist/hooks/*.d.ts",
      "import": "./dist/hooks/*.js"
    }
  }
}
```

**Why ESM-only (no CJS dual-publish):** The project already uses `"type": "module"`. The target audience (Claude Code users) runs Node.js 22+. There is zero reason to support CommonJS. Dual-publish adds complexity, testing burden, and potential type resolution bugs for no benefit. ESM-only is the correct 2026 posture for a Node.js 22+ tool.

**Why `types` must come first:** TypeScript resolves the first matching condition. If `import` comes before `types`, TypeScript won't find declaration files. This is a well-documented gotcha.

#### Recommended `bin` Entry

```json
{
  "bin": {
    "harness-evolve": "./dist/cli.js"
  }
}
```

The CLI entry point (`src/cli.ts`) must start with `#!/usr/bin/env node` shebang. tsup preserves shebangs in output and auto-sets the executable bit, so no post-build `chmod` step is needed.

### Pre-Publish Validation Tools

| Tool | Version | Purpose | Integration |
|------|---------|---------|-------------|
| publint | ^0.3.x | Validate `exports`, `main`, `types` field correctness before publish | Dev dependency. Run as `npx publint` in CI and before `npm publish`. Catches misconfigured exports that would break consumers. |
| @arethetypeswrong/cli | ^0.18.x | Validate TypeScript types resolve correctly for all entry points | Dev dependency. Run as `npx attw --pack .` in CI. Catches the "types work locally but break for consumers" class of bugs. |

**Why both:** publint validates package.json structure. attw validates that TypeScript types actually resolve for consumers under different `moduleResolution` settings. They catch different classes of bugs. Both are fast (<2s), zero-config, and widely adopted.

**Why NOT `np` (publish helper):** np is an interactive terminal tool for release management. This project will use GitHub Actions for automated publishing (trusted publishing with OIDC). np's version bumping, git tagging, and GitHub release creation are all handled by the CI workflow. Adding np would create two competing release mechanisms.

**Why NOT `semantic-release` / `release-it`:** Overkill for a v1.x project. These tools shine for projects with frequent releases and complex changelogs. harness-evolve releases will be manual (git tag -> CI publish) for now. Revisit when release cadence warrants automation.

---

## 2. CI/CD Pipeline (GitHub Actions)

### No New npm Dependencies Required

GitHub Actions configuration is YAML-only. No new packages needed.

### Actions to Use

| Action | Version | Purpose | Why This Version |
|--------|---------|---------|------------------|
| `actions/checkout` | `v4` | Clone repo | Stable, current major. |
| `actions/setup-node` | `v4` | Install Node.js 22, configure npm cache | v4 is the widely tested stable version. v5 introduced automatic caching (when `packageManager` field is set in package.json) but this project doesn't use corepack/packageManager field. v6 requires runner v2.327.1+ and upgrades to node24 runtime. Stick with v4 for maximum runner compatibility. |

**Why `actions/setup-node@v4` over v5/v6:** v5 auto-caches based on `packageManager` field in package.json, which this project doesn't set. v6 requires newer runners and upgrades the action runtime to node24 — unnecessary complexity for a simple CI pipeline. v4 with explicit `cache: 'npm'` is battle-tested and sufficient.

### Recommended Workflow Structure

**File: `.github/workflows/ci.yml`** — Runs on every push and PR.

Three jobs, each independent (parallel execution):

| Job | Steps | Why Separate |
|-----|-------|--------------|
| `typecheck` | `npm ci` -> `tsc --noEmit` | Fast feedback on type errors. Fails independently. |
| `test` | `npm ci` -> `vitest run` | Test suite. Fails independently from typecheck. |
| `build` | `npm ci` -> `tsup` -> `publint` -> `attw --pack .` | Validates the published artifact is correct. |

**Why parallel jobs, not sequential steps:** Each job gets a clean environment (no state leakage) and runs simultaneously. A typecheck failure shouldn't block test results — developers need both signals. Total CI time is max(typecheck, test, build) instead of sum.

**Why `npm ci` not `npm install`:** `npm ci` is deterministic (uses lockfile exactly), faster (skips resolution), and fails if lockfile is out of sync. Standard CI practice.

### Future: Publish Workflow

**File: `.github/workflows/publish.yml`** — Runs on version tag push (`v*`).

| Concern | Approach | Why |
|---------|----------|-----|
| Authentication | npm Trusted Publishing (OIDC) | No long-lived npm tokens. GitHub Actions generates short-lived, cryptographically-signed tokens via OIDC. Generally available since July 2025. More secure than `NPM_TOKEN` secret. |
| Provenance | Automatic with Trusted Publishing | When publishing via OIDC, `npm publish` automatically generates SLSA provenance attestations. No `--provenance` flag needed. |
| Trigger | `on: push: tags: ['v*']` | Manual version control. Developer bumps version, creates tag, pushes. CI handles the rest. |
| Permissions | `id-token: write`, `contents: read` | OIDC token generation requires explicit `id-token: write` permission. |

**Why Trusted Publishing over npm tokens:** npm deprecated classic tokens. Granular tokens work but require manual rotation. OIDC tokens are short-lived, workflow-scoped, and cannot be exfiltrated. This is the npm-recommended approach for 2026.

**Why NOT automated version bumping (semantic-release):** Premature for v1.x. The release cadence doesn't justify the setup complexity. Manual `npm version [patch|minor|major]` + `git tag` + `git push --tags` is transparent and simple.

**Important configuration note:** The `repository.url` in package.json MUST match the GitHub repository URL exactly for Trusted Publishing to work. Also, do NOT set `NODE_AUTH_TOKEN` to empty string — it prevents OIDC from working because npm attempts to use the empty token instead of OIDC.

---

## 3. CLI Entry Point

### Commander.js (Already in Stack)

Commander.js v14 is already in the validated stack. No version change needed. However, it is currently listed as a dependency but NOT actually installed or used in the codebase.

| Package | Status | Action |
|---------|--------|--------|
| `commander` | In CLAUDE.md stack, NOT in package.json | Add to `dependencies` |
| `@commander-js/extra-typings` | In CLAUDE.md stack, NOT in package.json | Add to `devDependencies` |

**Why `commander` in `dependencies` (not devDependencies):** The CLI binary ships in the published package. Commander is a runtime dependency for the `harness-evolve init` command.

**Why `@commander-js/extra-typings` in `devDependencies`:** Provides generic type inference during development only. Zero runtime cost — it's purely TypeScript-level.

### CLI Architecture

The CLI entry point (`src/cli.ts`) will be a new tsup entry point:

```typescript
// src/cli.ts
#!/usr/bin/env node
import { program } from 'commander';
// ...subcommands
```

**tsup.config.ts addition:**

```typescript
entry: {
  // ...existing entries
  'cli': 'src/cli.ts',
}
```

### `harness-evolve init` Command Design

The `init` command needs to:
1. Read `~/.claude/settings.json` (or project-level `.claude/settings.json`)
2. Inject hook registrations into the `hooks` object
3. Write back atomically (using existing `write-file-atomic`)

**No new dependencies needed.** The command uses:
- `commander` for argument parsing (adding to deps)
- `node:fs/promises` for reading settings.json
- `write-file-atomic` (already a dependency) for safe writes
- `zod` (already a dependency) for settings.json validation

---

## Complete New Dependencies Summary

### Production Dependencies to ADD

| Package | Version | Why |
|---------|---------|-----|
| `commander` | `^14.0.3` | CLI argument parsing for `harness-evolve init`. Already in validated stack, just not installed. |

### Dev Dependencies to ADD

| Package | Version | Why |
|---------|---------|-----|
| `@commander-js/extra-typings` | `^14.0.0` | TypeScript type inference for Commander options/actions. Dev-only, zero runtime cost. |
| `publint` | `^0.3.18` | Pre-publish validation of package.json exports/types fields. Run in CI. |
| `@arethetypeswrong/cli` | `^0.18.2` | Validate TypeScript types resolve correctly for consumers. Run in CI. |

### Dependencies NOT to Add

| Package | Why Not |
|---------|---------|
| `np` | CI handles publishing. Interactive tool conflicts with automated workflow. |
| `semantic-release` | Overkill for v1.x. Manual versioning is transparent and sufficient. |
| `release-it` | Same as semantic-release. Revisit at v2.0+ if release cadence increases. |
| `changesets` | Designed for monorepos with multiple packages. Single package, not needed. |
| `husky` / `lint-staged` | Claude Code hooks already handle pre-commit verification. Adding git hooks tooling creates duplication. |
| Any GitHub Actions npm package | Workflows are YAML config, not code dependencies. |

### Installation Commands

```bash
# Production dependency
npm install commander@^14.0.3

# Dev dependencies
npm install -D @commander-js/extra-typings@^14.0.0 publint @arethetypeswrong/cli
```

---

## tsup.config.ts Changes

Current config produces 8 entry points. Add one:

| Entry | Source | Purpose |
|-------|--------|---------|
| `cli` | `src/cli.ts` | CLI binary entry point for `harness-evolve init` |

The shebang (`#!/usr/bin/env node`) in `src/cli.ts` will be preserved by tsup in the output. tsup also auto-sets the executable bit on files with shebangs.

---

## package.json Target State

Key structural changes (not a complete file, showing additions/changes only):

```json
{
  "name": "harness-evolve",
  "version": "1.1.0",
  "description": "Self-iteration engine for Claude Code — observes patterns, recommends optimizations",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "bin": {
    "harness-evolve": "./dist/cli.js"
  },
  "files": [
    "dist"
  ],
  "keywords": [
    "claude-code", "hooks", "self-improving", "harness",
    "optimization", "pattern-detection", "cli"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/r1ckyIn/harness-evolve.git"
  },
  "license": "MIT",
  "author": {
    "name": "Ricky",
    "email": "rickyqin919@gmail.com",
    "url": "https://github.com/r1ckyIn"
  }
}
```

---

## Integration Points

### How New Stack Connects to Existing

| New Component | Integrates With | How |
|---------------|-----------------|-----|
| `commander` CLI | `storage/config.ts` | `init` command reads/writes settings.json via existing config patterns |
| `commander` CLI | `storage/dirs.ts` | Uses `paths` and `ensureInit()` for directory setup |
| `commander` CLI | `write-file-atomic` | Atomic writes to settings.json during `init` |
| `publint` | `tsup` build output | Validates the `dist/` artifact after build |
| `attw` | `tsup` build output + `package.json` | Validates types resolve for consumers |
| GitHub Actions | `package.json` scripts | Runs existing `build`, `test`, `typecheck` scripts |
| npm Trusted Publishing | `package.json` `repository` field | URL must match GitHub repo for OIDC validation |

### What Does NOT Change

| Component | Reason |
|-----------|--------|
| Zod schemas | No new schemas needed for CLI. Settings.json validation uses existing Zod patterns. |
| Vitest config | No changes. Existing test infrastructure handles CLI tests. |
| tsconfig.json | No changes. CLI code follows same TS config. |
| Storage layer | No changes. CLI reuses existing `storage/` module. |
| Hook handlers | No changes. Already compiled and working. |

---

## Confidence Assessment

| Decision | Confidence | Basis |
|----------|------------|-------|
| ESM-only publish (no CJS) | HIGH | Project is `"type": "module"`, targets Node 22+, no CJS consumers exist |
| `exports` field structure | HIGH | Official Node.js docs, npm docs, multiple 2026 guides agree |
| `actions/setup-node@v4` | HIGH | Widely tested, v4 README still current, explicit cache config |
| npm Trusted Publishing (OIDC) | HIGH | npm official docs, GA since July 2025, multiple implementation guides |
| Commander.js v14 | HIGH | Already validated in v1.0 stack research, just needs installation |
| publint + attw as CI validators | MEDIUM | Widely recommended in 2026 guides, but both pre-1.0 (publint 0.3.x, attw 0.18.x). Low risk since they're dev-only validation tools. |
| No semantic-release | HIGH | Project complexity doesn't warrant it. Manual tagging is transparent. |

---

## Sources

- [publint Documentation](https://publint.dev/docs/) -- Package.json validation tool (HIGH confidence)
- [Are The Types Wrong](https://arethetypeswrong.github.io/) -- TypeScript type resolution validator (HIGH confidence)
- [npm Trusted Publishing Docs](https://docs.npmjs.com/trusted-publishers/) -- Official OIDC publishing guide (HIGH confidence)
- [npm Trusted Publishing GA Announcement](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/) -- OIDC GA (HIGH confidence)
- [Things you need to do for npm trusted publishing to work](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/) -- Practical setup guide (MEDIUM confidence)
- [Tutorial: publishing ESM-based npm packages with TypeScript](https://2ality.com/2025/02/typescript-esm-packages.html) -- Dr. Axel Rauschmayer's guide (HIGH confidence)
- [Guide to package.json exports field](https://hirok.io/posts/package-json-exports) -- Comprehensive exports guide (MEDIUM confidence)
- [actions/setup-node GitHub](https://github.com/actions/setup-node) -- Official action docs (HIGH confidence)
- [Commander.js](https://github.com/tj/commander.js) -- CLI framework (HIGH confidence)
- [Building CLI apps with TypeScript in 2026](https://hackers.pub/@hongminhee/2026/typescript-cli-2026) -- Ecosystem overview (MEDIUM confidence)
- [np - A better npm publish](https://github.com/sindresorhus/np) -- Considered, not adopted (MEDIUM confidence)
- [Create a Modern npm Package in 2026](https://jsmanifest.com/create-modern-npm-package-2026/) -- Package structure guide (MEDIUM confidence)
