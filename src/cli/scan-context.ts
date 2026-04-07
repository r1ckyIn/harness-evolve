// Scan-context CLI subcommand -- outputs raw ScanContext JSON for model consumption.
// Unlike 'scan', outputs ScanContext directly without wrapper or deprecation notice.

import type { Command } from '@commander-js/extra-typings';
import { buildScanContext } from '../scan/context-builder.js';

/**
 * Register the 'scan-context' subcommand on a Commander.js program.
 *
 * Outputs the complete ScanContext as JSON to stdout. This is the primary
 * bridge command for model-driven analysis: the /evolve:scan slash command
 * calls this to get structured config data for the model to analyze.
 *
 * No deprecation notice, no wrapper object -- just raw ScanContext JSON.
 * Errors go to stderr so JSON piping works cleanly.
 *
 * Works without prior 'harness-evolve init' since it only reads config files.
 */
export function registerScanContextCommand(program: Command): void {
  program
    .command('scan-context')
    .description('Output structured configuration context as JSON for model consumption')
    .action(async () => {
      try {
        const context = await buildScanContext(process.cwd());
        console.log(JSON.stringify(context, null, 2));
      } catch (err) {
        console.error(
          `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        process.exitCode = 1;
      }
    });
}
