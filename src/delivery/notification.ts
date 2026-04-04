// Notification module for harness-evolve delivery.
// Builds one-line notification messages and manages the notification flag file
// that signals pending recommendations to the UserPromptSubmit hook.

import { existsSync } from 'node:fs';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { paths } from '../storage/dirs.js';

/**
 * Build a one-line notification string referencing /evolve:apply.
 * Output is always under 200 characters (well under 200 tokens).
 */
export function buildNotification(pendingCount: number): string {
  const plural = pendingCount === 1 ? '' : 's';
  return `[harness-evolve] ${pendingCount} new suggestion${plural} found. Run /evolve:apply to review.`;
}

/**
 * Write the notification flag file with the pending recommendation count.
 * The UserPromptSubmit hook reads this flag to decide whether to inject a notification.
 */
export async function writeNotificationFlag(pendingCount: number): Promise<void> {
  await writeFile(paths.notificationFlag, String(pendingCount), 'utf-8');
}

/**
 * Check whether a notification flag file exists.
 */
export async function hasNotificationFlag(): Promise<boolean> {
  return existsSync(paths.notificationFlag);
}

/**
 * Remove the notification flag file.
 * Does not throw when the flag file does not exist.
 */
export async function clearNotificationFlag(): Promise<void> {
  try {
    await unlink(paths.notificationFlag);
  } catch {
    // Flag already cleared or never existed
  }
}

/**
 * Read the pending count from the notification flag file.
 * Returns 0 if the file cannot be read or parsed.
 */
export async function readNotificationFlagCount(): Promise<number> {
  try {
    const content = await readFile(paths.notificationFlag, 'utf-8');
    return parseInt(content.trim(), 10) || 0;
  } catch {
    return 0;
  }
}
