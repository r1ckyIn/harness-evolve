// Unit tests for GeneratedArtifact schema and shared generator utilities.
// Covers schema validation for all artifact types, toSlug edge cases,
// escapeYaml safety, GENERATOR_VERSION format, and nowISO output.

import { describe, it, expect } from 'vitest';
import {
  generatedArtifactSchema,
  toSlug,
  escapeYaml,
  GENERATOR_VERSION,
  nowISO,
} from '../../../src/generators/schemas.js';

describe('generatedArtifactSchema', () => {
  const validBase = {
    type: 'skill' as const,
    filename: '.claude/commands/my-skill.md',
    content: '# My Skill\n\nDo stuff.',
    source_recommendation_id: 'rec-long-0',
    metadata: {
      generated_at: new Date().toISOString(),
      generator_version: '1.0.0',
      pattern_type: 'long_prompt' as const,
    },
  };

  it('accepts a valid skill artifact', () => {
    const result = generatedArtifactSchema.parse(validBase);
    expect(result.type).toBe('skill');
    expect(result.filename).toBe('.claude/commands/my-skill.md');
  });

  it('accepts a valid hook artifact', () => {
    const result = generatedArtifactSchema.parse({
      ...validBase,
      type: 'hook',
      filename: '.claude/hooks/my-hook.sh',
    });
    expect(result.type).toBe('hook');
  });

  it('accepts a valid claude_md_patch artifact', () => {
    const result = generatedArtifactSchema.parse({
      ...validBase,
      type: 'claude_md_patch',
      filename: 'CLAUDE.md',
    });
    expect(result.type).toBe('claude_md_patch');
  });

  it('rejects artifact with missing required fields', () => {
    expect(() =>
      generatedArtifactSchema.parse({
        type: 'skill',
        // missing filename, content, source_recommendation_id, metadata
      }),
    ).toThrow();

    expect(() =>
      generatedArtifactSchema.parse({
        ...validBase,
        filename: undefined,
        content: undefined,
      }),
    ).toThrow();
  });

  it('rejects artifact with invalid type value', () => {
    expect(() =>
      generatedArtifactSchema.parse({
        ...validBase,
        type: 'invalid_type',
      }),
    ).toThrow();
  });
});

describe('toSlug', () => {
  it('converts "Hello World Test!" to "hello-world-test"', () => {
    expect(toSlug('Hello World Test!')).toBe('hello-world-test');
  });

  it('strips leading and trailing dashes', () => {
    expect(toSlug('   Leading-trailing---dashes   ')).toBe(
      'leading-trailing-dashes',
    );
  });

  it('truncates strings longer than 50 characters', () => {
    const longInput =
      'This is a very long string that should definitely be truncated to fifty characters maximum length';
    const result = toSlug(longInput);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('returns empty string for empty input', () => {
    expect(toSlug('')).toBe('');
  });
});

describe('escapeYaml', () => {
  it('wraps values containing colons and quotes safely', () => {
    const result = escapeYaml('value with: colons and "quotes"');
    expect(result).toContain('"');
    // Should escape internal double quotes
    expect(result).toContain('\\"');
  });

  it('passes through simple text unchanged', () => {
    expect(escapeYaml('simple text')).toBe('simple text');
  });
});

describe('GENERATOR_VERSION', () => {
  it('is a non-empty string matching semver pattern', () => {
    expect(GENERATOR_VERSION).toBeTruthy();
    expect(GENERATOR_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('nowISO', () => {
  it('returns a valid ISO datetime string', () => {
    const result = nowISO();
    expect(result).toBeTruthy();
    // ISO 8601 format check
    expect(() => new Date(result)).not.toThrow();
    expect(new Date(result).toISOString()).toBe(result);
  });
});
