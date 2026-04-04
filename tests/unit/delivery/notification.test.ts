import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile, rm, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
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
        analysisPreProcessed: join(tempDir, 'analysis', 'pre-processed'),
        summary: join(tempDir, 'analysis', 'pre-processed', 'summary.json'),
        environmentSnapshot: join(tempDir, 'analysis', 'environment-snapshot.json'),
        analysisResult: join(tempDir, 'analysis', 'analysis-result.json'),
        pending: join(tempDir, 'pending'),
        config: join(tempDir, 'config.json'),
        counter: join(tempDir, 'counter.json'),
        recommendations: join(tempDir, 'recommendations.md'),
        recommendationState: join(tempDir, 'analysis', 'recommendation-state.json'),
        recommendationArchive: join(tempDir, 'analysis', 'recommendations-archive'),
        notificationFlag: join(tempDir, 'analysis', 'has-pending-notifications'),
        autoApplyLog: join(tempDir, 'analysis', 'auto-apply-log.jsonl'),
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
      await mk(join(tempDir, 'analysis', 'recommendations-archive'), { recursive: true });
    },
    resetInit: () => {},
  };
});

// Import AFTER mock is set up
const {
  buildNotification,
  writeNotificationFlag,
  hasNotificationFlag,
  clearNotificationFlag,
} = await import('../../../src/delivery/notification.js');

describe('buildNotification', () => {
  it('returns string containing "3 new suggestions" for count=3', () => {
    const msg = buildNotification(3);
    expect(msg).toContain('3 new suggestions');
  });

  it('uses singular "suggestion" for count=1', () => {
    const msg = buildNotification(1);
    expect(msg).toContain('1 new suggestion');
    expect(msg).not.toContain('1 new suggestions');
  });

  it('output is under 200 characters', () => {
    const msg = buildNotification(99);
    expect(msg.length).toBeLessThan(200);
  });

  it('contains "/evolve:apply" reference', () => {
    const msg = buildNotification(5);
    expect(msg).toContain('/evolve:apply');
  });

  it('takes only 1 parameter (pendingCount)', () => {
    expect(buildNotification.length).toBe(1);
  });
});

describe('writeNotificationFlag', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-notif-'));
    await mkdir(join(tempDir, 'analysis'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writes pending count to notificationFlag path', async () => {
    await writeNotificationFlag(5);
    const flagPath = join(tempDir, 'analysis', 'has-pending-notifications');
    const content = await readFile(flagPath, 'utf-8');
    expect(content).toBe('5');
  });
});

describe('hasNotificationFlag', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-notif-'));
    await mkdir(join(tempDir, 'analysis'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns true when flag file exists', async () => {
    const flagPath = join(tempDir, 'analysis', 'has-pending-notifications');
    await writeFile(flagPath, '3', 'utf-8');
    expect(await hasNotificationFlag()).toBe(true);
  });

  it('returns false when flag file does not exist', async () => {
    expect(await hasNotificationFlag()).toBe(false);
  });
});

describe('clearNotificationFlag', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-notif-'));
    await mkdir(join(tempDir, 'analysis'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('removes the flag file', async () => {
    const flagPath = join(tempDir, 'analysis', 'has-pending-notifications');
    await writeFile(flagPath, '3', 'utf-8');
    expect(existsSync(flagPath)).toBe(true);

    await clearNotificationFlag();
    expect(existsSync(flagPath)).toBe(false);
  });

  it('does not throw when flag file does not exist', async () => {
    await expect(clearNotificationFlag()).resolves.not.toThrow();
  });
});

describe('UserPromptSubmit notification injection', () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

  const validInput = {
    session_id: 'test-session-001',
    transcript_path: '/tmp/transcripts/abc.jsonl',
    cwd: '/home/user/project',
    permission_mode: 'default',
    hook_event_name: 'UserPromptSubmit',
    prompt: 'How do I create a hook?',
  };

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-notif-'));
    await mkdir(join(tempDir, 'logs', 'prompts'), { recursive: true });
    await mkdir(join(tempDir, 'logs', 'tools'), { recursive: true });
    await mkdir(join(tempDir, 'logs', 'permissions'), { recursive: true });
    await mkdir(join(tempDir, 'logs', 'sessions'), { recursive: true });
    await mkdir(join(tempDir, 'analysis'), { recursive: true });
    await mkdir(join(tempDir, 'pending'), { recursive: true });
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(async () => {
    stdoutWriteSpy.mockRestore();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('does NOT write to stdout when stdoutInjection=false', async () => {
    // Write config with stdoutInjection disabled
    await writeFile(
      join(tempDir, 'config.json'),
      JSON.stringify({
        delivery: { stdoutInjection: false },
        hooks: { capturePrompts: true, captureTools: true, capturePermissions: true, captureSessions: true },
      }),
      'utf-8',
    );
    // Write notification flag
    await writeFile(
      join(tempDir, 'analysis', 'has-pending-notifications'),
      '3',
      'utf-8',
    );

    const { handleUserPromptSubmit } = await import('../../../src/hooks/user-prompt-submit.js');
    await handleUserPromptSubmit(JSON.stringify(validInput));

    // Should not have written notification (may have written other things)
    const notifCalls = stdoutWriteSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('suggestion'),
    );
    expect(notifCalls.length).toBe(0);
  });

  it('writes notification to stdout when stdoutInjection=true and flag exists', async () => {
    // Write default config (stdoutInjection defaults to true)
    // No config file = defaults applied

    // Write notification flag with pending count
    await writeFile(
      join(tempDir, 'analysis', 'has-pending-notifications'),
      '3',
      'utf-8',
    );

    const { handleUserPromptSubmit } = await import('../../../src/hooks/user-prompt-submit.js');
    await handleUserPromptSubmit(JSON.stringify(validInput));

    const notifCalls = stdoutWriteSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('suggestion'),
    );
    expect(notifCalls.length).toBe(1);
    expect(notifCalls[0][0]).toContain('3 new suggestions');
  });

  it('does NOT write to stdout when no flag file exists even if stdoutInjection=true', async () => {
    // No config = defaults (stdoutInjection=true)
    // No flag file created

    const { handleUserPromptSubmit } = await import('../../../src/hooks/user-prompt-submit.js');
    await handleUserPromptSubmit(JSON.stringify(validInput));

    const notifCalls = stdoutWriteSpy.mock.calls.filter(
      (call) => typeof call[0] === 'string' && call[0].includes('suggestion'),
    );
    expect(notifCalls.length).toBe(0);
  });
});
