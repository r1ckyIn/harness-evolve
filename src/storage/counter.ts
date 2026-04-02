import { readFile } from 'node:fs/promises';
import { lock } from 'proper-lockfile';
import writeFileAtomic from 'write-file-atomic';
import { counterSchema, type Counter } from '../schemas/counter.js';
import { paths, ensureInit } from './dirs.js';

/**
 * Read the current counter state from disk.
 * Returns defaults (total=0, session={}) if no counter file exists.
 */
export async function readCounter(): Promise<Counter> {
  await ensureInit();
  try {
    const raw = await readFile(paths.counter, 'utf-8');
    return counterSchema.parse(JSON.parse(raw));
  } catch {
    // File doesn't exist or invalid -- return defaults
    return {
      total: 0,
      session: {},
      last_updated: new Date().toISOString(),
    };
  }
}

/**
 * Atomically increment the interaction counter with cross-process safety.
 *
 * Uses proper-lockfile (mkdir-based, macOS-safe) for cross-process locking
 * and write-file-atomic for crash-safe writes inside the lock.
 *
 * Pattern: ensure-file -> lock -> read -> increment -> atomic-write -> unlock
 */
export async function incrementCounter(sessionId: string): Promise<number> {
  await ensureInit();

  // Ensure counter file exists before locking (proper-lockfile requires existing file)
  try {
    await readFile(paths.counter, 'utf-8');
  } catch {
    const initial: Counter = {
      total: 0,
      session: {},
      last_updated: new Date().toISOString(),
    };
    await writeFileAtomic(paths.counter, JSON.stringify(initial, null, 2));
  }

  const release = await lock(paths.counter, {
    retries: { retries: 10, minTimeout: 50, maxTimeout: 500 },
    stale: 10000, // Consider lock stale after 10 seconds
  });

  try {
    const raw = await readFile(paths.counter, 'utf-8');
    const data = counterSchema.parse(JSON.parse(raw));
    data.total += 1;
    data.session[sessionId] = (data.session[sessionId] ?? 0) + 1;
    data.last_updated = new Date().toISOString();
    await writeFileAtomic(paths.counter, JSON.stringify(data, null, 2));
    return data.total;
  } finally {
    await release();
  }
}

/**
 * Reset the counter to zero. Used for testing and post-analysis reset.
 */
export async function resetCounter(): Promise<void> {
  await ensureInit();
  const data: Counter = {
    total: 0,
    session: {},
    last_updated: new Date().toISOString(),
  };
  await writeFileAtomic(paths.counter, JSON.stringify(data, null, 2));
}
