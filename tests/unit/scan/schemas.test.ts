// Unit tests for scan module schemas.
// Verifies ScanContext Zod schema accepts valid config data, rejects invalid,
// and that patternTypeSchema has been extended with scan-specific values.

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod/v4';
import { scanContextSchema } from '../../../src/scan/schemas.js';
import { patternTypeSchema } from '../../../src/schemas/recommendation.js';

describe('scanContextSchema', () => {
  const validClaudeMdEntry = {
    path: '/home/user/.claude/CLAUDE.md',
    scope: 'user' as const,
    content: '# CLAUDE.md\n\nSome config.',
    line_count: 3,
    headings: ['CLAUDE.md'],
    references: [],
  };

  const validRuleEntry = {
    path: '/project/.claude/rules/00-core/behavior.md',
    filename: 'behavior.md',
    content: '# Behavior\n\nBe nice.',
    headings: ['Behavior'],
  };

  const validCommandEntry = {
    path: '/project/.claude/commands/deploy.md',
    name: 'deploy',
    content: 'Deploy the project.',
  };

  const validHookEntry = {
    event: 'UserPromptSubmit',
    scope: 'user' as const,
    type: 'command',
    command: 'node hook.js',
  };

  const validScanContext = {
    generated_at: new Date().toISOString(),
    project_root: '/home/user/project',
    claude_md_files: [validClaudeMdEntry],
    rules: [validRuleEntry],
    settings: {
      user: { permissions: { allow: ['Bash'] } },
      project: null,
      local: null,
    },
    commands: [validCommandEntry],
    hooks_registered: [validHookEntry],
  };

  it('accepts a valid ScanContext with all fields', () => {
    const result = scanContextSchema.parse(validScanContext);
    expect(result.project_root).toBe('/home/user/project');
    expect(result.claude_md_files).toHaveLength(1);
    expect(result.rules).toHaveLength(1);
    expect(result.commands).toHaveLength(1);
    expect(result.hooks_registered).toHaveLength(1);
    expect(result.generated_at).toBeDefined();
  });

  it('rejects missing required fields', () => {
    const invalid = { ...validScanContext };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (invalid as any).project_root;
    expect(() => scanContextSchema.parse(invalid)).toThrow(ZodError);
  });

  it('validates claude_md_files entry with all required fields', () => {
    const entry = validClaudeMdEntry;
    const ctx = { ...validScanContext, claude_md_files: [entry] };
    const result = scanContextSchema.parse(ctx);
    const parsed = result.claude_md_files[0];
    expect(parsed.path).toBe(entry.path);
    expect(parsed.scope).toBe('user');
    expect(parsed.content).toBe(entry.content);
    expect(parsed.line_count).toBe(3);
    expect(parsed.headings).toEqual(['CLAUDE.md']);
    expect(parsed.references).toEqual([]);
  });

  it('validates rules entry with required fields and optional frontmatter', () => {
    const ruleWithFrontmatter = {
      ...validRuleEntry,
      frontmatter: { paths: ['src/**/*.ts'] },
    };
    const ctx = { ...validScanContext, rules: [ruleWithFrontmatter] };
    const result = scanContextSchema.parse(ctx);
    const parsed = result.rules[0];
    expect(parsed.path).toBe(validRuleEntry.path);
    expect(parsed.filename).toBe('behavior.md');
    expect(parsed.content).toBe(validRuleEntry.content);
    expect(parsed.headings).toEqual(['Behavior']);
    expect(parsed.frontmatter?.paths).toEqual(['src/**/*.ts']);
  });

  it('validates settings with nullable user/project/local', () => {
    const ctx = {
      ...validScanContext,
      settings: {
        user: null,
        project: { hooks: {} },
        local: null,
      },
    };
    const result = scanContextSchema.parse(ctx);
    expect(result.settings.user).toBeNull();
    expect(result.settings.project).toEqual({ hooks: {} });
    expect(result.settings.local).toBeNull();
  });

  it('validates commands entry with path, name, content', () => {
    const ctx = { ...validScanContext };
    const result = scanContextSchema.parse(ctx);
    const parsed = result.commands[0];
    expect(parsed.path).toBe(validCommandEntry.path);
    expect(parsed.name).toBe('deploy');
    expect(parsed.content).toBe('Deploy the project.');
  });

  it('validates hooks_registered entry with event, scope, type, and optional command', () => {
    // Hook with command
    const ctx1 = { ...validScanContext };
    const result1 = scanContextSchema.parse(ctx1);
    expect(result1.hooks_registered[0].event).toBe('UserPromptSubmit');
    expect(result1.hooks_registered[0].scope).toBe('user');
    expect(result1.hooks_registered[0].type).toBe('command');
    expect(result1.hooks_registered[0].command).toBe('node hook.js');

    // Hook without command
    const hookNoCommand = {
      event: 'Stop',
      scope: 'project' as const,
      type: 'agent',
    };
    const ctx2 = { ...validScanContext, hooks_registered: [hookNoCommand] };
    const result2 = scanContextSchema.parse(ctx2);
    expect(result2.hooks_registered[0].command).toBeUndefined();
  });
});

describe('patternTypeSchema scan extensions', () => {
  it('includes scan_redundancy', () => {
    expect(patternTypeSchema.parse('scan_redundancy')).toBe('scan_redundancy');
  });

  it('includes scan_missing_mechanization', () => {
    expect(patternTypeSchema.parse('scan_missing_mechanization')).toBe(
      'scan_missing_mechanization',
    );
  });

  it('includes scan_stale_reference', () => {
    expect(patternTypeSchema.parse('scan_stale_reference')).toBe(
      'scan_stale_reference',
    );
  });

  it('preserves all original pattern type values', () => {
    const originals = [
      'repeated_prompt',
      'long_prompt',
      'permission-always-approved',
      'code_correction',
      'personal_info',
      'config_drift',
      'version_update',
      'ecosystem_gsd',
      'ecosystem_cog',
      'onboarding_start_hooks',
      'onboarding_start_rules',
      'onboarding_start_claudemd',
      'onboarding_optimize',
    ];
    for (const pt of originals) {
      expect(patternTypeSchema.parse(pt)).toBe(pt);
    }
  });
});
