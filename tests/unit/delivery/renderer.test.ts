// Unit tests for the recommendation markdown renderer.
// Tests: tier grouping (HIGH/MEDIUM/LOW), status prefixes,
// evidence and suggested action rendering, empty recommendations,
// ecosystem_context presence/absence, no numeric scores.

import { describe, it, expect } from 'vitest';
import type { AnalysisResult } from '../../../src/schemas/recommendation.js';
import type { RecommendationStatus } from '../../../src/schemas/delivery.js';
import { renderRecommendations } from '../../../src/delivery/renderer.js';

// --- Test data factories ---

function makeResult(
  recs: AnalysisResult['recommendations'] = [],
): AnalysisResult {
  return {
    generated_at: '2026-04-01T00:00:00Z',
    summary_period: {
      since: '2026-03-01',
      until: '2026-03-31',
      days: 30,
    },
    recommendations: recs,
    metadata: {
      classifier_count: 7,
      patterns_evaluated: 42,
      environment_ecosystems: [],
      claude_code_version: '2.1.0',
    },
  };
}

function makeRec(overrides: Partial<AnalysisResult['recommendations'][0]> = {}) {
  return {
    id: 'rec-test-1',
    target: 'HOOK' as const,
    confidence: 'HIGH' as const,
    pattern_type: 'repeated_prompt',
    title: 'Create hook for npm test',
    description: 'You run npm test frequently. A hook would automate this.',
    evidence: {
      count: 15,
      sessions: 3,
      examples: ['npm test', 'npm test', 'npm test'],
    },
    suggested_action: 'Add a UserPromptSubmit hook that auto-runs npm test.',
    ...overrides,
  };
}

describe('renderRecommendations', () => {
  it('renders mixed HIGH/MEDIUM/LOW recommendations with tier sections', () => {
    const result = makeResult([
      makeRec({ id: 'r1', confidence: 'HIGH', title: 'High rec' }),
      makeRec({ id: 'r2', confidence: 'MEDIUM', title: 'Medium rec' }),
      makeRec({ id: 'r3', confidence: 'LOW', title: 'Low rec' }),
    ]);
    const states = new Map<string, RecommendationStatus>();

    const output = renderRecommendations(result, states);

    expect(output).toContain('## HIGH Confidence');
    expect(output).toContain('## MEDIUM Confidence');
    expect(output).toContain('## LOW Confidence');

    // HIGH section should come before MEDIUM, MEDIUM before LOW
    const highIdx = output.indexOf('## HIGH Confidence');
    const medIdx = output.indexOf('## MEDIUM Confidence');
    const lowIdx = output.indexOf('## LOW Confidence');
    expect(highIdx).toBeLessThan(medIdx);
    expect(medIdx).toBeLessThan(lowIdx);
  });

  it('renders title, target, pattern_type, evidence count, and suggested_action', () => {
    const rec = makeRec({
      title: 'Create hook for npm test',
      target: 'HOOK',
      pattern_type: 'repeated_prompt',
      evidence: { count: 15, sessions: 3, examples: ['npm test'] },
      suggested_action: 'Add a UserPromptSubmit hook.',
    });
    const result = makeResult([rec]);
    const states = new Map<string, RecommendationStatus>();

    const output = renderRecommendations(result, states);

    expect(output).toContain('Create hook for npm test');
    expect(output).toContain('HOOK');
    expect(output).toContain('repeated_prompt');
    expect(output).toContain('15');
    expect(output).toContain('Add a UserPromptSubmit hook.');
  });

  it('renders status prefixes from state map', () => {
    const result = makeResult([
      makeRec({ id: 'r-applied', confidence: 'HIGH', title: 'Applied rec' }),
      makeRec({ id: 'r-dismissed', confidence: 'HIGH', title: 'Dismissed rec' }),
      makeRec({ id: 'r-pending', confidence: 'HIGH', title: 'Pending rec' }),
    ]);
    const states = new Map<string, RecommendationStatus>([
      ['r-applied', 'applied'],
      ['r-dismissed', 'dismissed'],
      ['r-pending', 'pending'],
    ]);

    const output = renderRecommendations(result, states);

    expect(output).toContain('[APPLIED]');
    expect(output).toContain('[DISMISSED]');
    expect(output).toContain('[PENDING]');
  });

  it('defaults to PENDING when recommendation not in state map', () => {
    const result = makeResult([
      makeRec({ id: 'r-unknown', confidence: 'HIGH', title: 'Unknown rec' }),
    ]);
    const states = new Map<string, RecommendationStatus>();

    const output = renderRecommendations(result, states);

    expect(output).toContain('[PENDING]');
  });

  it('renders "No recommendations" for empty array', () => {
    const result = makeResult([]);
    const states = new Map<string, RecommendationStatus>();

    const output = renderRecommendations(result, states);

    expect(output).toContain('# harness-evolve Recommendations');
    expect(output).toContain('No recommendations');
  });

  it('renders ecosystem_context when present', () => {
    const rec = makeRec({
      ecosystem_context: 'Consider using GSD slash commands.',
    });
    const result = makeResult([rec]);
    const states = new Map<string, RecommendationStatus>();

    const output = renderRecommendations(result, states);

    expect(output).toContain('Consider using GSD slash commands.');
    expect(output).toContain('Ecosystem note');
  });

  it('omits ecosystem_context section when absent', () => {
    const rec = makeRec({ ecosystem_context: undefined });
    const result = makeResult([rec]);
    const states = new Map<string, RecommendationStatus>();

    const output = renderRecommendations(result, states);

    expect(output).not.toContain('Ecosystem note');
  });

  it('never contains numeric confidence scores', () => {
    const result = makeResult([
      makeRec({ confidence: 'HIGH' }),
      makeRec({ id: 'r2', confidence: 'MEDIUM' }),
      makeRec({ id: 'r3', confidence: 'LOW' }),
    ]);
    const states = new Map<string, RecommendationStatus>();

    const output = renderRecommendations(result, states);

    // Should not contain patterns like "confidence: 0.9" or "score: 85"
    expect(output).not.toMatch(/confidence:\s*\d+(\.\d+)?/i);
    expect(output).not.toMatch(/score:\s*\d+/i);
  });

  it('renders full recommendation detail (description, evidence examples)', () => {
    const rec = makeRec({
      description: 'You run npm test frequently across multiple sessions.',
      evidence: {
        count: 15,
        sessions: 3,
        examples: ['npm test', 'npm run test', 'npm t'],
      },
    });
    const result = makeResult([rec]);
    const states = new Map<string, RecommendationStatus>();

    const output = renderRecommendations(result, states);

    expect(output).toContain('You run npm test frequently across multiple sessions.');
    expect(output).toContain('npm test');
    expect(output).toContain('npm run test');
    expect(output).toContain('npm t');
  });

  it('renders header with metadata', () => {
    const result = makeResult([]);
    const states = new Map<string, RecommendationStatus>();

    const output = renderRecommendations(result, states);

    expect(output).toContain('# harness-evolve Recommendations');
    expect(output).toContain('2026-04-01');
    expect(output).toContain('2026-03-01');
    expect(output).toContain('2026-03-31');
    expect(output).toContain('30 days');
  });

  it('omits sessions count when undefined', () => {
    const rec = makeRec({
      evidence: { count: 5, examples: ['test'] },
    });
    const result = makeResult([rec]);
    const states = new Map<string, RecommendationStatus>();

    const output = renderRecommendations(result, states);

    expect(output).toContain('5 occurrences');
    expect(output).not.toContain('sessions');
  });

  it('includes sessions count when defined', () => {
    const rec = makeRec({
      evidence: { count: 15, sessions: 3, examples: ['test'] },
    });
    const result = makeResult([rec]);
    const states = new Map<string, RecommendationStatus>();

    const output = renderRecommendations(result, states);

    expect(output).toContain('15 occurrences');
    expect(output).toContain('3 sessions');
  });
});
