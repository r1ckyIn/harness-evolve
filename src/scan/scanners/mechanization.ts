// Mechanization scanner for deep scan module.
// Detects operations described in rules/CLAUDE.md text that should be
// enforced via hooks for 100% reliable execution.

import type { ScanContext } from '../schemas.js';
import type { Recommendation } from '../../schemas/recommendation.js';

/**
 * Patterns in rule/CLAUDE.md text that suggest hookable operations.
 * Each indicator maps a text pattern to the hook event that could enforce it.
 */
export const MECHANIZATION_INDICATORS = [
  { regex: /always\s+run\s+["`']?(\S+)/i, hookEvent: 'PreToolUse', label: 'always run' },
  {
    regex: /before\s+committing?,?\s+run\s+["`']?(\S+)/i,
    hookEvent: 'PreToolUse',
    label: 'pre-commit check',
  },
  {
    regex: /after\s+every\s+(?:edit|change|write)/i,
    hookEvent: 'PostToolUse',
    label: 'post-edit action',
  },
  {
    regex: /must\s+(?:always\s+)?check\s+["`']?(\S+)/i,
    hookEvent: 'PreToolUse',
    label: 'mandatory check',
  },
  {
    regex: /never\s+(?:allow|permit|run)\s+["`']?(\S+)/i,
    hookEvent: 'PreToolUse',
    label: 'forbidden operation',
  },
  {
    regex: /forbidden.*(?:rm\s+-rf|drop\s+|delete\s+|truncate)/i,
    hookEvent: 'PreToolUse',
    label: 'dangerous command guard',
  },
] as const;

/**
 * Scan for operations described in text that should be enforced via hooks.
 * Skips patterns that are already covered by a registered hook for the
 * corresponding event type.
 */
export function scanMechanization(context: ScanContext): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  // Collect all text sources: CLAUDE.md files and rule files
  const allTextSources = [
    ...context.claude_md_files.map(f => ({ content: f.content, source: f.path })),
    ...context.rules.map(r => ({ content: r.content, source: r.path })),
  ];

  for (const source of allTextSources) {
    for (const indicator of MECHANIZATION_INDICATORS) {
      const match = source.content.match(indicator.regex);
      if (!match) continue;

      // Check if a hook already covers this event
      const alreadyCovered = context.hooks_registered.some(
        h => h.event === indicator.hookEvent,
      );
      if (alreadyCovered) continue;

      recommendations.push({
        id: `rec-scan-mechanize-${index++}`,
        target: 'HOOK',
        confidence: 'MEDIUM',
        pattern_type: 'scan_missing_mechanization',
        title: `Mechanizable rule: "${match[0].substring(0, 60)}"`,
        description:
          `Found a rule in ${source.source} that describes an operation ` +
          `suitable for a ${indicator.hookEvent} hook: "${match[0]}". ` +
          'Hooks provide 100% reliable execution, while rules depend on ' +
          "Claude's probabilistic compliance.",
        evidence: {
          count: 1,
          examples: [match[0].substring(0, 100)],
        },
        suggested_action:
          `Create a ${indicator.hookEvent} hook to enforce this rule ` +
          `automatically. See Claude Code hooks docs for ${indicator.hookEvent} event.`,
      });
    }
  }

  return recommendations;
}
