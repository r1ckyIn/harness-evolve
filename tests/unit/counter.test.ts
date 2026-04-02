import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('counter module', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'harness-evolve-counter-'));
    vi.stubEnv('HOME', tempDir);
    vi.resetModules();
  });

  afterEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('first increment returns 1 when no counter file exists', async () => {
    const { resetInit } = await import('../../src/storage/dirs.js');
    const { incrementCounter } = await import('../../src/storage/counter.js');
    resetInit();

    const result = await incrementCounter('session-1');
    expect(result).toBe(1);
  });

  it('tracks total across multiple increments', async () => {
    const { resetInit } = await import('../../src/storage/dirs.js');
    const { incrementCounter, readCounter } = await import('../../src/storage/counter.js');
    resetInit();

    await incrementCounter('session-1');
    await incrementCounter('session-1');
    await incrementCounter('session-1');

    const counter = await readCounter();
    expect(counter.total).toBe(3);
    expect(counter.session['session-1']).toBe(3);
  });

  it('tracks multiple session IDs independently', async () => {
    const { resetInit } = await import('../../src/storage/dirs.js');
    const { incrementCounter, readCounter } = await import('../../src/storage/counter.js');
    resetInit();

    await incrementCounter('s1');
    await incrementCounter('s2');

    const counter = await readCounter();
    expect(counter.total).toBe(2);
    expect(counter.session['s1']).toBe(1);
    expect(counter.session['s2']).toBe(1);
  });

  it('persists counter data to disk', async () => {
    const { resetInit, paths } = await import('../../src/storage/dirs.js');
    const { incrementCounter } = await import('../../src/storage/counter.js');
    resetInit();

    await incrementCounter('session-1');
    await incrementCounter('session-1');

    // Read file directly to verify persistence
    const raw = await readFile(paths.counter, 'utf-8');
    const data = JSON.parse(raw);
    expect(data.total).toBe(2);
    expect(data.session['session-1']).toBe(2);
  });

  it('readCounter returns defaults when no file exists', async () => {
    const { resetInit } = await import('../../src/storage/dirs.js');
    const { readCounter } = await import('../../src/storage/counter.js');
    resetInit();

    const counter = await readCounter();
    expect(counter.total).toBe(0);
    expect(counter.session).toEqual({});
  });

  it('resetCounter sets total to 0 and clears session', async () => {
    const { resetInit } = await import('../../src/storage/dirs.js');
    const { incrementCounter, readCounter, resetCounter } = await import('../../src/storage/counter.js');
    resetInit();

    await incrementCounter('session-1');
    await incrementCounter('session-1');
    await incrementCounter('session-2');

    await resetCounter();
    const counter = await readCounter();
    expect(counter.total).toBe(0);
    expect(counter.session).toEqual({});
  });

  it('sets last_updated to a valid ISO datetime after increment', async () => {
    const { resetInit } = await import('../../src/storage/dirs.js');
    const { incrementCounter, readCounter } = await import('../../src/storage/counter.js');
    resetInit();

    const before = new Date().toISOString();
    await incrementCounter('session-1');
    const after = new Date().toISOString();

    const counter = await readCounter();
    expect(counter.last_updated).toBeDefined();
    // Verify it's a valid ISO datetime string
    const parsed = new Date(counter.last_updated);
    expect(parsed.toISOString()).toBe(counter.last_updated);
    // Verify it falls within the expected time range
    expect(counter.last_updated >= before).toBe(true);
    expect(counter.last_updated <= after).toBe(true);
  });
});
