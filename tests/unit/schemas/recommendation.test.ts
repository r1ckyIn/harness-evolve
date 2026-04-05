// Unit tests for PatternType enum and recommendation schema validation.
// Verifies all pattern_type values (including 4 new audit types) are
// accepted, severity field defaults and validation, and backward compat.

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod/v4';
import {
  patternTypeSchema,
  recommendationSchema,
  severitySchema,
} from '../../../src/schemas/recommendation.js';

describe('patternTypeSchema', () => {
  const validPatternTypes = [
    'repeated_prompt',
    'long_prompt',
    'permission-always-approved',
    'code_correction',
    'personal_info',
    'config_drift',
    'version_update',
    'ecosystem_gsd',
    'ecosystem_cog',
    'onboarding_start_hooks',
    'onboarding_start_rules',
    'onboarding_start_claudemd',
    'onboarding_optimize',
  ];

  for (const pt of validPatternTypes) {
    it(`accepts valid pattern type '${pt}'`, () => {
      expect(patternTypeSchema.parse(pt)).toBe(pt);
    });
  }

  it('rejects invalid pattern type', () => {
    expect(() => patternTypeSchema.parse('invalid-type')).toThrow(ZodError);
  });
});

describe('patternTypeSchema - new audit types', () => {
  it('accepts scan_rule_conflict', () => {
    expect(patternTypeSchema.parse('scan_rule_conflict')).toBe('scan_rule_conflict');
  });

  it('accepts scan_structure_issue', () => {
    expect(patternTypeSchema.parse('scan_structure_issue')).toBe('scan_structure_issue');
  });

  it('accepts scan_hooks_redundancy', () => {
    expect(patternTypeSchema.parse('scan_hooks_redundancy')).toBe('scan_hooks_redundancy');
  });

  it('accepts scan_command_convention', () => {
    expect(patternTypeSchema.parse('scan_command_convention')).toBe('scan_command_convention');
  });
});

describe('severitySchema', () => {
  it('accepts "problem" as a valid severity', () => {
    expect(() => severitySchema.parse('problem')).not.toThrow();
  });

  it('accepts "suggestion" as a valid severity', () => {
    expect(() => severitySchema.parse('suggestion')).not.toThrow();
  });

  it('rejects an invalid severity value', () => {
    expect(() => severitySchema.parse('invalid_value')).toThrow();
  });
});

describe('recommendationSchema pattern_type field', () => {
  const baseRecommendation = {
    id: 'rec-test-0',
    target: 'HOOK',
    confidence: 'HIGH',
    title: 'Test recommendation',
    description: 'Test description',
    evidence: {
      count: 5,
      sessions: 2,
      examples: ['example 1'],
    },
    suggested_action: 'Do something',
  };

  it('accepts recommendation with valid enum pattern_type', () => {
    const result = recommendationSchema.safeParse({
      ...baseRecommendation,
      pattern_type: 'repeated_prompt',
    });
    expect(result.success).toBe(true);
  });

  it('rejects recommendation with invalid pattern_type', () => {
    const result = recommendationSchema.safeParse({
      ...baseRecommendation,
      pattern_type: 'invalid-type',
    });
    expect(result.success).toBe(false);
  });
});

describe('recommendationSchema - severity field', () => {
  const baseRecommendation = {
    id: 'test-rec-severity',
    target: 'RULE',
    confidence: 'HIGH',
    pattern_type: 'scan_rule_conflict',
    title: 'Test recommendation',
    description: 'Test description',
    evidence: {
      count: 1,
      examples: ['example1'],
    },
    suggested_action: 'Do something',
  };

  it('succeeds when severity field is omitted (defaults to suggestion)', () => {
    const result = recommendationSchema.parse(baseRecommendation);
    expect(result.severity).toBe('suggestion');
  });

  it('succeeds when severity is "problem"', () => {
    const result = recommendationSchema.parse({
      ...baseRecommendation,
      severity: 'problem',
    });
    expect(result.severity).toBe('problem');
  });

  it('succeeds when severity is "suggestion"', () => {
    const result = recommendationSchema.parse({
      ...baseRecommendation,
      severity: 'suggestion',
    });
    expect(result.severity).toBe('suggestion');
  });

  it('fails when severity is "invalid_value"', () => {
    expect(() =>
      recommendationSchema.parse({
        ...baseRecommendation,
        severity: 'invalid_value',
      }),
    ).toThrow();
  });

  it('existing recommendation without severity parses with severity === "suggestion"', () => {
    const existingRec = {
      id: 'rec-legacy-1',
      target: 'HOOK',
      confidence: 'MEDIUM',
      pattern_type: 'repeated_prompt',
      title: 'Legacy recommendation',
      description: 'No severity field here',
      evidence: {
        count: 5,
        examples: ['a', 'b'],
      },
      suggested_action: 'Do legacy thing',
    };
    const result = recommendationSchema.parse(existingRec);
    expect(result.severity).toBe('suggestion');
  });
});
