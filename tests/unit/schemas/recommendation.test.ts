// Unit tests for PatternType enum and recommendation schema validation.
// Verifies all 13 classifier pattern_type values are accepted by the
// patternTypeSchema, and that invalid values are rejected.

import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod/v4';
import {
  patternTypeSchema,
  recommendationSchema,
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
