// Unit tests for context-builder and scanner registry.
// Validates that buildScanContext reads all config sources from the filesystem
// and produces a valid ScanContext. Also verifies Scanner type and empty registry.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanContextSchema } from '../../../src/scan/schemas.js';
import { buildScanContext } from '../../../src/scan/context-builder.js';
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

  describe('nested hooks parsing (INFRA-01)', () => {
    it('parses nested hooks format with matcher into individual hook entries', async () => {
      await mkdir(join(fakeCwd, '.claude'), { recursive: true });
      await writeFile(
        join(fakeCwd, '.claude', 'settings.json'),
        JSON.stringify({
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [{ type: 'command', command: 'echo test' }],
              },
            ],
          },
        }),
      );

      const ctx = await buildScanContext(fakeCwd, fakeHome);

      const hook = ctx.hooks_registered.find(
        (h) => h.scope === 'project' && h.event === 'PreToolUse',
      );
      expect(hook).toBeDefined();
      expect(hook!.type).toBe('command');
      expect(hook!.command).toBe('echo test');
      expect(hook!.matcher).toBe('Bash');
    });

    it('parses flat hooks format without matcher (backward compatibility)', async () => {
      await mkdir(join(fakeCwd, '.claude'), { recursive: true });
      await writeFile(
        join(fakeCwd, '.claude', 'settings.json'),
        JSON.stringify({
          hooks: {
            UserPromptSubmit: [
              { type: 'command', command: 'node capture.js' },
            ],
          },
        }),
      );

      const ctx = await buildScanContext(fakeCwd, fakeHome);

      const hook = ctx.hooks_registered.find(
        (h) => h.scope === 'project' && h.event === 'UserPromptSubmit',
      );
      expect(hook).toBeDefined();
      expect(hook!.type).toBe('command');
      expect(hook!.command).toBe('node capture.js');
      expect(hook!.matcher).toBeUndefined();
    });

    it('parses mixed format (nested + flat in different events)', async () => {
      await mkdir(join(fakeCwd, '.claude'), { recursive: true });
      await writeFile(
        join(fakeCwd, '.claude', 'settings.json'),
        JSON.stringify({
          hooks: {
            PreToolUse: [
              {
                matcher: 'Bash',
                hooks: [{ type: 'command', command: 'echo nested' }],
              },
            ],
            Stop: [
              { type: 'command', command: 'echo flat-stop' },
            ],
          },
        }),
      );

      const ctx = await buildScanContext(fakeCwd, fakeHome);

      const nestedHook = ctx.hooks_registered.find(
        (h) => h.event === 'PreToolUse' && h.scope === 'project',
      );
      expect(nestedHook).toBeDefined();
      expect(nestedHook!.command).toBe('echo nested');
      expect(nestedHook!.matcher).toBe('Bash');

      const flatHook = ctx.hooks_registered.find(
        (h) => h.event === 'Stop' && h.scope === 'project',
      );
      expect(flatHook).toBeDefined();
      expect(flatHook!.command).toBe('echo flat-stop');
      expect(flatHook!.matcher).toBeUndefined();
    });

    it('parses nested format without matcher field (matcher=undefined)', async () => {
      await mkdir(join(fakeCwd, '.claude'), { recursive: true });
      await writeFile(
        join(fakeCwd, '.claude', 'settings.json'),
        JSON.stringify({
          hooks: {
            PostToolUse: [
              {
                hooks: [{ type: 'command', command: 'echo no-matcher' }],
              },
            ],
          },
        }),
      );

      const ctx = await buildScanContext(fakeCwd, fakeHome);

      const hook = ctx.hooks_registered.find(
        (h) => h.event === 'PostToolUse' && h.scope === 'project',
      );
      expect(hook).toBeDefined();
      expect(hook!.command).toBe('echo no-matcher');
      expect(hook!.matcher).toBeUndefined();
    });

    it('parses nested format with multiple inner hooks producing multiple entries', async () => {
      await mkdir(join(fakeCwd, '.claude'), { recursive: true });
      await writeFile(
        join(fakeCwd, '.claude', 'settings.json'),
        JSON.stringify({
          hooks: {
            PreToolUse: [
              {
                matcher: '*',
                hooks: [
                  { type: 'command', command: 'echo first' },
                  { type: 'command', command: 'echo second' },
                ],
              },
            ],
          },
        }),
      );

      const ctx = await buildScanContext(fakeCwd, fakeHome);

      const hooks = ctx.hooks_registered.filter(
        (h) => h.event === 'PreToolUse' && h.scope === 'project',
      );
      expect(hooks).toHaveLength(2);
      expect(hooks[0].command).toBe('echo first');
      expect(hooks[0].matcher).toBe('*');
      expect(hooks[1].command).toBe('echo second');
      expect(hooks[1].matcher).toBe('*');
    });
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

describe('extractReferences filtering', () => {
  // Import extractReferences directly for targeted unit tests
  let extractReferences: (content: string) => string[];

  beforeEach(async () => {
    const mod = await import('../../../src/scan/context-builder.js');
    extractReferences = mod.extractReferences;
  });

  it('filters npm scoped package @scope/package (no file extension)', () => {
    expect(extractReferences('@scope/package')).toEqual([]);
  });

  it('filters real npm scoped package @commander-js/extra-typings', () => {
    expect(extractReferences('@commander-js/extra-typings')).toEqual([]);
  });

  it('filters npm scoped package in JSON/import context "@scope/package"', () => {
    expect(extractReferences('"@scope/package"')).toEqual([]);
  });

  it('filters URL user path github.com/@user/repo', () => {
    expect(extractReferences('github.com/@user/repo')).toEqual([]);
  });

  it('filters URL user path https://npmjs.com/@scope/pkg', () => {
    expect(extractReferences('https://npmjs.com/@scope/pkg')).toEqual([]);
  });

  it('preserves real file reference @docs/guide.md', () => {
    expect(extractReferences('See @docs/guide.md for details')).toEqual(['docs/guide.md']);
  });

  it('preserves deep path reference @.planning/phases/01-foo/bar.md', () => {
    expect(extractReferences('@.planning/phases/01-foo/bar.md')).toEqual(['.planning/phases/01-foo/bar.md']);
  });

  it('preserves file with extension @src/utils.ts', () => {
    expect(extractReferences('@src/utils.ts')).toEqual(['src/utils.ts']);
  });

  it('filters scoped package but keeps real file reference in mixed content', () => {
    expect(extractReferences('use @scope/package and @docs/guide.md')).toEqual(['docs/guide.md']);
  });
});

