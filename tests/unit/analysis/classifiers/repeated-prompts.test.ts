// Unit tests for the repeated short prompts classifier.
// Verifies: HIGH/MEDIUM confidence, threshold gating, word count filtering,
// multiple prompts, and empty input.

import { describe, it, expect } from 'vitest';
import { classifyRepeatedPrompts } from '../../../../src/analysis/classifiers/repeated-prompts.js';
import { makeEmptySummary, makeEmptySnapshot, makeDefaultConfig } from '../helpers.js';

describe('classifyRepeatedPrompts', () => {
  it('returns HOOK with HIGH confidence for count=10, sessions=3, short prompt', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'npm test', count: 10, sessions: 3 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyRepeatedPrompts(summary, snapshot, config);

    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('HOOK');
    expect(results[0].confidence).toBe('HIGH');
    expect(results[0].pattern_type).toBe('repeated_prompt');
    expect(results[0].evidence.count).toBe(10);
    expect(results[0].evidence.sessions).toBe(3);
  });

  it('returns HOOK with MEDIUM confidence for count=5, sessions=2, short prompt', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'git status', count: 5, sessions: 2 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyRepeatedPrompts(summary, snapshot, config);

    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('HOOK');
    expect(results[0].confidence).toBe('MEDIUM');
  });

  it('returns no recommendation for count=3 (below default threshold 5)', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'npm test', count: 3, sessions: 2 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyRepeatedPrompts(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('returns no recommendation for count=10 but wordCount>50 (long prompt territory)', () => {
    const summary = makeEmptySummary();
    // Create a prompt with more than 50 words
    const longWords = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    summary.top_repeated_prompts = [
      { prompt: longWords, count: 10, sessions: 3 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyRepeatedPrompts(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('returns multiple recommendations for multiple prompts above threshold', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'npm test', count: 10, sessions: 3 },
      { prompt: 'git status', count: 7, sessions: 2 },
      { prompt: 'npm run build', count: 6, sessions: 4 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyRepeatedPrompts(summary, snapshot, config);

    expect(results).toHaveLength(3);
    expect(results[0].id).toContain('rec-repeated-');
    expect(results[1].id).toContain('rec-repeated-');
    expect(results[2].id).toContain('rec-repeated-');
  });

  it('returns empty array for empty top_repeated_prompts', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyRepeatedPrompts(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });
});
