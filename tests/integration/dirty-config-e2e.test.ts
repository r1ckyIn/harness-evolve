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

// ── Scenario 2: Clean config produces zero findings ──────────────────

describe('E2E clean config -- zero findings', () => {
  it('returns no recommendations for a well-structured config', async () => {
    // CLAUDE.md with unique heading, no stale refs, no mechanizable text
    await writeFile(
      join(tempDir, 'CLAUDE.md'),
      ['# My Project', '', 'This project uses React and Node.js.', ''].join('\n'),
    );

    // One rule file with distinct heading and meaningful content
    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'rules', 'code-style.md'),
      ['## Code Style', '', 'Use 2-space indentation for all TypeScript files.', ''].join('\n'),
    );

    // Settings with no hooks (no duplicate risk)
    await writeFile(
      join(tempDir, '.claude', 'settings.json'),
      JSON.stringify({}, null, 2),
    );

    const result = await runDeepScan(tempDir, fakeHome);

    expect(result.recommendations).toHaveLength(0);
    expect(result.scanner_meta).toHaveLength(7);

    // Every scanner ran but found nothing
    for (const meta of result.scanner_meta) {
      expect(meta.finding_count).toBe(0);
    }
  });
});

// ── Scenario 3: Multiple conflict types (enable/disable, require/forbid) ──

describe('E2E multiple conflict opposition pairs', () => {
  it('detects enable/disable and require/forbid conflicts alongside always/never', async () => {
    await writeFile(
      join(tempDir, 'CLAUDE.md'),
      [
        '# Config',
        '',
        'Always use prettier for formatting.',
        'Enable strictMode in all configs.',
        'Require authentication for API endpoints.',
        '',
      ].join('\n'),
    );

    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'rules', 'overrides.md'),
      [
        '## Overrides',
        '',
        'Never use prettier for generated files.',
        'Disable strictMode for legacy modules.',
        'Forbid authentication on public health checks.',
        '',
      ].join('\n'),
    );

    const result = await runDeepScan(tempDir, fakeHome);

    const conflicts = result.recommendations.filter(
      (r) => r.pattern_type === 'scan_rule_conflict',
    );

    // Should detect all 3 opposition pairs
    expect(conflicts.length).toBeGreaterThanOrEqual(3);

    const titles = conflicts.map((c) => c.title.toLowerCase());

    // always/never pair on "prettier"
    expect(titles.some((t) => t.includes('prettier'))).toBe(true);

    // enable/disable pair on "strictmode"
    expect(titles.some((t) => t.includes('strictmode'))).toBe(true);

    // require/forbid pair on "authentication"
    expect(titles.some((t) => t.includes('authentication'))).toBe(true);
  });
});

// ── Scenario 4: Structure scanner edge cases ─────────────────────────

describe('E2E structure scanner edge cases', () => {
  it('detects oversized rules and headingless rules', async () => {
    await writeFile(join(tempDir, 'CLAUDE.md'), '# Project\n');

    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });

    // Oversized rule: 250 lines of content (> 200 line threshold)
    const oversizedLines = Array.from({ length: 250 }, (_, i) => `Rule line ${i + 1}`);
    await writeFile(
      join(tempDir, '.claude', 'rules', 'mega-rules.md'),
      ['## Mega Rules', '', ...oversizedLines, ''].join('\n'),
    );

    // Headingless rule: content but no markdown headings
    await writeFile(
      join(tempDir, '.claude', 'rules', 'no-headings.md'),
      [
        'This rule file has no headings at all.',
        'It just has plain text with no structure.',
        'This should trigger the headingless rule check.',
        '',
      ].join('\n'),
    );

    // Unscoped subdirectory rule: in a subdirectory but no paths frontmatter
    await mkdir(join(tempDir, '.claude', 'rules', '01-workflow'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'rules', '01-workflow', 'dev.md'),
      ['## Dev Workflow', '', 'Follow TDD for all new features.', ''].join('\n'),
    );

    const result = await runDeepScan(tempDir, fakeHome);

    const structureIssues = result.recommendations.filter(
      (r) => r.pattern_type === 'scan_structure_issue',
    );

    // Should find: oversized + headingless + unscoped subdirectory = 3
    expect(structureIssues.length).toBeGreaterThanOrEqual(3);

    const titles = structureIssues.map((s) => s.title.toLowerCase());
    expect(titles.some((t) => t.includes('oversized'))).toBe(true);
    expect(titles.some((t) => t.includes('without headings'))).toBe(true);
    expect(titles.some((t) => t.includes('unscoped'))).toBe(true);
  });
});

// ── Scenario 5: Multiple stale references ────────────────────────────

describe('E2E multiple stale references', () => {
  it('detects multiple broken @references in CLAUDE.md', async () => {
    await writeFile(
      join(tempDir, 'CLAUDE.md'),
      [
        '# Project Config',
        '',
        'Architecture: see @docs/architecture.md',
        'API spec: see @docs/api-spec.md',
        'Testing guide: see @docs/testing-guide.md',
        '',
      ].join('\n'),
    );

    // None of these referenced files exist
    const result = await runDeepScan(tempDir, fakeHome);

    const staleRefs = result.recommendations.filter(
      (r) => r.pattern_type === 'scan_stale_reference',
    );

    // All 3 references are stale
    expect(staleRefs).toHaveLength(3);

    const descriptions = staleRefs.map((r) => r.description);
    expect(descriptions.some((d) => d.includes('architecture.md'))).toBe(true);
    expect(descriptions.some((d) => d.includes('api-spec.md'))).toBe(true);
    expect(descriptions.some((d) => d.includes('testing-guide.md'))).toBe(true);
  });

  it('does not flag @references that exist on disk', async () => {
    await mkdir(join(tempDir, 'docs'), { recursive: true });
    await writeFile(join(tempDir, 'docs', 'real-doc.md'), '# Real\n');

    await writeFile(
      join(tempDir, 'CLAUDE.md'),
      ['# Config', '', 'Details: see @docs/real-doc.md', ''].join('\n'),
    );

    const result = await runDeepScan(tempDir, fakeHome);

    const staleRefs = result.recommendations.filter(
      (r) => r.pattern_type === 'scan_stale_reference',
    );
    expect(staleRefs).toHaveLength(0);
  });
});

// ── Scenario 6: Commands scanner edge cases ──────────────────────────

describe('E2E commands scanner edge cases', () => {
  it('detects missing frontmatter and short content in commands', async () => {
    await writeFile(join(tempDir, 'CLAUDE.md'), '# Project\n');

    await mkdir(join(tempDir, '.claude', 'commands'), { recursive: true });

    // Command with no frontmatter
    await writeFile(
      join(tempDir, '.claude', 'commands', 'no-fm.md'),
      'Run the tests and report results.\n',
    );

    // Command with frontmatter but no description
    await writeFile(
      join(tempDir, '.claude', 'commands', 'no-desc.md'),
      ['---', 'name: no-desc', '---', '', 'Do something.', ''].join('\n'),
    );

    // Command with very short content (< 50 chars after frontmatter)
    await writeFile(
      join(tempDir, '.claude', 'commands', 'tiny.md'),
      ['---', 'name: tiny', 'description: A tiny command', '---', '', 'Run it.', ''].join('\n'),
    );

    const result = await runDeepScan(tempDir, fakeHome);

    const cmdIssues = result.recommendations.filter(
      (r) => r.pattern_type === 'scan_command_convention',
    );

    // no-fm: missing frontmatter
    // no-desc: missing description
    // tiny: very short content
    expect(cmdIssues.length).toBeGreaterThanOrEqual(3);

    const titles = cmdIssues.map((c) => c.title.toLowerCase());
    expect(titles.some((t) => t.includes('missing frontmatter'))).toBe(true);
    expect(titles.some((t) => t.includes('missing description'))).toBe(true);
    expect(titles.some((t) => t.includes('very short'))).toBe(true);
  });
});

// ── Scenario 7: Multiple mechanization indicators ────────────────────

describe('E2E multiple mechanization indicators', () => {
  it('detects multiple hookable patterns when no hooks are registered', async () => {
    await writeFile(
      join(tempDir, 'CLAUDE.md'),
      [
        '# Config',
        '',
        'Always run eslint before saving.',
        'Must always check types before committing.',
        'After every edit, run prettier.',
        '',
      ].join('\n'),
    );

    const result = await runDeepScan(tempDir, fakeHome);

    const mechFindings = result.recommendations.filter(
      (r) => r.pattern_type === 'scan_missing_mechanization',
    );

    // 3 mechanizable patterns: "always run", "must check", "after every edit"
    expect(mechFindings.length).toBeGreaterThanOrEqual(3);
  });

  it('suppresses findings when matching hooks are already registered', async () => {
    await writeFile(
      join(tempDir, 'CLAUDE.md'),
      ['# Config', '', 'Always run lint before saving.', ''].join('\n'),
    );

    // Register a PreToolUse hook -- should suppress the "always run" finding
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'settings.json'),
      JSON.stringify(
        {
          hooks: {
            PreToolUse: [{ type: 'command', command: 'node lint.js' }],
          },
        },
        null,
        2,
      ),
    );

    const result = await runDeepScan(tempDir, fakeHome);

    const mechFindings = result.recommendations.filter(
      (r) => r.pattern_type === 'scan_missing_mechanization',
    );

    // PreToolUse hook registered, so "always run" should be suppressed
    expect(mechFindings).toHaveLength(0);
  });
});

// ── Scenario 8: Duplicate rule files (redundancy check 2) ───────────

describe('E2E duplicate rule files', () => {
  it('detects rule files with identical heading sets', async () => {
    await writeFile(join(tempDir, 'CLAUDE.md'), '# Project\n');

    await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });

    // Two rule files with the exact same heading
    await writeFile(
      join(tempDir, '.claude', 'rules', 'git-a.md'),
      ['## Git Rules', '', 'Use conventional commits.', ''].join('\n'),
    );
    await writeFile(
      join(tempDir, '.claude', 'rules', 'git-b.md'),
      ['## Git Rules', '', 'Always squash merge.', ''].join('\n'),
    );

    const result = await runDeepScan(tempDir, fakeHome);

    const redundancy = result.recommendations.filter(
      (r) => r.pattern_type === 'scan_redundancy',
    );

    // Should detect duplicate heading set across two rule files
    expect(redundancy.some((r) => r.title.toLowerCase().includes('duplicate rule files'))).toBe(
      true,
    );
  });
});

// ── Scenario 9: Hooks without commands ───────────────────────────────

describe('E2E hooks without commands', () => {
  it('detects hook entries with empty or missing command field', async () => {
    await writeFile(join(tempDir, 'CLAUDE.md'), '# Project\n');

    await mkdir(join(tempDir, '.claude'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'settings.json'),
      JSON.stringify(
        {
          hooks: {
            PostToolUse: [
              { type: 'command', command: '' },
              { type: 'command' },
            ],
          },
        },
        null,
        2,
      ),
    );

    const result = await runDeepScan(tempDir, fakeHome);

    const hookIssues = result.recommendations.filter(
      (r) => r.pattern_type === 'scan_hooks_redundancy',
    );

    // At least 1 finding for hooks without commands
    expect(hookIssues.some((r) => r.title.toLowerCase().includes('without command'))).toBe(true);
  });
});

// ── Scenario 10: Severity distribution ───────────────────────────────

describe('E2E severity distribution', () => {
  it('dirty config produces both problems and suggestions', async () => {
    await createDirtyConfig(tempDir);

    const result = await runDeepScan(tempDir, fakeHome);

    const severities = new Set(result.recommendations.map((r) => r.severity));

    // Dirty config has empty rule file (problem) + redundancy (suggestion) + conflict (problem)
    expect(severities.has('problem')).toBe(true);
    expect(severities.has('suggestion')).toBe(true);
  });

  it('all recommendations have valid severity values', async () => {
    await createDirtyConfig(tempDir);

    const result = await runDeepScan(tempDir, fakeHome);

    for (const rec of result.recommendations) {
      expect(['problem', 'suggestion']).toContain(rec.severity);
    }
  });
});
