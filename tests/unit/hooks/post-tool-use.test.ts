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
const { handlePostToolUse } = await import('../../../src/hooks/post-tool-use.js');
const { handlePostToolUseFailure } = await import('../../../src/hooks/post-tool-use-failure.js');

// Valid PostToolUse input
const validPostInput = {
  session_id: 'test-session-004',
  transcript_path: '/tmp/transcripts/jkl.jsonl',
  cwd: '/home/user/project',
  permission_mode: 'default',
  hook_event_name: 'PostToolUse',
  tool_name: 'Bash',
  tool_input: { command: 'npm test' },
  tool_use_id: 'tu_def456',
};

// Valid PostToolUseFailure input
const validFailureInput = {
  session_id: 'test-session-005',
  transcript_path: '/tmp/transcripts/mno.jsonl',
  cwd: '/home/user/project',
  permission_mode: 'default',
  hook_event_name: 'PostToolUseFailure',
  tool_name: 'Bash',
  tool_input: { command: 'rm -rf /' },
  tool_use_id: 'tu_ghi789',
  error: 'Permission denied',
};

describe('handlePostToolUse', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-potu-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reads marker file, calculates duration_ms, deletes marker', async () => {
    // Create marker file simulating PreToolUse having run 100ms ago
    await mkdir(join(tempDir, 'pending'), { recursive: true });
    const markerPath = join(tempDir, 'pending', 'tu_def456.ts');
    const startTime = Date.now() - 100;
    await writeFile(markerPath, startTime.toString(), 'utf-8');

    await handlePostToolUse(JSON.stringify(validPostInput));

    // Verify duration_ms is logged
    const logDir = join(tempDir, 'logs', 'tools');
    const dirEntries = await readdir(logDir);
    const logFile = join(logDir, dirEntries[0]);
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());

    expect(entry.event).toBe('post');
    expect(entry.tool_name).toBe('Bash');
    expect(entry.duration_ms).toBeGreaterThanOrEqual(100);
    expect(entry.success).toBe(true);

    // Verify marker file was deleted
    try {
      await access(markerPath);
      throw new Error('Marker file should have been deleted');
    } catch (err: unknown) {
      expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
    }
  });

  it('logs entry without duration_ms when marker file is missing', async () => {
    await handlePostToolUse(JSON.stringify(validPostInput));

    const logDir = join(tempDir, 'logs', 'tools');
    const dirEntries = await readdir(logDir);
    const logFile = join(logDir, dirEntries[0]);
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());

    expect(entry.event).toBe('post');
    expect(entry.tool_name).toBe('Bash');
    expect(entry.duration_ms).toBeUndefined();
    expect(entry.success).toBe(true);
  });

  it('includes input_summary from summarizeToolInput', async () => {
    await handlePostToolUse(JSON.stringify(validPostInput));

    const logDir = join(tempDir, 'logs', 'tools');
    const dirEntries = await readdir(logDir);
    const logFile = join(logDir, dirEntries[0]);
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());

    expect(entry.input_summary).toBe('npm test');
  });

  it('increments counter', async () => {
    await handlePostToolUse(JSON.stringify(validPostInput));

    const counterPath = join(tempDir, 'counter.json');
    const counterRaw = await readFile(counterPath, 'utf-8');
    const counter = JSON.parse(counterRaw);

    expect(counter.total).toBe(1);
    expect(counter.session['test-session-004']).toBe(1);
  });

  it('exits cleanly when captureTools is false', async () => {
    await mkdir(join(tempDir, 'logs', 'tools'), { recursive: true });

    const configPath = join(tempDir, 'config.json');
    await writeFile(configPath, JSON.stringify({
      hooks: { capturePrompts: true, captureTools: false, capturePermissions: true, captureSessions: true },
      analysis: { threshold: 50, autoAnalyze: true },
    }), 'utf-8');

    await handlePostToolUse(JSON.stringify(validPostInput));

    const logDir = join(tempDir, 'logs', 'tools');
    const dirEntries = await readdir(logDir);
    expect(dirEntries.length).toBe(0);
  });

  it('does not throw on malformed input', async () => {
    await expect(handlePostToolUse('bad json!')).resolves.not.toThrow();
  });

  it('does not throw on missing fields', async () => {
    const incomplete = JSON.stringify({ session_id: 's1' });
    await expect(handlePostToolUse(incomplete)).resolves.not.toThrow();
  });
});

describe('handlePostToolUseFailure', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-potf-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('logs tool entry with event=failure and success=false', async () => {
    await handlePostToolUseFailure(JSON.stringify(validFailureInput));

    const logDir = join(tempDir, 'logs', 'tools');
    const dirEntries = await readdir(logDir);
    const logFile = join(logDir, dirEntries[0]);
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());

    expect(entry.event).toBe('failure');
    expect(entry.tool_name).toBe('Bash');
    expect(entry.success).toBe(false);
    expect(entry.session_id).toBe('test-session-005');
    expect(entry.timestamp).toBeDefined();
  });

  it('cleans up marker file if it exists', async () => {
    await mkdir(join(tempDir, 'pending'), { recursive: true });
    const markerPath = join(tempDir, 'pending', 'tu_ghi789.ts');
    await writeFile(markerPath, Date.now().toString(), 'utf-8');

    await handlePostToolUseFailure(JSON.stringify(validFailureInput));

    // Verify marker was cleaned up
    try {
      await access(markerPath);
      throw new Error('Marker file should have been deleted');
    } catch (err: unknown) {
      expect((err as NodeJS.ErrnoException).code).toBe('ENOENT');
    }
  });

  it('increments counter', async () => {
    await handlePostToolUseFailure(JSON.stringify(validFailureInput));

    const counterPath = join(tempDir, 'counter.json');
    const counterRaw = await readFile(counterPath, 'utf-8');
    const counter = JSON.parse(counterRaw);

    expect(counter.total).toBe(1);
    expect(counter.session['test-session-005']).toBe(1);
  });

  it('exits cleanly when captureTools is false', async () => {
    await mkdir(join(tempDir, 'logs', 'tools'), { recursive: true });

    const configPath = join(tempDir, 'config.json');
    await writeFile(configPath, JSON.stringify({
      hooks: { capturePrompts: true, captureTools: false, capturePermissions: true, captureSessions: true },
      analysis: { threshold: 50, autoAnalyze: true },
    }), 'utf-8');

    await handlePostToolUseFailure(JSON.stringify(validFailureInput));

    const logDir = join(tempDir, 'logs', 'tools');
    const dirEntries = await readdir(logDir);
    expect(dirEntries.length).toBe(0);
  });

  it('does not throw on malformed input', async () => {
    await expect(handlePostToolUseFailure('bad json!')).resolves.not.toThrow();
  });

  it('does not throw on missing fields', async () => {
    const incomplete = JSON.stringify({ session_id: 's1' });
    await expect(handlePostToolUseFailure(incomplete)).resolves.not.toThrow();
  });
});
