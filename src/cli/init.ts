// Init command implementation -- registers harness-evolve hooks in Claude Code settings.json
// and runs a deep scan of existing configuration for quality issues.

import { copyFile, mkdir, access } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Command } from '@commander-js/extra-typings';
import {
  HOOK_REGISTRATIONS,
  SETTINGS_PATH,
  resolveHookPath,
  readSettings,
  writeSettings,
  mergeHooks,
  confirm,
} from './utils.js';
import { runDeepScan } from '../scan/index.js';

/**
 * Options for runInit, with test overrides.
 */
export interface InitOptions {
  yes: boolean;
  settingsPath?: string;
  baseDirOverride?: string;
}

/**
 * Check if a file exists by attempting to access it.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Core init logic -- exported for testing.
 *
 * 1. Resolve hook paths for all 6 events
 * 2. Display planned registrations
 * 3. Detect npx install and warn about ephemeral paths
 * 4. Confirm with user (unless --yes)
 * 5. Ensure directory exists, backup existing settings, merge, write
 */
export async function runInit(options: InitOptions): Promise<void> {
  const settingsPath = options.settingsPath ?? SETTINGS_PATH;

  // Build hook commands with resolved absolute paths
  const hookCommands = HOOK_REGISTRATIONS.map((reg) => {
    const absolutePath = resolveHookPath(reg.hookFile, options.baseDirOverride);
    return {
      event: reg.event,
      command: `node "${absolutePath}"`,
      timeout: reg.timeout,
      async: reg.async,
    };
  });

  // Display planned registrations
  console.log('\nPlanned hook registrations:\n');
  for (const hc of hookCommands) {
    const asyncLabel = hc.async ? ' (async)' : '';
    console.log(`  ${hc.event}${asyncLabel}`);
    console.log(`    -> ${hc.command}`);
  }
  console.log('');

  // Detect npx ephemeral paths
  const samplePath = hookCommands[0].command;
  if (samplePath.includes('.npm/_npx/')) {
    console.log(
      'WARNING: Detected npx installation. Hook paths may break when the',
    );
    console.log(
      'npx cache is cleared. For persistent installation, use: npm i -g harness-evolve\n',
    );
  }

  // Confirm unless --yes
  if (!options.yes) {
    const accepted = await confirm('Register hooks in settings.json?');
    if (!accepted) {
      console.log('Aborted.');
      return;
    }
  }

  // Ensure settings directory exists
  await mkdir(dirname(settingsPath), { recursive: true });

  // Backup existing settings.json if it exists
  const exists = await fileExists(settingsPath);
  if (exists) {
    await copyFile(settingsPath, settingsPath + '.backup');
    console.log(`Backup created: ${settingsPath}.backup`);
  }

  // Read existing settings (returns {} if file missing)
  const settings = await readSettings(settingsPath);

  // Merge hooks
  const merged = mergeHooks(settings, hookCommands);

  // Write merged settings
  await writeSettings(merged, settingsPath);

  console.log(
    `Hooks registered successfully! (${hookCommands.length} events)`,
  );

  // Deep scan: analyze existing configuration for quality issues
  try {
    console.log('\nScanning configuration...\n');
    const scanResult = await runDeepScan(process.cwd());
    if (scanResult.recommendations.length > 0) {
      console.log(
        `Found ${scanResult.recommendations.length} configuration suggestion(s):\n`,
      );
      for (const rec of scanResult.recommendations) {
        console.log(`  [${rec.confidence}] ${rec.title}`);
        console.log(`    ${rec.description}`);
        console.log(`    Suggested: ${rec.suggested_action}\n`);
      }
    } else {
      console.log('Configuration looks clean -- no issues detected.\n');
    }
  } catch (err) {
    // Scan is advisory -- don't block init on scan failures
    console.error(
      `Warning: Configuration scan failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Register the init subcommand on a Commander.js program.
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Register harness-evolve hooks in Claude Code settings')
    .option('--yes', 'Skip confirmation prompt')
    .action(async (opts) => {
      await runInit({ yes: opts.yes ?? false });
    });
}
