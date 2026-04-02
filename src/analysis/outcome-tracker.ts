// Outcome tracker: cross-references applied recommendations against
// the current environment snapshot to determine whether changes persist.
// Persists outcomes as JSONL and computes pattern-level summaries for
// confidence adjustment in subsequent analysis runs.

import { readFile, appendFile } from 'node:fs/promises';
import { paths } from '../storage/dirs.js';
import { loadState } from '../delivery/state.js';
import {
  outcomeEntrySchema,
  type OutcomeEntry,
  type OutcomeSummary,
} from '../schemas/onboarding.js';
import type { RecommendationStateEntry } from '../schemas/delivery.js';
import type { EnvironmentSnapshot } from './schemas.js';

/**
 * Track outcomes for all applied recommendations by checking their
 * persistence in the current environment snapshot.
 *
 * For each applied recommendation:
 * 1. Check if the change still exists in the environment
 * 2. Determine outcome: positive (persisted 5+ checks), negative (reverted),
 *    or monitoring (persisted but < 5 checks)
 * 3. Append outcome entry to JSONL history
 *
 * @param snapshot - Current environment snapshot
 * @returns Array of outcome entries for all applied recommendations
 */
export async function trackOutcomes(
  snapshot: EnvironmentSnapshot,
): Promise<OutcomeEntry[]> {
  const state = await loadState();
  const applied = state.entries.filter((e) => e.status === 'applied');

  if (applied.length === 0) return [];

  const history = await loadOutcomeHistory();
  const results: OutcomeEntry[] = [];

  for (const entry of applied) {
    // Find most recent outcome for this recommendation
    const priorEntries = history.filter(
      (h) => h.recommendation_id === entry.id,
    );
    const latest = priorEntries.length > 0
      ? priorEntries[priorEntries.length - 1]
      : undefined;

    const checksCount = latest
      ? latest.checks_since_applied + 1
      : 1;

    const persisted = checkPersistence(entry, snapshot);

    // Determine outcome
    let outcome: 'positive' | 'negative' | 'monitoring';
    if (!persisted) {
      outcome = 'negative';
    } else if (checksCount >= 5) {
      outcome = 'positive';
    } else {
      outcome = 'monitoring';
    }

    // Infer pattern_type from the recommendation ID prefix
    const patternType = inferPatternType(entry.id);

    // Infer target from the recommendation ID prefix
    const target = inferTarget(entry.id);

    const outcomeEntry: OutcomeEntry = {
      recommendation_id: entry.id,
      pattern_type: patternType,
      target,
      applied_at: entry.updated_at,
      checked_at: new Date().toISOString(),
      persisted,
      checks_since_applied: checksCount,
      outcome,
    };

    results.push(outcomeEntry);
    await appendOutcome(outcomeEntry);
  }

  return results;
}

/**
 * Check whether an applied recommendation's change still persists
 * in the current environment.
 *
 * Detection heuristics by recommendation type:
 * - SETTINGS (allowedTools): check if tool exists in snapshot settings
 * - HOOK (rec-repeated-*): check if hooks exist in snapshot
 * - SKILL (rec-long-*): check if skills exist in snapshot
 * - RULE (rec-correction-*): check if rules exist in snapshot
 * - Default: assume persisted when persistence cannot be verified
 */
function checkPersistence(
  entry: RecommendationStateEntry,
  snapshot: EnvironmentSnapshot,
): boolean {
  // SETTINGS persistence: check allowedTools
  if (entry.applied_details) {
    const toolMatch = entry.applied_details.match(/Added (\w+) to allowedTools/);
    if (toolMatch) {
      const toolName = toolMatch[1];
      const userSettings = snapshot.settings.user as Record<string, unknown> | null;
      if (!userSettings) return false;
      const allowedTools = userSettings.allowedTools;
      if (!Array.isArray(allowedTools)) return false;
      return allowedTools.includes(toolName);
    }
  }

  // HOOK persistence: rec-repeated-* prefix
  if (entry.id.startsWith('rec-repeated-')) {
    return snapshot.installed_tools.hooks.length > 0;
  }

  // SKILL persistence: rec-long-* prefix
  if (entry.id.startsWith('rec-long-')) {
    return snapshot.installed_tools.skills.length > 0;
  }

  // RULE persistence: rec-correction-* prefix
  if (entry.id.startsWith('rec-correction-')) {
    return snapshot.installed_tools.rules.length > 0;
  }

  // Default: assume persisted when we cannot verify
  return true;
}

/**
 * Append an outcome entry to the JSONL history file.
 */
async function appendOutcome(entry: OutcomeEntry): Promise<void> {
  await appendFile(
    paths.outcomeHistory,
    JSON.stringify(entry) + '\n',
    'utf-8',
  );
}

/**
 * Load outcome history from the JSONL file.
 * Returns empty array when the file does not exist.
 * Silently skips invalid or malformed lines.
 */
export async function loadOutcomeHistory(): Promise<OutcomeEntry[]> {
  let raw: string;
  try {
    raw = await readFile(paths.outcomeHistory, 'utf-8');
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }

  const entries: OutcomeEntry[] = [];
  const lines = raw.split('\n').filter((line) => line.trim().length > 0);

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const result = outcomeEntrySchema.safeParse(parsed);
      if (result.success) {
        entries.push(result.data);
      }
    } catch {
      // Skip malformed JSON lines silently
    }
  }

  return entries;
}

/**
 * Compute outcome summaries grouped by pattern_type.
 * For each group: counts unique recommendation_ids, tallies positive
 * (persisted) and negative (reverted) outcomes, and computes
 * persistence_rate = persisted / total_applied.
 *
 * Uses the latest outcome per recommendation_id for determination.
 */
export function computeOutcomeSummaries(
  history: OutcomeEntry[],
): OutcomeSummary[] {
  if (history.length === 0) return [];

  // Group by pattern_type
  const groups = new Map<string, OutcomeEntry[]>();
  for (const entry of history) {
    const group = groups.get(entry.pattern_type) ?? [];
    group.push(entry);
    groups.set(entry.pattern_type, group);
  }

  const summaries: OutcomeSummary[] = [];

  for (const [patternType, entries] of groups) {
    // Get the latest entry per recommendation_id
    const latestByRec = new Map<string, OutcomeEntry>();
    for (const entry of entries) {
      latestByRec.set(entry.recommendation_id, entry);
    }

    let totalPersisted = 0;
    let totalReverted = 0;

    for (const entry of latestByRec.values()) {
      if (entry.outcome === 'positive') {
        totalPersisted++;
      } else if (entry.outcome === 'negative') {
        totalReverted++;
      }
      // 'monitoring' entries don't count toward either
    }

    const totalApplied = latestByRec.size;
    const persistenceRate = totalApplied > 0
      ? totalPersisted / totalApplied
      : 0;

    summaries.push({
      pattern_type: patternType,
      total_applied: totalApplied,
      total_persisted: totalPersisted,
      total_reverted: totalReverted,
      persistence_rate: persistenceRate,
    });
  }

  return summaries;
}

/**
 * Infer the pattern type from a recommendation ID prefix.
 */
function inferPatternType(id: string): string {
  if (id.startsWith('rec-repeated-')) return 'repeated-prompt';
  if (id.startsWith('rec-long-')) return 'long-prompt-workflow';
  if (id.startsWith('rec-permission-always-approved-')) return 'permission-always-approved';
  if (id.startsWith('rec-correction-')) return 'code-correction-pattern';
  if (id.startsWith('rec-ecosystem-')) return 'ecosystem-adapter';
  if (id.startsWith('rec-tool-preference-')) return 'tool-preference';
  if (id.startsWith('rec-onboarding-')) return 'onboarding';
  return 'unknown';
}

/**
 * Infer the routing target from a recommendation ID prefix.
 */
function inferTarget(id: string): string {
  if (id.startsWith('rec-repeated-')) return 'HOOK';
  if (id.startsWith('rec-long-')) return 'SKILL';
  if (id.startsWith('rec-permission-always-approved-')) return 'SETTINGS';
  if (id.startsWith('rec-correction-')) return 'RULE';
  if (id.startsWith('rec-ecosystem-')) return 'CLAUDE_MD';
  if (id.startsWith('rec-tool-preference-')) return 'SETTINGS';
  if (id.startsWith('rec-onboarding-')) return 'HOOK';
  return 'MEMORY';
}

// Type guard for Node.js errors with code property
function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
