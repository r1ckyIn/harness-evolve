// Recommendation state lifecycle management.
// Tracks recommendation statuses (pending/applied/dismissed) in a JSON file
// that survives across analysis re-runs and sessions.

import { readFile } from 'node:fs/promises';
import writeFileAtomic from 'write-file-atomic';
import { paths } from '../storage/dirs.js';
import {
  recommendationStateSchema,
  type RecommendationState,
  type RecommendationStatus,
} from '../schemas/delivery.js';

/**
 * Load the recommendation state from disk.
 * Returns an empty state when the file does not exist.
 */
export async function loadState(): Promise<RecommendationState> {
  try {
    const raw = await readFile(paths.recommendationState, 'utf-8');
    return recommendationStateSchema.parse(JSON.parse(raw));
  } catch (err: unknown) {
    // File not found or invalid JSON: return empty state
    if (isNodeError(err) && err.code === 'ENOENT') {
      return { entries: [], last_updated: new Date().toISOString() };
    }
    // Re-throw unexpected errors
    throw err;
  }
}

/**
 * Save the recommendation state atomically to disk.
 */
export async function saveState(state: RecommendationState): Promise<void> {
  await writeFileAtomic(
    paths.recommendationState,
    JSON.stringify(state, null, 2),
  );
}

/**
 * Update the status of a recommendation by ID.
 * Creates a new entry if the ID is not found.
 */
export async function updateStatus(
  id: string,
  status: RecommendationStatus,
  details?: string,
): Promise<void> {
  const state = await loadState();
  const now = new Date().toISOString();

  const existing = state.entries.find((e) => e.id === id);
  if (existing) {
    existing.status = status;
    existing.updated_at = now;
    if (status === 'applied' && details !== undefined) {
      existing.applied_details = details;
    } else if (status !== 'applied') {
      // Clear applied_details when not in applied status
      existing.applied_details = undefined;
    }
  } else {
    state.entries.push({
      id,
      status,
      updated_at: now,
      ...(status === 'applied' && details !== undefined
        ? { applied_details: details }
        : {}),
    });
  }

  state.last_updated = now;
  await saveState(state);
}

/**
 * Get a Map of recommendation ID to status for quick lookups.
 */
export async function getStatusMap(): Promise<Map<string, RecommendationStatus>> {
  const state = await loadState();
  return new Map(state.entries.map((e) => [e.id, e.status]));
}

// Type guard for Node.js errors with code property
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
