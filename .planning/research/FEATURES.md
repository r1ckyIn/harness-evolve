# Feature Landscape: v1.1 Stabilization & Production

**Domain:** npm distribution, CI/CD, and production readiness for a Claude Code hook-based TypeScript CLI tool
**Researched:** 2026-04-02
**Overall Confidence:** HIGH (based on official Claude Code plugin docs, npm ecosystem standards, GitHub Actions patterns)
**Scope:** v1.1 only -- tech debt fixes, npm publish, CI/CD pipeline, CLI install experience

---

## Context: What Already Ships in v1.0

Before defining v1.1 features, here is what exists and works:

| Component | Status | Notes |
|-----------|--------|-------|
| 5 lifecycle hooks (capture) | Shipped | UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PermissionRequest |
| Stop hook (analysis trigger) | Shipped | With infinite-loop guard and cooldown |
| 8 classifiers | Shipped | repeated-prompts, long-prompts, permission-patterns, code-corrections, personal-info, config-drift, ecosystem-adapter, onboarding |
| JSONL storage + secret scrubbing | Shipped | 14-pattern scrubber, daily rotation |
| Pre-processing + environment scanner | Shipped | Summary under 50KB, scans settings.json + .claude/ |
| Analysis engine + routing | Shipped | Analyzer orchestrator with classifier chain |
| Dual-channel delivery | Shipped | Stdout injection + /evolve skill |
| Auto-apply (permissions only) | Shipped | With backup, JSONL audit log |
| Outcome tracking + feedback loop | Shipped | adjustConfidence on pattern types |
| Tiered onboarding | Shipped | 3-tier weighted scoring |
| 336 tests, 37 files | Shipped | 1 pre-existing flaky test |
| tsup build (8 entry points) | Shipped | 5 hooks + stop + run-evolve + index |

**v1.1 does NOT add new analysis features.** It makes what exists installable, testable in CI, and production-ready.

---

## Table Stakes

Features that v1.1 MUST deliver. Without these, the project cannot be used by anyone outside the developer.

| # | Feature | Why Required | Complexity | Depends On | Confidence |
|---|---------|-------------|------------|------------|------------|
| T1 | **npm publishable package.json** | No one can `npm install harness-evolve` today. Missing: description, keywords, license, repository, homepage, author, `files` field, `bin` entry, `exports` map. Without these, npm publish fails or produces a broken package. | Low | Nothing | HIGH |
| T2 | **CLI entry point with `bin` field** | Users need `npx harness-evolve init` or `harness-evolve init` after global install. Current `run-evolve.ts` has no CLI argument parsing, no shebang line, no Commander.js integration. The bin entry makes the package executable. | Medium | T1 | HIGH |
| T3 | **`harness-evolve init` command** | The single most important user-facing feature. Must: (1) detect settings.json location, (2) inject hook registrations, (3) confirm success. This is the entire "install experience." Without it, users must hand-edit JSON -- a non-starter. | Medium | T2 | HIGH |
| T4 | **CI/CD pipeline (GitHub Actions)** | No CI exists. PRs merge without automated build/test/typecheck verification. Standard for any open-source TypeScript project: build + test + typecheck on every push/PR. | Low | Nothing | HIGH |
| T5 | **Fix inferPatternType string mismatch** | 7/8 classifiers' outcome tracking is broken. `adjustConfidence` lookups miss for everything except permission-always-approved. The feedback loop -- a core architectural feature -- is largely non-functional. | Low | Nothing | HIGH |
| T6 | **Fix flaky concurrent-counter test** | 1 of 336 tests intermittently fails due to lock contention race in `concurrent-counter.test.ts`. CI will false-fail on this. Must be deterministic before CI can gate merges. | Low | Nothing | HIGH |
| T7 | **`files` field in package.json** | Without explicit `files`, npm includes everything (tests, .planning/, dev configs). Published package should contain only `dist/`, `README.md`, `LICENSE`, and `package.json`. Reduces install size from ~12MB source to ~500KB dist. | Low | T1 | HIGH |

---

## Differentiators

Features that distinguish harness-evolve's install experience from comparable tools.

| # | Feature | Value Proposition | Complexity | Depends On | Confidence |
|---|---------|-------------------|------------|------------|------------|
| D1 | **`npx harness-evolve init` zero-install setup** | Users run ONE command, no global install needed. npx downloads, runs init, registers hooks in settings.json, exits. Comparable to `npx create-react-app` pattern. CCharness uses this (`npx -y @aotoki/ccharness <command>`). This is the gold standard for CLI tool first-run. | Low | T2, T3 | HIGH |
| D2 | **Plugin-format distribution (`.claude-plugin/`)** | Claude Code's plugin system (public beta, 2026) is the native distribution path. Packaging as a plugin means: namespaced skills (`/harness-evolve:evolve`), hooks in `hooks/hooks.json`, auto-discovery via marketplace. Users install with `/plugin install harness-evolve@marketplace`. This is the future -- npm is the bridge. | Medium | T1, T3 | MEDIUM |
| D3 | **Expand auto-apply beyond permissions** | v1.0 auto-apply only handles SETTINGS (permissions). Expanding to HOOK, RULE, and MEMORY auto-apply for HIGH-confidence recommendations closes the "self-improving" loop. Users who opt in get real zero-effort optimization. | Medium | T5 | MEDIUM |
| D4 | **Automated npm publish on tag push** | `git tag v1.1.0 && git push --tags` triggers GitHub Actions to build, test, and publish to npm. No manual `npm publish` steps. Uses either `changesets` or `semantic-release` for version management. Standard for mature open-source packages. | Low-Medium | T4, T1 | HIGH |
| D5 | **`harness-evolve status` command** | Show current state: how many interactions captured, last analysis timestamp, pending recommendations count, hook registration status. Debugging and onboarding aid. Comparable to `git status` -- answers "is this thing working?" | Low | T2 | MEDIUM |
| D6 | **`harness-evolve uninstall` command** | Clean removal: remove hook entries from settings.json, optionally delete ~/.harness-evolve/ data. Important for trust -- users install more readily when they know removal is clean. No comparable tool offers this. | Low | T2, T3 | MEDIUM |
| D7 | **README with badges and install docs** | Open-source credibility: npm version badge, CI status badge, license badge, one-command install instructions, architecture overview. The README IS the marketing for a CLI tool. | Low | T1, T4 | HIGH |

---

## Anti-Features

Features to explicitly NOT build in v1.1.

| # | Anti-Feature | Why Avoid | What to Do Instead |
|---|-------------|-----------|-------------------|
| AF1 | **postinstall hook in npm package** | npm postinstall scripts run automatically on `npm install`, which is a security concern. npm warns about them. They also break `npx` usage and add install latency. CCharness and similar tools do NOT use postinstall -- they require explicit `init`. | Require `harness-evolve init` as a separate step after install. |
| AF2 | **Auto-registering hooks without confirmation** | Modifying `settings.json` without the user seeing exactly what will change erodes trust. Even the official Claude Code plugin system shows users what a plugin does before activation. | `harness-evolve init` should print the exact JSON it will add, ask for confirmation (or accept `--yes` flag), then apply. |
| AF3 | **CJS + ESM dual format build** | The project is ESM-only (`"type": "module"`). Adding CommonJS support doubles build complexity for zero benefit -- Claude Code itself is ESM, Node 22+ has full ESM support, and the target audience (Claude Code users) all have modern Node. | Stay ESM-only. Set `"type": "module"` and `exports` with ESM paths only. |
| AF4 | **Monorepo / workspace structure** | The project is ~3,765 LOC of source. Splitting into packages (core, cli, hooks) adds tooling overhead (workspaces, cross-package builds) with no benefit at this scale. | Keep single package. Separate concerns via directory structure (src/hooks/, src/analysis/, src/delivery/), not package boundaries. |
| AF5 | **Web-based marketplace listing** | Building a website to showcase the plugin is premature. The official Anthropic marketplace (`claude.ai/settings/plugins/submit`) is the right distribution channel when ready. | Submit to official marketplace when plugin format is ready. GitHub README is sufficient for npm-based discovery. |
| AF6 | **Docker-based CI** | The project has no Docker dependencies, no database, no external services. Docker in CI adds 30-60s of overhead per run. GitHub Actions runners have Node pre-installed. | Use `setup-node` action directly. `npm ci && npm run build && npm test && npm run typecheck` is the entire pipeline. |
| AF7 | **New classifiers or analysis features** | v1.1 is stabilization. Adding new classifiers before fixing the inferPatternType mismatch means building on a broken foundation. New features belong in v1.2+. | Fix existing classifiers first. Expand auto-apply scope. Then add new classifiers. |
| AF8 | **Homebrew tap distribution** | Adds a separate repo to maintain (homebrew-harness-evolve), a separate release process, and a separate install path. npm/npx covers 100% of the target audience (Claude Code users already have Node). | npm + npx is the only distribution channel for v1.1. Homebrew can be added in v2+ if demand materializes. |

---

## Feature Dependencies (v1.1)

```
T1 (package.json metadata) ─────┐
                                 ├──> T7 (files field)
                                 ├──> T2 (CLI bin entry)
                                 │     │
                                 │     ├──> T3 (harness-evolve init)
                                 │     │     │
                                 │     │     ├──> D1 (npx zero-install)
                                 │     │     ├──> D6 (uninstall command)
                                 │     │     └──> D2 (plugin format, later)
                                 │     │
                                 │     └──> D5 (status command)
                                 │
                                 └──> D4 (automated npm publish)
                                       │
                                       └── T4 (CI/CD pipeline)

T5 (inferPatternType fix) ──> D3 (expanded auto-apply)

T6 (flaky test fix) ──> T4 (CI/CD pipeline, requires green suite)

D7 (README + badges) ──> T1 + T4 (needs npm name + CI URL)
```

### Critical Path

```
T5 + T6 (tech debt fixes, parallel)
    ↓
T1 + T7 (package.json, parallel with above)
    ↓
T2 (CLI bin entry)
    ↓
T3 (init command)
    ↓
T4 (CI/CD)
    ↓
D4 (automated publish)
    ↓
D7 (README)
```

Tech debt fixes and package metadata have no dependencies and can be done first/in parallel. The CLI entry point is the keystone -- everything user-facing depends on it. CI/CD must come before automated publish. README comes last because it references the CI badge URL and npm package name.

---

## Complexity Estimates

| Feature | Files Changed | New Files | Estimated LOC | Risk |
|---------|--------------|-----------|---------------|------|
| T1 package.json | 1 | 0 | ~30 lines of metadata | None |
| T2 CLI bin entry | 2-3 | 1 (cli.ts) | ~80 | Low -- Commander.js is already in STACK.md |
| T3 init command | 2-3 | 1-2 (init.ts, settings-writer.ts) | ~200 | Medium -- must handle all settings.json scopes |
| T4 CI/CD | 0 src | 1-2 (.github/workflows/) | ~80 YAML | Low |
| T5 inferPatternType fix | 1 | 0 | ~30 | None -- string constant alignment |
| T6 flaky test fix | 1 | 0 | ~20 | Low -- lock contention timing |
| T7 files field | 1 | 0 | ~5 | None |
| D1 npx support | 0 (inherits T2+T3) | 0 | 0 | None -- just works with bin entry |
| D2 plugin format | 3-5 | 3-4 (.claude-plugin/, hooks.json) | ~150 | Medium -- new distribution model |
| D3 expanded auto-apply | 2-3 | 0-1 | ~150 | Medium -- must be safe for HOOK/RULE targets |
| D4 automated publish | 0 src | 1 workflow | ~60 YAML | Low |
| D5 status command | 1-2 | 1 (status.ts) | ~100 | Low |
| D6 uninstall command | 1-2 | 1 (uninstall.ts) | ~80 | Low |
| D7 README | 0 src | 1 (README.md update) | ~200 prose | None |

---

## Distribution Model Analysis

### Current State: Hooks registered manually in settings.json

Users must hand-edit `~/.claude/settings.json` or `.claude/settings.json` to add hook entries pointing to built JS files. This is the raw mechanism but terrible UX.

### Target State: Dual distribution

**Path A: npm package (v1.1 target)**
```
npm install -g harness-evolve   # or npx harness-evolve init
harness-evolve init             # registers hooks in settings.json
```

The `init` command must:
1. Detect whether `~/.claude/settings.json` exists (create if not)
2. Check for existing harness-evolve hooks (idempotent -- don't double-register)
3. Generate hook entries pointing to the installed package's `dist/hooks/*.js` paths
4. Write the hooks configuration to settings.json
5. Print confirmation with what was added

Hook registration JSON will look like:
```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "node /path/to/harness-evolve/dist/hooks/user-prompt-submit.js"
      }]
    }],
    "PreToolUse": [{ ... }],
    "PostToolUse": [{ ... }],
    "PostToolUseFailure": [{ ... }],
    "PermissionRequest": [{ ... }],
    "Stop": [{ ... }]
  }
}
```

Key challenge: The `command` path must resolve to wherever npm installed the package. Use `import.meta.url` or `__dirname` equivalent to find the dist/ directory at runtime, or use `npx harness-evolve hook user-prompt-submit` as the command (simpler but adds npx overhead per hook invocation).

**Path B: Plugin format (v1.2+ target)**
```
/plugin marketplace add r1ckyIn/harness-evolve
/plugin install harness-evolve@r1ckyIn-harness-evolve
```

Plugin format uses `hooks/hooks.json` with `${CLAUDE_PLUGIN_ROOT}` variable for portable paths. This is cleaner than npm path resolution but requires the plugin system (still public beta).

**Recommendation:** Ship npm (Path A) in v1.1. Prepare plugin structure (Path B) in v1.1 but don't make it the primary install path until the plugin system is stable.

---

## CI/CD Pipeline Design

### Standard Pattern for TypeScript Hook Projects

Based on ecosystem research, the CI/CD pipeline should follow this structure:

**Workflow 1: ci.yml (on push + PR to main)**
```
Jobs (parallel where possible):
1. typecheck: tsc --noEmit
2. test: vitest run
3. build: tsup (verify dist/ produces correctly)
```

**Workflow 2: publish.yml (on tag push v*)**
```
Jobs (sequential):
1. ci (reuse workflow 1)
2. publish: npm publish
```

Key decisions:
- Use `npm ci` (not `npm install`) for deterministic, fast installs
- Cache node_modules via `setup-node` action's built-in caching
- Run typecheck and test in parallel (they're independent)
- Build depends on typecheck + test passing
- Pin action versions to commit SHAs for supply-chain security
- Use `NPM_TOKEN` secret for publish step (not OIDC -- simpler for personal projects)
- Node 22 matrix only (no need to test multiple versions -- project requires >=22.14.0)

### Release Strategy

**Recommended: Manual tag + automated publish**

1. Developer bumps version in package.json
2. `git tag v1.1.0 && git push --tags`
3. GitHub Actions builds, tests, publishes to npm
4. GitHub Release created automatically with changelog

This is simpler than changesets (overkill for single-package repo) and semantic-release (requires commit message conventions that may conflict with existing GSD commit format).

---

## Install Experience: Comparable Tools Benchmarked

| Tool | Install Method | Setup Steps | Total Commands |
|------|---------------|-------------|----------------|
| CCharness | `npx -y @aotoki/ccharness <command>` | Zero setup, npx per-use | 1 |
| Everything Claude Code | `npx ccg-workflow` + manual config | Multi-step, manifest-driven | 3-5 |
| Claude-Mem | `npm install -g claude-mem && claude-mem setup` | Global install + setup command | 2 |
| Cog | Copy files to `.claude/` | Manual file placement | 2-3 |
| Official plugins | `/plugin install name@marketplace` | Single command in Claude Code | 1 |
| **harness-evolve (target)** | `npx harness-evolve init` | Single command | **1** |

The target is CCharness-level simplicity with official plugin-level discoverability.

---

## Priority Ranking for v1.1

### Must Ship (blocks release)

1. **T5 - inferPatternType fix** -- Unblocks the feedback loop, zero risk
2. **T6 - Flaky test fix** -- Unblocks CI
3. **T1 - package.json metadata** -- Unblocks npm publish
4. **T7 - files field** -- Part of T1, prevents publishing garbage
5. **T2 - CLI bin entry** -- Unblocks init command
6. **T3 - init command** -- THE user-facing feature of v1.1
7. **T4 - CI/CD pipeline** -- Quality gate for all future development

### Should Ship (high value, low risk)

8. **D1 - npx zero-install** -- Free with T2+T3
9. **D4 - Automated publish** -- Low effort extension of T4
10. **D7 - README** -- Required for npm listing anyway

### Nice to Have (defer if time-constrained)

11. **D5 - status command** -- Useful but not blocking
12. **D6 - uninstall command** -- Trust-building but not urgent
13. **D3 - expanded auto-apply** -- Valuable but needs careful design
14. **D2 - plugin format** -- Future-proofing, not v1.1 critical

---

## Sources

### Official Claude Code Documentation (HIGH confidence)
- [Claude Code Plugins -- Create plugins](https://code.claude.com/docs/en/plugins) -- Plugin structure, manifest, hooks.json format
- [Claude Code Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) -- Distribution via marketplace.json, npm source support
- [Claude Code Discover Plugins](https://code.claude.com/docs/en/discover-plugins) -- User install experience, /plugin commands
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- All 21 hook events, 4 handler types, settings.json config format
- [Claude Code Advanced Setup](https://code.claude.com/docs/en/setup) -- Installation methods, native vs npm

### npm Ecosystem (HIGH confidence)
- [npm package.json docs](https://docs.npmjs.com/files/package.json/) -- files, bin, exports, publishConfig fields
- [Create a Modern npm Package in 2026](https://jsmanifest.com/create-modern-npm-package-2026) -- Current best practices
- [Publishing ESM-based npm packages with TypeScript](https://2ality.com/2025/02/typescript-esm-packages.html) -- ESM-only package patterns
- [TypeScript CLI with Node.js](https://dawchihliou.github.io/articles/writing-your-own-typescript-cli) -- bin entry, shebang, Commander.js

### CI/CD Patterns (HIGH confidence)
- [GitHub Actions CI/CD for Node.js: 2026 Guide](https://axiom-experiment.hashnode.dev/github-actions-cicd-for-nodejs-the-complete-2026-guide) -- npm ci, caching, parallel jobs
- [Vitest + GitHub Actions CI](https://www.the-koi.com/projects/setting-up-a-superfast-ci-with-vitest-and-github-actions/) -- Vitest-specific workflow
- [npm Release Automation comparison](https://oleksiipopov.com/blog/npm-release-automation/) -- changesets vs semantic-release vs manual

### Comparable Tools (MEDIUM confidence)
- [CCharness](https://github.com/elct9620/ccharness) -- npx-based CLI pattern
- [Everything Claude Code](https://github.com/affaan-m/everything-claude-code) -- Manifest-driven install
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code) -- Ecosystem overview
- [Plugin postInstall feature request](https://github.com/anthropics/claude-code/issues/9394) -- Plugin lifecycle hooks discussion
