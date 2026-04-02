import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock dirs module to use temp directory instead of ~/.harness-evolve/
let tempDir: string;

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
        config: join(tempDir, 'config.json'),
        counter: join(tempDir, 'counter.json'),
      };
    },
    ensureInit: async () => {
      const { mkdir } = await import('node:fs/promises');
      await mkdir(join(tempDir, 'logs', 'prompts'), { recursive: true });
      await mkdir(join(tempDir, 'logs', 'tools'), { recursive: true });
      await mkdir(join(tempDir, 'logs', 'permissions'), { recursive: true });
      await mkdir(join(tempDir, 'logs', 'sessions'), { recursive: true });
      await mkdir(join(tempDir, 'analysis'), { recursive: true });
    },
    resetInit: () => {},
  };
});

// Import AFTER mock is set up
const { appendLogEntry } = await import('../../src/storage/logger.js');

function makeTimestamp(): string {
  return new Date().toISOString();
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

describe('appendLogEntry', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'harness-logger-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('appends a valid prompt entry as JSONL', async () => {
    const entry = {
      timestamp: makeTimestamp(),
      session_id: 'sess-001',
      cwd: '/home/user/project',
      prompt: 'hello world',
      prompt_length: 11,
    };

    await appendLogEntry('prompts', entry);

    const filePath = join(tempDir, 'logs', 'prompts', `${todayStr()}.jsonl`);
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]);
    expect(parsed.prompt).toBe('hello world');
    expect(parsed.session_id).toBe('sess-001');
  });

  it('appends multiple entries to the same file', async () => {
    const base = {
      timestamp: makeTimestamp(),
      session_id: 'sess-001',
      cwd: '/home/user/project',
      prompt_length: 5,
    };

    await appendLogEntry('prompts', { ...base, prompt: 'first' });
    await appendLogEntry('prompts', { ...base, prompt: 'second' });

    const filePath = join(tempDir, 'logs', 'prompts', `${todayStr()}.jsonl`);
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);

    expect(JSON.parse(lines[0]).prompt).toBe('first');
    expect(JSON.parse(lines[1]).prompt).toBe('second');
  });

  it('scrubs secrets before writing (D-01)', async () => {
    const entry = {
      timestamp: makeTimestamp(),
      session_id: 'sess-001',
      cwd: '/home/user/project',
      prompt: 'my key is AKIAIOSFODNN7EXAMPLE and token ghp_1234567890abcdefghijklmnopqrstuvwxyz12',
      prompt_length: 80,
    };

    await appendLogEntry('prompts', entry);

    const filePath = join(tempDir, 'logs', 'prompts', `${todayStr()}.jsonl`);
    const content = await readFile(filePath, 'utf-8');

    // Must contain redacted markers
    expect(content).toContain('[REDACTED:aws_key]');
    expect(content).toContain('[REDACTED:github_token]');

    // Must NOT contain raw secrets
    expect(content).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(content).not.toContain('ghp_1234567890');
  });

  it('throws ZodError on invalid entry', async () => {
    await expect(
      appendLogEntry('prompts', { invalid: true })
    ).rejects.toThrow();
  });

  it('throws on missing required fields', async () => {
    await expect(
      appendLogEntry('prompts', {
        timestamp: makeTimestamp(),
        // missing session_id, cwd, prompt, prompt_length
      })
    ).rejects.toThrow();
  });

  it('writes tool entries to tools directory (D-03)', async () => {
    const entry = {
      timestamp: makeTimestamp(),
      session_id: 'sess-001',
      event: 'pre' as const,
      tool_name: 'Read',
    };

    await appendLogEntry('tools', entry);

    const filePath = join(tempDir, 'logs', 'tools', `${todayStr()}.jsonl`);
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content.trim());
    expect(parsed.tool_name).toBe('Read');
  });

  it('writes permission entries to permissions directory', async () => {
    const entry = {
      timestamp: makeTimestamp(),
      session_id: 'sess-001',
      tool_name: 'Bash',
      decision: 'approved' as const,
    };

    await appendLogEntry('permissions', entry);

    const filePath = join(tempDir, 'logs', 'permissions', `${todayStr()}.jsonl`);
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content.trim());
    expect(parsed.decision).toBe('approved');
  });

  it('writes session entries to sessions directory', async () => {
    const entry = {
      timestamp: makeTimestamp(),
      session_id: 'sess-001',
      event: 'start' as const,
      cwd: '/home/user/project',
    };

    await appendLogEntry('sessions', entry);

    const filePath = join(tempDir, 'logs', 'sessions', `${todayStr()}.jsonl`);
    const content = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(content.trim());
    expect(parsed.event).toBe('start');
  });

  it('produces parseable JSON on each line', async () => {
    const base = {
      timestamp: makeTimestamp(),
      session_id: 'sess-001',
      cwd: '/home/user/project',
      prompt_length: 5,
    };

    await appendLogEntry('prompts', { ...base, prompt: 'one' });
    await appendLogEntry('prompts', { ...base, prompt: 'two' });
    await appendLogEntry('prompts', { ...base, prompt: 'three' });

    const filePath = join(tempDir, 'logs', 'prompts', `${todayStr()}.jsonl`);
    const content = await readFile(filePath, 'utf-8');
    const lines = content.trim().split('\n');

    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
      const parsed = JSON.parse(line);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('session_id');
      expect(parsed).toHaveProperty('prompt');
    }
  });

  it('uses YYYY-MM-DD.jsonl filename format (D-04)', async () => {
    const entry = {
      timestamp: makeTimestamp(),
      session_id: 'sess-001',
      cwd: '/home/user/project',
      prompt: 'test daily rotation',
      prompt_length: 19,
    };

    await appendLogEntry('prompts', entry);

    const filePath = join(tempDir, 'logs', 'prompts', `${todayStr()}.jsonl`);
    const content = await readFile(filePath, 'utf-8');
    expect(content.trim().length).toBeGreaterThan(0);

    // Verify filename pattern
    const datePattern = /^\d{4}-\d{2}-\d{2}\.jsonl$/;
    expect(`${todayStr()}.jsonl`).toMatch(datePattern);
  });
});
