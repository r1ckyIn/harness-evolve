// Unit tests for recommendation state lifecycle management.
// Tests: loadState (missing file, round-trip), saveState,
// updateStatus (pending->applied, pending->dismissed, new entry),
// getStatusMap.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { RecommendationState } from '../../../src/schemas/delivery.js';

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
const { loadState, saveState, updateStatus, getStatusMap } =
  await import('../../../src/delivery/state.js');

describe('state', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-delivery-state-'));
    // Create analysis directory
    const { mkdir } = await import('node:fs/promises');
    await mkdir(join(tempDir, 'analysis'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('loadState', () => {
    it('returns empty state when file does not exist', async () => {
      const state = await loadState();

      expect(state.entries).toEqual([]);
      expect(state.last_updated).toBeDefined();
      expect(typeof state.last_updated).toBe('string');
    });
  });

  describe('saveState / loadState round-trip', () => {
    it('writes valid JSON that loadState can read back', async () => {
      const state: RecommendationState = {
        entries: [
          {
            id: 'rec-1',
            status: 'pending',
            updated_at: '2026-04-01T00:00:00Z',
          },
        ],
        last_updated: '2026-04-01T00:00:00Z',
      };

      await saveState(state);
      const loaded = await loadState();

      expect(loaded.entries).toHaveLength(1);
      expect(loaded.entries[0].id).toBe('rec-1');
      expect(loaded.entries[0].status).toBe('pending');
      expect(loaded.last_updated).toBe('2026-04-01T00:00:00Z');
    });
  });

  describe('updateStatus', () => {
    it('changes a recommendation from pending to applied with updated_at', async () => {
      // Seed initial state
      const initialState: RecommendationState = {
        entries: [
          {
            id: 'rec-1',
            status: 'pending',
            updated_at: '2026-03-01T00:00:00Z',
          },
        ],
        last_updated: '2026-03-01T00:00:00Z',
      };
      await saveState(initialState);

      await updateStatus('rec-1', 'applied', 'Applied via CLI');

      const loaded = await loadState();
      const entry = loaded.entries.find((e) => e.id === 'rec-1');

      expect(entry).toBeDefined();
      expect(entry!.status).toBe('applied');
      expect(entry!.applied_details).toBe('Applied via CLI');
      // updated_at should be newer than original
      expect(new Date(entry!.updated_at).getTime()).toBeGreaterThan(
        new Date('2026-03-01T00:00:00Z').getTime(),
      );
    });

    it('changes a recommendation from pending to dismissed', async () => {
      const initialState: RecommendationState = {
        entries: [
          {
            id: 'rec-2',
            status: 'pending',
            updated_at: '2026-03-01T00:00:00Z',
          },
        ],
        last_updated: '2026-03-01T00:00:00Z',
      };
      await saveState(initialState);

      await updateStatus('rec-2', 'dismissed');

      const loaded = await loadState();
      const entry = loaded.entries.find((e) => e.id === 'rec-2');

      expect(entry).toBeDefined();
      expect(entry!.status).toBe('dismissed');
      expect(entry!.applied_details).toBeUndefined();
    });

    it('creates a new entry for unknown recommendation ID', async () => {
      // Start with empty state
      const emptyState: RecommendationState = {
        entries: [],
        last_updated: '2026-03-01T00:00:00Z',
      };
      await saveState(emptyState);

      await updateStatus('rec-new', 'applied', 'Auto-applied');

      const loaded = await loadState();
      expect(loaded.entries).toHaveLength(1);
      expect(loaded.entries[0].id).toBe('rec-new');
      expect(loaded.entries[0].status).toBe('applied');
      expect(loaded.entries[0].applied_details).toBe('Auto-applied');
    });
  });

  describe('getStatusMap', () => {
    it('returns Map<string, RecommendationStatus> from loaded state', async () => {
      const state: RecommendationState = {
        entries: [
          {
            id: 'rec-a',
            status: 'applied',
            updated_at: '2026-04-01T00:00:00Z',
          },
          {
            id: 'rec-b',
            status: 'dismissed',
            updated_at: '2026-04-01T00:00:00Z',
          },
          {
            id: 'rec-c',
            status: 'pending',
            updated_at: '2026-04-01T00:00:00Z',
          },
        ],
        last_updated: '2026-04-01T00:00:00Z',
      };
      await saveState(state);

      const statusMap = await getStatusMap();

      expect(statusMap).toBeInstanceOf(Map);
      expect(statusMap.size).toBe(3);
      expect(statusMap.get('rec-a')).toBe('applied');
      expect(statusMap.get('rec-b')).toBe('dismissed');
      expect(statusMap.get('rec-c')).toBe('pending');
    });
  });
});
