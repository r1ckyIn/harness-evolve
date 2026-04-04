// Generator module schemas and shared utilities.
// Defines the GeneratedArtifact output contract for all generators,
// plus helper functions (toSlug, escapeYaml) used across generator implementations.

import { z } from 'zod/v4';

// Version stamp embedded in every generated artifact
export const GENERATOR_VERSION = '1.0.0';

// Return current time as ISO 8601 string
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Convert text to a URL/filename-safe slug.
 * Lowercases, replaces non-alphanumeric with hyphens,
 * collapses consecutive hyphens, strips leading/trailing hyphens,
 * and caps at 50 characters.
 */
export function toSlug(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// Characters that require quoting in YAML values
const YAML_SPECIAL = /[:"'{}[\]#&*!|>\\,\n]/;

/**
 * Escape a string for safe inclusion as a YAML frontmatter value.
 * Wraps in double quotes and escapes internal double quotes
 * when the text contains YAML-special characters.
 */
export function escapeYaml(text: string): string {
  if (!YAML_SPECIAL.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

export const generatedArtifactSchema = z.object({
  type: z.enum(['skill', 'hook', 'claude_md_patch']),
  filename: z.string(),
  content: z.string(),
  source_recommendation_id: z.string(),
  metadata: z.object({
    generated_at: z.iso.datetime(),
    generator_version: z.string(),
    pattern_type: z.string(),
  }),
});
export type GeneratedArtifact = z.infer<typeof generatedArtifactSchema>;

export interface GeneratorOptions {
  projectRoot?: string;
}
