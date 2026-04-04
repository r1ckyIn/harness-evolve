// Unit tests for CLAUDE.md patch generator (GEN-03).
// Validates that generateClaudeMdPatch() produces simplified unified diff
// patches from CLAUDE_MD-targeted recommendations.

import { describe, it, expect } from 'vitest';
import { generateClaudeMdPatch } from '../../../src/generators/claude-md-generator.js';
import { generatedArtifactSchema } from '../../../src/generators/schemas.js';
import type { Recommendation } from '../../../src/schemas/recommendation.js';

function makeClaudeMdRec(
  overrides: Partial<Recommendation> = {},
): Recommendation {
  return {
    id: 'rec-scan-stale-0',
    target: 'CLAUDE_MD',
    confidence: 'LOW',
    pattern_type: 'scan_stale_reference',
    title: 'Stale reference to non-existent file',
    description: 'CLAUDE.md references docs/old-api.md which does not exist.',
    evidence: { count: 1, examples: ['docs/old-api.md'] },
    suggested_action:
      'Remove or update the stale reference to docs/old-api.md.',
    ...overrides,
  };
}

describe('generateClaudeMdPatch', () => {
  it('returns GeneratedArtifact with type claude_md_patch for scan_stale_reference rec', () => {
    const result = generateClaudeMdPatch(makeClaudeMdRec());
    expect(result).not.toBeNull();
    expect(result!.type).toBe('claude_md_patch');
  });

  it('generated content contains --- a/CLAUDE.md header', () => {
    const result = generateClaudeMdPatch(makeClaudeMdRec());
    expect(result).not.toBeNull();
    expect(result!.content).toContain('--- a/CLAUDE.md');
  });

  it('generated content contains +++ b/CLAUDE.md header', () => {
    const result = generateClaudeMdPatch(makeClaudeMdRec());
    expect(result).not.toBeNull();
    expect(result!.content).toContain('+++ b/CLAUDE.md');
  });

  it('generated content contains @@ context markers', () => {
    const result = generateClaudeMdPatch(makeClaudeMdRec());
    expect(result).not.toBeNull();
    expect(result!.content).toContain('@@');
  });

  it('for scan_stale_reference: diff contains removal line prefixed with -', () => {
    const result = generateClaudeMdPatch(makeClaudeMdRec());
    expect(result).not.toBeNull();
    expect(result!.content).toMatch(/^- /m);
  });

  it('for scan_redundancy: diff contains suggested consolidation action', () => {
    const rec = makeClaudeMdRec({
      pattern_type: 'scan_redundancy',
      title: 'Redundant eslint config',
      suggested_action: 'Consolidate eslint configurations into one block.',
    });
    const result = generateClaudeMdPatch(rec);
    expect(result).not.toBeNull();
    expect(result!.content).toContain(
      'Consolidate eslint configurations into one block.',
    );
  });

  it('for generic CLAUDE_MD recs: diff contains + ## <rec.title> addition line', () => {
    const rec = makeClaudeMdRec({
      pattern_type: 'config_drift',
      title: 'Update build configuration',
      suggested_action: 'Add build command documentation.',
    });
    const result = generateClaudeMdPatch(rec);
    expect(result).not.toBeNull();
    expect(result!.content).toContain('+ ## Update build configuration');
  });

  it('returns null when rec.target is not CLAUDE_MD', () => {
    const result = generateClaudeMdPatch(
      makeClaudeMdRec({ target: 'HOOK' }),
    );
    expect(result).toBeNull();
  });

  it('generated artifact passes generatedArtifactSchema.parse()', () => {
    const result = generateClaudeMdPatch(makeClaudeMdRec());
    expect(result).not.toBeNull();
    expect(() => generatedArtifactSchema.parse(result)).not.toThrow();
  });

  it('filename is CLAUDE.md', () => {
    const result = generateClaudeMdPatch(makeClaudeMdRec());
    expect(result).not.toBeNull();
    expect(result!.filename).toBe('CLAUDE.md');
  });

  it('source_recommendation_id matches input rec.id', () => {
    const result = generateClaudeMdPatch(
      makeClaudeMdRec({ id: 'rec-stale-custom-99' }),
    );
    expect(result).not.toBeNull();
    expect(result!.source_recommendation_id).toBe('rec-stale-custom-99');
  });
});
