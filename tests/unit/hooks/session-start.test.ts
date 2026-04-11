import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rm, mkdtemp, mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Import schema directly (no mocking needed)
import { sessionStartInputSchema } from '../../../src/schemas/hook-input.js';

// ─── Schema validation tests ───────────────────────────────────────────────

describe('sessionStartInputSchema', () => {
  const validInput = {
    session_id: 'test-session-001',
    transcript_path: '/tmp/transcripts/abc.jsonl',
    cwd: '/home/user/project',
    permission_mode: 'default',
    hook_event_name: 'SessionStart',
    source: 'startup',
  };

  it('validates correct SessionStart event shape', () => {
    const result = sessionStartInputSchema.parse(validInput);
    expect(result.hook_event_name).toBe('SessionStart');
    expect(result.source).toBe('startup');
    expect(result.session_id).toBe('test-session-001');
    expect(result.cwd).toBe('/home/user/project');
  });

  it('rejects non-SessionStart hook_event_name', () => {
    const wrongEvent = { ...validInput, hook_event_name: 'Stop' };
    expect(() => sessionStartInputSchema.parse(wrongEvent)).toThrow();
  });

  it('accepts all 4 source values: startup, resume, clear, compact', () => {
    for (const source of ['startup', 'resume', 'clear', 'compact']) {
      const input = { ...validInput, source };
      const result = sessionStartInputSchema.parse(input);
      expect(result.source).toBe(source);
    }
  });

  it('rejects invalid source value', () => {
    const invalid = { ...validInput, source: 'unknown' };
    expect(() => sessionStartInputSchema.parse(invalid)).toThrow();
  });

  it('accepts optional model field', () => {
    const withModel = { ...validInput, model: 'claude-sonnet-4-20250514' };
    const result = sessionStartInputSchema.parse(withModel);
    expect(result.model).toBe('claude-sonnet-4-20250514');
  });

  it('validates without model field (undefined)', () => {
    const result = sessionStartInputSchema.parse(validInput);
    expect(result.model).toBeUndefined();
  });
});

// ─── checkAndRepairSlashCommands tests (real filesystem) ────────────────────

describe('checkAndRepairSlashCommands', () => {
  let tempDir: string;
  let evolveDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'he-session-'));
    evolveDir = join(tempDir, '.claude', 'commands', 'evolve');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // Lazy import to avoid module resolution issues
  async function importModule() {
    const mod = await import('../../../src/hooks/session-start.js');
    return mod;
  }

  it('returns { repaired: false, details: [] } when both files exist at current version', async () => {
    const { checkAndRepairSlashCommands } = await importModule();
    const { getScanTemplateVersion } = await import('../../../src/commands/evolve-scan.js');
    const { getApplyTemplateVersion } = await import('../../../src/commands/evolve-apply.js');
    const { generateScanCommand } = await import('../../../src/commands/evolve-scan.js');
    const { generateApplyCommand } = await import('../../../src/commands/evolve-apply.js');

    // Pre-install current-version files
    await mkdir(evolveDir, { recursive: true });
    await writeFile(join(evolveDir, 'scan.md'), generateScanCommand(), 'utf-8');
    await writeFile(join(evolveDir, 'apply.md'), generateApplyCommand(), 'utf-8');

    const result = await checkAndRepairSlashCommands(tempDir);
    expect(result.repaired).toBe(false);
    expect(result.details).toEqual([]);
  });

  it('returns { repaired: true } with scan.md installed when scan.md is missing', async () => {
    const { checkAndRepairSlashCommands } = await importModule();
    const { generateApplyCommand } = await import('../../../src/commands/evolve-apply.js');

    // Only install apply.md
    await mkdir(evolveDir, { recursive: true });
    await writeFile(join(evolveDir, 'apply.md'), generateApplyCommand(), 'utf-8');

    const result = await checkAndRepairSlashCommands(tempDir);
    expect(result.repaired).toBe(true);
    expect(result.details).toContain('scan.md installed');
  });

  it('returns { repaired: true } with apply.md installed when apply.md is missing', async () => {
    const { checkAndRepairSlashCommands } = await importModule();
    const { generateScanCommand } = await import('../../../src/commands/evolve-scan.js');

    // Only install scan.md
    await mkdir(evolveDir, { recursive: true });
    await writeFile(join(evolveDir, 'scan.md'), generateScanCommand(), 'utf-8');

    const result = await checkAndRepairSlashCommands(tempDir);
    expect(result.repaired).toBe(true);
    expect(result.details).toContain('apply.md installed');
  });

  it('returns { repaired: true } with both installed when entire evolve/ directory is missing', async () => {
    const { checkAndRepairSlashCommands } = await importModule();

    // Don't create any directory
    const result = await checkAndRepairSlashCommands(tempDir);
    expect(result.repaired).toBe(true);
    expect(result.details).toContain('scan.md installed');
    expect(result.details).toContain('apply.md installed');
  });

  it('returns { repaired: true } with updated detail when scan.md has stale version', async () => {
    const { checkAndRepairSlashCommands } = await importModule();
    const { generateApplyCommand } = await import('../../../src/commands/evolve-apply.js');

    await mkdir(evolveDir, { recursive: true });
    // Write a stale scan.md with old version
    await writeFile(
      join(evolveDir, 'scan.md'),
      '<!-- template-version: 4 -->\n# Old scan template',
      'utf-8',
    );
    // Write current apply.md
    await writeFile(join(evolveDir, 'apply.md'), generateApplyCommand(), 'utf-8');

    const result = await checkAndRepairSlashCommands(tempDir);
    expect(result.repaired).toBe(true);
    expect(result.details.some(d => d.includes('scan.md updated') && d.includes('v4') && d.includes('v5'))).toBe(true);
  });

  it('after repair, files actually exist with correct content', async () => {
    const { checkAndRepairSlashCommands } = await importModule();

    // Start with empty dir
    const result = await checkAndRepairSlashCommands(tempDir);
    expect(result.repaired).toBe(true);

    // Verify files exist
    await expect(access(join(evolveDir, 'scan.md'))).resolves.not.toThrow();
    await expect(access(join(evolveDir, 'apply.md'))).resolves.not.toThrow();

    // Verify version markers present
    const scanContent = await readFile(join(evolveDir, 'scan.md'), 'utf-8');
    const applyContent = await readFile(join(evolveDir, 'apply.md'), 'utf-8');
    expect(scanContent).toContain('<!-- template-version: 5 -->');
    expect(applyContent).toContain('<!-- template-version: 5 -->');
  });
});

// ─── handleSessionStart tests (mocked checkAndRepairSlashCommands) ──────────

describe('handleSessionStart', () => {
  let stdoutChunks: string[];
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    stdoutChunks = [];
    originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: string | Uint8Array) => {
      stdoutChunks.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
    vi.restoreAllMocks();
  });

  const validInput = {
    session_id: 'test-session-001',
    transcript_path: '/tmp/transcripts/abc.jsonl',
    cwd: '/home/user/project',
    permission_mode: 'default',
    hook_event_name: 'SessionStart',
    source: 'startup',
  };

  it('outputs JSON with hookSpecificOutput.additionalContext when repair was performed', async () => {
    const mod = await import('../../../src/hooks/session-start.js');

    // Use dependency injection to provide a mock repair function
    const mockRepair = async () => ({
      repaired: true,
      details: ['scan.md installed', 'apply.md installed'],
    });

    await mod.handleSessionStart(JSON.stringify(validInput), mockRepair);

    expect(stdoutChunks.length).toBeGreaterThan(0);
    const output = JSON.parse(stdoutChunks.join(''));
    expect(output.hookSpecificOutput).toBeDefined();
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(output.hookSpecificOutput.additionalContext).toContain('Auto-repaired');
    expect(output.hookSpecificOutput.additionalContext).toContain('scan.md installed');
    expect(output.hookSpecificOutput.additionalContext).toContain('apply.md installed');
  });

  it('outputs nothing (empty stdout) when everything is healthy', async () => {
    const mod = await import('../../../src/hooks/session-start.js');

    const mockRepair = async () => ({
      repaired: false,
      details: [] as string[],
    });

    await mod.handleSessionStart(JSON.stringify(validInput), mockRepair);

    expect(stdoutChunks.length).toBe(0);
  });

  it('does not throw on invalid JSON input', async () => {
    const mod = await import('../../../src/hooks/session-start.js');

    await expect(mod.handleSessionStart('not valid json {')).resolves.not.toThrow();
    expect(stdoutChunks.length).toBe(0);
  });

  it('does not throw on missing fields', async () => {
    const mod = await import('../../../src/hooks/session-start.js');

    const incomplete = JSON.stringify({ session_id: 's1' });
    await expect(mod.handleSessionStart(incomplete)).resolves.not.toThrow();
    expect(stdoutChunks.length).toBe(0);
  });

  it('does not throw when checkAndRepairSlashCommands fails', async () => {
    const mod = await import('../../../src/hooks/session-start.js');

    const mockRepairFail = async () => {
      throw new Error('filesystem exploded');
    };

    await expect(mod.handleSessionStart(JSON.stringify(validInput), mockRepairFail)).resolves.not.toThrow();
    expect(stdoutChunks.length).toBe(0);
  });
});
