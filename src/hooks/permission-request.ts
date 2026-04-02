// PermissionRequest hook handler: captures permission request events.
// Invoked by Claude Code before user sees the permission dialog.
// Decision is always 'unknown' because the hook fires BEFORE user decides.

import { permissionRequestInputSchema } from '../schemas/hook-input.js';
import { appendLogEntry } from '../storage/logger.js';
import { incrementCounter } from '../storage/counter.js';
import { loadConfig } from '../storage/config.js';
import { readStdin } from './shared.js';

/**
 * Core handler logic, exported for testability.
 * Validates input, appends permission log entry with decision='unknown',
 * increments counter. Swallows all errors to never block Claude Code.
 */
export async function handlePermissionRequest(rawJson: string): Promise<void> {
  try {
    const config = await loadConfig();
    if (!config.hooks.capturePermissions) return;

    const input = permissionRequestInputSchema.parse(JSON.parse(rawJson));

    await appendLogEntry('permissions', {
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      tool_name: input.tool_name,
      decision: 'unknown' as const, // PermissionRequest fires BEFORE user decides
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
    await handlePermissionRequest(raw);
  } catch {
    // Never block Claude Code
  }
  process.exit(0);
}

main();
