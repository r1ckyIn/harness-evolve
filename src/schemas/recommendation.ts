// Recommendation and analysis result schemas.
// Defines the output contracts for the analysis engine: routing targets,
// confidence tiers, recommendation structure, and analysis configuration.

import { z } from 'zod/v4';

export const routingTargetSchema = z.enum([
  'HOOK',
  'SKILL',
  'RULE',
  'CLAUDE_MD',
  'MEMORY',
  'SETTINGS',
]);
export type RoutingTarget = z.infer<typeof routingTargetSchema>;

export const confidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type Confidence = z.infer<typeof confidenceSchema>;

export const recommendationSchema = z.object({
  id: z.string(),
  target: routingTargetSchema,
  confidence: confidenceSchema,
  pattern_type: z.string(),
  title: z.string(),
  description: z.string(),
  evidence: z.object({
    count: z.number(),
    sessions: z.number().optional(),
    examples: z.array(z.string()).max(3),
  }),
  suggested_action: z.string(),
  ecosystem_context: z.string().optional(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

// Default threshold values for classifiers
const DEFAULT_THRESHOLDS = {
  repeated_prompt_min_count: 5,
  repeated_prompt_high_count: 10,
  repeated_prompt_high_sessions: 3,
  repeated_prompt_medium_sessions: 2,
  long_prompt_min_words: 200,
  long_prompt_min_count: 2,
  long_prompt_high_words: 300,
  long_prompt_high_count: 3,
  permission_approval_min_count: 10,
  permission_approval_min_sessions: 3,
  permission_approval_high_count: 15,
  permission_approval_high_sessions: 4,
  code_correction_min_failure_rate: 0.3,
  code_correction_min_failures: 3,
} as const;

export const analysisConfigSchema = z.object({
  thresholds: z.object({
    repeated_prompt_min_count: z.number().default(DEFAULT_THRESHOLDS.repeated_prompt_min_count),
    repeated_prompt_high_count: z.number().default(DEFAULT_THRESHOLDS.repeated_prompt_high_count),
    repeated_prompt_high_sessions: z.number().default(DEFAULT_THRESHOLDS.repeated_prompt_high_sessions),
    repeated_prompt_medium_sessions: z.number().default(DEFAULT_THRESHOLDS.repeated_prompt_medium_sessions),
    long_prompt_min_words: z.number().default(DEFAULT_THRESHOLDS.long_prompt_min_words),
    long_prompt_min_count: z.number().default(DEFAULT_THRESHOLDS.long_prompt_min_count),
    long_prompt_high_words: z.number().default(DEFAULT_THRESHOLDS.long_prompt_high_words),
    long_prompt_high_count: z.number().default(DEFAULT_THRESHOLDS.long_prompt_high_count),
    permission_approval_min_count: z.number().default(DEFAULT_THRESHOLDS.permission_approval_min_count),
    permission_approval_min_sessions: z.number().default(DEFAULT_THRESHOLDS.permission_approval_min_sessions),
    permission_approval_high_count: z.number().default(DEFAULT_THRESHOLDS.permission_approval_high_count),
    permission_approval_high_sessions: z.number().default(DEFAULT_THRESHOLDS.permission_approval_high_sessions),
    code_correction_min_failure_rate: z.number().default(DEFAULT_THRESHOLDS.code_correction_min_failure_rate),
    code_correction_min_failures: z.number().default(DEFAULT_THRESHOLDS.code_correction_min_failures),
  }).default(() => ({ ...DEFAULT_THRESHOLDS })),
  max_recommendations: z.number().default(20),
}).default(() => ({
  thresholds: { ...DEFAULT_THRESHOLDS },
  max_recommendations: 20,
}));
export type AnalysisConfig = z.infer<typeof analysisConfigSchema>;

export const analysisResultSchema = z.object({
  generated_at: z.iso.datetime(),
  summary_period: z.object({
    since: z.string(),
    until: z.string(),
    days: z.number(),
  }),
  recommendations: z.array(recommendationSchema),
  metadata: z.object({
    classifier_count: z.number(),
    patterns_evaluated: z.number(),
    environment_ecosystems: z.array(z.string()),
    claude_code_version: z.string(),
  }),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
