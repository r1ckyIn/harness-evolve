import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fork } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = join(__dirname, '..', 'helpers', 'increment-worker.ts');

/**
 * Spawn a child process that runs the increment-worker.
 * Uses fork with tsx loader to execute TypeScript directly.
 */
function spawnWorker(
  sessionId: string,
  count: number,
  homeDir: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = fork(WORKER_PATH, [sessionId, String(count), homeDir], {
      execArgv: ['--import', 'tsx'],
      stdio: 'pipe',
    });

    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Worker ${sessionId} exited with code ${code}: ${stderr}`));
      }
    });
    child.on('error', reject);
  });
}

describe('concurrent counter integration', () => {
  let tempDir: string;
  const originalHome = process.env.HOME;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'evolve-concurrent-'));
    vi.stubEnv('HOME', tempDir);
    vi.resetModules();
  });

  afterEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('two processes x 100 increments = exactly 200', { timeout: 60000 }, async () => {
    // Initialize dirs so counter file location is ready
    const { ensureInit, resetInit } = await import('../../src/storage/dirs.js');
    resetInit();
    await ensureInit();

    // Spawn two concurrent workers
    await Promise.all([
      spawnWorker('worker-a', 100, tempDir),
      spawnWorker('worker-b', 100, tempDir),
    ]);

    // Read the counter in this process (reset init to pick up temp HOME)
    resetInit();
    const { readCounter } = await import('../../src/storage/counter.js');
    const counter = await readCounter();

    // CRITICAL: Roadmap Success Criterion #3
    expect(counter.total).toBe(200);
  });

  it('session map tracks both workers correctly after concurrent run', { timeout: 60000 }, async () => {
    const { ensureInit, resetInit } = await import('../../src/storage/dirs.js');
    resetInit();
    await ensureInit();

    await Promise.all([
      spawnWorker('worker-a', 100, tempDir),
      spawnWorker('worker-b', 100, tempDir),
    ]);

    resetInit();
    const { readCounter } = await import('../../src/storage/counter.js');
    const counter = await readCounter();

    expect(counter.session['worker-a']).toBe(100);
    expect(counter.session['worker-b']).toBe(100);
  });
});
