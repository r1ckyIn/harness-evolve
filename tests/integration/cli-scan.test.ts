// Integration test: scan module context-building end-to-end pipeline.
// Uses temporary directories with real file I/O -- no mocks.
// Verifies that buildScanResult reads real config files and returns
// valid context for model-driven analysis.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildScanResult } from '../../src/scan/index.js';

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

describe('scan module integration', () => {
  it('returns ScanResult with scan_context from real config files', async () => {
    await writeFile(
      join(tempDir, 'CLAUDE.md'),
      '# Project Config\n\nSome content here.\n',
    );

    const result = await buildScanResult(tempDir, fakeHome);

    expect(result.generated_at).toBeDefined();
    expect(typeof result.generated_at).toBe('string');
    expect(result.scan_context).toBeDefined();
    expect(result.scan_context.project_root).toBe(tempDir);
    expect(result.scan_context.claude_md_files.length).toBeGreaterThanOrEqual(1);
  });

  it('scan_context includes rules and settings from filesystem', async () => {
    await writeFile(join(tempDir, 'CLAUDE.md'), '# Config\n');
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'rules', 'test-rule.md'),
      '# Test Rule\n\nSome rule content.\n',
    );
    await writeFile(
      join(tempDir, '.claude', 'settings.json'),
      JSON.stringify({ hooks: {} }),
    );

    const result = await buildScanResult(tempDir, fakeHome);

    expect(result.scan_context.rules.length).toBeGreaterThanOrEqual(1);
    expect(result.scan_context.settings.project).toEqual({ hooks: {} });
  });

  it('returns empty arrays when no config files exist', async () => {
    const result = await buildScanResult(tempDir, fakeHome);

    expect(result.scan_context.claude_md_files).toEqual([]);
    expect(result.scan_context.rules).toEqual([]);
    expect(result.scan_context.commands).toEqual([]);
  });

  it('does not include recommendations or scanner_meta fields', async () => {
    const result = await buildScanResult(tempDir, fakeHome) as Record<string, unknown>;

    expect(result).not.toHaveProperty('recommendations');
    expect(result).not.toHaveProperty('scanner_meta');
  });
});
