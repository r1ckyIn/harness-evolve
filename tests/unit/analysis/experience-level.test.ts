// Unit tests for the experience level computation.
// Verifies: tier classification (newcomer, intermediate, power_user),
// score calculation, breakdown correctness, score capping, and schema validity.

import { describe, it, expect } from 'vitest';
import { computeExperienceLevel } from '../../../src/analysis/experience-level.js';
import {
  experienceTierSchema,
  experienceLevelSchema,
  outcomeEntrySchema,
  outcomeSummarySchema,
} from '../../../src/schemas/onboarding.js';
import { makeEmptySnapshot } from './helpers.js';

describe('computeExperienceLevel', () => {
  it('returns newcomer tier with score 0 for empty snapshot', () => {
    const snapshot = makeEmptySnapshot();
    const result = computeExperienceLevel(snapshot);

    expect(result.tier).toBe('newcomer');
    expect(result.score).toBe(0);
    expect(result.breakdown).toEqual({
      hooks: 0,
      rules: 0,
      skills: 0,
      plugins: 0,
      claude_md: 0,
      ecosystems: 0,
    });
  });

  it('returns power_user tier with score >= 30 for heavy config', () => {
    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.hooks = [
      { event: 'UserPromptSubmit', scope: 'user', type: 'command' },
      { event: 'PreToolUse', scope: 'user', type: 'command' },
      { event: 'PostToolUse', scope: 'user', type: 'command' },
      { event: 'Stop', scope: 'user', type: 'agent' },
      { event: 'PermissionRequest', scope: 'project', type: 'command' },
    ];
    snapshot.installed_tools.rules = [
      { name: 'rule-1', scope: 'user' },
      { name: 'rule-2', scope: 'user' },
      { name: 'rule-3', scope: 'project' },
      { name: 'rule-4', scope: 'project' },
    ];
    snapshot.installed_tools.skills = [
      { name: 'skill-1', scope: 'user' },
      { name: 'skill-2', scope: 'user' },
    ];
    snapshot.installed_tools.plugins = [
      { name: 'plugin-1', marketplace: 'local', enabled: true, scope: 'user', capabilities: [] },
    ];
    snapshot.installed_tools.claude_md = [
      { path: '/project/CLAUDE.md', exists: true },
      { path: '/home/CLAUDE.md', exists: true },
    ];
    snapshot.detected_ecosystems = ['gsd'];

    const result = computeExperienceLevel(snapshot);

    // hooks*8=40, rules*6=24, skills*5=10, plugins*10=10, claude_md*3=6, ecosystems*7=7 = 97
    expect(result.tier).toBe('power_user');
    expect(result.score).toBeGreaterThanOrEqual(30);
    expect(result.score).toBe(97);
    expect(result.breakdown.hooks).toBe(5);
    expect(result.breakdown.rules).toBe(4);
    expect(result.breakdown.skills).toBe(2);
    expect(result.breakdown.plugins).toBe(1);
    expect(result.breakdown.claude_md).toBe(2);
    expect(result.breakdown.ecosystems).toBe(1);
  });

  it('returns intermediate tier for moderate config (score 1-29)', () => {
    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.hooks = [
      { event: 'UserPromptSubmit', scope: 'user', type: 'command' },
    ];
    snapshot.installed_tools.rules = [
      { name: 'rule-1', scope: 'user' },
    ];

    const result = computeExperienceLevel(snapshot);

    // hooks*8=8, rules*6=6 = 14
    expect(result.tier).toBe('intermediate');
    expect(result.score).toBe(14);
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(30);
  });

  it('returns intermediate for 3 CLAUDE.md (score=9, between 0 and 30)', () => {
    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.claude_md = [
      { path: '/a/CLAUDE.md', exists: true },
      { path: '/b/CLAUDE.md', exists: true },
      { path: '/c/CLAUDE.md', exists: true },
    ];

    const result = computeExperienceLevel(snapshot);

    // claude_md*3=9
    expect(result.tier).toBe('intermediate');
    expect(result.score).toBe(9);
  });

  it('caps score at 100 even with excessive tool counts', () => {
    const snapshot = makeEmptySnapshot();
    // 20 hooks * 8 = 160 alone
    snapshot.installed_tools.hooks = Array.from({ length: 20 }, (_, i) => ({
      event: `event-${i}`,
      scope: 'user' as const,
      type: 'command',
    }));

    const result = computeExperienceLevel(snapshot);

    expect(result.score).toBe(100);
    expect(result.tier).toBe('power_user');
  });

  it('only counts claude_md entries with exists=true', () => {
    const snapshot = makeEmptySnapshot();
    snapshot.installed_tools.claude_md = [
      { path: '/a/CLAUDE.md', exists: true },
      { path: '/b/CLAUDE.md', exists: false },
      { path: '/c/CLAUDE.md', exists: false },
    ];

    const result = computeExperienceLevel(snapshot);

    // Only 1 exists=true, so claude_md*3=3
    expect(result.breakdown.claude_md).toBe(1);
    expect(result.score).toBe(3);
    expect(result.tier).toBe('intermediate');
  });
});

describe('Phase 6 Zod schemas', () => {
  it('experienceTierSchema parses valid tiers', () => {
    expect(experienceTierSchema.parse('newcomer')).toBe('newcomer');
    expect(experienceTierSchema.parse('intermediate')).toBe('intermediate');
    expect(experienceTierSchema.parse('power_user')).toBe('power_user');
  });

  it('experienceLevelSchema parses valid experience level', () => {
    const valid = {
      tier: 'newcomer',
      score: 0,
      breakdown: {
        hooks: 0,
        rules: 0,
        skills: 0,
        plugins: 0,
        claude_md: 0,
        ecosystems: 0,
      },
    };
    const result = experienceLevelSchema.parse(valid);
    expect(result.tier).toBe('newcomer');
    expect(result.score).toBe(0);
  });

  it('outcomeEntrySchema parses valid outcome entry', () => {
    const valid = {
      recommendation_id: 'rec-001',
      pattern_type: 'repeated_prompt',
      target: 'HOOK',
      applied_at: '2026-04-01T00:00:00Z',
      checked_at: '2026-04-01T12:00:00Z',
      persisted: true,
      checks_since_applied: 3,
      outcome: 'positive',
    };
    const result = outcomeEntrySchema.parse(valid);
    expect(result.outcome).toBe('positive');
    expect(result.persisted).toBe(true);
  });

  it('outcomeSummarySchema parses valid outcome summary', () => {
    const valid = {
      pattern_type: 'repeated_prompt',
      total_applied: 10,
      total_persisted: 8,
      total_reverted: 2,
      persistence_rate: 0.8,
    };
    const result = outcomeSummarySchema.parse(valid);
    expect(result.persistence_rate).toBe(0.8);
  });
});
