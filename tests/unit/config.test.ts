import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('config schema', () => {
  it('parses empty object to full defaults', async () => {
    const { configSchema } = await import('../../src/schemas/config.js');
    const result = configSchema.parse({});
    expect(result.version).toBe(1);
    expect(result.analysis.threshold).toBe(50);
    expect(result.analysis.enabled).toBe(true);
    expect(result.hooks.capturePrompts).toBe(true);
    expect(result.scrubbing.enabled).toBe(true);
    expect(result.scrubbing.highEntropyDetection).toBe(false);
    expect(result.delivery.stdoutInjection).toBe(true);
    expect(result.delivery.maxTokens).toBe(200);
  });

  it('merges partial overrides with defaults', async () => {
    const { configSchema } = await import('../../src/schemas/config.js');
    const result = configSchema.parse({ analysis: { threshold: 100 } });
    expect(result.analysis.threshold).toBe(100);
    expect(result.analysis.enabled).toBe(true);
    expect(result.version).toBe(1);
    expect(result.delivery.maxTokens).toBe(200);
  });

  it('rejects unknown fields in strict mode', async () => {
    const { configSchema } = await import('../../src/schemas/config.js');
    const result = configSchema.safeParse({ unknownField: true });
    expect(result.success).toBe(false);
  });
});

describe('storage dirs', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'harness-evolve-test-'));
  });

  afterEach(async () => {
    // Reset module cache to allow fresh imports with new env
    vi.resetModules();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('ensureInit creates all required directories', async () => {
    vi.stubEnv('HOME', tempDir);
    const { ensureInit, paths, resetInit } = await import('../../src/storage/dirs.js');
    resetInit();

    // Override paths to use temp dir
    const base = join(tempDir, '.harness-evolve');
    await ensureInit();

    // Verify directories were created
    const dirs = [
      join(base, 'logs', 'prompts'),
      join(base, 'logs', 'tools'),
      join(base, 'logs', 'permissions'),
      join(base, 'logs', 'sessions'),
      join(base, 'analysis'),
    ];

    for (const dir of dirs) {
      const s = await stat(dir);
      expect(s.isDirectory()).toBe(true);
    }
  });

  it('ensureInit is idempotent (calling twice does not error)', async () => {
    vi.stubEnv('HOME', tempDir);
    const { ensureInit, resetInit } = await import('../../src/storage/dirs.js');
    resetInit();

    await ensureInit();
    await ensureInit(); // Should not throw
  });

  it('paths.base uses HOME env variable', async () => {
    vi.stubEnv('HOME', tempDir);
    const { paths, resetInit } = await import('../../src/storage/dirs.js');
    resetInit();

    expect(paths.base).toBe(join(tempDir, '.harness-evolve'));
    expect(paths.logs.prompts).toBe(join(tempDir, '.harness-evolve', 'logs', 'prompts'));
  });
});

describe('config loader', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'harness-evolve-test-'));
  });

  afterEach(async () => {
    vi.resetModules();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates default config.json when no file exists', async () => {
    vi.stubEnv('HOME', tempDir);

    // Import after env is set so paths pick up the new HOME
    const { ensureInit, resetInit } = await import('../../src/storage/dirs.js');
    const { loadConfig } = await import('../../src/storage/config.js');
    resetInit();
    await ensureInit();

    const config = await loadConfig();
    expect(config.version).toBe(1);
    expect(config.analysis.threshold).toBe(50);
    expect(config.analysis.enabled).toBe(true);

    // Verify file was written
    const configPath = join(tempDir, '.harness-evolve', 'config.json');
    const written = JSON.parse(await readFile(configPath, 'utf-8'));
    expect(written.version).toBe(1);
    expect(written.analysis.threshold).toBe(50);
  });

  it('loads and merges partial user overrides', async () => {
    vi.stubEnv('HOME', tempDir);

    const { ensureInit, paths, resetInit } = await import('../../src/storage/dirs.js');
    const { loadConfig } = await import('../../src/storage/config.js');
    resetInit();
    await ensureInit();

    // Write partial config file
    const userConfig = { analysis: { threshold: 100 } };
    await writeFile(paths.config, JSON.stringify(userConfig), 'utf-8');

    const config = await loadConfig();
    expect(config.analysis.threshold).toBe(100);
    expect(config.analysis.enabled).toBe(true); // default preserved
    expect(config.version).toBe(1); // default preserved
    expect(config.delivery.maxTokens).toBe(200); // default preserved
  });

  it('falls back to defaults when file has invalid/unknown fields', async () => {
    vi.stubEnv('HOME', tempDir);

    const { ensureInit, paths, resetInit } = await import('../../src/storage/dirs.js');
    const { loadConfig } = await import('../../src/storage/config.js');
    resetInit();
    await ensureInit();

    // Write config with unknown field (strict mode rejects this)
    const badConfig = { unknownField: true };
    await writeFile(paths.config, JSON.stringify(badConfig), 'utf-8');

    const config = await loadConfig();
    // Should fall back to defaults
    expect(config.version).toBe(1);
    expect(config.analysis.threshold).toBe(50);
  });
});
