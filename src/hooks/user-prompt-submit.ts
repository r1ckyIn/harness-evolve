// UserPromptSubmit hook handler: captures user prompts with metadata.
// Invoked by Claude Code when user submits a prompt.
// Reads JSON from stdin, validates, logs entry, increments counter.

import { userPromptSubmitInputSchema } from '../schemas/hook-input.js';
import { appendLogEntry } from '../storage/logger.js';
import { incrementCounter } from '../storage/counter.js';
import { loadConfig } from '../storage/config.js';
import { readStdin } from './shared.js';
import {
  hasNotificationFlag,
  buildNotification,
  clearNotificationFlag,
  readNotificationFlagCount,
} from '../delivery/notification.js';
/**
 * Core handler logic, exported for testability.
 * Validates input, appends prompt log entry, increments counter.
 * Swallows all errors to never block Claude Code.
 */
export async function handleUserPromptSubmit(rawJson: string): Promise<void> {
  try {
    const config = await loadConfig();
    if (!config.hooks.capturePrompts) return;

    const input = userPromptSubmitInputSchema.parse(JSON.parse(rawJson));

    await appendLogEntry('prompts', {
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      cwd: input.cwd,
      prompt: input.prompt,
      prompt_length: input.prompt.length,
      transcript_path: input.transcript_path,
    });

    await incrementCounter(input.session_id);

    // Notification injection (DEL-02, DEL-03, DEL-04)
    try {
      if (config.delivery.stdoutInjection && await hasNotificationFlag()) {
        const pendingCount = await readNotificationFlagCount();
        if (pendingCount > 0) {
          const msg = buildNotification(pendingCount);
          process.stdout.write(msg + '\n');
          await clearNotificationFlag();
        }
      }
    } catch {
      // Never block Claude Code on notification errors
    }
  } catch {
    // Never block Claude Code on capture errors
  }
}

// Entry point when invoked by Claude Code as a command hook
async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    await handleUserPromptSubmit(raw);
  } catch {
    // Never block Claude Code
  }
  process.exit(0);
}

main();
