// Delivery schemas for recommendation state tracking and auto-apply logging.
// Defines: recommendation status lifecycle (pending/applied/dismissed),
// state entries persisted in JSON, and auto-apply audit log entries.

import { z } from 'zod/v4';

export const recommendationStatusSchema = z.enum(['pending', 'applied', 'dismissed']);
export type RecommendationStatus = z.infer<typeof recommendationStatusSchema>;

export const recommendationStateEntrySchema = z.object({
  id: z.string(),
  status: recommendationStatusSchema,
  updated_at: z.iso.datetime(),
  applied_details: z.string().optional(),
});
export type RecommendationStateEntry = z.infer<typeof recommendationStateEntrySchema>;

export const recommendationStateSchema = z.object({
  entries: z.array(recommendationStateEntrySchema),
  last_updated: z.iso.datetime(),
});
export type RecommendationState = z.infer<typeof recommendationStateSchema>;

export const autoApplyLogEntrySchema = z.object({
  timestamp: z.iso.datetime(),
  recommendation_id: z.string(),
  target: z.string(),
  action: z.string(),
  success: z.boolean(),
  details: z.string().optional(),
  backup_path: z.string().optional(),
});
export type AutoApplyLogEntry = z.infer<typeof autoApplyLogEntrySchema>;
