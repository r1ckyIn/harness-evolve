// E2E integration test: dirty config covering all 7 scanner types.
// Constructs intentionally broken Claude Code configuration and verifies
// that runDeepScan detects issues from ALL 7 scanner types in a single pass.
// Uses temporary directories with real file I/O -- no mocks.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { runDeepScan } from '../../src/scan/index.js';
import { recommendationSchema } from '../../src/schemas/recommendation.js';

let baseDir: string;
let tempDir: string;
let fakeHome: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), 'dirty-config-e2e-'));
  tempDir = join(baseDir, 'project');
  fakeHome = join(baseDir, 'home');
  await mkdir(tempDir, { recursive: true });
  await mkdir(join(fakeHome, '.claude'), { recursive: true });
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true }).catch(() => {});
});

/**
 * Create an intentionally broken Claude Code configuration that triggers
 * all 7 scanners in a single pass.
 *
 * Trigger map:
 *   1. redundancy    -- "## Git Rules" heading in CLAUDE.md AND in rule file
 *   2. mechanization -- "Before committing, run lint" in CLAUDE.md (no PreToolUse hook)
 *   3. staleness     -- "@docs/missing-file.md" reference to non-existent file
 *   4. conflict      -- "Always use TypeScript" in CLAUDE.md vs "Never use TypeScript" in rule
 *   5. structure     -- empty rule file at .claude/rules/empty.md
 *   6. hooks-redundancy -- duplicate Stop hook entries in settings.json
 *   7. commands      -- empty command file at .claude/commands/broken.md
 */
async function createDirtyConfig(projectDir: string): Promise<void> {
  // 1. CLAUDE.md -- triggers redundancy + staleness + mechanization + conflict
  await writeFile(
    join(projectDir, 'CLAUDE.md'),
    [
      '# Project Config',
      '',
      '## Git Rules',
      '',
      'Always use TypeScript for all code.',
      'See @docs/missing-file.md for details.',
      'Before committing, run lint',
      '',
    ].join('\n'),
  );

  // 2. Rule file with matching heading (redundancy) + opposing directive (conflict)
  await mkdir(join(projectDir, '.claude', 'rules'), { recursive: true });
  await writeFile(
    join(projectDir, '.claude', 'rules', 'git-rules.md'),
    ['## Git Rules', '', 'Never use TypeScript for scripts.', ''].join('\n'),
  );

  // 3. Empty rule file (structure scanner)
  await writeFile(join(projectDir, '.claude', 'rules', 'empty.md'), '');

  // 4. Settings with duplicate hooks (hooks-redundancy scanner)
  //    Using Stop event so it does NOT suppress mechanization scanner
  //    (mechanization checks for PreToolUse hooks)
  await writeFile(
    join(projectDir, '.claude', 'settings.json'),
    JSON.stringify(
      {
        hooks: {
          Stop: [
            { type: 'command', command: 'node analyze.js' },
            { type: 'command', command: 'node analyze.js' },
          ],
        },
      },
      null,
      2,
    ),
  );

  // 5. Empty command file (commands scanner)
  await mkdir(join(projectDir, '.claude', 'commands'), { recursive: true });
  await writeFile(join(projectDir, '.claude', 'commands', 'broken.md'), '');
}

describe('E2E dirty config -- all 7 scanners detect issues', () => {
  it('detects issues from all 7 scanner types in one pass', async () => {
    await createDirtyConfig(tempDir);

    const result = await runDeepScan(tempDir, fakeHome);

    // Collect all unique pattern_types from recommendations
    const patternTypes = new Set(
      result.recommendations.map((r) => r.pattern_type),
    );

    // Must have findings from all 7 scanners
    expect(patternTypes.has('scan_redundancy')).toBe(true);
    expect(patternTypes.has('scan_missing_mechanization')).toBe(true);
    expect(patternTypes.has('scan_stale_reference')).toBe(true);
    expect(patternTypes.has('scan_rule_conflict')).toBe(true);
    expect(patternTypes.has('scan_structure_issue')).toBe(true);
    expect(patternTypes.has('scan_hooks_redundancy')).toBe(true);
    expect(patternTypes.has('scan_command_convention')).toBe(true);

    // Exactly 7 unique pattern types
    expect(patternTypes.size).toBe(7);
  });

  it('all recommendations pass schema validation', async () => {
    await createDirtyConfig(tempDir);

    const result = await runDeepScan(tempDir, fakeHome);

    // Every recommendation must conform to the Zod schema
    for (const rec of result.recommendations) {
      expect(() => recommendationSchema.parse(rec)).not.toThrow();
    }

    // Sanity: should have at least 7 recommendations (one per scanner minimum)
    expect(result.recommendations.length).toBeGreaterThanOrEqual(7);
  });

  it('scanner_meta reports all 7 scanners with findings', async () => {
    await createDirtyConfig(tempDir);

    const result = await runDeepScan(tempDir, fakeHome);

    // Plan 01 adds scanner_meta to ScanResult -- 7 entries, one per scanner
    expect(result.scanner_meta).toHaveLength(7);

    // Every scanner should have found at least one issue in the dirty config
    for (const meta of result.scanner_meta) {
      expect(meta.finding_count).toBeGreaterThan(0);
    }

    // Verify scanner names match the registered scanner names
    const metaNames = result.scanner_meta.map((m) => m.name);
    expect(metaNames).toEqual([
      'redundancy',
      'mechanization',
      'staleness',
      'conflicts',
      'structure',
      'hooks',
      'commands',
    ]);
  });
});
