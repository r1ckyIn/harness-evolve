// Apply CLI subcommands -- pending, apply-one, dismiss.
// Used by the /evolve:apply slash command for interactive recommendation management.

import { readFile, appendFile } from 'node:fs/promises';
import type { Command } from '@commander-js/extra-typings';
import { loadState, updateStatus } from '../delivery/state.js';
import { paths } from '../storage/dirs.js';
import type { Recommendation } from '../schemas/recommendation.js';
import { analysisResultSchema } from '../schemas/recommendation.js';

// Trigger applier registration by importing auto-apply (registers all 4 appliers as side effect)
import '../delivery/auto-apply.js';
import { getApplier } from '../delivery/appliers/index.js';

/** Confidence tier ordering: HIGH (0) -> MEDIUM (1) -> LOW (2) */
const CONFIDENCE_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

/**
 * Load recommendations from the analysis result file.
 * Returns an empty array when the file does not exist or is invalid.
 */
async function loadAnalysisResult(): Promise<Recommendation[]> {
  try {
    const raw = await readFile(paths.analysisResult, 'utf-8');
    const parsed = analysisResultSchema.parse(JSON.parse(raw));
    return parsed.recommendations;
  } catch {
    return [];
  }
}

/**
 * Register the 'pending' subcommand on a Commander.js program.
 *
 * Reads the analysis result and recommendation state, filters to
 * recommendations that are not yet applied or dismissed, and outputs
 * the pending list as structured JSON.
 */
export function registerPendingCommand(program: Command): void {
  program
    .command('pending')
    .description('List pending recommendations as JSON')
    .action(async () => {
      const allRecs = await loadAnalysisResult();
      const state = await loadState();
      const statusMap = new Map(state.entries.map(e => [e.id, e.status]));

      // Filter to pending: recommendations not in state, or explicitly pending
      // Sort by confidence: HIGH -> MEDIUM -> LOW
      const pending = allRecs
        .filter(rec => {
          const status = statusMap.get(rec.id);
          return status === undefined || status === 'pending';
        })
        .sort((a, b) =>
          (CONFIDENCE_ORDER[a.confidence] ?? 3) - (CONFIDENCE_ORDER[b.confidence] ?? 3)
        );

      console.log(JSON.stringify({ pending, count: pending.length }, null, 2));
    });
}

/**
 * Register the 'apply-one' subcommand on a Commander.js program.
 *
 * Loads the recommendation by ID from analysis result, finds the correct
 * applier from the registry, applies the recommendation, logs the attempt,
 * and updates the recommendation status on success.
 */
export function registerApplyOneCommand(program: Command): void {
  program
    .command('apply-one')
    .description('Apply a single recommendation by ID')
    .argument('<id>', 'Recommendation ID to apply')
    .action(async (id) => {
      try {
        const allRecs = await loadAnalysisResult();
        const rec = allRecs.find(r => r.id === id);
        if (!rec) {
          console.log(JSON.stringify({
            recommendation_id: id,
            success: false,
            details: `Recommendation '${id}' not found`,
          }));
          process.exitCode = 1;
          return;
        }

        const applier = getApplier(rec.target);
        if (!applier || !applier.canApply(rec)) {
          console.log(JSON.stringify({
            recommendation_id: id,
            success: false,
            details: `No applicable applier for target '${rec.target}'`,
          }));
          process.exitCode = 1;
          return;
        }

        const result = await applier.apply(rec);

        // Log the attempt (non-critical -- ignore write failures)
        const logEntry = {
          timestamp: new Date().toISOString(),
          recommendation_id: rec.id,
          target: rec.target,
          action: rec.suggested_action,
          success: result.success,
          details: result.details,
        };
        try {
          await appendFile(paths.autoApplyLog, JSON.stringify(logEntry) + '\n', 'utf-8');
        } catch {
          // Log failure is non-critical
        }

        // Update status to applied on success
        if (result.success) {
          await updateStatus(id, 'applied', `Applied via /evolve:apply: ${result.details}`);
        }

        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        console.log(JSON.stringify({
          recommendation_id: id,
          success: false,
          details: err instanceof Error ? err.message : String(err),
        }));
        process.exitCode = 1;
      }
    });
}

/**
 * Register the 'dismiss' subcommand on a Commander.js program.
 *
 * Permanently dismisses a recommendation by updating its status to 'dismissed'.
 * Outputs JSON confirmation with the recommendation ID and status.
 */
export function registerDismissCommand(program: Command): void {
  program
    .command('dismiss')
    .description('Permanently dismiss a recommendation by ID')
    .argument('<id>', 'Recommendation ID to dismiss')
    .action(async (id) => {
      try {
        await updateStatus(id, 'dismissed', 'Dismissed by user via /evolve:apply');
        console.log(JSON.stringify({ id, status: 'dismissed' }, null, 2));
      } catch (err) {
        console.log(JSON.stringify({
          id,
          error: err instanceof Error ? err.message : String(err),
        }));
        process.exitCode = 1;
      }
    });
}
