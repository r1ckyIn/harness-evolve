// Unit tests for the analyzer orchestrator.
// Verifies: empty summary, schema validation, classifier iteration,
// confidence sorting, recommendation cap, default config, and
// confidence adjustment based on outcome summaries.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { analysisResultSchema } from '../../../src/schemas/recommendation.js';
import { analysisConfigSchema } from '../../../src/schemas/recommendation.js';
import { analyze, adjustConfidence } from '../../../src/analysis/analyzer.js';
import { classifiers } from '../../../src/analysis/classifiers/index.js';
import type { Classifier } from '../../../src/analysis/classifiers/index.js';
import type { Recommendation } from '../../../src/schemas/recommendation.js';
import type { OutcomeSummary } from '../../../src/schemas/onboarding.js';
import { makeEmptySummary, makeEmptySnapshot } from './helpers.js';

describe('analyze', () => {
  // Track original classifiers length to restore after mock tests
  let originalLength: number;

  beforeEach(() => {
    originalLength = classifiers.length;
  });

  afterEach(() => {
    // Restore classifiers array to original state
    classifiers.length = originalLength;
  });

  it('returns AnalysisResult with onboarding recommendations for empty summary (newcomer)', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();

    const result = analyze(summary, snapshot);

    // Empty snapshot triggers onboarding classifier: 3 newcomer "start here" recs
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations.every(r => r.pattern_type.startsWith('onboarding_start'))).toBe(true);
    expect(result.summary_period).toEqual(summary.period);
    expect(result.metadata.classifier_count).toBe(classifiers.length);
  });

  it('returns AnalysisResult that validates against analysisResultSchema', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();

    const result = analyze(summary, snapshot);

    // Should not throw
    const parsed = analysisResultSchema.parse(result);
    expect(parsed.generated_at).toBeDefined();
    expect(parsed.recommendations).toBeInstanceOf(Array);
    expect(parsed.metadata).toBeDefined();
  });

  it('iterates all registered classifiers and collects results', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();

    // Push a mock classifier that returns one recommendation
    const mockClassifier: Classifier = (_s, _sn, _c) => [
      {
        id: 'mock-rec-1',
        target: 'HOOK',
        confidence: 'HIGH',
        pattern_type: 'repeated_prompt',
        title: 'Mock recommendation',
        description: 'A mock recommendation for testing',
        evidence: { count: 10, sessions: 3, examples: ['test'] },
        suggested_action: 'Do something',
      },
    ];

    classifiers.push(mockClassifier);

    const result = analyze(summary, snapshot);

    // 3 onboarding newcomer recs + 1 mock rec = 4 total
    // HIGH sorted first, then MEDIUM onboarding recs
    const mockRec = result.recommendations.find(r => r.id === 'mock-rec-1');
    expect(mockRec).toBeDefined();
    expect(result.recommendations[0].id).toBe('mock-rec-1'); // HIGH sorts first
    expect(result.metadata.classifier_count).toBe(originalLength + 1);
  });

  it('sorts recommendations by confidence: HIGH first, then MEDIUM, then LOW', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();

    // Push a classifier that returns mixed-confidence results
    const mixedClassifier: Classifier = () => [
      {
        id: 'low-1',
        target: 'MEMORY',
        confidence: 'LOW',
        pattern_type: 'repeated_prompt',
        title: 'Low rec',
        description: 'Low confidence',
        evidence: { count: 3, examples: ['a'] },
        suggested_action: 'Do low',
      },
      {
        id: 'high-1',
        target: 'HOOK',
        confidence: 'HIGH',
        pattern_type: 'repeated_prompt',
        title: 'High rec',
        description: 'High confidence',
        evidence: { count: 20, examples: ['b'] },
        suggested_action: 'Do high',
      },
      {
        id: 'medium-1',
        target: 'SKILL',
        confidence: 'MEDIUM',
        pattern_type: 'repeated_prompt',
        title: 'Medium rec',
        description: 'Medium confidence',
        evidence: { count: 8, examples: ['c'] },
        suggested_action: 'Do medium',
      },
    ];

    classifiers.push(mixedClassifier);

    const result = analyze(summary, snapshot);

    // Sorted: HIGH first, then MEDIUM (onboarding + mixed), then LOW
    expect(result.recommendations[0].confidence).toBe('HIGH');
    // All MEDIUM recs come next (3 onboarding + 1 mixed)
    const lastRec = result.recommendations[result.recommendations.length - 1];
    expect(lastRec.confidence).toBe('LOW');
  });

  it('caps recommendations at max_recommendations (default 20)', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();

    // Push a classifier that returns 25 recommendations
    const bulkClassifier: Classifier = () =>
      Array.from({ length: 25 }, (_, i) => ({
        id: `bulk-${i}`,
        target: 'HOOK' as const,
        confidence: 'MEDIUM' as const,
        pattern_type: 'repeated_prompt',
        title: `Bulk ${i}`,
        description: `Bulk recommendation ${i}`,
        evidence: { count: 5, examples: [`example-${i}`] },
        suggested_action: `Action ${i}`,
      }));

    classifiers.push(bulkClassifier);

    const result = analyze(summary, snapshot);

    expect(result.recommendations.length).toBeLessThanOrEqual(20);
  });

  it('applies AnalysisConfig defaults when config argument omitted', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();

    // Should not throw -- defaults applied internally
    const result = analyze(summary, snapshot);

    expect(result).toBeDefined();
    expect(result.metadata).toBeDefined();
  });

  it('respects custom max_recommendations from config', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();

    const bulkClassifier: Classifier = () =>
      Array.from({ length: 15 }, (_, i) => ({
        id: `bulk-${i}`,
        target: 'HOOK' as const,
        confidence: 'MEDIUM' as const,
        pattern_type: 'repeated_prompt',
        title: `Bulk ${i}`,
        description: `Bulk recommendation ${i}`,
        evidence: { count: 5, examples: [`example-${i}`] },
        suggested_action: `Action ${i}`,
      }));

    classifiers.push(bulkClassifier);

    const customConfig = analysisConfigSchema.parse({ max_recommendations: 5 });
    const result = analyze(summary, snapshot, customConfig);

    expect(result.recommendations.length).toBeLessThanOrEqual(5);
  });
});

describe('adjustConfidence', () => {
  const makeRec = (overrides: Partial<Recommendation>): Recommendation => ({
    id: 'rec-test-0',
    target: 'HOOK',
    confidence: 'HIGH',
    pattern_type: 'repeated_prompt',
    title: 'Test recommendation',
    description: 'For testing',
    evidence: { count: 10, examples: ['test'] },
    suggested_action: 'Do something',
    ...overrides,
  });

  it('downgrades HIGH to MEDIUM when persistence_rate < 0.7', () => {
    const recs = [makeRec({ confidence: 'HIGH', pattern_type: 'repeated_prompt' })];
    const summaries: OutcomeSummary[] = [
      { pattern_type: 'repeated_prompt', total_applied: 10, total_persisted: 5, total_reverted: 5, persistence_rate: 0.5 },
    ];

    const adjusted = adjustConfidence(recs, summaries);

    expect(adjusted[0].confidence).toBe('MEDIUM');
  });

  it('downgrades MEDIUM to LOW when persistence_rate < 0.7', () => {
    const recs = [makeRec({ confidence: 'MEDIUM', pattern_type: 'repeated_prompt' })];
    const summaries: OutcomeSummary[] = [
      { pattern_type: 'repeated_prompt', total_applied: 10, total_persisted: 3, total_reverted: 7, persistence_rate: 0.3 },
    ];

    const adjusted = adjustConfidence(recs, summaries);

    expect(adjusted[0].confidence).toBe('LOW');
  });

  it('keeps LOW as LOW (cannot downgrade further)', () => {
    const recs = [makeRec({ confidence: 'LOW', pattern_type: 'repeated_prompt' })];
    const summaries: OutcomeSummary[] = [
      { pattern_type: 'repeated_prompt', total_applied: 10, total_persisted: 1, total_reverted: 9, persistence_rate: 0.1 },
    ];

    const adjusted = adjustConfidence(recs, summaries);

    expect(adjusted[0].confidence).toBe('LOW');
  });

  it('does not modify confidence when persistence_rate >= 0.7', () => {
    const recs = [makeRec({ confidence: 'HIGH', pattern_type: 'repeated_prompt' })];
    const summaries: OutcomeSummary[] = [
      { pattern_type: 'repeated_prompt', total_applied: 10, total_persisted: 8, total_reverted: 2, persistence_rate: 0.8 },
    ];

    const adjusted = adjustConfidence(recs, summaries);

    expect(adjusted[0].confidence).toBe('HIGH');
  });

  it('does not modify confidence for pattern_types not in summaries', () => {
    const recs = [makeRec({ confidence: 'HIGH', pattern_type: 'long_prompt' })];
    const summaries: OutcomeSummary[] = [
      { pattern_type: 'repeated_prompt', total_applied: 10, total_persisted: 3, total_reverted: 7, persistence_rate: 0.3 },
    ];

    const adjusted = adjustConfidence(recs, summaries);

    expect(adjusted[0].confidence).toBe('HIGH');
  });
});

describe('analyze with outcomeSummaries', () => {
  let originalLength: number;

  beforeEach(() => {
    originalLength = classifiers.length;
  });

  afterEach(() => {
    classifiers.length = originalLength;
  });

  it('works with no outcome summaries (backward compatible)', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();

    // No outcomeSummaries parameter -- should work exactly as before
    const result = analyze(summary, snapshot);

    expect(result).toBeDefined();
    expect(result.recommendations).toHaveLength(3); // 3 newcomer recs
  });

  it('applies confidence adjustment when outcomeSummaries provided', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();

    // Onboarding recs are MEDIUM; downgrade them via outcome summaries
    const summaries: OutcomeSummary[] = [
      { pattern_type: 'onboarding_start_hooks', total_applied: 5, total_persisted: 1, total_reverted: 4, persistence_rate: 0.2 },
    ];

    const result = analyze(summary, snapshot, undefined, summaries);

    // The onboarding_start_hooks rec should be downgraded from MEDIUM to LOW
    const hooksRec = result.recommendations.find(r => r.pattern_type === 'onboarding_start_hooks');
    expect(hooksRec).toBeDefined();
    expect(hooksRec!.confidence).toBe('LOW');
  });
});
