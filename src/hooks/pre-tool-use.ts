// PreToolUse hook handler: captures tool invocation start events.
// Writes a marker file with start timestamp for duration correlation.
// PostToolUse reads this marker to calculate duration_ms.

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { preToolUseInputSchema } from '../schemas/hook-input.js';
import { appendLogEntry } from '../storage/logger.js';
import { incrementCounter } from '../storage/counter.js';
import { loadConfig } from '../storage/config.js';
import { paths, ensureInit } from '../storage/dirs.js';
import { readStdin, summarizeToolInput } from './shared.js';

/**
 * Core handler logic, exported for testability.
 * Validates input, writes start-time marker, logs 'pre' tool entry,
 * increments counter. Swallows all errors to never block Claude Code.
 */
export async function handlePreToolUse(rawJson: string): Promise<void> {
  try {
    const config = await loadConfig();
    if (!config.hooks.captureTools) return;

    const input = preToolUseInputSchema.parse(JSON.parse(rawJson));

    // Ensure pending directory exists before writing marker
    await ensureInit();

    // Write start-time marker for duration correlation (Pattern 3 from research)
    const markerPath = join(paths.pending, `${input.tool_use_id}.ts`);
    await writeFile(markerPath, Date.now().toString(), 'utf-8');

    await appendLogEntry('tools', {
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      event: 'pre' as const,
      tool_name: input.tool_name,
      input_summary: summarizeToolInput(input.tool_name, input.tool_input as Record<string, unknown>),
    });

    await incrementCounter(input.session_id);
  } catch {
    // Never block Claude Code on capture errors
  }
}

// Entry point when invoked by Claude Code as a command hook
async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    await handlePreToolUse(raw);
  } catch {
    // Never block Claude Code
  }
  process.exit(0);
}

main();
