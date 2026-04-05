// Unit tests for the commands convention scanner.
// Verifies detection of empty command files, missing frontmatter,
// missing description field, and very short command content.

import { describe, it, expect } from 'vitest';
import { scanCommands } from '../../../../src/scan/scanners/commands.js';
import { recommendationSchema } from '../../../../src/schemas/recommendation.js';
import type { ScanContext } from '../../../../src/scan/schemas.js';

/** Build a minimal ScanContext for testing. */
function makeScanContext(overrides: Partial<ScanContext> = {}): ScanContext {
  return {
    generated_at: new Date().toISOString(),
    project_root: '/tmp/test-project',
    claude_md_files: [],
    rules: [],
    settings: { user: null, project: null, local: null },
    commands: [],
    hooks_registered: [],
    ...overrides,
  };
}

describe('scanCommands', () => {
  it('returns empty array when no commands exist', () => {
    const ctx = makeScanContext({ commands: [] });
    const result = scanCommands(ctx);
    expect(result).toEqual([]);
  });

  it('returns empty array when all commands have frontmatter with description and meaningful content', () => {
    const ctx = makeScanContext({
      commands: [
        {
          path: '/tmp/.claude/commands/evolve/scan.md',
          name: 'scan',
          content: [
            '---',
            'name: scan',
            'description: Run a deep scan of your configuration',
            '---',
            '',
            'Run a deep scan of your Claude Code configuration to detect quality issues.',
            'Present the results grouped by confidence level.',
          ].join('\n'),
        },
      ],
    });
    const result = scanCommands(ctx);
    expect(result).toEqual([]);
  });

  it('detects empty command file (content is empty or whitespace only)', () => {
    const ctx = makeScanContext({
      commands: [
        { path: '/tmp/.claude/commands/empty.md', name: 'empty', content: '' },
        { path: '/tmp/.claude/commands/whitespace.md', name: 'whitespace', content: '   \n  \n  ' },
      ],
    });
    const result = scanCommands(ctx);
    expect(result.length).toBeGreaterThanOrEqual(2);
    for (const rec of result) {
      expect(rec.severity).toBe('problem');
      expect(rec.confidence).toBe('HIGH');
      expect(rec.pattern_type).toBe('scan_command_convention');
    }
  });

  it('detects command with very short content (<50 chars after frontmatter)', () => {
    const ctx = makeScanContext({
      commands: [
        {
          path: '/tmp/.claude/commands/short.md',
          name: 'short',
          content: [
            '---',
            'name: short',
            'description: A short command',
            '---',
            'Do something.',
          ].join('\n'),
        },
      ],
    });
    const result = scanCommands(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const shortRec = result.find(r => r.title.toLowerCase().includes('short'));
    expect(shortRec).toBeDefined();
    expect(shortRec!.severity).toBe('suggestion');
    expect(shortRec!.confidence).toBe('LOW');
  });

  it('detects command missing description field in frontmatter', () => {
    const ctx = makeScanContext({
      commands: [
        {
          path: '/tmp/.claude/commands/no-desc.md',
          name: 'no-desc',
          content: [
            '---',
            'name: no-desc',
            '---',
            '',
            'This command does something but the frontmatter has no description field.',
            'It is long enough to avoid the short content check.',
          ].join('\n'),
        },
      ],
    });
    const result = scanCommands(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const descRec = result.find(r => r.title.toLowerCase().includes('description'));
    expect(descRec).toBeDefined();
    expect(descRec!.severity).toBe('suggestion');
    expect(descRec!.confidence).toBe('MEDIUM');
  });

  it('detects command with no frontmatter at all', () => {
    const ctx = makeScanContext({
      commands: [
        {
          path: '/tmp/.claude/commands/bare.md',
          name: 'bare',
          content: [
            'This is a command with no frontmatter at all.',
            'It just has raw markdown content without YAML delimiters.',
          ].join('\n'),
        },
      ],
    });
    const result = scanCommands(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const fmRec = result.find(r => r.title.toLowerCase().includes('frontmatter'));
    expect(fmRec).toBeDefined();
    expect(fmRec!.severity).toBe('suggestion');
    expect(fmRec!.confidence).toBe('MEDIUM');
  });

  it('does NOT flag commands with valid frontmatter containing description', () => {
    const ctx = makeScanContext({
      commands: [
        {
          path: '/tmp/.claude/commands/good.md',
          name: 'good',
          content: [
            '---',
            'name: good',
            'description: A well-documented command with proper instructions',
            '---',
            '',
            'This command does a thorough and complete job of its responsibilities.',
            'It provides detailed instructions for Claude to follow step by step.',
          ].join('\n'),
        },
      ],
    });
    const result = scanCommands(ctx);
    expect(result).toEqual([]);
  });

  it('does NOT flag the project own evolve commands (they have proper frontmatter + content)', () => {
    const ctx = makeScanContext({
      commands: [
        {
          path: '/tmp/.claude/commands/evolve/scan.md',
          name: 'scan',
          content: [
            '---',
            'name: scan',
            'description: Run a deep harness-evolve configuration scan to detect quality issues',
            'disable-model-invocation: true',
            '---',
            '',
            '# Evolve Scan',
            '',
            'Run a deep scan of the current project\'s Claude Code configuration to detect quality issues.',
            'Present the results grouped by confidence level.',
          ].join('\n'),
        },
      ],
    });
    const result = scanCommands(ctx);
    expect(result).toEqual([]);
  });

  it('suggested_action includes "Expected effect:" text', () => {
    const ctx = makeScanContext({
      commands: [
        { path: '/tmp/.claude/commands/empty.md', name: 'empty', content: '' },
      ],
    });
    const result = scanCommands(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const rec of result) {
      expect(rec.suggested_action).toContain('Expected effect:');
    }
  });

  it('all produced recommendations pass recommendationSchema.parse()', () => {
    const ctx = makeScanContext({
      commands: [
        { path: '/tmp/.claude/commands/empty.md', name: 'empty', content: '' },
        {
          path: '/tmp/.claude/commands/bare.md',
          name: 'bare',
          content: 'Just some text without frontmatter but long enough to not be short.',
        },
        {
          path: '/tmp/.claude/commands/no-desc.md',
          name: 'no-desc',
          content: [
            '---',
            'name: no-desc',
            '---',
            'A command without description field but with enough content to test properly.',
          ].join('\n'),
        },
        {
          path: '/tmp/.claude/commands/short.md',
          name: 'short',
          content: [
            '---',
            'name: short',
            'description: short one',
            '---',
            'Brief.',
          ].join('\n'),
        },
      ],
    });
    const result = scanCommands(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const rec of result) {
      expect(() => recommendationSchema.parse(rec)).not.toThrow();
    }
  });
});
