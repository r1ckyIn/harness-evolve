// Unit tests for slash command template generators

import { describe, it, expect } from 'vitest';
import { generateScanCommand } from '../../../src/commands/evolve-scan.js';
import { generateApplyCommand } from '../../../src/commands/evolve-apply.js';

describe('generateScanCommand', () => {
  const output = generateScanCommand();

  // --- Frontmatter tests ---

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

  it('contains allowed-tools in frontmatter', () => {
    const frontmatter = output.split('---')[1];
    expect(frontmatter).toContain('allowed-tools:');
  });

  // --- Version tests ---

  it('has template version 5', () => {
    expect(output).toContain('<!-- template-version: 5 -->');
  });

  it('contains template version comment', () => {
    expect(output).toMatch(/<!-- template-version: \d+ -->/);
  });

  // --- Workflow structure tests ---

  it('contains step-by-step process', () => {
    expect(output).toContain('Step 1');
  });

  it('contains ## Output Format with exact formatting rules', () => {
    expect(output).toContain('## Output Format');
  });

  it('suggests running /evolve:apply if issues are found', () => {
    expect(output).toContain('/evolve:apply');
  });

  it('is self-contained with no CLAUDE.md preload dependency', () => {
    expect(output).not.toMatch(/preload.*CLAUDE\.md|load.*CLAUDE\.md|requires.*CLAUDE\.md/i);
  });

  // --- v5 Imperative pipeline tests ---

  it('contains imperative preamble with mandatory execution language', () => {
    // Preamble should appear before Step 1
    const step1Idx = output.indexOf('Step 1');
    const preambleRegion = output.slice(0, step1Idx);
    expect(preambleRegion).toMatch(/follow each step exactly|do not improvise/i);
  });

  it('contains first-scan detection via summary.json check', () => {
    expect(output).toContain('ls ~/.harness-evolve/analysis/pre-processed/summary.json');
  });

  it('contains first-scan vs subsequent-scan branching logic', () => {
    expect(output).toMatch(/first scan/i);
    expect(output).toMatch(/subsequent scan/i);
  });

  it('does not mention deprecated harness-evolve scan command', () => {
    // Use regex to match "harness-evolve scan" but NOT "harness-evolve scan-context" or "harness-evolve store-findings"
    const matches = output.match(/harness-evolve scan(?![-_])/g) || [];
    expect(matches.length, 'should not contain deprecated "harness-evolve scan" command').toBe(0);
  });

  it('does not mention harness-evolve pending command', () => {
    expect(output).not.toContain('harness-evolve pending');
  });

  it('contains per-step verification gates', () => {
    // Each major step should have a verification/proceed instruction
    expect(output).toMatch(/proceed|stop and report/i);
  });

  it('contains imperative markers (MANDATORY or DO NOT)', () => {
    expect(output).toMatch(/MANDATORY/);
    expect(output).toMatch(/DO NOT/);
  });

  it('contains inline error handling within steps', () => {
    // Error handling should appear between step headers, not just in a bottom section
    const step1Idx = output.indexOf('Step 1');
    const stepRegion = output.slice(step1Idx);
    expect(stepRegion).toMatch(/error|fail/i);
  });

  // --- v4 CLI pipeline tests ---

  it('references scan-context CLI for data gathering', () => {
    expect(output).toContain('npx harness-evolve scan-context');
  });

  it('references store-findings CLI for persisting results', () => {
    expect(output).toContain('store-findings');
  });

  it('contains instructions to present results grouped by confidence', () => {
    expect(output.toLowerCase()).toContain('confidence');
    expect(output.toLowerCase()).toContain('high');
  });

  // --- Analysis area tests ---

  it('contains analysis areas within Step 2', () => {
    expect(output).toContain('Step 2: Analyze Configuration');
  });

  it('defines 7 analysis areas', () => {
    expect(output).toContain('Area 1: Redundancy');
    expect(output).toContain('Area 2: Missing Mechanization');
    expect(output).toContain('Area 3: Stale References');
    expect(output).toContain('Area 4: Conflicts');
    expect(output).toContain('Area 5: Structure Issues');
    expect(output).toContain('Area 6: Hooks Quality');
    expect(output).toContain('Area 7: Commands Quality');
  });

  it('each analysis area has What to Check subsection', () => {
    const areas = [
      'Area 1: Redundancy',
      'Area 2: Missing Mechanization',
      'Area 3: Stale References',
      'Area 4: Conflicts',
      'Area 5: Structure Issues',
      'Area 6: Hooks Quality',
      'Area 7: Commands Quality',
    ];
    for (const area of areas) {
      const areaStart = output.indexOf(area);
      expect(areaStart, `${area} should exist`).toBeGreaterThan(-1);
      // Find the next area or end of Analysis Guidance
      const nextAreaIdx = areas.indexOf(area) + 1;
      const nextBound = nextAreaIdx < areas.length
        ? output.indexOf(areas[nextAreaIdx])
        : output.indexOf('## Severity Classification');
      const section = output.slice(areaStart, nextBound);
      expect(section, `${area} should have What to Check`).toContain('What to Check');
    }
  });

  it('each analysis area has Do NOT Flag subsection', () => {
    const areas = [
      'Area 1: Redundancy',
      'Area 2: Missing Mechanization',
      'Area 3: Stale References',
      'Area 4: Conflicts',
      'Area 5: Structure Issues',
      'Area 6: Hooks Quality',
      'Area 7: Commands Quality',
    ];
    for (const area of areas) {
      const areaStart = output.indexOf(area);
      expect(areaStart, `${area} should exist`).toBeGreaterThan(-1);
      const nextAreaIdx = areas.indexOf(area) + 1;
      const nextBound = nextAreaIdx < areas.length
        ? output.indexOf(areas[nextAreaIdx])
        : output.indexOf('## Severity Classification');
      const section = output.slice(areaStart, nextBound);
      expect(section, `${area} should have Do NOT Flag`).toContain('Do NOT Flag');
    }
  });

  // --- v4 Severity and classification tests ---

  it('contains ## Severity Classification section', () => {
    expect(output).toContain('## Severity Classification');
  });

  it('contains severity classification matrix with problem and suggestion', () => {
    const sevSection = output.slice(
      output.indexOf('## Severity Classification'),
      output.indexOf('## Output Format'),
    );
    expect(sevSection).toContain('problem');
    expect(sevSection).toContain('suggestion');
  });

  // --- v4 Boundary conditions tests ---

  it('contains ## Boundary Conditions section', () => {
    expect(output).toContain('## Boundary Conditions');
  });

  it('contains boundary exclusion for npm scoped packages', () => {
    expect(output).toContain('@scope/package');
  });

  // --- v4 Structured output contract tests ---

  it('contains structured output contract with JSON example', () => {
    expect(output).toContain('"pattern_type":');
    expect(output).toContain('"target":');
  });

  // --- v4 Enum coverage tests ---

  it('references all 7 scan pattern types', () => {
    const scanTypes = [
      'scan_redundancy',
      'scan_missing_mechanization',
      'scan_stale_reference',
      'scan_rule_conflict',
      'scan_structure_issue',
      'scan_hooks_redundancy',
      'scan_command_convention',
    ];
    for (const type of scanTypes) {
      expect(output, `should contain ${type}`).toContain(type);
    }
  });

  it('references all 6 routing targets', () => {
    const targets = ['HOOK', 'SKILL', 'RULE', 'CLAUDE_MD', 'MEMORY', 'SETTINGS'];
    for (const target of targets) {
      expect(output, `should contain ${target}`).toContain(target);
    }
  });

  // --- v4 Language instruction test ---

  it('contains English-language instruction in Output Format', () => {
    expect(output).toContain('Default to English for all output');
  });

  // --- v4 Template size test ---

  it('template is between 200 and 300 lines', () => {
    const lineCount = output.split('\n').length;
    expect(lineCount).toBeGreaterThanOrEqual(200);
    expect(lineCount).toBeLessThanOrEqual(300);
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

  it('contains all three action choices (apply, skip, dismiss)', () => {
    const lower = output.toLowerCase();
    expect(lower).toContain('apply');
    expect(lower).toContain('skip');
    expect(lower).toContain('dismiss');
  });

  it('contains $ARGUMENTS handling for filter', () => {
    expect(output).toContain('$ARGUMENTS');
  });

  it('suggests running /evolve:scan when no pending recommendations', () => {
    expect(output).toContain('/evolve:scan');
  });

  // --- Workflow completeness tests (Phase 19) ---

  it('contains ## Prerequisites section', () => {
    expect(output).toContain('## Prerequisites');
  });

  it('contains ## Instructions with step-by-step process', () => {
    expect(output).toContain('## Instructions');
    expect(output).toContain('### Step 1');
  });

  it('contains ## Output Format section', () => {
    expect(output).toContain('## Output Format');
  });

  it('has inline error handling, not a separate bottom section', () => {
    // v5 moves error handling inline per step -- no standalone ## Error Handling section
    expect(output).not.toMatch(/^## Error Handling/m);
    // But error/fail language should exist within the step instructions
    const instructionsIdx = output.indexOf('## Instructions');
    const notesIdx = output.indexOf('## Notes');
    const edgeCasesIdx = output.indexOf('## Edge Cases');
    const endBound = notesIdx > 0 ? notesIdx : (edgeCasesIdx > 0 ? edgeCasesIdx : undefined);
    const instructionRegion = output.slice(instructionsIdx, endBound);
    expect(instructionRegion).toMatch(/error|fail/i);
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

  it('contains numbered options (1-4) in Step 4', () => {
    expect(output).toContain('1.');
    expect(output).toContain('2.');
    expect(output).toContain('3.');
    expect(output).toContain('4.');
  });

  it('contains Let Claude decide option', () => {
    expect(output).toContain('Let Claude decide');
  });

  it('does not contain old free-form Choose format', () => {
    expect(output).not.toMatch(/Choose: \[Apply\] \[Skip\] \[Dismiss\]/);
  });

  it('has template version 5', () => {
    expect(output).toContain('<!-- template-version: 5 -->');
  });

  // --- v5 One-at-a-time enforcement tests ---

  it('contains explicit DO NOT present multiple enforcement', () => {
    expect(output).toMatch(/DO NOT present multiple/i);
  });

  it('contains one-at-a-time MANDATORY enforcement', () => {
    expect(output).toMatch(/MANDATORY/);
    expect(output).toMatch(/exactly ONE|one at a time|ONE recommendation/i);
  });

  it('contains per-decision confirmation gate', () => {
    expect(output).toMatch(/confirm the result|confirm.*before.*next/i);
  });

  it('contains imperative preamble language', () => {
    expect(output).toMatch(/follow.*step.*exactly|do not improvise/i);
  });

});
