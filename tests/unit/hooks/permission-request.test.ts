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
const { handlePermissionRequest } = await import('../../../src/hooks/permission-request.js');

// Valid PermissionRequest input
const validInput = {
  session_id: 'test-session-002',
  transcript_path: '/tmp/transcripts/def.jsonl',
  cwd: '/home/user/project',
  permission_mode: 'default',
  hook_event_name: 'PermissionRequest',
  tool_name: 'Bash',
  tool_input: { command: 'rm -rf /tmp/test' },
};

describe('handlePermissionRequest', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-pr-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('captures permission request with tool_name and decision=unknown', async () => {
    await handlePermissionRequest(JSON.stringify(validInput));

    const logDir = join(tempDir, 'logs', 'permissions');
    const dirEntries = await readdir(logDir);
    expect(dirEntries.length).toBeGreaterThan(0);

    const logFile = join(logDir, dirEntries[0]);
    const content = await readFile(logFile, 'utf-8');
    const entry = JSON.parse(content.trim());

    expect(entry.session_id).toBe('test-session-002');
    expect(entry.tool_name).toBe('Bash');
    expect(entry.decision).toBe('unknown');
    expect(entry.timestamp).toBeDefined();
  });

  it('increments counter', async () => {
    await handlePermissionRequest(JSON.stringify(validInput));

    const counterPath = join(tempDir, 'counter.json');
    const counterRaw = await readFile(counterPath, 'utf-8');
    const counter = JSON.parse(counterRaw);

    expect(counter.total).toBe(1);
    expect(counter.session['test-session-002']).toBe(1);
  });

  it('exits cleanly when capturePermissions is false', async () => {
    // Create dirs first
    await mkdir(join(tempDir, 'logs', 'permissions'), { recursive: true });

    const configPath = join(tempDir, 'config.json');
    await writeFile(configPath, JSON.stringify({
      hooks: { capturePrompts: true, captureTools: true, capturePermissions: false, captureSessions: true },
      analysis: { threshold: 50, autoAnalyze: true },
    }), 'utf-8');

    await handlePermissionRequest(JSON.stringify(validInput));

    const logDir = join(tempDir, 'logs', 'permissions');
    const dirEntries = await readdir(logDir);
    expect(dirEntries.length).toBe(0);
  });

  it('does not throw on malformed input', async () => {
    await expect(handlePermissionRequest('{{invalid json')).resolves.not.toThrow();
  });

  it('does not throw on missing fields', async () => {
    const incomplete = JSON.stringify({ session_id: 's1' });
    await expect(handlePermissionRequest(incomplete)).resolves.not.toThrow();
  });
});
