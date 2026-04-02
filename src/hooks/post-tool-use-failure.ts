// PostToolUseFailure hook handler: captures tool execution failure events.
// Cleans up any PreToolUse marker file and logs a failure entry.

import { unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { postToolUseFailureInputSchema } from '../schemas/hook-input.js';
import { appendLogEntry } from '../storage/logger.js';
import { incrementCounter } from '../storage/counter.js';
import { loadConfig } from '../storage/config.js';
import { paths } from '../storage/dirs.js';
import { readStdin, summarizeToolInput } from './shared.js';

/**
 * Core handler logic, exported for testability.
 * Validates input, cleans up marker file, logs 'failure' tool entry
 * with success=false, increments counter.
 * Swallows all errors to never block Claude Code.
 */
export async function handlePostToolUseFailure(rawJson: string): Promise<void> {
  try {
    const config = await loadConfig();
    if (!config.hooks.captureTools) return;

    const input = postToolUseFailureInputSchema.parse(JSON.parse(rawJson));

    // Clean up marker file if it exists
    const markerPath = join(paths.pending, `${input.tool_use_id}.ts`);
    try {
      await unlink(markerPath);
    } catch {
      // Marker may not exist -- that's fine
    }

    await appendLogEntry('tools', {
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      event: 'failure' as const,
      tool_name: input.tool_name,
      input_summary: summarizeToolInput(input.tool_name, input.tool_input as Record<string, unknown>),
      success: false,
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
    await handlePostToolUseFailure(raw);
  } catch {
    // Never block Claude Code
  }
  process.exit(0);
}

main();
