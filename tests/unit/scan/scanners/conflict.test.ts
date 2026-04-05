// Unit tests for the conflict detection scanner.
// Verifies detection of contradictory directives across CLAUDE.md and rules.

import { describe, it, expect } from 'vitest';
import { scanConflicts, OPPOSITION_PAIRS } from '../../../../src/scan/scanners/conflict.js';
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

describe('scanConflicts', () => {
  it('returns empty array when no CLAUDE.md files and no rules exist', () => {
    const ctx = makeScanContext();
    const result = scanConflicts(ctx);
    expect(result).toEqual([]);
  });

  it('returns empty array when CLAUDE.md and rules have no contradictions', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: 'Always lint before committing.',
          line_count: 1,
          headings: [],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/testing.md',
          filename: 'testing.md',
          content: 'Always test before deploying.',
          headings: [],
        },
      ],
    });

    const result = scanConflicts(ctx);
    expect(result).toEqual([]);
  });

  it('detects "always use tabs" in CLAUDE.md vs "never use tabs" in a rule', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: 'Always use tabs for indentation.',
          line_count: 1,
          headings: [],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/formatting.md',
          filename: 'formatting.md',
          content: 'Never use tabs for indentation.',
          headings: [],
        },
      ],
    });

    const result = scanConflicts(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const rec = result[0];
    expect(rec.pattern_type).toBe('scan_rule_conflict');
  });

  it('detects "never allow force push" in CLAUDE.md vs "must always force push" in a rule', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: 'Never allow force-push to main branch.',
          line_count: 1,
          headings: [],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/git.md',
          filename: 'git.md',
          content: 'Must always force-push to keep history clean.',
          headings: [],
        },
      ],
    });

    const result = scanConflicts(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('detects opposition keywords: enable/disable', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: 'Enable strictNullChecks in all projects.',
          line_count: 1,
          headings: [],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/ts.md',
          filename: 'ts.md',
          content: 'Disable strictNullChecks for legacy code.',
          headings: [],
        },
      ],
    });

    const result = scanConflicts(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT flag non-contradictory instructions', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: 'Always lint before committing.',
          line_count: 1,
          headings: [],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/testing.md',
          filename: 'testing.md',
          content: 'Always test before deploying.',
          headings: [],
        },
      ],
    });

    const result = scanConflicts(ctx);
    expect(result).toEqual([]);
  });

  it('detected contradictions have severity "problem" and confidence "HIGH"', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: 'Require eslint in all files.',
          line_count: 1,
          headings: [],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/linting.md',
          filename: 'linting.md',
          content: 'Forbid eslint -- use biome instead.',
          headings: [],
        },
      ],
    });

    const result = scanConflicts(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const rec of result) {
      expect(rec.severity).toBe('problem');
      expect(rec.confidence).toBe('HIGH');
    }
  });

  it('suggested_action includes concrete optimization suggestion with expected effect text', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: 'Enable prettier for all files.',
          line_count: 1,
          headings: [],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/formatting.md',
          filename: 'formatting.md',
          content: 'Disable prettier -- use manual formatting.',
          headings: [],
        },
      ],
    });

    const result = scanConflicts(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const rec of result) {
      expect(rec.suggested_action).toContain('Expected effect:');
    }
  });

  it('all produced recommendations pass recommendationSchema.parse()', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: 'Always use spaces.\nEnable strictMode.',
          line_count: 2,
          headings: [],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/format.md',
          filename: 'format.md',
          content: 'Never use spaces.\nDisable strictMode.',
          headings: [],
        },
      ],
    });

    const result = scanConflicts(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const rec of result) {
      expect(() => recommendationSchema.parse(rec)).not.toThrow();
    }
  });

  it('OPPOSITION_PAIRS is exported and contains at least 3 pairs', () => {
    expect(Array.isArray(OPPOSITION_PAIRS)).toBe(true);
    expect(OPPOSITION_PAIRS.length).toBeGreaterThanOrEqual(3);
  });
});
