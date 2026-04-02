// Unit tests for the JSONL log reader with date filtering and malformed line handling.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readLogEntries } from '../../../src/analysis/jsonl-reader.js';
import { promptEntrySchema } from '../../../src/schemas/log-entry.js';

let tempDir: string;

// Helper: create a valid prompt entry JSONL line
function makePromptLine(overrides: Partial<{
  timestamp: string;
  session_id: string;
  cwd: string;
  prompt: string;
  prompt_length: number;
}> = {}): string {
  return JSON.stringify({
    timestamp: overrides.timestamp ?? '2026-01-15T10:00:00.000Z',
    session_id: overrides.session_id ?? 'sess-001',
    cwd: overrides.cwd ?? '/home/user',
    prompt: overrides.prompt ?? 'hello world',
    prompt_length: overrides.prompt_length ?? 11,
  });
}

describe('readLogEntries', () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'jsonl-reader-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reads all entries from multiple .jsonl files', async () => {
    const dir = join(tempDir, 'logs');
    await mkdir(dir, { recursive: true });

    const line1 = makePromptLine({ prompt: 'a', prompt_length: 1 });
    const line2 = makePromptLine({ prompt: 'b', prompt_length: 1 });
    const line3 = makePromptLine({ prompt: 'c', prompt_length: 1, timestamp: '2026-01-16T10:00:00.000Z' });
    const line4 = makePromptLine({ prompt: 'd', prompt_length: 1, timestamp: '2026-01-16T11:00:00.000Z' });

    await writeFile(join(dir, '2026-01-15.jsonl'), line1 + '\n' + line2 + '\n');
    await writeFile(join(dir, '2026-01-16.jsonl'), line3 + '\n' + line4 + '\n');

    const entries = await readLogEntries(dir, promptEntrySchema);
    expect(entries).toHaveLength(4);
    // Chronological order: 2026-01-15 entries first, then 2026-01-16
    expect(entries[0].prompt).toBe('a');
    expect(entries[1].prompt).toBe('b');
    expect(entries[2].prompt).toBe('c');
    expect(entries[3].prompt).toBe('d');
  });

  it('filters by since date', async () => {
    const dir = join(tempDir, 'logs');
    await mkdir(dir, { recursive: true });

    await writeFile(join(dir, '2026-01-14.jsonl'), makePromptLine({ timestamp: '2026-01-14T10:00:00.000Z' }) + '\n');
    await writeFile(join(dir, '2026-01-15.jsonl'), makePromptLine({ timestamp: '2026-01-15T10:00:00.000Z' }) + '\n');
    await writeFile(join(dir, '2026-01-16.jsonl'), makePromptLine({ timestamp: '2026-01-16T10:00:00.000Z' }) + '\n');

    const entries = await readLogEntries(dir, promptEntrySchema, {
      since: new Date('2026-01-15'),
    });
    expect(entries).toHaveLength(2);
    expect(entries[0].timestamp).toContain('2026-01-15');
    expect(entries[1].timestamp).toContain('2026-01-16');
  });

  it('filters by until date', async () => {
    const dir = join(tempDir, 'logs');
    await mkdir(dir, { recursive: true });

    await writeFile(join(dir, '2026-01-14.jsonl'), makePromptLine({ timestamp: '2026-01-14T10:00:00.000Z' }) + '\n');
    await writeFile(join(dir, '2026-01-15.jsonl'), makePromptLine({ timestamp: '2026-01-15T10:00:00.000Z' }) + '\n');
    await writeFile(join(dir, '2026-01-16.jsonl'), makePromptLine({ timestamp: '2026-01-16T10:00:00.000Z' }) + '\n');

    const entries = await readLogEntries(dir, promptEntrySchema, {
      until: new Date('2026-01-15'),
    });
    expect(entries).toHaveLength(2);
    expect(entries[0].timestamp).toContain('2026-01-14');
    expect(entries[1].timestamp).toContain('2026-01-15');
  });

  it('filters by date range (since and until)', async () => {
    const dir = join(tempDir, 'logs');
    await mkdir(dir, { recursive: true });

    await writeFile(join(dir, '2026-01-14.jsonl'), makePromptLine({ timestamp: '2026-01-14T10:00:00.000Z' }) + '\n');
    await writeFile(join(dir, '2026-01-15.jsonl'), makePromptLine({ timestamp: '2026-01-15T10:00:00.000Z' }) + '\n');
    await writeFile(join(dir, '2026-01-16.jsonl'), makePromptLine({ timestamp: '2026-01-16T10:00:00.000Z' }) + '\n');

    const entries = await readLogEntries(dir, promptEntrySchema, {
      since: new Date('2026-01-15'),
      until: new Date('2026-01-15'),
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].timestamp).toContain('2026-01-15');
  });

  it('skips malformed JSON lines', async () => {
    const dir = join(tempDir, 'logs');
    await mkdir(dir, { recursive: true });

    const validLine1 = makePromptLine({ prompt: 'valid-1', prompt_length: 7 });
    const malformed = '{bad';
    const validLine2 = makePromptLine({ prompt: 'valid-2', prompt_length: 7 });

    await writeFile(join(dir, '2026-01-15.jsonl'), [validLine1, malformed, validLine2].join('\n') + '\n');

    const entries = await readLogEntries(dir, promptEntrySchema);
    expect(entries).toHaveLength(2);
    expect(entries[0].prompt).toBe('valid-1');
    expect(entries[1].prompt).toBe('valid-2');
  });

  it('skips schema-invalid lines', async () => {
    const dir = join(tempDir, 'logs');
    await mkdir(dir, { recursive: true });

    const validLine = makePromptLine({ prompt: 'valid', prompt_length: 5 });
    // Missing required fields (no session_id, no cwd, no prompt, no prompt_length)
    const invalidSchema = JSON.stringify({ timestamp: '2026-01-15T10:00:00.000Z' });

    await writeFile(join(dir, '2026-01-15.jsonl'), [validLine, invalidSchema].join('\n') + '\n');

    const entries = await readLogEntries(dir, promptEntrySchema);
    expect(entries).toHaveLength(1);
    expect(entries[0].prompt).toBe('valid');
  });

  it('returns empty array for non-existent directory', async () => {
    const entries = await readLogEntries(
      join(tempDir, 'does-not-exist'),
      promptEntrySchema,
    );
    expect(entries).toEqual([]);
  });

  it('returns empty array for empty directory', async () => {
    const dir = join(tempDir, 'empty');
    await mkdir(dir, { recursive: true });

    const entries = await readLogEntries(dir, promptEntrySchema);
    expect(entries).toEqual([]);
  });
});
