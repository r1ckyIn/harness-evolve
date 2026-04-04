// Hook generator: converts HOOK-targeted recommendations into bash hook
// script drafts. Handles both scan_missing_mechanization and repeated_prompt
// pattern types. Pure function -- no filesystem access, no side effects.
// Returns null for non-applicable recommendations.

import type { Recommendation } from '../schemas/recommendation.js';
import type { GeneratedArtifact } from './schemas.js';
import { toSlug, GENERATOR_VERSION, nowISO } from './schemas.js';

/**
 * Extract the hook event name from a recommendation's description
 * or suggested_action field.
 *
 * Tries these patterns in order:
 * 1. "suitable for a <HookEvent> hook" in description
 * 2. "Create a <HookEvent> hook" in suggested_action
 * 3. Falls back to 'PreToolUse' if no match
 */
function extractHookEvent(rec: Recommendation): string {
  const descMatch = rec.description.match(/suitable for a (\w+) hook/i);
  if (descMatch) return descMatch[1];

  const actionMatch = rec.suggested_action.match(/Create a (\w+) hook/i);
  if (actionMatch) return actionMatch[1];

  return 'PreToolUse';
}

/**
 * Generate a bash hook script draft from a HOOK-targeted recommendation.
 *
 * @param rec - A Recommendation object (from mechanization scanner or repeated-prompts classifier)
 * @returns GeneratedArtifact with type 'hook', or null if the recommendation
 *          is not applicable (wrong target)
 */
export function generateHook(rec: Recommendation): GeneratedArtifact | null {
  if (rec.target !== 'HOOK') return null;

  const hookEvent = extractHookEvent(rec);
  const slugName = toSlug(rec.title);

  const content = [
    '#!/usr/bin/env bash',
    `# Auto-generated hook for: ${rec.title}`,
    `# Hook event: ${hookEvent}`,
    `# Source: harness-evolve (${rec.id})`,
    '#',
    '# TODO: Review and customize this script before use.',
    '',
    '# Read hook input from stdin',
    'INPUT=$(cat)',
    '',
    '# Extract relevant fields',
    `# Adjust jq path based on your ${hookEvent} event schema`,
    '',
    `# ${rec.suggested_action}`,
    '',
    '# Exit 0 to allow, exit 2 to block',
    'exit 0',
  ].join('\n');

  return {
    type: 'hook',
    filename: `.claude/hooks/evolve-${slugName}.sh`,
    content,
    source_recommendation_id: rec.id,
    metadata: {
      generated_at: nowISO(),
      generator_version: GENERATOR_VERSION,
      pattern_type: rec.pattern_type,
    },
  };
}
