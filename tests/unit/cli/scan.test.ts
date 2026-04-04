// Unit tests for CLI scan subcommand

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from '@commander-js/extra-typings';

// Mock the scan module
vi.mock('../../../src/scan/index.js', () => ({
  runDeepScan: vi.fn(),
}));

describe('CLI scan command', () => {
  let logs: string[];
  let originalLog: typeof console.log;

  beforeEach(() => {
    vi.resetAllMocks();
    logs = [];
    originalLog = console.log;
    console.log = (...args: unknown[]) => logs.push(args.join(' '));
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('registerScanCommand is exported as a function', async () => {
    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    expect(typeof registerScanCommand).toBe('function');
  });

  it('scan command outputs JSON with recommendations', async () => {
    const { runDeepScan } = await import('../../../src/scan/index.js');
    const mockedScan = vi.mocked(runDeepScan);
    mockedScan.mockResolvedValueOnce({
      generated_at: '2026-04-04T00:00:00.000Z',
      scan_context: {} as any,
      recommendations: [
        {
          id: 'rec-1',
          target: 'HOOK',
          confidence: 'HIGH',
          pattern_type: 'scan_missing_mechanization',
          title: 'Test Recommendation',
          description: 'A test recommendation',
          evidence: { count: 1, examples: ['example'] },
          suggested_action: 'Do something',
        },
      ],
    });

    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.generated_at).toBe('2026-04-04T00:00:00.000Z');
    expect(output.recommendations).toHaveLength(1);
    expect(output.recommendation_count).toBe(1);
    expect(output.recommendations[0].id).toBe('rec-1');
  });

  it('scan output recommendations are sorted by confidence', async () => {
    const { runDeepScan } = await import('../../../src/scan/index.js');
    const mockedScan = vi.mocked(runDeepScan);
    mockedScan.mockResolvedValueOnce({
      generated_at: '2026-04-04T00:00:00.000Z',
      scan_context: {} as any,
      recommendations: [
        {
          id: 'low-1',
          target: 'RULE',
          confidence: 'LOW',
          pattern_type: 'scan_redundancy',
          title: 'Low priority',
          description: 'Low',
          evidence: { count: 1, examples: ['x'] },
          suggested_action: 'Do low',
        },
        {
          id: 'high-1',
          target: 'HOOK',
          confidence: 'HIGH',
          pattern_type: 'scan_missing_mechanization',
          title: 'High priority',
          description: 'High',
          evidence: { count: 5, examples: ['y'] },
          suggested_action: 'Do high',
        },
        {
          id: 'med-1',
          target: 'CLAUDE_MD',
          confidence: 'MEDIUM',
          pattern_type: 'scan_stale_reference',
          title: 'Medium priority',
          description: 'Medium',
          evidence: { count: 2, examples: ['z'] },
          suggested_action: 'Do medium',
        },
      ],
    });

    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    const output = JSON.parse(logs.join(''));
    expect(output.recommendations.map((r: any) => r.confidence)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
    expect(output.recommendations.map((r: any) => r.id)).toEqual(['high-1', 'med-1', 'low-1']);
  });

  it('scan command handles errors gracefully', async () => {
    const { runDeepScan } = await import('../../../src/scan/index.js');
    const mockedScan = vi.mocked(runDeepScan);
    mockedScan.mockRejectedValueOnce(new Error('Scan failed: no access'));

    const { registerScanCommand } = await import('../../../src/cli/scan.js');
    const program = new Command();
    program.exitOverride();
    registerScanCommand(program);

    await program.parseAsync(['scan'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.error).toBe('Scan failed: no access');
    expect(output.recommendations).toEqual([]);
  });
});
