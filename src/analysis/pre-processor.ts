// Pre-processing pipeline: reads accumulated JSONL logs, computes frequency
// counts with cross-session tracking, extracts top-N patterns, and writes
// a compact summary.json under 50KB for the analysis agent's context window.

import { readLogEntries } from './jsonl-reader.js';
import { summarySchema, type Summary } from './schemas.js';
import {
  promptEntrySchema,
  toolEntrySchema,
  permissionEntrySchema,
} from '../schemas/log-entry.js';
import type { PromptEntry, ToolEntry } from '../schemas/log-entry.js';
import { paths, ensureInit } from '../storage/dirs.js';
import writeFileAtomic from 'write-file-atomic';

const PROMPT_TRUNCATE_LEN = 100;
const LONG_PROMPT_THRESHOLD = 200; // word count
const DEFAULT_TOP_N = 20;
const DEFAULT_DAYS = 30;
const MAX_LONG_PROMPTS = 10;

/**
 * Normalize a prompt string for deduplication:
 * trim, lowercase, collapse all whitespace to a single space.
 */
function normalizePrompt(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Format a Date as YYYY-MM-DD.
 */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Count items with cross-session tracking.
 * Returns a Map keyed by the normalized identifier with count and unique sessions.
 */
function countWithSessions(
  items: Array<{ key: string; session: string }>,
): Map<string, { count: number; sessions: Set<string> }> {
  const map = new Map<string, { count: number; sessions: Set<string> }>();
  for (const { key, session } of items) {
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.sessions.add(session);
    } else {
      map.set(key, { count: 1, sessions: new Set([session]) });
    }
  }
  return map;
}

/**
 * Compute tool frequency with average duration from 'post' events.
 */
function computeToolFrequency(
  tools: ToolEntry[],
): Summary['tool_frequency'] {
  const map = new Map<string, { count: number; durations: number[] }>();
  for (const entry of tools) {
    const existing = map.get(entry.tool_name);
    if (existing) {
      existing.count += 1;
      if (entry.event === 'post' && entry.duration_ms != null) {
        existing.durations.push(entry.duration_ms);
      }
    } else {
      const durations: number[] = [];
      if (entry.event === 'post' && entry.duration_ms != null) {
        durations.push(entry.duration_ms);
      }
      map.set(entry.tool_name, { count: 1, durations });
    }
  }

  return Array.from(map.entries())
    .map(([tool_name, { count, durations }]) => ({
      tool_name,
      count,
      avg_duration_ms:
        durations.length > 0
          ? Math.round(
              durations.reduce((sum, d) => sum + d, 0) / durations.length,
            )
          : undefined,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Detect long prompts (over LONG_PROMPT_THRESHOLD words).
 * Groups by normalized text, counts occurrences, returns top MAX_LONG_PROMPTS.
 */
function detectLongPrompts(prompts: PromptEntry[]): Summary['long_prompts'] {
  const map = new Map<string, { length: number; count: number }>();
  for (const entry of prompts) {
    const words = entry.prompt.trim().split(/\s+/);
    if (words.length <= LONG_PROMPT_THRESHOLD) continue;
    const key = normalizePrompt(entry.prompt);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { length: words.length, count: 1 });
    }
  }

  return Array.from(map.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, MAX_LONG_PROMPTS)
    .map(([normalized, { length, count }]) => ({
      prompt_preview: normalized.slice(0, PROMPT_TRUNCATE_LEN),
      length,
      count,
    }));
}

/**
 * Pre-process accumulated JSONL logs and produce a compact summary.
 *
 * Reads prompt, tool, and permission logs within the specified date range,
 * computes frequency counts with cross-session aggregation, and writes
 * the result atomically to paths.summary.
 *
 * @param options.since - Start of date range (defaults to 30 days ago)
 * @param options.until - End of date range (defaults to now)
 * @param options.topN  - Max entries in top_repeated_prompts (defaults to 20)
 * @returns The validated Summary object
 */
export async function preProcess(options?: {
  since?: Date;
  until?: Date;
  topN?: number;
}): Promise<Summary> {
  const until = options?.until ?? new Date();
  const since =
    options?.since ?? new Date(until.getTime() - DEFAULT_DAYS * 86_400_000);
  const topN = options?.topN ?? DEFAULT_TOP_N;

  // Read all log entries within the date range
  const [prompts, tools, permissions] = await Promise.all([
    readLogEntries(paths.logs.prompts, promptEntrySchema, { since, until }),
    readLogEntries(paths.logs.tools, toolEntrySchema, { since, until }),
    readLogEntries(paths.logs.permissions, permissionEntrySchema, {
      since,
      until,
    }),
  ]);

  // Unique sessions across all entry types
  const sessionSet = new Set<string>();
  for (const p of prompts) sessionSet.add(p.session_id);
  for (const t of tools) sessionSet.add(t.session_id);
  for (const perm of permissions) sessionSet.add(perm.session_id);

  // Prompt frequency with cross-session tracking
  const promptCounts = countWithSessions(
    prompts.map((p) => ({
      key: normalizePrompt(p.prompt),
      session: p.session_id,
    })),
  );

  const topRepeatedPrompts = Array.from(promptCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, topN)
    .map(([key, { count, sessions }]) => ({
      prompt: key.slice(0, PROMPT_TRUNCATE_LEN),
      count,
      sessions: sessions.size,
    }));

  // Tool frequency with average duration
  const toolFrequency = computeToolFrequency(tools);

  // Permission patterns with cross-session tracking
  const permissionCounts = countWithSessions(
    permissions.map((p) => ({
      key: p.tool_name,
      session: p.session_id,
    })),
  );

  const permissionPatterns = Array.from(permissionCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([tool_name, { count, sessions }]) => ({
      tool_name,
      count,
      sessions: sessions.size,
    }));

  // Long prompt detection
  const longPrompts = detectLongPrompts(prompts);

  // Construct and validate summary
  const summary: Summary = summarySchema.parse({
    generated_at: new Date().toISOString(),
    period: {
      since: formatDate(since),
      until: formatDate(until),
      days: DEFAULT_DAYS,
    },
    stats: {
      total_prompts: prompts.length,
      total_tool_uses: tools.length,
      total_permissions: permissions.length,
      unique_sessions: sessionSet.size,
    },
    top_repeated_prompts: topRepeatedPrompts,
    tool_frequency: toolFrequency,
    permission_patterns: permissionPatterns,
    long_prompts: longPrompts,
  });

  // Write atomically to disk
  await ensureInit();
  await writeFileAtomic(paths.summary, JSON.stringify(summary));

  return summary;
}
