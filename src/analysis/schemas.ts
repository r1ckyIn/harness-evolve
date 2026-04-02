// Output schemas for analysis results.
// Defines the shape of summary.json and environment-snapshot.json.

import { z } from 'zod/v4';

// Summary schema: aggregated usage statistics from log pre-processing
export const summarySchema = z.object({
  generated_at: z.iso.datetime(),
  period: z.object({
    since: z.string(), // YYYY-MM-DD
    until: z.string(), // YYYY-MM-DD
    days: z.number(),
  }),
  stats: z.object({
    total_prompts: z.number(),
    total_tool_uses: z.number(),
    total_permissions: z.number(),
    unique_sessions: z.number(),
  }),
  top_repeated_prompts: z
    .array(
      z.object({
        prompt: z.string(),
        count: z.number(),
        sessions: z.number(),
      }),
    )
    .max(20),
  tool_frequency: z.array(
    z.object({
      tool_name: z.string(),
      count: z.number(),
      avg_duration_ms: z.number().optional(),
    }),
  ),
  permission_patterns: z.array(
    z.object({
      tool_name: z.string(),
      count: z.number(),
      sessions: z.number(),
    }),
  ),
  long_prompts: z
    .array(
      z.object({
        prompt_preview: z.string(),
        length: z.number(),
        count: z.number(),
      }),
    )
    .max(10),
});
export type Summary = z.infer<typeof summarySchema>;

// Environment snapshot schema: discovered tools, settings, and ecosystems
export const environmentSnapshotSchema = z.object({
  generated_at: z.iso.datetime(),
  claude_code: z.object({
    version: z.string(),
    version_known: z.boolean(),
    compatible: z.boolean(),
  }),
  settings: z.object({
    user: z.unknown().nullable(),
    project: z.unknown().nullable(),
    local: z.unknown().nullable(),
  }),
  installed_tools: z.object({
    plugins: z.array(
      z.object({
        name: z.string(),
        marketplace: z.string(),
        enabled: z.boolean(),
        scope: z.string(),
        capabilities: z.array(z.string()),
      }),
    ),
    skills: z.array(
      z.object({
        name: z.string(),
        scope: z.enum(['user', 'project']),
      }),
    ),
    rules: z.array(
      z.object({
        name: z.string(),
        scope: z.enum(['user', 'project']),
      }),
    ),
    hooks: z.array(
      z.object({
        event: z.string(),
        scope: z.enum(['user', 'project', 'local']),
        type: z.string(),
      }),
    ),
    claude_md: z.array(
      z.object({
        path: z.string(),
        exists: z.boolean(),
      }),
    ),
  }),
  detected_ecosystems: z.array(z.string()),
});
export type EnvironmentSnapshot = z.infer<typeof environmentSnapshotSchema>;
