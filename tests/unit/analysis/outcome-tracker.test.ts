// Unit tests for the outcome tracker module.
// Validates: persistence detection (SETTINGS/HOOK/SKILL/RULE), outcome
// classification (positive/negative/monitoring), JSONL persistence,
// history loading, and outcome summary computation.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { EnvironmentSnapshot } from '../../../src/analysis/schemas.js';
import type { RecommendationState } from '../../../src/schemas/delivery.js';
import { outcomeEntrySchema } from '../../../src/schemas/onboarding.js';
import { makeEmptySnapshot } from './helpers.js';

// Temp directory updated per-test
let tempDir: string;

// Mock dirs module to redirect outcomeHistory to temp directory
vi.mock('../../../src/storage/dirs.js', async () => {
  return {
    get paths() {
      return {
        base: tempDir,
        logs: {
          prompts: join(tempDir, 'logs', 'prompts'),
          tools: join(tempDir, 'logs', 'tools'),
          permissions: join(tempDir, 'logs', 'permissions'),
          sessions: join(tempDir, 'logs', 'sessions'),
        },
        analysis: join(tempDir, 'analysis'),
        analysisPreProcessed: join(tempDir, 'analysis', 'pre-processed'),
        summary: join(tempDir, 'analysis', 'pre-processed', 'summary.json'),
        environmentSnapshot: join(tempDir, 'analysis', 'environment-snapshot.json'),
        analysisResult: join(tempDir, 'analysis', 'analysis-result.json'),
        pending: join(tempDir, 'pending'),
        config: join(tempDir, 'config.json'),
        counter: join(tempDir, 'counter.json'),
        recommendations: join(tempDir, 'recommendations.md'),
        recommendationState: join(tempDir, 'analysis', 'recommendation-state.json'),
        recommendationArchive: join(tempDir, 'analysis', 'recommendations-archive'),
        notificationFlag: join(tempDir, 'analysis', 'has-pending-notifications'),
        autoApplyLog: join(tempDir, 'analysis', 'auto-apply-log.jsonl'),
        outcomeHistory: join(tempDir, 'analysis', 'outcome-history.jsonl'),
      };
    },
    ensureInit: async () => {
      const { mkdir: mk } = await import('node:fs/promises');
      await mk(join(tempDir, 'analysis'), { recursive: true });
    },
    resetInit: () => {},
  };
});

// Mock delivery/state.ts to control loadState return value
const mockLoadState = vi.fn<() => Promise<RecommendationState>>();
vi.mock('../../../src/delivery/state.js', () => ({
  loadState: () => mockLoadState(),
}));

// Import after mock setup
const { trackOutcomes, loadOutcomeHistory, computeOutcomeSummaries } =
  await import('../../../src/analysis/outcome-tracker.js');

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'outcome-tracker-test-'));
  await mkdir(join(tempDir, 'analysis'), { recursive: true });
  mockLoadState.mockReset();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('trackOutcomes', () => {
  it('returns entry with persisted=true for applied SETTINGS rec whose tool IS in allowedTools', async () => {
    mockLoadState.mockResolvedValue({
      entries: [
        {
          id: 'rec-permission-always-approved-0',
          status: 'applied',
          updated_at: '2026-03-01T00:00:00Z',
          applied_details: 'Auto-applied: Added Bash to allowedTools',
        },
      ],
      last_updated: '2026-03-01T00:00:00Z',
    });

    const snapshot = makeEmptySnapshot();
    snapshot.settings.user = { allowedTools: ['Bash'] };

    const results = await trackOutcomes(snapshot);

    expect(results).toHaveLength(1);
    expect(results[0].persisted).toBe(true);
    expect(results[0].recommendation_id).toBe('rec-permission-always-approved-0');
  });

  it('returns entry with persisted=false for applied SETTINGS rec whose tool is NOT in allowedTools', async () => {
    mockLoadState.mockResolvedValue({
      entries: [
        {
          id: 'rec-permission-always-approved-0',
          status: 'applied',
          updated_at: '2026-03-01T00:00:00Z',
          applied_details: 'Auto-applied: Added Bash to allowedTools',
        },
      ],
      last_updated: '2026-03-01T00:00:00Z',
    });

    const snapshot = makeEmptySnapshot();
    snapshot.settings.user = { allowedTools: [] };

    const results = await trackOutcomes(snapshot);

    expect(results).toHaveLength(1);
    expect(results[0].persisted).toBe(false);
  });

  it('returns entry with persisted=true for HOOK rec when snapshot has hooks', async () => {
    mockLoadState.mockResolvedValue({
      entries: [
        {
          id: 'rec-repeated-0',
          status: 'applied',
          updated_at: '2026-03-01T00:00:00Z',
        },
      ],
      last_updated: '2026-03-01T00:00:00Z',
    });

    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.hooks = [
      { event: 'UserPromptSubmit', scope: 'user', type: 'command' },
    ];

    const results = await trackOutcomes(snapshot);

    expect(results).toHaveLength(1);
    expect(results[0].persisted).toBe(true);
  });

  it('returns entry with persisted=false for HOOK rec when snapshot has NO hooks', async () => {
    mockLoadState.mockResolvedValue({
      entries: [
        {
          id: 'rec-repeated-0',
          status: 'applied',
          updated_at: '2026-03-01T00:00:00Z',
        },
      ],
      last_updated: '2026-03-01T00:00:00Z',
    });

    const snapshot = makeEmptySnapshot();
    // hooks is already empty in makeEmptySnapshot

    const results = await trackOutcomes(snapshot);

    expect(results).toHaveLength(1);
    expect(results[0].persisted).toBe(false);
  });

  it('assigns outcome=positive when checks_since_applied >= 5 and persisted=true', async () => {
    // Write prior history with 4 checks already done
    const priorEntry = {
      recommendation_id: 'rec-repeated-0',
      pattern_type: 'repeated-prompt',
      target: 'HOOK',
      applied_at: '2026-03-01T00:00:00Z',
      checked_at: '2026-03-29T00:00:00Z',
      persisted: true,
      checks_since_applied: 4,
      outcome: 'monitoring',
    };
    await writeFile(
      join(tempDir, 'analysis', 'outcome-history.jsonl'),
      JSON.stringify(priorEntry) + '\n',
      'utf-8',
    );

    mockLoadState.mockResolvedValue({
      entries: [
        {
          id: 'rec-repeated-0',
          status: 'applied',
          updated_at: '2026-03-01T00:00:00Z',
        },
      ],
      last_updated: '2026-03-01T00:00:00Z',
    });

    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.hooks = [
      { event: 'UserPromptSubmit', scope: 'user', type: 'command' },
    ];

    const results = await trackOutcomes(snapshot);

    expect(results).toHaveLength(1);
    expect(results[0].checks_since_applied).toBe(5);
    expect(results[0].outcome).toBe('positive');
  });

  it('assigns outcome=negative when persisted=false regardless of checks count', async () => {
    // Write prior history with 4 checks
    const priorEntry = {
      recommendation_id: 'rec-repeated-0',
      pattern_type: 'repeated-prompt',
      target: 'HOOK',
      applied_at: '2026-03-01T00:00:00Z',
      checked_at: '2026-03-29T00:00:00Z',
      persisted: true,
      checks_since_applied: 4,
      outcome: 'monitoring',
    };
    await writeFile(
      join(tempDir, 'analysis', 'outcome-history.jsonl'),
      JSON.stringify(priorEntry) + '\n',
      'utf-8',
    );

    mockLoadState.mockResolvedValue({
      entries: [
        {
          id: 'rec-repeated-0',
          status: 'applied',
          updated_at: '2026-03-01T00:00:00Z',
        },
      ],
      last_updated: '2026-03-01T00:00:00Z',
    });

    const snapshot = makeEmptySnapshot();
    // hooks empty -> persisted=false

    const results = await trackOutcomes(snapshot);

    expect(results).toHaveLength(1);
    expect(results[0].persisted).toBe(false);
    expect(results[0].outcome).toBe('negative');
  });

  it('assigns outcome=monitoring when checks_since_applied < 5 and persisted=true', async () => {
    mockLoadState.mockResolvedValue({
      entries: [
        {
          id: 'rec-repeated-0',
          status: 'applied',
          updated_at: '2026-03-01T00:00:00Z',
        },
      ],
      last_updated: '2026-03-01T00:00:00Z',
    });

    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.hooks = [
      { event: 'UserPromptSubmit', scope: 'user', type: 'command' },
    ];

    const results = await trackOutcomes(snapshot);

    expect(results).toHaveLength(1);
    expect(results[0].checks_since_applied).toBe(1);
    expect(results[0].outcome).toBe('monitoring');
  });

  it('returns empty array when no applied recommendations exist', async () => {
    mockLoadState.mockResolvedValue({
      entries: [
        {
          id: 'rec-permission-always-approved-0',
          status: 'pending',
          updated_at: '2026-03-01T00:00:00Z',
        },
      ],
      last_updated: '2026-03-01T00:00:00Z',
    });

    const snapshot = makeEmptySnapshot();
    const results = await trackOutcomes(snapshot);

    expect(results).toHaveLength(0);
  });
});

describe('appendOutcome (via trackOutcomes)', () => {
  it('writes a valid JSONL line to outcomeHistory path', async () => {
    mockLoadState.mockResolvedValue({
      entries: [
        {
          id: 'rec-repeated-0',
          status: 'applied',
          updated_at: '2026-03-01T00:00:00Z',
        },
      ],
      last_updated: '2026-03-01T00:00:00Z',
    });

    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.hooks = [
      { event: 'UserPromptSubmit', scope: 'user', type: 'command' },
    ];

    await trackOutcomes(snapshot);

    const content = await readFile(
      join(tempDir, 'analysis', 'outcome-history.jsonl'),
      'utf-8',
    );
    const lines = content.trim().split('\n').filter(Boolean);
    expect(lines).toHaveLength(1);

    const parsed = JSON.parse(lines[0]);
    const validated = outcomeEntrySchema.safeParse(parsed);
    expect(validated.success).toBe(true);
  });
});

describe('loadOutcomeHistory', () => {
  it('reads JSONL entries and validates against outcomeEntrySchema', async () => {
    const entry = {
      recommendation_id: 'rec-repeated-0',
      pattern_type: 'repeated-prompt',
      target: 'HOOK',
      applied_at: '2026-03-01T00:00:00Z',
      checked_at: '2026-03-30T00:00:00Z',
      persisted: true,
      checks_since_applied: 3,
      outcome: 'monitoring',
    };
    await writeFile(
      join(tempDir, 'analysis', 'outcome-history.jsonl'),
      JSON.stringify(entry) + '\n',
      'utf-8',
    );

    const history = await loadOutcomeHistory();

    expect(history).toHaveLength(1);
    expect(history[0].recommendation_id).toBe('rec-repeated-0');
    expect(history[0].outcome).toBe('monitoring');
  });

  it('returns empty array when file does not exist', async () => {
    const history = await loadOutcomeHistory();
    expect(history).toEqual([]);
  });

  it('skips invalid lines silently', async () => {
    const validEntry = {
      recommendation_id: 'rec-repeated-0',
      pattern_type: 'repeated-prompt',
      target: 'HOOK',
      applied_at: '2026-03-01T00:00:00Z',
      checked_at: '2026-03-30T00:00:00Z',
      persisted: true,
      checks_since_applied: 3,
      outcome: 'monitoring',
    };
    const content =
      'not valid json\n' +
      JSON.stringify(validEntry) + '\n' +
      '{"incomplete": true}\n';
    await writeFile(
      join(tempDir, 'analysis', 'outcome-history.jsonl'),
      content,
      'utf-8',
    );

    const history = await loadOutcomeHistory();

    expect(history).toHaveLength(1);
    expect(history[0].recommendation_id).toBe('rec-repeated-0');
  });
});

describe('computeOutcomeSummaries', () => {
  it('groups by pattern_type and computes persistence_rate correctly', () => {
    const history = [
      {
        recommendation_id: 'rec-1',
        pattern_type: 'repeated-prompt',
        target: 'HOOK',
        applied_at: '2026-03-01T00:00:00Z',
        checked_at: '2026-03-30T00:00:00Z',
        persisted: true,
        checks_since_applied: 5,
        outcome: 'positive' as const,
      },
      {
        recommendation_id: 'rec-2',
        pattern_type: 'repeated-prompt',
        target: 'HOOK',
        applied_at: '2026-03-01T00:00:00Z',
        checked_at: '2026-03-30T00:00:00Z',
        persisted: false,
        checks_since_applied: 3,
        outcome: 'negative' as const,
      },
      {
        recommendation_id: 'rec-3',
        pattern_type: 'permission-always-approved',
        target: 'SETTINGS',
        applied_at: '2026-03-01T00:00:00Z',
        checked_at: '2026-03-30T00:00:00Z',
        persisted: true,
        checks_since_applied: 5,
        outcome: 'positive' as const,
      },
    ];

    const summaries = computeOutcomeSummaries(history);

    expect(summaries).toHaveLength(2);

    const repeated = summaries.find(s => s.pattern_type === 'repeated-prompt');
    expect(repeated).toBeDefined();
    expect(repeated!.total_applied).toBe(2);
    expect(repeated!.total_persisted).toBe(1);
    expect(repeated!.total_reverted).toBe(1);
    expect(repeated!.persistence_rate).toBe(0.5);

    const permission = summaries.find(s => s.pattern_type === 'permission-always-approved');
    expect(permission).toBeDefined();
    expect(permission!.total_applied).toBe(1);
    expect(permission!.total_persisted).toBe(1);
    expect(permission!.total_reverted).toBe(0);
    expect(permission!.persistence_rate).toBe(1);
  });

  it('returns empty array for empty history', () => {
    const summaries = computeOutcomeSummaries([]);
    expect(summaries).toEqual([]);
  });

  it('counts unique recommendation_ids for total_applied', () => {
    // Same recommendation checked twice -- should count as 1 applied
    const history = [
      {
        recommendation_id: 'rec-1',
        pattern_type: 'repeated-prompt',
        target: 'HOOK',
        applied_at: '2026-03-01T00:00:00Z',
        checked_at: '2026-03-28T00:00:00Z',
        persisted: true,
        checks_since_applied: 4,
        outcome: 'monitoring' as const,
      },
      {
        recommendation_id: 'rec-1',
        pattern_type: 'repeated-prompt',
        target: 'HOOK',
        applied_at: '2026-03-01T00:00:00Z',
        checked_at: '2026-03-30T00:00:00Z',
        persisted: true,
        checks_since_applied: 5,
        outcome: 'positive' as const,
      },
    ];

    const summaries = computeOutcomeSummaries(history);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].total_applied).toBe(1);
    // Latest outcome for this rec is positive
    expect(summaries[0].total_persisted).toBe(1);
    expect(summaries[0].total_reverted).toBe(0);
  });
});
