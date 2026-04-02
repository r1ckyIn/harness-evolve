// Unit tests for the permission patterns classifier.
// Verifies: HIGH/MEDIUM confidence, threshold gating on count and sessions,
// suggested_action mentioning allowedTools, and empty input.

import { describe, it, expect } from 'vitest';
import { classifyPermissionPatterns } from '../../../../src/analysis/classifiers/permission-patterns.js';
import { makeEmptySummary, makeEmptySnapshot, makeDefaultConfig } from '../helpers.js';

describe('classifyPermissionPatterns', () => {
  it('returns SETTINGS with HIGH confidence for count=15, sessions=4', () => {
    const summary = makeEmptySummary();
    summary.permission_patterns = [
      { tool_name: 'Bash', count: 15, sessions: 4 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPermissionPatterns(summary, snapshot, config);

    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('SETTINGS');
    expect(results[0].confidence).toBe('HIGH');
    expect(results[0].pattern_type).toBe('permission-always-approved');
    expect(results[0].id).toBe('rec-permission-always-approved-0');
    expect(results[0].evidence.count).toBe(15);
    expect(results[0].evidence.sessions).toBe(4);
  });

  it('returns SETTINGS with MEDIUM confidence for count=10, sessions=3', () => {
    const summary = makeEmptySummary();
    summary.permission_patterns = [
      { tool_name: 'Write', count: 10, sessions: 3 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPermissionPatterns(summary, snapshot, config);

    expect(results).toHaveLength(1);
    expect(results[0].target).toBe('SETTINGS');
    expect(results[0].confidence).toBe('MEDIUM');
  });

  it('returns no recommendation for count=5 (below threshold 10)', () => {
    const summary = makeEmptySummary();
    summary.permission_patterns = [
      { tool_name: 'Bash', count: 5, sessions: 3 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPermissionPatterns(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('returns no recommendation for count=10 but sessions=1 (below 3 sessions)', () => {
    const summary = makeEmptySummary();
    summary.permission_patterns = [
      { tool_name: 'Bash', count: 10, sessions: 1 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPermissionPatterns(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('mentions allowedTools and tool_name in suggested_action', () => {
    const summary = makeEmptySummary();
    summary.permission_patterns = [
      { tool_name: 'Bash', count: 15, sessions: 4 },
    ];
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPermissionPatterns(summary, snapshot, config);

    expect(results).toHaveLength(1);
    expect(results[0].suggested_action).toContain('Bash');
    expect(results[0].suggested_action).toContain('allow');
  });

  it('returns empty array for empty permission_patterns', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyPermissionPatterns(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });
});
