// Unit tests for CLI uninstall command

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock write-file-atomic before imports
vi.mock('write-file-atomic', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  copyFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn(),
  rm: vi.fn().mockResolvedValue(undefined),
}));

// Mock node:readline/promises
vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn().mockReturnValue({
    question: vi.fn(),
    close: vi.fn(),
  }),
}));

// Mock storage/dirs
vi.mock('../../../src/storage/dirs.js', () => ({
  paths: {
    base: '/mock/.harness-evolve',
  },
}));

describe('CLI uninstall command', () => {
  let logs: string[];
  let originalLog: typeof console.log;

  beforeEach(() => {
    vi.resetAllMocks();
    logs = [];
    originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
    vi.restoreAllMocks();
  });

  it('removes harness-evolve hook entries from settings.json', async () => {
    const { readFile, copyFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedCopyFile = vi.mocked(copyFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    const settingsWithHarnessHooks = {
      hooks: {
        UserPromptSubmit: [{
          matcher: '*',
          hooks: [{ type: 'command', command: 'node "/path/to/harness-evolve/dist/hooks/user-prompt-submit.js"' }],
        }],
        Stop: [{
          matcher: '*',
          hooks: [{ type: 'command', command: 'node "/path/to/harness-evolve/dist/hooks/stop.js"' }],
        }],
      },
    };

    mockedReadFile.mockResolvedValueOnce(JSON.stringify(settingsWithHarnessHooks));
    mockedCopyFile.mockResolvedValueOnce(undefined);
    mockedWrite.mockResolvedValueOnce(undefined);

    const { runUninstall } = await import('../../../src/cli/uninstall.js');
    await runUninstall({
      purge: false,
      yes: true,
      settingsPath: '/tmp/test-uninstall/.claude/settings.json',
    });

    // Should have written updated settings
    expect(mockedWrite).toHaveBeenCalledTimes(1);
    const written = JSON.parse(mockedWrite.mock.calls[0][1] as string);
    // hooks object should be empty (both events had only harness-evolve hooks)
    expect(written.hooks).toEqual({});
  });

  it('preserves non-harness-evolve hooks in same event', async () => {
    const { readFile, copyFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedCopyFile = vi.mocked(copyFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    const settingsWithMixed = {
      hooks: {
        UserPromptSubmit: [
          {
            matcher: '*.py',
            hooks: [{ type: 'command', command: 'python lint.py' }],
          },
          {
            matcher: '*',
            hooks: [{ type: 'command', command: 'node "/path/to/harness-evolve/dist/hooks/user-prompt-submit.js"' }],
          },
        ],
      },
    };

    mockedReadFile.mockResolvedValueOnce(JSON.stringify(settingsWithMixed));
    mockedCopyFile.mockResolvedValueOnce(undefined);
    mockedWrite.mockResolvedValueOnce(undefined);

    const { runUninstall } = await import('../../../src/cli/uninstall.js');
    await runUninstall({
      purge: false,
      yes: true,
      settingsPath: '/tmp/test-preserve/.claude/settings.json',
    });

    expect(mockedWrite).toHaveBeenCalledTimes(1);
    const written = JSON.parse(mockedWrite.mock.calls[0][1] as string);
    // User hook should be preserved
    expect(written.hooks.UserPromptSubmit).toHaveLength(1);
    expect(written.hooks.UserPromptSubmit[0].hooks[0].command).toBe('python lint.py');
  });

  it('removes entire event array if only harness-evolve hooks existed', async () => {
    const { readFile, copyFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedCopyFile = vi.mocked(copyFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    const settings = {
      allowedTools: ['Bash'],
      hooks: {
        Stop: [{
          matcher: '*',
          hooks: [{ type: 'command', command: 'node "/path/harness-evolve/dist/hooks/stop.js"' }],
        }],
      },
    };

    mockedReadFile.mockResolvedValueOnce(JSON.stringify(settings));
    mockedCopyFile.mockResolvedValueOnce(undefined);
    mockedWrite.mockResolvedValueOnce(undefined);

    const { runUninstall } = await import('../../../src/cli/uninstall.js');
    await runUninstall({
      purge: false,
      yes: true,
      settingsPath: '/tmp/test-empty-event/.claude/settings.json',
    });

    expect(mockedWrite).toHaveBeenCalledTimes(1);
    const written = JSON.parse(mockedWrite.mock.calls[0][1] as string);
    // Stop event key should be deleted entirely
    expect(written.hooks.Stop).toBeUndefined();
    // allowedTools should be preserved
    expect(written.allowedTools).toEqual(['Bash']);
  });

  it('with --purge deletes ~/.harness-evolve/ directory', async () => {
    const { readFile, rm, access } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedRm = vi.mocked(rm);
    const mockedAccess = vi.mocked(access);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // No hooks in settings
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({}));
    // Data directory exists
    mockedAccess.mockResolvedValueOnce(undefined);
    mockedRm.mockResolvedValueOnce(undefined);

    const { runUninstall } = await import('../../../src/cli/uninstall.js');
    await runUninstall({
      purge: true,
      yes: true,
      settingsPath: '/tmp/test-purge/.claude/settings.json',
    });

    expect(mockedRm).toHaveBeenCalledWith('/mock/.harness-evolve', {
      recursive: true,
      force: true,
    });
    const output = logs.join('\n');
    expect(output).toContain('Deleted');
  });

  it('without --purge keeps ~/.harness-evolve/ directory', async () => {
    const { readFile, rm } = await import('node:fs/promises');
    const mockedReadFile = vi.mocked(readFile);
    const mockedRm = vi.mocked(rm);

    mockedReadFile.mockResolvedValueOnce(JSON.stringify({}));

    const { runUninstall } = await import('../../../src/cli/uninstall.js');
    await runUninstall({
      purge: false,
      yes: true,
      settingsPath: '/tmp/test-no-purge/.claude/settings.json',
    });

    // rm should NOT have been called
    expect(mockedRm).not.toHaveBeenCalled();
  });

  it('creates backup of settings.json before modification', async () => {
    const { readFile, copyFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedCopyFile = vi.mocked(copyFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    const settings = {
      hooks: {
        Stop: [{
          matcher: '*',
          hooks: [{ type: 'command', command: 'node "/path/harness-evolve/dist/hooks/stop.js"' }],
        }],
      },
    };

    mockedReadFile.mockResolvedValueOnce(JSON.stringify(settings));
    mockedCopyFile.mockResolvedValueOnce(undefined);
    mockedWrite.mockResolvedValueOnce(undefined);

    const { runUninstall } = await import('../../../src/cli/uninstall.js');
    await runUninstall({
      purge: false,
      yes: true,
      settingsPath: '/tmp/test-backup/.claude/settings.json',
    });

    expect(mockedCopyFile).toHaveBeenCalledWith(
      '/tmp/test-backup/.claude/settings.json',
      '/tmp/test-backup/.claude/settings.json.backup',
    );
  });

  it('with --purge prompts for confirmation (unless --yes)', async () => {
    const { readFile, rm, access } = await import('node:fs/promises');
    const mockedReadFile = vi.mocked(readFile);
    const mockedRm = vi.mocked(rm);
    const mockedAccess = vi.mocked(access);

    // No hooks in settings
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({}));
    // Data directory exists
    mockedAccess.mockResolvedValueOnce(undefined);

    // Mock readline to answer "n" (decline purge)
    const readline = await import('node:readline/promises');
    const mockRl = {
      question: vi.fn().mockResolvedValue('n'),
      close: vi.fn(),
    };
    vi.mocked(readline.createInterface).mockReturnValue(
      mockRl as unknown as ReturnType<typeof readline.createInterface>,
    );

    const { runUninstall } = await import('../../../src/cli/uninstall.js');
    await runUninstall({
      purge: true,
      yes: false,
      settingsPath: '/tmp/test-confirm/.claude/settings.json',
    });

    // Should have prompted
    expect(mockRl.question).toHaveBeenCalled();
    // Should NOT have deleted (user declined)
    expect(mockedRm).not.toHaveBeenCalled();
    const output = logs.join('\n');
    expect(output).toContain('preserved');
  });

  it('handles missing settings.json gracefully', async () => {
    const { readFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // settings.json does not exist
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);

    const { runUninstall } = await import('../../../src/cli/uninstall.js');
    await runUninstall({
      purge: false,
      yes: true,
      settingsPath: '/tmp/test-missing/.claude/settings.json',
    });

    // Should NOT have written anything
    expect(mockedWrite).not.toHaveBeenCalled();
    // Should print appropriate message
    const output = logs.join('\n');
    expect(output).toContain('No harness-evolve hooks found');
  });

  it('exports registerUninstallCommand function', async () => {
    const { registerUninstallCommand } = await import('../../../src/cli/uninstall.js');
    expect(typeof registerUninstallCommand).toBe('function');
  });
});
