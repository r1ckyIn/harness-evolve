// Integration test: CLI init -> status -> uninstall lifecycle.
// Uses temporary directories with real file I/O to verify the complete CLI flow.
// Tests init hook registration, idempotent re-init, hook preservation,
// and clean uninstall with non-harness-evolve hook survival.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  writeFile,
  readFile,
  mkdtemp,
  rm,
  mkdir,
  access,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runInit } from '../../src/cli/init.js';
import { runUninstall } from '../../src/cli/uninstall.js';

let tempDir: string;
let settingsPath: string;

// Silence console.log during tests
let originalLog: typeof console.log;
let logs: string[];

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'cli-integration-'));
  await mkdir(join(tempDir, '.claude'), { recursive: true });
  settingsPath = join(tempDir, '.claude', 'settings.json');

  logs = [];
  originalLog = console.log;
  console.log = (...args: unknown[]) => logs.push(args.join(' '));
});

afterEach(async () => {
  console.log = originalLog;
  await rm(tempDir, { recursive: true, force: true });
});

describe('CLI init -> status -> uninstall integration', () => {
  it('init writes hooks to settings.json with all 6 events', async () => {
    await runInit({
      yes: true,
      settingsPath,
      baseDirOverride: '/fake/harness-evolve/dist/cli',
    });

    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    const hooks = settings.hooks;

    // All 6 hook events should be present
    expect(Object.keys(hooks).sort()).toEqual([
      'PermissionRequest',
      'PostToolUse',
      'PostToolUseFailure',
      'PreToolUse',
      'Stop',
      'UserPromptSubmit',
    ]);

    // Each event should have exactly one matcher entry
    for (const event of Object.keys(hooks)) {
      expect(hooks[event]).toHaveLength(1);
      const entry = hooks[event][0];
      expect(entry.matcher).toBe('*');
      expect(entry.hooks).toHaveLength(1);
      // Command should be a node invocation with quoted path
      expect(entry.hooks[0].command).toMatch(/^node "/);
      // Path should resolve into hooks/ directory
      expect(entry.hooks[0].command).toContain('/dist/hooks/');
    }
  });

  it('init preserves existing non-harness-evolve hooks', async () => {
    // Write settings with an existing custom hook
    const existingSettings = {
      hooks: {
        UserPromptSubmit: [
          {
            matcher: '*.py',
            hooks: [{ type: 'command', command: 'python lint.py' }],
          },
        ],
      },
    };
    await writeFile(settingsPath, JSON.stringify(existingSettings, null, 2));

    await runInit({
      yes: true,
      settingsPath,
      baseDirOverride: '/fake/harness-evolve/dist/cli',
    });

    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);
    const userPromptHooks = settings.hooks.UserPromptSubmit;

    // Should have 2 entries: original custom hook + harness-evolve hook
    expect(userPromptHooks).toHaveLength(2);

    // First entry is the user's custom hook (preserved)
    expect(userPromptHooks[0].matcher).toBe('*.py');
    expect(userPromptHooks[0].hooks[0].command).toBe('python lint.py');

    // Second entry is the harness-evolve hook (appended)
    expect(userPromptHooks[1].matcher).toBe('*');
    expect(userPromptHooks[1].hooks[0].command).toContain('harness-evolve');
  });

  it('init creates backup of existing settings.json', async () => {
    // Write initial settings
    const initial = { allowedTools: ['Bash'] };
    await writeFile(settingsPath, JSON.stringify(initial, null, 2));

    await runInit({
      yes: true,
      settingsPath,
      baseDirOverride: '/fake/harness-evolve/dist/cli',
    });

    // Backup should exist with original content
    const backupPath = settingsPath + '.backup';
    const backupRaw = await readFile(backupPath, 'utf-8');
    const backup = JSON.parse(backupRaw);
    expect(backup).toEqual(initial);
  });

  it('init is idempotent -- no duplicate hooks on second run', async () => {
    // First init
    await runInit({
      yes: true,
      settingsPath,
      baseDirOverride: '/fake/harness-evolve/dist/cli',
    });

    // Second init (same settings)
    await runInit({
      yes: true,
      settingsPath,
      baseDirOverride: '/fake/harness-evolve/dist/cli',
    });

    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);

    // Each event should still have exactly 1 entry (not duplicated)
    for (const event of Object.keys(settings.hooks)) {
      expect(settings.hooks[event]).toHaveLength(1);
    }
  });

  it('uninstall removes harness-evolve hooks cleanly', async () => {
    // Run init to populate settings.json
    await runInit({
      yes: true,
      settingsPath,
      baseDirOverride: '/fake/harness-evolve/dist/cli',
    });

    // Verify hooks were written
    const beforeRaw = await readFile(settingsPath, 'utf-8');
    const before = JSON.parse(beforeRaw);
    expect(Object.keys(before.hooks).length).toBeGreaterThan(0);

    // Run uninstall
    await runUninstall({
      purge: false,
      yes: true,
      settingsPath,
    });

    // Verify hooks were removed
    const afterRaw = await readFile(settingsPath, 'utf-8');
    const after = JSON.parse(afterRaw);

    // hooks should be empty (all were harness-evolve only)
    expect(after.hooks).toEqual({});

    // File should still be valid JSON
    expect(() => JSON.parse(afterRaw)).not.toThrow();
  });

  it('uninstall preserves non-harness-evolve hooks after init', async () => {
    // Write settings with both custom and harness-evolve hooks
    const mixed = {
      hooks: {
        UserPromptSubmit: [
          {
            matcher: '*.py',
            hooks: [{ type: 'command', command: 'python lint.py' }],
          },
        ],
      },
    };
    await writeFile(settingsPath, JSON.stringify(mixed, null, 2));

    // Init adds harness-evolve hooks
    await runInit({
      yes: true,
      settingsPath,
      baseDirOverride: '/fake/harness-evolve/dist/cli',
    });

    // Uninstall removes only harness-evolve hooks
    await runUninstall({
      purge: false,
      yes: true,
      settingsPath,
    });

    const raw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(raw);

    // Custom hook should survive
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1);
    expect(settings.hooks.UserPromptSubmit[0].hooks[0].command).toBe(
      'python lint.py',
    );

    // harness-evolve events that had no user hooks should be gone
    expect(settings.hooks.Stop).toBeUndefined();
    expect(settings.hooks.PreToolUse).toBeUndefined();
  });
});
