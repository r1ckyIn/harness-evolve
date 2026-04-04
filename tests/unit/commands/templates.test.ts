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
