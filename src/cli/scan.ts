// Scan CLI subcommand -- triggers deep configuration scan and outputs JSON results.
// Used by the /evolve:scan slash command to programmatically invoke scanning.

import type { Command } from '@commander-js/extra-typings';
import { runDeepScan } from '../scan/index.js';

/**
 * Register the 'scan' subcommand on a Commander.js program.
 *
 * Runs a full deep configuration scan (CLAUDE.md, rules, settings, hooks)
 * and outputs the results as structured JSON to stdout. The output omits
 * scan_context to keep it concise for slash command consumers.
 */
export function registerScanCommand(program: Command): void {
  program
    .command('scan')
    .description('Run deep configuration scan and output results as JSON')
    .action(async () => {
      try {
        const result = await runDeepScan(process.cwd());
        // Output minimal JSON (no scan_context to keep output clean for slash command)
        const output = {
          generated_at: result.generated_at,
          recommendation_count: result.recommendations.length,
          recommendations: result.recommendations,
        };
        console.log(JSON.stringify(output, null, 2));
      } catch (err) {
        console.log(JSON.stringify({
          error: err instanceof Error ? err.message : String(err),
          recommendations: [],
        }, null, 2));
        process.exitCode = 1;
      }
    });
}
