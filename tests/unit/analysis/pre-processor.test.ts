// Unit tests for pre-processor: frequency counting, cross-session
// aggregation, summary generation, and long prompt detection.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PromptEntry, ToolEntry, PermissionEntry } from '../../../src/schemas/log-entry.js';
import { summarySchema } from '../../../src/analysis/schemas.js';

// Mock dependencies before importing the module under test
vi.mock('../../../src/analysis/jsonl-reader.js', () => ({
  readLogEntries: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/storage/dirs.js', () => ({
  paths: {
    logs: {
      prompts: '/mock/logs/prompts',
      tools: '/mock/logs/tools',
      permissions: '/mock/logs/permissions',
    },
    summary: '/mock/analysis/pre-processed/summary.json',
  },
  ensureInit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('write-file-atomic', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

import { preProcess } from '../../../src/analysis/pre-processor.js';
import { readLogEntries } from '../../../src/analysis/jsonl-reader.js';
import writeFileAtomic from 'write-file-atomic';

const mockedRead = vi.mocked(readLogEntries);
const mockedWrite = vi.mocked(writeFileAtomic);

// Helper to create a prompt entry
function makePrompt(prompt: string, sessionId = 'session-A'): PromptEntry {
  return {
    timestamp: '2026-03-15T10:00:00Z',
    session_id: sessionId,
    cwd: '/home/user',
    prompt,
    prompt_length: prompt.length,
  };
}

// Helper to create a tool entry
function makeTool(
  toolName: string,
  event: 'pre' | 'post' | 'failure',
  sessionId = 'session-A',
  durationMs?: number,
): ToolEntry {
  return {
    timestamp: '2026-03-15T10:00:00Z',
    session_id: sessionId,
    event,
    tool_name: toolName,
    duration_ms: durationMs,
    success: event === 'post' ? true : undefined,
  };
}

// Helper to create a permission entry
function makePermission(toolName: string, sessionId = 'session-A'): PermissionEntry {
  return {
    timestamp: '2026-03-15T10:00:00Z',
    session_id: sessionId,
    tool_name: toolName,
    decision: 'approved',
  };
}

describe('preProcess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return empty arrays for all entry types
    mockedRead.mockResolvedValue([]);
  });

  it('computes frequency counts for repeated prompts', async () => {
    const prompts = [
      makePrompt('hello world'),
      makePrompt('hello world'),
      makePrompt('hello world'),
      makePrompt('goodbye'),
      makePrompt('testing'),
    ];
    mockedRead.mockImplementation(async (_dir, schema) => {
      // Identify by the dir path to return the correct data type
      if ((_dir as string).includes('prompts')) return prompts as never[];
      return [];
    });

    const result = await preProcess();

    expect(result.top_repeated_prompts[0].prompt).toBe('hello world');
    expect(result.top_repeated_prompts[0].count).toBe(3);
    expect(result.stats.total_prompts).toBe(5);
  });

  it('normalizes prompts before counting', async () => {
    const prompts = [
      makePrompt('Hello World'),
      makePrompt('  hello   world  '),
      makePrompt('HELLO WORLD'),
    ];
    mockedRead.mockImplementation(async (_dir) => {
      if ((_dir as string).includes('prompts')) return prompts as never[];
      return [];
    });

    const result = await preProcess();

    expect(result.top_repeated_prompts.length).toBe(1);
    expect(result.top_repeated_prompts[0].count).toBe(3);
    expect(result.top_repeated_prompts[0].prompt).toBe('hello world');
  });

  it('tracks cross-session counts', async () => {
    const prompts = [
      makePrompt('test', 'session-A'),
      makePrompt('test', 'session-A'),
      makePrompt('test', 'session-A'),
      makePrompt('test', 'session-B'),
      makePrompt('test', 'session-B'),
      makePrompt('test', 'session-B'),
      makePrompt('test', 'session-B'),
    ];
    mockedRead.mockImplementation(async (_dir) => {
      if ((_dir as string).includes('prompts')) return prompts as never[];
      return [];
    });

    const result = await preProcess();

    expect(result.top_repeated_prompts[0].count).toBe(7);
    expect(result.top_repeated_prompts[0].sessions).toBe(2);
  });

  it('limits top_repeated_prompts to topN', async () => {
    // Create 30 unique prompts
    const prompts = Array.from({ length: 30 }, (_, i) =>
      makePrompt(`unique prompt ${i}`),
    );
    mockedRead.mockImplementation(async (_dir) => {
      if ((_dir as string).includes('prompts')) return prompts as never[];
      return [];
    });

    const result = await preProcess({ topN: 5 });

    expect(result.top_repeated_prompts.length).toBe(5);
  });

  it('computes tool frequency with average duration', async () => {
    const tools = [
      makeTool('Bash', 'pre', 'session-A'),
      makeTool('Bash', 'post', 'session-A', 100),
      makeTool('Bash', 'post', 'session-A', 200),
    ];
    mockedRead.mockImplementation(async (_dir) => {
      if ((_dir as string).includes('tools')) return tools as never[];
      return [];
    });

    const result = await preProcess();

    const bash = result.tool_frequency.find((t) => t.tool_name === 'Bash');
    expect(bash).toBeDefined();
    expect(bash!.count).toBe(3);
    expect(bash!.avg_duration_ms).toBe(150);
  });

  it('computes permission patterns with cross-session', async () => {
    const permissions = [
      makePermission('Bash', 'session-A'),
      makePermission('Bash', 'session-B'),
      makePermission('Bash', 'session-C'),
      makePermission('Write', 'session-A'),
    ];
    mockedRead.mockImplementation(async (_dir) => {
      if ((_dir as string).includes('permissions')) return permissions as never[];
      return [];
    });

    const result = await preProcess();

    const bash = result.permission_patterns.find((p) => p.tool_name === 'Bash');
    expect(bash).toBeDefined();
    expect(bash!.count).toBe(3);
    expect(bash!.sessions).toBe(3);
  });

  it('detects long prompts over 200 words', async () => {
    const longText = Array(250).fill('word').join(' ');
    const shortText = Array(50).fill('word').join(' ');
    const prompts = [makePrompt(longText), makePrompt(shortText)];
    mockedRead.mockImplementation(async (_dir) => {
      if ((_dir as string).includes('prompts')) return prompts as never[];
      return [];
    });

    const result = await preProcess();

    expect(result.long_prompts.length).toBe(1);
    expect(result.long_prompts[0].length).toBe(250);
    expect(result.long_prompts[0].count).toBe(1);
  });

  it('truncates prompt text to 100 chars in output', async () => {
    const longPrompt = 'a'.repeat(200);
    const prompts = [makePrompt(longPrompt)];
    mockedRead.mockImplementation(async (_dir) => {
      if ((_dir as string).includes('prompts')) return prompts as never[];
      return [];
    });

    const result = await preProcess();

    expect(result.top_repeated_prompts[0].prompt.length).toBeLessThanOrEqual(100);
  });

  it('produces summary under 50KB', async () => {
    // Generate 1000 prompt entries to stress-test size
    const prompts = Array.from({ length: 1000 }, (_, i) =>
      makePrompt(`prompt number ${i % 100}`, `session-${i % 10}`),
    );
    mockedRead.mockImplementation(async (_dir) => {
      if ((_dir as string).includes('prompts')) return prompts as never[];
      return [];
    });

    const result = await preProcess();
    const json = JSON.stringify(result);

    expect(json.length).toBeLessThan(50 * 1024);
  });

  it('validates output against summarySchema', async () => {
    const prompts = [makePrompt('test prompt')];
    mockedRead.mockImplementation(async (_dir) => {
      if ((_dir as string).includes('prompts')) return prompts as never[];
      return [];
    });

    const result = await preProcess();

    // Should not throw
    expect(() => summarySchema.parse(result)).not.toThrow();
  });

  it('defaults to 30-day range when no options given', async () => {
    await preProcess();

    // readLogEntries should have been called 3 times (prompts, tools, permissions)
    expect(mockedRead).toHaveBeenCalledTimes(3);

    // Check the since option is approximately 30 days ago
    const firstCall = mockedRead.mock.calls[0];
    const options = firstCall[2] as { since?: Date; until?: Date };
    expect(options.since).toBeInstanceOf(Date);
    expect(options.until).toBeInstanceOf(Date);

    const diffMs = options.until!.getTime() - options.since!.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it('writes summary to disk atomically', async () => {
    const prompts = [makePrompt('hello')];
    mockedRead.mockImplementation(async (_dir) => {
      if ((_dir as string).includes('prompts')) return prompts as never[];
      return [];
    });

    await preProcess();

    expect(mockedWrite).toHaveBeenCalledTimes(1);
    const [writePath, writeContent] = mockedWrite.mock.calls[0];
    expect(writePath).toBe('/mock/analysis/pre-processed/summary.json');

    // Verify compact JSON (no pretty-printing newlines in the output)
    const content = writeContent as string;
    expect(content).not.toContain('\n');

    // Verify it's valid JSON
    expect(() => JSON.parse(content)).not.toThrow();
  });
});
