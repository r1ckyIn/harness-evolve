// Unit tests for CLI init command, shared utilities, and hook registration logic

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';

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
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Mock node:readline/promises
vi.mock('node:readline/promises', () => ({
  createInterface: vi.fn().mockReturnValue({
    question: vi.fn(),
    close: vi.fn(),
  }),
}));

describe('CLI utils', () => {
  describe('HOOK_REGISTRATIONS', () => {
    it('has exactly 7 entries', async () => {
      const { HOOK_REGISTRATIONS } = await import('../../../src/cli/utils.js');
      expect(HOOK_REGISTRATIONS).toHaveLength(7);
    });

    it('contains all 7 hook event names', async () => {
      const { HOOK_REGISTRATIONS } = await import('../../../src/cli/utils.js');
      const events = HOOK_REGISTRATIONS.map((r) => r.event);
      expect(events).toEqual([
        'SessionStart',
        'UserPromptSubmit',
        'PreToolUse',
        'PostToolUse',
        'PostToolUseFailure',
        'PermissionRequest',
        'Stop',
      ]);
    });

    it('has correct hook file names', async () => {
      const { HOOK_REGISTRATIONS } = await import('../../../src/cli/utils.js');
      const files = HOOK_REGISTRATIONS.map((r) => r.hookFile);
      expect(files).toEqual([
        'session-start.js',
        'user-prompt-submit.js',
        'pre-tool-use.js',
        'post-tool-use.js',
        'post-tool-use-failure.js',
        'permission-request.js',
        'stop.js',
      ]);
    });

    it('each entry has a non-empty description string', async () => {
      const { HOOK_REGISTRATIONS } = await import('../../../src/cli/utils.js');
      for (const reg of HOOK_REGISTRATIONS) {
        expect(typeof reg.description).toBe('string');
        expect(reg.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('HARNESS_EVOLVE_MARKER', () => {
    it('is the string "harness-evolve"', async () => {
      const { HARNESS_EVOLVE_MARKER } = await import(
        '../../../src/cli/utils.js'
      );
      expect(HARNESS_EVOLVE_MARKER).toBe('harness-evolve');
    });
  });

  describe('resolveHookPath', () => {
    it('returns absolute path ending with /dist/hooks/<hookFile>', async () => {
      const { resolveHookPath } = await import('../../../src/cli/utils.js');
      const fakeBaseDir = '/opt/harness-evolve/dist';
      const result = resolveHookPath('user-prompt-submit.js', fakeBaseDir);
      expect(result).toBe(
        '/opt/harness-evolve/dist/hooks/user-prompt-submit.js',
      );
    });

    it('resolves hooks relative to baseDir for any install location', async () => {
      const { resolveHookPath } = await import('../../../src/cli/utils.js');
      const fakeBaseDir = '/home/user/.npm/lib/harness-evolve/dist';
      const result = resolveHookPath('stop.js', fakeBaseDir);
      expect(result).toBe(
        '/home/user/.npm/lib/harness-evolve/dist/hooks/stop.js',
      );
    });
  });

  describe('readSettings', () => {
    it('returns {} when settings file does not exist', async () => {
      const { readFile } = await import('node:fs/promises');
      const mockedReadFile = vi.mocked(readFile);
      const err = new Error('ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      mockedReadFile.mockRejectedValueOnce(err);

      const { readSettings } = await import('../../../src/cli/utils.js');
      const result = await readSettings('/tmp/nonexistent/settings.json');
      expect(result).toEqual({});
    });

    it('returns parsed JSON when settings file exists', async () => {
      const { readFile } = await import('node:fs/promises');
      const mockedReadFile = vi.mocked(readFile);
      const testSettings = { hooks: {}, allowedTools: ['Bash'] };
      mockedReadFile.mockResolvedValueOnce(JSON.stringify(testSettings));

      const { readSettings } = await import('../../../src/cli/utils.js');
      const result = await readSettings('/tmp/test/settings.json');
      expect(result).toEqual(testSettings);
    });

    it('returns {} when JSON is invalid', async () => {
      const { readFile } = await import('node:fs/promises');
      const mockedReadFile = vi.mocked(readFile);
      mockedReadFile.mockResolvedValueOnce('not valid json {{{');

      const { readSettings } = await import('../../../src/cli/utils.js');
      const result = await readSettings('/tmp/test/settings.json');
      expect(result).toEqual({});
    });
  });

  describe('writeSettings', () => {
    it('writes JSON with 2-space indent via write-file-atomic', async () => {
      const writeFileAtomic = (await import('write-file-atomic')).default;
      const mockedWrite = vi.mocked(writeFileAtomic);
      mockedWrite.mockResolvedValueOnce(undefined);

      const { writeSettings } = await import('../../../src/cli/utils.js');
      const testSettings = { hooks: {}, allowedTools: ['Bash'] };
      await writeSettings(testSettings, '/tmp/test/settings.json');

      expect(mockedWrite).toHaveBeenCalledWith(
        '/tmp/test/settings.json',
        JSON.stringify(testSettings, null, 2),
      );
    });
  });

  describe('mergeHooks', () => {
    it('appends to existing event arrays without destroying user hooks', async () => {
      const { mergeHooks, HARNESS_EVOLVE_MARKER } = await import(
        '../../../src/cli/utils.js'
      );
      const existing = {
        hooks: {
          UserPromptSubmit: [
            {
              matcher: 'my-pattern',
              hooks: [{ type: 'command', command: 'echo user-hook' }],
            },
          ],
        },
      };
      const hookCommands = [
        {
          event: 'UserPromptSubmit',
          command: `node "/path/to/${HARNESS_EVOLVE_MARKER}/dist/hooks/user-prompt-submit.js"`,
          timeout: 10,
          async: false,
        },
      ];

      const result = mergeHooks(existing, hookCommands);
      const eventHooks = (result.hooks as Record<string, unknown[]>)[
        'UserPromptSubmit'
      ];
      // User hook preserved + new hook appended
      expect(eventHooks).toHaveLength(2);
      expect(
        (eventHooks[0] as Record<string, unknown>).matcher,
      ).toBe('my-pattern');
    });

    it('skips if harness-evolve hook already registered for an event', async () => {
      const { mergeHooks, HARNESS_EVOLVE_MARKER } = await import(
        '../../../src/cli/utils.js'
      );
      const existing = {
        hooks: {
          Stop: [
            {
              matcher: '*',
              hooks: [
                {
                  type: 'command',
                  command: `node "/path/to/${HARNESS_EVOLVE_MARKER}/dist/hooks/stop.js"`,
                },
              ],
            },
          ],
        },
      };
      const hookCommands = [
        {
          event: 'Stop',
          command: `node "/other/path/${HARNESS_EVOLVE_MARKER}/dist/hooks/stop.js"`,
          timeout: 10,
          async: true,
        },
      ];

      const result = mergeHooks(existing, hookCommands);
      const eventHooks = (result.hooks as Record<string, unknown[]>)['Stop'];
      // Should NOT add a second entry
      expect(eventHooks).toHaveLength(1);
    });

    it('creates new event array if event has no existing hooks', async () => {
      const { mergeHooks, HARNESS_EVOLVE_MARKER } = await import(
        '../../../src/cli/utils.js'
      );
      const existing = { someOtherKey: 'value' };
      const hookCommands = [
        {
          event: 'PreToolUse',
          command: `node "/path/${HARNESS_EVOLVE_MARKER}/dist/hooks/pre-tool-use.js"`,
          timeout: 10,
          async: true,
        },
      ];

      const result = mergeHooks(existing, hookCommands);
      const hooks = result.hooks as Record<string, unknown[]>;
      expect(hooks.PreToolUse).toHaveLength(1);
      expect(result.someOtherKey).toBe('value');
    });

    it('includes async flag in hook entry when async is true', async () => {
      const { mergeHooks, HARNESS_EVOLVE_MARKER } = await import(
        '../../../src/cli/utils.js'
      );
      const existing = {};
      const hookCommands = [
        {
          event: 'PreToolUse',
          command: `node "/path/${HARNESS_EVOLVE_MARKER}/dist/hooks/pre-tool-use.js"`,
          timeout: 10,
          async: true,
        },
      ];

      const result = mergeHooks(existing, hookCommands);
      const hooks = result.hooks as Record<string, unknown[]>;
      const entry = hooks.PreToolUse[0] as Record<string, unknown>;
      const innerHooks = (entry as Record<string, unknown>).hooks as Array<
        Record<string, unknown>
      >;
      expect(innerHooks[0].async).toBe(true);
    });

    it('does not include async flag when async is false', async () => {
      const { mergeHooks, HARNESS_EVOLVE_MARKER } = await import(
        '../../../src/cli/utils.js'
      );
      const existing = {};
      const hookCommands = [
        {
          event: 'UserPromptSubmit',
          command: `node "/path/${HARNESS_EVOLVE_MARKER}/dist/hooks/user-prompt-submit.js"`,
          timeout: 10,
          async: false,
        },
      ];

      const result = mergeHooks(existing, hookCommands);
      const hooks = result.hooks as Record<string, unknown[]>;
      const entry = hooks.UserPromptSubmit[0] as Record<string, unknown>;
      const innerHooks = (entry as Record<string, unknown>).hooks as Array<
        Record<string, unknown>
      >;
      expect(innerHooks[0].async).toBeUndefined();
    });
  });
});

describe('CLI init command', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('with --yes skips confirmation, writes settings.json with all 6 hook entries', async () => {
    const { readFile, mkdir } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // Settings file does not exist
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    const { runInit } = await import('../../../src/cli/init.js');

    // Capture console.log output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/test-init/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
      });
    } finally {
      console.log = originalLog;
    }

    // Should have written settings.json
    expect(mockedWrite).toHaveBeenCalledTimes(1);

    // Parse what was written
    const writtenJSON = JSON.parse(
      mockedWrite.mock.calls[0][1] as string,
    ) as Record<string, unknown>;
    const hooks = writtenJSON.hooks as Record<string, unknown[]>;

    // Should have all 7 hook events
    expect(Object.keys(hooks)).toHaveLength(7);
    expect(Object.keys(hooks).sort()).toEqual([
      'PermissionRequest',
      'PostToolUse',
      'PostToolUseFailure',
      'PreToolUse',
      'SessionStart',
      'Stop',
      'UserPromptSubmit',
    ]);

    // Should display hook descriptions in output
    expect(logs.some((l) => l.includes('Captures prompts'))).toBe(true);
    expect(logs.some((l) => l.includes('Triggers analysis'))).toBe(true);
  });

  it('without --yes calls confirm() and respects "no" answer', async () => {
    const { readFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // Settings file does not exist
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);

    // Mock readline to answer "n"
    const readline = await import('node:readline/promises');
    const mockRl = {
      question: vi.fn().mockResolvedValue('n'),
      close: vi.fn(),
    };
    vi.mocked(readline.createInterface).mockReturnValue(
      mockRl as unknown as ReturnType<typeof readline.createInterface>,
    );

    const { runInit } = await import('../../../src/cli/init.js');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runInit({
        yes: false,
        settingsPath: '/tmp/test-init/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
      });
    } finally {
      console.log = originalLog;
    }

    // Should NOT have written settings
    expect(mockedWrite).not.toHaveBeenCalled();
    // Should show "Aborted"
    expect(logs.some((l) => l.includes('Aborted'))).toBe(true);
  });

  it('creates ~/.claude/ directory if it does not exist', async () => {
    const { readFile, mkdir } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedWrite = vi.mocked(writeFileAtomic);

    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    const { runInit } = await import('../../../src/cli/init.js');

    const originalLog = console.log;
    console.log = () => {};
    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/test-mkdir/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
      });
    } finally {
      console.log = originalLog;
    }

    // Should have called mkdir with recursive: true for parent directory
    expect(mockedMkdir).toHaveBeenCalledWith('/tmp/test-mkdir/.claude', {
      recursive: true,
    });
  });

  it('creates settings.json if it does not exist', async () => {
    const { readFile, mkdir } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedWrite = vi.mocked(writeFileAtomic);

    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    const { runInit } = await import('../../../src/cli/init.js');

    const originalLog = console.log;
    console.log = () => {};
    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/test-create/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
      });
    } finally {
      console.log = originalLog;
    }

    // Should write to the settings path even though file didn't exist
    expect(mockedWrite).toHaveBeenCalledTimes(1);
    expect(mockedWrite.mock.calls[0][0]).toBe(
      '/tmp/test-create/.claude/settings.json',
    );
  });

  it('backs up existing settings.json before modification', async () => {
    const { readFile, copyFile, mkdir } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedCopyFile = vi.mocked(copyFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // File exists with content
    mockedReadFile.mockResolvedValueOnce(
      JSON.stringify({ allowedTools: ['Bash'] }),
    );
    mockedCopyFile.mockResolvedValueOnce(undefined);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    const { runInit } = await import('../../../src/cli/init.js');

    const originalLog = console.log;
    console.log = () => {};
    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/test-backup/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
      });
    } finally {
      console.log = originalLog;
    }

    // Should have created backup
    expect(mockedCopyFile).toHaveBeenCalledWith(
      '/tmp/test-backup/.claude/settings.json',
      '/tmp/test-backup/.claude/settings.json.backup',
    );
  });
});

describe('CLI init slash commands', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('installs scan.md and apply.md to global ~/.claude/commands/evolve/', async () => {
    const { readFile, mkdir, access, writeFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedAccess = vi.mocked(access);
    const mockedWriteFile = vi.mocked(writeFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // Settings file does not exist
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    // Slash command files do not exist (access throws ENOENT)
    const enoent = new Error('ENOENT') as NodeJS.ErrnoException;
    enoent.code = 'ENOENT';
    mockedAccess.mockRejectedValue(enoent);

    mockedWriteFile.mockResolvedValue(undefined);

    const originalHome = process.env.HOME;
    process.env.HOME = '/tmp/test-slash-home';

    const { runInit } = await import('../../../src/cli/init.js');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/test-slash/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
        projectDir: '/tmp/test-slash',
      });
    } finally {
      console.log = originalLog;
      process.env.HOME = originalHome;
    }

    // writeFile should have been called for both scan.md and apply.md
    expect(mockedWriteFile).toHaveBeenCalledTimes(2);

    // Verify paths point to HOME, not projectDir
    const writePaths = mockedWriteFile.mock.calls.map((c) => c[0]);
    expect(writePaths).toContain(join('/tmp/test-slash-home', '.claude', 'commands', 'evolve', 'scan.md'));
    expect(writePaths).toContain(join('/tmp/test-slash-home', '.claude', 'commands', 'evolve', 'apply.md'));

    // Verify content contains expected frontmatter
    const scanContent = mockedWriteFile.mock.calls.find((c) =>
      String(c[0]).includes('scan.md'),
    )?.[1] as string;
    expect(scanContent).toContain('name: scan');

    const applyContent = mockedWriteFile.mock.calls.find((c) =>
      String(c[0]).includes('apply.md'),
    )?.[1] as string;
    expect(applyContent).toContain('name: apply');
  });

  it('skips command files with current template-version', async () => {
    const { readFile, mkdir, access, writeFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const { getScanTemplateVersion } = await import('../../../src/commands/evolve-scan.js');
    const { getApplyTemplateVersion } = await import('../../../src/commands/evolve-apply.js');
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedAccess = vi.mocked(access);
    const mockedWriteFile = vi.mocked(writeFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // Settings file does not exist
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    const scanVersion = getScanTemplateVersion();
    const applyVersion = getApplyTemplateVersion();

    // readFile for version extraction returns current version
    mockedReadFile.mockImplementation(async (p: Parameters<typeof readFile>[0]) => {
      const pathStr = String(p);
      if (pathStr.includes('scan.md')) {
        return `<!-- template-version: ${scanVersion} -->\nold content`;
      }
      if (pathStr.includes('apply.md')) {
        return `<!-- template-version: ${applyVersion} -->\nold content`;
      }
      throw new Error('ENOENT');
    });

    // All access() calls resolve (files exist -- including stale project-level dir)
    mockedAccess.mockResolvedValue(undefined);

    const originalHome = process.env.HOME;
    process.env.HOME = '/tmp/test-skip-home';

    const { runInit } = await import('../../../src/cli/init.js');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/test-skip/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
        projectDir: '/tmp/test-skip',
      });
    } finally {
      console.log = originalLog;
      process.env.HOME = originalHome;
    }

    // writeFile should NOT have been called for command files (current version)
    expect(mockedWriteFile).not.toHaveBeenCalled();

    // Should log "up to date"
    expect(logs.some((l) => l.includes('up to date'))).toBe(true);
  });

  it('overwrites installed file with no template-version comment', async () => {
    const { readFile, mkdir, access, writeFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedAccess = vi.mocked(access);
    const mockedWriteFile = vi.mocked(writeFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // Settings file does not exist
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    // readFile for version extraction returns old content with no version comment
    mockedReadFile.mockImplementation(async (p: Parameters<typeof readFile>[0]) => {
      const pathStr = String(p);
      if (pathStr.includes('scan.md') || pathStr.includes('apply.md')) {
        return '---\nname: scan\n---\nOld content without version comment';
      }
      throw new Error('ENOENT');
    });

    // access resolves (files exist)
    mockedAccess.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);

    const originalHome = process.env.HOME;
    process.env.HOME = '/tmp/test-noversion-home';

    const { runInit } = await import('../../../src/cli/init.js');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/test-noversion/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
        projectDir: '/tmp/test-noversion',
      });
    } finally {
      console.log = originalLog;
      process.env.HOME = originalHome;
    }

    // writeFile should have been called for both files (overwrite unversioned)
    expect(mockedWriteFile).toHaveBeenCalledTimes(2);

    // Written content should contain template-version
    const scanContent = mockedWriteFile.mock.calls.find((c) =>
      String(c[0]).includes('scan.md'),
    )?.[1] as string;
    expect(scanContent).toContain('template-version');

    // Should log "updated (was unversioned)"
    expect(logs.some((l) => l.includes('updated') && l.includes('unversioned'))).toBe(true);
  });

  it('overwrites installed file with older template-version', async () => {
    const { readFile, mkdir, access, writeFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedAccess = vi.mocked(access);
    const mockedWriteFile = vi.mocked(writeFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // Settings file does not exist
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    // readFile for version extraction returns older version
    mockedReadFile.mockImplementation(async (p: Parameters<typeof readFile>[0]) => {
      const pathStr = String(p);
      if (pathStr.includes('scan.md') || pathStr.includes('apply.md')) {
        return '<!-- template-version: 1 -->\nOld stale content';
      }
      throw new Error('ENOENT');
    });

    // access resolves (files exist)
    mockedAccess.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);

    const originalHome = process.env.HOME;
    process.env.HOME = '/tmp/test-oldver-home';

    const { runInit } = await import('../../../src/cli/init.js');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/test-oldver/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
        projectDir: '/tmp/test-oldver',
      });
    } finally {
      console.log = originalLog;
      process.env.HOME = originalHome;
    }

    // writeFile should have been called for both files (overwrite stale)
    expect(mockedWriteFile).toHaveBeenCalledTimes(2);

    // Written content should contain the newer template-version
    const scanContent = mockedWriteFile.mock.calls.find((c) =>
      String(c[0]).includes('scan.md'),
    )?.[1] as string;
    expect(scanContent).toContain('template-version');

    // Should log "updated (v1 -> v2)" or similar
    expect(logs.some((l) => l.includes('updated') && l.includes('v1'))).toBe(true);
  });

  it('logs updated message for stale templates', async () => {
    const { readFile, mkdir, access, writeFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedAccess = vi.mocked(access);
    const mockedWriteFile = vi.mocked(writeFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // Settings file does not exist
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    // readFile for version extraction returns older version
    mockedReadFile.mockImplementation(async (p: Parameters<typeof readFile>[0]) => {
      const pathStr = String(p);
      if (pathStr.includes('scan.md') || pathStr.includes('apply.md')) {
        return '<!-- template-version: 1 -->\nStale content';
      }
      throw new Error('ENOENT');
    });

    mockedAccess.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);

    const originalHome = process.env.HOME;
    process.env.HOME = '/tmp/test-stalelog-home';

    const { runInit } = await import('../../../src/cli/init.js');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/test-stalelog/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
        projectDir: '/tmp/test-stalelog',
      });
    } finally {
      console.log = originalLog;
      process.env.HOME = originalHome;
    }

    // Should log "updated" for both scan and apply
    const updatedLogs = logs.filter((l) => l.includes('updated'));
    expect(updatedLogs.length).toBeGreaterThanOrEqual(2);
    expect(logs.some((l) => l.includes('/evolve:scan') && l.includes('updated'))).toBe(true);
    expect(logs.some((l) => l.includes('/evolve:apply') && l.includes('updated'))).toBe(true);
  });

  it('installs slash commands to global HOME path instead of projectDir', async () => {
    const { readFile, mkdir, access, writeFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedAccess = vi.mocked(access);
    const mockedWriteFile = vi.mocked(writeFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // Settings file does not exist
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    // Slash command files do not exist (access throws ENOENT)
    const enoent = new Error('ENOENT') as NodeJS.ErrnoException;
    enoent.code = 'ENOENT';
    mockedAccess.mockRejectedValue(enoent);
    mockedWriteFile.mockResolvedValue(undefined);

    // Set HOME to a known temp path
    const originalHome = process.env.HOME;
    process.env.HOME = '/tmp/fake-home';

    const { runInit } = await import('../../../src/cli/init.js');

    const originalLog = console.log;
    console.log = () => {};
    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/test-global/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
        projectDir: '/tmp/some-project',
      });
    } finally {
      console.log = originalLog;
      process.env.HOME = originalHome;
    }

    // writeFile should write to HOME-based path, NOT projectDir-based path
    const writePaths = mockedWriteFile.mock.calls.map((c) => c[0]);
    expect(writePaths).toContain(join('/tmp/fake-home', '.claude', 'commands', 'evolve', 'scan.md'));
    expect(writePaths).toContain(join('/tmp/fake-home', '.claude', 'commands', 'evolve', 'apply.md'));

    // Should NOT contain project-level path
    expect(writePaths).not.toContain(join('/tmp/some-project', '.claude', 'commands', 'evolve', 'scan.md'));
  });

  it('warns about stale project-level commands when directory exists', async () => {
    const { readFile, mkdir, access, writeFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedAccess = vi.mocked(access);
    const mockedWriteFile = vi.mocked(writeFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // Settings file does not exist
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    // For slash command files: access behavior depends on the path
    // Global HOME commands don't exist (ENOENT) but project-level dir exists
    const enoent = new Error('ENOENT') as NodeJS.ErrnoException;
    enoent.code = 'ENOENT';
    mockedAccess.mockImplementation(async (p: Parameters<typeof access>[0]) => {
      const pathStr = String(p);
      // Project-level commands dir exists (stale)
      if (pathStr === join('/tmp/stale-project', '.claude', 'commands', 'evolve')) {
        return undefined;
      }
      // All other access calls (file existence checks) throw ENOENT
      throw enoent;
    });

    mockedWriteFile.mockResolvedValue(undefined);

    const originalHome = process.env.HOME;
    process.env.HOME = '/tmp/fake-home-stale';

    const { runInit } = await import('../../../src/cli/init.js');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/stale-project/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
        projectDir: '/tmp/stale-project',
      });
    } finally {
      console.log = originalLog;
      process.env.HOME = originalHome;
    }

    // Should warn about stale project-level commands
    expect(logs.some((l) => l.includes('project-level') || l.includes('stale'))).toBe(true);
  });

  it('does NOT warn when project-level commands directory does not exist', async () => {
    const { readFile, mkdir, access, writeFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedAccess = vi.mocked(access);
    const mockedWriteFile = vi.mocked(writeFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    // Settings file does not exist
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    // All access calls throw ENOENT (no stale project dir, no existing command files)
    const enoent = new Error('ENOENT') as NodeJS.ErrnoException;
    enoent.code = 'ENOENT';
    mockedAccess.mockRejectedValue(enoent);

    mockedWriteFile.mockResolvedValue(undefined);

    const originalHome = process.env.HOME;
    process.env.HOME = '/tmp/fake-home-nostale';

    const { runInit } = await import('../../../src/cli/init.js');

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));

    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/nostale-project/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
        projectDir: '/tmp/nostale-project',
      });
    } finally {
      console.log = originalLog;
      process.env.HOME = originalHome;
    }

    // Should NOT have stale/project-level warning
    expect(logs.some((l) => l.includes('project-level') && l.includes('stale'))).toBe(false);
  });

  it('creates global ~/.claude/commands/evolve/ directory', async () => {
    const { readFile, mkdir, access, writeFile } = await import('node:fs/promises');
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedReadFile = vi.mocked(readFile);
    const mockedMkdir = vi.mocked(mkdir);
    const mockedAccess = vi.mocked(access);
    const mockedWriteFile = vi.mocked(writeFile);
    const mockedWrite = vi.mocked(writeFileAtomic);

    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);
    mockedMkdir.mockResolvedValue(undefined as never);
    mockedWrite.mockResolvedValueOnce(undefined);

    // Files don't exist
    const enoent = new Error('ENOENT') as NodeJS.ErrnoException;
    enoent.code = 'ENOENT';
    mockedAccess.mockRejectedValue(enoent);
    mockedWriteFile.mockResolvedValue(undefined);

    const originalHome = process.env.HOME;
    process.env.HOME = '/tmp/test-mkdirslash-home';

    const { runInit } = await import('../../../src/cli/init.js');

    const originalLog = console.log;
    console.log = () => {};
    try {
      await runInit({
        yes: true,
        settingsPath: '/tmp/test-mkdirslash/.claude/settings.json',
        baseDirOverride: '/opt/harness-evolve/dist',
        projectDir: '/tmp/test-mkdirslash',
      });
    } finally {
      console.log = originalLog;
      process.env.HOME = originalHome;
    }

    // mkdir should have been called with HOME-based .claude/commands/evolve/ path
    const mkdirCalls = mockedMkdir.mock.calls.map((c) => c[0]);
    expect(mkdirCalls).toContain(
      join('/tmp/test-mkdirslash-home', '.claude', 'commands', 'evolve'),
    );
  });
});
