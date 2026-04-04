// Unit tests for CLI status command

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock storage/counter before imports
vi.mock('../../../src/storage/counter.js', () => ({
  readCounter: vi.fn(),
}));

// Mock delivery/state before imports
vi.mock('../../../src/delivery/state.js', () => ({
  loadState: vi.fn(),
}));

// Mock cli/utils (readSettings, HARNESS_EVOLVE_MARKER, SETTINGS_PATH)
vi.mock('../../../src/cli/utils.js', () => ({
  readSettings: vi.fn(),
  HARNESS_EVOLVE_MARKER: 'harness-evolve',
  SETTINGS_PATH: '/mock/.claude/settings.json',
}));

describe('CLI status command', () => {
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
    vi.restoreAllMocks();
  });

  it('displays interaction count from readCounter().total', async () => {
    const { readCounter } = await import('../../../src/storage/counter.js');
    const { loadState } = await import('../../../src/delivery/state.js');
    const { readSettings } = await import('../../../src/cli/utils.js');

    vi.mocked(readCounter).mockResolvedValueOnce({
      total: 42,
      session: {},
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(loadState).mockResolvedValueOnce({
      entries: [],
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(readSettings).mockResolvedValueOnce({});

    const { runStatus } = await import('../../../src/cli/status.js');
    await runStatus({});

    const output = logs.join('\n');
    expect(output).toContain('Interactions:');
    expect(output).toContain('42');
  });

  it('displays "never" when last_analysis is undefined', async () => {
    const { readCounter } = await import('../../../src/storage/counter.js');
    const { loadState } = await import('../../../src/delivery/state.js');
    const { readSettings } = await import('../../../src/cli/utils.js');

    vi.mocked(readCounter).mockResolvedValueOnce({
      total: 0,
      session: {},
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(loadState).mockResolvedValueOnce({
      entries: [],
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(readSettings).mockResolvedValueOnce({});

    const { runStatus } = await import('../../../src/cli/status.js');
    await runStatus({});

    const output = logs.join('\n');
    expect(output).toContain('Last analysis:');
    expect(output).toContain('never');
  });

  it('displays ISO timestamp when last_analysis is set', async () => {
    const { readCounter } = await import('../../../src/storage/counter.js');
    const { loadState } = await import('../../../src/delivery/state.js');
    const { readSettings } = await import('../../../src/cli/utils.js');

    vi.mocked(readCounter).mockResolvedValueOnce({
      total: 100,
      session: {},
      last_analysis: '2026-04-01T12:00:00Z',
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(loadState).mockResolvedValueOnce({
      entries: [],
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(readSettings).mockResolvedValueOnce({});

    const { runStatus } = await import('../../../src/cli/status.js');
    await runStatus({});

    const output = logs.join('\n');
    expect(output).toContain('2026-04-01T12:00:00Z');
  });

  it('displays pending recommendations count', async () => {
    const { readCounter } = await import('../../../src/storage/counter.js');
    const { loadState } = await import('../../../src/delivery/state.js');
    const { readSettings } = await import('../../../src/cli/utils.js');

    vi.mocked(readCounter).mockResolvedValueOnce({
      total: 50,
      session: {},
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(loadState).mockResolvedValueOnce({
      entries: [
        { id: 'rec-1', status: 'pending', updated_at: '2026-04-03T00:00:00Z' },
        { id: 'rec-2', status: 'applied', updated_at: '2026-04-03T00:00:00Z' },
        { id: 'rec-3', status: 'pending', updated_at: '2026-04-03T00:00:00Z' },
        { id: 'rec-4', status: 'dismissed', updated_at: '2026-04-03T00:00:00Z' },
      ],
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(readSettings).mockResolvedValueOnce({});

    const { runStatus } = await import('../../../src/cli/status.js');
    await runStatus({});

    const output = logs.join('\n');
    expect(output).toContain('Pending recs:');
    expect(output).toContain('2');
  });

  it('displays "Yes" when hooks are registered in settings.json', async () => {
    const { readCounter } = await import('../../../src/storage/counter.js');
    const { loadState } = await import('../../../src/delivery/state.js');
    const { readSettings } = await import('../../../src/cli/utils.js');

    vi.mocked(readCounter).mockResolvedValueOnce({
      total: 10,
      session: {},
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(loadState).mockResolvedValueOnce({
      entries: [],
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(readSettings).mockResolvedValueOnce({
      hooks: {
        UserPromptSubmit: [{
          matcher: '*',
          hooks: [{ type: 'command', command: 'node "/path/to/harness-evolve/dist/hooks/user-prompt-submit.js"' }],
        }],
      },
    });

    const { runStatus } = await import('../../../src/cli/status.js');
    await runStatus({});

    const output = logs.join('\n');
    expect(output).toContain('Hooks registered:');
    expect(output).toMatch(/Hooks registered:\s+Yes/);
  });

  it('displays "No" when hooks are not registered', async () => {
    const { readCounter } = await import('../../../src/storage/counter.js');
    const { loadState } = await import('../../../src/delivery/state.js');
    const { readSettings } = await import('../../../src/cli/utils.js');

    vi.mocked(readCounter).mockResolvedValueOnce({
      total: 5,
      session: {},
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(loadState).mockResolvedValueOnce({
      entries: [],
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(readSettings).mockResolvedValueOnce({
      hooks: {
        UserPromptSubmit: [{
          matcher: '*.py',
          hooks: [{ type: 'command', command: 'python lint.py' }],
        }],
      },
    });

    const { runStatus } = await import('../../../src/cli/status.js');
    await runStatus({});

    const output = logs.join('\n');
    expect(output).toMatch(/Hooks registered:\s+No/);
  });

  it('handles missing counter.json gracefully (shows 0 interactions)', async () => {
    const { readCounter } = await import('../../../src/storage/counter.js');
    const { loadState } = await import('../../../src/delivery/state.js');
    const { readSettings } = await import('../../../src/cli/utils.js');

    // readCounter returns defaults when file is missing
    vi.mocked(readCounter).mockResolvedValueOnce({
      total: 0,
      session: {},
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(loadState).mockResolvedValueOnce({
      entries: [],
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(readSettings).mockResolvedValueOnce({});

    const { runStatus } = await import('../../../src/cli/status.js');
    await runStatus({});

    const output = logs.join('\n');
    expect(output).toContain('0');
  });

  it('handles missing recommendation-state.json gracefully (shows 0 pending)', async () => {
    const { readCounter } = await import('../../../src/storage/counter.js');
    const { loadState } = await import('../../../src/delivery/state.js');
    const { readSettings } = await import('../../../src/cli/utils.js');

    vi.mocked(readCounter).mockResolvedValueOnce({
      total: 10,
      session: {},
      last_updated: '2026-04-03T00:00:00Z',
    });
    // loadState returns empty entries when file doesn't exist
    vi.mocked(loadState).mockResolvedValueOnce({
      entries: [],
      last_updated: '2026-04-03T00:00:00Z',
    });
    vi.mocked(readSettings).mockResolvedValueOnce({});

    const { runStatus } = await import('../../../src/cli/status.js');
    await runStatus({});

    const output = logs.join('\n');
    expect(output).toContain('Pending recs:');
    expect(output).toMatch(/Pending recs:\s+0/);
  });

  it('exports registerStatusCommand function', async () => {
    const { registerStatusCommand } = await import('../../../src/cli/status.js');
    expect(typeof registerStatusCommand).toBe('function');
  });
});
