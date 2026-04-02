// Threshold trigger: orchestrates analysis when counter reaches the configured
// threshold. Respects cooldown period, resets counter after success, preserves
// counter on failure for automatic retry at next threshold check.

import { readCounter } from '../storage/counter.js';
import { loadConfig } from '../storage/config.js';
import { paths, ensureInit } from '../storage/dirs.js';
import { preProcess } from './pre-processor.js';
import { scanEnvironment } from './environment-scanner.js';
import { analyze } from './analyzer.js';
import {
  trackOutcomes,
  loadOutcomeHistory,
  computeOutcomeSummaries,
} from './outcome-tracker.js';
import type { OutcomeSummary } from '../schemas/onboarding.js';
import type { AnalysisResult } from '../schemas/recommendation.js';
import writeFileAtomic from 'write-file-atomic';
import { readFile } from 'node:fs/promises';
import { lock } from 'proper-lockfile';

// Cooldown period: prevent re-triggering analysis within 60 seconds of last run
const COOLDOWN_MS = 60_000;

/**
 * Write an AnalysisResult to the analysis-result.json path atomically.
 */
export async function writeAnalysisResult(
  result: AnalysisResult,
): Promise<void> {
  await ensureInit();
  await writeFileAtomic(paths.analysisResult, JSON.stringify(result, null, 2));
}

/**
 * Run the full analysis pipeline: preProcess -> scanEnvironment -> analyze -> write.
 *
 * @param cwd - Current working directory for environment scanning
 * @returns The generated AnalysisResult
 */
export async function runAnalysis(cwd: string): Promise<AnalysisResult> {
  const summary = await preProcess();
  const snapshot = await scanEnvironment(cwd);

  // Wire outcome tracking: track current state, compute summaries for confidence adjustment (QUA-04)
  let outcomeSummaries: OutcomeSummary[] | undefined;
  try {
    await trackOutcomes(snapshot);
    const history = await loadOutcomeHistory();
    outcomeSummaries = computeOutcomeSummaries(history);
  } catch {
    // Outcome tracking failure must not block analysis
  }

  const result = analyze(summary, snapshot, undefined, outcomeSummaries);
  await writeAnalysisResult(result);
  return result;
}

/**
 * Reset the counter with a last_analysis timestamp atomically.
 * Uses proper-lockfile for cross-process safety.
 */
async function resetCounterWithTimestamp(): Promise<void> {
  // Ensure counter file exists before locking
  try {
    await readFile(paths.counter, 'utf-8');
  } catch {
    const initial = {
      total: 0,
      session: {},
      last_updated: new Date().toISOString(),
    };
    await writeFileAtomic(paths.counter, JSON.stringify(initial, null, 2));
  }

  const release = await lock(paths.counter, {
    retries: { retries: 10, minTimeout: 50, maxTimeout: 500 },
    stale: 10000,
  });

  try {
    const now = new Date().toISOString();
    const data = {
      total: 0,
      session: {},
      last_analysis: now,
      last_updated: now,
    };
    await writeFileAtomic(paths.counter, JSON.stringify(data, null, 2));
  } finally {
    await release();
  }
}

/**
 * Check if analysis should be triggered and run it if conditions are met.
 *
 * Conditions:
 * 1. analysis.enabled is true in config
 * 2. counter.total >= config.analysis.threshold
 * 3. Not within cooldown period since last_analysis
 *
 * On success: resets counter and records last_analysis timestamp.
 * On failure: preserves counter data for retry at next check.
 *
 * @param cwd - Current working directory
 * @returns true if analysis was triggered, false otherwise
 */
export async function checkAndTriggerAnalysis(
  cwd: string,
): Promise<boolean> {
  const config = await loadConfig();
  if (!config.analysis.enabled) return false;

  const counter = await readCounter();
  if (counter.total < config.analysis.threshold) return false;

  // Check cooldown
  if (counter.last_analysis) {
    const elapsed = Date.now() - new Date(counter.last_analysis).getTime();
    if (elapsed < COOLDOWN_MS) return false;
  }

  // Attempt analysis -- preserve counter on failure
  try {
    await runAnalysis(cwd);
  } catch {
    return false;
  }

  // Reset counter with timestamp after successful analysis
  await resetCounterWithTimestamp();
  return true;
}
