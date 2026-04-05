// Commands convention scanner for deep scan module.
// Checks .claude/commands/ files for convention violations:
// empty files, missing frontmatter, missing description, and very short content.

import type { ScanContext } from '../schemas.js';
import type { Recommendation } from '../../schemas/recommendation.js';

/**
 * Extract YAML frontmatter key-value pairs from command content.
 * Returns null if no frontmatter delimiters (---) are found.
 */
function extractCommandFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const fields: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const kvMatch = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (kvMatch) fields[kvMatch[1]] = kvMatch[2].trim();
  }
  return fields;
}

/**
 * Extract content after frontmatter block.
 * If no frontmatter, returns the full content trimmed.
 */
function contentAfterFrontmatter(content: string): string {
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

/**
 * Scan for command file convention violations.
 * Checks for empty files, missing frontmatter, missing description,
 * and very short command content.
 */
export function scanCommands(context: ScanContext): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  for (const cmd of context.commands) {
    // Check 1: Empty command file
    if (cmd.content.trim().length === 0) {
      recommendations.push({
        id: `rec-scan-commands-${index++}`,
        target: 'RULE',
        confidence: 'HIGH',
        pattern_type: 'scan_command_convention',
        severity: 'problem',
        title: `Empty command file: ${cmd.name}`,
        description:
          `The command file at ${cmd.path} is empty. ` +
          `This slash command will do nothing when invoked.`,
        evidence: {
          count: 1,
          examples: [cmd.path],
        },
        suggested_action:
          `Remove the empty command file at ${cmd.path} or add instructions for Claude. ` +
          `Expected effect: eliminates a broken slash command that does nothing when invoked.`,
      });
      continue;
    }

    // Check 2: Missing frontmatter
    const frontmatter = extractCommandFrontmatter(cmd.content);
    if (frontmatter === null) {
      recommendations.push({
        id: `rec-scan-commands-${index++}`,
        target: 'RULE',
        confidence: 'MEDIUM',
        pattern_type: 'scan_command_convention',
        severity: 'suggestion',
        title: `Missing frontmatter in ${cmd.name} command`,
        description:
          `The command file at ${cmd.path} has no YAML frontmatter block. ` +
          `Frontmatter provides metadata for Claude to categorize the command.`,
        evidence: {
          count: 1,
          examples: [cmd.path],
        },
        suggested_action:
          `Add YAML frontmatter to ${cmd.name} command with at least 'name' and 'description' fields. ` +
          `Expected effect: Claude can categorize the command and show it in help listings.`,
      });
    } else {
      // Check 3: Missing description in frontmatter
      if (!frontmatter.description) {
        recommendations.push({
          id: `rec-scan-commands-${index++}`,
          target: 'RULE',
          confidence: 'MEDIUM',
          pattern_type: 'scan_command_convention',
          severity: 'suggestion',
          title: `Missing description in ${cmd.name} command frontmatter`,
          description:
            `The command file at ${cmd.path} has frontmatter but no 'description' field. ` +
            `A description helps users understand the command's purpose.`,
          evidence: {
            count: 1,
            examples: [cmd.path],
          },
          suggested_action:
            `Add a 'description' field to the frontmatter of ${cmd.name} command. ` +
            `Expected effect: users see a helpful summary when browsing available slash commands.`,
        });
      }
    }

    // Check 4: Very short content (< 50 chars after frontmatter)
    const body = contentAfterFrontmatter(cmd.content);
    if (body.length > 0 && body.length < 50) {
      recommendations.push({
        id: `rec-scan-commands-${index++}`,
        target: 'RULE',
        confidence: 'LOW',
        pattern_type: 'scan_command_convention',
        severity: 'suggestion',
        title: `Very short content in ${cmd.name} command (${body.length} chars)`,
        description:
          `The command file at ${cmd.path} has very little instruction content ` +
          `(${body.length} characters after frontmatter).`,
        evidence: {
          count: 1,
          examples: [cmd.path],
        },
        suggested_action:
          `The ${cmd.name} command has very little instruction content (${body.length} chars). ` +
          `Consider adding more detailed instructions. ` +
          `Expected effect: Claude follows more specific behavior when the command is invoked.`,
      });
    }
  }

  return recommendations;
}
