import { z } from 'zod/v4';

export const counterSchema = z.object({
  total: z.number().default(0),
  session: z.record(z.string(), z.number()).default({}),
  last_analysis: z.iso.datetime().optional(),
  last_updated: z.iso.datetime(),
});
export type Counter = z.infer<typeof counterSchema>;
