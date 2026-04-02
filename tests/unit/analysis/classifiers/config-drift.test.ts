// Unit tests for the config drift classifier.
// Verifies: hook-rule overlap detection, multiple CLAUDE.md detection,
// hook count heuristic, and empty input handling.

import { describe, it, expect } from 'vitest';
import { classifyConfigDrift } from '../../../../src/analysis/classifiers/config-drift.js';
import { makeEmptySummary, makeEmptySnapshot, makeDefaultConfig } from '../helpers.js';

describe('classifyConfigDrift', () => {
  it('detects hook-rule overlap and recommends consolidation', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.hooks = [
      { event: 'PreToolUse', scope: 'project', type: 'command' },
    ];
    snapshot.installed_tools.rules = [
      { name: 'PreToolUse', scope: 'project' },
    ];
    const config = makeDefaultConfig();

    const results = classifyConfigDrift(summary, snapshot, config);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const overlap = results.find(r => r.title.toLowerCase().includes('overlap'));
    expect(overlap).toBeDefined();
    expect(overlap!.pattern_type).toBe('config_drift');
    expect(['RULE', 'HOOK']).toContain(overlap!.target);
  });

  it('detects multiple CLAUDE.md files and recommends review', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.claude_md = [
      { path: '~/.claude/CLAUDE.md', exists: true },
      { path: './CLAUDE.md', exists: true },
      { path: './project/CLAUDE.md', exists: true },
    ];
    const config = makeDefaultConfig();

    const results = classifyConfigDrift(summary, snapshot, config);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const claudeMd = results.find(r => r.target === 'CLAUDE_MD');
    expect(claudeMd).toBeDefined();
    expect(claudeMd!.pattern_type).toBe('config_drift');
  });

  it('returns no recommendation when no overlaps detected', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.hooks = [
      { event: 'UserPromptSubmit', scope: 'user', type: 'command' },
    ];
    snapshot.installed_tools.rules = [
      { name: 'code-style', scope: 'project' },
    ];
    snapshot.installed_tools.claude_md = [
      { path: './CLAUDE.md', exists: true },
    ];
    const config = makeDefaultConfig();

    const results = classifyConfigDrift(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('returns empty array for empty installed_tools', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    const config = makeDefaultConfig();

    const results = classifyConfigDrift(summary, snapshot, config);

    expect(results).toHaveLength(0);
  });

  it('detects excessive hooks (>10) and recommends review', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    // Create 11 hooks across scopes
    snapshot.installed_tools.hooks = Array.from({ length: 11 }, (_, i) => ({
      event: `Event${i}`,
      scope: 'project' as const,
      type: 'command',
    }));
    const config = makeDefaultConfig();

    const results = classifyConfigDrift(summary, snapshot, config);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const hookOverload = results.find(r => r.target === 'HOOK');
    expect(hookOverload).toBeDefined();
    expect(hookOverload!.pattern_type).toBe('config_drift');
  });

  it('does not flag single CLAUDE.md file as drift', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.claude_md = [
      { path: './CLAUDE.md', exists: true },
      { path: '~/.claude/CLAUDE.md', exists: false }, // not existing
    ];
    const config = makeDefaultConfig();

    const results = classifyConfigDrift(summary, snapshot, config);

    const claudeMd = results.find(r => r.target === 'CLAUDE_MD');
    expect(claudeMd).toBeUndefined();
  });
});
