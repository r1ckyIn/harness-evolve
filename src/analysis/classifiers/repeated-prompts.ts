// Classifier for repeated short prompts.
// Detects prompts used multiple times across sessions and recommends
// creating a hook for automation. Short = under 50 words.

import type { Summary, EnvironmentSnapshot } from '../schemas.js';
import type { Recommendation, AnalysisConfig } from '../../schemas/recommendation.js';

/**
 * Truncate a string to maxLen characters, adding ellipsis if truncated.
 */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Classify repeated short prompts (< 50 words) as HOOK recommendations.
 *
 * HIGH confidence: count >= 10 AND sessions >= 3
 * MEDIUM confidence: count >= 5 (already past min threshold)
 *
 * Skips prompts with word count > 50 (handled by long-prompts classifier).
 */
export function classifyRepeatedPrompts(
  summary: Summary,
  _snapshot: EnvironmentSnapshot,
  config: AnalysisConfig,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const threshold = config.thresholds.repeated_prompt_min_count;

  for (let i = 0; i < summary.top_repeated_prompts.length; i++) {
    const entry = summary.top_repeated_prompts[i];

    if (entry.count < threshold) continue;

    // Skip long prompts -- handled by long-prompts classifier
    const wordCount = entry.prompt.split(/\s+/).length;
    if (wordCount > 50) continue;

    const confidence: 'HIGH' | 'MEDIUM' =
      entry.count >= config.thresholds.repeated_prompt_high_count &&
      entry.sessions >= config.thresholds.repeated_prompt_high_sessions
        ? 'HIGH'
        : 'MEDIUM';

    const truncatedPrompt = truncate(entry.prompt, 60);

    recommendations.push({
      id: `rec-repeated-${i}`,
      target: 'HOOK',
      confidence,
      pattern_type: 'repeated_prompt',
      title: `Repeated prompt: "${truncatedPrompt}"`,
      description: `This prompt has been used ${entry.count} times across ${entry.sessions} sessions. Consider creating a hook or alias to automate this.`,
      evidence: {
        count: entry.count,
        sessions: entry.sessions,
        examples: [entry.prompt],
      },
      suggested_action: `Create a UserPromptSubmit hook that detects "${truncatedPrompt}" and auto-executes the intended action.`,
    });
  }

  return recommendations;
}
