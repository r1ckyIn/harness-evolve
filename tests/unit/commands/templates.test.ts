// Unit tests for slash command template generators

import { describe, it, expect } from 'vitest';
import { generateScanCommand } from '../../../src/commands/evolve-scan.js';
import { generateApplyCommand } from '../../../src/commands/evolve-apply.js';

describe('generateScanCommand', () => {
  const output = generateScanCommand();

  it('starts with YAML frontmatter delimiter', () => {
    expect(output.startsWith('---\n')).toBe(true);
  });

  it('contains name: scan in frontmatter', () => {
    const frontmatter = output.split('---')[1];
    expect(frontmatter).toContain('name: scan');
  });

  it('contains description in frontmatter', () => {
    const frontmatter = output.split('---')[1];
    expect(frontmatter).toContain('description:');
  });

  it('contains disable-model-invocation: true in frontmatter', () => {
    const frontmatter = output.split('---')[1];
    expect(frontmatter).toContain('disable-model-invocation: true');
  });

  it('contains npx harness-evolve scan instruction', () => {
    expect(output).toContain('npx harness-evolve scan');
  });

  it('contains instructions to present results grouped by confidence', () => {
    expect(output.toLowerCase()).toContain('confidence');
    expect(output.toLowerCase()).toContain('high');
  });

  it('suggests running /evolve:apply if issues are found', () => {
    expect(output).toContain('/evolve:apply');
  });

  // --- Workflow completeness tests (Phase 19) ---

  it('contains ## Prerequisites section', () => {
    expect(output).toContain('## Prerequisites');
  });

  it('contains ## Instructions with step-by-step process', () => {
    expect(output).toContain('## Instructions');
    expect(output).toContain('### Step 1');
  });

  it('contains ## Output Format with exact formatting rules', () => {
    expect(output).toContain('## Output Format');
  });

  it('contains ## Error Handling with CLI failure, no results, and parse error scenarios', () => {
    expect(output).toContain('## Error Handling');
    expect(output).toMatch(/CLI.*Fail|Command Fails/i);
    expect(output).toMatch(/No Results|No Issues|No Problems/i);
    expect(output).toMatch(/JSON Parse|Parse Error/i);
  });

  it('contains ## Edge Cases section', () => {
    expect(output).toContain('## Edge Cases');
  });

  it('contains allowed-tools in frontmatter', () => {
    const frontmatter = output.split('---')[1];
    expect(frontmatter).toContain('allowed-tools:');
  });

  it('is self-contained with no CLAUDE.md preload dependency', () => {
    expect(output).not.toMatch(/preload.*CLAUDE\.md|load.*CLAUDE\.md|requires.*CLAUDE\.md/i);
  });

  it('contains template version comment', () => {
    expect(output).toMatch(/<!-- template-version: \d+ -->/);
  });
});

describe('generateApplyCommand', () => {
  const output = generateApplyCommand();

  it('starts with YAML frontmatter delimiter', () => {
    expect(output.startsWith('---\n')).toBe(true);
  });

  it('contains name: apply in frontmatter', () => {
    const frontmatter = output.split('---')[1];
    expect(frontmatter).toContain('name: apply');
  });

  it('contains description in frontmatter', () => {
    const frontmatter = output.split('---')[1];
    expect(frontmatter).toContain('description:');
  });

  it('contains disable-model-invocation: true in frontmatter', () => {
    const frontmatter = output.split('---')[1];
    expect(frontmatter).toContain('disable-model-invocation: true');
  });

  it('contains argument-hint in frontmatter', () => {
    const frontmatter = output.split('---')[1];
    expect(frontmatter).toContain('argument-hint:');
  });

  it('contains npx harness-evolve pending instruction', () => {
    expect(output).toContain('npx harness-evolve pending');
  });

  it('contains npx harness-evolve apply-one instruction', () => {
    expect(output).toContain('npx harness-evolve apply-one');
  });

  it('contains npx harness-evolve dismiss instruction', () => {
    expect(output).toContain('npx harness-evolve dismiss');
  });

  it('contains all three action choices (apply, skip, ignore)', () => {
    const lower = output.toLowerCase();
    expect(lower).toContain('apply');
    expect(lower).toContain('skip');
    expect(lower).toContain('ignore');
  });

  it('contains $ARGUMENTS handling for filter', () => {
    expect(output).toContain('$ARGUMENTS');
  });

  it('suggests running /evolve:scan when no pending recommendations', () => {
    expect(output).toContain('/evolve:scan');
  });
});
