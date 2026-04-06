// Deep scan context builder: reads config files and returns structured context.
// Scanner functions removed in v4.0 -- analysis is now model-driven via /evolve:scan.

import { buildScanContext } from './context-builder.js';
import type { ScanContext } from './schemas.js';

export interface ScanResult {
  generated_at: string;
  scan_context: ScanContext;
}

/**
 * Build scan context from Claude Code configuration at the given directory.
 * Returns raw context data for model-driven analysis.
 *
 * In v3.0, this function ran 7 code-based scanners. In v4.0, analysis
 * is performed by the model via /evolve:scan guidance docs.
 */
export async function buildScanResult(
  cwd: string,
  home?: string,
): Promise<ScanResult> {
  const scanContext = await buildScanContext(cwd, home);
  return {
    generated_at: new Date().toISOString(),
    scan_context: scanContext,
  };
}

// Re-export for consumers
export type { ScanContext } from './schemas.js';
