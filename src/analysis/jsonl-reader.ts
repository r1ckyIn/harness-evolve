// Streaming JSONL reader with date-range filtering and schema validation.
// Reads daily-rotated .jsonl log files (YYYY-MM-DD.jsonl) and returns
// validated, typed entries. Malformed or schema-invalid lines are silently
// skipped to ensure robustness against partial writes or corruption.

import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import type { z } from 'zod/v4';

/**
 * Format a Date as YYYY-MM-DD for filename comparison.
 */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Read and parse all JSONL entries from a log directory, optionally
 * filtered by date range. Files are read in chronological order
 * (sorted by YYYY-MM-DD filename).
 *
 * @param logDir  - Directory containing YYYY-MM-DD.jsonl files
 * @param schema  - Zod schema for parsing and type inference
 * @param options - Optional date range filter (inclusive boundaries)
 * @returns Array of validated, typed entries
 */
export async function readLogEntries<T>(
  logDir: string,
  schema: z.ZodType<T>,
  options?: { since?: Date; until?: Date },
): Promise<T[]> {
  let fileNames: string[];
  try {
    fileNames = await readdir(logDir);
  } catch {
    // Directory does not exist or is unreadable
    return [];
  }

  // Keep only .jsonl files
  let jsonlFiles = fileNames.filter((f) => f.endsWith('.jsonl'));

  // Apply date range filtering based on filename (YYYY-MM-DD.jsonl)
  const sinceStr = options?.since ? formatDate(options.since) : undefined;
  const untilStr = options?.until ? formatDate(options.until) : undefined;

  if (sinceStr || untilStr) {
    jsonlFiles = jsonlFiles.filter((f) => {
      const dateStr = f.replace('.jsonl', '');
      if (sinceStr && dateStr < sinceStr) return false;
      if (untilStr && dateStr > untilStr) return false;
      return true;
    });
  }

  // Sort alphabetically for chronological order (YYYY-MM-DD sorts lexically)
  jsonlFiles.sort();

  const entries: T[] = [];

  for (const file of jsonlFiles) {
    const filePath = join(logDir, file);
    const rl = createInterface({
      input: createReadStream(filePath, 'utf-8'),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const parsed = schema.parse(JSON.parse(line));
        entries.push(parsed);
      } catch {
        // Silently skip malformed JSON or schema validation failures
      }
    }
  }

  return entries;
}
