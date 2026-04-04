// Unit tests for the redundancy scanner.
// Verifies detection of duplicate headings across CLAUDE.md and rule files,
// and duplicate content between rule files.

import { describe, it, expect } from 'vitest';
import { scanRedundancy } from '../../../../src/scan/scanners/redundancy.js';
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

describe('scanRedundancy', () => {
  it('returns empty array when no headings overlap between CLAUDE.md and rules', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/test-project/CLAUDE.md',
          scope: 'project',
          content: '# Overview\nSome content',
          line_count: 2,
          headings: ['Overview'],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/test-project/.claude/rules/git.md',
          filename: 'git.md',
          content: '# Git Rules\nSome rules',
          headings: ['Git Rules'],
        },
      ],
    });

    const result = scanRedundancy(ctx);
    expect(result).toEqual([]);
  });

  it('detects when a heading in CLAUDE.md matches a heading in a rule file (case-insensitive, whitespace-normalized)', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/test-project/CLAUDE.md',
          scope: 'project',
          content: '# Code Comments\nKeep them English',
          line_count: 2,
          headings: ['Code Comments'],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/test-project/.claude/rules/comments.md',
          filename: 'comments.md',
          content: '# code  comments\nAll English please',
          headings: ['code  comments'],
        },
      ],
    });

    const result = scanRedundancy(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].title).toContain('code comments');
  });

  it('produces recommendation with correct pattern_type, target, and confidence', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: '# Testing\nUse vitest',
          line_count: 2,
          headings: ['Testing'],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/testing.md',
          filename: 'testing.md',
          content: '# Testing\nVitest rules',
          headings: ['Testing'],
        },
      ],
    });

    const result = scanRedundancy(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].pattern_type).toBe('scan_redundancy');
    expect(result[0].target).toBe('RULE');
    expect(result[0].confidence).toBe('MEDIUM');
  });

  it('includes both file paths as evidence examples', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: '# Naming\nUse camelCase',
          line_count: 2,
          headings: ['Naming'],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/naming.md',
          filename: 'naming.md',
          content: '# Naming\nUse PascalCase',
          headings: ['Naming'],
        },
      ],
    });

    const result = scanRedundancy(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].evidence.examples).toContain('/tmp/CLAUDE.md');
    expect(result[0].evidence.examples).toContain('/tmp/.claude/rules/naming.md');
    expect(result[0].evidence.count).toBe(2);
  });

  it('does NOT flag headings that are similar but not matching (no false positives)', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: '# TypeScript Best Practices\nStrict mode',
          line_count: 2,
          headings: ['TypeScript Best Practices'],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/ts.md',
          filename: 'ts.md',
          content: '# TypeScript Naming Conventions\nUse PascalCase',
          headings: ['TypeScript Naming Conventions'],
        },
      ],
    });

    const result = scanRedundancy(ctx);
    expect(result).toEqual([]);
  });

  it('detects duplicate content between two rule files (same headings)', () => {
    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/git-rules.md',
          filename: 'git-rules.md',
          content: '# Branch Strategy\n# Commit Format\nSome content',
          headings: ['Branch Strategy', 'Commit Format'],
        },
        {
          path: '/tmp/.claude/rules/git-workflow.md',
          filename: 'git-workflow.md',
          content: '# Commit Format\n# Branch Strategy\nOther content',
          headings: ['Commit Format', 'Branch Strategy'],
        },
      ],
    });

    const result = scanRedundancy(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Should have a recommendation about duplicate rule files
    const dupRec = result.find(
      r => r.evidence.examples.includes('/tmp/.claude/rules/git-rules.md')
        && r.evidence.examples.includes('/tmp/.claude/rules/git-workflow.md'),
    );
    expect(dupRec).toBeDefined();
    expect(dupRec!.pattern_type).toBe('scan_redundancy');
  });

  it('produces recommendations that pass schema validation', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: '# Security\nCheck secrets',
          line_count: 2,
          headings: ['Security'],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/sec.md',
          filename: 'sec.md',
          content: '# Security\nNo secrets',
          headings: ['Security'],
        },
      ],
    });

    const result = scanRedundancy(ctx);
    for (const rec of result) {
      expect(() => recommendationSchema.parse(rec)).not.toThrow();
    }
  });
});
