// Unit tests for CLI apply subcommands (pending, apply-one, dismiss)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from '@commander-js/extra-typings';

// Mock dependencies
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/storage/dirs.js', () => ({
  paths: {
    analysisResult: '/tmp/test/.harness-evolve/analysis/analysis-result.json',
    autoApplyLog: '/tmp/test/.harness-evolve/analysis/auto-apply-log.jsonl',
  },
}));

vi.mock('../../../src/delivery/state.js', () => ({
  loadState: vi.fn(),
  updateStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/delivery/auto-apply.js', () => ({}));

vi.mock('../../../src/delivery/appliers/index.js', () => ({
  getApplier: vi.fn(),
  hasApplier: vi.fn(),
}));

const sampleRecommendations = [
  {
    id: 'rec-1',
    target: 'HOOK',
    confidence: 'HIGH',
    pattern_type: 'scan_missing_mechanization',
    title: 'Create hook for npm test',
    description: 'Mechanize npm test command',
    evidence: { count: 5, examples: ['npm test'] },
    suggested_action: 'Create hook script',
  },
  {
    id: 'rec-2',
    target: 'RULE',
    confidence: 'MEDIUM',
    pattern_type: 'scan_redundancy',
    title: 'Remove redundant rule',
    description: 'Redundant rule found',
    evidence: { count: 1, examples: ['rule.md'] },
    suggested_action: 'Delete the rule file',
  },
  {
    id: 'rec-3',
    target: 'SETTINGS',
    confidence: 'HIGH',
    pattern_type: 'permission-always-approved',
    title: 'Allow Bash tool',
    description: 'Always approved',
    evidence: { count: 10, examples: ['Bash(npm test)'] },
    suggested_action: 'Add to allowedTools',
  },
];

describe('CLI pending command', () => {
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

  it('registerPendingCommand is exported as a function', async () => {
    const { registerPendingCommand } = await import('../../../src/cli/apply.js');
    expect(typeof registerPendingCommand).toBe('function');
  });

  it('lists pending recommendations', async () => {
    const { readFile } = await import('node:fs/promises');
    const { loadState } = await import('../../../src/delivery/state.js');
    const mockedReadFile = vi.mocked(readFile);
    const mockedLoadState = vi.mocked(loadState);

    // Mock analysis result with 3 recommendations
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({
      generated_at: '2026-04-04T00:00:00.000Z',
      summary_period: { since: '2026-04-01', until: '2026-04-04', days: 3 },
      recommendations: sampleRecommendations,
      metadata: { classifier_count: 8, patterns_evaluated: 10, environment_ecosystems: [], claude_code_version: '1.0.0' },
    }));

    // Mock state: rec-1 is applied, others not tracked
    mockedLoadState.mockResolvedValueOnce({
      entries: [{ id: 'rec-1', status: 'applied', updated_at: '2026-04-04T00:00:00.000Z' }],
      last_updated: '2026-04-04T00:00:00.000Z',
    });

    const { registerPendingCommand } = await import('../../../src/cli/apply.js');
    const program = new Command();
    program.exitOverride();
    registerPendingCommand(program);

    await program.parseAsync(['pending'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.pending).toHaveLength(2);
    expect(output.count).toBe(2);
    expect(output.pending.map((r: any) => r.id)).toEqual(['rec-2', 'rec-3']);
  });

  it('returns empty array when no analysis result exists', async () => {
    const { readFile } = await import('node:fs/promises');
    const { loadState } = await import('../../../src/delivery/state.js');
    const mockedReadFile = vi.mocked(readFile);
    const mockedLoadState = vi.mocked(loadState);

    // Mock file not found
    const err = new Error('ENOENT') as NodeJS.ErrnoException;
    err.code = 'ENOENT';
    mockedReadFile.mockRejectedValueOnce(err);

    mockedLoadState.mockResolvedValueOnce({
      entries: [],
      last_updated: '2026-04-04T00:00:00.000Z',
    });

    const { registerPendingCommand } = await import('../../../src/cli/apply.js');
    const program = new Command();
    program.exitOverride();
    registerPendingCommand(program);

    await program.parseAsync(['pending'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.pending).toEqual([]);
    expect(output.count).toBe(0);
  });

  it('treats missing state entries as pending', async () => {
    const { readFile } = await import('node:fs/promises');
    const { loadState } = await import('../../../src/delivery/state.js');
    const mockedReadFile = vi.mocked(readFile);
    const mockedLoadState = vi.mocked(loadState);

    // All 3 recommendations in analysis result
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({
      generated_at: '2026-04-04T00:00:00.000Z',
      summary_period: { since: '2026-04-01', until: '2026-04-04', days: 3 },
      recommendations: sampleRecommendations,
      metadata: { classifier_count: 8, patterns_evaluated: 10, environment_ecosystems: [], claude_code_version: '1.0.0' },
    }));

    // Empty state -- all should be treated as pending
    mockedLoadState.mockResolvedValueOnce({
      entries: [],
      last_updated: '2026-04-04T00:00:00.000Z',
    });

    const { registerPendingCommand } = await import('../../../src/cli/apply.js');
    const program = new Command();
    program.exitOverride();
    registerPendingCommand(program);

    await program.parseAsync(['pending'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.pending).toHaveLength(3);
    expect(output.count).toBe(3);
  });
});
