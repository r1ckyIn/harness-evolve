// Integration test: deep scan end-to-end pipeline.
// Uses temporary directories with real file I/O -- no mocks.
// Verifies that runDeepScan reads real config files, runs all scanners,
// and returns valid recommendations.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runDeepScan } from '../../src/scan/index.js';
import { recommendationSchema } from '../../src/schemas/recommendation.js';

let tempDir: string;
let fakeHome: string;

beforeEach(async () => {
  const base = await mkdtemp(join(tmpdir(), 'cli-scan-integration-'));
  tempDir = join(base, 'project');
  fakeHome = join(base, 'home');
  await mkdir(tempDir, { recursive: true });
  await mkdir(join(fakeHome, '.claude'), { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  await rm(fakeHome, { recursive: true, force: true }).catch(() => {});
});

describe('deep scan integration', () => {
  it('detects redundancy and stale references from real config files', async () => {
    // Create a CLAUDE.md with a heading that duplicates a rule and a broken @reference
    await writeFile(
      join(tempDir, 'CLAUDE.md'),
      [
        '# Project Config',
        '',
        '## Git Rules',
        '',
        'Some instructions about git.',
        '',
        'See @docs/missing.md for details.',
        '',
      ].join('\n'),
    );

    // Create a rule file with the same "Git Rules" heading (triggers redundancy)
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'rules', 'git-rules.md'),
      ['## Git Rules', '', 'Detailed git rules here.', ''].join('\n'),
    );

    // Run scan on temp directory with fake home (no user-level CLAUDE.md)
    const result = await runDeepScan(tempDir, fakeHome);

    // Should have at least 2 recommendations (redundancy + stale reference)
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2);

    // Check for redundancy detection
    const redundancyRecs = result.recommendations.filter(
      (r) => r.pattern_type === 'scan_redundancy',
    );
    expect(redundancyRecs.length).toBeGreaterThanOrEqual(1);
    expect(
      redundancyRecs.some(
        (r) =>
          r.title.toLowerCase().includes('git rules') ||
          r.description.toLowerCase().includes('git rules'),
      ),
    ).toBe(true);

    // Check for stale reference detection
    const staleRecs = result.recommendations.filter(
      (r) => r.pattern_type === 'scan_stale_reference',
    );
    expect(staleRecs.length).toBeGreaterThanOrEqual(1);
    expect(
      staleRecs.some(
        (r) =>
          r.title.includes('missing.md') ||
          r.description.includes('missing.md'),
      ),
    ).toBe(true);

    // All recommendations must pass schema validation
    for (const rec of result.recommendations) {
      expect(() => recommendationSchema.parse(rec)).not.toThrow();
    }
  });

  it('returns valid ScanResult with scan_context and generated_at', async () => {
    // Minimal setup -- just an empty CLAUDE.md
    await writeFile(join(tempDir, 'CLAUDE.md'), '# Minimal Config\n');

    const result = await runDeepScan(tempDir, fakeHome);

    expect(result.generated_at).toBeDefined();
    expect(typeof result.generated_at).toBe('string');
    expect(result.scan_context).toBeDefined();
    expect(result.scan_context.project_root).toBe(tempDir);
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('returns empty recommendations when no issues found', async () => {
    // No config files at all -- nothing to flag
    const result = await runDeepScan(tempDir, fakeHome);

    expect(result.recommendations).toEqual([]);
    expect(result.scan_context.claude_md_files).toEqual([]);
    expect(result.scan_context.rules).toEqual([]);
  });
});
