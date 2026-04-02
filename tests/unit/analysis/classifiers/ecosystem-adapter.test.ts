// Unit tests for the ecosystem adapter classifier.
// Verifies: GSD ecosystem routing, Cog ecosystem routing, Claude Code
// version detection, no-ecosystem handling, and edge cases.

import { describe, it, expect } from 'vitest';
import { classifyEcosystemAdaptations } from '../../../../src/analysis/classifiers/ecosystem-adapter.js';
import { makeEmptySummary, makeEmptySnapshot, makeDefaultConfig } from '../helpers.js';

describe('classifyEcosystemAdaptations', () => {
  it('produces SKILL recommendation with GSD context when GSD detected and repeated multi-step prompts exist', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'run the full deploy pipeline and verify', count: 4, sessions: 3 },
    ];
    const snapshot = makeEmptySnapshot();
    snapshot.detected_ecosystems = ['gsd'];
    const config = makeDefaultConfig();

    const results = classifyEcosystemAdaptations(summary, snapshot, config);

    const gsd = results.find(r => r.pattern_type === 'ecosystem_gsd');
    expect(gsd).toBeDefined();
    expect(gsd!.target).toBe('SKILL');
    expect(gsd!.confidence).toBe('LOW');
    expect(gsd!.ecosystem_context).toContain('GSD');
  });

  it('produces MEMORY recommendation with Cog context when Cog detected', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    snapshot.detected_ecosystems = ['cog'];
    const config = makeDefaultConfig();

    const results = classifyEcosystemAdaptations(summary, snapshot, config);

    const cog = results.find(r => r.pattern_type === 'ecosystem_cog');
    expect(cog).toBeDefined();
    expect(cog!.target).toBe('MEMORY');
    expect(cog!.confidence).toBe('LOW');
    expect(cog!.ecosystem_context).toContain('Cog');
  });

  it('produces version recommendation when Claude Code version is newer than compatible range', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    snapshot.claude_code = {
      version: '3.0.0',
      version_known: true,
      compatible: false,
    };
    const config = makeDefaultConfig();

    const results = classifyEcosystemAdaptations(summary, snapshot, config);

    const version = results.find(r => r.pattern_type === 'version_update');
    expect(version).toBeDefined();
    expect(version!.target).toBe('CLAUDE_MD');
    expect(version!.confidence).toBe('MEDIUM');
    expect(version!.title).toContain('3.0.0');
  });

  it('produces no version recommendation when Claude Code version is compatible', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    snapshot.claude_code = {
      version: '2.1.5',
      version_known: true,
      compatible: true,
    };
    const config = makeDefaultConfig();

    const results = classifyEcosystemAdaptations(summary, snapshot, config);

    const version = results.find(r => r.pattern_type === 'version_update');
    expect(version).toBeUndefined();
  });

  it('produces no version recommendation when Claude Code version is unknown', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    snapshot.claude_code = {
      version: 'unknown',
      version_known: false,
      compatible: false,
    };
    const config = makeDefaultConfig();

    const results = classifyEcosystemAdaptations(summary, snapshot, config);

    const version = results.find(r => r.pattern_type === 'version_update');
    expect(version).toBeUndefined();
  });

  it('returns no ecosystem recommendations when no ecosystems detected', () => {
    const summary = makeEmptySummary();
    const snapshot = makeEmptySnapshot();
    snapshot.detected_ecosystems = [];
    const config = makeDefaultConfig();

    const results = classifyEcosystemAdaptations(summary, snapshot, config);

    const ecosystem = results.find(r =>
      r.pattern_type === 'ecosystem_gsd' || r.pattern_type === 'ecosystem_cog',
    );
    expect(ecosystem).toBeUndefined();
  });

  it('produces no GSD recommendation when GSD detected but no repeated multi-step prompts', () => {
    const summary = makeEmptySummary();
    // No repeated prompts at all
    summary.top_repeated_prompts = [];
    const snapshot = makeEmptySnapshot();
    snapshot.detected_ecosystems = ['gsd'];
    const config = makeDefaultConfig();

    const results = classifyEcosystemAdaptations(summary, snapshot, config);

    const gsd = results.find(r => r.pattern_type === 'ecosystem_gsd');
    expect(gsd).toBeUndefined();
  });

  it('handles both GSD and Cog detected simultaneously', () => {
    const summary = makeEmptySummary();
    summary.top_repeated_prompts = [
      { prompt: 'run the deploy and test pipeline', count: 3, sessions: 2 },
    ];
    const snapshot = makeEmptySnapshot();
    snapshot.detected_ecosystems = ['gsd', 'cog'];
    const config = makeDefaultConfig();

    const results = classifyEcosystemAdaptations(summary, snapshot, config);

    const gsd = results.find(r => r.pattern_type === 'ecosystem_gsd');
    const cog = results.find(r => r.pattern_type === 'ecosystem_cog');
    expect(gsd).toBeDefined();
    expect(cog).toBeDefined();
  });
});
