// Integration test: full analysis pipeline end-to-end with real classifiers.
// Creates realistic JSONL log data, runs preProcess + analyze with no mocking
// of the analysis engine, and validates routing targets and confidence levels.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analysisResultSchema } from '../../src/schemas/recommendation.js';
import type { EnvironmentSnapshot } from '../../src/analysis/schemas.js';

// Temp directory updated per-test
let tempDir: string;

// Mock dirs module to redirect all paths to temp directory
vi.mock('../../src/storage/dirs.js', async () => {
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
        analysisPreProcessed: join(tempDir, 'analysis', 'pre-processed'),
        summary: join(tempDir, 'analysis', 'pre-processed', 'summary.json'),
        environmentSnapshot: join(tempDir, 'analysis', 'environment-snapshot.json'),
        analysisResult: join(tempDir, 'analysis', 'analysis-result.json'),
        pending: join(tempDir, 'pending'),
        config: join(tempDir, 'config.json'),
        counter: join(tempDir, 'counter.json'),
      };
    },
    ensureInit: async () => {
      const { mkdir: mk } = await import('node:fs/promises');
      await mk(join(tempDir, 'logs', 'prompts'), { recursive: true });
      await mk(join(tempDir, 'logs', 'tools'), { recursive: true });
      await mk(join(tempDir, 'logs', 'permissions'), { recursive: true });
      await mk(join(tempDir, 'logs', 'sessions'), { recursive: true });
      await mk(join(tempDir, 'analysis', 'pre-processed'), { recursive: true });
      await mk(join(tempDir, 'analysis'), { recursive: true });
      await mk(join(tempDir, 'pending'), { recursive: true });
    },
    resetInit: () => {},
  };
});

// Import after mock setup -- real analyzer, classifiers, pre-processor (no mocking)
const { preProcess } = await import('../../src/analysis/pre-processor.js');
const { analyze } = await import('../../src/analysis/analyzer.js');
const { writeAnalysisResult } = await import('../../src/analysis/trigger.js');

// --- Helpers ---

/**
 * Write an array of objects as a JSONL file (one JSON per line).
 */
async function writeJsonlFile(
  dir: string,
  filename: string,
  entries: unknown[],
): Promise<void> {
  await mkdir(dir, { recursive: true });
  const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  await writeFile(join(dir, filename), content, 'utf-8');
}

/**
 * Create a prompt log entry with sensible defaults.
 */
function makePrompt(
  prompt: string,
  sessionId: string,
  timestamp: string,
): Record<string, unknown> {
  return {
    timestamp,
    session_id: sessionId,
    cwd: '/home/user/project',
    prompt,
    prompt_length: prompt.length,
  };
}

/**
 * Create a permission log entry with sensible defaults.
 */
function makePermission(
  toolName: string,
  sessionId: string,
  timestamp: string,
): Record<string, unknown> {
  return {
    timestamp,
    session_id: sessionId,
    tool_name: toolName,
    decision: 'unknown',
  };
}

/**
 * Create a minimal environment snapshot for testing.
 */
function makeMinimalSnapshot(
  overrides?: Partial<EnvironmentSnapshot>,
): EnvironmentSnapshot {
  return {
    generated_at: '2026-04-01T00:00:00Z',
    claude_code: {
      version: '2.1.0',
      version_known: true,
      compatible: true,
    },
    settings: {
      user: null,
      project: null,
      local: null,
    },
    installed_tools: {
      plugins: [],
      skills: [],
      rules: [],
      hooks: [],
      claude_md: [],
    },
    detected_ecosystems: [],
    ...overrides,
  };
}

/**
 * Generate a long prompt of approximately the specified word count.
 */
function generateLongPrompt(words: number): string {
  const base = 'implement the complete authentication module with JWT token refresh rotation error handling user role validation middleware session tracking and rate limiting for the API endpoint plus add comprehensive integration tests covering edge cases ';
  const repeated = base.repeat(Math.ceil(words / base.split(/\s+/).length));
  return repeated.split(/\s+/).slice(0, words).join(' ');
}

describe('analysis-pipeline', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-analysis-pipeline-'));
    // Create empty dirs for tools and sessions (not always needed)
    await mkdir(join(tempDir, 'logs', 'tools'), { recursive: true });
    await mkdir(join(tempDir, 'logs', 'sessions'), { recursive: true });
    await mkdir(join(tempDir, 'logs', 'permissions'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('SC-01: prompt repeated 10x -> HOOK with HIGH confidence', async () => {
    const promptsDir = join(tempDir, 'logs', 'prompts');

    // Create "npm test" repeated 10 times across 3 sessions
    const entries: Record<string, unknown>[] = [];
    const sessions = ['sess-1', 'sess-2', 'sess-3'];
    for (let i = 0; i < 10; i++) {
      entries.push(
        makePrompt('npm test', sessions[i % 3], `2026-01-15T${String(10 + i).padStart(2, '0')}:00:00.000Z`),
      );
    }
    await writeJsonlFile(promptsDir, '2026-01-15.jsonl', entries);

    const summary = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });

    const snapshot = makeMinimalSnapshot();
    const result = analyze(summary, snapshot);

    // Find HOOK recommendation for repeated_prompt
    const hookRecs = result.recommendations.filter(
      r => r.target === 'HOOK' && r.pattern_type === 'repeated_prompt',
    );
    expect(hookRecs.length).toBeGreaterThanOrEqual(1);

    const hookRec = hookRecs[0];
    expect(hookRec.confidence).toBe('HIGH');
    expect(hookRec.evidence.count).toBeGreaterThanOrEqual(10);
  });

  it('SC-02: 300-word prompt repeated 3x -> SKILL', async () => {
    const promptsDir = join(tempDir, 'logs', 'prompts');

    const longPrompt = generateLongPrompt(300);

    const entries: Record<string, unknown>[] = [];
    for (let i = 0; i < 3; i++) {
      entries.push(
        makePrompt(longPrompt, `sess-${i}`, `2026-01-15T1${i}:00:00.000Z`),
      );
    }
    await writeJsonlFile(promptsDir, '2026-01-15.jsonl', entries);

    const summary = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });

    const snapshot = makeMinimalSnapshot();
    const result = analyze(summary, snapshot);

    // Find SKILL recommendation for long_prompt
    const skillRecs = result.recommendations.filter(
      r => r.target === 'SKILL' && r.pattern_type === 'long_prompt',
    );
    expect(skillRecs.length).toBeGreaterThanOrEqual(1);
  });

  it('SC-03: tool approved 15x across 4 sessions -> SETTINGS HIGH', async () => {
    const permsDir = join(tempDir, 'logs', 'permissions');
    const promptsDir = join(tempDir, 'logs', 'prompts');

    // Create at least 1 prompt so preProcess has valid data
    await writeJsonlFile(promptsDir, '2026-01-15.jsonl', [
      makePrompt('hello', 'sess-1', '2026-01-15T10:00:00.000Z'),
    ]);

    // Create "Bash(npm test)" approved 15 times across 4 sessions
    // Spread across 2 days to avoid timestamp hour overflow
    const entries1: Record<string, unknown>[] = [];
    const entries2: Record<string, unknown>[] = [];
    const sessions = ['sess-1', 'sess-2', 'sess-3', 'sess-4'];
    for (let i = 0; i < 8; i++) {
      entries1.push(
        makePermission(
          'Bash(npm test)',
          sessions[i % 4],
          `2026-01-15T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
        ),
      );
    }
    for (let i = 0; i < 7; i++) {
      entries2.push(
        makePermission(
          'Bash(npm test)',
          sessions[(i + 2) % 4],
          `2026-01-16T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
        ),
      );
    }
    await writeJsonlFile(permsDir, '2026-01-15.jsonl', entries1);
    await writeJsonlFile(permsDir, '2026-01-16.jsonl', entries2);

    const summary = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-16'),
    });

    const snapshot = makeMinimalSnapshot();
    const result = analyze(summary, snapshot);

    // Find SETTINGS recommendation for permission_approval
    const settingsRecs = result.recommendations.filter(
      r => r.target === 'SETTINGS',
    );
    expect(settingsRecs.length).toBeGreaterThanOrEqual(1);

    const settingsRec = settingsRecs[0];
    expect(settingsRec.confidence).toBe('HIGH');
  });

  it('SC-04: GSD detected -> GSD-specific routing with ecosystem_context', async () => {
    const promptsDir = join(tempDir, 'logs', 'prompts');

    // Create repeated multi-step prompts (count >= 3 to trigger GSD ecosystem classifier)
    const entries: Record<string, unknown>[] = [];
    for (let i = 0; i < 5; i++) {
      entries.push(
        makePrompt('run the deployment', `sess-${i % 2}`, `2026-01-15T1${i}:00:00.000Z`),
      );
    }
    await writeJsonlFile(promptsDir, '2026-01-15.jsonl', entries);

    const summary = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });

    // Snapshot with GSD detected
    const snapshot = makeMinimalSnapshot({
      detected_ecosystems: ['gsd'],
    });

    const result = analyze(summary, snapshot);

    // Find any recommendation with ecosystem_context containing GSD
    const gsdRecs = result.recommendations.filter(
      r => r.ecosystem_context && r.ecosystem_context.toLowerCase().includes('gsd'),
    );
    expect(gsdRecs.length).toBeGreaterThanOrEqual(1);
  });

  it('SC-05: analysisResultSchema validates full output with correct metadata', async () => {
    const promptsDir = join(tempDir, 'logs', 'prompts');
    const permsDir = join(tempDir, 'logs', 'permissions');

    // Create mixed test data: repeated prompts + permissions
    const promptEntries: Record<string, unknown>[] = [];
    for (let i = 0; i < 6; i++) {
      promptEntries.push(
        makePrompt('git status', `sess-${i % 3}`, `2026-01-15T1${i}:00:00.000Z`),
      );
    }
    await writeJsonlFile(promptsDir, '2026-01-15.jsonl', promptEntries);

    const permEntries: Record<string, unknown>[] = [];
    for (let i = 0; i < 12; i++) {
      permEntries.push(
        makePermission('Bash', `sess-${i % 4}`, `2026-01-15T1${i}:00:00.000Z`),
      );
    }
    await writeJsonlFile(permsDir, '2026-01-15.jsonl', permEntries);

    const summary = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });

    const snapshot = makeMinimalSnapshot();
    const result = analyze(summary, snapshot);

    // Validate against schema -- must not throw
    const validated = analysisResultSchema.parse(result);

    expect(validated.metadata.classifier_count).toBe(8);
    expect(validated.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(validated.recommendations.length).toBeLessThanOrEqual(20);
  });

  it('writeAnalysisResult writes valid JSON file to disk', async () => {
    const promptsDir = join(tempDir, 'logs', 'prompts');

    // Create simple test data for a valid result
    await writeJsonlFile(promptsDir, '2026-01-15.jsonl', [
      makePrompt('test', 'sess-1', '2026-01-15T10:00:00.000Z'),
    ]);

    const summary = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });

    const snapshot = makeMinimalSnapshot();
    const result = analyze(summary, snapshot);

    // Write to disk
    await writeAnalysisResult(result);

    // Read back and validate
    const filePath = join(tempDir, 'analysis', 'analysis-result.json');
    const raw = await readFile(filePath, 'utf-8');
    const fromDisk = JSON.parse(raw) as unknown;

    // Must validate against schema
    const validated = analysisResultSchema.parse(fromDisk);
    expect(validated.generated_at).toBe(result.generated_at);
    expect(validated.recommendations.length).toBe(result.recommendations.length);
  });
});
