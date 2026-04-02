// Stop hook handler: triggers analysis when interaction counter reaches threshold.
// Invoked by Claude Code after each response completes.
// Reads JSON from stdin, validates, checks threshold, runs analysis if needed.

import { stopInputSchema } from '../schemas/hook-input.js';
import { checkAndTriggerAnalysis } from '../analysis/trigger.js';
import { readStdin } from './shared.js';

/**
 * Core handler logic, exported for testability.
 * Validates input, guards against infinite loops, triggers analysis.
 * Swallows all errors to never block Claude Code.
 */
export async function handleStop(rawJson: string): Promise<void> {
  try {
    const input = stopInputSchema.parse(JSON.parse(rawJson));

    // Prevent infinite loop: if this hook invocation was triggered
    // by a Stop hook agent, do not re-trigger analysis
    if (input.stop_hook_active) return;

    await checkAndTriggerAnalysis(input.cwd);
  } catch {
    // Never block Claude Code
  }
}

// Entry point when invoked by Claude Code as a command hook
async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    await handleStop(raw);
  } catch {
    // Never block Claude Code
  }
  process.exit(0);
}

main();
