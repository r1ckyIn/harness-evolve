// Scan CLI subcommand -- triggers deep configuration scan and outputs JSON results.
// Used by the /evolve:scan slash command to programmatically invoke scanning.

import type { Command } from '@commander-js/extra-typings';
import { runDeepScan } from '../scan/index.js';

/** Confidence tier ordering: HIGH (0) -> MEDIUM (1) -> LOW (2) */
const CONFIDENCE_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

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
        // Sort recommendations by confidence: HIGH -> MEDIUM -> LOW
        const sorted = [...result.recommendations].sort((a, b) =>
          (CONFIDENCE_ORDER[a.confidence] ?? 3) - (CONFIDENCE_ORDER[b.confidence] ?? 3)
        );
        // Partition into problems and suggestions based on severity field
        const problems = sorted.filter(r => (r as Record<string, unknown>).severity === 'problem');
        const suggestions = sorted.filter(r => (r as Record<string, unknown>).severity !== 'problem');

        // Build scanner coverage summary from scanner_meta
        const scannersWithFindings = result.scanner_meta.filter(s => s.finding_count > 0);

        // Output minimal JSON (no scan_context to keep output clean for slash command)
        const output = {
          generated_at: result.generated_at,
          recommendation_count: sorted.length,
          scanner_summary: {
            total_scanners: result.scanner_meta.length,
            scanners_with_findings: scannersWithFindings.length,
            areas_scanned: result.scanner_meta.map(s => s.name),
            areas_with_findings: scannersWithFindings.map(s => s.name),
          },
          problems,
          suggestions,
          recommendations: sorted,  // Keep full list for backward compatibility
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
