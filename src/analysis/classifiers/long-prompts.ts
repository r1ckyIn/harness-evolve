// Classifier for long repeated prompts.
// Detects prompts with high word count that are repeated, and recommends
// converting them into a reusable skill.

import type { Summary, EnvironmentSnapshot } from '../schemas.js';
import type { Recommendation, AnalysisConfig } from '../../schemas/recommendation.js';

/**
 * Classify long repeated prompts as SKILL recommendations.
 *
 * HIGH confidence: length >= 300 words AND count >= 3
 * MEDIUM confidence: length >= 200 words AND count >= 2 (past min thresholds)
 *
 * Skips entries below long_prompt_min_words or long_prompt_min_count.
 */
export function classifyLongPrompts(
  summary: Summary,
  _snapshot: EnvironmentSnapshot,
  config: AnalysisConfig,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (let i = 0; i < summary.long_prompts.length; i++) {
    const entry = summary.long_prompts[i];

    if (entry.length < config.thresholds.long_prompt_min_words) continue;
    if (entry.count < config.thresholds.long_prompt_min_count) continue;

    const confidence: 'HIGH' | 'MEDIUM' =
      entry.count >= config.thresholds.long_prompt_high_count &&
      entry.length >= config.thresholds.long_prompt_high_words
        ? 'HIGH'
        : 'MEDIUM';

    recommendations.push({
      id: `rec-long-${i}`,
      target: 'SKILL',
      confidence,
      pattern_type: 'long_prompt',
      title: `Long repeated prompt (${entry.length} words, ${entry.count}x)`,
      description: `A ${entry.length}-word prompt has been used ${entry.count} times. Consider converting it to a reusable skill.`,
      evidence: {
        count: entry.count,
        examples: [entry.prompt_preview],
      },
      suggested_action: 'Create a skill in .claude/skills/ that encapsulates this prompt as a reusable workflow.',
    });
  }

  return recommendations;
}
