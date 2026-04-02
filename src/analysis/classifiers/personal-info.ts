// Classifier for personal information mentions.
// Detects prompts containing personal keywords (name, location, preferences)
// and recommends storing them in memory for automatic context.

import type { Summary, EnvironmentSnapshot } from '../schemas.js';
import type { Recommendation, AnalysisConfig } from '../../schemas/recommendation.js';

// Keywords that indicate personal information or preferences
const PERSONAL_KEYWORDS = [
  'my name is',
  'i live in',
  'i work at',
  'i prefer',
  'my email',
  'my project',
  'always use',
  'never use',
];

// Minimum repeat count to avoid flagging one-off mentions
const MIN_COUNT = 2;

/**
 * Classify personal info mentions as MEMORY recommendations.
 *
 * LOW confidence for all matches -- keyword matching is inherently heuristic.
 *
 * Deduplicates by keyword: each keyword produces at most one recommendation,
 * using the first matching prompt as the example.
 */
export function classifyPersonalInfo(
  summary: Summary,
  _snapshot: EnvironmentSnapshot,
  _config: AnalysisConfig,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const matchedKeywords = new Set<string>();
  let index = 0;

  for (const entry of summary.top_repeated_prompts) {
    if (entry.count < MIN_COUNT) continue;

    const lowerPrompt = entry.prompt.toLowerCase();

    for (const keyword of PERSONAL_KEYWORDS) {
      if (matchedKeywords.has(keyword)) continue;
      if (!lowerPrompt.includes(keyword)) continue;

      matchedKeywords.add(keyword);

      recommendations.push({
        id: `rec-personal-${index}`,
        target: 'MEMORY',
        confidence: 'LOW',
        pattern_type: 'personal_info',
        title: `Personal preference detected: "${keyword}..."`,
        description: `A prompt mentioning personal information ("${keyword}") has appeared ${entry.count} times. Consider storing this in memory for automatic context.`,
        evidence: {
          count: entry.count,
          sessions: entry.sessions,
          examples: [entry.prompt],
        },
        suggested_action: 'Add this information to memory (e.g., CLAUDE.md or a memory file) so Claude Code can use it without being reminded.',
      });

      index++;
    }
  }

  return recommendations;
}
