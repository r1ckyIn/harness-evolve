// Main analysis orchestrator: iterates all registered classifiers,
// collects recommendations, sorts by confidence and evidence, caps
// at max_recommendations, and returns a validated AnalysisResult.

import { classifiers } from './classifiers/index.js';
import type { Summary, EnvironmentSnapshot } from './schemas.js';
import {
  analysisConfigSchema,
  analysisResultSchema,
  type AnalysisConfig,
  type AnalysisResult,
  type Recommendation,
} from '../schemas/recommendation.js';
import type { OutcomeSummary } from '../schemas/onboarding.js';

// Confidence tier numeric ordering for sorting (ascending = higher priority)
const CONFIDENCE_ORDER: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

/**
 * Sort recommendations by confidence (HIGH first), then by evidence.count
 * descending within the same tier.
 */
function sortRecommendations(a: Recommendation, b: Recommendation): number {
  const confDiff =
    (CONFIDENCE_ORDER[a.confidence] ?? 3) -
    (CONFIDENCE_ORDER[b.confidence] ?? 3);
  if (confDiff !== 0) return confDiff;
  return b.evidence.count - a.evidence.count;
}

/**
 * Adjust recommendation confidence based on historical outcome data.
 * Pattern types with >30% revert rate (persistence_rate < 0.7) get
 * downgraded by one tier: HIGH->MEDIUM, MEDIUM->LOW, LOW stays LOW.
 */
export function adjustConfidence(
  recommendations: Recommendation[],
  summaries: OutcomeSummary[],
): Recommendation[] {
  const rateByType = new Map(
    summaries.map((s) => [s.pattern_type, s.persistence_rate]),
  );

  return recommendations.map((rec) => {
    const rate = rateByType.get(rec.pattern_type);
    if (rate === undefined || rate >= 0.7) return rec;

    // Downgrade one tier
    const downgraded: Record<string, string> = {
      HIGH: 'MEDIUM',
      MEDIUM: 'LOW',
      LOW: 'LOW',
    };

    return {
      ...rec,
      confidence: (downgraded[rec.confidence] ??
        rec.confidence) as Recommendation['confidence'],
    };
  });
}

/**
 * Analyze a pre-processed summary and environment snapshot to produce
 * structured recommendations.
 *
 * @param summary - Pre-processed usage summary from pre-processor
 * @param snapshot - Environment snapshot from environment-scanner
 * @param config - Optional analysis configuration (defaults applied if omitted)
 * @param outcomeSummaries - Optional outcome summaries for confidence adjustment
 * @returns Validated AnalysisResult with sorted, capped recommendations
 */
export function analyze(
  summary: Summary,
  snapshot: EnvironmentSnapshot,
  config?: AnalysisConfig,
  outcomeSummaries?: OutcomeSummary[],
): AnalysisResult {
  const mergedConfig = config ?? analysisConfigSchema.parse({});

  // Collect recommendations from all classifiers
  const recommendations: Recommendation[] = [];
  for (const classify of classifiers) {
    const results = classify(summary, snapshot, mergedConfig);
    recommendations.push(...results);
  }

  // Adjust confidence based on outcome history (if provided)
  const adjusted =
    outcomeSummaries && outcomeSummaries.length > 0
      ? adjustConfidence(recommendations, outcomeSummaries)
      : recommendations;

  // Sort by confidence tier, then by evidence count
  adjusted.sort(sortRecommendations);

  // Cap at max_recommendations
  const capped = adjusted.slice(0, mergedConfig.max_recommendations);

  // Compute patterns_evaluated as sum of all pattern source arrays
  const patternsEvaluated =
    summary.top_repeated_prompts.length +
    summary.long_prompts.length +
    summary.permission_patterns.length +
    summary.tool_frequency.length;

  return analysisResultSchema.parse({
    generated_at: new Date().toISOString(),
    summary_period: summary.period,
    recommendations: capped,
    metadata: {
      classifier_count: classifiers.length,
      patterns_evaluated: patternsEvaluated,
      environment_ecosystems: snapshot.detected_ecosystems,
      claude_code_version: snapshot.claude_code.version,
    },
  });
}
