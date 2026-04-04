// Unit tests for the staleness scanner and scanner registry.
// Verifies detection of broken @references and stale hook script paths,
// and that all scanners are registered.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanStaleness } from '../../../../src/scan/scanners/staleness.js';
import { scanners, type Scanner } from '../../../../src/scan/scanners/index.js';
import { recommendationSchema } from '../../../../src/schemas/recommendation.js';
import type { ScanContext } from '../../../../src/scan/schemas.js';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

describe('scanStaleness', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'staleness-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns empty array when no stale references exist', async () => {
    // Create a file that will be referenced
    const refFile = join(tempDir, 'existing-rule.md');
    await writeFile(refFile, '# Rule content');

    const ctx = makeScanContext({
      project_root: tempDir,
      claude_md_files: [
        {
          path: join(tempDir, 'CLAUDE.md'),
          scope: 'project',
          content: '# Overview\nSee @existing-rule.md',
          line_count: 2,
          headings: ['Overview'],
          references: ['existing-rule.md'],
        },
      ],
      rules: [
        {
          path: refFile,
          filename: 'existing-rule.md',
          content: '# Rule content',
          headings: ['Rule content'],
        },
      ],
    });

    const result = await scanStaleness(ctx);
    expect(result).toEqual([]);
  });

  it('detects @reference in CLAUDE.md pointing to non-existent file', async () => {
    const ctx = makeScanContext({
      project_root: tempDir,
      claude_md_files: [
        {
          path: join(tempDir, 'CLAUDE.md'),
          scope: 'project',
          content: '# Overview\nSee @docs/missing-guide.md for details',
          line_count: 2,
          headings: ['Overview'],
          references: ['docs/missing-guide.md'],
        },
      ],
    });

    const result = await scanStaleness(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].pattern_type).toBe('scan_stale_reference');
    expect(result[0].target).toBe('CLAUDE_MD');
    expect(result[0].confidence).toBe('HIGH');
  });

  it('does NOT flag @reference that points to an existing rule file path', async () => {
    const ruleDir = join(tempDir, '.claude', 'rules');
    await mkdir(ruleDir, { recursive: true });
    const rulePath = join(ruleDir, 'workflow.md');
    await writeFile(rulePath, '# Workflow rules');

    const ctx = makeScanContext({
      project_root: tempDir,
      claude_md_files: [
        {
          path: join(tempDir, 'CLAUDE.md'),
          scope: 'project',
          content: 'See @.claude/rules/workflow.md',
          line_count: 1,
          headings: [],
          references: ['.claude/rules/workflow.md'],
        },
      ],
      rules: [
        {
          path: rulePath,
          filename: 'workflow.md',
          content: '# Workflow rules',
          headings: ['Workflow rules'],
        },
      ],
    });

    const result = await scanStaleness(ctx);
    expect(result).toEqual([]);
  });

  it('detects hook command referencing non-existent script file path', async () => {
    const ctx = makeScanContext({
      project_root: tempDir,
      hooks_registered: [
        {
          event: 'PreToolUse',
          scope: 'project',
          type: 'command',
          command: `node "${join(tempDir, 'scripts', 'non-existent-hook.js')}"`,
        },
      ],
    });

    const result = await scanStaleness(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].target).toBe('SETTINGS');
    expect(result[0].confidence).toBe('HIGH');
    expect(result[0].pattern_type).toBe('scan_stale_reference');
  });

  it('does NOT flag hook command when script file exists', async () => {
    const scriptDir = join(tempDir, 'scripts');
    await mkdir(scriptDir, { recursive: true });
    const scriptPath = join(scriptDir, 'hook.js');
    await writeFile(scriptPath, 'console.log("hook")');

    const ctx = makeScanContext({
      project_root: tempDir,
      hooks_registered: [
        {
          event: 'PreToolUse',
          scope: 'project',
          type: 'command',
          command: `node "${scriptPath}"`,
        },
      ],
    });

    const result = await scanStaleness(ctx);
    expect(result).toEqual([]);
  });

  it('has correct pattern_type and target for stale @reference', async () => {
    const ctx = makeScanContext({
      project_root: tempDir,
      claude_md_files: [
        {
          path: join(tempDir, 'CLAUDE.md'),
          scope: 'project',
          content: 'See @nonexistent.md',
          line_count: 1,
          headings: [],
          references: ['nonexistent.md'],
        },
      ],
    });

    const result = await scanStaleness(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].pattern_type).toBe('scan_stale_reference');
    expect(result[0].target).toBe('CLAUDE_MD');
    expect(result[0].confidence).toBe('HIGH');
  });

  it('includes the broken reference string in evidence examples', async () => {
    const ctx = makeScanContext({
      project_root: tempDir,
      claude_md_files: [
        {
          path: join(tempDir, 'CLAUDE.md'),
          scope: 'project',
          content: 'See @docs/vanished.md',
          line_count: 1,
          headings: [],
          references: ['docs/vanished.md'],
        },
      ],
    });

    const result = await scanStaleness(ctx);
    expect(result).toHaveLength(1);
    expect(result[0].evidence.examples[0]).toContain('docs/vanished.md');
  });

  it('produces recommendations that pass schema validation', async () => {
    const ctx = makeScanContext({
      project_root: tempDir,
      claude_md_files: [
        {
          path: join(tempDir, 'CLAUDE.md'),
          scope: 'project',
          content: 'See @missing.md',
          line_count: 1,
          headings: [],
          references: ['missing.md'],
        },
      ],
      hooks_registered: [
        {
          event: 'PostToolUse',
          scope: 'project',
          type: 'command',
          command: `node "${join(tempDir, 'gone.js')}"`,
        },
      ],
    });

    const result = await scanStaleness(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const rec of result) {
      expect(() => recommendationSchema.parse(rec)).not.toThrow();
    }
  });
});

describe('scanner registry', () => {
  it('scanners array contains exactly 3 entries', () => {
    expect(scanners).toHaveLength(3);
  });

  it('each scanner in array is a function', () => {
    for (const scanner of scanners) {
      expect(typeof scanner).toBe('function');
    }
  });
});
