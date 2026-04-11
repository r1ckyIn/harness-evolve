// Scan CLI subcommand -- removed in v5.0, now a hard error pointing to /evolve:scan.

import type { Command } from '@commander-js/extra-typings';

/**
 * Register the 'scan' subcommand as a hard error.
 * The scan CLI was removed in v5.0. Users should use /evolve:scan in Claude Code
 * for model-driven analysis, or scan-context for raw JSON.
 */
export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('[REMOVED] Use /evolve:scan in Claude Code instead')
    .action(() => {
      console.error(
        'Error: The "scan" subcommand was removed in v5.0.\n\n' +
        'Use /evolve:scan in Claude Code for model-driven configuration analysis.\n' +
        'Or use "harness-evolve scan-context" for raw configuration JSON.\n'
      );
      process.exitCode = 1;
    });
}
