<!-- GSD:project-start source:PROJECT.md -->
## Project

**harness-evolve**

An open-source, environment-agnostic self-iteration engine for Claude Code. It observes how users interact with Claude Code, detects patterns, and outputs optimization recommendations routed to the most appropriate configuration tool (hooks, skills, rules, CLAUDE.md, memory, settings, or any future mechanism). The system dynamically discovers what tools are available in the user's environment and adapts its recommendations accordingly.

**Core Value:** **Make Claude Code harnesses self-improving without manual analysis.** Users shouldn't need to notice that they've typed the same command 20 times before creating a hook — the system should surface that insight and suggest the fix.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
### Schema Validation
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zod | ^4.3.6 | Runtime validation of hook JSON input, config files, log schemas | Zod v4 is 14x faster than v3, 57% smaller core. TypeScript-first with inferred types. Industry standard for Node.js validation (40M+ weekly downloads as of v3). |
### CLI Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Commander.js | ^14.0.3 | CLI argument parsing for manual `/evolve` command and config management | Decade of stability, 14M+ weekly downloads, first-class TypeScript support. v14 is the stable channel (v15 is ESM-only pre-release requiring Node 22.12+, which user has, but wait for stable). |
| @commander-js/extra-typings | ^14.x | Strong TypeScript inference for options/actions | Adds generic type inference without runtime cost. |
### Data Persistence
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native `node:fs/promises` | (built-in) | Read/write JSON log files, counter files, recommendation output | No dependency needed for simple file operations. The project uses file-based persistence by design (survives across sessions). |
| write-file-atomic | ^7.0.0 | Atomic writes for counter file and aggregated data | Prevents corruption from concurrent Claude Code instances (Gray Area #3 in PROJECT.md). npm's own package, battle-tested. |
### JSONL Processing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Native line-by-line reading (`readline` + `node:fs`) | (built-in) | Parse Claude Code transcript .jsonl files | JSONL is one-JSON-per-line. `readline.createInterface()` with line-by-line `JSON.parse()` handles this with zero dependencies and streaming memory efficiency. |
### Testing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | ^4.1.2 | Unit and integration testing | Default testing framework for modern TS projects in 2026. Native ESM, TypeScript, fast watch mode. Jest-compatible API for familiarity. |
### Pattern Analysis (Deferred Decision)
| Technology | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Custom frequency counting | N/A | Count command repetitions, tool usage frequencies, permission patterns | Phase 1-2: Simple Map-based counting is sufficient for "user ran `npm test` 47 times" detection |
| winkNLP | ^2.x | NLP tokenization for prompt similarity detection | Phase 3+: Only if prompt deduplication needs semantic similarity beyond string matching. 650K tokens/sec on M1. Defer until proven needed. |
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
## Installation (Development)
# Initialize
# Core dependencies
# Dev dependencies
## Installation (User)
# As Claude Code plugin (preferred)
# Users install via marketplace or git clone to ~/.claude/plugins/
# Or as global CLI
## Hook Registration (settings.json)
## Performance Budget
| Hook | Target Latency | Strategy |
|------|---------------|----------|
| UserPromptSubmit (capture) | <50ms | Append to log file, increment counter, exit. No analysis. |
| UserPromptSubmit (inject) | <100ms | Only on threshold interaction. Read pre-computed recommendations, output to stdout. |
| PermissionRequest | <30ms | Async. Append pattern to log. |
| PreToolUse/PostToolUse | <30ms | Async. Append tool usage to log. |
| Stop (analysis trigger) | <5s | Agent or command hook. Runs pattern analysis on accumulated data. Async so it doesn't block. |
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
