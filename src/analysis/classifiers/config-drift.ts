// Classifier for configuration drift detection.
// Detects potential conflicts and redundancies in the user's Claude Code
// configuration: hook-rule overlaps, multiple CLAUDE.md files, and
// excessive hook counts.

import type { Summary, EnvironmentSnapshot } from '../schemas.js';
import type { Recommendation, AnalysisConfig } from '../../schemas/recommendation.js';

// Threshold for excessive hooks across all scopes
const MAX_HOOKS_BEFORE_REVIEW = 10;

/**
 * Classify configuration drift patterns.
 *
 * All config drift recommendations are LOW confidence.
 *
 * Check 1: Hook-Rule overlap -- hooks and rules with matching names/events
 *          suggest duplicated behavior that should be consolidated.
 * Check 2: Multiple CLAUDE.md -- multiple existing CLAUDE.md files may
 *          contain contradictory instructions.
 * Check 3: Hook count heuristic -- more than 10 hooks suggests potential
 *          redundancy that warrants review.
 */
export function classifyConfigDrift(
  _summary: Summary,
  snapshot: EnvironmentSnapshot,
  _config: AnalysisConfig,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  // Check 1: Hook-Rule overlap
  const hookEvents = new Set(snapshot.installed_tools.hooks.map(h => h.event));
  const ruleNames = new Set(snapshot.installed_tools.rules.map(r => r.name));

  for (const overlap of hookEvents) {
    if (!ruleNames.has(overlap)) continue;

    recommendations.push({
      id: `rec-drift-${index}`,
      target: 'RULE',
      confidence: 'LOW',
      pattern_type: 'config_drift',
      title: `Hook-rule overlap detected: "${overlap}"`,
      description: `Both a hook (event: "${overlap}") and a rule (name: "${overlap}") exist. This may indicate duplicated behavior that should be consolidated into one mechanism.`,
      evidence: {
        count: 2,
        examples: [`Hook event: ${overlap}`, `Rule name: ${overlap}`],
      },
      suggested_action: `Review the hook and rule for "${overlap}". If they serve the same purpose, consolidate into the more appropriate mechanism (hooks for 100% reliability, rules for guidance).`,
    });

    index++;
  }

  // Check 2: Multiple CLAUDE.md files
  const existingClaudeMd = snapshot.installed_tools.claude_md.filter(c => c.exists);
  if (existingClaudeMd.length > 1) {
    recommendations.push({
      id: `rec-drift-${index}`,
      target: 'CLAUDE_MD',
      confidence: 'LOW',
      pattern_type: 'config_drift',
      title: `Multiple CLAUDE.md files detected (${existingClaudeMd.length})`,
      description: `Found ${existingClaudeMd.length} existing CLAUDE.md files. Multiple CLAUDE.md files may contain contradictory instructions. Review for consistency.`,
      evidence: {
        count: existingClaudeMd.length,
        examples: existingClaudeMd.slice(0, 3).map(c => c.path),
      },
      suggested_action: 'Review all CLAUDE.md files for contradictions or redundancies. Consider consolidating shared instructions into the most appropriate scope.',
    });

    index++;
  }

  // Check 3: Hook count heuristic
  if (snapshot.installed_tools.hooks.length > MAX_HOOKS_BEFORE_REVIEW) {
    recommendations.push({
      id: `rec-drift-${index}`,
      target: 'HOOK',
      confidence: 'LOW',
      pattern_type: 'config_drift',
      title: `Excessive hook count (${snapshot.installed_tools.hooks.length} hooks)`,
      description: `Found ${snapshot.installed_tools.hooks.length} hooks across all scopes. This many hooks may indicate redundancy or performance concerns. Review for consolidation.`,
      evidence: {
        count: snapshot.installed_tools.hooks.length,
        examples: snapshot.installed_tools.hooks.slice(0, 3).map(h => `${h.event} (${h.scope})`),
      },
      suggested_action: 'Review all hooks for overlapping functionality. Consider combining hooks that trigger on the same event or serve similar purposes.',
    });
  }

  return recommendations;
}
