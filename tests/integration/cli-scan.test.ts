// Integration test: scan context end-to-end pipeline (v4.0+).
// Uses temporary directories with real file I/O -- no mocks.
// Verifies that buildScanResult reads real config files and returns
// valid scan context with scope labeling.

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

describe('deep scan integration', () => {
  it('reads real config files and produces scan context', async () => {
    await writeFile(
      join(tempDir, 'CLAUDE.md'),
      '# Project Config\n\nSome instructions.\n',
    );
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'rules', 'git-rules.md'),
      '## Git Rules\n\nDetailed git rules.\n',
    );

    const result = await buildScanResult(tempDir, fakeHome);

    expect(result.scan_context.claude_md_files.length).toBeGreaterThanOrEqual(1);
    expect(result.scan_context.rules.length).toBeGreaterThanOrEqual(1);
    expect(result.scan_context.rules[0].scope).toBe('project');
  });

  it('returns valid ScanResult with scan_context and generated_at', async () => {
    await writeFile(join(tempDir, 'CLAUDE.md'), '# Minimal Config\n');

    const result = await buildScanResult(tempDir, fakeHome);

    expect(result.generated_at).toBeDefined();
    expect(typeof result.generated_at).toBe('string');
    expect(result.scan_context).toBeDefined();
    expect(result.scan_context.project_root).toBe(tempDir);
    expect(result.scan_context.scope_summary).toBeDefined();
    expect(result.scan_context.scope_summary.has_project_config).toBe(true);
    expect(result.scan_context.scope_summary.project_sources).toBeGreaterThan(0);
  });

  it('returns empty collections when no config files exist', async () => {
    const result = await buildScanResult(tempDir, fakeHome);

    expect(result.scan_context.claude_md_files).toEqual([]);
    expect(result.scan_context.rules).toEqual([]);
  });

  it('commands have scope field and scope_summary reflects counts', async () => {
    // Create project command
    const cmdDir = join(tempDir, '.claude', 'commands');
    await mkdir(cmdDir, { recursive: true });
    await writeFile(join(cmdDir, 'deploy.md'), 'Deploy project.');

    // Create user command
    const userCmdDir = join(fakeHome, '.claude', 'commands');
    await mkdir(userCmdDir, { recursive: true });
    await writeFile(join(userCmdDir, 'global.md'), 'Global cmd.');

    const result = await buildScanResult(tempDir, fakeHome);

    const projCmd = result.scan_context.commands.find((c: any) => c.scope === 'project');
    const userCmd = result.scan_context.commands.find((c: any) => c.scope === 'user');
    expect(projCmd).toBeDefined();
    expect(userCmd).toBeDefined();
    expect(projCmd!.name).toBe('deploy');
    expect(userCmd!.name).toBe('global');

    expect(result.scan_context.scope_summary.user_sources).toBeGreaterThanOrEqual(1);
    expect(result.scan_context.scope_summary.has_user_config).toBe(true);
  });
});
