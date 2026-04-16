# Technology Stack

**Analysis Date:** 2026-04-16

## Languages

**Primary:**
- TypeScript ~6.0 - All source code under `src/`

**Secondary:**
- JavaScript (compiled) - `dist/` output, consumed by Node.js at runtime

## Runtime

**Environment:**
- Node.js >=22.14.0 (user has v22.14.0 installed)
- ESM-only (`"type": "module"` in `package.json`)

**Package Manager:**
- npm 11.6.0
- Lockfile: `package-lock.json` present (v2.0.0 package)

## Frameworks

**Core:**
- None - the project uses Node.js built-ins (`node:fs`, `node:fs/promises`, `node:readline`, `node:path`, `node:child_process`) for all I/O and JSONL processing

**CLI:**
- Commander.js ^14.0.3 - CLI argument parsing (`src/cli.ts`, `src/cli/*.ts`)
- @commander-js/extra-typings ^14.0.0 - Strong TypeScript inference for Commander options

**Validation:**
- Zod ^4.3.6 - Runtime validation of all hook inputs, config, log schemas, recommendation schemas. Used throughout via `import { z } from 'zod/v4'` (subpath import for Zod v4 API)

**Testing:**
- Vitest ^4.1.2 - Unit and integration tests, config at `vitest.config.ts`

**Build/Dev:**
- tsup ^8.5.1 - Bundles TypeScript to ESM, config at `tsup.config.ts`
- tsx ^4.21.0 - Dev-time TypeScript execution (not used in production)

## Key Dependencies

**Critical:**
- `write-file-atomic` ^7.0.0 - Crash-safe file writes for counter, config, analysis result, recommendations file. Used in `src/storage/counter.ts`, `src/storage/config.ts`, `src/delivery/run-evolve.ts`, `src/analysis/trigger.ts`, `src/analysis/environment-scanner.ts`
- `proper-lockfile` ^4.1.2 - Cross-process file locking (mkdir-based, macOS-safe) for counter increments. Used in `src/storage/counter.ts` and `src/analysis/trigger.ts`
- `zod` ^4.3.6 - Every schema module uses Zod for parse-and-validate; see `src/schemas/`

**Infrastructure:**
- `@commander-js/extra-typings` ^14.0.0 - CLI type safety supplement

## Dev Dependencies

- `@arethetypeswrong/cli` ^0.18.2 - Validates TypeScript package exports (`check:attw`)
- `@types/node` ^22.0.0 - Node.js type declarations
- `@types/proper-lockfile` ^4.1.4 - Types for proper-lockfile
- `@types/write-file-atomic` ^4.0.3 - Types for write-file-atomic
- `publint` ^0.3.18 - Validates package.json exports (`check:publint`)
- `typescript` ~6.0.0 - TypeScript compiler (`tsconfig.json`: target ES2024, module Node16)

## TypeScript Configuration

File: `tsconfig.json`
- `target`: ES2024
- `module`: Node16 (with `moduleResolution: Node16`)
- `strict`: true
- `isolatedModules`: true
- `declaration`: true, `declarationMap`: true, `sourceMap`: true
- Source: `src/**/*.ts`, excludes `tests/` from compilation
- `ignoreDeprecations: "6.0"` (TS6 compatibility shim)

## Build Configuration

File: `tsup.config.ts`
- Format: ESM only (`['esm']`)
- Target: node22
- Entries: 10 separate entry points (see table below)
- `splitting: false`, `shims: false`, `sourcemap: true`, `clean: true`

| Entry | Source | Output |
|-------|--------|--------|
| `index` | `src/index.ts` | `dist/index.js` (library public API) |
| `cli` | `src/cli.ts` | `dist/cli.js` (binary `harness-evolve`) |
| `hooks/user-prompt-submit` | `src/hooks/user-prompt-submit.ts` | `dist/hooks/user-prompt-submit.js` |
| `hooks/pre-tool-use` | `src/hooks/pre-tool-use.ts` | `dist/hooks/pre-tool-use.js` |
| `hooks/post-tool-use` | `src/hooks/post-tool-use.ts` | `dist/hooks/post-tool-use.js` |
| `hooks/post-tool-use-failure` | `src/hooks/post-tool-use-failure.ts` | `dist/hooks/post-tool-use-failure.js` |
| `hooks/permission-request` | `src/hooks/permission-request.ts` | `dist/hooks/permission-request.js` |
| `hooks/stop` | `src/hooks/stop.ts` | `dist/hooks/stop.js` |
| `hooks/session-start` | `src/hooks/session-start.ts` | `dist/hooks/session-start.js` |
| `delivery/run-evolve` | `src/delivery/run-evolve.ts` | `dist/delivery/run-evolve.js` |

## Scripts

Defined in `package.json`:

```bash
npm run build          # tsup (compile all entries)
npm test               # vitest run
npm run test:watch     # vitest (watch mode)
npm run test:coverage  # vitest run --coverage
npm run typecheck      # tsc --noEmit
npm run lint           # tsc --noEmit (no separate linter)
npm run check:publint  # publint --strict
npm run check:attw     # attw --pack . --profile esm-only
npm run check:package  # check:publint && check:attw
```

`prepublishOnly` runs: `build` then `check:package`.

## Distribution

**Binary:** `dist/cli.js` registered as `harness-evolve` in `package.json` `bin`
- Install: `npm i -g harness-evolve` (persistent) or `npx harness-evolve` (ephemeral)
- Published to npm registry with provenance (`publishConfig.provenance: true`)
- `files` array: `dist/`, `README.md`, `LICENSE`

**Library:** `dist/index.js` exported as main entry for programmatic use
- All public types and functions exposed via `src/index.ts`
- Named subpath exports for each hook and the delivery runner

**Skill:** `.claude/skills/evolve/SKILL.md` — installed as `~/.claude/skills/evolve` during `harness-evolve init`, invoked via `/evolve` slash skill in Claude Code

## Platform Requirements

**Development:**
- Node.js 22.14.0 (pinned in CI matrix)
- macOS or Linux (proper-lockfile uses mkdir-based locking, macOS-safe)

**Production:**
- Node.js >=22.14.0
- Runs as child processes of Claude Code hook system
- Writes to `~/.harness-evolve/` (data dir, not under the repo)

## CI/CD

File: `.github/workflows/ci.yml`
- Trigger: push/PR to `main`
- Node: 22.14.0 (pinned)
- Steps: `npm install` → `build` → `typecheck` → `test` → `publint --strict` → `attw --pack`

File: `.github/workflows/publish.yml`
- Trigger: `v*` tags
- Publishes to npm with provenance (`id-token: write` permission)

---

*Stack analysis: 2026-04-16*
