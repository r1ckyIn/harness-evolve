// Deep scan orchestrator: builds context from config files and runs all scanners.
// Entry point for the scan module -- coordinates context building with scanner
// execution and returns merged recommendations.

import { buildScanContext } from './context-builder.js';
import { scanners, scannerNames } from './scanners/index.js';
import type { ScanContext } from './schemas.js';
import type { Recommendation } from '../schemas/recommendation.js';
import type { Scanner } from './scanners/index.js';

export interface ScannerMeta {
  name: string;
  finding_count: number;
}

export interface ScanResult {
  generated_at: string;
  scan_context: ScanContext;
  recommendations: Recommendation[];
  scanner_meta: ScannerMeta[];
}

/**
 * Run a deep scan of Claude Code configuration at the given directory.
 * Reads all config files into a ScanContext, then runs all registered
 * scanners to detect quality issues. Returns merged recommendations.
 *
 * Errors in individual scanners are caught and logged, not propagated.
 * An empty recommendations array means no issues detected.
 */
export async function runDeepScan(
  cwd: string,
  home?: string,
): Promise<ScanResult> {
  const scanContext = await buildScanContext(cwd, home);
  const recommendations: Recommendation[] = [];
  const scannerMeta: ScannerMeta[] = [];

  for (let i = 0; i < scanners.length; i++) {
    const scanner = scanners[i];
    const name = scannerNames[i] ?? `scanner-${i}`;
    try {
      const result = await scanner(scanContext);
      recommendations.push(...result);
      scannerMeta.push({ name, finding_count: result.length });
    } catch (err) {
      // Log but don't propagate -- scan is advisory, not critical
      console.error(
        `Scanner error (${name}): ${err instanceof Error ? err.message : String(err)}`,
      );
      scannerMeta.push({ name, finding_count: 0 });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    scan_context: scanContext,
    recommendations,
    scanner_meta: scannerMeta,
  };
}

// Re-export key types for consumers
export type { ScanContext } from './schemas.js';
export type { Scanner } from './scanners/index.js';
