// Auto-apply module for high-confidence SETTINGS recommendations.
// When fullAuto mode is enabled (config.delivery.fullAuto=true), this module
// automatically applies HIGH-confidence SETTINGS recommendations that target
// permission-always-approved patterns (allowedTools additions).
// v1 scope: only handles allowedTools additions; all other SETTINGS types are skipped.

import { readFile, copyFile, appendFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import writeFileAtomic from 'write-file-atomic';
import { paths, ensureInit } from '../storage/dirs.js';
import { loadConfig } from '../storage/config.js';
import { updateStatus, getStatusMap } from './state.js';
import type { Recommendation } from '../schemas/recommendation.js';
import type { AutoApplyLogEntry } from '../schemas/delivery.js';

export interface AutoApplyResult {
  recommendation_id: string;
  success: boolean;
  details: string;
}

interface AutoApplyOptions {
  /** Override settings.json path (used in testing) */
  settingsPath?: string;
}

/**
 * Auto-apply HIGH-confidence SETTINGS recommendations when fullAuto is enabled.
 * Returns an empty array when fullAuto is false (default, per QUA-01).
 *
 * v1 scope restriction: only handles pattern_type=permission-always-approved
 * targeting allowedTools in settings.json. All other SETTINGS patterns are
 * logged as skipped.
 */
export async function autoApplyRecommendations(
  recommendations: Recommendation[],
  options?: AutoApplyOptions,
): Promise<AutoApplyResult[]> {
  const config = await loadConfig();
  if (!config.delivery.fullAuto) return [];

  await ensureInit();
  const stateMap = await getStatusMap();
  const results: AutoApplyResult[] = [];

  // Filter: only HIGH confidence + SETTINGS target + pending status
  const candidates = recommendations.filter(
    (rec) =>
      rec.confidence === 'HIGH' &&
      rec.target === 'SETTINGS' &&
      (stateMap.get(rec.id) ?? 'pending') === 'pending',
  );

  for (const rec of candidates) {
    const result = await applySingleRecommendation(rec, options);
    results.push(result);

    // Log the attempt
    const logEntry: AutoApplyLogEntry = {
      timestamp: new Date().toISOString(),
      recommendation_id: rec.id,
      target: 'SETTINGS',
      action: rec.suggested_action,
      success: result.success,
      details: result.details,
      backup_path: result.success ? backupPath(rec.id) : undefined,
    };
    await appendFile(
      paths.autoApplyLog,
      JSON.stringify(logEntry) + '\n',
      'utf-8',
    );

    // Update status on success
    if (result.success) {
      await updateStatus(rec.id, 'applied', `Auto-applied: ${result.details}`);
    }
  }

  return results;
}

/**
 * Compute the backup file path for a given recommendation ID.
 */
function backupPath(recId: string): string {
  return join(paths.analysis, 'backups', `settings-backup-${recId}.json`);
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

/**
 * Resolve the settings.json path.
 * Uses the provided override, or defaults to ~/.claude/settings.json.
 */
function resolveSettingsPath(options?: AutoApplyOptions): string {
  if (options?.settingsPath) return options.settingsPath;
  return join(process.env.HOME ?? '', '.claude', 'settings.json');
}

/**
 * Apply a single recommendation to the settings.json file.
 * v1: only handles permission-always-approved (allowedTools additions).
 */
async function applySingleRecommendation(
  rec: Recommendation,
  options?: AutoApplyOptions,
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

    const settingsFilePath = resolveSettingsPath(options);

    // Read current settings
    const raw = await readFile(settingsFilePath, 'utf-8');
    const settings = JSON.parse(raw) as Record<string, unknown>;

    // Create backup before modification
    const backup = backupPath(rec.id);
    await mkdir(dirname(backup), { recursive: true });
    await copyFile(settingsFilePath, backup);

    // Extract tool name from evidence
    const toolName = extractToolName(rec);
    if (!toolName) {
      return {
        recommendation_id: rec.id,
        success: false,
        details: 'Could not extract tool name from recommendation evidence',
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
    await writeFileAtomic(settingsFilePath, JSON.stringify(settings, null, 2));

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
