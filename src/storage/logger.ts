// JSONL logger with scrub-before-write pipeline and daily rotation.
// Pipeline: raw data -> validate schema -> scrub strings -> append JSONL
// Implements D-01 (scrub on write), D-03 (separate dirs), D-04 (daily rotation).

import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod/v4';
import {
  promptEntrySchema,
  toolEntrySchema,
  permissionEntrySchema,
  sessionEntrySchema,
} from '../schemas/log-entry.js';
import { scrubObject } from '../scrubber/scrub.js';
import { paths, ensureInit } from './dirs.js';

// Schema map (schemas are static, safe to capture at module level)
const SCHEMA_MAP = {
  prompts: promptEntrySchema,
  tools: toolEntrySchema,
  permissions: permissionEntrySchema,
  sessions: sessionEntrySchema,
} as const;

export type LogType = keyof typeof SCHEMA_MAP;

// Resolve directory path at call time (not module load) to support testing
function getLogDir(type: LogType): string {
  return paths.logs[type];
}

function getLogFilePath(type: LogType, date?: Date): string {
  const dateStr = (date ?? new Date()).toISOString().slice(0, 10); // YYYY-MM-DD per D-04
  return join(getLogDir(type), `${dateStr}.jsonl`);
}

/**
 * Validate, scrub, and append a log entry as a JSONL line.
 *
 * Uses native fs.appendFile (NOT write-file-atomic) because:
 * - JSONL is append-only, not replace
 * - appendFile is atomic for writes <4KB on POSIX
 * - write-file-atomic replaces entire file (anti-pattern for appends)
 */
export async function appendLogEntry(type: LogType, rawEntry: unknown): Promise<void> {
  await ensureInit();
  const schema = SCHEMA_MAP[type];
  const validated = (schema as z.ZodType).parse(rawEntry);
  const scrubbed = scrubObject(validated); // D-01: scrub before write
  const line = JSON.stringify(scrubbed) + '\n';
  const filePath = getLogFilePath(type);
  await appendFile(filePath, line, 'utf-8');
}
