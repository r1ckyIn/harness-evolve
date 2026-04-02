// Unit tests for the threshold trigger mechanism.
// Tests: config gating, threshold comparison, cooldown logic,
// counter reset on success, counter preservation on failure,
// writeAnalysisResult file output, and runAnalysis pipeline orchestration.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Counter } from '../../../src/schemas/counter.js';
import type { Config } from '../../../src/schemas/config.js';
import type { AnalysisResult } from '../../../src/schemas/recommendation.js';

// --- Mock setup ---

const mockReadCounter = vi.fn<() => Promise<Counter>>();
const mockResetCounter = vi.fn<() => Promise<void>>();
const mockLoadConfig = vi.fn<() => Promise<Config>>();
const mockPreProcess = vi.fn();
const mockScanEnvironment = vi.fn();
const mockAnalyze = vi.fn();
const mockWriteFileAtomic = vi.fn();
const mockLock = vi.fn();
const mockReadFile = vi.fn();
const mockTrackOutcomes = vi.fn();
const mockLoadOutcomeHistory = vi.fn();
const mockComputeOutcomeSummaries = vi.fn();

vi.mock('../../../src/storage/counter.js', () => ({
  readCounter: (...args: unknown[]) => mockReadCounter(...args),
  resetCounter: (...args: unknown[]) => mockResetCounter(...args),
}));

vi.mock('../../../src/storage/config.js', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

vi.mock('../../../src/analysis/pre-processor.js', () => ({
  preProcess: (...args: unknown[]) => mockPreProcess(...args),
}));

vi.mock('../../../src/analysis/environment-scanner.js', () => ({
  scanEnvironment: (...args: unknown[]) => mockScanEnvironment(...args),
}));

vi.mock('../../../src/analysis/analyzer.js', () => ({
  analyze: (...args: unknown[]) => mockAnalyze(...args),
}));

vi.mock('../../../src/analysis/outcome-tracker.js', () => ({
  trackOutcomes: (...args: unknown[]) => mockTrackOutcomes(...args),
  loadOutcomeHistory: (...args: unknown[]) => mockLoadOutcomeHistory(...args),
  computeOutcomeSummaries: (...args: unknown[]) => mockComputeOutcomeSummaries(...args),
}));

vi.mock('write-file-atomic', () => ({
  default: (...args: unknown[]) => mockWriteFileAtomic(...args),
}));

vi.mock('proper-lockfile', () => ({
  lock: (...args: unknown[]) => mockLock(...args),
}));

vi.mock('node:fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/storage/dirs.js', () => ({
  paths: {
    base: '/mock/.harness-evolve',
    analysis: '/mock/.harness-evolve/analysis',
    analysisResult: '/mock/.harness-evolve/analysis/analysis-result.json',
    counter: '/mock/.harness-evolve/counter.json',
  },
  ensureInit: vi.fn().mockResolvedValue(undefined),
}));

// Import after mocks
const { checkAndTriggerAnalysis, runAnalysis, writeAnalysisResult } =
  await import('../../../src/analysis/trigger.js');

// --- Test data factories ---

function makeConfig(overrides?: Partial<Config['analysis']>): Config {
  return {
    version: 1,
    analysis: {
      threshold: 50,
      enabled: true,
      classifierThresholds: {},
      ...overrides,
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
    },
  };
}

function makeCounter(overrides?: Partial<Counter>): Counter {
  return {
    total: 0,
    session: {},
    last_updated: new Date().toISOString(),
    ...overrides,
  };
}

function makeMockResult(): AnalysisResult {
  return {
    generated_at: new Date().toISOString(),
    summary_period: {
      since: '2026-03-01',
      until: '2026-03-31',
      days: 30,
    },
    recommendations: [],
    metadata: {
      classifier_count: 7,
      patterns_evaluated: 0,
      environment_ecosystems: [],
      claude_code_version: '2.1.0',
    },
  };
}

describe('trigger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock setups
    mockWriteFileAtomic.mockResolvedValue(undefined);
    mockResetCounter.mockResolvedValue(undefined);

    // Outcome tracker defaults (empty history, no summaries)
    mockTrackOutcomes.mockResolvedValue([]);
    mockLoadOutcomeHistory.mockResolvedValue([]);
    mockComputeOutcomeSummaries.mockReturnValue([]);

    // Lock mock returns a release function
    const mockRelease = vi.fn().mockResolvedValue(undefined);
    mockLock.mockResolvedValue(mockRelease);
  });

  describe('checkAndTriggerAnalysis', () => {
    it('returns false when analysis is disabled', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig({ enabled: false }));

      const result = await checkAndTriggerAnalysis('/test/cwd');

      expect(result).toBe(false);
      expect(mockReadCounter).not.toHaveBeenCalled();
    });

    it('returns false when counter.total < threshold', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig({ threshold: 50 }));
      mockReadCounter.mockResolvedValue(makeCounter({ total: 49 }));

      const result = await checkAndTriggerAnalysis('/test/cwd');

      expect(result).toBe(false);
      expect(mockPreProcess).not.toHaveBeenCalled();
    });

    it('returns true and triggers analysis when counter.total >= threshold', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig({ threshold: 50 }));
      mockReadCounter.mockResolvedValue(makeCounter({ total: 50 }));
      mockPreProcess.mockResolvedValue({});
      mockScanEnvironment.mockResolvedValue({});
      mockAnalyze.mockReturnValue(makeMockResult());
      mockReadFile.mockResolvedValue(JSON.stringify(makeCounter({ total: 50 })));

      const result = await checkAndTriggerAnalysis('/test/cwd');

      expect(result).toBe(true);
      expect(mockPreProcess).toHaveBeenCalled();
      expect(mockScanEnvironment).toHaveBeenCalledWith('/test/cwd');
      expect(mockAnalyze).toHaveBeenCalled();
    });

    it('returns false when last_analysis is within cooldown period', async () => {
      const recentTimestamp = new Date(Date.now() - 30_000).toISOString(); // 30s ago
      mockLoadConfig.mockResolvedValue(makeConfig({ threshold: 50 }));
      mockReadCounter.mockResolvedValue(
        makeCounter({ total: 50, last_analysis: recentTimestamp }),
      );

      const result = await checkAndTriggerAnalysis('/test/cwd');

      expect(result).toBe(false);
      expect(mockPreProcess).not.toHaveBeenCalled();
    });

    it('returns true when last_analysis is older than cooldown period', async () => {
      const oldTimestamp = new Date(Date.now() - 120_000).toISOString(); // 2 min ago
      mockLoadConfig.mockResolvedValue(makeConfig({ threshold: 50 }));
      mockReadCounter.mockResolvedValue(
        makeCounter({ total: 50, last_analysis: oldTimestamp }),
      );
      mockPreProcess.mockResolvedValue({});
      mockScanEnvironment.mockResolvedValue({});
      mockAnalyze.mockReturnValue(makeMockResult());
      mockReadFile.mockResolvedValue(
        JSON.stringify(makeCounter({ total: 50, last_analysis: oldTimestamp })),
      );

      const result = await checkAndTriggerAnalysis('/test/cwd');

      expect(result).toBe(true);
      expect(mockPreProcess).toHaveBeenCalled();
    });

    it('resets counter after successful analysis', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig({ threshold: 50 }));
      mockReadCounter.mockResolvedValue(makeCounter({ total: 55 }));
      mockPreProcess.mockResolvedValue({});
      mockScanEnvironment.mockResolvedValue({});
      mockAnalyze.mockReturnValue(makeMockResult());
      mockReadFile.mockResolvedValue(JSON.stringify(makeCounter({ total: 55 })));

      await checkAndTriggerAnalysis('/test/cwd');

      // Verify counter was reset via atomic write (lock -> read -> write with total=0)
      expect(mockLock).toHaveBeenCalled();
      const writeCall = mockWriteFileAtomic.mock.calls.find(
        (call) => typeof call[0] === 'string' && (call[0] as string).includes('counter'),
      );
      expect(writeCall).toBeDefined();
      const writtenData = JSON.parse(writeCall![1] as string) as Counter;
      expect(writtenData.total).toBe(0);
      expect(writtenData.session).toEqual({});
      expect(writtenData.last_analysis).toBeDefined();
    });

    it('does NOT reset counter when runAnalysis fails', async () => {
      mockLoadConfig.mockResolvedValue(makeConfig({ threshold: 50 }));
      mockReadCounter.mockResolvedValue(makeCounter({ total: 55 }));
      mockPreProcess.mockRejectedValue(new Error('Pre-process failed'));

      const result = await checkAndTriggerAnalysis('/test/cwd');

      expect(result).toBe(false);
      // Lock for counter reset should NOT have been called
      expect(mockLock).not.toHaveBeenCalled();
    });
  });

  describe('writeAnalysisResult', () => {
    it('writes valid JSON to the analysis-result path', async () => {
      const mockResult = makeMockResult();

      await writeAnalysisResult(mockResult);

      expect(mockWriteFileAtomic).toHaveBeenCalledWith(
        '/mock/.harness-evolve/analysis/analysis-result.json',
        JSON.stringify(mockResult, null, 2),
      );
    });
  });

  describe('runAnalysis', () => {
    it('calls preProcess, scanEnvironment, analyze in sequence and writes result', async () => {
      const mockSummary = { period: { since: '2026-03-01', until: '2026-03-31', days: 30 } };
      const mockSnapshot = { detected_ecosystems: [] };
      const mockResult = makeMockResult();

      mockPreProcess.mockResolvedValue(mockSummary);
      mockScanEnvironment.mockResolvedValue(mockSnapshot);
      mockAnalyze.mockReturnValue(mockResult);

      const result = await runAnalysis('/test/cwd');

      // Verify call order
      expect(mockPreProcess).toHaveBeenCalled();
      expect(mockScanEnvironment).toHaveBeenCalledWith('/test/cwd');
      // analyze() now receives outcomeSummaries from outcome tracker (empty array when no history)
      expect(mockAnalyze).toHaveBeenCalledWith(mockSummary, mockSnapshot, undefined, []);

      // Verify result was written
      expect(mockWriteFileAtomic).toHaveBeenCalledWith(
        '/mock/.harness-evolve/analysis/analysis-result.json',
        JSON.stringify(mockResult, null, 2),
      );

      // Verify returned result
      expect(result).toEqual(mockResult);
    });
  });
});
