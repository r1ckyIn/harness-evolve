// Status command implementation -- shows harness-evolve status and statistics

import type { Command } from '@commander-js/extra-typings';
import { readCounter } from '../storage/counter.js';
import { loadState } from '../delivery/state.js';
import { readSettings, HARNESS_EVOLVE_MARKER, SETTINGS_PATH } from './utils.js';

/**
 * Options for runStatus, with test overrides.
 */
export interface StatusOptions {
  settingsPath?: string;
}

/**
 * Core status logic -- exported for testing.
 *
 * Reads counter, recommendation state, and settings to display:
 * - Total interaction count
 * - Last analysis timestamp
 * - Pending recommendations count
 * - Hook registration status
 */
export async function runStatus(options: StatusOptions): Promise<void> {
  const settingsPath = options.settingsPath ?? SETTINGS_PATH;

  // Read counter data (returns defaults if counter.json missing)
  const counter = await readCounter();

  // Read recommendation state (returns empty entries if file missing)
  const state = await loadState();

  // Count pending recommendations
  const pendingCount = state.entries.filter(
    (e) => e.status === 'pending',
  ).length;

  // Check hook registration in settings.json
  const settings = await readSettings(settingsPath);
  const hooksRegistered = JSON.stringify(settings.hooks ?? {}).includes(
    HARNESS_EVOLVE_MARKER,
  );

  // Display status
  console.log('');
  console.log('harness-evolve status');
  console.log('=====================');
  console.log(`Interactions:     ${counter.total}`);
  console.log(`Last analysis:    ${counter.last_analysis ?? 'never'}`);
  console.log(`Pending recs:     ${pendingCount}`);
  console.log(`Hooks registered: ${hooksRegistered ? 'Yes' : 'No'}`);
  console.log('');
}

/**
 * Register the status subcommand on a Commander.js program.
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show harness-evolve status and statistics')
    .action(async () => {
      await runStatus({});
    });
}
