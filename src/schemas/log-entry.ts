import { z } from 'zod/v4';

export const promptEntrySchema = z.object({
  timestamp: z.iso.datetime(),
  session_id: z.string(),
  cwd: z.string(),
  prompt: z.string(),
  prompt_length: z.number(),
  transcript_path: z.string().optional(),
});
export type PromptEntry = z.infer<typeof promptEntrySchema>;

export const toolEntrySchema = z.object({
  timestamp: z.iso.datetime(),
  session_id: z.string(),
  event: z.enum(['pre', 'post', 'failure']),
  tool_name: z.string(),
  input_summary: z.string().optional(),
  duration_ms: z.number().optional(),
  success: z.boolean().optional(),
});
export type ToolEntry = z.infer<typeof toolEntrySchema>;

export const permissionEntrySchema = z.object({
  timestamp: z.iso.datetime(),
  session_id: z.string(),
  tool_name: z.string(),
  decision: z.enum(['approved', 'denied', 'unknown']),
});
export type PermissionEntry = z.infer<typeof permissionEntrySchema>;

export const sessionEntrySchema = z.object({
  timestamp: z.iso.datetime(),
  session_id: z.string(),
  event: z.enum(['start', 'end']),
  cwd: z.string().optional(),
});
export type SessionEntry = z.infer<typeof sessionEntrySchema>;
