// Classifier for permission approval patterns.
// Detects tools that are frequently approved across multiple sessions
// and recommends adding them to allowedTools in settings.json.

import type { Summary, EnvironmentSnapshot } from '../schemas.js';
import type { Recommendation, AnalysisConfig } from '../../schemas/recommendation.js';

/**
 * Classify permission approval patterns as SETTINGS recommendations.
 *
 * HIGH confidence: count >= 15 AND sessions >= 4
 * MEDIUM confidence: count >= 10 AND sessions >= 3 (past min thresholds)
 *
 * Skips entries below permission_approval_min_count or permission_approval_min_sessions.
 */
export function classifyPermissionPatterns(
  summary: Summary,
  _snapshot: EnvironmentSnapshot,
  config: AnalysisConfig,
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (let i = 0; i < summary.permission_patterns.length; i++) {
    const entry = summary.permission_patterns[i];

    if (entry.count < config.thresholds.permission_approval_min_count) continue;
    if (entry.sessions < config.thresholds.permission_approval_min_sessions) continue;

    const confidence: 'HIGH' | 'MEDIUM' =
      entry.count >= config.thresholds.permission_approval_high_count &&
      entry.sessions >= config.thresholds.permission_approval_high_sessions
        ? 'HIGH'
        : 'MEDIUM';

    recommendations.push({
      id: `rec-permission-always-approved-${i}`,
      target: 'SETTINGS',
      confidence,
      pattern_type: 'permission-always-approved',
      title: `Frequently approved tool: ${entry.tool_name}`,
      description: `You have approved "${entry.tool_name}" ${entry.count} times across ${entry.sessions} sessions. Consider adding it to allowedTools in settings.json.`,
      evidence: {
        count: entry.count,
        sessions: entry.sessions,
        examples: [`${entry.tool_name} approved ${entry.count} times`],
      },
      suggested_action: `Add "${entry.tool_name}" to the "allow" array in ~/.claude/settings.json permissions.`,
    });
  }

  return recommendations;
}
