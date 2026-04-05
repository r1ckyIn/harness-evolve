// Unit tests for the structure audit scanner.
// Verifies detection of empty rules, oversized rules, headingless rules,
// and unscoped subdirectory rules.

import { describe, it, expect } from 'vitest';
import { scanStructure } from '../../../../src/scan/scanners/structure.js';
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

describe('scanStructure', () => {
  it('returns empty array when no rules exist', () => {
    const ctx = makeScanContext();
    const result = scanStructure(ctx);
    expect(result).toEqual([]);
  });

  it('returns empty array when all rules are well-formed', () => {
    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/git.md',
          filename: 'git.md',
          content: '# Git Rules\n\nAlways use conventional commits.\nWrite descriptive messages.',
          headings: ['Git Rules'],
        },
        {
          path: '/tmp/.claude/rules/testing.md',
          filename: 'testing.md',
          content: '# Testing Rules\n\nAlways write unit tests.\nUse Vitest for TypeScript.',
          headings: ['Testing Rules'],
        },
      ],
    });

    const result = scanStructure(ctx);
    expect(result).toEqual([]);
  });

  it('detects empty rule file (content is empty string)', () => {
    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/empty.md',
          filename: 'empty.md',
          content: '',
          headings: [],
        },
      ],
    });

    const result = scanStructure(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('problem');
    expect(result[0].confidence).toBe('HIGH');
    expect(result[0].pattern_type).toBe('scan_structure_issue');
  });

  it('detects near-empty rule file (content < 10 non-whitespace characters)', () => {
    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/stub.md',
          filename: 'stub.md',
          content: '  # TODO  ',
          headings: [],
        },
      ],
    });

    const result = scanStructure(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('problem');
    expect(result[0].confidence).toBe('HIGH');
  });

  it('detects oversized rule file (content > 200 lines)', () => {
    const longContent = Array.from(
      { length: 250 },
      (_, i) => `Line ${i + 1}: Some rule content here.`,
    ).join('\n');

    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/huge.md',
          filename: 'huge.md',
          content: `# Huge Rules\n${longContent}`,
          headings: ['Huge Rules'],
        },
      ],
    });

    const result = scanStructure(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('suggestion');
    expect(result[0].confidence).toBe('MEDIUM');
  });

  it('detects rule file without any headings', () => {
    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/no-heading.md',
          filename: 'no-heading.md',
          content: 'This rule has no headings.\nJust plain text with enough content here.',
          headings: [],
        },
      ],
    });

    const result = scanStructure(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('suggestion');
    expect(result[0].confidence).toBe('LOW');
  });

  it('detects rule in subdirectory without paths frontmatter', () => {
    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/01-workflow/dev.md',
          filename: 'dev.md',
          content: '# Development Workflow\n\nFollow the standard cycle for all development.',
          headings: ['Development Workflow'],
        },
      ],
    });

    const result = scanStructure(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('suggestion');
    expect(result[0].confidence).toBe('MEDIUM');
    expect(result[0].suggested_action).toContain('paths:');
  });

  it('does NOT flag rule in root rules/ dir without paths frontmatter', () => {
    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/git.md',
          filename: 'git.md',
          content: '# Git Rules\n\nGit rules for the project with enough content.',
          headings: ['Git Rules'],
        },
      ],
    });

    const result = scanStructure(ctx);
    expect(result).toEqual([]);
  });

  it('suggested_action includes expected effect text for each finding type', () => {
    const longContent = Array.from(
      { length: 250 },
      (_, i) => `Line ${i + 1}: content`,
    ).join('\n');

    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/empty.md',
          filename: 'empty.md',
          content: '',
          headings: [],
        },
        {
          path: '/tmp/.claude/rules/big.md',
          filename: 'big.md',
          content: `# Big\n${longContent}`,
          headings: ['Big'],
        },
        {
          path: '/tmp/.claude/rules/no-heading.md',
          filename: 'no-heading.md',
          content: 'Some meaningful content that is long enough to not be empty.',
          headings: [],
        },
        {
          path: '/tmp/.claude/rules/01-sub/unscoped.md',
          filename: 'unscoped.md',
          content: '# Unscoped Rule\n\nContent that has no paths frontmatter specified.',
          headings: ['Unscoped Rule'],
        },
      ],
    });

    const result = scanStructure(ctx);
    expect(result.length).toBeGreaterThanOrEqual(4);
    for (const rec of result) {
      expect(rec.suggested_action).toContain('Expected effect:');
    }
  });

  it('all produced recommendations pass recommendationSchema.parse()', () => {
    const longContent = Array.from(
      { length: 250 },
      (_, i) => `Line ${i + 1}: content`,
    ).join('\n');

    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/empty.md',
          filename: 'empty.md',
          content: '   ',
          headings: [],
        },
        {
          path: '/tmp/.claude/rules/big.md',
          filename: 'big.md',
          content: `# Big\n${longContent}`,
          headings: ['Big'],
        },
        {
          path: '/tmp/.claude/rules/flat-text.md',
          filename: 'flat-text.md',
          content: 'No markdown heading here but the content is meaningful enough to detect.',
          headings: [],
        },
      ],
    });

    const result = scanStructure(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const rec of result) {
      expect(() => recommendationSchema.parse(rec)).not.toThrow();
    }
  });
});
