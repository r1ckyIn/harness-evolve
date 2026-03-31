# Technology Stack

**Project:** harness-evolve
**Researched:** 2026-03-31

## Recommended Stack

### Runtime & Language

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | >=22.14.0 (user has v22.14.0 installed) | Runtime | User's current LTS. Node 22 LTS supported until April 2027. No need to upgrade -- hooks run as child processes of Claude Code which ships its own Node, but user scripts need a local Node. v22 is the safe floor. |
| TypeScript | ~6.0 | Type safety, schema generation | Latest release (March 2026). Last JS-based compiler before Go-rewrite TS7. Stable, well-supported. |

### Build & Bundling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tsup | ^8.5.1 | Bundle TypeScript to JS for distribution | tsup is battle-tested, zero-config, esbuild-powered. Yes, tsup author recommends tsdown now, but tsdown is v0.14 (pre-1.0) -- too risky for a tool that must be rock-solid. tsup 8.x works, is stable, and has massive ecosystem adoption. Revisit tsdown when it hits 1.0. |
| tsx | ^4.x | Dev-time TypeScript execution | Run .ts files directly during development without compilation step. Not used in production -- hooks run compiled JS. |

**Why NOT tsdown:** Pre-1.0 (v0.14), API surface still changing. For a CLI tool distributed as an npm package, build stability matters more than marginal speed gains. tsdown is the future, but not ready today.

**Why NOT esbuild directly:** tsup wraps esbuild with sensible defaults (entry detection, multiple output formats, .d.ts generation). Raw esbuild requires manual config for all of these.

### Schema Validation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zod | ^4.3.6 | Runtime validation of hook JSON input, config files, log schemas | Zod v4 is 14x faster than v3, 57% smaller core. TypeScript-first with inferred types. Industry standard for Node.js validation (40M+ weekly downloads as of v3). |

**Why NOT Valibot:** Smaller bundle (~10KB vs ~52KB) but smaller ecosystem, fewer community schemas, and this project may integrate with @constellos/claude-code-kit which uses Zod. Consistency wins.

**Why NOT io-ts / Arktype:** io-ts is fp-ts dependent (heavy). Arktype is excellent but less ecosystem adoption for Claude Code tooling.

### CLI Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Commander.js | ^14.0.3 | CLI argument parsing for manual `/evolve` command and config management | Decade of stability, 14M+ weekly downloads, first-class TypeScript support. v14 is the stable channel (v15 is ESM-only pre-release requiring Node 22.12+, which user has, but wait for stable). |
| @commander-js/extra-typings | ^14.x | Strong TypeScript inference for options/actions | Adds generic type inference without runtime cost. |

**Why NOT oclif:** Heavyweight framework (Salesforce). This tool has ~5 commands max. Commander's simplicity is the right fit.

**Why NOT yargs:** Commander has cleaner TypeScript DX and lighter footprint. yargs is fine but more verbose.

**Why NOT citty/cleye:** Newer alternatives with good TS support but much smaller ecosystems. Commander's stability and docs win for an open-source tool.

### Data Persistence

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `node:fs/promises` | (built-in) | Read/write JSON log files, counter files, recommendation output | No dependency needed for simple file operations. The project uses file-based persistence by design (survives across sessions). |
| write-file-atomic | ^7.0.0 | Atomic writes for counter file and aggregated data | Prevents corruption from concurrent Claude Code instances (Gray Area #3 in PROJECT.md). npm's own package, battle-tested. |

**Why NOT lowdb:** lowdb is a JSON database wrapper -- overkill. The data model here is append-only logs + a counter + periodic snapshots. Direct file I/O with atomic writes is simpler, faster, and has zero abstraction overhead.

**Why NOT SQLite / better-sqlite3:** The entire data model is: (1) append JSON lines to a log, (2) read/increment a counter, (3) write analysis results. A database adds complexity without benefit. If cross-session querying becomes complex later, reconsider.

**Why NOT conf/configstore:** These are for user preferences (key-value). Our data is structured logs and analysis output -- different shape.

### JSONL Processing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native line-by-line reading (`readline` + `node:fs`) | (built-in) | Parse Claude Code transcript .jsonl files | JSONL is one-JSON-per-line. `readline.createInterface()` with line-by-line `JSON.parse()` handles this with zero dependencies and streaming memory efficiency. |

**Why NOT stream-json:** stream-json's jsonl/Parser is faster for huge files, but adds a dependency for something `readline` handles natively. Claude Code transcripts are per-session (~1-10MB). If performance becomes an issue with cross-session aggregation of 50+ files, add stream-json then.

**Why NOT @constellos/claude-code-kit:** Considered but NOT as a core dependency. It provides Zod schemas for transcript parsing, but: (1) it's a third-party package with unknown maintenance commitment, (2) the Zod schemas it exports may drift from actual Claude Code format, (3) our tool needs to be resilient to schema changes. Instead: define our own Zod schemas (informed by their work) and own the validation layer. Reference their schemas during development for correctness but don't depend on them at runtime.

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | ^4.1.2 | Unit and integration testing | Default testing framework for modern TS projects in 2026. Native ESM, TypeScript, fast watch mode. Jest-compatible API for familiarity. |

**Why NOT Jest:** Vitest is faster, has native ESM/TS support without transforms, and is the ecosystem standard for new projects in 2026. Jest 30+ works but requires more config.

### Pattern Analysis (Deferred Decision)

| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Custom frequency counting | N/A | Count command repetitions, tool usage frequencies, permission patterns | Phase 1-2: Simple Map-based counting is sufficient for "user ran `npm test` 47 times" detection |
| winkNLP | ^2.x | NLP tokenization for prompt similarity detection | Phase 3+: Only if prompt deduplication needs semantic similarity beyond string matching. 650K tokens/sec on M1. Defer until proven needed. |

**Why NOT natural / node-nlp:** These are heavier NLP frameworks for chatbot-building. We need frequency counting and optional similarity detection, not entity extraction or sentiment analysis.

**Why start with custom:** The PROJECT.md patterns are countable (repeated commands, repeated prompts, permission approvals). A `Map<string, number>` with thresholds is the right first tool. NLP is premature optimization.

## Alternatives Considered (Summary)

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Runtime | Node.js 22 | Node.js 24 LTS | User already on 22, works fine, no need to force upgrade |
| Bundler | tsup 8.x | tsdown 0.14 | Pre-1.0, API unstable |
| Validation | Zod 4.x | Valibot | Smaller ecosystem, no Claude Code tooling integration |
| CLI | Commander 14 | oclif | Overkill for ~5 commands |
| Persistence | write-file-atomic + native fs | lowdb / SQLite | Overkill for append-only logs + counter |
| JSONL | Native readline | stream-json | Over-engineered for per-session files |
| Testing | Vitest 4.x | Jest 30+ | More config, slower, no native ESM |
| Transcript types | Own Zod schemas | @constellos/claude-code-kit | Third-party dependency risk for core parsing |

## Project Structure

```
harness-evolve/
  src/
    hooks/              # Hook handler scripts (compiled to JS)
      user-prompt.ts    # UserPromptSubmit handler
      permission.ts     # PermissionRequest handler
      tool-use.ts       # PreToolUse/PostToolUse handler
      session-end.ts    # Stop/SessionEnd handler
    analysis/           # Pattern detection engine
      counter.ts        # Interaction counter (file-based)
      patterns.ts       # Frequency analysis, dedup
      router.ts         # Pattern -> recommendation routing
    discovery/          # Environment scanner
      scanner.ts        # Discover installed tools/plugins
      capabilities.ts   # Map tool capabilities
    output/             # Recommendation generation
      formatter.ts      # Format recommendations.md
      injector.ts       # UserPromptSubmit stdout injection
    schemas/            # Zod schemas
      hook-input.ts     # Claude Code hook JSON schemas
      transcript.ts     # JSONL transcript schemas
      config.ts         # harness-evolve config schema
    cli/                # Commander CLI
      index.ts          # Entry point
      commands/         # evolve, config, status commands
    utils/              # Shared utilities
      file.ts           # Atomic file ops
      jsonl.ts          # JSONL reader
  dist/                 # Compiled output (tsup)
  tests/                # Vitest tests
  package.json
  tsconfig.json
  tsup.config.ts
  vitest.config.ts
```

## Installation (Development)

```bash
# Initialize
npm init -y

# Core dependencies
npm install zod commander write-file-atomic

# Dev dependencies
npm install -D typescript@~6.0 tsup tsx vitest @types/node @commander-js/extra-typings
```

## Installation (User)

```bash
# As Claude Code plugin (preferred)
# Users install via marketplace or git clone to ~/.claude/plugins/

# Or as global CLI
npm install -g harness-evolve
```

## Hook Registration (settings.json)

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "type": "command",
        "command": "node ~/.claude/plugins/harness-evolve/dist/hooks/user-prompt.js"
      }
    ],
    "PermissionRequest": [
      {
        "type": "command",
        "command": "node ~/.claude/plugins/harness-evolve/dist/hooks/permission.js",
        "async": true
      }
    ],
    "PreToolUse": [
      {
        "type": "command",
        "command": "node ~/.claude/plugins/harness-evolve/dist/hooks/tool-use.js",
        "async": true
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "node ~/.claude/plugins/harness-evolve/dist/hooks/session-end.js",
        "async": true
      }
    ]
  }
}
```

## Performance Budget

| Hook | Target Latency | Strategy |
|------|---------------|----------|
| UserPromptSubmit (capture) | <50ms | Append to log file, increment counter, exit. No analysis. |
| UserPromptSubmit (inject) | <100ms | Only on threshold interaction. Read pre-computed recommendations, output to stdout. |
| PermissionRequest | <30ms | Async. Append pattern to log. |
| PreToolUse/PostToolUse | <30ms | Async. Append tool usage to log. |
| Stop (analysis trigger) | <5s | Agent or command hook. Runs pattern analysis on accumulated data. Async so it doesn't block. |

**Critical constraint:** UserPromptSubmit is synchronous by nature (its stdout injects into Claude's context). Keep capture fast (<50ms). Only do heavy work on the threshold interaction or at Stop.

## Sources

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) -- Official hook documentation (HIGH confidence)
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) -- Official automate workflows guide (HIGH confidence)
- [Claude Code Settings](https://code.claude.com/docs/en/settings) -- Official settings documentation (HIGH confidence)
- [Vitest 4.0 Release](https://vitest.dev/blog/vitest-4) -- Vitest 4.0 announcement (HIGH confidence)
- [Zod v4 Release Notes](https://zod.dev/v4) -- Zod v4 documentation (HIGH confidence)
- [tsup Documentation](https://tsup.egoist.dev/) -- tsup bundler docs (HIGH confidence)
- [tsdown Introduction](https://tsdown.dev/guide/) -- tsdown bundler, considered but deferred (MEDIUM confidence)
- [Commander.js](https://github.com/tj/commander.js) -- CLI framework (HIGH confidence)
- [write-file-atomic](https://github.com/npm/write-file-atomic) -- Atomic file writes (HIGH confidence)
- [TypeScript 6.0 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) -- TS6 release (HIGH confidence)
- [@constellos/claude-code-kit](https://github.com/constellos/claude-code) -- Reference for transcript schemas (MEDIUM confidence)
- [stream-json](https://github.com/uhop/stream-json) -- JSONL streaming, deferred (MEDIUM confidence)
- [Building CLI apps with TypeScript in 2026](https://hackers.pub/@hongminhee/2026/typescript-cli-2026) -- Ecosystem overview (MEDIUM confidence)
