# Coding Conventions

**Analysis Date:** 2026-04-16

## Naming Patterns

**Files:**
- `kebab-case.ts` for all source files: `user-prompt-submit.ts`, `hook-generator.ts`, `run-evolve.ts`
- `kebab-case.test.ts` for all test files mirroring src structure
- Schema files grouped by domain: `src/schemas/recommendation.ts`, `src/schemas/hook-input.ts`
- Classifier files are single-purpose: `repeated-prompts.ts`, `long-prompts.ts`, `permission-patterns.ts`

**Functions:**
- `camelCase` for all functions: `handleUserPromptSubmit`, `appendLogEntry`, `incrementCounter`
- Hook handlers exported as `handle<EventName>`: `handleUserPromptSubmit`, `handlePreToolUse`, `handlePostToolUse`
- Classifiers exported as `classify<PatternName>`: `classifyRepeatedPrompts`, `classifyPermissionPatterns`
- CLI commands registered via `register<Name>Command(program)`: `registerInitCommand`, `registerStatusCommand`
- Storage read functions: `loadConfig`, `readCounter`
- Storage write functions: `saveState`, `writeFileAtomic` (via `writeFileAtomic`)

**Variables:**
- `camelCase` for all local variables and parameters
- `UPPER_SNAKE_CASE` for module-level constants: `MAX_LEN`, `CONFIDENCE_ORDER`, `DEFAULT_THRESHOLDS`, `SCHEMA_MAP`

**Types:**
- PascalCase for all types and interfaces: `Recommendation`, `AnalysisConfig`, `Counter`, `LogType`
- Zod schemas named `<camelCase>Schema`: `recommendationSchema`, `hookCommonSchema`, `counterSchema`
- TypeScript types always derived from Zod infer: `export type Foo = z.infer<typeof fooSchema>`

**Classes:**
- PascalCase: `HookApplier`, `ClaudeMdApplier`
- Used only for Applier pattern (interface + class) in `src/delivery/appliers/`

## Code Style

**Formatting:**
- No dedicated formatter config detected (no `.prettierrc`, `biome.json`, or `eslint.config.*`)
- Code consistently uses 2-space indentation throughout
- Single quotes for strings in imports; double quotes used in JSDoc and strings
- Trailing commas in multi-line objects and arrays (inferred from code)

**Linting:**
- No ESLint config detected — TypeScript compiler (`tsc --noEmit`) serves as the linter
- `npm run lint` is aliased to `tsc --noEmit`
- `strict: true` in tsconfig enforces no implicit any, strict null checks, strict function types
- `isolatedModules: true` prevents per-file transforms that rely on full program

**TypeScript Config (`tsconfig.json`):**
- `strict: true` — full strict mode
- `target: ES2024`, `module: Node16`, `moduleResolution: Node16`
- `isolatedModules: true`
- `forceConsistentCasingInFileNames: true`
- `resolveJsonModule: true` — allows `import pkg from '../package.json'`

## Import Organization

**Order (observed throughout codebase):**
1. Node built-ins with `node:` protocol prefix: `import { readFile } from 'node:fs/promises'`
2. Third-party packages: `import { z } from 'zod/v4'`, `import writeFileAtomic from 'write-file-atomic'`
3. Internal relative imports with `.js` extension: `import { paths } from '../storage/dirs.js'`

**File Extensions:**
- All internal imports **must** use `.js` extension (even for `.ts` source files) — required by Node16 ESM module resolution

**`import type` Usage:**
- Use `import type` for type-only imports consistently: `import type { Recommendation } from '../../schemas/recommendation.js'`
- Value+type imports merged where practical: `import { counterSchema, type Counter } from '../schemas/counter.js'`

**Path Aliases:**
- None configured — all paths are relative

## Error Handling

**Hook Pattern (Swallow All):**
All hook entry points use a top-level try/catch that swallows errors silently. The invariant is: hooks must never block Claude Code.
```typescript
// Entry point when invoked by Claude Code
async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    await handleUserPromptSubmit(raw);
  } catch {
    // Never block Claude Code
  }
  process.exit(0);
}
```

**Handler Core Pattern (Swallow All):**
Handler functions also wrap their body in try/catch swallowing all errors, with nested try/catch for secondary concerns (e.g., notification injection):
```typescript
export async function handleUserPromptSubmit(rawJson: string): Promise<void> {
  try {
    // ... main logic
    try {
      // secondary concern (notifications)
    } catch {
      // Never block Claude Code on notification errors
    }
  } catch {
    // Never block Claude Code on capture errors
  }
}
```

**Storage Pattern (ENOENT-aware):**
When reading files that may not exist, catch ENOENT and return defaults. Re-throw unexpected errors:
```typescript
export async function loadState(): Promise<RecommendationState> {
  try {
    const raw = await readFile(paths.recommendationState, 'utf-8');
    return recommendationStateSchema.parse(JSON.parse(raw));
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return { entries: [], last_updated: new Date().toISOString() };
    }
    throw err; // Re-throw unexpected errors
  }
}
```

**Node Error Type Guard:**
A private `isNodeError` helper is defined per-file (duplicated in `src/delivery/state.ts` and `src/analysis/outcome-tracker.ts`):
```typescript
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
```

**CLI Error Pattern:**
CLI commands use `console.error(...)` for user-facing errors and `process.exit(1)` for fatal failures. Error messages are formatted as `err instanceof Error ? err.message : String(err)`.

## Logging

**No logging framework** — uses native `console.log` / `console.error`.

**Patterns:**
- CLI commands output JSON via `console.log(JSON.stringify(result, null, 2))` for machine-readable output
- Status/human-readable output uses `console.log(string)` directly (`src/cli/status.ts`)
- Hook handlers never write to stdout except for notification injection (via `process.stdout.write`)
- Hooks must not write to stderr — would corrupt Claude Code output
- Analysis entry point (`src/delivery/run-evolve.ts`) writes JSON summary to stdout for the skill

## Comments

**File-Level Header Comments:**
Every source file opens with a short block comment describing purpose and key design decisions:
```typescript
// UserPromptSubmit hook handler: captures user prompts with metadata.
// Invoked by Claude Code when user submits a prompt.
// Reads JSON from stdin, validates, logs entry, increments counter.
```

**JSDoc on Exported Functions:**
All exported public functions have JSDoc comments. Key elements:
- Single-sentence purpose line
- `@param` for non-obvious parameters
- Inline explanation of key design decisions (why, not what)
- Architecture decision notes inline: `// Uses native fs.appendFile (NOT write-file-atomic) because: ...`

**Inline Comments:**
Used for non-obvious logic, not routine operations. Reference design doc IDs (e.g., `// D-01: scrub before write`, `// CAP-04 transcript_path enrichment`).

**Code Comments Language:**
All comments must be pure English — no Chinese, no bilingual mixing (enforced by CLAUDE.md).

## Function Design

**Size:** Most functions are 10–50 lines. Largest orchestrators (`runAnalysis`, `main`) reach 80–120 lines but are still single-purpose.

**Parameters:**
- Prefer named parameters via object destructuring for 3+ args
- Optional parameters use `?:` not default values in signatures
- Functions that accept configs accept the full schema type, not individual fields

**Return Values:**
- Async functions always return `Promise<T>` with explicit types
- Functions that may return nothing meaningful return `Promise<void>` — never `null`/`undefined` for "nothing"
- Classifiers return `Recommendation[]` (empty array, never null/undefined)

## Module Design

**Exports:**
- Only export what is needed externally — internal helpers are unexported
- `src/index.ts` is the single barrel for the public library API (re-exports everything public)
- CLI submodules use `register<Name>Command(program)` pattern — no default exports

**Schema-Type Co-location:**
All Zod schemas and their inferred TypeScript types are co-located in `src/schemas/`. Each schema file exports both the schema and the type:
```typescript
export const fooSchema = z.object({ ... });
export type Foo = z.infer<typeof fooSchema>;
```

**Classifier Pattern:**
Classifiers are pure functions with the signature `(summary, snapshot, config) => Recommendation[]`. They are registered in `src/analysis/classifiers/index.ts` and called uniformly by the analyzer.

## Zod Schema Patterns

**Version:**
- Uses `zod/v4` subpath import: `import { z } from 'zod/v4'` (not `import { z } from 'zod'`)

**Default Values:**
- Complex nested objects use factory defaults: `.default(() => ({ ...DEFAULT_THRESHOLDS }))`
- Simple fields use literal defaults: `.default(50)`, `.default(true)`
- Constants extracted to `const DEFAULT_X = { ... } as const` before schema definition for reuse

**Schema Extension:**
- Base schemas extended via `.extend()`: `hookCommonSchema.extend({ hook_event_name: z.literal('UserPromptSubmit'), ... })`

**Validation at Boundaries:**
- All external input (stdin, files, config) is validated with `.parse()` or `.safeParse()` immediately on receipt
- Successful parse result is used for all downstream logic — raw input is never passed through

**Strict Config Schemas:**
Config schema uses `.strict()` to reject unknown keys: `z.object({ ... }).strict()`

**Enum + Type Export Pattern:**
```typescript
export const confidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type Confidence = z.infer<typeof confidenceSchema>;
```

**ZodError in Tests:**
Tests import `ZodError` from `zod/v4` directly to assert validation failures:
```typescript
expect(() => patternTypeSchema.parse('invalid')).toThrow(ZodError);
```

## Atomic File Write Patterns

**When to Use `write-file-atomic`:**
Use `writeFileAtomic` for all JSON files that are entirely replaced on write (config, state, counter):
- `src/storage/config.ts` — `loadConfig` writes defaults atomically
- `src/storage/counter.ts` — `incrementCounter` and `resetCounter` write atomically
- `src/delivery/state.ts` — `saveState` writes atomically
- `src/delivery/run-evolve.ts` — writes recommendations markdown atomically

**When NOT to Use `write-file-atomic`:**
Do NOT use for append-only JSONL logs. Use `appendFile` from `node:fs/promises` instead. JSONL is append-only; `write-file-atomic` replaces entire files (anti-pattern for appends).

**Counter Locking Pattern:**
For cross-process safe writes, use `proper-lockfile` around `write-file-atomic`:
```typescript
const release = await lock(paths.counter, {
  retries: { retries: 50, minTimeout: 20, maxTimeout: 1000, randomize: true },
  stale: 10000,
});
try {
  const data = counterSchema.parse(JSON.parse(await readFile(paths.counter, 'utf-8')));
  data.total += 1;
  await writeFileAtomic(paths.counter, JSON.stringify(data, null, 2));
} finally {
  await release();
}
```

---

*Convention analysis: 2026-04-16*
