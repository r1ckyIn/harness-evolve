// Recommendation rotator for bounding the state file size.
// Archives applied/dismissed entries older than archiveAfterDays
// to dated JSON files in the archive directory.

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import writeFileAtomic from 'write-file-atomic';
import { paths } from '../storage/dirs.js';
import { loadState, saveState } from './state.js';

interface RotatorConfig {
  maxRecommendationsInFile: number;
  archiveAfterDays: number;
}

/**
 * Rotate old applied/dismissed recommendations to archive files.
 * Pending entries are never archived regardless of age.
 */
export async function rotateRecommendations(
  config: RotatorConfig,
): Promise<void> {
  const state = await loadState();
  const cutoff = new Date(Date.now() - config.archiveAfterDays * 86400_000);

  const toArchive = state.entries.filter(
    (e) =>
      (e.status === 'applied' || e.status === 'dismissed') &&
      new Date(e.updated_at) < cutoff,
  );

  if (toArchive.length === 0) {
    return;
  }

  const toKeep = state.entries.filter(
    (e) => !toArchive.some((a) => a.id === e.id),
  );

  // Write archive file with today's date
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const archivePath = join(paths.recommendationArchive, `${today}.json`);
  await mkdir(paths.recommendationArchive, { recursive: true });
  await writeFileAtomic(archivePath, JSON.stringify(toArchive, null, 2));

  // Update state with only kept entries
  await saveState({
    entries: toKeep,
    last_updated: new Date().toISOString(),
  });
}
