// Scan CLI subcommand -- outputs scan context JSON for model-driven analysis.
// In v4.0, detailed analysis is done by the model via /evolve:scan slash command.

import type { Command } from '@commander-js/extra-typings';
import { buildScanContext } from '../scan/context-builder.js';

/**
 * Register the 'scan' subcommand on a Commander.js program.
 *
 * Outputs scan context as structured JSON to stdout. In v4.0, code-based
 * scanners were removed -- analysis is now model-driven via /evolve:scan.
 * A deprecation notice is printed to stderr so JSON piping still works.
 */
export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Output scan context JSON for model-driven analysis (use /evolve:scan for full analysis)')
    .action(async () => {
      try {
        console.error(
          'Note: Code-based scanners were removed in v4.0. ' +
          'Use /evolve:scan in Claude Code for model-driven analysis.\n' +
          'Outputting scan context JSON below:\n'
        );
        const context = await buildScanContext(process.cwd());
        console.log(JSON.stringify({
          generated_at: new Date().toISOString(),
          scan_context: context,
        }, null, 2));
      } catch (err) {
        console.log(JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
        }, null, 2));
        process.exitCode = 1;
      }
    });
}
