// Unit tests for scan orchestrator (runDeepScan).
// Validates that runDeepScan builds context, runs all scanners, merges
// recommendations, handles errors gracefully, and returns a valid ScanResult.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { recommendationSchema } from '../../../src/schemas/recommendation.js';

// Mock the context-builder module
vi.mock('../../../src/scan/context-builder.js', () => ({
  buildScanContext: vi.fn(),
}));

// Mock the scanners module
vi.mock('../../../src/scan/scanners/index.js', () => ({
  scanners: [] as Array<(ctx: unknown) => unknown>,
}));

import { runDeepScan, type ScanResult } from '../../../src/scan/index.js';
import { buildScanContext } from '../../../src/scan/context-builder.js';
import { scanners } from '../../../src/scan/scanners/index.js';
import type { ScanContext } from '../../../src/scan/schemas.js';
import type { Recommendation } from '../../../src/schemas/recommendation.js';

// Minimal valid ScanContext fixture
const fakeScanContext: ScanContext = {
  generated_at: new Date().toISOString(),
  project_root: '/fake/project',
  claude_md_files: [],
  rules: [],
  settings: { user: null, project: null, local: null },
  commands: [],
  hooks_registered: [],
};

// Helper: create a valid recommendation
function makeRec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'test-rec-1',
    target: 'RULE',
    confidence: 'MEDIUM',
    pattern_type: 'scan_redundancy',
    title: 'Test recommendation',
    description: 'Test description',
    evidence: { count: 1, examples: ['example'] },
    suggested_action: 'Do something',
    ...overrides,
  };
}

let originalError: typeof console.error;
let capturedErrors: string[];

beforeEach(() => {
  vi.clearAllMocks();
  // Reset scanners array for each test
  scanners.length = 0;
  // Mock buildScanContext to return our fixture
  vi.mocked(buildScanContext).mockResolvedValue(fakeScanContext);
  // Capture console.error
  capturedErrors = [];
  originalError = console.error;
  console.error = (...args: unknown[]) =>
    capturedErrors.push(args.join(' '));
});

afterEach(() => {
  console.error = originalError;
});

describe('runDeepScan', () => {
  it('returns ScanResult with recommendations array and scan_context', async () => {
    const result = await runDeepScan('/fake/project');

    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('scan_context');
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(result.scan_context).toEqual(fakeScanContext);
  });

  it('calls buildScanContext with provided cwd', async () => {
    await runDeepScan('/my/project');

    expect(buildScanContext).toHaveBeenCalledWith('/my/project', undefined);
  });

  it('runs all scanners from registry and merges results', async () => {
    const rec1 = makeRec({ id: 'rec-1', title: 'Rec 1' });
    const rec2 = makeRec({ id: 'rec-2', title: 'Rec 2' });

    scanners.push(() => [rec1]);
    scanners.push(() => [rec2]);

    const result = await runDeepScan('/fake/project');

    expect(result.recommendations).toHaveLength(2);
    expect(result.recommendations[0].id).toBe('rec-1');
    expect(result.recommendations[1].id).toBe('rec-2');
  });

  it('handles scanner errors gracefully -- one throwing does not block others', async () => {
    const goodRec = makeRec({ id: 'good-rec', title: 'Good result' });

    scanners.push(() => {
      throw new Error('Scanner A failed');
    });
    scanners.push(() => [goodRec]);

    const result = await runDeepScan('/fake/project');

    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].id).toBe('good-rec');
    expect(capturedErrors.some((e) => e.includes('Scanner A failed'))).toBe(
      true,
    );
  });

  it('returns empty recommendations when no issues found', async () => {
    scanners.push(() => []);
    scanners.push(() => []);

    const result = await runDeepScan('/fake/project');

    expect(result.recommendations).toEqual([]);
  });

  it('all recommendations in result pass recommendationSchema.parse() validation', async () => {
    const rec1 = makeRec({ id: 'valid-1' });
    const rec2 = makeRec({
      id: 'valid-2',
      pattern_type: 'scan_stale_reference',
    });

    scanners.push(() => [rec1, rec2]);

    const result = await runDeepScan('/fake/project');

    for (const rec of result.recommendations) {
      expect(() => recommendationSchema.parse(rec)).not.toThrow();
    }
  });

  it('includes generated_at timestamp in ScanResult', async () => {
    const before = new Date().toISOString();
    const result = await runDeepScan('/fake/project');
    const after = new Date().toISOString();

    expect(result.generated_at).toBeDefined();
    expect(typeof result.generated_at).toBe('string');
    // Timestamp should be between before and after
    expect(result.generated_at >= before).toBe(true);
    expect(result.generated_at <= after).toBe(true);
  });

  it('passes home parameter through to buildScanContext when provided', async () => {
    await runDeepScan('/my/project', '/custom/home');

    expect(buildScanContext).toHaveBeenCalledWith(
      '/my/project',
      '/custom/home',
    );
  });
});
