// Shared test helpers for analysis module tests.

import type { Summary } from '../../../src/analysis/schemas.js';
import type { EnvironmentSnapshot } from '../../../src/analysis/schemas.js';
import type { AnalysisConfig } from '../../../src/schemas/recommendation.js';
import { analysisConfigSchema } from '../../../src/schemas/recommendation.js';

/**
 * Create a valid Summary with empty data arrays.
 */
export function makeEmptySummary(): Summary {
  return {
    generated_at: '2026-04-01T00:00:00Z',
    period: {
      since: '2026-03-01',
      until: '2026-03-31',
      days: 30,
    },
    stats: {
      total_prompts: 0,
      total_tool_uses: 0,
      total_permissions: 0,
      unique_sessions: 0,
    },
    top_repeated_prompts: [],
    tool_frequency: [],
    permission_patterns: [],
    long_prompts: [],
  };
}

/**
 * Create a valid EnvironmentSnapshot with empty data.
 */
export function makeEmptySnapshot(): EnvironmentSnapshot {
  return {
    generated_at: '2026-04-01T00:00:00Z',
    claude_code: {
      version: '2.1.0',
      version_known: true,
      compatible: true,
    },
    settings: {
      user: null,
      project: null,
      local: null,
    },
    installed_tools: {
      plugins: [],
      skills: [],
      rules: [],
      hooks: [],
      claude_md: [],
    },
    detected_ecosystems: [],
  };
}

/**
 * Create default AnalysisConfig by parsing empty object.
 */
export function makeDefaultConfig(): AnalysisConfig {
  return analysisConfigSchema.parse({});
}
