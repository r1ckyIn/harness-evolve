// Unit tests for CLI scan-context subcommand

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from '@commander-js/extra-typings';

// Mock the context-builder module
vi.mock('../../../src/scan/context-builder.js', () => ({
  buildScanContext: vi.fn(),
}));

describe('CLI scan-context command', () => {
  let logs: string[];
  let errors: string[];
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    vi.resetAllMocks();
    logs = [];
    errors = [];
    originalLog = console.log;
    originalError = console.error;
    originalExitCode = process.exitCode;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    console.error = (...args: unknown[]) => errors.push(args.join(' '));
    process.exitCode = undefined;
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = originalExitCode;
  });

  it('registerScanContextCommand is exported as a function', async () => {
    const { registerScanContextCommand } = await import(
      '../../../src/cli/scan-context.js'
    );
    expect(typeof registerScanContextCommand).toBe('function');
  });

  it('scan-context command outputs valid ScanContext JSON to stdout', async () => {
    const { buildScanContext } = await import(
      '../../../src/scan/context-builder.js'
    );
    const mockedBuild = vi.mocked(buildScanContext);
    const fakeScanContext = {
      generated_at: '2026-04-07T00:00:00.000Z',
      project_root: '/test/project',
      claude_md_files: [],
      rules: [],
      settings: { user: null, project: null, local: null },
      commands: [],
      hooks_registered: [],
    };
    mockedBuild.mockResolvedValueOnce(fakeScanContext);

    const { registerScanContextCommand } = await import(
      '../../../src/cli/scan-context.js'
    );
    const program = new Command();
    program.exitOverride();
    registerScanContextCommand(program);

    await program.parseAsync(['scan-context'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.generated_at).toBe('2026-04-07T00:00:00.000Z');
    expect(output.project_root).toBe('/test/project');
    expect(output.claude_md_files).toEqual([]);
    expect(output.rules).toEqual([]);
    expect(output.settings).toEqual({
      user: null,
      project: null,
      local: null,
    });
    expect(output.commands).toEqual([]);
    expect(output.hooks_registered).toEqual([]);
  });

  it('scan-context does NOT print deprecation notice', async () => {
    const { buildScanContext } = await import(
      '../../../src/scan/context-builder.js'
    );
    const mockedBuild = vi.mocked(buildScanContext);
    mockedBuild.mockResolvedValueOnce({
      generated_at: '2026-04-07T00:00:00.000Z',
      project_root: '/test/project',
      claude_md_files: [],
      rules: [],
      settings: { user: null, project: null, local: null },
      commands: [],
      hooks_registered: [],
    });

    const { registerScanContextCommand } = await import(
      '../../../src/cli/scan-context.js'
    );
    const program = new Command();
    program.exitOverride();
    registerScanContextCommand(program);

    await program.parseAsync(['scan-context'], { from: 'user' });

    // No deprecation notice should appear in stderr
    const hasDeprecation = errors.some((e) =>
      e.includes('Code-based scanners'),
    );
    expect(hasDeprecation).toBe(false);
  });

  it('scan-context sends error to stderr with exitCode=1 on failure', async () => {
    const { buildScanContext } = await import(
      '../../../src/scan/context-builder.js'
    );
    const mockedBuild = vi.mocked(buildScanContext);
    mockedBuild.mockRejectedValueOnce(new Error('test error'));

    const { registerScanContextCommand } = await import(
      '../../../src/cli/scan-context.js'
    );
    const program = new Command();
    program.exitOverride();
    registerScanContextCommand(program);

    await program.parseAsync(['scan-context'], { from: 'user' });

    expect(errors).toContainEqual(
      expect.stringContaining('Error: test error'),
    );
    expect(process.exitCode).toBe(1);
    // No JSON output to stdout on error
    expect(logs.length).toBe(0);
  });
});
