// SettingsApplier: handles auto-apply for SETTINGS/permission-always-approved.
// Extracted from auto-apply.ts — adds tools to allowedTools in settings.json
// with atomic writes and backup creation before modification.

import { readFile, copyFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import writeFileAtomic from 'write-file-atomic';
import type { Applier, ApplierOptions } from './index.js';
import type { Recommendation } from '../../schemas/recommendation.js';
import type { AutoApplyResult } from '../auto-apply.js';
import { paths } from '../../storage/dirs.js';

export class SettingsApplier implements Applier {
  readonly target = 'SETTINGS';

  canApply(rec: Recommendation): boolean {
    return (
      rec.confidence === 'HIGH' &&
      rec.target === 'SETTINGS' &&
      rec.pattern_type === 'permission-always-approved'
    );
  }

  async apply(
    rec: Recommendation,
    options?: ApplierOptions,
  ): Promise<AutoApplyResult> {
    try {
      // v1 scope: only handle permission-always-approved pattern
      if (rec.pattern_type !== 'permission-always-approved') {
        return {
          recommendation_id: rec.id,
          success: false,
          details: `Skipped: pattern_type '${rec.pattern_type}' not supported for auto-apply in v1`,
        };
      }

      const settingsFilePath =
        options?.settingsPath ??
        join(process.env.HOME ?? '', '.claude', 'settings.json');

      // Read current settings
      const raw = await readFile(settingsFilePath, 'utf-8');
      const settings = JSON.parse(raw) as Record<string, unknown>;

      // Create backup before modification
      const backup = join(
        paths.analysis,
        'backups',
        `settings-backup-${rec.id}.json`,
      );
      await mkdir(dirname(backup), { recursive: true });
      await copyFile(settingsFilePath, backup);

      // Extract tool name from evidence
      const toolName = extractToolName(rec);
      if (!toolName) {
        return {
          recommendation_id: rec.id,
          success: false,
          details:
            'Could not extract tool name from recommendation evidence',
        };
      }

      // Get or create allowedTools array
      const allowedTools = Array.isArray(settings.allowedTools)
        ? (settings.allowedTools as string[])
        : [];

      // Add tool if not already present
      if (!allowedTools.includes(toolName)) {
        allowedTools.push(toolName);
      }
      settings.allowedTools = allowedTools;

      // Write modified settings atomically
      await writeFileAtomic(
        settingsFilePath,
        JSON.stringify(settings, null, 2),
      );

      return {
        recommendation_id: rec.id,
        success: true,
        details: `Added ${toolName} to allowedTools`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        recommendation_id: rec.id,
        success: false,
        details: message,
      };
    }
  }
}

/**
 * Extract tool name from recommendation evidence examples.
 * Looks for patterns like "Bash(npm test)" -> "Bash"
 * or "ToolName(args)" -> "ToolName".
 */
function extractToolName(rec: Recommendation): string | undefined {
  for (const example of rec.evidence.examples) {
    const match = example.match(/^(\w+)\(/);
    if (match) return match[1];
  }
  return undefined;
}
