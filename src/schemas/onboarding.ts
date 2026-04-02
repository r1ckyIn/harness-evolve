// Phase 6 schemas for onboarding detection and outcome tracking.
// Defines: experience tier classification, experience level with score
// breakdown, outcome tracking entries, and outcome summary aggregation.

import { z } from 'zod/v4';

// Experience level types
export const experienceTierSchema = z.enum(['newcomer', 'intermediate', 'power_user']);
export type ExperienceTier = z.infer<typeof experienceTierSchema>;

export const experienceLevelSchema = z.object({
  tier: experienceTierSchema,
  score: z.number().min(0).max(100),
  breakdown: z.object({
    hooks: z.number(),
    rules: z.number(),
    skills: z.number(),
    plugins: z.number(),
    claude_md: z.number(),
    ecosystems: z.number(),
  }),
});
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>;

// Outcome tracking types (used by Plan 02)
export const outcomeEntrySchema = z.object({
  recommendation_id: z.string(),
  pattern_type: z.string(),
  target: z.string(),
  applied_at: z.iso.datetime(),
  checked_at: z.iso.datetime(),
  persisted: z.boolean(),
  checks_since_applied: z.number(),
  outcome: z.enum(['positive', 'negative', 'monitoring']),
});
export type OutcomeEntry = z.infer<typeof outcomeEntrySchema>;

export const outcomeSummarySchema = z.object({
  pattern_type: z.string(),
  total_applied: z.number(),
  total_persisted: z.number(),
  total_reverted: z.number(),
  persistence_rate: z.number(),
});
export type OutcomeSummary = z.infer<typeof outcomeSummarySchema>;
