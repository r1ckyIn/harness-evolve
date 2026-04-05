// Unit tests for the hooks redundancy scanner.
// Verifies detection of duplicate hooks, missing commands,
// and cross-scope redundancy in settings.json hook registrations.

import { describe, it, expect } from 'vitest';
import { scanHooksRedundancy } from '../../../../src/scan/scanners/hooks-redundancy.js';
import { recommendationSchema } from '../../../../src/schemas/recommendation.js';
import type { ScanContext } from '../../../../src/scan/schemas.js';

/** Build a minimal ScanContext for testing. */
function makeScanContext(overrides: Partial<ScanContext> = {}): ScanContext {
  return {
    generated_at: new Date().toISOString(),
    project_root: '/tmp/test-project',
    claude_md_files: [],
    rules: [],
    settings: { user: null, project: null, local: null },
    commands: [],
    hooks_registered: [],
    ...overrides,
  };
}

describe('scanHooksRedundancy', () => {
  it('returns empty array when no hooks registered', () => {
    const ctx = makeScanContext({ hooks_registered: [] });
    const result = scanHooksRedundancy(ctx);
    expect(result).toEqual([]);
  });

  it('returns empty array when all hooks are unique (different events, different commands)', () => {
    const ctx = makeScanContext({
      hooks_registered: [
        { event: 'PreToolUse', scope: 'project', type: 'command', command: 'node lint.js' },
        { event: 'PostToolUse', scope: 'project', type: 'command', command: 'node format.js' },
        { event: 'UserPromptSubmit', scope: 'user', type: 'command', command: 'node capture.js' },
      ],
    });
    const result = scanHooksRedundancy(ctx);
    expect(result).toEqual([]);
  });

  it('detects exact duplicate hooks: same event + same scope + same command', () => {
    const ctx = makeScanContext({
      hooks_registered: [
        { event: 'PreToolUse', scope: 'project', type: 'command', command: 'node check.js' },
        { event: 'PreToolUse', scope: 'project', type: 'command', command: 'node check.js' },
      ],
    });
    const result = scanHooksRedundancy(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const dup = result.find(r => r.title.includes('Duplicate'));
    expect(dup).toBeDefined();
    expect(dup!.severity).toBe('problem');
    expect(dup!.confidence).toBe('HIGH');
    expect(dup!.pattern_type).toBe('scan_hooks_redundancy');
  });

  it('detects hooks without commands (type command but command missing)', () => {
    const ctx = makeScanContext({
      hooks_registered: [
        { event: 'PreToolUse', scope: 'project', type: 'command', command: undefined },
        { event: 'PostToolUse', scope: 'user', type: 'command', command: '' },
      ],
    });
    const result = scanHooksRedundancy(ctx);
    expect(result.length).toBeGreaterThanOrEqual(2);
    const noCmd = result.filter(r => r.title.toLowerCase().includes('without command') || r.title.toLowerCase().includes('missing command'));
    expect(noCmd.length).toBeGreaterThanOrEqual(2);
    for (const rec of noCmd) {
      expect(rec.severity).toBe('problem');
      expect(rec.confidence).toBe('HIGH');
    }
  });

  it('detects same command registered at user and project scope', () => {
    const ctx = makeScanContext({
      hooks_registered: [
        { event: 'PreToolUse', scope: 'user', type: 'command', command: 'node check.js' },
        { event: 'PreToolUse', scope: 'project', type: 'command', command: 'node check.js' },
      ],
    });
    const result = scanHooksRedundancy(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const crossScope = result.find(r => r.description.includes('user') && r.description.includes('project'));
    expect(crossScope).toBeDefined();
    expect(crossScope!.severity).toBe('suggestion');
    expect(crossScope!.confidence).toBe('MEDIUM');
  });

  it('does NOT flag hooks on same event but different scopes with DIFFERENT commands', () => {
    const ctx = makeScanContext({
      hooks_registered: [
        { event: 'PreToolUse', scope: 'user', type: 'command', command: 'node global-check.js' },
        { event: 'PreToolUse', scope: 'project', type: 'command', command: 'node local-check.js' },
      ],
    });
    const result = scanHooksRedundancy(ctx);
    expect(result).toEqual([]);
  });

  it('does NOT flag hooks on different events even if they share the same command', () => {
    const ctx = makeScanContext({
      hooks_registered: [
        { event: 'PreToolUse', scope: 'project', type: 'command', command: 'node check.js' },
        { event: 'PostToolUse', scope: 'project', type: 'command', command: 'node check.js' },
      ],
    });
    const result = scanHooksRedundancy(ctx);
    expect(result).toEqual([]);
  });

  it('suggested_action includes "Expected effect:" text', () => {
    const ctx = makeScanContext({
      hooks_registered: [
        { event: 'PreToolUse', scope: 'project', type: 'command', command: 'node check.js' },
        { event: 'PreToolUse', scope: 'project', type: 'command', command: 'node check.js' },
      ],
    });
    const result = scanHooksRedundancy(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const rec of result) {
      expect(rec.suggested_action).toContain('Expected effect:');
    }
  });

  it('all produced recommendations pass recommendationSchema.parse()', () => {
    const ctx = makeScanContext({
      hooks_registered: [
        { event: 'PreToolUse', scope: 'project', type: 'command', command: 'node check.js' },
        { event: 'PreToolUse', scope: 'project', type: 'command', command: 'node check.js' },
        { event: 'PostToolUse', scope: 'user', type: 'command', command: undefined },
        { event: 'PreToolUse', scope: 'user', type: 'command', command: 'node check.js' },
      ],
    });
    const result = scanHooksRedundancy(ctx);
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const rec of result) {
      expect(() => recommendationSchema.parse(rec)).not.toThrow();
    }
  });
});
