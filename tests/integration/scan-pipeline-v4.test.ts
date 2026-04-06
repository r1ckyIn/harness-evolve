// v4.0 scan pipeline validation: replacement integration tests that verify
// the deterministic portions of the scan pipeline (scan-context schema
// validation, pattern_type enum integrity, generator compatibility with
// scan_* pattern types). Replaces the capability assurance of the old
// dirty-config-e2e.test.ts without testing model output (non-deterministic).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { buildScanContext } from '../../src/scan/context-builder.js';
import { scanContextSchema } from '../../src/scan/schemas.js';
import { patternTypeSchema } from '../../src/schemas/recommendation.js';
import { generateHook } from '../../src/generators/hook-generator.js';
import { generateClaudeMdPatch } from '../../src/generators/claude-md-generator.js';
import type { Recommendation } from '../../src/schemas/recommendation.js';

let baseDir: string;
let tempDir: string;
let fakeHome: string;

beforeEach(async () => {
  baseDir = await mkdtemp(join(tmpdir(), 'scan-pipeline-v4-'));
  tempDir = join(baseDir, 'project');
  fakeHome = join(baseDir, 'home');
  await mkdir(tempDir, { recursive: true });
  await mkdir(join(fakeHome, '.claude'), { recursive: true });
});

afterEach(async () => {
  await rm(baseDir, { recursive: true, force: true }).catch(() => {});
});

/**
 * Helper: create a mock Recommendation with the given pattern_type and target.
 */
function mockRecommendation(
  overrides: Partial<Recommendation> & Pick<Recommendation, 'pattern_type' | 'target'>,
): Recommendation {
  return {
    id: `rec-test-${Date.now()}`,
    confidence: 'HIGH',
    title: 'Test recommendation',
    description: 'Test description for a recommendation',
    evidence: { count: 1, examples: ['example'] },
    suggested_action: 'Create a PreToolUse hook to enforce this rule',
    severity: 'suggestion',
    ...overrides,
  };
}

describe('v4.0 scan pipeline validation', () => {
  describe('scan-context schema validation', () => {
    it('buildScanContext produces schema-valid output with all config sections', async () => {
      // Create CLAUDE.md
      await writeFile(
        join(tempDir, 'CLAUDE.md'),
        ['# My Project', '', 'This is a test project for v4.0 pipeline validation.', ''].join(
          '\n',
        ),
      );

      // Create .claude/rules/test-rule.md
      await mkdir(join(tempDir, '.claude', 'rules'), { recursive: true });
      await writeFile(
        join(tempDir, '.claude', 'rules', 'test-rule.md'),
        ['## Test Rule', '', 'Use consistent formatting.', ''].join('\n'),
      );

      // Create .claude/settings.json with flat-format hooks
      await writeFile(
        join(tempDir, '.claude', 'settings.json'),
        JSON.stringify(
          {
            hooks: {
              PreToolUse: [{ type: 'command', command: 'echo flat-hook' }],
            },
          },
          null,
          2,
        ),
      );

      // Create .claude/commands/test-cmd.md
      await mkdir(join(tempDir, '.claude', 'commands'), { recursive: true });
      await writeFile(
        join(tempDir, '.claude', 'commands', 'test-cmd.md'),
        ['---', 'description: A test command', '---', '', 'Run the test suite.', ''].join('\n'),
      );

      const ctx = await buildScanContext(tempDir, fakeHome);

      // Must pass schema validation without throwing
      const parsed = scanContextSchema.parse(ctx);
      expect(parsed).toBeDefined();
      expect(parsed.project_root).toBe(tempDir);

      // Verify all sections are populated
      expect(parsed.claude_md_files.length).toBeGreaterThanOrEqual(1);
      expect(parsed.rules.length).toBeGreaterThanOrEqual(1);
      expect(parsed.commands.length).toBeGreaterThanOrEqual(1);
      expect(parsed.hooks_registered.length).toBeGreaterThanOrEqual(1);
      expect(parsed.generated_at).toBeDefined();
    });

    it('buildScanContext handles nested hooks format (INFRA-01 fix)', async () => {
      await writeFile(join(tempDir, 'CLAUDE.md'), '# Project\n');

      // Create settings.json with nested-format hooks:
      // { matcher: "Bash", hooks: [{ type: "command", command: "echo test" }] }
      await mkdir(join(tempDir, '.claude'), { recursive: true });
      await writeFile(
        join(tempDir, '.claude', 'settings.json'),
        JSON.stringify(
          {
            hooks: {
              PreToolUse: [
                {
                  matcher: 'Bash',
                  hooks: [{ type: 'command', command: 'echo nested-hook' }],
                },
              ],
            },
          },
          null,
          2,
        ),
      );

      const ctx = await buildScanContext(tempDir, fakeHome);

      // The scan context should still parse successfully with nested format
      const parsed = scanContextSchema.parse(ctx);
      expect(parsed).toBeDefined();

      // hooks_registered should have at least one entry from the nested format.
      // Current behavior: the outer object {matcher, hooks} is treated as a
      // hook entry (with type defaulting to 'command'). The INFRA-01 fix in
      // Phase 21 will properly extract inner hooks. Either way, entries exist.
      expect(parsed.hooks_registered.length).toBeGreaterThanOrEqual(1);
      expect(parsed.hooks_registered[0].event).toBe('PreToolUse');
    });
  });

  describe('pattern_type enum integrity', () => {
    it('patternTypeSchema retains all 7 scan_* values for model compatibility', () => {
      const expectedScanTypes = [
        'scan_redundancy',
        'scan_missing_mechanization',
        'scan_stale_reference',
        'scan_rule_conflict',
        'scan_structure_issue',
        'scan_hooks_redundancy',
        'scan_command_convention',
      ];

      // Access the enum options from Zod v4
      const options = patternTypeSchema.options;

      for (const scanType of expectedScanTypes) {
        expect(options).toContain(scanType);
      }

      // Verify all 7 are present (not fewer)
      const actualScanTypes = options.filter((o: string) => o.startsWith('scan_'));
      expect(actualScanTypes).toHaveLength(7);
    });
  });

  describe('generator compatibility with scan_* pattern types', () => {
    it('generateHook produces valid output for scan_missing_mechanization', () => {
      const rec = mockRecommendation({
        pattern_type: 'scan_missing_mechanization',
        target: 'HOOK',
        title: 'Mechanizable rule: "always run eslint"',
        description: 'Found a rule suitable for a PreToolUse hook: "always run eslint".',
        suggested_action: 'Create a PreToolUse hook to enforce eslint automatically.',
      });

      const artifact = generateHook(rec);

      expect(artifact).not.toBeNull();
      expect(artifact!.type).toBe('hook');
      expect(artifact!.content).toBeTruthy();
      expect(artifact!.content.length).toBeGreaterThan(0);
      expect(artifact!.filename).toContain('.sh');
      expect(artifact!.source_recommendation_id).toBe(rec.id);
      expect(artifact!.metadata.pattern_type).toBe('scan_missing_mechanization');
    });

    it('generateClaudeMdPatch produces valid output for scan_stale_reference', () => {
      const rec = mockRecommendation({
        pattern_type: 'scan_stale_reference',
        target: 'CLAUDE_MD',
        title: 'Stale reference: @docs/missing.md',
        description: 'Reference to @docs/missing.md does not exist on disk.',
        suggested_action: 'Remove or update the stale reference.',
        evidence: { count: 1, examples: ['See @docs/missing.md for details.'] },
      });

      const artifact = generateClaudeMdPatch(rec);

      expect(artifact).not.toBeNull();
      expect(artifact!.type).toBe('claude_md_patch');
      expect(artifact!.content).toBeTruthy();
      expect(artifact!.content.length).toBeGreaterThan(0);
      expect(artifact!.content).toContain('Stale reference removal');
      expect(artifact!.source_recommendation_id).toBe(rec.id);
      expect(artifact!.metadata.pattern_type).toBe('scan_stale_reference');
    });

    it('generateClaudeMdPatch produces valid output for scan_redundancy', () => {
      const rec = mockRecommendation({
        pattern_type: 'scan_redundancy',
        target: 'CLAUDE_MD',
        title: 'Redundant heading: Git Rules',
        description: 'Heading "Git Rules" appears in both CLAUDE.md and rules/git.md.',
        suggested_action:
          'Consolidate "Git Rules" content into one location and reference it from the other.',
      });

      const artifact = generateClaudeMdPatch(rec);

      expect(artifact).not.toBeNull();
      expect(artifact!.type).toBe('claude_md_patch');
      expect(artifact!.content).toBeTruthy();
      expect(artifact!.content.length).toBeGreaterThan(0);
      expect(artifact!.content).toContain('Redundancy consolidation');
      expect(artifact!.source_recommendation_id).toBe(rec.id);
      expect(artifact!.metadata.pattern_type).toBe('scan_redundancy');
    });
  });
});
