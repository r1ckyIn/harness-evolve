// Staleness scanner for deep scan module.
// Detects broken @references in CLAUDE.md files and hook commands
// pointing to non-existent scripts.

import type { ScanContext } from '../schemas.js';
import type { Recommendation } from '../../schemas/recommendation.js';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Check if a file exists on disk.
 */
async function fileExistsOnDisk(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract a file path from a hook command string.
 * Handles patterns like:
 *   node "path/to/script.js"
 *   node 'path/to/script.js'
 *   node path/to/script.js
 *   sh /path/to/script.sh
 *   /usr/bin/node /path/to/file.js
 */
function extractPathFromCommand(command: string): string | null {
  // Match quoted path: node "path" or node 'path'
  const quotedMatch = command.match(/(?:node|sh|bash|python)\s+["']([^"']+)["']/i);
  if (quotedMatch) return quotedMatch[1];

  // Match unquoted path after common interpreters
  const unquotedMatch = command.match(
    /(?:node|sh|bash|python)\s+(\S+\.(?:js|ts|sh|py|mjs|cjs))/i,
  );
  if (unquotedMatch) return unquotedMatch[1];

  return null;
}

/**
 * Scan for stale references: broken @references in CLAUDE.md files and
 * hook commands pointing to non-existent scripts.
 *
 * This scanner is async because it needs to check the filesystem for
 * reference targets not present in the ScanContext.
 */
export async function scanStaleness(context: ScanContext): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];
  let index = 0;

  // Check 1: Stale @references in CLAUDE.md files
  for (const claudeMd of context.claude_md_files) {
    for (const ref of claudeMd.references) {
      const resolved = resolve(dirname(claudeMd.path), ref);

      // Check if referenced path exists in context data
      const inContext =
        context.rules.some(r => r.path === resolved) ||
        context.claude_md_files.some(f => f.path === resolved) ||
        context.commands.some(c => c.path === resolved);

      if (inContext) continue;

      // Check filesystem as fallback
      const existsOnDisk = await fileExistsOnDisk(resolved);
      if (existsOnDisk) continue;

      recommendations.push({
        id: `rec-scan-stale-${index++}`,
        target: 'CLAUDE_MD',
        confidence: 'HIGH',
        pattern_type: 'scan_stale_reference',
        title: `Stale reference: @${ref}`,
        description: `${claudeMd.path} references @${ref}, but this file does not exist.`,
        evidence: {
          count: 1,
          examples: [`@${ref} in ${claudeMd.path}`],
        },
        suggested_action:
          `Remove the @${ref} reference from ${claudeMd.path}, ` +
          'or create the missing file.',
      });
    }
  }

  // Check 2: Hook commands pointing to non-existent scripts
  for (const hook of context.hooks_registered) {
    if (!hook.command) continue;

    const scriptPath = extractPathFromCommand(hook.command);
    if (!scriptPath) continue;

    const exists = await fileExistsOnDisk(scriptPath);
    if (exists) continue;

    recommendations.push({
      id: `rec-scan-stale-${index++}`,
      target: 'SETTINGS',
      confidence: 'HIGH',
      pattern_type: 'scan_stale_reference',
      title: `Stale hook script: ${scriptPath}`,
      description:
        `Hook (${hook.event}, ${hook.scope}) references script "${scriptPath}", ` +
        'but this file does not exist. The hook will fail when triggered.',
      evidence: {
        count: 1,
        examples: [`${hook.event} hook command: ${hook.command}`],
      },
      suggested_action:
        `Create the missing script at "${scriptPath}", ` +
        'or update the hook command in settings.json.',
    });
  }

  return recommendations;
}
