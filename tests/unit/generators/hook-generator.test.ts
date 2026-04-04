// Unit tests for hook generator (GEN-02).
// Validates that generateHook() produces valid bash hook script drafts from
// HOOK-targeted recommendations (both mechanization and repeated_prompt).

import { describe, it, expect } from 'vitest';
import { generateHook } from '../../../src/generators/hook-generator.js';
import { generatedArtifactSchema } from '../../../src/generators/schemas.js';
import type { Recommendation } from '../../../src/schemas/recommendation.js';

function makeHookRec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'rec-scan-mechanize-0',
    target: 'HOOK',
    confidence: 'MEDIUM',
    pattern_type: 'scan_missing_mechanization',
    title: 'Mechanizable rule: "always run eslint"',
    description:
      'Found a rule in .claude/rules/lint.md that describes an operation suitable for a PreToolUse hook: "always run eslint".',
    evidence: { count: 1, examples: ['always run eslint'] },
    suggested_action:
      'Create a PreToolUse hook to enforce this rule automatically.',
    ...overrides,
  };
}

function makeRepeatedPromptHookRec(
  overrides: Partial<Recommendation> = {},
): Recommendation {
  return {
    id: 'rec-repeated-0',
    target: 'HOOK',
    confidence: 'HIGH',
    pattern_type: 'repeated_prompt',
    title: 'Repeated prompt: "npm test"',
    description: 'This prompt has been used 15 times across 4 sessions.',
    evidence: { count: 15, sessions: 4, examples: ['npm test'] },
    suggested_action:
      'Create a UserPromptSubmit hook that detects "npm test" and auto-executes the intended action.',
    ...overrides,
  };
}

describe('generateHook', () => {
  it('returns GeneratedArtifact with type hook for scan_missing_mechanization HOOK rec', () => {
    const result = generateHook(makeHookRec());
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hook');
  });

  it('generates filename matching .claude/hooks/evolve-<slug>.sh pattern', () => {
    const result = generateHook(makeHookRec());
    expect(result).not.toBeNull();
    expect(result!.filename).toMatch(/^\.claude\/hooks\/evolve-[\w-]+\.sh$/);
  });

  it('generates content starting with #!/usr/bin/env bash shebang', () => {
    const result = generateHook(makeHookRec());
    expect(result).not.toBeNull();
    expect(result!.content).toMatch(/^#!\/usr\/bin\/env bash/);
  });

  it('generates content containing INPUT=$(cat) for stdin reading', () => {
    const result = generateHook(makeHookRec());
    expect(result).not.toBeNull();
    expect(result!.content).toContain('INPUT=$(cat)');
  });

  it('generates content ending with exit 0', () => {
    const result = generateHook(makeHookRec());
    expect(result).not.toBeNull();
    expect(result!.content.trimEnd()).toMatch(/exit 0$/);
  });

  it('extracts hook event from rec.description ("suitable for a PreToolUse hook")', () => {
    const result = generateHook(makeHookRec());
    expect(result).not.toBeNull();
    expect(result!.content).toContain('Hook event: PreToolUse');
  });

  it('extracts hook event from rec.suggested_action ("Create a PostToolUse hook")', () => {
    const rec = makeHookRec({
      description: 'This rule should be mechanized.',
      suggested_action: 'Create a PostToolUse hook to verify output format.',
    });
    const result = generateHook(rec);
    expect(result).not.toBeNull();
    expect(result!.content).toContain('Hook event: PostToolUse');
  });

  it('returns valid artifact for repeated_prompt HOOK rec (UserPromptSubmit)', () => {
    const result = generateHook(makeRepeatedPromptHookRec());
    expect(result).not.toBeNull();
    expect(result!.type).toBe('hook');
    expect(result!.content).toContain('Hook event: UserPromptSubmit');
  });

  it('returns null when rec.target is not HOOK', () => {
    const result = generateHook(makeHookRec({ target: 'SKILL' }));
    expect(result).toBeNull();
  });

  it('generated artifact passes generatedArtifactSchema.parse()', () => {
    const result = generateHook(makeHookRec());
    expect(result).not.toBeNull();
    expect(() => generatedArtifactSchema.parse(result)).not.toThrow();
  });

  it('source_recommendation_id matches input rec.id', () => {
    const result = generateHook(makeHookRec({ id: 'rec-custom-id-42' }));
    expect(result).not.toBeNull();
    expect(result!.source_recommendation_id).toBe('rec-custom-id-42');
  });

  it('falls back to PreToolUse when no event parseable from description/suggested_action', () => {
    const rec = makeHookRec({
      description: 'This rule should be a hook.',
      suggested_action: 'Automate this rule.',
    });
    const result = generateHook(rec);
    expect(result).not.toBeNull();
    expect(result!.content).toContain('Hook event: PreToolUse');
  });
});
