// Unit tests for auto-apply module.
// Tests: fullAuto config gate, confidence/target filtering, backup creation,
// JSONL logging, state updates, error handling, and already-applied skipping.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Config } from '../../../src/schemas/config.js';
import type { Recommendation } from '../../../src/schemas/recommendation.js';

// --- Temp directory per test ---
let tempDir: string;
let settingsDir: string;
let settingsPath: string;

// --- Mock setup ---

const mockLoadConfig = vi.fn<() => Promise<Config>>();
const mockUpdateStatus = vi.fn<(id: string, status: string, details?: string) => Promise<void>>();
const mockGetStatusMap = vi.fn<() => Promise<Map<string, string>>>();

vi.mock('../../../src/storage/config.js', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

vi.mock('../../../src/delivery/state.js', () => ({
  updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  getStatusMap: (...args: unknown[]) => mockGetStatusMap(...args),
}));

vi.mock('../../../src/storage/dirs.js', async () => {
  return {
    get paths() {
      return {
        base: tempDir,
        analysis: join(tempDir, 'analysis'),
        autoApplyLog: join(tempDir, 'analysis', 'auto-apply-log.jsonl'),
      };
    },
    ensureInit: vi.fn().mockResolvedValue(undefined),
  };
});

// Import after mocks
const { autoApplyRecommendations } =
  await import('../../../src/delivery/auto-apply.js');

// --- Helpers ---

function makeConfig(fullAuto: boolean): Config {
  return {
    version: 1,
    analysis: {
      threshold: 50,
      enabled: true,
      classifierThresholds: {},
    },
    hooks: {
      capturePrompts: true,
      captureTools: true,
      capturePermissions: true,
      captureSessions: true,
    },
    scrubbing: {
      enabled: true,
      highEntropyDetection: false,
      customPatterns: [],
    },
    delivery: {
      stdoutInjection: true,
      maxTokens: 200,
      fullAuto,
      maxRecommendationsInFile: 20,
      archiveAfterDays: 7,
    },
  };
}

function makeRecommendation(
  overrides: Partial<Recommendation> = {},
): Recommendation {
  return {
    id: 'rec-test-1',
    target: 'SETTINGS',
    confidence: 'HIGH',
    pattern_type: 'permission-always-approved',
    title: 'Auto-approve Bash tool',
    description: 'You always approve the Bash tool',
    evidence: {
      count: 20,
      sessions: 5,
      examples: ['Bash(npm test)', 'Bash(git status)', 'Bash(ls)'],
    },
    suggested_action: 'Add Bash to allowedTools in settings.json',
    ...overrides,
  };
}

describe('auto-apply', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), 'he-auto-apply-'));
    settingsDir = join(tempDir, '.claude');
    settingsPath = join(settingsDir, 'settings.json');
    await mkdir(join(tempDir, 'analysis', 'backups'), { recursive: true });
    await mkdir(settingsDir, { recursive: true });
    mockUpdateStatus.mockResolvedValue(undefined);
    mockGetStatusMap.mockResolvedValue(new Map());
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns empty array when config.delivery.fullAuto is false', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(false));
    const recs = [makeRecommendation()];

    const results = await autoApplyRecommendations(recs);

    expect(results).toEqual([]);
    expect(mockGetStatusMap).not.toHaveBeenCalled();
  });

  it('only processes HIGH confidence + SETTINGS target recommendations when fullAuto=true', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(true));
    mockGetStatusMap.mockResolvedValue(new Map());

    // Write settings.json for the one that qualifies
    await writeFile(settingsPath, JSON.stringify({ allowedTools: [] }));

    const recs = [
      makeRecommendation({ id: 'rec-high-settings', target: 'SETTINGS', confidence: 'HIGH' }),
      makeRecommendation({ id: 'rec-med-settings', target: 'SETTINGS', confidence: 'MEDIUM' }),
      makeRecommendation({ id: 'rec-low-settings', target: 'SETTINGS', confidence: 'LOW' }),
      makeRecommendation({ id: 'rec-high-hook', target: 'HOOK', confidence: 'HIGH' }),
    ];

    const results = await autoApplyRecommendations(recs, { settingsPath });

    // Only the HIGH+SETTINGS recommendation should be processed
    expect(results).toHaveLength(1);
    expect(results[0].recommendation_id).toBe('rec-high-settings');
  });

  it('skips MEDIUM and LOW confidence recommendations even when fullAuto=true', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(true));
    mockGetStatusMap.mockResolvedValue(new Map());

    const recs = [
      makeRecommendation({ id: 'rec-med', confidence: 'MEDIUM', target: 'SETTINGS' }),
      makeRecommendation({ id: 'rec-low', confidence: 'LOW', target: 'SETTINGS' }),
    ];

    const results = await autoApplyRecommendations(recs, { settingsPath });

    expect(results).toEqual([]);
  });

  it('skips HIGH confidence targets without a registered applier', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(true));
    mockGetStatusMap.mockResolvedValue(new Map());

    // HOOK, SKILL, CLAUDE_MD, MEMORY have no registered applier yet
    const targets = ['HOOK', 'SKILL', 'CLAUDE_MD', 'MEMORY'] as const;
    const recs = targets.map((target, i) =>
      makeRecommendation({ id: `rec-${i}`, target, confidence: 'HIGH' }),
    );

    const results = await autoApplyRecommendations(recs, { settingsPath });

    expect(results).toEqual([]);
  });

  it('appends tool to allowedTools for permission-always-approved pattern', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(true));
    mockGetStatusMap.mockResolvedValue(new Map());

    const initialSettings = { allowedTools: ['Read'] };
    await writeFile(settingsPath, JSON.stringify(initialSettings));

    const rec = makeRecommendation({
      id: 'rec-bash',
      pattern_type: 'permission-always-approved',
      evidence: {
        count: 20,
        sessions: 5,
        examples: ['Bash(npm test)', 'Bash(git status)'],
      },
    });

    const results = await autoApplyRecommendations([rec], { settingsPath });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);

    // Verify settings were modified
    const updatedSettings = JSON.parse(await readFile(settingsPath, 'utf-8'));
    expect(updatedSettings.allowedTools).toContain('Bash');
    expect(updatedSettings.allowedTools).toContain('Read');
  });

  it('writes log entry to autoApplyLog with required fields on success', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(true));
    mockGetStatusMap.mockResolvedValue(new Map());

    await writeFile(settingsPath, JSON.stringify({ allowedTools: [] }));

    const rec = makeRecommendation({ id: 'rec-log-test' });
    await autoApplyRecommendations([rec], { settingsPath });

    const logContent = await readFile(
      join(tempDir, 'analysis', 'auto-apply-log.jsonl'),
      'utf-8',
    );
    const logEntry = JSON.parse(logContent.trim());

    expect(logEntry.timestamp).toBeDefined();
    expect(logEntry.recommendation_id).toBe('rec-log-test');
    expect(logEntry.target).toBe('SETTINGS');
    expect(logEntry.action).toBeDefined();
    expect(logEntry.success).toBe(true);
  });

  it('writes log entry with success=false when settings file is unreadable', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(true));
    mockGetStatusMap.mockResolvedValue(new Map());

    // Use a path that does not exist
    const badPath = join(tempDir, 'nonexistent', 'settings.json');

    const rec = makeRecommendation({ id: 'rec-fail' });
    const results = await autoApplyRecommendations([rec], { settingsPath: badPath });

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].details).toBeDefined();

    const logContent = await readFile(
      join(tempDir, 'analysis', 'auto-apply-log.jsonl'),
      'utf-8',
    );
    const logEntry = JSON.parse(logContent.trim());
    expect(logEntry.success).toBe(false);
    expect(logEntry.details).toBeDefined();
  });

  it('creates backup of settings.json before modification', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(true));
    mockGetStatusMap.mockResolvedValue(new Map());

    const originalSettings = { allowedTools: ['Read'], someKey: 'value' };
    await writeFile(settingsPath, JSON.stringify(originalSettings));

    const rec = makeRecommendation({ id: 'rec-backup' });
    await autoApplyRecommendations([rec], { settingsPath });

    // Check backup file exists
    const backupPath = join(
      tempDir,
      'analysis',
      'backups',
      'settings-backup-rec-backup.json',
    );
    const backupContent = JSON.parse(await readFile(backupPath, 'utf-8'));
    expect(backupContent).toEqual(originalSettings);
  });

  it('calls updateStatus with applied after successful auto-apply', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(true));
    mockGetStatusMap.mockResolvedValue(new Map());

    await writeFile(settingsPath, JSON.stringify({ allowedTools: [] }));

    const rec = makeRecommendation({ id: 'rec-status' });
    await autoApplyRecommendations([rec], { settingsPath });

    expect(mockUpdateStatus).toHaveBeenCalledWith(
      'rec-status',
      'applied',
      expect.stringContaining('Auto-applied'),
    );
  });

  it('skips recommendations already applied or dismissed', async () => {
    mockLoadConfig.mockResolvedValue(makeConfig(true));
    mockGetStatusMap.mockResolvedValue(
      new Map([
        ['rec-applied', 'applied'],
        ['rec-dismissed', 'dismissed'],
        ['rec-pending', 'pending'],
      ]),
    );

    await writeFile(settingsPath, JSON.stringify({ allowedTools: [] }));

    const recs = [
      makeRecommendation({ id: 'rec-applied' }),
      makeRecommendation({ id: 'rec-dismissed' }),
      makeRecommendation({ id: 'rec-pending' }),
    ];

    const results = await autoApplyRecommendations(recs, { settingsPath });

    // Only the pending one should be processed
    expect(results).toHaveLength(1);
    expect(results[0].recommendation_id).toBe('rec-pending');
  });

  // --- RULE Applier Tests ---

  describe('RULE applier', () => {
    let rulesDir: string;

    beforeEach(async () => {
      rulesDir = join(tempDir, '.claude', 'rules');
    });

    it('creates rule file for HIGH-confidence RULE recommendation', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig(true));
      mockGetStatusMap.mockResolvedValue(new Map());

      const rec = makeRecommendation({
        id: 'rec-rule-create',
        target: 'RULE',
        confidence: 'HIGH',
        pattern_type: 'code_correction',
        title: 'Reduce code correction cycles',
        description: 'High Write/Edit usage detected',
        suggested_action: 'Create a coding conventions rule',
      });

      const results = await autoApplyRecommendations([rec], {
        settingsPath,
        rulesDir,
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].details).toContain('Created rule file');

      // Verify the file was actually created
      const filePath = join(rulesDir, 'evolve-code_correction.md');
      const content = await readFile(filePath, 'utf-8');
      expect(content).toContain('# Reduce code correction cycles');
      expect(content).toContain('High Write/Edit usage detected');
      expect(content).toContain('Create a coding conventions rule');
    });

    it('rule file content includes title as heading, description, and suggested_action', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig(true));
      mockGetStatusMap.mockResolvedValue(new Map());

      const rec = makeRecommendation({
        id: 'rec-rule-content',
        target: 'RULE',
        confidence: 'HIGH',
        pattern_type: 'repeated_prompt',
        title: 'Automate repeated prompts',
        description: 'Same prompt typed 15 times',
        suggested_action: 'Create a skill for this workflow',
      });

      await autoApplyRecommendations([rec], { settingsPath, rulesDir });

      const filePath = join(rulesDir, 'evolve-repeated_prompt.md');
      const content = await readFile(filePath, 'utf-8');

      // Title as markdown heading
      expect(content).toMatch(/^# Automate repeated prompts$/m);
      // Description in body
      expect(content).toContain('Same prompt typed 15 times');
      // Action section
      expect(content).toContain('## Action');
      expect(content).toContain('Create a skill for this workflow');
      // Auto-generated footer
      expect(content).toContain('Auto-generated by harness-evolve');
    });

    it('returns success=false and does NOT overwrite when rule file already exists', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig(true));
      mockGetStatusMap.mockResolvedValue(new Map());

      // Pre-create the rule file
      await mkdir(rulesDir, { recursive: true });
      const existingContent = '# Existing rule - do not overwrite';
      await writeFile(
        join(rulesDir, 'evolve-code_correction.md'),
        existingContent,
      );

      const rec = makeRecommendation({
        id: 'rec-rule-nooverwrite',
        target: 'RULE',
        confidence: 'HIGH',
        pattern_type: 'code_correction',
        title: 'New title',
        description: 'New description',
        suggested_action: 'New action',
      });

      const results = await autoApplyRecommendations([rec], {
        settingsPath,
        rulesDir,
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].details).toContain('already exists');

      // Verify original content was NOT changed
      const content = await readFile(
        join(rulesDir, 'evolve-code_correction.md'),
        'utf-8',
      );
      expect(content).toBe(existingContent);
    });

    it('dispatches SETTINGS rec to SettingsApplier (existing behavior preserved)', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig(true));
      mockGetStatusMap.mockResolvedValue(new Map());

      await writeFile(settingsPath, JSON.stringify({ allowedTools: [] }));

      const rec = makeRecommendation({
        id: 'rec-settings-dispatch',
        target: 'SETTINGS',
        confidence: 'HIGH',
        pattern_type: 'permission-always-approved',
      });

      const results = await autoApplyRecommendations([rec], { settingsPath });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].details).toContain('allowedTools');
    });

    it('dispatches RULE rec to RuleApplier', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig(true));
      mockGetStatusMap.mockResolvedValue(new Map());

      const rec = makeRecommendation({
        id: 'rec-rule-dispatch',
        target: 'RULE',
        confidence: 'HIGH',
        pattern_type: 'long_prompt',
        title: 'Create skill for long prompts',
        description: 'Detected prompts over 200 words',
        suggested_action: 'Create a .claude/rules/long-prompts.md',
      });

      const results = await autoApplyRecommendations([rec], {
        settingsPath,
        rulesDir,
      });

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].details).toContain('Created rule file');
    });

    it('logs RULE auto-apply to auto-apply-log.jsonl with target RULE', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig(true));
      mockGetStatusMap.mockResolvedValue(new Map());

      const rec = makeRecommendation({
        id: 'rec-rule-log',
        target: 'RULE',
        confidence: 'HIGH',
        pattern_type: 'config_drift',
        title: 'Fix config drift',
        description: 'Settings inconsistency detected',
        suggested_action: 'Add drift detection rule',
      });

      await autoApplyRecommendations([rec], { settingsPath, rulesDir });

      const logContent = await readFile(
        join(tempDir, 'analysis', 'auto-apply-log.jsonl'),
        'utf-8',
      );
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry.target).toBe('RULE');
      expect(logEntry.recommendation_id).toBe('rec-rule-log');
      expect(logEntry.success).toBe(true);
    });

    it('skips HIGH confidence HOOK/SKILL/CLAUDE_MD/MEMORY targets (no applier)', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig(true));
      mockGetStatusMap.mockResolvedValue(new Map());

      const targets = ['HOOK', 'SKILL', 'CLAUDE_MD', 'MEMORY'] as const;
      const recs = targets.map((target, i) =>
        makeRecommendation({ id: `rec-skip-${i}`, target, confidence: 'HIGH' }),
      );

      const results = await autoApplyRecommendations(recs, { settingsPath });

      // None of these targets have appliers yet
      expect(results).toEqual([]);
    });
  });
});
