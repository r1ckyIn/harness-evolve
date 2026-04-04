// Unit tests for the mechanization scanner.
// Verifies detection of hookable operations described in rules/CLAUDE.md text,
// and that already-covered hooks are excluded.

import { describe, it, expect } from 'vitest';
import { scanMechanization } from '../../../../src/scan/scanners/mechanization.js';
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

describe('scanMechanization', () => {
  it('returns empty array when no mechanizable patterns found', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: '# Overview\nThis project uses TypeScript.',
          line_count: 2,
          headings: ['Overview'],
          references: [],
        },
      ],
    });

    const result = scanMechanization(ctx);
    expect(result).toEqual([]);
  });

  it('detects "always run X" pattern in CLAUDE.md content', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: 'You must always run `eslint` before committing code.',
          line_count: 1,
          headings: [],
          references: [],
        },
      ],
    });

    const result = scanMechanization(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const rec = result.find(r => r.title.toLowerCase().includes('always run'));
    expect(rec).toBeDefined();
    expect(rec!.target).toBe('HOOK');
  });

  it('detects "before committing, run X" pattern in rule content', () => {
    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/workflow.md',
          filename: 'workflow.md',
          content: 'Before committing, run `npm test` to verify all tests pass.',
          headings: ['Workflow'],
        },
      ],
    });

    const result = scanMechanization(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const rec = result.find(r =>
      r.title.toLowerCase().includes('before commit') || r.title.toLowerCase().includes('pre-commit'),
    );
    expect(rec).toBeDefined();
  });

  it('detects "never allow X" / "forbidden" patterns', () => {
    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/safety.md',
          filename: 'safety.md',
          content: 'Never allow rm -rf on the project root. Forbidden: drop table operations and truncate commands.',
          headings: ['Safety'],
        },
      ],
    });

    const result = scanMechanization(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Should detect the "never allow" and/or "forbidden" patterns
    const hasNeverAllow = result.some(r => r.title.toLowerCase().includes('never allow'));
    const hasForbidden = result.some(r => r.title.toLowerCase().includes('forbidden'));
    expect(hasNeverAllow || hasForbidden).toBe(true);
  });

  it('does NOT flag a pattern if a hook for that event is already registered', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: 'You must always run eslint before saving.',
          line_count: 1,
          headings: [],
          references: [],
        },
      ],
      hooks_registered: [
        {
          event: 'PreToolUse',
          scope: 'project',
          type: 'command',
          command: 'eslint .',
        },
      ],
    });

    const result = scanMechanization(ctx);
    // The "always run" pattern maps to PreToolUse, which is already registered
    expect(result).toEqual([]);
  });

  it('produces recommendation with correct pattern_type, target, and confidence', () => {
    const ctx = makeScanContext({
      rules: [
        {
          path: '/tmp/.claude/rules/check.md',
          filename: 'check.md',
          content: 'You must always check `tsc --noEmit` passes before merging.',
          headings: ['Check'],
        },
      ],
    });

    const result = scanMechanization(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].pattern_type).toBe('scan_missing_mechanization');
    expect(result[0].target).toBe('HOOK');
    expect(result[0].confidence).toBe('MEDIUM');
  });

  it('produces recommendations that pass schema validation', () => {
    const ctx = makeScanContext({
      claude_md_files: [
        {
          path: '/tmp/CLAUDE.md',
          scope: 'project',
          content: 'Always run `prettier --check .` after every edit.',
          line_count: 1,
          headings: [],
          references: [],
        },
      ],
      rules: [
        {
          path: '/tmp/.claude/rules/no-dangerous.md',
          filename: 'no-dangerous.md',
          content: 'Never allow force-push to main branch.',
          headings: ['Safety'],
        },
      ],
    });

    const result = scanMechanization(ctx);
    for (const rec of result) {
      expect(() => recommendationSchema.parse(rec)).not.toThrow();
    }
  });
});
