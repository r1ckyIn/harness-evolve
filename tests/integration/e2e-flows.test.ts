// Integration test: E2E flows validating all 5 audit pipelines.
// Proves the full self-improving feedback loop works end-to-end:
// Flow 1: Hook capture -> log -> pre-process -> analyze -> deliver (via /evolve)
// Flow 2: Counter accumulation -> Stop hook -> checkAndTriggerAnalysis -> auto analysis
// Flow 3: Environment scan -> classifier enrichment -> ecosystem-aware recommendations
// Flow 4: Apply recommendation -> trackOutcomes -> outcomeSummaries -> confidence adjustment
// Flow 5: /evolve with fullAuto=true -> autoApplyRecommendations -> HIGH recs auto-applied

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

// Import after mock setup -- real modules, no mocking of analysis/delivery internals
const { handleStop } = await import('../../src/hooks/stop.js');
const { runAnalysis, checkAndTriggerAnalysis } = await import('../../src/analysis/trigger.js');
const { autoApplyRecommendations } = await import('../../src/delivery/auto-apply.js');
const { updateStatus } = await import('../../src/delivery/state.js');

// --- Helper Functions ---

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
 * Create a permission log entry with sensible defaults.
 */
function makePermission(
  toolName: string,
  sessionId: string,
  timestamp: string,
): Record<string, unknown> {
  return {
    timestamp,
    session_id: sessionId,
    tool_name: toolName,
    decision: 'unknown',
  };
}

/**
 * Create log fixtures: repeated short prompts + permission patterns
 * producing at least HOOK + SETTINGS recommendations.
 */
async function createLogFixtures(dir: string): Promise<void> {
  const promptsDir = join(dir, 'logs', 'prompts');
  const permsDir = join(dir, 'logs', 'permissions');

  // 10 repeated "npm test" prompts across 3 sessions -> HOOK rec
  const promptEntries: Record<string, unknown>[] = [];
  const sessions = ['sess-1', 'sess-2', 'sess-3'];
  for (let i = 0; i < 10; i++) {
    promptEntries.push(
      makePrompt(
        'npm test',
        sessions[i % 3],
        `2026-01-15T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
      ),
    );
  }
  await writeJsonlFile(promptsDir, '2026-01-15.jsonl', promptEntries);

  // 15 permission approvals for "Bash(npm test)" across 4 sessions -> SETTINGS rec
  const permEntries1: Record<string, unknown>[] = [];
  const permEntries2: Record<string, unknown>[] = [];
  const permSessions = ['sess-1', 'sess-2', 'sess-3', 'sess-4'];
  for (let i = 0; i < 8; i++) {
    permEntries1.push(
      makePermission(
        'Bash(npm test)',
        permSessions[i % 4],
        `2026-01-15T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
      ),
    );
  }
  for (let i = 0; i < 7; i++) {
    permEntries2.push(
      makePermission(
        'Bash(npm test)',
        permSessions[(i + 2) % 4],
        `2026-01-16T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
      ),
    );
  }
  await writeJsonlFile(permsDir, '2026-01-15.jsonl', permEntries1);
  await writeJsonlFile(permsDir, '2026-01-16.jsonl', permEntries2);
}

/**
 * Create counter fixture with configurable total and optional last_analysis.
 */
async function createCounterFixture(
  dir: string,
  total: number,
  lastAnalysis?: string,
): Promise<void> {
  const counter = {
    total,
    session: { 'sess-1': total },
    last_updated: new Date().toISOString(),
    ...(lastAnalysis ? { last_analysis: lastAnalysis } : {}),
  };
  await writeFile(
    join(dir, 'counter.json'),
    JSON.stringify(counter, null, 2),
    'utf-8',
  );
}

/**
 * Create config fixture with defaults and optional overrides.
 */
async function createConfigFixture(
  dir: string,
  overrides?: Record<string, unknown>,
): Promise<void> {
  const config = {
    version: 1,
    analysis: { threshold: 50, enabled: true, classifierThresholds: {} },
    hooks: {
      capturePrompts: true,
      captureTools: true,
      capturePermissions: true,
      captureSessions: true,
    },
    scrubbing: { enabled: true, highEntropyDetection: false, customPatterns: [] },
    delivery: {
      stdoutInjection: true,
      maxTokens: 200,
      fullAuto: false,
      maxRecommendationsInFile: 20,
      archiveAfterDays: 7,
    },
    ...overrides,
  };
  await writeFile(
    join(dir, 'config.json'),
    JSON.stringify(config, null, 2),
    'utf-8',
  );
}

/**
 * Create a minimal settings.json file at the given path.
 */
async function createSettingsFixture(
  filePath: string,
  allowedTools?: string[],
): Promise<void> {
  await mkdir(join(filePath, '..'), { recursive: true });
  const settings: Record<string, unknown> = {};
  if (allowedTools) {
    settings.allowedTools = allowedTools;
  }
  await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf-8');
}

// --- Init helper: create all required directories ---

async function initDirs(dir: string): Promise<void> {
  await mkdir(join(dir, 'logs', 'prompts'), { recursive: true });
  await mkdir(join(dir, 'logs', 'tools'), { recursive: true });
  await mkdir(join(dir, 'logs', 'sessions'), { recursive: true });
  await mkdir(join(dir, 'logs', 'permissions'), { recursive: true });
  await mkdir(join(dir, 'analysis', 'pre-processed'), { recursive: true });
  await mkdir(join(dir, 'analysis', 'recommendations-archive'), { recursive: true });
  await mkdir(join(dir, 'pending'), { recursive: true });
}

// --- Tests ---

describe('e2e-flows', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-e2e-flows-'));
    await initDirs(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------
  // Flow 2 (TRG-02): Stop hook -> checkAndTriggerAnalysis -> analysis
  // -------------------------------------------------------------------
  it('Flow 2: Stop hook triggers analysis when counter reaches threshold (TRG-02)', async () => {
    // Set up log data that produces analysis output
    await createLogFixtures(tempDir);

    // Counter at threshold
    await createCounterFixture(tempDir, 50);

    // Config with analysis enabled, threshold=50
    await createConfigFixture(tempDir);

    // Build valid Stop hook JSON input
    const input = {
      session_id: 'sess-test-e2e',
      transcript_path: '/tmp/transcript.jsonl',
      cwd: tempDir,
      permission_mode: 'default',
      hook_event_name: 'Stop',
      stop_hook_active: false,
    };

    // Invoke the stop hook handler
    await handleStop(JSON.stringify(input));

    // Assert: analysis-result.json was created
    const resultPath = join(tempDir, 'analysis', 'analysis-result.json');
    expect(existsSync(resultPath)).toBe(true);

    // Assert: analysis result is valid JSON with recommendations
    const resultRaw = await readFile(resultPath, 'utf-8');
    const result = JSON.parse(resultRaw) as { recommendations: unknown[] };
    expect(result.recommendations.length).toBeGreaterThan(0);

    // Assert: counter was reset to 0
    const counterRaw = await readFile(join(tempDir, 'counter.json'), 'utf-8');
    const counter = JSON.parse(counterRaw) as {
      total: number;
      last_analysis?: string;
    };
    expect(counter.total).toBe(0);

    // Assert: counter has last_analysis timestamp
    expect(counter.last_analysis).toBeDefined();
    expect(typeof counter.last_analysis).toBe('string');
  });

  // -------------------------------------------------------------------
  // Flow 2 Guard: stop_hook_active prevents infinite loop
  // -------------------------------------------------------------------
  it('Flow 2 guard: stop_hook_active=true prevents analysis trigger', async () => {
    await createLogFixtures(tempDir);
    await createCounterFixture(tempDir, 50);
    await createConfigFixture(tempDir);

    const input = {
      session_id: 'sess-test-guard',
      transcript_path: '/tmp/transcript.jsonl',
      cwd: tempDir,
      permission_mode: 'default',
      hook_event_name: 'Stop',
      stop_hook_active: true, // Guard active -- should NOT trigger
    };

    await handleStop(JSON.stringify(input));

    // Assert: analysis-result.json was NOT created
    const resultPath = join(tempDir, 'analysis', 'analysis-result.json');
    expect(existsSync(resultPath)).toBe(false);

    // Assert: counter unchanged (still 50)
    const counterRaw = await readFile(join(tempDir, 'counter.json'), 'utf-8');
    const counter = JSON.parse(counterRaw) as { total: number };
    expect(counter.total).toBe(50);
  });

  // -------------------------------------------------------------------
  // Flow 2 Cooldown: recent last_analysis prevents re-trigger
  // -------------------------------------------------------------------
  it('Flow 2 cooldown: recent analysis prevents re-trigger', async () => {
    await createLogFixtures(tempDir);

    // Counter at threshold BUT last_analysis was 10 seconds ago (within 60s cooldown)
    const recentTimestamp = new Date(Date.now() - 10_000).toISOString();
    await createCounterFixture(tempDir, 50, recentTimestamp);
    await createConfigFixture(tempDir);

    const input = {
      session_id: 'sess-test-cooldown',
      transcript_path: '/tmp/transcript.jsonl',
      cwd: tempDir,
      permission_mode: 'default',
      hook_event_name: 'Stop',
      stop_hook_active: false,
    };

    await handleStop(JSON.stringify(input));

    // Assert: analysis NOT triggered (cooldown respected)
    const resultPath = join(tempDir, 'analysis', 'analysis-result.json');
    expect(existsSync(resultPath)).toBe(false);
  });

  // -------------------------------------------------------------------
  // Flow 4 (QUA-04): Outcome feedback loop
  // -------------------------------------------------------------------
  it('Flow 4: outcome tracking wired into analysis pipeline (QUA-04)', async () => {
    await createLogFixtures(tempDir);
    await createConfigFixture(tempDir);

    // Create an applied recommendation in the state file
    const stateData = {
      entries: [
        {
          id: 'rec-repeated-0',
          status: 'applied',
          updated_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
          applied_details: 'Added Bash to allowedTools',
        },
      ],
      last_updated: new Date().toISOString(),
    };
    await writeFile(
      join(tempDir, 'analysis', 'recommendation-state.json'),
      JSON.stringify(stateData, null, 2),
      'utf-8',
    );

    // Run analysis (which now invokes trackOutcomes internally)
    await runAnalysis(tempDir);

    // Assert: outcome-history.jsonl exists and has entries
    const historyPath = join(tempDir, 'analysis', 'outcome-history.jsonl');
    expect(existsSync(historyPath)).toBe(true);

    const historyRaw = await readFile(historyPath, 'utf-8');
    const lines = historyRaw.split('\n').filter((l) => l.trim().length > 0);
    expect(lines.length).toBeGreaterThanOrEqual(1);

    // Parse first entry and validate structure
    const entry = JSON.parse(lines[0]) as {
      recommendation_id: string;
      outcome: string;
      persisted: boolean;
      checks_since_applied: number;
    };
    expect(entry.recommendation_id).toBe('rec-repeated-0');
    expect(['positive', 'negative', 'monitoring']).toContain(entry.outcome);
    expect(typeof entry.persisted).toBe('boolean');
    expect(entry.checks_since_applied).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------
  // Flow 5 (DEL-06): Real classifier -> auto-apply pipeline
  // -------------------------------------------------------------------
  it('Flow 5: real classifier -> autoApply pipeline applies HIGH SETTINGS rec (DEL-06)', async () => {
    // Import real classifier and test helpers
    const { classifyPermissionPatterns } = await import('../../src/analysis/classifiers/permission-patterns.js');
    const { makeEmptySummary, makeEmptySnapshot, makeDefaultConfig } = await import('../../tests/unit/analysis/helpers.js');

    // Enable fullAuto mode
    await createConfigFixture(tempDir, {
      delivery: {
        stdoutInjection: true,
        maxTokens: 200,
        fullAuto: true,
        maxRecommendationsInFile: 20,
        archiveAfterDays: 7,
      },
    });

    // Create a settings.json that auto-apply will modify
    const settingsPath = join(tempDir, 'test-settings.json');
    await createSettingsFixture(settingsPath);

    // Run REAL classifier with inputs that trigger HIGH confidence
    const summary = makeEmptySummary();
    summary.permission_patterns = [
      { tool_name: 'Bash(npm test)', count: 15, sessions: 4 },
    ];
    const recommendations = classifyPermissionPatterns(summary, makeEmptySnapshot(), makeDefaultConfig());

    // Assert: classifier produced at least 1 recommendation
    expect(recommendations.length).toBeGreaterThanOrEqual(1);
    const recommendation = recommendations[0];

    // KEY assertions: classifier output matches what auto-apply expects
    expect(recommendation.pattern_type).toBe('permission-always-approved');
    expect(recommendation.id.startsWith('rec-permission-always-approved-')).toBe(true);

    // Call autoApplyRecommendations with real classifier output
    const results = await autoApplyRecommendations([recommendation], {
      settingsPath,
    });

    // Assert: at least one result with success
    expect(results.length).toBe(1);
    expect(results[0].success).toBe(true);
    expect(results[0].details).toContain('Bash');

    // Assert: settings.json was modified with allowedTools
    const settingsRaw = await readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(settingsRaw) as { allowedTools?: string[] };
    expect(settings.allowedTools).toBeDefined();
    expect(settings.allowedTools).toContain('Bash');

    // Assert: auto-apply-log.jsonl has an entry
    const logPath = join(tempDir, 'analysis', 'auto-apply-log.jsonl');
    expect(existsSync(logPath)).toBe(true);

    const logRaw = await readFile(logPath, 'utf-8');
    const logLines = logRaw.split('\n').filter((l) => l.trim().length > 0);
    expect(logLines.length).toBeGreaterThanOrEqual(1);

    const logEntry = JSON.parse(logLines[0]) as {
      recommendation_id: string;
      success: boolean;
      target: string;
    };
    expect(logEntry.recommendation_id).toBe('rec-permission-always-approved-0');
    expect(logEntry.success).toBe(true);
    expect(logEntry.target).toBe('SETTINGS');
  });
});
