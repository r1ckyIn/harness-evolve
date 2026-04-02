// Unit tests for the personal info mention classifier.
// Verifies: keyword detection in prompts produces MEMORY recommendations
// with LOW confidence, deduplication, count thresholds, and empty input.

import { describe, it, expect } from 'vitest';
import { classifyPersonalInfo } from '../../../../src/analysis/classifiers/personal-info.js';
import { makeEmptySummary, makeEmptySnapshot, makeDefaultConfig } from '../helpers.js';

describe('classifyPersonalInfo', () => {
  it('returns MEMORY with LOW confidence for prompt containing "my name is"', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'my name is Ricky and I need help', count: 3, sessions: 2 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPersonalInfo(summary, snapshot, config);

    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('MEMORY');
    expect(results[0].confidence).toBe('LOW');
    expect(results[0].pattern_type).toBe('personal_info');
    expect(results[0].evidence.count).toBe(3);
  });

  it('returns MEMORY with LOW confidence for prompt containing "i live in"', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'I live in Sydney', count: 2, sessions: 2 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPersonalInfo(summary, snapshot, config);

    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('MEMORY');
    expect(results[0].confidence).toBe('LOW');
  });

  it('returns MEMORY with LOW confidence for prompt containing "i prefer"', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'I prefer using TypeScript over JavaScript', count: 4, sessions: 3 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPersonalInfo(summary, snapshot, config);

    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('MEMORY');
    expect(results[0].confidence).toBe('LOW');
  });

  it('returns no recommendation for prompts without personal keywords', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'npm test', count: 10, sessions: 5 },
      { prompt: 'git status', count: 7, sessions: 3 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPersonalInfo(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('returns empty array for empty top_repeated_prompts', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPersonalInfo(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('returns no recommendation for personal keyword with count < 2', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'my name is Ricky', count: 1, sessions: 1 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPersonalInfo(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('deduplicates keywords -- one recommendation per keyword match', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'my name is Ricky', count: 3, sessions: 2 },
      { prompt: 'my name is Ricky and I do coding', count: 2, sessions: 2 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPersonalInfo(summary, snapshot, config);

    // Only one recommendation for "my name is" keyword (deduplication)
    const nameMatches = results.filter(r => r.title.includes('my name is'));
    expect(nameMatches).toHaveLength(1);
  });

  it('detects multiple different keywords across prompts', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'my name is Ricky', count: 3, sessions: 2 },
      { prompt: 'I always use TypeScript', count: 2, sessions: 2 },
      { prompt: 'my email is test@example.com', count: 4, sessions: 3 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPersonalInfo(summary, snapshot, config);

    expect(results).toHaveLength(3);
    expect(results.every(r => r.target === 'MEMORY')).toBe(true);
    expect(results.every(r => r.confidence === 'LOW')).toBe(true);
  });
});
