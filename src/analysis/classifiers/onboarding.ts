// Classifier for tiered onboarding detection.
// Produces tier-appropriate recommendations based on user experience level:
// newcomer (score=0) gets "start here" guidance for missing config,
// power_user (score>=30) gets "optimize" suggestions,
// intermediate (1-29) gets no onboarding-specific recs (handled by other classifiers).

import type { Summary, EnvironmentSnapshot } from '../schemas.js';
import type { Recommendation, AnalysisConfig } from '../../schemas/recommendation.js';
import { computeExperienceLevel } from '../experience-level.js';

/**
 * Classify onboarding needs based on user experience tier.
 *
 * Newcomer (score=0): Up to 3 MEDIUM-confidence "start here" recommendations
 * for missing hooks, rules, and CLAUDE.md.
 *
 * Power user (score>=30): 1 LOW-confidence "optimize" recommendation
 * suggesting consolidation review.
 *
 * Intermediate (1-29): No recommendations (existing classifiers handle
 * pattern-specific suggestions).
 */
export function classifyOnboarding(
  _summary: Summary,
  snapshot: EnvironmentSnapshot,
  _config: AnalysisConfig,
): Recommendation[] {
  const level = computeExperienceLevel(snapshot);
  const recommendations: Recommendation[] = [];
  let index = 0;

  if (level.tier === 'newcomer') {
    // Suggest missing hooks
    if (level.breakdown.hooks === 0) {
      recommendations.push({
        id: `rec-onboarding-${index}`,
        target: 'HOOK',
        confidence: 'MEDIUM',
        pattern_type: 'onboarding_start_hooks',
        title: 'Start automating: create your first hook',
        description:
          'Hooks run automatically on Claude Code lifecycle events (pre-commit, tool use, session start). ' +
          'Start with a formatting or test-on-save hook to experience automation benefits.',
        evidence: {
          count: 0,
          examples: ['No hooks detected in your environment'],
        },
        suggested_action:
          'Add a hook in .claude/settings.json hooks section for automation.',
      });
      index++;
    }

    // Suggest missing rules
    if (level.breakdown.rules === 0) {
      recommendations.push({
        id: `rec-onboarding-${index}`,
        target: 'RULE',
        confidence: 'MEDIUM',
        pattern_type: 'onboarding_start_rules',
        title: 'Define coding preferences: add your first rule',
        description:
          'Rules (.claude/rules/) codify conventions that Claude follows automatically. ' +
          'They persist across sessions and ensure consistent behavior.',
        evidence: {
          count: 0,
          examples: ['No rules detected in your environment'],
        },
        suggested_action:
          'Create .claude/rules/ directory with a rule for your preferred coding style.',
      });
      index++;
    }

    // Suggest missing CLAUDE.md
    if (level.breakdown.claude_md === 0) {
      recommendations.push({
        id: `rec-onboarding-${index}`,
        target: 'CLAUDE_MD',
        confidence: 'MEDIUM',
        pattern_type: 'onboarding_start_claudemd',
        title: 'Set project context: create CLAUDE.md',
        description:
          'CLAUDE.md gives Claude project-specific context — tech stack, conventions, and constraints. ' +
          'It is loaded automatically at the start of every conversation.',
        evidence: {
          count: 0,
          examples: ['No CLAUDE.md files detected in your environment'],
        },
        suggested_action:
          'Create CLAUDE.md in your project root with project description and conventions.',
      });
    }
  } else if (level.tier === 'power_user') {
    recommendations.push({
      id: 'rec-onboarding-3',
      target: 'SETTINGS',
      confidence: 'LOW',
      pattern_type: 'onboarding_optimize',
      title: 'Consider mechanizing recurring patterns',
      description:
        'Your extensive configuration suggests active automation investment. ' +
        'Review for redundancy or upgrade opportunities — hooks and rules with overlapping concerns can be consolidated.',
      evidence: {
        count: level.score,
        examples: [
          `${level.breakdown.hooks} hooks, ${level.breakdown.rules} rules, ${level.breakdown.plugins} plugins installed`,
        ],
      },
      suggested_action:
        'Review your hooks and rules for overlapping concerns that could be consolidated.',
    });
  }
  // Intermediate: return empty array

  return recommendations;
}
