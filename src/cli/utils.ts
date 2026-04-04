// Shared CLI utilities: hook definitions, settings I/O, path resolution, confirm prompt

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import writeFileAtomic from 'write-file-atomic';

/**
 * Marker string used to identify harness-evolve hook entries in settings.json.
 * When scanning existing hooks, any command containing this string is ours.
 */
export const HARNESS_EVOLVE_MARKER = 'harness-evolve';

/**
 * Default path to Claude Code user-scope settings.json.
 */
export const SETTINGS_PATH = join(
  process.env.HOME ?? '',
  '.claude',
  'settings.json',
);

/**
 * Hook registration definition.
 */
export interface HookRegistration {
  event: string;
  hookFile: string;
  timeout: number;
  async: boolean;
  description: string;
}

/**
 * All 6 hook events that harness-evolve registers.
 * Each entry maps an event name to the compiled JS hook file.
 */
export const HOOK_REGISTRATIONS: HookRegistration[] = [
  {
    event: 'UserPromptSubmit',
    hookFile: 'user-prompt-submit.js',
    timeout: 10,
    async: false,
    description: 'Captures prompts and delivers optimization notifications',
  },
  {
    event: 'PreToolUse',
    hookFile: 'pre-tool-use.js',
    timeout: 10,
    async: true,
    description: 'Tracks tool usage patterns before execution',
  },
  {
    event: 'PostToolUse',
    hookFile: 'post-tool-use.js',
    timeout: 10,
    async: true,
    description: 'Records tool outcomes for pattern analysis',
  },
  {
    event: 'PostToolUseFailure',
    hookFile: 'post-tool-use-failure.js',
    timeout: 10,
    async: true,
    description: 'Logs tool failures to detect correction patterns',
  },
  {
    event: 'PermissionRequest',
    hookFile: 'permission-request.js',
    timeout: 10,
    async: true,
    description: 'Monitors permission decisions for auto-approval suggestions',
  },
  {
    event: 'Stop',
    hookFile: 'stop.js',
    timeout: 10,
    async: true,
    description: 'Triggers analysis when interaction threshold is reached',
  },
];

/**
 * Resolve absolute path to a hook JS file.
 *
 * In production, import.meta.dirname of the compiled dist/cli/utils.js
 * points to <install>/dist/cli/. We go up one level to <install>/dist/,
 * then into hooks/<hookFile>.
 *
 * @param hookFile - The hook filename (e.g., 'user-prompt-submit.js')
 * @param baseDirOverride - Override for import.meta.dirname (for testing)
 */
export function resolveHookPath(
  hookFile: string,
  baseDirOverride?: string,
): string {
  const baseDir = baseDirOverride ?? import.meta.dirname;
  return join(baseDir, 'hooks', hookFile);
}

/**
 * Read and parse Claude Code settings.json.
 * Returns empty object if file does not exist or JSON is invalid.
 */
export async function readSettings(
  settingsPath?: string,
): Promise<Record<string, unknown>> {
  const filePath = settingsPath ?? SETTINGS_PATH;
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // ENOENT (file missing) or SyntaxError (invalid JSON)
    return {};
  }
}

/**
 * Write settings.json atomically with 2-space indentation.
 */
export async function writeSettings(
  settings: Record<string, unknown>,
  settingsPath?: string,
): Promise<void> {
  const filePath = settingsPath ?? SETTINGS_PATH;
  await writeFileAtomic(filePath, JSON.stringify(settings, null, 2));
}

/**
 * Hook command entry for merge logic.
 */
interface HookCommand {
  event: string;
  command: string;
  timeout: number;
  async: boolean;
}

/**
 * Merge harness-evolve hooks into existing settings without destroying user hooks.
 *
 * For each hook command:
 * - If the event already has a harness-evolve entry (identified by HARNESS_EVOLVE_MARKER
 *   in the command string), skip it.
 * - Otherwise, append a new matcher entry to the event array.
 *
 * User hooks are preserved untouched.
 */
export function mergeHooks(
  existing: Record<string, unknown>,
  hookCommands: HookCommand[],
): Record<string, unknown> {
  const hooks = (
    existing.hooks != null ? { ...(existing.hooks as Record<string, unknown>) } : {}
  ) as Record<string, unknown[]>;

  for (const hc of hookCommands) {
    const eventArray = (
      Array.isArray(hooks[hc.event]) ? [...hooks[hc.event]] : []
    ) as Array<Record<string, unknown>>;

    // Check if harness-evolve hook already registered for this event
    const alreadyRegistered = eventArray.some((entry) => {
      const innerHooks = entry.hooks as
        | Array<Record<string, unknown>>
        | undefined;
      if (!Array.isArray(innerHooks)) return false;
      return innerHooks.some((h) =>
        String(h.command ?? '').includes(HARNESS_EVOLVE_MARKER),
      );
    });

    if (!alreadyRegistered) {
      const hookEntry: Record<string, unknown> = {
        type: 'command',
        command: hc.command,
        timeout: hc.timeout,
      };
      if (hc.async) {
        hookEntry.async = true;
      }

      eventArray.push({
        matcher: '*',
        hooks: [hookEntry],
      });
    }

    hooks[hc.event] = eventArray;
  }

  return { ...existing, hooks };
}

/**
 * Interactive confirmation prompt.
 * Returns true if user answers 'y' or 'yes' (case-insensitive).
 */
export async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(`${message} [y/N] `);
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}
