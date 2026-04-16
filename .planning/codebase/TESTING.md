# Testing Patterns

**Analysis Date:** 2026-04-16

## Test Framework

**Runner:**
- Vitest 4.1.2
- Config: `vitest.config.ts`
- Environment: `node`
- Test pattern: `tests/**/*.test.ts`

**Assertion Library:**
- Vitest built-in (`expect`, `toBe`, `toEqual`, `toHaveLength`, `toBeInstanceOf`, etc.)
- No separate assertion library

**Coverage:**
- Provider: V8 (`@vitest/coverage-v8`)
- Source: `src/**/*.ts`

**Run Commands:**
```bash
npm test                # Run all tests (vitest run)
npm run test:watch      # Watch mode (vitest)
npm run test:coverage   # Coverage report (vitest run --coverage)
npm run typecheck       # Type-check only (tsc --noEmit)
```

## Test File Organization

**Location:**
- Separate `tests/` directory — NOT co-located with source
- Structure mirrors `src/` exactly

**Naming:**
- `<module-name>.test.ts` mirroring the source file path
- Example: `src/analysis/analyzer.ts` → `tests/unit/analysis/analyzer.test.ts`

**Directory Structure:**
```
tests/
├── unit/
│   ├── analysis/
│   │   ├── analyzer.test.ts
│   │   ├── helpers.ts            # Shared test helpers (makeEmptySummary, etc.)
│   │   ├── classifiers/
│   │   │   ├── repeated-prompts.test.ts
│   │   │   ├── long-prompts.test.ts
│   │   │   └── ...
│   │   ├── environment-scanner.test.ts
│   │   ├── jsonl-reader.test.ts
│   │   └── ...
│   ├── hooks/
│   │   ├── user-prompt-submit.test.ts
│   │   ├── shared.test.ts
│   │   └── ...
│   ├── delivery/
│   │   ├── state.test.ts
│   │   ├── renderer.test.ts
│   │   └── ...
│   ├── schemas/
│   │   └── recommendation.test.ts
│   ├── cli/
│   │   ├── init.test.ts
│   │   └── ...
│   ├── counter.test.ts
│   ├── logger.test.ts
│   └── ...
├── integration/
│   ├── hook-pipeline.test.ts
│   ├── analysis-pipeline.test.ts
│   ├── concurrent-counter.test.ts
│   ├── delivery-pipeline.test.ts
│   └── ...
├── helpers/
│   └── increment-worker.ts       # Child process worker for concurrency tests
└── fixtures/
    └── model-validation/         # Static fixture configs for scan tests
        ├── cross-file-inconsistency/
        ├── guidance-extensibility/
        ├── natural-language-hookable/
        └── semantic-conflict/
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('<ModuleName>', () => {
  // Nested describe for sub-features
  describe('<functionName>', () => {
    it('<specific behavior description>', () => {
      // arrange
      // act
      // assert
    });
  });
});
```

**Flat structure for pure functions** (classifiers, schemas):
```typescript
describe('classifyRepeatedPrompts', () => {
  it('returns HOOK with HIGH confidence for count=10, sessions=3, short prompt', () => { ... });
  it('returns HOOK with MEDIUM confidence for count=5, sessions=2, short prompt', () => { ... });
  it('returns no recommendation for count=3 (below default threshold 5)', () => { ... });
});
```

**Nested describe for grouped scenarios** (state, delivery, schemas with variants):
```typescript
describe('state', () => {
  describe('loadState', () => { ... });
  describe('saveState / loadState round-trip', () => { ... });
  describe('updateStatus', () => { ... });
  describe('getStatusMap', () => { ... });
});
```

**Patterns:**
- `beforeEach`: create `tempDir` via `mkdtemp`, stub `HOME` env, call `vi.resetModules()`
- `afterEach`: restore modules `vi.resetModules()`, unstub envs `vi.unstubAllEnvs()`, remove `tempDir` with `rm(tempDir, { recursive: true, force: true })`
- `beforeEach`/`afterEach` manage classifiers array mutation for analyzer tests (save length, restore with `classifiers.length = originalLength`)

## Mocking

**Framework:** Vitest's built-in `vi.mock`, `vi.stubEnv`, `vi.resetModules`

**Primary Mocking Pattern — Module Mock for `dirs.js`:**
The most common mock is redirecting `src/storage/dirs.js` to a temp directory. This is repeated in nearly every test that touches storage. Pattern uses a getter to pick up the per-test `tempDir` value:

```typescript
let tempDir: string;

vi.mock('../../../src/storage/dirs.js', async () => {
  return {
    get paths() {
      return {
        base: tempDir,
        logs: {
          prompts: join(tempDir, 'logs', 'prompts'),
          tools: join(tempDir, 'logs', 'tools'),
          permissions: join(tempDir, 'logs', 'permissions'),
          sessions: join(tempDir, 'logs', 'sessions'),
        },
        analysis: join(tempDir, 'analysis'),
        config: join(tempDir, 'config.json'),
        counter: join(tempDir, 'counter.json'),
      };
    },
    ensureInit: async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(tempDir, 'logs', 'prompts'), { recursive: true });
      // ... create all required dirs
    },
    resetInit: () => {},
  };
});

// CRITICAL: Import subject AFTER mock is set up
const { handleUserPromptSubmit } = await import('../../../src/hooks/user-prompt-submit.js');
```

**Environment Variable Stubbing:**
Use `vi.stubEnv` to override `HOME` for storage isolation in tests that use `vi.resetModules()`:
```typescript
vi.stubEnv('HOME', tempDir);
vi.resetModules();
// Then dynamically import module to pick up new HOME
const { incrementCounter } = await import('../../src/storage/counter.js');
```

**Module Reset Pattern:**
For tests that need fresh module state (e.g., counter tests with `resetInit`):
```typescript
beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'harness-evolve-counter-'));
  vi.stubEnv('HOME', tempDir);
  vi.resetModules();
});
afterEach(async () => {
  vi.resetModules();
  vi.unstubAllEnvs();
  await rm(tempDir, { recursive: true, force: true });
});

it('some test', async () => {
  const { resetInit } = await import('../../src/storage/dirs.js');
  const { incrementCounter } = await import('../../src/storage/counter.js');
  resetInit(); // Reset module-level initialized flag
  // ...
});
```

**What to Mock:**
- `src/storage/dirs.js` — always mock when testing anything that writes to disk
- Environment variables (`HOME`) — for storage path isolation

**What NOT to Mock:**
- Zod schemas — test real validation behavior
- Classifiers — analyzer tests use real classifiers (push to array for extension)
- Pre-processor and analyzer — integration tests use real implementations

## Fixtures and Factories

**Helper Factory Functions (shared per test domain):**
Located in `tests/unit/analysis/helpers.ts`. Used by all classifier and analyzer tests:
```typescript
export function makeEmptySummary(): Summary {
  return {
    generated_at: '2026-04-01T00:00:00Z',
    period: { since: '2026-03-01', until: '2026-03-31', days: 30 },
    stats: { total_prompts: 0, total_tool_uses: 0, total_permissions: 0, unique_sessions: 0 },
    top_repeated_prompts: [],
    tool_frequency: [],
    permission_patterns: [],
    long_prompts: [],
  };
}

export function makeEmptySnapshot(): EnvironmentSnapshot { ... }
export function makeDefaultConfig(): AnalysisConfig {
  return analysisConfigSchema.parse({});
}
```

**Local Factory Functions in Integration Tests:**
Integration tests define local helper factories inline:
```typescript
function makePromptInput(prompt: string, sessionId = 'test-session'): string {
  return JSON.stringify({ session_id: sessionId, hook_event_name: 'UserPromptSubmit', prompt, ... });
}
function makeToolInput(event: string, toolUseId: string, toolName = 'Bash'): string { ... }
```

**Static Fixtures:**
Located in `tests/fixtures/model-validation/`. Each sub-directory contains a `.claude/` directory with realistic `settings.json`, rules, and `CLAUDE.md` files for scan pipeline tests.
- `tests/fixtures/model-validation/cross-file-inconsistency/`
- `tests/fixtures/model-validation/guidance-extensibility/`
- `tests/fixtures/model-validation/natural-language-hookable/`
- `tests/fixtures/model-validation/semantic-conflict/`

**Base Object Spread Pattern for Schema Tests:**
```typescript
const baseRecommendation = {
  id: 'rec-test-0',
  target: 'HOOK',
  confidence: 'HIGH',
  // ... required fields
};

it('accepts valid variant', () => {
  const result = recommendationSchema.parse({ ...baseRecommendation, severity: 'problem' });
  expect(result.severity).toBe('problem');
});
```

## Coverage

**Requirements:** No enforced coverage threshold — no `coverage.thresholds` in config.

**View Coverage:**
```bash
npm run test:coverage
```
Output directory: Not explicitly configured, defaults to `./coverage/`.

## Test Types

**Unit Tests (`tests/unit/`):**
- Scope: Single exported function, pure logic
- Approach: Direct function call with factory inputs
- Mocking: Mock `dirs.js` for storage-touching tests; pure functions need no mocks
- Key patterns: Classifier tests mutate `makeEmptySummary()` inline, asserting `Recommendation[]` shape

**Integration Tests (`tests/integration/`):**
- Scope: Full pipeline from hook handler through to disk or through to analysis result
- Approach: Real file I/O with temp directories; all storage paths redirected via `dirs.js` mock
- Tests verify: actual file content written to disk, counter incremented, JSONL lines parseable
- Schema validation: integration tests assert that outputs pass `analysisResultSchema.parse()`

**Concurrency Tests (`tests/integration/concurrent-counter.test.ts`):**
- Scope: Cross-process correctness of the counter under concurrent writes
- Approach: Uses `fork()` with tsx loader to spawn real child processes running `tests/helpers/increment-worker.ts`
- Timeout: `{ timeout: 60000 }` (60 seconds)
- Asserts exact count after parallel execution

**E2E Tests (`tests/integration/e2e-flows.test.ts`):**
- Scope: CLI command invocations (`harness-evolve init`, `harness-evolve status`)
- Approach: Child process spawning with real binary

## Common Patterns

**Async Testing:**
```typescript
it('increments counter', async () => {
  await handleUserPromptSubmit(JSON.stringify(validInput));
  const counter = JSON.parse(await readFile(counterPath, 'utf-8'));
  expect(counter.total).toBe(1);
});
```

**Error/Resilience Testing:**
Hook handlers must never throw — test this explicitly:
```typescript
it('does not throw on malformed input', async () => {
  await expect(handleUserPromptSubmit('not valid json {')).resolves.not.toThrow();
});

it('does not throw on missing fields', async () => {
  const incomplete = JSON.stringify({ session_id: 's1' });
  await expect(handleUserPromptSubmit(incomplete)).resolves.not.toThrow();
});
```

**Zod Validation Error Testing:**
```typescript
it('rejects invalid pattern type', () => {
  expect(() => patternTypeSchema.parse('invalid-type')).toThrow(ZodError);
});

it('accepts valid variant', () => {
  const result = recommendationSchema.safeParse({ ...base, pattern_type: 'repeated_prompt' });
  expect(result.success).toBe(true);
});
```

**Classifier Extension Testing:**
For analyzer tests that need to inject mock classifiers, push to the exported `classifiers` array and restore length in `afterEach`:
```typescript
beforeEach(() => { originalLength = classifiers.length; });
afterEach(() => { classifiers.length = originalLength; });

it('iterates all registered classifiers', () => {
  const mockClassifier: Classifier = (_s, _sn, _c) => [{ id: 'mock', ... }];
  classifiers.push(mockClassifier);
  const result = analyze(summary, snapshot);
  expect(result.recommendations.find(r => r.id === 'mock')).toBeDefined();
});
```

**JSONL Read Helper (in integration tests):**
```typescript
async function readLogEntries(logDir: string): Promise<Record<string, unknown>[]> {
  const files = (await readdir(logDir)).sort();
  const entries: Record<string, unknown>[] = [];
  for (const file of files) {
    const content = await readFile(join(logDir, file), 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    for (const line of lines) {
      entries.push(JSON.parse(line));
    }
  }
  return entries;
}
```

---

*Testing analysis: 2026-04-16*
