# Domain Pitfalls

**Domain:** Self-improving AI agent configuration harness (Claude Code hooks/plugins ecosystem)
**Researched:** 2026-04-02 (v1.1 comprehensive update -- npm publish, CI/CD, CLI, auto-apply expansion, string constant fixes)

---

## v1.1 Pitfalls: Stabilization & Production Readiness

These pitfalls are specific to the v1.1 milestone scope. v1.0 pitfalls (1-15) remain valid and are preserved at the bottom of this document.

---

### Pitfall 16: Hook Invocation Paths Break After npm Install

**What goes wrong:** After `npm publish`, users install the package globally or locally. The hooks registered in `settings.json` reference paths like `node dist/hooks/user-prompt-submit.js`. But when moving from "git clone" development to "npm install" consumption, the filesystem layout changes entirely. The `dist/` paths that work in development no longer resolve from the user's CWD. Claude Code swallows hook errors silently -- the user sees zero feedback, just a system that appears to do nothing.

**Why it happens:** The project currently has 8 tsup entry points producing `dist/hooks/*.js`. Hook registration in `settings.json` requires absolute or resolvable paths. The `harness-evolve init` command must generate paths that are correct for the installation method (global npm, local npm, npx, git clone). Each method places the package in a different location (`/usr/local/lib/node_modules/`, `./node_modules/`, npx cache, or CWD).

**Consequences:** Complete product failure for npm-installed users. No errors visible. User concludes the tool is broken and uninstalls. This is the single most likely "v1.1 ships but nobody can use it" scenario.

**Prevention:**
1. The `harness-evolve init` CLI command must dynamically resolve its own package location using `import.meta.url` or `path.dirname(fileURLToPath(import.meta.url))` and generate absolute paths for all hook entries in settings.json.
2. Test the full install-to-hook-invocation chain: `npm pack` -> `npm install -g ./harness-evolve-*.tgz` -> run `harness-evolve init` -> verify hooks fire on next Claude Code interaction. This must be a manual verification checklist item.
3. Never hardcode relative paths in settings.json registration. Always resolve at `init` time.
4. Provide `--uninstall` to cleanly remove all registered hooks from settings.json.

**Detection:** If `harness-evolve init` completes but `~/.harness-evolve/logs/` remains empty after user interactions, the paths are broken.

**Severity:** Critical
**Phase relevance:** CLI command phase and npm publish phase must be tightly coordinated.

---

### Pitfall 17: Missing `files` Field Ships Source, Tests, and Planning Docs to npm

**What goes wrong:** The current `package.json` has no `files` field. Without it, npm falls back to `.npmignore` (doesn't exist) then to `.gitignore`. This means `src/`, `tests/`, `.planning/` (containing internal roadmaps, audit docs, research notes), and potentially `CLAUDE.md` get published to the npm registry. Package size balloons from ~50KB (dist only) to several MB.

**Why it happens:** The project has always been git-clone-only. The `files` field is opt-in and easy to forget.

**Consequences:**
- Package size 10-50x larger than necessary, slowing installs.
- `.planning/` documents (architecture decisions, tech debt, audit notes) exposed publicly.
- `CLAUDE.md` (which project rules state "must never be pushed to GitHub") would be published to npm.

**Prevention:**
1. Add `"files": ["dist", "LICENSE", "README.md"]` to package.json as the FIRST task in the npm publish phase.
2. Add `"prepublishOnly": "npm run build"` to ensure `dist/` is fresh.
3. CI step: `npm pack --dry-run 2>&1 | grep -E 'src/|tests/|\.planning/|CLAUDE\.md'` should return empty.
4. Use `npx publint` to validate package configuration.

**Detection:** `npm pack --dry-run` should show only `dist/**`, `LICENSE`, `README.md`, `package.json`.

**Severity:** Critical
**Phase relevance:** npm publish phase -- must be the very first thing configured.

---

### Pitfall 18: Auto-Apply Expansion Corrupts User Config Files

**What goes wrong:** v1.0 auto-apply is scoped to `allowedTools` additions in settings.json only (guard on line 122 of auto-apply.ts: `rec.pattern_type !== 'permission-always-approved'`). v1.1 plans to expand to other targets. Each target has fundamentally different file formats, merge semantics, and blast radius:

| Target | Format | Merge Risk |
|--------|--------|------------|
| `settings.json` | JSON | Key collision on deeply nested objects |
| `CLAUDE.md` | Markdown | Positional content, heading structure matters |
| `.claude/rules/*.md` | Markdown files | Overwriting existing user rules |
| `.claude/settings.local.json` | JSON | User's personal overrides -- worst to corrupt |
| Hook script files | JS/Shell | Creating new files safe, modifying dangerous |

The current `applySingleRecommendation` does a simple JSON read-modify-write cycle. This pattern fails catastrophically on markdown (would overwrite the entire file) or on settings.json keys it doesn't understand (could silently drop unknown fields).

**Consequences:** User loses CLAUDE.md customizations. Rules get duplicated or mangled. Settings lose custom properties the code didn't model. Trust in auto-apply is destroyed permanently -- once a user's config is corrupted, they will never re-enable it.

**Prevention:**
1. Each auto-apply target type needs its own applier with target-specific merge logic:
   - `SETTINGS` applier: JSON deep-merge (extend existing for non-allowedTools keys)
   - `RULE` applier: create-only (new `.md` files), NEVER modify existing rules
   - `HOOK` applier: create-only (new hook scripts + register in settings.json)
   - `CLAUDE_MD` applier: append-only, with section detection to avoid duplication
   - `MEMORY` applier: append-only to memory files
2. Every applier MUST: (a) create timestamped backup, (b) validate output is well-formed, (c) support rollback via `harness-evolve undo <id>`.
3. Implement dry-run mode as FIRST-CLASS feature before ANY new target type ships.
4. Limit v1.1 expansion to ONE additional target type. Recommendation: RULE create-only, because creating a new file has zero risk of corrupting existing content.

**Detection:** After auto-apply, validate modified file (JSON.parse for settings, non-empty check for .md). Log before/after diff to auto-apply-log.jsonl.

**Severity:** Critical
**Phase relevance:** Auto-apply expansion phase. Highest-risk feature in v1.1.

---

### Pitfall 19: `exports` Field Type Resolution Order Breaks TypeScript Consumers

**What goes wrong:** When adding the `exports` field to package.json, the `types` condition must come FIRST within each condition block. If `import` or `default` comes before `types`, TypeScript consumers get no type inference -- `any` for all imports.

**Why it happens:** TypeScript stops searching conditions after the first match. If `import` resolves before `types`, TypeScript uses the JS file and has no type information.

**Prevention:**
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js"
  }
}
```
Validate with `npx publint` and `npx @arethetypeswrong/cli --pack .` (attw).

**Detection:** attw catches this with a "FallbackCondition" error.

**Severity:** Critical (for library consumers), easily preventable.
**Phase relevance:** npm publish phase.

---

### Pitfall 20: npm Trusted Publishing OIDC Silently Fails

**What goes wrong:** The GitHub Actions publish workflow completes successfully (green checkmark) but the package is not published to npm. Or it fails with cryptic 403 about "authentication required."

**Why it happens:** Three known causes:
1. `repository.url` in package.json does not exactly match the GitHub repo URL (case-sensitive)
2. An empty `NODE_AUTH_TOKEN` env var is set, overriding OIDC
3. The `id-token: write` permission is missing from the workflow

**Prevention:**
1. Verify `repository.url` matches exactly: `"git+https://github.com/r1ckyIn/harness-evolve.git"`
2. Never set `NODE_AUTH_TOKEN` to empty string
3. Explicitly set `permissions: { id-token: write, contents: read }` in publish job
4. Add post-publish step: `npm view harness-evolve version` to confirm

**Severity:** Critical (release pipeline failure).
**Phase relevance:** CI/CD pipeline phase.

**Sources:**
- [npm Trusted Publishing Docs](https://docs.npmjs.com/trusted-publishers/)
- [Things you need to do for npm trusted publishing](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/)

---

### Pitfall 21: CLI Shebang Stripped or Malformed in Build Output

**What goes wrong:** After install, `harness-evolve init` gets `Permission denied` or `env: node: No such file or directory`. The shebang was stripped or corrupted.

**Why it happens:** tsup preserves shebangs IF the source file has `#!/usr/bin/env node` as the very first line. If there's a BOM, blank line, or comment before it, tsup doesn't detect it. Also, tsup issue #910: DTS builds can error on hashbang syntax.

**Prevention:**
1. `#!/usr/bin/env node` must be the absolute first line of `src/cli.ts`
2. CI step: `head -1 dist/cli.js | grep -q '#!/usr/bin/env node'`
3. CI step: `test -x dist/cli.js` (executable bit)
4. `"bin": { "harness-evolve": "dist/cli.js" }` must point to built output, never source

**Severity:** Moderate (blocks CLI, easy to fix once discovered).
**Phase relevance:** CLI command phase.

---

### Pitfall 22: `harness-evolve init` Corrupts Existing settings.json

**What goes wrong:** The `init` command reads `~/.claude/settings.json`, injects hook registrations, and writes back. If the file has comments (JSONC), trailing commas, or non-standard formatting, the write-back produces invalid JSON that breaks Claude Code entirely.

**Why it happens:** `JSON.parse()` rejects JSONC. Users may have hand-edited settings.json with comments. `JSON.stringify()` produces valid JSON but loses formatting.

**Consequences:** Claude Code refuses to start. User must manually restore settings.json. Trust-destroying failure.

**Prevention:**
1. Before writing, create backup: `settings.json.bak-{timestamp}`
2. If `JSON.parse()` fails, print clear error and DO NOT write: "Your settings.json contains non-standard JSON (possibly comments). Please fix before running init."
3. Use `write-file-atomic` (already a dependency) to prevent partial writes
4. After writing, re-read and validate the output with `JSON.parse()`
5. Test against fixtures: empty, minimal, complex, JSONC with comments, file doesn't exist yet

**Severity:** Critical (can break user's entire Claude Code setup).
**Phase relevance:** CLI init command phase.

---

### Pitfall 23: Module-Level `paths` Evaluation Causes CI Flakiness

**What goes wrong:** `src/storage/dirs.ts` evaluates `process.env.HOME` at module load time (`const BASE_DIR = join(process.env.HOME ?? '', '.harness-evolve')`). In GitHub Actions, `HOME` is `/home/runner`. Tests that mock `HOME` via `vi.stubEnv` after import get the original value baked into `paths`.

The project works around this with `vi.resetModules()` + dynamic `import()`, but:
1. New v1.1 tests (CLI, expanded auto-apply) might forget this pattern.
2. The pre-existing flaky `concurrent-counter.test.ts` suffers from this + lock contention timing on 2-vCPU CI runners.
3. Ubuntu CI runners have different temp directory behavior than macOS (project developed on macOS Ventura 13.4).

**Prevention:**
1. Document the pattern prominently in a test helper or shared comment.
2. For concurrent-counter test: add `retry: 2` in vitest config for that file. The race is inherent to testing cross-process locking on 2-vCPU runners.
3. Add a CI safety net: if `process.env.CI === 'true'` and any test writes to a path NOT under a temp directory, fail loudly.
4. Consider refactoring `paths` to use a lazy getter pattern so it always reflects current HOME. Moderate refactor but eliminates the class of bugs.

**Severity:** Moderate (causes CI flakiness, blocks reliable release gating).
**Phase relevance:** CI/CD pipeline phase.

---

### Pitfall 24: `inferPatternType` Fix Could Break Outcome History (But Won't)

**What goes wrong:** v1.0 `inferPatternType` returns kebab-case (`"repeated-prompt"`) while classifiers produce snake_case (`"repeated_prompt"`). Fixing the alignment is correct, but if users have accumulated `outcome-history.jsonl` entries with old strings, the new code might not match them.

**Actual risk:** LOW. The v1.0 audit explicitly confirmed that `adjustConfidence` lookups MISSED for 7/8 pattern types. The existing outcome history for those types was tracked but never consumed. There is no data to break because the old data was unreachable.

**Prevention:**
1. Document in the fix PR: "No migration needed -- old outcome history for these 7 types was never consumed (v1.0 audit confirmed)."
2. Write a test with old-format strings verifying the new code handles them gracefully.
3. Optionally add normalization: `patternType.replace(/-/g, '_')` when reading history.

**Severity:** Low (data was unreachable anyway).
**Phase relevance:** String constant fix phase.

---

### Pitfall 25: `prepublishOnly` vs `prepare` Script Confusion

**What goes wrong:** Using `"prepare": "npm run build"` instead of `"prepublishOnly": "npm run build"` causes build to run during `npm install` for end users. Since `tsup` and `typescript` are devDependencies, the build fails with "tsup: command not found."

**Prevention:**
1. Use `"prepublishOnly": "npm run build"`, NOT `"prepare"`.
2. Verify: `npm pack`, then `npm install ./tarball.tgz` in a temp dir -- no build should run.
3. `tsup`, `typescript`, `vitest` must stay in `devDependencies`, never `dependencies`.

**Severity:** Moderate.
**Phase relevance:** npm publish phase.

---

### Pitfall 26: CI Tests Write to Real HOME

**What goes wrong:** If a new test forgets to mock `dirs.js` or stub HOME, it writes to `~/.harness-evolve/` on the CI runner. Auto-apply tests that modify `settings.json` could write to the runner's actual `~/.claude/settings.json`.

**Prevention:**
1. Vitest `globalSetup` that sets HOME to a temp directory for the entire suite.
2. If `CI === 'true'`, verify `paths.base` contains a temp directory pattern before writes.
3. CI post-test step: `test ! -d ~/.harness-evolve || (echo "LEAK: tests wrote to real HOME" && exit 1)`
4. All new auto-apply expansion tests must follow the existing `settingsPath` injection pattern.

**Severity:** Moderate.
**Phase relevance:** CI/CD pipeline phase.

---

### Pitfall 27: `bin` vs `exports` Field Confusion

**What goes wrong:** CLI entry put in `exports` instead of `bin`, or library exports put in `bin` instead of `exports`. These serve completely different purposes:
- `bin`: registers executables in PATH (npx, global install)
- `exports`: controls import/require resolution (library consumers)

**Prevention:** Package.json must have BOTH separate fields. CLI in `bin` only. Library in `exports` only. tsup must produce separate output files for each.

**Severity:** Moderate.
**Phase relevance:** npm publish phase.

---

### Pitfall 28: Commander.js `process.exit()` Leaks Into Hook Context

**What goes wrong:** Commander.js calls `process.exit(1)` on unknown commands by default. If CLI module is accidentally imported by a hook entry point through barrel exports in `index.ts`, Commander terminates the hook process.

**Prevention:**
1. Keep `src/cli.ts` isolated from hook entry points. No shared imports triggering Commander.
2. tsup CLI entry must be separate, not bundled into `index.ts`.
3. Use `commander.exitOverride()` in CLI source.
4. Do NOT add CLI exports to `src/index.ts`.

**Severity:** Minor.
**Phase relevance:** CLI command phase.

---

### Pitfall 29: npx Cache Serves Stale Versions

**What goes wrong:** `npx harness-evolve init` caches the package. After a new version is published fixing a bug, npx may serve the cached old version.

**Prevention:** Document `npx harness-evolve@latest init` as recommended invocation. Consider adding a version check in CLI.

**Severity:** Minor.
**Phase relevance:** Installation experience phase.

---

### Pitfall 30: GitHub Actions Node.js Version Mismatch

**What goes wrong:** Project requires `"engines": { "node": ">=22.14.0" }`. If CI uses `node-version: 22` without pinning the patch, the runner might have an earlier 22.x release with different API behavior.

**Prevention:** Pin `node-version: '22.14.0'` or use `node-version-file: '.node-version'`.

**Severity:** Minor.
**Phase relevance:** CI/CD pipeline phase.

---

## Integration Pitfalls (Cross-Phase)

These pitfalls emerge from the interaction between v1.1 features, not from any single feature.

### Integration Pitfall A: CLI `init` + npm Publish Entry Point Mismatch

If the CLI phase and npm publish phase are developed in separate PRs, there is a window where `harness-evolve init` generates hook entries pointing to paths that don't exist in the published package (e.g., CLI references `dist/hooks/stop.js` but tsup config changed and the file moved).

**Mitigation:** CLI `init` must validate that every hook path it writes to settings.json actually exists on disk. Include a self-test after registration.

### Integration Pitfall B: Auto-Apply Expansion + npm Install = Path Resolution Duplication

If auto-apply creates new hook files (HOOK target), it needs to know where the installed package lives -- the same path resolution problem as CLI `init`. If both implement their own path resolution, they will diverge.

**Mitigation:** Extract path resolution into a shared utility used by both CLI init and auto-apply. Do not duplicate the logic.

### Integration Pitfall C: CI Tests Pass But Published Package Fails

CI tests run against source TypeScript. Users run compiled JavaScript from `dist/`. If tsup misconfigures an entry point or tree-shaking removes a needed export, tests pass but the published package fails. Especially dangerous for hook entry points (stand-alone executables, not library imports).

**Mitigation:** Add a CI "smoke test the artifact" step: (1) `npm pack`, (2) install tarball in temp dir, (3) run `node dist/hooks/user-prompt-submit.js < /dev/null` and verify clean exit. Catches build config errors unit tests miss.

---

## v1.1 Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| npm Package Setup | Missing `files` field (#17) | **Critical** | `"files": ["dist"]`, publint, `npm pack --dry-run` in CI |
| npm Package Setup | exports type order (#19) | **Critical** | `types` first; attw + publint in CI |
| npm Package Setup | prepublishOnly vs prepare (#25) | Moderate | Use prepublishOnly, never prepare |
| npm Package Setup | bin vs exports confusion (#27) | Moderate | Separate fields for separate purposes |
| CI/CD Pipeline | OIDC publish failure (#20) | **Critical** | Exact repo URL; id-token: write permission |
| CI/CD Pipeline | Flaky concurrent-counter (#23) | Moderate | Retry config; document mock pattern |
| CI/CD Pipeline | Tests write to real HOME (#26) | Moderate | Vitest globalSetup safety net |
| CI/CD Pipeline | Node version drift (#30) | Minor | Pin exact version |
| CLI Init Command | Hook paths break after install (#16) | **Critical** | Dynamic path resolution via import.meta.url |
| CLI Init Command | Shebang stripped (#21) | Moderate | Shebang as first line; CI verification |
| CLI Init Command | settings.json corruption (#22) | **Critical** | Backup before write; reject JSONC |
| CLI Init Command | Commander leaks into hooks (#28) | Minor | Isolate CLI entry from hook entries |
| Auto-Apply Expansion | Config file corruption (#18) | **Critical** | Target-specific appliers; backup; dry-run; limit to one new type |
| String Constant Fix | Outcome history compatibility (#24) | Low | Old data was unreachable; add normalization test |
| Install Experience | npx cache staleness (#29) | Minor | Document @latest usage |
| Cross-Phase | Entry point mismatch (Integration A) | Moderate | Self-validation after init |
| Cross-Phase | Path resolution duplication (Integration B) | Moderate | Shared utility function |
| Cross-Phase | Passing tests, broken artifact (Integration C) | Moderate | Smoke-test the npm pack output |

---

## v1.0 Pitfalls (Preserved)

The following pitfalls from v1.0 research remain valid. Abbreviated here -- see git history for full text.

### Critical (v1.0)
- **#1:** UserPromptSubmit stdout injection unreliable -- dual delivery mandatory (MITIGATED: dual delivery built)
- **#2:** File-based counter race condition -- atomic writes (RESOLVED: proper-lockfile)
- **#3:** Context window pollution -- pointer-not-payload (RESOLVED: 200-token injection budget)
- **#4:** Recommendation quality degeneration -- outcome tracking (RESOLVED: outcome tracker built)
- **#5:** Log data contains secrets -- scrubbing pipeline (RESOLVED: scrubber built)

### Moderate (v1.0)
- **#6:** Hook performance overhead -- 100ms budget (RESOLVED: async hooks, budget enforced)
- **#7:** Unbounded log growth -- retention policy (RESOLVED: pre-processing compression)
- **#8:** Exit code confusion -- named constants (RESOLVED: documented in hooks)
- **#9:** Claude Code version incompatibility -- graceful degradation (ONGOING)
- **#10:** Over-automation erodes trust -- recommendation-only default (RESOLVED: fullAuto opt-in)

### Minor (v1.0)
- **#11:** Hook duplicate execution from directory traversal (ONGOING)
- **#12:** Analysis agent context overflow -- pre-processing caps (RESOLVED)
- **#13:** Dynamic plugin discovery fragility -- treat as hints (RESOLVED)
- **#14:** cleanupPeriodDays setting misbehavior (ONGOING)
- **#15:** Long session hook degradation (ONGOING)

---

## Sources

### Official Documentation
- [Node.js -- Publishing a TypeScript package](https://nodejs.org/en/learn/typescript/publishing-a-ts-package) (HIGH confidence)
- [npm scripts lifecycle](https://docs.npmjs.com/cli/v11/using-npm/scripts/) (HIGH confidence)
- [npm Trusted Publishing Docs](https://docs.npmjs.com/trusted-publishers/) (HIGH confidence)
- [Vitest improving performance](https://vitest.dev/guide/improving-performance) (HIGH confidence)

### Package Publishing Guides
- [Create a Modern npm Package in 2026](https://jsmanifest.com/create-modern-npm-package-2026) (MEDIUM confidence)
- [TypeScript in 2025 with ESM and CJS publishing](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing) (MEDIUM confidence)
- [Publishing ESM-based npm packages with TypeScript](https://2ality.com/2025/02/typescript-esm-packages.html) (HIGH confidence)
- [publint package validation](https://blog.logrocket.com/publint-package-validation/) (MEDIUM confidence)
- [Guide to package.json exports field](https://hirok.io/posts/package-json-exports) (MEDIUM confidence)
- [Things you need to do for npm trusted publishing](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/) (MEDIUM confidence)

### Known Tool Issues
- [tsup DTS shebang issue #910](https://github.com/egoist/tsup/issues/910) (HIGH confidence)
- [ESM in executable files -- Node.js #49444](https://github.com/nodejs/node/issues/49444) (HIGH confidence)
- [npm pack hooks issue #7211](https://github.com/npm/cli/issues/7211) (MEDIUM confidence)
- [Are The Types Wrong CLI](https://arethetypeswrong.github.io/) (HIGH confidence)
- [publint.dev](https://publint.dev/) (HIGH confidence)

### Project Codebase Analysis (HIGH confidence)
- `src/storage/dirs.ts` -- module-level path evaluation pattern (line 4)
- `src/delivery/auto-apply.ts` -- current v1 scope restriction (line 122)
- `tests/integration/concurrent-counter.test.ts` -- flaky test mechanism
- `tsup.config.ts` -- current 8 entry points, ESM-only output
- `package.json` -- missing `files`, `bin`, `exports` fields
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` -- known tech debt inventory
