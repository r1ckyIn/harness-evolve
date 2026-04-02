// PostToolUse hook handler: captures successful tool completion events.
// Reads PreToolUse marker file to calculate duration_ms, then cleans up marker.

import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { postToolUseInputSchema } from '../schemas/hook-input.js';
import { appendLogEntry } from '../storage/logger.js';
import { incrementCounter } from '../storage/counter.js';
import { loadConfig } from '../storage/config.js';
import { paths } from '../storage/dirs.js';
import { readStdin, summarizeToolInput } from './shared.js';

/**
 * Core handler logic, exported for testability.
 * Reads marker file for duration, validates input, logs 'post' tool entry
 * with duration_ms and success=true, increments counter.
 * Swallows all errors to never block Claude Code.
 */
export async function handlePostToolUse(rawJson: string): Promise<void> {
  try {
    const config = await loadConfig();
    if (!config.hooks.captureTools) return;

    const input = postToolUseInputSchema.parse(JSON.parse(rawJson));

    // Read marker file for duration calculation
    const markerPath = join(paths.pending, `${input.tool_use_id}.ts`);
    let duration_ms: number | undefined;
    try {
      const startTs = parseInt(await readFile(markerPath, 'utf-8'), 10);
      duration_ms = Date.now() - startTs;
      await unlink(markerPath);
    } catch {
      // Marker missing -- PreToolUse didn't run or was cleaned up
    }

    await appendLogEntry('tools', {
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      event: 'post' as const,
      tool_name: input.tool_name,
      input_summary: summarizeToolInput(input.tool_name, input.tool_input as Record<string, unknown>),
      duration_ms,
      success: true,
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
    await handlePostToolUse(raw);
  } catch {
    // Never block Claude Code
  }
  process.exit(0);
}

main();
