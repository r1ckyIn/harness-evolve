// Apply CLI subcommands -- pending, apply-one, dismiss.
// Used by the /evolve:apply slash command for interactive recommendation management.

import { readFile } from 'node:fs/promises';
import type { Command } from '@commander-js/extra-typings';
import { loadState } from '../delivery/state.js';
import { paths } from '../storage/dirs.js';
import type { Recommendation } from '../schemas/recommendation.js';
import { analysisResultSchema } from '../schemas/recommendation.js';

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
      const pending = allRecs.filter(rec => {
        const status = statusMap.get(rec.id);
        return status === undefined || status === 'pending';
      });

      console.log(JSON.stringify({ pending, count: pending.length }, null, 2));
    });
}
