import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, rm, mkdtemp, mkdir, readdir } from 'node:fs/promises';
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
const { handleUserPromptSubmit } = await import('../../../src/hooks/user-prompt-submit.js');

// Valid UserPromptSubmit input
const validInput = {
  session_id: 'test-session-001',
  transcript_path: '/tmp/transcripts/abc.jsonl',
  cwd: '/home/user/project',
  permission_mode: 'default',
  hook_event_name: 'UserPromptSubmit',
  prompt: 'How do I create a hook?',
};

describe('handleUserPromptSubmit', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-ups-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('captures prompt with all required fields', async () => {
    await handleUserPromptSubmit(JSON.stringify(validInput));

    const logDir = join(tempDir, 'logs', 'prompts');
    const dirEntries = await readdir(logDir);
    expect(dirEntries.length).toBeGreaterThan(0);

    const logFile = join(logDir, dirEntries[0]);
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());

    expect(entry.session_id).toBe('test-session-001');
    expect(entry.cwd).toBe('/home/user/project');
    expect(entry.prompt).toBe('How do I create a hook?');
    expect(entry.prompt_length).toBe('How do I create a hook?'.length);
    expect(entry.timestamp).toBeDefined();
  });

  it('stores transcript_path in log entry (CAP-04)', async () => {
    await handleUserPromptSubmit(JSON.stringify(validInput));

    const logDir = join(tempDir, 'logs', 'prompts');
    const dirEntries = await readdir(logDir);
    const logFile = join(logDir, dirEntries[0]);
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());

    expect(entry.transcript_path).toBe('/tmp/transcripts/abc.jsonl');
  });

  it('increments counter', async () => {
    await handleUserPromptSubmit(JSON.stringify(validInput));

    const counterPath = join(tempDir, 'counter.json');
    const counterRaw = await readFile(counterPath, 'utf-8');
    const counter = JSON.parse(counterRaw);

    expect(counter.total).toBe(1);
    expect(counter.session['test-session-001']).toBe(1);
  });

  it('exits cleanly when capturePrompts is false', async () => {
    // Create dirs first since config write needs the base dir
    await mkdir(join(tempDir, 'logs', 'prompts'), { recursive: true });

    // Write config with capturePrompts disabled
    const configPath = join(tempDir, 'config.json');
    await writeFile(configPath, JSON.stringify({
      hooks: { capturePrompts: false, captureTools: true, capturePermissions: true, captureSessions: true },
      analysis: { threshold: 50, autoAnalyze: true },
    }), 'utf-8');

    await handleUserPromptSubmit(JSON.stringify(validInput));

    // No log entry should be created
    const logDir = join(tempDir, 'logs', 'prompts');
    const dirEntries = await readdir(logDir);
    expect(dirEntries.length).toBe(0);
  });

  it('does not throw on malformed input', async () => {
    // Should not throw -- hooks must never block Claude Code
    await expect(handleUserPromptSubmit('not valid json {')).resolves.not.toThrow();
  });

  it('does not throw on missing fields', async () => {
    const incomplete = JSON.stringify({ session_id: 's1' });
    await expect(handleUserPromptSubmit(incomplete)).resolves.not.toThrow();
  });
});
