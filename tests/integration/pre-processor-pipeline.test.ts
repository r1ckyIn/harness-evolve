// Integration test: full pre-processing pipeline end-to-end with real file I/O.
// Writes realistic JSONL log files, runs the pre-processor, and validates
// the summary output against the schema and size constraints.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { summarySchema } from '../../src/analysis/schemas.js';

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

// Import after mock setup
const { preProcess } = await import('../../src/analysis/pre-processor.js');

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
 * Create a tool log entry with sensible defaults.
 */
function makeTool(
  toolName: string,
  event: 'pre' | 'post' | 'failure',
  sessionId: string,
  timestamp: string,
  durationMs?: number,
): Record<string, unknown> {
  return {
    timestamp,
    session_id: sessionId,
    event,
    tool_name: toolName,
    input_summary: `${toolName} invocation`,
    ...(durationMs !== undefined ? { duration_ms: durationMs } : {}),
    ...(event === 'post' ? { success: true } : {}),
    ...(event === 'failure' ? { success: false } : {}),
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

describe('pre-processor pipeline integration', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-pipeline-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('processes multi-day logs into summary', async () => {
    const promptsDir = join(tempDir, 'logs', 'prompts');
    const toolsDir = join(tempDir, 'logs', 'tools');
    const permsDir = join(tempDir, 'logs', 'permissions');

    // Day 1: 5 prompts with a repeated one
    await writeJsonlFile(promptsDir, '2026-01-15.jsonl', [
      makePrompt('how do I create a hook?', 'sess-1', '2026-01-15T10:00:00.000Z'),
      makePrompt('run the tests', 'sess-1', '2026-01-15T10:05:00.000Z'),
      makePrompt('fix the bug in auth.ts', 'sess-1', '2026-01-15T10:10:00.000Z'),
      makePrompt('how do I create a hook?', 'sess-1', '2026-01-15T10:15:00.000Z'),
      makePrompt('show me the file structure', 'sess-1', '2026-01-15T10:20:00.000Z'),
    ]);

    // Day 2: 5 prompts, continuing the repeated prompt across sessions
    await writeJsonlFile(promptsDir, '2026-01-16.jsonl', [
      makePrompt('how do I create a hook?', 'sess-2', '2026-01-16T09:00:00.000Z'),
      makePrompt('deploy to production', 'sess-2', '2026-01-16T09:05:00.000Z'),
      makePrompt('run the tests', 'sess-2', '2026-01-16T09:10:00.000Z'),
      makePrompt('check the logs', 'sess-2', '2026-01-16T09:15:00.000Z'),
      makePrompt('update the readme', 'sess-2', '2026-01-16T09:20:00.000Z'),
    ]);

    // Day 3: 5 prompts
    await writeJsonlFile(promptsDir, '2026-01-17.jsonl', [
      makePrompt('run the tests', 'sess-3', '2026-01-17T08:00:00.000Z'),
      makePrompt('how do I create a hook?', 'sess-3', '2026-01-17T08:05:00.000Z'),
      makePrompt('add error handling', 'sess-3', '2026-01-17T08:10:00.000Z'),
      makePrompt('refactor the service', 'sess-3', '2026-01-17T08:15:00.000Z'),
      makePrompt('write documentation', 'sess-3', '2026-01-17T08:20:00.000Z'),
    ]);

    // Tool logs: 2 days, 4 entries per day
    await writeJsonlFile(toolsDir, '2026-01-15.jsonl', [
      makeTool('Bash', 'pre', 'sess-1', '2026-01-15T10:01:00.000Z'),
      makeTool('Bash', 'post', 'sess-1', '2026-01-15T10:01:01.000Z', 150),
      makeTool('Read', 'pre', 'sess-1', '2026-01-15T10:02:00.000Z'),
      makeTool('Read', 'post', 'sess-1', '2026-01-15T10:02:00.500Z', 50),
    ]);
    await writeJsonlFile(toolsDir, '2026-01-16.jsonl', [
      makeTool('Write', 'pre', 'sess-2', '2026-01-16T09:01:00.000Z'),
      makeTool('Write', 'post', 'sess-2', '2026-01-16T09:01:00.200Z', 200),
      makeTool('Bash', 'pre', 'sess-2', '2026-01-16T09:02:00.000Z'),
      makeTool('Bash', 'post', 'sess-2', '2026-01-16T09:02:00.100Z', 100),
    ]);

    // Permission logs: 1 day, 3 entries
    await writeJsonlFile(permsDir, '2026-01-15.jsonl', [
      makePermission('Bash', 'sess-1', '2026-01-15T10:00:30.000Z'),
      makePermission('Write', 'sess-1', '2026-01-15T10:01:30.000Z'),
      makePermission('Bash', 'sess-1', '2026-01-15T10:02:30.000Z'),
    ]);

    const result = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-17'),
    });

    // Verify stats
    expect(result.stats.total_prompts).toBe(15);
    expect(result.stats.total_tool_uses).toBe(8);
    expect(result.stats.total_permissions).toBe(3);

    // Verify repeated prompt detection with cross-session tracking
    // "how do I create a hook?" appears 4 times across 3 sessions
    expect(result.top_repeated_prompts[0].count).toBeGreaterThanOrEqual(3);
    expect(result.top_repeated_prompts[0].sessions).toBeGreaterThanOrEqual(2);

    // Validate against schema
    expect(() => summarySchema.parse(result)).not.toThrow();
  });

  it('produces summary under 50KB', async () => {
    const promptsDir = join(tempDir, 'logs', 'prompts');
    const toolsDir = join(tempDir, 'logs', 'tools');
    const permsDir = join(tempDir, 'logs', 'permissions');

    // Create 100 prompt entries with varied text
    const prompts: Record<string, unknown>[] = [];
    for (let i = 0; i < 100; i++) {
      prompts.push(
        makePrompt(
          `unique prompt number ${i} with some additional text to make it realistic`,
          `sess-${i % 5}`,
          `2026-01-15T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
        ),
      );
    }
    await writeJsonlFile(promptsDir, '2026-01-15.jsonl', prompts);

    // Create 50 tool entries
    const tools: Record<string, unknown>[] = [];
    for (let i = 0; i < 50; i++) {
      tools.push(
        makeTool(
          ['Bash', 'Read', 'Write', 'Edit', 'Glob'][i % 5],
          i % 2 === 0 ? 'pre' : 'post',
          `sess-${i % 5}`,
          `2026-01-15T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
          i % 2 === 1 ? 100 + i : undefined,
        ),
      );
    }
    await writeJsonlFile(toolsDir, '2026-01-15.jsonl', tools);

    // Create 20 permission entries
    const perms: Record<string, unknown>[] = [];
    for (let i = 0; i < 20; i++) {
      perms.push(
        makePermission(
          ['Bash', 'Write', 'Edit'][i % 3],
          `sess-${i % 5}`,
          `2026-01-15T00:${String(i).padStart(2, '0')}:00.000Z`,
        ),
      );
    }
    await writeJsonlFile(permsDir, '2026-01-15.jsonl', perms);

    const result = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });

    const jsonSize = JSON.stringify(result).length;
    expect(jsonSize).toBeLessThan(50 * 1024);
  });

  it('handles malformed JSONL lines gracefully', async () => {
    const promptsDir = join(tempDir, 'logs', 'prompts');
    const toolsDir = join(tempDir, 'logs', 'tools');
    const permsDir = join(tempDir, 'logs', 'permissions');

    // Write a log file with 3 valid entries and 2 malformed lines
    await mkdir(promptsDir, { recursive: true });
    const lines = [
      JSON.stringify(makePrompt('valid prompt 1', 'sess-1', '2026-01-15T10:00:00.000Z')),
      '{bad json line',
      JSON.stringify(makePrompt('valid prompt 2', 'sess-1', '2026-01-15T10:01:00.000Z')),
      '{}',
      JSON.stringify(makePrompt('valid prompt 3', 'sess-1', '2026-01-15T10:02:00.000Z')),
    ];
    await writeFile(
      join(promptsDir, '2026-01-15.jsonl'),
      lines.join('\n') + '\n',
      'utf-8',
    );

    // Create empty tool and permission dirs
    await mkdir(toolsDir, { recursive: true });
    await mkdir(permsDir, { recursive: true });

    const result = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });

    // Only 3 valid entries should be counted (malformed lines skipped)
    expect(result.stats.total_prompts).toBe(3);
  });

  it('writes summary.json to disk', async () => {
    const promptsDir = join(tempDir, 'logs', 'prompts');
    const toolsDir = join(tempDir, 'logs', 'tools');
    const permsDir = join(tempDir, 'logs', 'permissions');

    await writeJsonlFile(promptsDir, '2026-01-15.jsonl', [
      makePrompt('test prompt', 'sess-1', '2026-01-15T10:00:00.000Z'),
    ]);

    // Create empty dirs for tools and permissions
    await mkdir(toolsDir, { recursive: true });
    await mkdir(permsDir, { recursive: true });

    const result = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });

    // Read the written summary from disk
    const summaryPath = join(tempDir, 'analysis', 'pre-processed', 'summary.json');
    const raw = await readFile(summaryPath, 'utf-8');
    const fromDisk = JSON.parse(raw) as Record<string, unknown>;

    // Verify disk content matches returned result
    expect(fromDisk.stats).toEqual(result.stats);
    expect(fromDisk.period).toEqual(result.period);
  });
});
