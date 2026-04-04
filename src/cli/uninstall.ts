// Uninstall command implementation -- removes harness-evolve hooks and optionally deletes data

import { copyFile, rm, rmdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import type { Command } from '@commander-js/extra-typings';
import {
  readSettings,
  writeSettings,
  HARNESS_EVOLVE_MARKER,
  SETTINGS_PATH,
  confirm,
} from './utils.js';
import { paths } from '../storage/dirs.js';

/**
 * Options for runUninstall, with test overrides.
 */
export interface UninstallOptions {
  purge: boolean;
  yes: boolean;
  settingsPath?: string;
  projectDir?: string;
}

/**
 * Remove slash command files from the project's .claude/commands/evolve/ directory.
 * Handles missing files gracefully. Attempts to remove the evolve/ directory if empty.
 */
async function removeSlashCommands(projectDir: string): Promise<void> {
  const commandsDir = join(projectDir, '.claude', 'commands', 'evolve');

  for (const file of ['scan.md', 'apply.md']) {
    try {
      await rm(join(commandsDir, file));
      console.log(`  Removed /evolve:${file.replace('.md', '')}`);
    } catch {
      // File doesn't exist -- nothing to remove
    }
  }

  // Try to remove empty directory
  try {
    await rmdir(commandsDir);
  } catch {
    // Directory not empty (user added files) or doesn't exist
  }
}

/**
 * Core uninstall logic -- exported for testing.
 *
 * 1. Remove harness-evolve hook entries from settings.json (preserve user hooks)
 * 2. Optionally delete ~/.harness-evolve/ data directory with --purge
 */
export async function runUninstall(options: UninstallOptions): Promise<void> {
  const settingsPath = options.settingsPath ?? SETTINGS_PATH;

  // --- Remove hooks from settings.json ---
  const settings = await readSettings(settingsPath);
  const hooks = settings.hooks as Record<string, unknown[]> | undefined;

  if (!hooks || Object.keys(hooks).length === 0) {
    console.log('No harness-evolve hooks found in settings.json');
  } else {
    let removedCount = 0;
    const filteredHooks: Record<string, unknown[]> = {};

    for (const [event, entries] of Object.entries(hooks)) {
      if (!Array.isArray(entries)) {
        filteredHooks[event] = entries;
        continue;
      }

      // Filter out entries whose hooks sub-array contains harness-evolve
      const kept = entries.filter((entry) => {
        const innerHooks = (entry as Record<string, unknown>).hooks as
          | Array<Record<string, unknown>>
          | undefined;
        if (!Array.isArray(innerHooks)) return true;
        const isHarnessEvolve = innerHooks.some((h) =>
          String(h.command ?? '').includes(HARNESS_EVOLVE_MARKER),
        );
        if (isHarnessEvolve) removedCount++;
        return !isHarnessEvolve;
      });

      // Only keep the event key if there are remaining entries
      if (kept.length > 0) {
        filteredHooks[event] = kept;
      }
    }

    if (removedCount > 0) {
      // Backup before modification
      await copyFile(settingsPath, settingsPath + '.backup');
      console.log(`Backup created: ${settingsPath}.backup`);

      // Write filtered settings
      settings.hooks = filteredHooks;
      await writeSettings(settings, settingsPath);
      console.log('Removed harness-evolve hooks from settings.json');
    } else {
      console.log('No harness-evolve hooks found in settings.json');
    }
  }

  // --- Remove slash commands ---
  console.log('\nRemoving slash commands...');
  await removeSlashCommands(options.projectDir ?? process.cwd());

  // --- Optionally delete data directory ---
  if (options.purge) {
    if (!options.yes) {
      const accepted = await confirm(
        'Delete all harness-evolve data (~/.harness-evolve/)?',
      );
      if (!accepted) {
        console.log('Data directory preserved.');
        return;
      }
    }

    try {
      await access(paths.base, constants.F_OK);
      await rm(paths.base, { recursive: true, force: true });
      console.log(`Deleted data directory: ${paths.base}`);
    } catch {
      console.log(`Data directory not found: ${paths.base}`);
    }
  }
}

/**
 * Register the uninstall subcommand on a Commander.js program.
 */
export function registerUninstallCommand(program: Command): void {
  program
    .command('uninstall')
    .description('Remove harness-evolve hooks and optionally delete data')
    .option('--purge', 'Also delete ~/.harness-evolve/ data directory')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (opts) => {
      await runUninstall({
        purge: opts.purge ?? false,
        yes: opts.yes ?? false,
      });
    });
}
