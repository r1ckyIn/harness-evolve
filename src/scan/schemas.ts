// Scan module schemas.
// Defines the ScanContext shape that captures all Claude Code configuration
// sources (CLAUDE.md, rules, settings, commands, hooks) for deep analysis.

import { z } from 'zod/v4';

export const scanContextSchema = z.object({
  generated_at: z.iso.datetime(),
  project_root: z.string(),
  claude_md_files: z.array(
    z.object({
      path: z.string(),
      scope: z.enum(['user', 'project', 'local']),
      content: z.string(),
      line_count: z.number(),
      headings: z.array(z.string()),
      references: z.array(z.string()),
    }),
  ),
  rules: z.array(
    z.object({
      path: z.string(),
      filename: z.string(),
      content: z.string(),
      frontmatter: z
        .object({
          paths: z.array(z.string()).optional(),
        })
        .optional(),
      headings: z.array(z.string()),
    }),
  ),
  settings: z.object({
    user: z.unknown().nullable(),
    project: z.unknown().nullable(),
    local: z.unknown().nullable(),
  }),
  commands: z.array(
    z.object({
      path: z.string(),
      name: z.string(),
      content: z.string(),
    }),
  ),
  hooks_registered: z.array(
    z.object({
      event: z.string(),
      scope: z.enum(['user', 'project', 'local']),
      type: z.string(),
      command: z.string().optional(),
    }),
  ),
});
export type ScanContext = z.infer<typeof scanContextSchema>;
