// Unit tests for CLI scan subcommand -- removed in v5.0, now a hard error

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from '@commander-js/extra-typings';

describe('CLI scan command (removed in v5.0)', () => {
  let stderrLogs: string[];
  let stdoutLogs: string[];
  let originalError: typeof console.error;
  let originalLog: typeof console.log;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    vi.resetAllMocks();
    stderrLogs = [];
    stdoutLogs = [];
    originalError = console.error;
    originalLog = console.log;
    originalExitCode = process.exitCode;
    console.error = (...args: unknown[]) => stderrLogs.push(args.join(' '));
    console.log = (...args: unknown[]) => stdoutLogs.push(args.join(' '));
    process.exitCode = undefined;
  });

  afterEach(() => {
    console.error = originalError;
    console.log = originalLog;
    process.exitCode = originalExitCode;
  });

  it('registerScanCommand is exported as a function', async () => {
    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    expect(typeof registerScanCommand).toBe('function');
  });

  it('registers a scan command on the program', async () => {
    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);
    const scanCmd = program.commands.find(c => c.name() === 'scan');
    expect(scanCmd).toBeDefined();
  });

  it('running scan outputs error to stderr containing "removed in v5.0"', async () => {
    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    const stderrOutput = stderrLogs.join('\n');
    expect(stderrOutput).toContain('removed in v5.0');
  });

  it('running scan outputs error to stderr containing "/evolve:scan"', async () => {
    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    const stderrOutput = stderrLogs.join('\n');
    expect(stderrOutput).toContain('/evolve:scan');
  });

  it('running scan outputs error to stderr containing "scan-context"', async () => {
    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    const stderrOutput = stderrLogs.join('\n');
    expect(stderrOutput).toContain('scan-context');
  });

  it('running scan sets process.exitCode = 1', async () => {
    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    expect(process.exitCode).toBe(1);
  });

  it('running scan does NOT output any JSON to stdout', async () => {
    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    expect(stdoutLogs).toHaveLength(0);
  });

  it('running scan does NOT call buildScanContext', async () => {
    // Verify that the scan module does not import buildScanContext
    const scanModule = await import('../../../src/cli/scan.js');
    const moduleSource = scanModule.registerScanCommand.toString();
    expect(moduleSource).not.toContain('buildScanContext');
  });
});
