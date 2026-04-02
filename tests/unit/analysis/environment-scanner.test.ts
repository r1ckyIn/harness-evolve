// Unit tests for environment scanner -- covers tool discovery, version detection,
// settings reading, ecosystem detection, and graceful fallback behavior.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { environmentSnapshotSchema } from '../../../src/analysis/schemas.js';

// Temp directories for simulating HOME and CWD
let tempDir: string;
let fakeHome: string;
let fakeCwd: string;

// Mock child_process to control version output
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

// Mock dirs module to redirect environmentSnapshot path to temp directory
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
        pending: join(tempDir, 'pending'),
        config: join(tempDir, 'config.json'),
        counter: join(tempDir, 'counter.json'),
      };
    },
    ensureInit: async () => {
      const { mkdir: mk } = await import('node:fs/promises');
      await mk(join(tempDir, 'analysis'), { recursive: true });
    },
    resetInit: () => {},
  };
});

const { execFileSync } = await import('node:child_process');
const { scanEnvironment } = await import('../../../src/analysis/environment-scanner.js');

describe('environment scanner', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-env-'));
    fakeHome = join(tempDir, 'home');
    fakeCwd = join(tempDir, 'project');

    // Create base directories
    await mkdir(join(fakeHome, '.claude'), { recursive: true });
    await mkdir(fakeCwd, { recursive: true });
    await mkdir(join(tempDir, 'analysis'), { recursive: true });

    // Reset the mock
    vi.mocked(execFileSync).mockReset();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('detects Claude Code version from cli output', async () => {
    vi.mocked(execFileSync).mockReturnValue('2.1.87 (Claude Code)\n');

    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    expect(snapshot.claude_code.version).toBe('2.1.87');
    expect(snapshot.claude_code.version_known).toBe(true);
    expect(snapshot.claude_code.compatible).toBe(true);
  });

  it('handles untested version', async () => {
    vi.mocked(execFileSync).mockReturnValue('3.0.0 (Claude Code)');

    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    expect(snapshot.claude_code.version).toBe('3.0.0');
    expect(snapshot.claude_code.version_known).toBe(true);
    expect(snapshot.claude_code.compatible).toBe(false);
  });

  it('handles missing claude cli', async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('ENOENT: claude not found');
    });

    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    expect(snapshot.claude_code.version).toBe('unknown');
    expect(snapshot.claude_code.version_known).toBe(false);
    expect(snapshot.claude_code.compatible).toBe(false);
  });

  it('reads settings from all 3 scopes', async () => {
    // Create user settings
    await writeFile(
      join(fakeHome, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: ['Bash'] } }),
    );
    // Create project settings
    await mkdir(join(fakeCwd, '.claude'), { recursive: true });
    await writeFile(
      join(fakeCwd, '.claude', 'settings.json'),
      JSON.stringify({ hooks: { UserPromptSubmit: [] } }),
    );
    // Create local settings
    await writeFile(
      join(fakeCwd, '.claude', 'settings.local.json'),
      JSON.stringify({ enabledPlugins: ['test-plugin'] }),
    );

    vi.mocked(execFileSync).mockReturnValue('2.1.50 (Claude Code)');
    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    expect(snapshot.settings.user).toBeTruthy();
    expect(snapshot.settings.project).toBeTruthy();
    expect(snapshot.settings.local).toBeTruthy();
  });

  it('returns null for missing settings', async () => {
    vi.mocked(execFileSync).mockReturnValue('2.1.50 (Claude Code)');
    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    expect(snapshot.settings.user).toBeNull();
    expect(snapshot.settings.project).toBeNull();
    expect(snapshot.settings.local).toBeNull();
  });

  it('discovers user and project skills', async () => {
    // Create user skills
    await mkdir(join(fakeHome, '.claude', 'skills', 'pr-cycle'), { recursive: true });
    await mkdir(join(fakeHome, '.claude', 'skills', 'commit'), { recursive: true });

    // Create project skills
    await mkdir(join(fakeCwd, '.claude', 'skills', 'deploy'), { recursive: true });

    vi.mocked(execFileSync).mockReturnValue('2.1.50 (Claude Code)');
    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    const userSkills = snapshot.installed_tools.skills.filter(s => s.scope === 'user');
    const projectSkills = snapshot.installed_tools.skills.filter(s => s.scope === 'project');

    expect(userSkills.length).toBe(2);
    expect(projectSkills.length).toBe(1);
    expect(userSkills.map(s => s.name)).toContain('pr-cycle');
    expect(userSkills.map(s => s.name)).toContain('commit');
    expect(projectSkills[0].name).toBe('deploy');
  });

  it('discovers project rules', async () => {
    // Create rule directories
    await mkdir(join(fakeCwd, '.claude', 'rules', '00-core'), { recursive: true });
    await mkdir(join(fakeCwd, '.claude', 'rules', '01-workflow'), { recursive: true });

    vi.mocked(execFileSync).mockReturnValue('2.1.50 (Claude Code)');
    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    const rules = snapshot.installed_tools.rules;
    expect(rules.length).toBe(2);
    expect(rules.every(r => r.scope === 'project')).toBe(true);
    expect(rules.map(r => r.name)).toContain('00-core');
    expect(rules.map(r => r.name)).toContain('01-workflow');
  });

  it('extracts hooks from settings', async () => {
    // Create settings with hooks config
    await writeFile(
      join(fakeHome, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          UserPromptSubmit: [
            { type: 'command', command: 'node hook.js' },
          ],
          Stop: [
            { type: 'agent', command: 'analyze' },
          ],
        },
      }),
    );

    // Create project settings with hooks
    await mkdir(join(fakeCwd, '.claude'), { recursive: true });
    await writeFile(
      join(fakeCwd, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [
            { type: 'command', command: 'echo test' },
          ],
        },
      }),
    );

    vi.mocked(execFileSync).mockReturnValue('2.1.50 (Claude Code)');
    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    const hooks = snapshot.installed_tools.hooks;
    expect(hooks.length).toBe(3);

    const userHooks = hooks.filter(h => h.scope === 'user');
    const projectHooks = hooks.filter(h => h.scope === 'project');
    expect(userHooks.length).toBe(2);
    expect(projectHooks.length).toBe(1);
    expect(userHooks.map(h => h.event)).toContain('UserPromptSubmit');
    expect(userHooks.map(h => h.event)).toContain('Stop');
  });

  it('detects CLAUDE.md existence', async () => {
    // Create CLAUDE.md in cwd
    await writeFile(join(fakeCwd, 'CLAUDE.md'), '# Project CLAUDE.md');

    vi.mocked(execFileSync).mockReturnValue('2.1.50 (Claude Code)');
    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    const cwdClaudeMd = snapshot.installed_tools.claude_md.find(c =>
      c.path.includes(join(fakeCwd, 'CLAUDE.md')),
    );
    expect(cwdClaudeMd).toBeDefined();
    expect(cwdClaudeMd!.exists).toBe(true);
  });

  it('detects GSD ecosystem', async () => {
    // Create .planning directory
    await mkdir(join(fakeCwd, '.planning'), { recursive: true });

    vi.mocked(execFileSync).mockReturnValue('2.1.50 (Claude Code)');
    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    expect(snapshot.detected_ecosystems).toContain('gsd');
  });

  it('identifies 3+ tool types', async () => {
    // Create skills
    await mkdir(join(fakeCwd, '.claude', 'skills', 'my-skill'), { recursive: true });
    // Create rules
    await mkdir(join(fakeCwd, '.claude', 'rules', 'my-rule'), { recursive: true });
    // Create CLAUDE.md
    await writeFile(join(fakeCwd, 'CLAUDE.md'), '# CLAUDE');

    vi.mocked(execFileSync).mockReturnValue('2.1.50 (Claude Code)');
    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    // Count categories with at least one entry
    const tools = snapshot.installed_tools;
    let categoriesWithEntries = 0;
    if (tools.plugins.length > 0) categoriesWithEntries++;
    if (tools.skills.length > 0) categoriesWithEntries++;
    if (tools.rules.length > 0) categoriesWithEntries++;
    if (tools.hooks.length > 0) categoriesWithEntries++;
    if (tools.claude_md.filter(c => c.exists).length > 0) categoriesWithEntries++;

    expect(categoriesWithEntries).toBeGreaterThanOrEqual(3);
  });

  it('validates output against environmentSnapshotSchema', async () => {
    vi.mocked(execFileSync).mockReturnValue('2.1.50 (Claude Code)');
    const snapshot = await scanEnvironment(fakeCwd, fakeHome);

    // Schema validation should not throw
    const validated = environmentSnapshotSchema.parse(snapshot);
    expect(validated.generated_at).toBeDefined();
    expect(validated.claude_code).toBeDefined();
    expect(validated.settings).toBeDefined();
    expect(validated.installed_tools).toBeDefined();
    expect(validated.detected_ecosystems).toBeDefined();
  });

  it('gracefully handles missing directories', async () => {
    const nonExistentCwd = join(tempDir, 'does-not-exist');
    const nonExistentHome = join(tempDir, 'no-home');

    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const snapshot = await scanEnvironment(nonExistentCwd, nonExistentHome);

    // Should return valid snapshot with empty arrays
    expect(snapshot.installed_tools.plugins).toEqual([]);
    expect(snapshot.installed_tools.skills).toEqual([]);
    expect(snapshot.installed_tools.rules).toEqual([]);
    expect(snapshot.installed_tools.hooks).toEqual([]);
    expect(snapshot.claude_code.version).toBe('unknown');

    // Should still validate against schema
    expect(() => environmentSnapshotSchema.parse(snapshot)).not.toThrow();
  });
});
