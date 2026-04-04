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
    // After sorting by confidence: rec-3 (HIGH) before rec-2 (MEDIUM)
    expect(output.pending.map((r: any) => r.id)).toEqual(['rec-3', 'rec-2']);
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

  it('sorts pending recommendations by confidence HIGH -> MEDIUM -> LOW', async () => {
    const { readFile } = await import('node:fs/promises');
    const { loadState } = await import('../../../src/delivery/state.js');
    const mockedReadFile = vi.mocked(readFile);
    const mockedLoadState = vi.mocked(loadState);

    // Recommendations in reverse confidence order: LOW, MEDIUM, HIGH
    const mixedRecs = [
      { ...sampleRecommendations[1], id: 'low-1', confidence: 'LOW' },
      { ...sampleRecommendations[1], id: 'med-1', confidence: 'MEDIUM' },
      { ...sampleRecommendations[0], id: 'high-1', confidence: 'HIGH' },
    ];

    mockedReadFile.mockResolvedValueOnce(JSON.stringify({
      generated_at: '2026-04-04T00:00:00.000Z',
      summary_period: { since: '2026-04-01', until: '2026-04-04', days: 3 },
      recommendations: mixedRecs,
      metadata: { classifier_count: 8, patterns_evaluated: 10, environment_ecosystems: [], claude_code_version: '1.0.0' },
    }));

    mockedLoadState.mockResolvedValueOnce({
      entries: [],
      last_updated: '2026-04-04T00:00:00.000Z',
    });

    const { registerPendingCommand } = await import('../../../src/cli/apply.js');
    const program = new Command();
    program.exitOverride();
    registerPendingCommand(program);

    await program.parseAsync(['pending'], { from: 'user' });

    const output = JSON.parse(logs.join(''));
    expect(output.pending.map((r: any) => r.confidence)).toEqual(['HIGH', 'MEDIUM', 'LOW']);
    expect(output.pending.map((r: any) => r.id)).toEqual(['high-1', 'med-1', 'low-1']);
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

const analysisResultJson = JSON.stringify({
  generated_at: '2026-04-04T00:00:00.000Z',
  summary_period: { since: '2026-04-01', until: '2026-04-04', days: 3 },
  recommendations: sampleRecommendations,
  metadata: { classifier_count: 8, patterns_evaluated: 10, environment_ecosystems: [], claude_code_version: '1.0.0' },
});

describe('CLI apply-one command', () => {
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

  it('registerApplyOneCommand is exported as a function', async () => {
    const { registerApplyOneCommand } = await import('../../../src/cli/apply.js');
    expect(typeof registerApplyOneCommand).toBe('function');
  });

  it('applies a recommendation and outputs JSON result', async () => {
    const { readFile } = await import('node:fs/promises');
    const { getApplier } = await import('../../../src/delivery/appliers/index.js');
    const { updateStatus } = await import('../../../src/delivery/state.js');
    const mockedReadFile = vi.mocked(readFile);
    const mockedGetApplier = vi.mocked(getApplier);
    const mockedUpdateStatus = vi.mocked(updateStatus);

    mockedReadFile.mockResolvedValueOnce(analysisResultJson);
    mockedGetApplier.mockReturnValueOnce({
      target: 'SETTINGS',
      canApply: () => true,
      apply: vi.fn().mockResolvedValue({
        recommendation_id: 'rec-3',
        success: true,
        details: 'Added Bash to allowedTools',
      }),
    });
    mockedUpdateStatus.mockResolvedValueOnce(undefined);

    const { registerApplyOneCommand } = await import('../../../src/cli/apply.js');
    const program = new Command();
    program.exitOverride();
    registerApplyOneCommand(program);

    await program.parseAsync(['apply-one', 'rec-3'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.success).toBe(true);
    expect(output.recommendation_id).toBe('rec-3');
    expect(mockedUpdateStatus).toHaveBeenCalledWith('rec-3', 'applied', expect.stringContaining('Applied via /evolve:apply'));
  });

  it('outputs error when recommendation not found', async () => {
    const { readFile } = await import('node:fs/promises');
    const mockedReadFile = vi.mocked(readFile);

    // Empty analysis result
    mockedReadFile.mockResolvedValueOnce(JSON.stringify({
      generated_at: '2026-04-04T00:00:00.000Z',
      summary_period: { since: '2026-04-01', until: '2026-04-04', days: 3 },
      recommendations: [],
      metadata: { classifier_count: 8, patterns_evaluated: 10, environment_ecosystems: [], claude_code_version: '1.0.0' },
    }));

    const { registerApplyOneCommand } = await import('../../../src/cli/apply.js');
    const program = new Command();
    program.exitOverride();
    registerApplyOneCommand(program);

    await program.parseAsync(['apply-one', 'nonexistent-id'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.success).toBe(false);
    expect(output.recommendation_id).toBe('nonexistent-id');
    expect(output.details).toContain('not found');
  });

  it('outputs error when no applier available', async () => {
    const { readFile } = await import('node:fs/promises');
    const { getApplier } = await import('../../../src/delivery/appliers/index.js');
    const mockedReadFile = vi.mocked(readFile);
    const mockedGetApplier = vi.mocked(getApplier);

    mockedReadFile.mockResolvedValueOnce(analysisResultJson);
    mockedGetApplier.mockReturnValueOnce(undefined);

    const { registerApplyOneCommand } = await import('../../../src/cli/apply.js');
    const program = new Command();
    program.exitOverride();
    registerApplyOneCommand(program);

    await program.parseAsync(['apply-one', 'rec-1'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.success).toBe(false);
    expect(output.details).toContain('No applicable applier');
  });

  it('updates status to applied on success', async () => {
    const { readFile } = await import('node:fs/promises');
    const { getApplier } = await import('../../../src/delivery/appliers/index.js');
    const { updateStatus } = await import('../../../src/delivery/state.js');
    const mockedReadFile = vi.mocked(readFile);
    const mockedGetApplier = vi.mocked(getApplier);
    const mockedUpdateStatus = vi.mocked(updateStatus);

    mockedReadFile.mockResolvedValueOnce(analysisResultJson);
    mockedGetApplier.mockReturnValueOnce({
      target: 'RULE',
      canApply: () => true,
      apply: vi.fn().mockResolvedValue({
        recommendation_id: 'rec-2',
        success: true,
        details: 'Rule created',
      }),
    });
    mockedUpdateStatus.mockResolvedValueOnce(undefined);

    const { registerApplyOneCommand } = await import('../../../src/cli/apply.js');
    const program = new Command();
    program.exitOverride();
    registerApplyOneCommand(program);

    await program.parseAsync(['apply-one', 'rec-2'], { from: 'user' });

    expect(mockedUpdateStatus).toHaveBeenCalledWith(
      'rec-2',
      'applied',
      expect.stringContaining('Applied via /evolve:apply'),
    );
  });
});

describe('CLI dismiss command', () => {
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

  it('registerDismissCommand is exported as a function', async () => {
    const { registerDismissCommand } = await import('../../../src/cli/apply.js');
    expect(typeof registerDismissCommand).toBe('function');
  });

  it('dismisses a recommendation and outputs confirmation', async () => {
    const { updateStatus } = await import('../../../src/delivery/state.js');
    const mockedUpdateStatus = vi.mocked(updateStatus);
    mockedUpdateStatus.mockResolvedValueOnce(undefined);

    const { registerDismissCommand } = await import('../../../src/cli/apply.js');
    const program = new Command();
    program.exitOverride();
    registerDismissCommand(program);

    await program.parseAsync(['dismiss', 'rec-1'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.id).toBe('rec-1');
    expect(output.status).toBe('dismissed');
    expect(mockedUpdateStatus).toHaveBeenCalledWith(
      'rec-1',
      'dismissed',
      'Dismissed by user via /evolve:apply',
    );
  });

  it('handles dismiss errors gracefully', async () => {
    const { updateStatus } = await import('../../../src/delivery/state.js');
    const mockedUpdateStatus = vi.mocked(updateStatus);
    mockedUpdateStatus.mockRejectedValueOnce(new Error('Write permission denied'));

    const { registerDismissCommand } = await import('../../../src/cli/apply.js');
    const program = new Command();
    program.exitOverride();
    registerDismissCommand(program);

    await program.parseAsync(['dismiss', 'rec-1'], { from: 'user' });

    expect(logs.length).toBeGreaterThan(0);
    const output = JSON.parse(logs.join(''));
    expect(output.id).toBe('rec-1');
    expect(output.error).toBe('Write permission denied');
  });
});
