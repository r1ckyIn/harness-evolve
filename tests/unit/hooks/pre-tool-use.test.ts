import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, rm, mkdtemp, mkdir, readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Temp directory updated per-test
let tempDir: string;

// Mock dirs module to redirect paths to temp directory
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
      await mk(join(tempDir, 'analysis'), { recursive: true });
      await mk(join(tempDir, 'pending'), { recursive: true });
    },
    resetInit: () => {},
  };
});

// Import AFTER mock is set up
const { handlePreToolUse } = await import('../../../src/hooks/pre-tool-use.js');

// Valid PreToolUse input
const validInput = {
  session_id: 'test-session-003',
  transcript_path: '/tmp/transcripts/ghi.jsonl',
  cwd: '/home/user/project',
  permission_mode: 'default',
  hook_event_name: 'PreToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'npm test' },
  tool_use_id: 'tu_abc123',
};

describe('handlePreToolUse', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-ptu-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes marker file at pending/{tool_use_id}.ts', async () => {
    await handlePreToolUse(JSON.stringify(validInput));

    const markerPath = join(tempDir, 'pending', 'tu_abc123.ts');
    const content = await readFile(markerPath, 'utf-8');
    // Marker should contain a timestamp number
    const ts = parseInt(content, 10);
    expect(ts).toBeGreaterThan(0);
    expect(Date.now() - ts).toBeLessThan(5000); // Within last 5 seconds
  });

  it('logs a tool entry with event=pre and tool_name', async () => {
    await handlePreToolUse(JSON.stringify(validInput));

    const logDir = join(tempDir, 'logs', 'tools');
    const dirEntries = await readdir(logDir);
    expect(dirEntries.length).toBeGreaterThan(0);

    const logFile = join(logDir, dirEntries[0]);
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());

    expect(entry.session_id).toBe('test-session-003');
    expect(entry.event).toBe('pre');
    expect(entry.tool_name).toBe('Bash');
    expect(entry.timestamp).toBeDefined();
  });

  it('logs input_summary from summarizeToolInput', async () => {
    await handlePreToolUse(JSON.stringify(validInput));

    const logDir = join(tempDir, 'logs', 'tools');
    const dirEntries = await readdir(logDir);
    const logFile = join(logDir, dirEntries[0]);
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());

    expect(entry.input_summary).toBe('npm test');
  });

  it('truncates long tool_input (300-char command)', async () => {
    const longInput = {
      ...validInput,
      tool_input: { command: 'x'.repeat(300) },
    };
    await handlePreToolUse(JSON.stringify(longInput));

    const logDir = join(tempDir, 'logs', 'tools');
    const dirEntries = await readdir(logDir);
    const logFile = join(logDir, dirEntries[0]);
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());

    expect(entry.input_summary.length).toBe(203); // 200 + '...'
    expect(entry.input_summary.endsWith('...')).toBe(true);
  });

  it('increments counter', async () => {
    await handlePreToolUse(JSON.stringify(validInput));

    const counterPath = join(tempDir, 'counter.json');
    const counterRaw = await readFile(counterPath, 'utf-8');
    const counter = JSON.parse(counterRaw);

    expect(counter.total).toBe(1);
    expect(counter.session['test-session-003']).toBe(1);
  });

  it('exits cleanly when captureTools is false', async () => {
    await mkdir(join(tempDir, 'logs', 'tools'), { recursive: true });
    await mkdir(join(tempDir, 'pending'), { recursive: true });

    const configPath = join(tempDir, 'config.json');
    await writeFile(configPath, JSON.stringify({
      hooks: { capturePrompts: true, captureTools: false, capturePermissions: true, captureSessions: true },
      analysis: { threshold: 50, autoAnalyze: true },
    }), 'utf-8');

    await handlePreToolUse(JSON.stringify(validInput));

    // No log entry and no marker file
    const logDir = join(tempDir, 'logs', 'tools');
    const dirEntries = await readdir(logDir);
    expect(dirEntries.length).toBe(0);
  });

  it('does not throw on malformed input', async () => {
    await expect(handlePreToolUse('invalid json')).resolves.not.toThrow();
  });

  it('does not throw on missing fields', async () => {
    const incomplete = JSON.stringify({ session_id: 's1' });
    await expect(handlePreToolUse(incomplete)).resolves.not.toThrow();
  });
});
