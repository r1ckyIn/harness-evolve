# Phase 10: npm Package & CI/CD Pipeline - Research

**Researched:** 2026-04-03
**Domain:** npm packaging, GitHub Actions CI/CD, ESM package validation
**Confidence:** HIGH

## Summary

This phase makes harness-evolve publishable to npm with correct metadata, validates ESM exports with publint and @arethetypeswrong/cli, sets up GitHub Actions for CI quality gates, and configures automated npm publishing via OIDC trusted publishing on version tag push.

The current package.json is minimal -- it lacks `files`, `exports`, `bin`, `description`, `keywords`, `repository`, `homepage`, and `author` fields. The `npm pack --dry-run` currently produces a 548KB tarball with 211 files including all of `.planning/`, tests, and source code. The target is a lean tarball containing only `dist/`, `README.md`, `LICENSE`, and `package.json`.

Critical discovery: npm OIDC trusted publishing requires the package to exist on npm before OIDC can be configured. The first publish must be done manually with `npm publish` (user logged in via `npm login`). Subsequent publishes can use OIDC from GitHub Actions. This is a documented limitation (npm/cli#8544) with no current workaround for brand-new packages.

**Primary recommendation:** Use the `files` field whitelist approach (not `.npmignore`), add a comprehensive `exports` map with `types` conditions first, create a minimal CLI stub for the `bin` field, and validate with `publint --strict` + `attw --pack . --profile esm-only` before every publish.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NPM-01 | Package.json has complete metadata (description, keywords, license, repository, homepage, author, engines) | Standard npm metadata fields documented; all values known from PROJECT.md |
| NPM-02 | Package.json `files` field restricts published content to dist/, README.md, LICENSE, package.json only | `files` whitelist approach is best practice; current tarball has 211 files, needs reduction to ~30 |
| NPM-03 | Package.json `exports` map correctly exposes ESM entry points for programmatic consumers | exports map with `types` condition first, `.js` extensions (type:module), 8 subpath exports matching tsup entries |
| NPM-04 | Package.json `bin` field registers `harness-evolve` CLI command pointing to compiled CLI entry | Stub CLI entry with shebang needed; Phase 11 will implement full Commander.js CLI |
| CIC-01 | GitHub Actions CI workflow runs build + test + typecheck on every push and PR to main | Standard workflow with actions/checkout + setup-node + npm ci + build + test + typecheck |
| CIC-02 | Automated npm publish triggered by version tag push (v*) using npm Trusted Publishing (OIDC) | Requires npm CLI >=11.5.1, id-token:write permission, manual first publish, then OIDC for subsequent |
| CIC-03 | README.md displays npm version badge, CI status badge, and license badge (shields.io flat-square) | shields.io dynamic badges for npm version + GitHub Actions status; license badge already exists |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| tsup | ^8.5.1 | Build TypeScript to ESM JS | Already configured with 8 entry points; produces dist/ with .js + .d.ts |
| Vitest | ^4.1.2 | Testing framework | Already has 38 test files, 364+ tests |
| TypeScript | ~6.0.0 | Type checking | Already configured with strict mode |

### New Dev Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| publint | ^0.3.18 | Validate package.json exports, main, types fields | Run in CI and as npm script before publish |
| @arethetypeswrong/cli | ^0.18.2 | Validate TypeScript type resolution for ESM consumers | Run in CI and as npm script before publish |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| publint + attw | Manual testing with `node -e "import('harness-evolve')"` | No automation, misses edge cases |
| `files` field | `.npmignore` | Blacklist approach is error-prone; whitelist (`files`) is safer |
| GitHub Actions | GitLab CI | Project is on GitHub; Actions is native |
| npm OIDC trusted publishing | npm automation token in secrets | Less secure, token management burden |

**Installation:**
```bash
npm install -D publint @arethetypeswrong/cli
```

**Version verification:** publint 0.3.18 and @arethetypeswrong/cli 0.18.2 are the current latest versions verified against npm registry on 2026-04-03.

## Architecture Patterns

### Recommended Package.json Structure

The following fields need to be added or modified in `package.json`:

```jsonc
{
  "name": "harness-evolve",
  "version": "1.0.0",
  "type": "module",
  "description": "Self-iteration engine for Claude Code — detects usage patterns and routes optimization recommendations",
  "keywords": ["claude-code", "hooks", "self-improvement", "automation", "developer-tools", "ai"],
  "license": "MIT",
  "author": "Ricky <rickyqin919@gmail.com> (https://github.com/r1ckyIn)",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/r1ckyIn/harness-evolve.git"
  },
  "homepage": "https://github.com/r1ckyIn/harness-evolve#readme",
  "bugs": {
    "url": "https://github.com/r1ckyIn/harness-evolve/issues"
  },
  "engines": {
    "node": ">=22.14.0"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    },
    "./hooks/user-prompt-submit": {
      "types": "./dist/hooks/user-prompt-submit.d.ts",
      "default": "./dist/hooks/user-prompt-submit.js"
    },
    "./hooks/pre-tool-use": {
      "types": "./dist/hooks/pre-tool-use.d.ts",
      "default": "./dist/hooks/pre-tool-use.js"
    },
    "./hooks/post-tool-use": {
      "types": "./dist/hooks/post-tool-use.d.ts",
      "default": "./dist/hooks/post-tool-use.js"
    },
    "./hooks/post-tool-use-failure": {
      "types": "./dist/hooks/post-tool-use-failure.d.ts",
      "default": "./dist/hooks/post-tool-use-failure.js"
    },
    "./hooks/permission-request": {
      "types": "./dist/hooks/permission-request.d.ts",
      "default": "./dist/hooks/permission-request.js"
    },
    "./hooks/stop": {
      "types": "./dist/hooks/stop.d.ts",
      "default": "./dist/hooks/stop.js"
    },
    "./delivery/run-evolve": {
      "types": "./dist/delivery/run-evolve.d.ts",
      "default": "./dist/delivery/run-evolve.js"
    }
  },
  "bin": {
    "harness-evolve": "dist/cli.js"
  },
  "publishConfig": {
    "provenance": true
  }
}
```

### Pattern 1: `files` Whitelist for Tarball Control

**What:** The `files` field in package.json acts as a whitelist. Only listed entries end up in the published tarball. `package.json`, `README.md`, and `LICENSE` are always included automatically by npm.
**When to use:** Always -- this is the standard approach for production packages.
**Key detail:** `"files": ["dist"]` includes the entire `dist/` directory. Since `package.json`, `README.md`, and `LICENSE` are auto-included, they don't technically need to be listed, but listing them makes the intent explicit.

### Pattern 2: `exports` Map with `types` First

**What:** The `exports` field defines the public API surface. With `"type": "module"`, `.js` files are ESM. The `types` condition MUST come before `default` for TypeScript resolution to work.
**When to use:** Every ESM package with TypeScript declarations.
**Key detail:** Once `exports` is defined, it acts as a black box -- no subpaths are accessible unless explicitly listed. This is intentional and desirable for this project.

### Pattern 3: CLI Stub with Shebang

**What:** A minimal `src/cli.ts` that Phase 11 will expand into the full Commander.js CLI. For Phase 10, it serves as a placeholder to validate the `bin` field works.
**When to use:** When the `bin` field needs to exist before the full CLI is implemented.
**Example:**
```typescript
#!/usr/bin/env node
// CLI entry point -- Phase 11 will add Commander.js commands
// For now, display version and usage hint

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

console.log(`harness-evolve v${pkg.version}`);
console.log('Commands: init, status, uninstall (coming in v1.1)');
console.log('Run with --help for usage information.');
```

**Important:** The compiled `dist/cli.js` needs to be executable. Add `chmod +x dist/cli.js` as a post-build step, or configure tsup with `banner` to include the shebang.

### Pattern 4: tsup Banner for Shebang

**What:** tsup can inject a shebang line at the top of specific entry points using the `banner` option. However, tsup's `banner` applies globally to all entries, not per-entry. The better approach for a single CLI entry is to include the shebang in the source file and let tsup preserve it, or use a post-build script.
**Recommended approach:** Add the `cli` entry to tsup config and use a `postbuild` script:
```bash
# In package.json scripts
"postbuild": "chmod +x dist/cli.js && echo '#!/usr/bin/env node' | cat - dist/cli.js > dist/cli.tmp && mv dist/cli.tmp dist/cli.js"
```

**Alternative (cleaner):** tsup supports `esbuildOptions` where you can set banner per entry. But the simplest solution is to write the shebang directly in the TypeScript source file. esbuild (and therefore tsup) preserves leading comments/shebangs.

### Pattern 5: GitHub Actions CI Workflow

**What:** Two workflow files: one for CI (build/test/typecheck on push and PR), one for publish (on version tag push).
**Structure:**
```
.github/
  workflows/
    ci.yml        # Build + test + typecheck on push/PR to main
    publish.yml   # npm publish on v* tag push
```

### Anti-Patterns to Avoid
- **Using `.npmignore`:** Blacklist approach is error-prone. New files are included by default. Use `files` whitelist instead.
- **Putting source in tarball:** Never include `src/`, `tests/`, `.planning/` in the npm package. Consumers only need `dist/`.
- **CJS dual-format build:** The project explicitly decided against this (Out of Scope in REQUIREMENTS.md). ESM-only is correct for Node 22+.
- **Using `npm publish --access public` in CI:** Only needed for scoped packages. `harness-evolve` is unscoped.
- **Hardcoding npm token in CI:** Use OIDC trusted publishing instead. Never store npm tokens as GitHub secrets for long-term use.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Package exports validation | Manual import tests | publint --strict | Catches 20+ rule violations including missing types, wrong extensions, format mismatches |
| TypeScript type resolution validation | Manual `tsc --noEmit` with different moduleResolution | @arethetypeswrong/cli --pack . --profile esm-only | Tests actual resolution in node16, bundler, and esm-only modes |
| CI/CD pipeline | Custom shell scripts | GitHub Actions with official actions (checkout, setup-node) | Maintained, versioned, community-supported |
| Tarball content control | Custom pre-publish script | package.json `files` field | npm's built-in mechanism, no script needed |
| npm authentication in CI | Manual token management | OIDC trusted publishing | Short-lived tokens, no secret rotation needed |
| Version bump + tag | Manual `npm version` + `git tag` | `npm version patch/minor/major` (creates commit + tag) | Atomic version bump + git tag in one command |

**Key insight:** The npm ecosystem has mature tooling for every step of the publish pipeline. The only custom code needed is the CLI stub entry point.

## Common Pitfalls

### Pitfall 1: First Publish Cannot Use OIDC
**What goes wrong:** CI workflow tries to publish a brand-new package via OIDC and fails because the package doesn't exist on npm yet.
**Why it happens:** npm requires a package to exist before you can configure trusted publishers on it. This is a known limitation (npm/cli#8544).
**How to avoid:** The first publish must be done manually by the repository owner using `npm login` + `npm publish`. After that, configure OIDC trusted publishing in the package's npm settings page (https://www.npmjs.com/package/harness-evolve/access).
**Warning signs:** CI publish step fails with authentication error on the very first release.

### Pitfall 2: `types` Condition Must Come First in Exports
**What goes wrong:** TypeScript consumers can't resolve types from the package.
**Why it happens:** Node.js and TypeScript evaluate export conditions in order. If `default` comes before `types`, TypeScript won't see the type declarations.
**How to avoid:** Always put `"types"` before `"default"` in every exports condition block.
**Warning signs:** `@arethetypeswrong/cli` reports "No types" for entry points.

### Pitfall 3: Missing Shebang in CLI Entry
**What goes wrong:** `npx harness-evolve` fails with "cannot execute" or tries to run the file as shell script.
**Why it happens:** The `bin` entry needs `#!/usr/bin/env node` as the first line of the compiled JS file.
**How to avoid:** Include the shebang in the TypeScript source file. esbuild/tsup preserves it. Also ensure `chmod +x` on the output file.
**Warning signs:** `npm exec harness-evolve` fails; `node dist/cli.js` works fine.

### Pitfall 4: `repository.url` Must Match GitHub Repository Exactly
**What goes wrong:** OIDC trusted publishing fails with cryptic error.
**Why it happens:** npm validates the repository URL from package.json against the OIDC token's repository claim. Case sensitivity matters.
**How to avoid:** Use the exact format: `"url": "git+https://github.com/r1ckyIn/harness-evolve.git"` -- match case exactly.
**Warning signs:** Publish works locally but fails in CI.

### Pitfall 5: npm CLI Version in CI
**What goes wrong:** Publish fails because the GitHub Actions runner's npm version is too old for trusted publishing.
**Why it happens:** OIDC trusted publishing requires npm >=11.5.1. actions/setup-node may bundle an older npm.
**How to avoid:** Add `npm install -g npm@latest` step in the publish workflow before `npm publish`.
**Warning signs:** Error about unsupported authentication method.

### Pitfall 6: `files` Field Doesn't Include `dist/` After Clean Build
**What goes wrong:** `npm pack --dry-run` shows only README + LICENSE + package.json but no dist/ files.
**Why it happens:** `dist/` is in `.gitignore`. If the CI build step fails silently, dist/ won't exist.
**How to avoid:** Always run `npm run build` before `npm pack` or `npm publish`. In CI, the build step must succeed before the publish step.
**Warning signs:** Published package has 0 bytes of actual code.

### Pitfall 7: Static Test Badge in README
**What goes wrong:** The README shows "336 passing" forever even as the test count changes.
**Why it happens:** The current README uses a static shields.io badge with hardcoded text.
**How to avoid:** Replace with dynamic badges: npm version from npm registry, CI status from GitHub Actions workflow.
**Warning signs:** Badge shows outdated information.

## Code Examples

Verified patterns from official sources:

### CI Workflow (ci.yml)
```yaml
# Source: GitHub Actions official documentation + npm best practices
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [22]
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - run: npm ci

      - run: npm run build

      - run: npm run typecheck

      - run: npm test

      - name: Validate package exports
        run: npx publint --strict

      - name: Validate TypeScript types
        run: npx @arethetypeswrong/cli --pack . --profile esm-only
```

### Publish Workflow (publish.yml)
```yaml
# Source: npm OIDC trusted publishing docs + practical guides
name: Publish

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: 'https://registry.npmjs.org'

      - run: npm install -g npm@latest

      - run: npm ci

      - run: npm run build

      - run: npm test

      - run: npm run typecheck

      - run: npm publish --provenance
```

### README Badges (shields.io flat-square)
```markdown
[![npm version](https://img.shields.io/npm/v/harness-evolve?style=flat-square)](https://www.npmjs.com/package/harness-evolve)
[![CI](https://img.shields.io/github/actions/workflow/status/r1ckyIn/harness-evolve/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/r1ckyIn/harness-evolve/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
```

### npm pack Validation Script
```bash
# Verify tarball contents before publish
npm pack --dry-run 2>&1 | grep "npm notice" | grep -v "Tarball"
# Should show only: dist/*, README.md, LICENSE, package.json
```

### publint + attw npm Scripts
```json
{
  "scripts": {
    "check:publint": "publint --strict",
    "check:attw": "attw --pack . --profile esm-only",
    "check:package": "npm run check:publint && npm run check:attw",
    "prepublishOnly": "npm run build && npm run check:package"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm automation tokens in CI secrets | OIDC trusted publishing | July 2025 (GA) | No long-lived tokens, automatic provenance |
| `.npmignore` blacklist | `files` whitelist in package.json | Gradual shift, consensus by 2024 | Safer, explicit control |
| `main` + `module` fields | `exports` map with conditions | Node.js 12.7+ (mature by 2023) | Fine-grained entry point control |
| Manual TypeScript type checking | publint + @arethetypeswrong/cli | 2023-2024 | Catches type resolution bugs before publish |
| Classic tokens + `--access public` | OIDC + provenance attestation | 2025+ | Supply chain security |
| Hardcoded test count badges | Dynamic shields.io npm/CI badges | Always available | Auto-updating badges |

**Deprecated/outdated:**
- npm classic automation tokens: Still work but OIDC is preferred for security
- `module` field in package.json: Replaced by `exports` map for modern packages
- `.npmignore`: Not deprecated but discouraged in favor of `files` whitelist

## Open Questions

1. **First publish timing**
   - What we know: The very first `npm publish` must be done manually by the user (not CI)
   - What's unclear: Whether the plan should include instructions for the manual first publish or just document it
   - Recommendation: Include a plan step that documents the manual first publish procedure and a post-publish step to configure OIDC on npmjs.com. The CI workflow should be ready to handle all subsequent publishes.

2. **CLI stub scope for NPM-04**
   - What we know: Phase 11 implements the full CLI. Phase 10 needs `bin` field to exist.
   - What's unclear: How much CLI functionality to put in the stub
   - Recommendation: Minimal stub that prints version and "commands coming in v1.1" message. Just enough to validate `npx harness-evolve` works without error.

3. **tsup entry for CLI**
   - What we know: tsup config needs a new entry for `cli` to build the CLI stub
   - What's unclear: Whether shebang preservation works reliably in tsup/esbuild
   - Recommendation: Add `'cli': 'src/cli.ts'` to tsup entries. Test shebang preservation after build. If not preserved, use a postbuild script.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime, CI | Yes | v22.14.0 | -- |
| npm | Publishing, CI | Yes | 11.6.0 | -- (>=11.5.1 required for OIDC) |
| GitHub CLI (gh) | Verifying Actions setup | Yes | 2.83.2 | -- |
| publint | Package validation | No (install as devDep) | 0.3.18 (latest) | -- |
| @arethetypeswrong/cli | Type validation | No (install as devDep) | 0.18.2 (latest) | -- |
| GitHub Actions | CI/CD | Yes (GitHub repo) | N/A | -- |

**Missing dependencies with no fallback:** None -- all dependencies are installable.

**Missing dependencies with fallback:** None.

**Note:** npm 11.6.0 is installed locally, which exceeds the 11.5.1 minimum for OIDC trusted publishing. The GitHub Actions runner will need `npm install -g npm@latest` to ensure the CI environment also has a recent enough version.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run && npm run typecheck` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NPM-01 | package.json has all required metadata fields | unit | `npx vitest run tests/unit/package-metadata.test.ts -x` | No -- Wave 0 |
| NPM-02 | npm pack includes only dist/, README.md, LICENSE, package.json | integration | `npm pack --dry-run 2>&1 \| grep "npm notice"` (script validation) | No -- Wave 0 |
| NPM-03 | exports map resolves correctly for ESM consumers | integration | `npx publint --strict && npx attw --pack . --profile esm-only` | No -- Wave 0 (external tools) |
| NPM-04 | bin field registers harness-evolve CLI command | integration | `node dist/cli.js` (smoke test after build) | No -- Wave 0 |
| CIC-01 | CI workflow runs build + test + typecheck | manual-only | Verify by pushing to branch and checking Actions tab | N/A |
| CIC-02 | v* tag triggers publish workflow | manual-only | Verify by creating tag; first real test is first publish | N/A |
| CIC-03 | README has dynamic badges | unit | `npx vitest run tests/unit/readme-badges.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run && npm run typecheck`
- **Per wave merge:** `npx vitest run && npm run typecheck && npm run build && npx publint --strict`
- **Phase gate:** Full suite green + `npm pack --dry-run` shows correct files + `npx attw --pack . --profile esm-only` passes

### Wave 0 Gaps
- [ ] `tests/unit/package-metadata.test.ts` -- validates package.json has all NPM-01 required fields
- [ ] `tests/unit/readme-badges.test.ts` -- validates README.md contains required badge patterns
- [ ] Install dev dependencies: `npm install -D publint @arethetypeswrong/cli`
- [ ] Add npm scripts: `check:publint`, `check:attw`, `check:package`

## Sources

### Primary (HIGH confidence)
- [npm trusted publishing docs](https://docs.npmjs.com/trusted-publishers/) - OIDC setup, permissions, limitations
- [npm provenance statements](https://docs.npmjs.com/generating-provenance-statements/) - Provenance configuration
- [npm/cli#8544](https://github.com/npm/cli/issues/8544) - First publish OIDC limitation (confirmed open)
- [Node.js packages documentation](https://nodejs.org/api/packages.html) - exports field specification
- [publint docs](https://publint.dev/docs/) - CLI usage, rules, integration
- [@arethetypeswrong/cli README](https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/packages/cli/README.md) - CLI flags, ESM-only profile
- [shields.io npm version badge](https://shields.io/badges/npm-version) - Dynamic badge format
- [shields.io GitHub Actions status](https://shields.io/badges/git-hub-actions-workflow-status) - CI badge format

### Secondary (MEDIUM confidence)
- [Phil Nash: Things you need to do for npm trusted publishing](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/) - Practical OIDC gotchas, verified against official docs
- [Hiroki Osame: Guide to package.json exports](https://hirok.io/posts/package-json-exports) - exports patterns, types-first ordering
- [2ality: Publishing ESM packages with TypeScript](https://2ality.com/2025/02/typescript-esm-packages.html) - ESM-only package configuration, bin field
- [Ankush: Publish to NPM from GitHub Actions using OIDC](https://ankush.one/blogs/npm-oidc-publishing/) - Complete workflow YAML
- [npm/rfcs#665](https://github.com/npm/rfcs/issues/665) - ESM validation before publish discussion
- [GitHub Changelog: npm OIDC GA](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/) - GA announcement July 2025

### Tertiary (LOW confidence)
- None -- all findings verified against multiple sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - publint and attw are the industry standard tools; versions verified against npm registry
- Architecture: HIGH - package.json exports/files/bin patterns are well-documented by Node.js and npm
- Pitfalls: HIGH - OIDC first-publish limitation confirmed via GitHub issue; types-first ordering documented in multiple sources
- CI/CD: HIGH - GitHub Actions workflow patterns verified against npm official docs and multiple blog posts

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable domain -- npm packaging practices change slowly)
