// CLAUDE.md patch generator: converts CLAUDE_MD-targeted recommendations
// into simplified unified diff format patches. Handles scan_stale_reference,
// scan_redundancy, and generic CLAUDE_MD pattern types. Pure function --
// no filesystem access, no side effects. Returns null for non-applicable
// recommendations.

import type { Recommendation } from '../schemas/recommendation.js';
import type { GeneratedArtifact } from './schemas.js';
import { GENERATOR_VERSION, nowISO } from './schemas.js';

/**
 * Build a patch for stale reference removal.
 * Shows the stale reference as a removed line and a comment replacement.
 */
function buildStaleReferencePatch(rec: Recommendation): string {
  const staleRef = rec.evidence.examples[0] ?? '';
  return [
    '--- a/CLAUDE.md',
    '+++ b/CLAUDE.md',
    '@@ Stale reference removal @@',
    `- ${staleRef}`,
    `+ # (removed stale reference: ${staleRef})`,
  ].join('\n');
}

/**
 * Build a patch for redundancy consolidation.
 * Shows the suggested consolidation action as added lines.
 */
function buildRedundancyPatch(rec: Recommendation): string {
  return [
    '--- a/CLAUDE.md',
    '+++ b/CLAUDE.md',
    `@@ Redundancy consolidation: ${rec.title} @@`,
    '+ # Consolidation needed',
    '+',
    `+ ${rec.suggested_action}`,
  ].join('\n');
}

/**
 * Build a generic patch for other CLAUDE_MD recommendations.
 * Adds a new section with the recommendation title and suggested action.
 */
function buildGenericPatch(rec: Recommendation): string {
  return [
    '--- a/CLAUDE.md',
    '+++ b/CLAUDE.md',
    `@@ ${rec.title} @@`,
    `+ ## ${rec.title}`,
    '+',
    `+ ${rec.suggested_action}`,
  ].join('\n');
}

/**
 * Generate a CLAUDE.md patch from a CLAUDE_MD-targeted recommendation.
 *
 * @param rec - A Recommendation object (from deep scan or analysis classifiers)
 * @returns GeneratedArtifact with type 'claude_md_patch', or null if the
 *          recommendation is not applicable (wrong target)
 */
export function generateClaudeMdPatch(
  rec: Recommendation,
): GeneratedArtifact | null {
  if (rec.target !== 'CLAUDE_MD') return null;

  let patchContent: string;

  switch (rec.pattern_type) {
    case 'scan_stale_reference':
      patchContent = buildStaleReferencePatch(rec);
      break;
    case 'scan_redundancy':
      patchContent = buildRedundancyPatch(rec);
      break;
    default:
      patchContent = buildGenericPatch(rec);
      break;
  }

  return {
    type: 'claude_md_patch',
    filename: 'CLAUDE.md',
    content: patchContent,
    source_recommendation_id: rec.id,
    metadata: {
      generated_at: nowISO(),
      generator_version: GENERATOR_VERSION,
      pattern_type: rec.pattern_type,
    },
  };
}
