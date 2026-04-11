// SessionStart hook handler: detects and auto-repairs missing or outdated slash commands.
// Invoked by Claude Code when a session begins, resumes, or context is cleared/compacted.
// Reads JSON from stdin, validates, checks slash command health, repairs if needed.

import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { sessionStartInputSchema } from '../schemas/hook-input.js';
import { generateScanCommand, getScanTemplateVersion } from '../commands/evolve-scan.js';
import { generateApplyCommand, getApplyTemplateVersion } from '../commands/evolve-apply.js';
import { readStdin } from './shared.js';

/**
 * Health status of slash command installation.
 */
export interface SlashCommandHealth {
  healthy: boolean;
  missing: string[];
  outdated: string[];
}

/**
 * Result of a repair operation.
 */
export interface RepairResult {
  repaired: boolean;
  details: string[];
}

/**
 * Check the health of installed slash commands and repair if needed.
 * Uses homeOverride for testability (real temp directories in tests).
 * When no override is provided, uses process.env.HOME.
 */
export async function checkAndRepairSlashCommands(homeOverride?: string): Promise<RepairResult> {
  const home = homeOverride ?? process.env.HOME ?? '';
  const dir = join(home, '.claude', 'commands', 'evolve');

  const commands = [
    {
      name: 'scan.md',
      generate: generateScanCommand,
      currentVersion: getScanTemplateVersion(),
      path: join(dir, 'scan.md'),
    },
    {
      name: 'apply.md',
      generate: generateApplyCommand,
      currentVersion: getApplyTemplateVersion(),
      path: join(dir, 'apply.md'),
    },
  ];

  const details: string[] = [];

  for (const cmd of commands) {
    let needsWrite = false;
    let detail = '';

    try {
      await access(cmd.path);
      // File exists -- check version
      const content = await readFile(cmd.path, 'utf-8');
      const match = content.match(/<!-- template-version: (\d+) -->/);
      if (!match || parseInt(match[1], 10) < parseInt(cmd.currentVersion, 10)) {
        needsWrite = true;
        const oldVersion = match ? match[1] : '?';
        detail = `${cmd.name} updated (v${oldVersion} -> v${cmd.currentVersion})`;
      }
    } catch {
      // File does not exist
      needsWrite = true;
      detail = `${cmd.name} installed`;
    }

    if (needsWrite) {
      await mkdir(dir, { recursive: true });
      await writeFile(cmd.path, cmd.generate(), 'utf-8');
      details.push(detail);
    }
  }

  return {
    repaired: details.length > 0,
    details,
  };
}

/**
 * Core handler logic, exported for testability.
 * Validates input, checks slash command health, repairs if needed.
 * Outputs JSON with additionalContext only when repair was performed.
 * Swallows all errors to never block Claude Code.
 */
export async function handleSessionStart(rawJson: string): Promise<void> {
  try {
    const input = sessionStartInputSchema.parse(JSON.parse(rawJson));
    const result = await checkAndRepairSlashCommands();

    if (result.repaired) {
      const output = {
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: `[harness-evolve] Auto-repaired ${result.details.join(', ')}. Slash commands are now up to date.`,
        },
      };
      process.stdout.write(JSON.stringify(output));
    }
    // If not repaired, output nothing (zero latency impact for healthy sessions)
  } catch {
    // Never block Claude Code
  }
}

// Entry point when invoked by Claude Code as a command hook
async function main(): Promise<void> {
  try {
    const raw = await readStdin();
    await handleSessionStart(raw);
  } catch {
    // Never block Claude Code
  }
  process.exit(0);
}

main();
