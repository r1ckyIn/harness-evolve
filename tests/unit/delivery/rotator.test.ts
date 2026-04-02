// Unit tests for the recommendation rotator.
// Tests: no-op when under threshold, archiving old applied/dismissed entries,
// state cleanup after rotation, archive file validity.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { RecommendationState, RecommendationStateEntry } from '../../../src/schemas/delivery.js';

// Temp directory updated per-test
let tempDir: string;

// Mock dirs module to redirect paths to temp directory
vi.mock('../../../src/storage/dirs.js', async () => {
  return {
    get paths() {
      return {
        base: tempDir,
        recommendationState: join(tempDir, 'analysis', 'recommendation-state.json'),
        recommendationArchive: join(tempDir, 'analysis', 'recommendations-archive'),
      };
    },
    ensureInit: vi.fn().mockResolvedValue(undefined),
  };
});

// Import after mock setup
const { loadState, saveState } = await import('../../../src/delivery/state.js');
const { rotateRecommendations } = await import('../../../src/delivery/rotator.js');

describe('rotator', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-delivery-rotator-'));
    await mkdir(join(tempDir, 'analysis', 'recommendations-archive'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('does nothing when all entries are under archiveAfterDays threshold', async () => {
    // Entries updated recently (1 day ago) -- should NOT be archived
    const recentDate = new Date(Date.now() - 1 * 86400_000).toISOString();

    const state: RecommendationState = {
      entries: [
        { id: 'r1', status: 'applied', updated_at: recentDate },
        { id: 'r2', status: 'dismissed', updated_at: recentDate },
        { id: 'r3', status: 'pending', updated_at: recentDate },
      ],
      last_updated: recentDate,
    };
    await saveState(state);

    await rotateRecommendations({
      maxRecommendationsInFile: 20,
      archiveAfterDays: 7,
    });

    const loaded = await loadState();
    expect(loaded.entries).toHaveLength(3);
  });

  it('archives applied/dismissed entries older than archiveAfterDays', async () => {
    // Old entries: 10 days ago (should be archived)
    const oldDate = new Date(Date.now() - 10 * 86400_000).toISOString();
    // Recent entry: 1 day ago (should be kept)
    const recentDate = new Date(Date.now() - 1 * 86400_000).toISOString();

    const state: RecommendationState = {
      entries: [
        { id: 'r-old-applied', status: 'applied', updated_at: oldDate, applied_details: 'test' },
        { id: 'r-old-dismissed', status: 'dismissed', updated_at: oldDate },
        { id: 'r-old-pending', status: 'pending', updated_at: oldDate },
        { id: 'r-new-applied', status: 'applied', updated_at: recentDate },
      ],
      last_updated: recentDate,
    };
    await saveState(state);

    await rotateRecommendations({
      maxRecommendationsInFile: 20,
      archiveAfterDays: 7,
    });

    // After rotation: only keep entries that are pending OR recent
    const loaded = await loadState();
    const ids = loaded.entries.map((e) => e.id);
    expect(ids).toContain('r-old-pending'); // pending entries are never archived
    expect(ids).toContain('r-new-applied'); // recent applied is kept
    expect(ids).not.toContain('r-old-applied'); // old applied archived
    expect(ids).not.toContain('r-old-dismissed'); // old dismissed archived
  });

  it('state file only contains non-archived entries after rotation', async () => {
    const oldDate = new Date(Date.now() - 10 * 86400_000).toISOString();

    const state: RecommendationState = {
      entries: [
        { id: 'r1', status: 'applied', updated_at: oldDate },
        { id: 'r2', status: 'pending', updated_at: oldDate },
      ],
      last_updated: oldDate,
    };
    await saveState(state);

    await rotateRecommendations({
      maxRecommendationsInFile: 20,
      archiveAfterDays: 7,
    });

    const loaded = await loadState();
    expect(loaded.entries).toHaveLength(1);
    expect(loaded.entries[0].id).toBe('r2');
  });

  it('archive file is valid JSON array of RecommendationStateEntry objects', async () => {
    const oldDate = new Date(Date.now() - 10 * 86400_000).toISOString();

    const state: RecommendationState = {
      entries: [
        { id: 'r-arch', status: 'applied', updated_at: oldDate, applied_details: 'archived' },
      ],
      last_updated: oldDate,
    };
    await saveState(state);

    await rotateRecommendations({
      maxRecommendationsInFile: 20,
      archiveAfterDays: 7,
    });

    // Find archive file (YYYY-MM-DD.json)
    const { readdir } = await import('node:fs/promises');
    const archiveDir = join(tempDir, 'analysis', 'recommendations-archive');
    const files = await readdir(archiveDir);
    const archiveFiles = files.filter((f) => f.endsWith('.json'));

    expect(archiveFiles.length).toBeGreaterThanOrEqual(1);

    const archiveContent = await readFile(
      join(archiveDir, archiveFiles[0]),
      'utf-8',
    );
    const archived = JSON.parse(archiveContent) as RecommendationStateEntry[];

    expect(Array.isArray(archived)).toBe(true);
    expect(archived.length).toBe(1);
    expect(archived[0].id).toBe('r-arch');
    expect(archived[0].status).toBe('applied');
    expect(archived[0].applied_details).toBe('archived');
  });
});
