// Markdown renderer for analysis results.
// Produces structured recommendations grouped by confidence tier
// with status prefixes, evidence, and suggested actions.

import type { AnalysisResult } from '../schemas/recommendation.js';
import type { RecommendationStatus } from '../schemas/delivery.js';

const TIER_ORDER: readonly string[] = ['HIGH', 'MEDIUM', 'LOW'] as const;

/**
 * Render an AnalysisResult to a markdown string grouped by confidence tier.
 * Status prefixes (PENDING/APPLIED/DISMISSED) are looked up from the states map.
 */
export function renderRecommendations(
  result: AnalysisResult,
  states: Map<string, RecommendationStatus>,
): string {
  const lines: string[] = [];

  // Header
  lines.push('# harness-evolve Recommendations');
  lines.push('');
  lines.push(`*Generated: ${result.generated_at}*`);
  lines.push(
    `*Period: ${result.summary_period.since} to ${result.summary_period.until} (${result.summary_period.days} days)*`,
  );
  lines.push('');

  // Empty case
  if (result.recommendations.length === 0) {
    lines.push('No recommendations at this time.');
    lines.push('');
    lines.push('---');
    lines.push('*Run /evolve to refresh or manage recommendations.*');
    return lines.join('\n');
  }

  // Group by confidence tier
  for (const tier of TIER_ORDER) {
    const tierRecs = result.recommendations.filter(
      (r) => r.confidence === tier,
    );
    if (tierRecs.length === 0) continue;

    lines.push(`## ${tier} Confidence`);
    lines.push('');

    for (const rec of tierRecs) {
      const status = (states.get(rec.id) ?? 'pending').toUpperCase();

      lines.push(`### [${status}] ${rec.title}`);
      lines.push('');
      lines.push(`**Target:** ${rec.target} | **Pattern:** ${rec.pattern_type}`);

      // Evidence line
      const evidenceParts = [`${rec.evidence.count} occurrences`];
      if (rec.evidence.sessions !== undefined) {
        evidenceParts.push(`across ${rec.evidence.sessions} sessions`);
      }
      lines.push(`**Evidence:** ${evidenceParts.join(' ')}`);
      lines.push('');

      // Description
      lines.push(rec.description);
      lines.push('');

      // Evidence examples
      if (rec.evidence.examples.length > 0) {
        lines.push('**Examples:**');
        for (const ex of rec.evidence.examples) {
          lines.push(`- \`${ex}\``);
        }
        lines.push('');
      }

      // Suggested action
      lines.push(`**Suggested action:** ${rec.suggested_action}`);
      lines.push('');

      // Ecosystem context (optional)
      if (rec.ecosystem_context !== undefined) {
        lines.push(`**Ecosystem note:** ${rec.ecosystem_context}`);
        lines.push('');
      }
    }
  }

  // Footer
  lines.push('---');
  lines.push('*Run /evolve to refresh or manage recommendations.*');

  return lines.join('\n');
}
