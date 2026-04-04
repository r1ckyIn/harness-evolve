// Auto-apply module for high-confidence recommendations.
// When fullAuto mode is enabled (config.delivery.fullAuto=true), this module
// automatically applies HIGH-confidence recommendations that have a registered
// applier. Dispatches to the correct applier via the strategy pattern registry.
// v1 appliers: SettingsApplier (permission-always-approved), RuleApplier (create-only rules).
// v2 appliers: HookApplier (hook script generation + settings registration), ClaudeMdApplier (CLAUDE.md append).

import { appendFile } from 'node:fs/promises';
import { paths, ensureInit } from '../storage/dirs.js';
import { loadConfig } from '../storage/config.js';
import { updateStatus, getStatusMap } from './state.js';
import {
  registerApplier,
  getApplier,
  hasApplier,
} from './appliers/index.js';
import { SettingsApplier } from './appliers/settings-applier.js';
import { RuleApplier } from './appliers/rule-applier.js';
import { HookApplier } from './appliers/hook-applier.js';
import { ClaudeMdApplier } from './appliers/claude-md-applier.js';
import type { Recommendation } from '../schemas/recommendation.js';
import type { AutoApplyLogEntry } from '../schemas/delivery.js';
import type { ApplierOptions } from './appliers/index.js';

export interface AutoApplyResult {
  recommendation_id: string;
  success: boolean;
  details: string;
}

export interface AutoApplyOptions extends ApplierOptions {}

// Register all built-in appliers
registerApplier(new SettingsApplier());
registerApplier(new RuleApplier());
registerApplier(new HookApplier());
registerApplier(new ClaudeMdApplier());

/**
 * Auto-apply HIGH-confidence recommendations when fullAuto is enabled.
 * Returns an empty array when fullAuto is false (default, per QUA-01).
 *
 * Dispatches to the appropriate Applier based on rec.target via the
 * applier registry. Only processes recommendations whose target has a
 * registered applier and whose applier.canApply() returns true.
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

  // Filter: only HIGH confidence + has registered applier + pending status
  const candidates = recommendations.filter(
    (rec) =>
      rec.confidence === 'HIGH' &&
      hasApplier(rec.target) &&
      (stateMap.get(rec.id) ?? 'pending') === 'pending',
  );

  for (const rec of candidates) {
    const applier = getApplier(rec.target);
    let result: AutoApplyResult;

    if (!applier || !applier.canApply(rec)) {
      result = {
        recommendation_id: rec.id,
        success: false,
        details: `No applicable applier for target '${rec.target}' with pattern_type '${rec.pattern_type}'`,
      };
    } else {
      result = await applier.apply(rec, options);
    }

    results.push(result);

    // Log the attempt
    const logEntry: AutoApplyLogEntry = {
      timestamp: new Date().toISOString(),
      recommendation_id: rec.id,
      target: rec.target,
      action: rec.suggested_action,
      success: result.success,
      details: result.details,
      backup_path: undefined,
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
