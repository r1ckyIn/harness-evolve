// Entry point for /evolve skill invocation.
// Runs the full analysis pipeline, renders markdown recommendations,
// writes the output file, and sets the notification flag.

import { runAnalysis } from '../analysis/trigger.js';
import { renderRecommendations } from './renderer.js';
import { getStatusMap } from './state.js';
import { rotateRecommendations } from './rotator.js';
import { writeNotificationFlag } from './notification.js';
import { autoApplyRecommendations } from './auto-apply.js';
import { paths, ensureInit } from '../storage/dirs.js';
import { loadConfig } from '../storage/config.js';
import writeFileAtomic from 'write-file-atomic';

/**
 * Main entry point: runs analysis, renders output, writes recommendations file.
 * Outputs a JSON summary to stdout for the /evolve skill to present.
 */
async function main(): Promise<void> {
  const cwd = process.argv[2] || process.cwd();
  await ensureInit();

  const config = await loadConfig();

  // Run analysis pipeline
  const result = await runAnalysis(cwd);

  // Load state and build status map
  const stateMap = await getStatusMap();

  // Rotate old recommendations before rendering
  await rotateRecommendations({
    maxRecommendationsInFile: config.delivery.maxRecommendationsInFile,
    archiveAfterDays: config.delivery.archiveAfterDays,
  });

  // Render markdown
  const markdown = renderRecommendations(result, stateMap);
  await writeFileAtomic(paths.recommendations, markdown);

  // Auto-apply HIGH-confidence recommendations when fullAuto is enabled (DEL-06)
  try {
    await autoApplyRecommendations(result.recommendations);
  } catch {
    // Auto-apply failure must not break /evolve flow
  }

  // Reload state after auto-apply (applied recs change pending count)
  const updatedStateMap = await getStatusMap();

  // Set notification flag for pending count
  const pendingCount = result.recommendations.filter(
    (r) => (updatedStateMap.get(r.id) ?? 'pending') === 'pending',
  ).length;
  if (pendingCount > 0) {
    await writeNotificationFlag(pendingCount);
  }

  // Output JSON summary for the skill to present
  const pending = result.recommendations.filter(
    (r) => (updatedStateMap.get(r.id) ?? 'pending') === 'pending',
  );
  console.log(
    JSON.stringify({
      total: result.recommendations.length,
      pending: pending.length,
      high: pending.filter((r) => r.confidence === 'HIGH').length,
      medium: pending.filter((r) => r.confidence === 'MEDIUM').length,
      low: pending.filter((r) => r.confidence === 'LOW').length,
      file: paths.recommendations,
    }),
  );
}

main().catch(() => process.exit(1));
