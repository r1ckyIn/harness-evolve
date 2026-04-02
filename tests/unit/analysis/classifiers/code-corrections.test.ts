// Unit tests for the code corrections classifier.
// Verifies: HIGH-usage code-modification tools produce RULE recommendations
// with LOW confidence, threshold gating, and empty input handling.

import { describe, it, expect } from 'vitest';
import { classifyCodeCorrections } from '../../../../src/analysis/classifiers/code-corrections.js';
import { makeEmptySummary, makeEmptySnapshot, makeDefaultConfig } from '../helpers.js';

describe('classifyCodeCorrections', () => {
  it('returns RULE with LOW confidence for Write tool with count >= 20', () => {
    const summary = makeEmptySummary();
    summary.tool_frequency = [
      { tool_name: 'Write', count: 25 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyCodeCorrections(summary, snapshot, config);

    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('RULE');
    expect(results[0].confidence).toBe('LOW');
    expect(results[0].pattern_type).toBe('code_correction');
    expect(results[0].evidence.count).toBe(25);
  });

  it('returns no recommendation for tool with count below min_failures threshold (3)', () => {
    const summary = makeEmptySummary();
    summary.tool_frequency = [
      { tool_name: 'Write', count: 2 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyCodeCorrections(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('returns no recommendation for non-code-modification tools even with high count', () => {
    const summary = makeEmptySummary();
    summary.tool_frequency = [
      { tool_name: 'Read', count: 50 },
      { tool_name: 'Glob', count: 30 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyCodeCorrections(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('returns empty array for empty tool_frequency', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyCodeCorrections(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('returns recommendations for multiple code-modification tools', () => {
    const summary = makeEmptySummary();
    summary.tool_frequency = [
      { tool_name: 'Write', count: 25 },
      { tool_name: 'Edit', count: 30 },
      { tool_name: 'MultiEdit', count: 22 },
      { tool_name: 'Read', count: 100 }, // not a code-modification tool
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyCodeCorrections(summary, snapshot, config);

    expect(results).toHaveLength(3);
    expect(results.every(r => r.target === 'RULE')).toBe(true);
    expect(results.every(r => r.confidence === 'LOW')).toBe(true);
  });

  it('returns recommendation for Edit tool below 20 count if above min_failures', () => {
    // Edit with count=15, still below 20 but above min_failures(3)
    // The classifier should only produce recommendations for code-mod tools >= 20
    const summary = makeEmptySummary();
    summary.tool_frequency = [
      { tool_name: 'Edit', count: 15 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyCodeCorrections(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });
});
