import { z } from 'zod/v4';

// Common fields present in ALL Claude Code hook events
export const hookCommonSchema = z.object({
  session_id: z.string(),
  transcript_path: z.string(),
  cwd: z.string(),
  permission_mode: z.string(),
});
export type HookCommon = z.infer<typeof hookCommonSchema>;

// UserPromptSubmit: fires when user submits a prompt
export const userPromptSubmitInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('UserPromptSubmit'),
  prompt: z.string(),
});
export type UserPromptSubmitInput = z.infer<typeof userPromptSubmitInputSchema>;

// PreToolUse: fires before a tool is invoked
export const preToolUseInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('PreToolUse'),
  tool_name: z.string(),
  tool_input: z.record(z.string(), z.unknown()),
  tool_use_id: z.string(),
});
export type PreToolUseInput = z.infer<typeof preToolUseInputSchema>;

// PostToolUse: fires after a tool completes successfully
export const postToolUseInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('PostToolUse'),
  tool_name: z.string(),
  tool_input: z.record(z.string(), z.unknown()),
  tool_response: z.unknown().optional(),
  tool_use_id: z.string(),
});
export type PostToolUseInput = z.infer<typeof postToolUseInputSchema>;

// PostToolUseFailure: fires after a tool execution fails
export const postToolUseFailureInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('PostToolUseFailure'),
  tool_name: z.string(),
  tool_input: z.record(z.string(), z.unknown()),
  tool_use_id: z.string(),
  error: z.string().optional(),
  is_interrupt: z.boolean().optional(),
});
export type PostToolUseFailureInput = z.infer<typeof postToolUseFailureInputSchema>;

// PermissionRequest: fires before user sees permission dialog
export const permissionRequestInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('PermissionRequest'),
  tool_name: z.string(),
  tool_input: z.record(z.string(), z.unknown()),
  permission_suggestions: z.array(z.unknown()).optional(),
});
export type PermissionRequestInput = z.infer<typeof permissionRequestInputSchema>;

// Stop: fires after Claude Code completes a response
export const stopInputSchema = hookCommonSchema.extend({
  hook_event_name: z.literal('Stop'),
  stop_hook_active: z.boolean(),
  last_assistant_message: z.string().optional(),
});
export type StopInput = z.infer<typeof stopInputSchema>;
