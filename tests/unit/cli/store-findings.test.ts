// Unit tests for CLI store-findings subcommand.
// Tests stdin reading, Zod validation, atomic file write, TTY guard, and auto-init.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from '@commander-js/extra-typings';
import { Readable } from 'node:stream';

// Mock the storage dirs module
vi.mock('../../../src/storage/dirs.js', () => ({
  ensureInit: vi.fn().mockResolvedValue(undefined),
  paths: {
    analysisResult: '/tmp/test-harness-evolve/analysis-result.json',
  },
}));

// Mock write-file-atomic to capture writes
vi.mock('write-file-atomic', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const validFinding = {
  id: 'test-001',
  target: 'HOOK',
  confidence: 'HIGH',
  pattern_type: 'scan_redundancy',
  title: 'Test finding',
  description: 'A test finding for validation',
  evidence: { count: 5, examples: ['example 1'] },
  suggested_action: 'Do something about it',
  severity: 'problem',
};

const invalidFinding = {
  id: 'bad-001',
  title: 'Missing target field',
};

/**
 * Helper to simulate stdin with given data.
 * Replaces process.stdin with a Readable stream that emits the provided string.
 */
function mockStdin(data: string): void {
  const readable = new Readable({
    read() {
      this.push(Buffer.from(data));
      this.push(null);
    },
  });
  // Override isTTY to simulate piped input
  (readable as any).isTTY = false;
  Object.defineProperty(process, 'stdin', {
    value: readable,
    writable: true,
    configurable: true,
  });
}

/**
 * Helper to simulate TTY stdin (no piped input).
 */
function mockTTYStdin(): void {
  const readable = new Readable({ read() {} });
  (readable as any).isTTY = true;
  Object.defineProperty(process, 'stdin', {
    value: readable,
    writable: true,
    configurable: true,
  });
}

describe('CLI store-findings command', () => {
  let logs: string[];
  let errors: string[];
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalExitCode: number | undefined;
  let originalStdin: typeof process.stdin;

  beforeEach(() => {
    vi.resetAllMocks();
    logs = [];
    errors = [];
    originalLog = console.log;
    originalError = console.error;
    originalExitCode = process.exitCode;
    originalStdin = process.stdin;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
    console.error = (...args: unknown[]) => errors.push(args.join(' '));
    process.exitCode = undefined;
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    process.exitCode = originalExitCode;
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      writable: true,
      configurable: true,
    });
  });

  it('registerStoreFindingsCommand is exported as a function', async () => {
    const { registerStoreFindingsCommand } = await import('../../../src/cli/store-findings.js');
    expect(typeof registerStoreFindingsCommand).toBe('function');
  });

  it('valid JSON array of recommendations is parsed, validated, and written', async () => {
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedWrite = vi.mocked(writeFileAtomic);

    mockStdin(JSON.stringify([validFinding]));

    const { registerStoreFindingsCommand } = await import('../../../src/cli/store-findings.js');
    const program = new Command();
    program.exitOverride();
    registerStoreFindingsCommand(program);

    await program.parseAsync(['store-findings'], { from: 'user' });

    // Should have called writeFileAtomic
    expect(mockedWrite).toHaveBeenCalledTimes(1);

    // Output should show stored: 1, skipped: 0
    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.stored).toBe(1);
    expect(output.skipped).toBe(0);
    expect(output.errors).toEqual([]);
  });

  it('invalid finding (missing required field) is skipped with error message', async () => {
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedWrite = vi.mocked(writeFileAtomic);

    mockStdin(JSON.stringify([invalidFinding]));

    const { registerStoreFindingsCommand } = await import('../../../src/cli/store-findings.js');
    const program = new Command();
    program.exitOverride();
    registerStoreFindingsCommand(program);

    await program.parseAsync(['store-findings'], { from: 'user' });

    // Should NOT have called writeFileAtomic (no valid findings)
    expect(mockedWrite).not.toHaveBeenCalled();

    // Output should show stored: 0, skipped: 1
    const output = JSON.parse(logs.join(''));
    expect(output.stored).toBe(0);
    expect(output.skipped).toBe(1);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain('Finding 0');
  });

  it('mixed valid and invalid findings: valid stored, invalid skipped', async () => {
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedWrite = vi.mocked(writeFileAtomic);

    mockStdin(JSON.stringify([validFinding, invalidFinding, { ...validFinding, id: 'test-002' }]));

    const { registerStoreFindingsCommand } = await import('../../../src/cli/store-findings.js');
    const program = new Command();
    program.exitOverride();
    registerStoreFindingsCommand(program);

    await program.parseAsync(['store-findings'], { from: 'user' });

    // Should write only 2 valid findings
    expect(mockedWrite).toHaveBeenCalledTimes(1);

    const output = JSON.parse(logs.join(''));
    expect(output.stored).toBe(2);
    expect(output.skipped).toBe(1);
    expect(output.errors).toHaveLength(1);
    expect(output.errors[0]).toContain('Finding 1');
  });

  it('TTY stdin prints usage to stderr and sets exitCode=1', async () => {
    mockTTYStdin();

    const { registerStoreFindingsCommand } = await import('../../../src/cli/store-findings.js');
    const program = new Command();
    program.exitOverride();
    registerStoreFindingsCommand(program);

    await program.parseAsync(['store-findings'], { from: 'user' });

    expect(errors.some(e => e.includes('Pipe JSON findings'))).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('invalid JSON input (not an array) prints error to stderr and sets exitCode=1', async () => {
    mockStdin('{"not": "an array"}');

    const { registerStoreFindingsCommand } = await import('../../../src/cli/store-findings.js');
    const program = new Command();
    program.exitOverride();
    registerStoreFindingsCommand(program);

    await program.parseAsync(['store-findings'], { from: 'user' });

    expect(errors.some(e => e.includes('JSON array'))).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('malformed JSON input prints error to stderr and sets exitCode=1', async () => {
    mockStdin('{invalid json!!!');

    const { registerStoreFindingsCommand } = await import('../../../src/cli/store-findings.js');
    const program = new Command();
    program.exitOverride();
    registerStoreFindingsCommand(program);

    await program.parseAsync(['store-findings'], { from: 'user' });

    expect(errors.some(e => e.includes('Invalid JSON'))).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it('ensureInit is called before writing (INFRA-04)', async () => {
    const { ensureInit } = await import('../../../src/storage/dirs.js');
    const mockedInit = vi.mocked(ensureInit);

    mockStdin(JSON.stringify([validFinding]));

    const { registerStoreFindingsCommand } = await import('../../../src/cli/store-findings.js');
    const program = new Command();
    program.exitOverride();
    registerStoreFindingsCommand(program);

    await program.parseAsync(['store-findings'], { from: 'user' });

    expect(mockedInit).toHaveBeenCalledTimes(1);
  });

  it('written file is parseable by analysisResultSchema', async () => {
    const writeFileAtomic = (await import('write-file-atomic')).default;
    const mockedWrite = vi.mocked(writeFileAtomic);
    const { analysisResultSchema } = await import('../../../src/schemas/recommendation.js');

    mockStdin(JSON.stringify([validFinding]));

    const { registerStoreFindingsCommand } = await import('../../../src/cli/store-findings.js');
    const program = new Command();
    program.exitOverride();
    registerStoreFindingsCommand(program);

    await program.parseAsync(['store-findings'], { from: 'user' });

    // Capture the data passed to writeFileAtomic
    expect(mockedWrite).toHaveBeenCalledTimes(1);
    const writtenData = mockedWrite.mock.calls[0][1] as string;

    // Parse with analysisResultSchema -- should not throw
    const parsed = analysisResultSchema.parse(JSON.parse(writtenData));
    expect(parsed.recommendations).toHaveLength(1);
    expect(parsed.recommendations[0].id).toBe('test-001');
    expect(parsed.generated_at).toBeDefined();
    expect(parsed.metadata.claude_code_version).toBe('model-driven');
  });
});
