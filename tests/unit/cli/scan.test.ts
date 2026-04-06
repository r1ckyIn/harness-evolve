// Unit tests for CLI scan subcommand (v4.0: model-driven, no code scanners)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from '@commander-js/extra-typings';

// Mock the context-builder module (scan CLI now uses buildScanContext directly)
vi.mock('../../../src/scan/context-builder.js', () => ({
  buildScanContext: vi.fn(),
}));

describe('CLI scan command', () => {
  let logs: string[];
  let errors: string[];
  let originalLog: typeof console.log;
  let originalError: typeof console.error;

  beforeEach(() => {
    vi.resetAllMocks();
    logs = [];
    errors = [];
    originalLog = console.log;
    originalError = console.error;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    console.error = (...args: unknown[]) => errors.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
  });

  it('registerScanCommand is exported as a function', async () => {
    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    expect(typeof registerScanCommand).toBe('function');
  });

  it('scan command outputs JSON with scan_context', async () => {
    const { buildScanContext } = await import('../../../src/scan/context-builder.js');
    const mockedBuild = vi.mocked(buildScanContext);
    mockedBuild.mockResolvedValueOnce({
      generated_at: '2026-04-04T00:00:00.000Z',
      project_root: '/fake/project',
      claude_md_files: [{ path: '/fake/CLAUDE.md', scope: 'project', content: '# Test', line_count: 1, headings: ['Test'], references: [] }],
      rules: [],
      settings: { user: null, project: null, local: null },
      commands: [],
      hooks_registered: [],
    } as any);

    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.generated_at).toBeDefined();
    expect(output.scan_context).toBeDefined();
    expect(output.scan_context.project_root).toBe('/fake/project');
    expect(output.scan_context.claude_md_files).toHaveLength(1);
  });

  it('scan command outputs deprecation notice to stderr', async () => {
    const { buildScanContext } = await import('../../../src/scan/context-builder.js');
    const mockedBuild = vi.mocked(buildScanContext);
    mockedBuild.mockResolvedValueOnce({
      generated_at: '2026-04-04T00:00:00.000Z',
      project_root: '/fake/project',
      claude_md_files: [],
      rules: [],
      settings: { user: null, project: null, local: null },
      commands: [],
      hooks_registered: [],
    } as any);

    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    expect(errors.some(e => e.includes('removed in v4.0'))).toBe(true);
    expect(errors.some(e => e.includes('/evolve:scan'))).toBe(true);
  });

  it('scan output does not include recommendations or scanner_meta', async () => {
    const { buildScanContext } = await import('../../../src/scan/context-builder.js');
    const mockedBuild = vi.mocked(buildScanContext);
    mockedBuild.mockResolvedValueOnce({
      generated_at: '2026-04-04T00:00:00.000Z',
      project_root: '/fake/project',
      claude_md_files: [],
      rules: [],
      settings: { user: null, project: null, local: null },
      commands: [],
      hooks_registered: [],
    } as any);

    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    const output = JSON.parse(logs.join(''));
    expect(output).not.toHaveProperty('recommendations');
    expect(output).not.toHaveProperty('scanner_meta');
    expect(output).not.toHaveProperty('scanner_summary');
  });

  it('scan command handles errors gracefully', async () => {
    const { buildScanContext } = await import('../../../src/scan/context-builder.js');
    const mockedBuild = vi.mocked(buildScanContext);
    mockedBuild.mockRejectedValueOnce(new Error('Scan failed: no access'));

    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.error).toBe('Scan failed: no access');
  });
});
