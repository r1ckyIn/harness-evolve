// Integration test: outcome tracking pipeline end-to-end.
// Validates the full loop: apply recommendation -> track outcome ->
// confidence adjusted on next analysis run.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readFile, mkdtemp, rm, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { EnvironmentSnapshot } from '../../src/analysis/schemas.js';

// Temp directory updated per-test
let tempDir: string;

// Mock dirs module to redirect all paths to temp directory
vi.mock('../../src/storage/dirs.js', async () => {
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
      await mk(join(tempDir, 'logs', 'prompts'), { recursive: true });
      await mk(join(tempDir, 'logs', 'tools'), { recursive: true });
      await mk(join(tempDir, 'logs', 'permissions'), { recursive: true });
      await mk(join(tempDir, 'logs', 'sessions'), { recursive: true });
      await mk(join(tempDir, 'analysis', 'pre-processed'), { recursive: true });
      await mk(join(tempDir, 'analysis'), { recursive: true });
      await mk(join(tempDir, 'pending'), { recursive: true });
      await mk(join(tempDir, 'analysis', 'recommendations-archive'), { recursive: true });
    },
    resetInit: () => {},
  };
});

// Import after mock setup
const { preProcess } = await import('../../src/analysis/pre-processor.js');
const { analyze } = await import('../../src/analysis/analyzer.js');
const { updateStatus } = await import('../../src/delivery/state.js');
const { loadOutcomeHistory, computeOutcomeSummaries, trackOutcomes } =
  await import('../../src/analysis/outcome-tracker.js');

// --- Helpers ---

/**
 * Write an array of objects as a JSONL file (one JSON per line).
 */
async function writeJsonlFile(
  dir: string,
  filename: string,
  entries: unknown[],
): Promise<void> {
  await mkdir(dir, { recursive: true });
  const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';
  await writeFile(join(dir, filename), content, 'utf-8');
}

/**
 * Create a prompt log entry with sensible defaults.
 */
function makePrompt(
  prompt: string,
  sessionId: string,
  timestamp: string,
): Record<string, unknown> {
  return {
    timestamp,
    session_id: sessionId,
    cwd: '/home/user/project',
    prompt,
    prompt_length: prompt.length,
  };
}

/**
 * Create a minimal environment snapshot for testing.
 */
function makeMinimalSnapshot(
  overrides?: Partial<EnvironmentSnapshot>,
): EnvironmentSnapshot {
  return {
    generated_at: '2026-04-01T00:00:00Z',
    claude_code: {
      version: '2.1.0',
      version_known: true,
      compatible: true,
    },
    settings: {
      user: null,
      project: null,
      local: null,
    },
    installed_tools: {
      plugins: [],
      skills: [],
      rules: [],
      hooks: [],
      claude_md: [],
    },
    detected_ecosystems: [],
    ...overrides,
  };
}

/**
 * Create test data: 10 repeated "npm test" prompts across 3 sessions.
 */
async function createRepeatedPromptData(): Promise<void> {
  const promptsDir = join(tempDir, 'logs', 'prompts');
  const entries: Record<string, unknown>[] = [];
  const sessions = ['sess-1', 'sess-2', 'sess-3'];
  for (let i = 0; i < 10; i++) {
    entries.push(
      makePrompt(
        'npm test',
        sessions[i % 3],
        `2026-01-15T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
      ),
    );
  }
  await writeJsonlFile(promptsDir, '2026-01-15.jsonl', entries);
}

describe('outcome-pipeline', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-outcome-pipeline-'));
    await mkdir(join(tempDir, 'logs', 'tools'), { recursive: true });
    await mkdir(join(tempDir, 'logs', 'sessions'), { recursive: true });
    await mkdir(join(tempDir, 'logs', 'permissions'), { recursive: true });
    await mkdir(join(tempDir, 'analysis', 'pre-processed'), { recursive: true });
    await mkdir(join(tempDir, 'analysis', 'recommendations-archive'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('downgrades confidence after negative outcome history', async () => {
    // Step 1: Create repeated prompt data and run analysis
    await createRepeatedPromptData();
    const snapshot = makeMinimalSnapshot();
    const summary = await preProcess({ days: 30 });
    const result1 = analyze(summary, snapshot);

    // Find a HOOK recommendation (from repeated prompt or onboarding classifier)
    // With 10 repeated "npm test" prompts across 3 sessions we expect a repeated-prompt rec
    const hookRec = result1.recommendations.find(
      (r) => r.target === 'HOOK',
    );
    expect(hookRec).toBeDefined();
    const originalConfidence = hookRec!.confidence;
    const originalPatternType = hookRec!.pattern_type;

    // Step 2: Apply the recommendation
    await updateStatus(hookRec!.id, 'applied', 'Created a hook');

    // Step 3: Write fake negative outcome history for the hook rec's pattern type
    const negativeOutcome = {
      recommendation_id: hookRec!.id,
      pattern_type: originalPatternType,
      target: hookRec!.target,
      applied_at: '2026-03-01T00:00:00Z',
      checked_at: '2026-03-30T00:00:00Z',
      persisted: false,
      checks_since_applied: 5,
      outcome: 'negative',
    };
    await appendFile(
      join(tempDir, 'analysis', 'outcome-history.jsonl'),
      JSON.stringify(negativeOutcome) + '\n',
      'utf-8',
    );

    // Step 4: Load outcome history and compute summaries
    const history = await loadOutcomeHistory();
    expect(history).toHaveLength(1);
    const summaries = computeOutcomeSummaries(history);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].persistence_rate).toBe(0); // 0% persisted

    // Step 5: Run analysis again with outcome summaries
    const result2 = analyze(summary, snapshot, undefined, summaries);

    // Find a recommendation with the same pattern_type (ID-based lookup may
    // not work because IDs are deterministic per run, so the same rec has the
    // same ID in both runs)
    const adjustedHookRec = result2.recommendations.find(
      (r) => r.pattern_type === originalPatternType && r.target === 'HOOK',
    );
    expect(adjustedHookRec).toBeDefined();

    // Confidence mapping: HIGH->MEDIUM, MEDIUM->LOW, LOW->LOW
    const expected: Record<string, string> = {
      HIGH: 'MEDIUM',
      MEDIUM: 'LOW',
      LOW: 'LOW',
    };
    expect(adjustedHookRec!.confidence).toBe(expected[originalConfidence]);
  });

  it('trackOutcomes creates outcome entries and persists to JSONL', async () => {
    // Step 1: Create data and run analysis
    await createRepeatedPromptData();
    const snapshot = makeMinimalSnapshot();
    const summary = await preProcess({ days: 30 });
    const result = analyze(summary, snapshot);

    // Step 2: Apply a HOOK recommendation (from repeated-prompt or onboarding)
    const hookRec = result.recommendations.find(
      (r) => r.target === 'HOOK',
    );
    expect(hookRec).toBeDefined();
    await updateStatus(hookRec!.id, 'applied', 'Created a hook');

    // Step 3: Create a snapshot with a hook (simulating the applied change)
    const snapshotWithHook = makeMinimalSnapshot({
      installed_tools: {
        plugins: [],
        skills: [],
        rules: [],
        hooks: [{ event: 'UserPromptSubmit', scope: 'user', type: 'command' }],
        claude_md: [],
      },
    });

    // Step 4: Track outcomes
    const outcomes = await trackOutcomes(snapshotWithHook);

    // Verify outcome entries were created
    expect(outcomes.length).toBeGreaterThanOrEqual(1);
    const hookOutcome = outcomes.find(o => o.recommendation_id === hookRec!.id);
    expect(hookOutcome).toBeDefined();
    expect(hookOutcome!.persisted).toBe(true);
    expect(hookOutcome!.outcome).toBe('monitoring'); // First check, < 5

    // Step 5: Verify persistence to JSONL
    const history = await loadOutcomeHistory();
    expect(history.length).toBeGreaterThanOrEqual(1);
    const persistedEntry = history.find(h => h.recommendation_id === hookRec!.id);
    expect(persistedEntry).toBeDefined();
    expect(persistedEntry!.persisted).toBe(true);
  });
});
