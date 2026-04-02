// Unit tests for the long prompts classifier.
// Verifies: HIGH/MEDIUM confidence, threshold gating on both word count and
// repetition count, and empty input.

import { describe, it, expect } from 'vitest';
import { classifyLongPrompts } from '../../../../src/analysis/classifiers/long-prompts.js';
import { makeEmptySummary, makeEmptySnapshot, makeDefaultConfig } from '../helpers.js';

describe('classifyLongPrompts', () => {
  it('returns SKILL with HIGH confidence for 300-word prompt repeated 3 times', () => {
    const summary = makeEmptySummary();
    summary.long_prompts = [
      { prompt_preview: 'A very long prompt preview...', length: 300, count: 3 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyLongPrompts(summary, snapshot, config);

    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('SKILL');
    expect(results[0].confidence).toBe('HIGH');
    expect(results[0].pattern_type).toBe('long_prompt');
    expect(results[0].evidence.count).toBe(3);
  });

  it('returns SKILL with MEDIUM confidence for 200-word prompt repeated 2 times', () => {
    const summary = makeEmptySummary();
    summary.long_prompts = [
      { prompt_preview: 'A moderately long prompt...', length: 200, count: 2 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyLongPrompts(summary, snapshot, config);

    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('SKILL');
    expect(results[0].confidence).toBe('MEDIUM');
  });

  it('returns no recommendation for 150-word prompt (below 200 threshold)', () => {
    const summary = makeEmptySummary();
    summary.long_prompts = [
      { prompt_preview: 'Short-ish prompt...', length: 150, count: 5 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyLongPrompts(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('returns no recommendation for 250-word prompt with count=1 (below count threshold)', () => {
    const summary = makeEmptySummary();
    summary.long_prompts = [
      { prompt_preview: 'Long but once...', length: 250, count: 1 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyLongPrompts(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('returns empty array for empty long_prompts', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyLongPrompts(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });
});
