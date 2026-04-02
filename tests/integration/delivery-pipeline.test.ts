// Integration test: full delivery pipeline end-to-end.
// Validates the complete flow from analysis through rendering, notification flag,
// state round-trip, and coexistence of auto and manual triggers.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analysisResultSchema } from '../../src/schemas/recommendation.js';
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

// Import after mock setup -- real analyzer, classifiers, pre-processor
const { preProcess } = await import('../../src/analysis/pre-processor.js');
const { analyze } = await import('../../src/analysis/analyzer.js');
const { runAnalysis, checkAndTriggerAnalysis } = await import('../../src/analysis/trigger.js');
const { renderRecommendations } = await import('../../src/delivery/renderer.js');
const { updateStatus, getStatusMap } = await import('../../src/delivery/state.js');
const { writeNotificationFlag, hasNotificationFlag } = await import('../../src/delivery/notification.js');

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
 * Guaranteed to produce at least one HOOK recommendation.
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

describe('delivery-pipeline', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-delivery-pipeline-'));
    await mkdir(join(tempDir, 'logs', 'tools'), { recursive: true });
    await mkdir(join(tempDir, 'logs', 'sessions'), { recursive: true });
    await mkdir(join(tempDir, 'logs', 'permissions'), { recursive: true });
    await mkdir(join(tempDir, 'analysis', 'pre-processed'), { recursive: true });
    await mkdir(join(tempDir, 'analysis', 'recommendations-archive'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('evolve: runAnalysis + renderRecommendations produces valid markdown output (TRG-03)', async () => {
    await createRepeatedPromptData();

    // Use preProcess + analyze with controlled date range to isolate from real environment
    const summary = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });
    const snapshot = makeMinimalSnapshot();
    const result = analyze(summary, snapshot);

    // Validate result has recommendations
    expect(result.recommendations.length).toBeGreaterThan(0);

    // Build status map (empty on first run)
    const stateMap = await getStatusMap();

    // Render markdown
    const markdown = renderRecommendations(result, stateMap);

    // Validate markdown structure
    expect(markdown).toContain('# harness-evolve Recommendations');
    // At least one confidence tier should appear
    const hasTier =
      markdown.includes('HIGH Confidence') ||
      markdown.includes('MEDIUM Confidence') ||
      markdown.includes('LOW Confidence');
    expect(hasTier).toBe(true);
    expect(markdown).toContain('[PENDING]');
    expect(markdown).toContain('/evolve');

    // Validate we can write it to file
    const recPath = join(tempDir, 'recommendations.md');
    const { writeFile: wf } = await import('node:fs/promises');
    await wf(recPath, markdown, 'utf-8');
    const fromDisk = await readFile(recPath, 'utf-8');
    expect(fromDisk).toBe(markdown);
  });

  it('coexist: auto and manual triggers produce schema-valid AnalysisResult (TRG-04)', async () => {
    await createRepeatedPromptData();

    // Manual trigger: runAnalysis directly
    const manualResult = await runAnalysis(tempDir);
    const manualValidated = analysisResultSchema.parse(manualResult);
    expect(manualValidated.recommendations.length).toBeGreaterThan(0);

    // Auto trigger: preProcess + analyze (the same pipeline checkAndTriggerAnalysis uses)
    const summary = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });
    const snapshot = makeMinimalSnapshot();
    const autoResult = analyze(summary, snapshot);
    const autoValidated = analysisResultSchema.parse(autoResult);
    expect(autoValidated.recommendations.length).toBeGreaterThan(0);

    // Both should render identically through the renderer
    const stateMap = new Map<string, 'pending' | 'applied' | 'dismissed'>();
    const manualMarkdown = renderRecommendations(manualValidated, stateMap);
    const autoMarkdown = renderRecommendations(autoValidated, stateMap);

    // Both should have the same structure (header, tiers, footer)
    expect(manualMarkdown).toContain('# harness-evolve Recommendations');
    expect(autoMarkdown).toContain('# harness-evolve Recommendations');

    // Both should produce schema-valid results with recommendations.
    // Counts may differ slightly because manual uses scanEnvironment (real scan)
    // while auto uses makeMinimalSnapshot (always newcomer tier), affecting
    // the onboarding classifier output.
    expect(manualValidated.recommendations.length).toBeGreaterThan(0);
    expect(autoValidated.recommendations.length).toBeGreaterThan(0);
  });

  it('notification flag: analysis sets flag with correct pending count', async () => {
    await createRepeatedPromptData();

    // Use controlled date range to isolate from real environment
    const summary = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });
    const snapshot = makeMinimalSnapshot();
    const result = analyze(summary, snapshot);
    const stateMap = await getStatusMap();

    // Count pending recommendations
    const pendingCount = result.recommendations.filter(
      (r) => (stateMap.get(r.id) ?? 'pending') === 'pending',
    ).length;

    // Write notification flag (as run-evolve.ts would)
    if (pendingCount > 0) {
      await writeNotificationFlag(pendingCount);
    }

    // Verify flag exists and has correct count
    expect(await hasNotificationFlag()).toBe(true);
    const flagPath = join(tempDir, 'analysis', 'has-pending-notifications');
    const flagContent = await readFile(flagPath, 'utf-8');
    expect(parseInt(flagContent.trim(), 10)).toBe(pendingCount);
    expect(pendingCount).toBeGreaterThan(0);
  });

  it('state round-trip: updateStatus changes state, renderer shows updated prefix', async () => {
    await createRepeatedPromptData();

    // Use controlled date range to isolate from real environment
    const summary = await preProcess({
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });
    const snapshot = makeMinimalSnapshot();
    const result = analyze(summary, snapshot);
    expect(result.recommendations.length).toBeGreaterThan(0);

    // Render with all pending (initial state)
    const stateMap1 = await getStatusMap();
    const markdown1 = renderRecommendations(result, stateMap1);
    expect(markdown1).toContain('[PENDING]');
    expect(markdown1).not.toContain('[APPLIED]');

    // Apply the first recommendation
    const firstRec = result.recommendations[0];
    await updateStatus(firstRec.id, 'applied', 'Applied via /evolve integration test');

    // Get updated status map
    const stateMap2 = await getStatusMap();
    expect(stateMap2.get(firstRec.id)).toBe('applied');

    // Render again -- should show APPLIED for that recommendation
    const markdown2 = renderRecommendations(result, stateMap2);
    expect(markdown2).toContain('[APPLIED]');
  });
});
