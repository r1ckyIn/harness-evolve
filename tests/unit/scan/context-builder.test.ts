// Unit tests for context-builder and scanner registry.
// Validates that buildScanContext reads all config sources from the filesystem
// and produces a valid ScanContext. Also verifies Scanner type and empty registry.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanContextSchema } from '../../../src/scan/schemas.js';
import { buildScanContext } from '../../../src/scan/context-builder.js';
import type { Scanner } from '../../../src/scan/scanners/index.js';
import { scanners } from '../../../src/scan/scanners/index.js';

let fakeHome: string;
let fakeCwd: string;

beforeEach(async () => {
  const base = await mkdtemp(join(tmpdir(), 'scan-ctx-'));
  fakeHome = join(base, 'home');
  fakeCwd = join(base, 'project');
  await mkdir(join(fakeHome, '.claude'), { recursive: true });
  await mkdir(fakeCwd, { recursive: true });
});

afterEach(async () => {
  // Clean up all temp dirs
  await rm(fakeHome, { recursive: true, force: true });
  await rm(fakeCwd, { recursive: true, force: true });
});

describe('buildScanContext', () => {
  it('reads CLAUDE.md from cwd root with scope=project', async () => {
    const content = '# Project Config\n\nSome content here.\n\nSee @docs/guide.md for details.';
    await writeFile(join(fakeCwd, 'CLAUDE.md'), content);

    const ctx = await buildScanContext(fakeCwd, fakeHome);

    const projectFile = ctx.claude_md_files.find((f) => f.scope === 'project');
    expect(projectFile).toBeDefined();
    expect(projectFile!.content).toBe(content);
    expect(projectFile!.headings).toEqual(['Project Config']);
    expect(projectFile!.references).toContain('docs/guide.md');
    expect(projectFile!.line_count).toBe(5);
  });

  it('reads CLAUDE.md from ~/.claude/CLAUDE.md with scope=user', async () => {
    const content = '# User Config\n## Settings\nMy preferences.';
    await writeFile(join(fakeHome, '.claude', 'CLAUDE.md'), content);

    const ctx = await buildScanContext(fakeCwd, fakeHome);

    const userFile = ctx.claude_md_files.find((f) => f.scope === 'user');
    expect(userFile).toBeDefined();
    expect(userFile!.content).toBe(content);
    expect(userFile!.headings).toEqual(['User Config', 'Settings']);
  });

  it('reads .claude/rules/*.md recursively into rules array', async () => {
    const rulesDir = join(fakeCwd, '.claude', 'rules', '00-core');
    await mkdir(rulesDir, { recursive: true });
    const ruleContent = '# Behavior\n\n## Sub-heading\n\nBe nice.';
    await writeFile(join(rulesDir, 'behavior.md'), ruleContent);

    const ctx = await buildScanContext(fakeCwd, fakeHome);

    expect(ctx.rules.length).toBeGreaterThanOrEqual(1);
    const rule = ctx.rules.find((r) => r.filename === 'behavior.md');
    expect(rule).toBeDefined();
    expect(rule!.content).toBe(ruleContent);
    expect(rule!.headings).toEqual(['Behavior', 'Sub-heading']);
  });

  it('reads settings.json at all 3 scopes', async () => {
    await writeFile(
      join(fakeHome, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: ['Bash'] } }),
    );
    await mkdir(join(fakeCwd, '.claude'), { recursive: true });
    await writeFile(
      join(fakeCwd, '.claude', 'settings.json'),
      JSON.stringify({ hooks: {} }),
    );
    await writeFile(
      join(fakeCwd, '.claude', 'settings.local.json'),
      JSON.stringify({ enabledPlugins: ['test'] }),
    );

    const ctx = await buildScanContext(fakeCwd, fakeHome);

    expect(ctx.settings.user).toEqual({ permissions: { allow: ['Bash'] } });
    expect(ctx.settings.project).toEqual({ hooks: {} });
    expect(ctx.settings.local).toEqual({ enabledPlugins: ['test'] });
  });

  it('reads .claude/commands/*.md into commands array', async () => {
    const cmdDir = join(fakeCwd, '.claude', 'commands');
    await mkdir(cmdDir, { recursive: true });
    await writeFile(join(cmdDir, 'deploy.md'), 'Deploy the project to staging.');

    const ctx = await buildScanContext(fakeCwd, fakeHome);

    expect(ctx.commands).toHaveLength(1);
    expect(ctx.commands[0].name).toBe('deploy');
    expect(ctx.commands[0].content).toBe('Deploy the project to staging.');
  });

  it('extracts hooks_registered from all settings scopes', async () => {
    await writeFile(
      join(fakeHome, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          UserPromptSubmit: [
            { type: 'command', command: 'node capture.js' },
          ],
        },
      }),
    );
    await mkdir(join(fakeCwd, '.claude'), { recursive: true });
    await writeFile(
      join(fakeCwd, '.claude', 'settings.json'),
      JSON.stringify({
        hooks: {
          PreToolUse: [{ type: 'command', command: 'echo pre' }],
        },
      }),
    );

    const ctx = await buildScanContext(fakeCwd, fakeHome);

    expect(ctx.hooks_registered.length).toBeGreaterThanOrEqual(2);
    const userHook = ctx.hooks_registered.find(
      (h) => h.scope === 'user' && h.event === 'UserPromptSubmit',
    );
    expect(userHook).toBeDefined();
    expect(userHook!.command).toBe('node capture.js');

    const projectHook = ctx.hooks_registered.find(
      (h) => h.scope === 'project' && h.event === 'PreToolUse',
    );
    expect(projectHook).toBeDefined();
  });

  it('returns empty arrays when directories/files do not exist', async () => {
    const emptyHome = join(fakeHome, 'empty');
    const emptyCwd = join(fakeCwd, 'empty');
    await mkdir(emptyHome, { recursive: true });
    await mkdir(emptyCwd, { recursive: true });

    const ctx = await buildScanContext(emptyCwd, emptyHome);

    expect(ctx.claude_md_files).toEqual([]);
    expect(ctx.rules).toEqual([]);
    expect(ctx.commands).toEqual([]);
    expect(ctx.hooks_registered).toEqual([]);
    expect(ctx.settings.user).toBeNull();
    expect(ctx.settings.project).toBeNull();
    expect(ctx.settings.local).toBeNull();
  });

  it('extracts headings from markdown using heading regex', async () => {
    const content = [
      '# H1',
      '## H2',
      '### H3',
      '#### H4',
      '##### H5',
      '###### H6',
      'Not a heading',
      '#Not a heading either',
    ].join('\n');
    await writeFile(join(fakeCwd, 'CLAUDE.md'), content);

    const ctx = await buildScanContext(fakeCwd, fakeHome);
    const file = ctx.claude_md_files.find((f) => f.scope === 'project');
    expect(file).toBeDefined();
    expect(file!.headings).toEqual(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  });

  it('extracts @references from CLAUDE.md content', async () => {
    const content = [
      '# Config',
      'See @docs/guide.md for details.',
      'Also check @.planning/PROJECT.md and @src/index.ts.',
      'Email user@example.com should not match.',
    ].join('\n');
    await writeFile(join(fakeCwd, 'CLAUDE.md'), content);

    const ctx = await buildScanContext(fakeCwd, fakeHome);
    const file = ctx.claude_md_files.find((f) => f.scope === 'project');
    expect(file).toBeDefined();
    expect(file!.references).toContain('docs/guide.md');
    expect(file!.references).toContain('.planning/PROJECT.md');
    expect(file!.references).toContain('src/index.ts');
  });

  it('produces output that validates against scanContextSchema', async () => {
    await writeFile(join(fakeCwd, 'CLAUDE.md'), '# Test');

    const ctx = await buildScanContext(fakeCwd, fakeHome);

    // Should not throw
    const validated = scanContextSchema.parse(ctx);
    expect(validated.project_root).toBe(fakeCwd);
    expect(validated.generated_at).toBeDefined();
  });
});

describe('Scanner type and registry', () => {
  it('Scanner type signature is (context: ScanContext) => Recommendation[]', () => {
    // Type-level check: if Scanner doesn't match the expected signature,
    // TypeScript compilation will fail. Runtime check: verify scanners is an array.
    const mockScanner: Scanner = () => [];
    expect(typeof mockScanner).toBe('function');
    expect(mockScanner({} as Parameters<Scanner>[0])).toEqual([]);
  });

  it('scanners array is initially empty', () => {
    expect(scanners).toEqual([]);
    expect(Array.isArray(scanners)).toBe(true);
  });
});
