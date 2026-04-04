// HookApplier: handles auto-apply for HIGH-confidence HOOK recommendations.
// Generates a bash hook script via generateHook(), writes it to disk with +x
// permission, and registers the hook in settings.json via mergeHooks().
// Create-only: never overwrites existing hook files.

import { writeFile, access, mkdir, chmod, copyFile } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import type { Applier, ApplierOptions } from './index.js';
import type { Recommendation } from '../../schemas/recommendation.js';
import type { AutoApplyResult } from '../auto-apply.js';
import { generateHook } from '../../generators/hook-generator.js';
import {
  readSettings,
  writeSettings,
  mergeHooks,
} from '../../cli/utils.js';
import { paths } from '../../storage/dirs.js';

export class HookApplier implements Applier {
  readonly target = 'HOOK';

  canApply(rec: Recommendation): boolean {
    return rec.confidence === 'HIGH' && rec.target === 'HOOK';
  }

  async apply(
    rec: Recommendation,
    options?: ApplierOptions,
  ): Promise<AutoApplyResult> {
    try {
      // Generate hook script from recommendation
      const artifact = generateHook(rec);
      if (!artifact) {
        return {
          recommendation_id: rec.id,
          success: false,
          details: 'Generator returned null — recommendation not applicable for hook generation',
        };
      }

      // Resolve hooks directory
      const hooksDir =
        options?.hooksDir ??
        join(process.env.HOME ?? '', '.claude', 'hooks');

      // Extract script filename from artifact path
      const scriptFilename = basename(artifact.filename);
      const scriptPath = join(hooksDir, scriptFilename);

      // Create-only guard: never overwrite existing hook files
      try {
        await access(scriptPath);
        return {
          recommendation_id: rec.id,
          success: false,
          details: `Hook file already exists: ${scriptFilename}`,
        };
      } catch {
        // File does not exist — proceed to create
      }

      // Create hooks directory
      await mkdir(hooksDir, { recursive: true });

      // Write hook script file
      await writeFile(scriptPath, artifact.content, 'utf-8');

      // Set executable permission
      await chmod(scriptPath, 0o755);

      // Resolve settings.json path
      const settingsPath =
        options?.settingsPath ??
        join(process.env.HOME ?? '', '.claude', 'settings.json');

      // Read current settings
      const settings = await readSettings(settingsPath);

      // Create backup before modification
      const backupDir = join(paths.analysis, 'backups');
      await mkdir(backupDir, { recursive: true });
      const backupFile = join(backupDir, `settings-backup-${rec.id}.json`);
      // Only backup if settings file exists and has content
      try {
        await copyFile(settingsPath, backupFile);
      } catch {
        // Settings file may not exist yet — write current state as backup
        await writeFile(backupFile, JSON.stringify(settings, null, 2), 'utf-8');
      }

      // Extract hook event from generated content
      const eventMatch = artifact.content.match(/# Hook event: (\w+)/);
      const hookEvent = eventMatch?.[1] ?? 'PreToolUse';

      // Merge hook into settings
      const merged = mergeHooks(settings, [
        {
          event: hookEvent,
          command: `bash "${scriptPath}"`,
          timeout: 10,
          async: true,
        },
      ]);

      // Write merged settings
      await writeSettings(merged, settingsPath);

      return {
        recommendation_id: rec.id,
        success: true,
        details: `Created hook script: ${scriptFilename} and registered under ${hookEvent}`,
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
