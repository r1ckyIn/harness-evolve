// Classifier for ecosystem-aware routing adaptations.
// Produces recommendations based on detected ecosystems (GSD, Cog) and
// Claude Code version compatibility. Enhances routing suggestions with
// ecosystem-specific context.

import type { Summary, EnvironmentSnapshot } from '../schemas.js';
import type { Recommendation, AnalysisConfig } from '../../schemas/recommendation.js';

// Minimum prompt repeat count to consider it a multi-step workflow candidate
const MULTI_STEP_MIN_COUNT = 3;

/**
 * Classify ecosystem-specific adaptations and version recommendations.
 *
 * Version check (RTG-10): MEDIUM confidence when Claude Code version is
 * outside the tested compatible range.
 *
 * GSD ecosystem (RTG-09): LOW confidence SKILL recommendation when GSD
 * is detected and repeated multi-step prompts exist.
 *
 * Cog ecosystem (RTG-09): LOW confidence MEMORY recommendation when Cog
 * is detected, routing memory management to Cog tiers.
 */
export function classifyEcosystemAdaptations(
  summary: Summary,
  snapshot: EnvironmentSnapshot,
  _config: AnalysisConfig,
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  // Version check (RTG-10)
  if (
    snapshot.claude_code.version_known &&
    !snapshot.claude_code.compatible &&
    snapshot.claude_code.version !== 'unknown'
  ) {
    recommendations.push({
      id: `rec-ecosystem-${index}`,
      target: 'CLAUDE_MD',
      confidence: 'MEDIUM',
      pattern_type: 'version_update',
      title: `Claude Code version ${snapshot.claude_code.version} detected (outside tested range)`,
      description: `Your Claude Code version (${snapshot.claude_code.version}) is outside the tested compatible range. New features may be available that change optimal configuration strategies.`,
      evidence: {
        count: 1,
        examples: [`Version: ${snapshot.claude_code.version}`],
      },
      suggested_action: `Review Claude Code changelog for version ${snapshot.claude_code.version}. New hook events, permission models, or settings may require harness-evolve configuration updates.`,
    });
    index++;
  }

  // GSD ecosystem (RTG-09)
  if (snapshot.detected_ecosystems.includes('gsd')) {
    // Look for repeated multi-step prompts that could be GSD workflows
    const multiStepPrompts = summary.top_repeated_prompts.filter(
      p => p.count >= MULTI_STEP_MIN_COUNT,
    );

    if (multiStepPrompts.length > 0) {
      const topPrompt = multiStepPrompts[0];
      recommendations.push({
        id: `rec-ecosystem-${index}`,
        target: 'SKILL',
        confidence: 'LOW',
        pattern_type: 'ecosystem_gsd',
        title: 'GSD workflow detected -- consider /gsd slash commands',
        description: 'GSD is installed in this project. Repeated multi-step prompts may be better served by GSD planning phases or slash commands rather than standalone skills.',
        evidence: {
          count: multiStepPrompts.length,
          examples: [topPrompt.prompt],
        },
        suggested_action: 'Review repeated prompts and consider if they map to GSD phases (/gsd:plan-phase, /gsd:execute-phase) or custom slash commands.',
        ecosystem_context: 'GSD detected: Use /gsd slash commands and .planning patterns for multi-step workflows instead of standalone skills',
      });
      index++;
    }
  }

  // Cog ecosystem (RTG-09)
  if (snapshot.detected_ecosystems.includes('cog')) {
    recommendations.push({
      id: `rec-ecosystem-${index}`,
      target: 'MEMORY',
      confidence: 'LOW',
      pattern_type: 'ecosystem_cog',
      title: 'Cog memory system detected -- route memory to Cog tiers',
      description: "Cog is installed. Personal information and contextual preferences should be routed to Cog's tiered memory system rather than raw CLAUDE.md entries.",
      evidence: {
        count: 1,
        examples: ['Cog detected in ~/.claude/skills/'],
      },
      suggested_action: 'Use /reflect and /evolve Cog commands for memory management instead of manually editing CLAUDE.md.',
      ecosystem_context: 'Cog detected: Route memory entries to Cog tiers (/reflect, /evolve) instead of raw CLAUDE.md',
    });
  }

  return recommendations;
}
