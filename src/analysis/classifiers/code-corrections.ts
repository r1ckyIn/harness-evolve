// Classifier for code correction patterns.
// Detects high-usage code-modification tools (Write, Edit, MultiEdit) and
// recommends creating rules to standardize recurring modification patterns.
// This is a LOW-confidence heuristic: the summary pre-aggregates tool usage
// without per-tool failure rates, so we use a simplified approach.

import type { Summary, EnvironmentSnapshot } from '../schemas.js';
import type { Recommendation, AnalysisConfig } from '../../schemas/recommendation.js';

// Tools that modify code -- high usage suggests recurring patterns
const CODE_MODIFICATION_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

// Minimum usage count to suggest rule creation (heuristic threshold)
const HIGH_USAGE_THRESHOLD = 20;

/**
 * Classify code correction patterns as RULE recommendations.
 *
 * LOW confidence: code-modification tool count >= 20 uses.
 *
 * Since summary.tool_frequency does not track per-tool failure rates,
 * this classifier uses a simplified heuristic: tools that modify files
 * (Write, Edit, MultiEdit) with high usage counts are candidates for
 * coding rules or conventions.
 */
export function classifyCodeCorrections(
  summary: Summary,
  _snapshot: EnvironmentSnapshot,
  _config: AnalysisConfig,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  for (const entry of summary.tool_frequency) {
    // Only consider code-modification tools
    if (!CODE_MODIFICATION_TOOLS.has(entry.tool_name)) continue;

    // Require high usage count as a proxy for recurring patterns
    if (entry.count < HIGH_USAGE_THRESHOLD) continue;

    recommendations.push({
      id: `rec-correction-${index}`,
      target: 'RULE',
      confidence: 'LOW',
      pattern_type: 'code_correction',
      title: `Frequent code modifications with ${entry.tool_name} (${entry.count} uses)`,
      description: `The ${entry.tool_name} tool has been used ${entry.count} times. Review for recurring patterns that could become a coding rule or convention.`,
      evidence: {
        count: entry.count,
        examples: [entry.tool_name],
      },
      suggested_action: `Review recent ${entry.tool_name} usage for recurring patterns. If a consistent code style or approach emerges, create a rule in .claude/rules/.`,
    });

    index++;
  }

  return recommendations;
}
