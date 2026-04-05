// Structure audit scanner for deep scan module.
// Audits .claude/rules/ directory for structural quality issues:
// empty/near-empty rules, oversized rules, headingless rules,
// and unscoped subdirectory rules.

import type { ScanContext } from '../schemas.js';
import type { Recommendation } from '../../schemas/recommendation.js';

/**
 * Check if a rule path is inside a subdirectory of .claude/rules/.
 * A path like ".claude/rules/01-workflow/dev.md" is in a subdirectory,
 * while ".claude/rules/git.md" is at root level.
 */
function isInSubdirectory(rulePath: string): boolean {
  const marker = '.claude/rules/';
  const idx = rulePath.indexOf(marker);
  if (idx === -1) return false;
  const remaining = rulePath.substring(idx + marker.length);
  return remaining.includes('/');
}

/**
 * Scan for structural quality issues in .claude/rules/ directory.
 * Detects empty rules, oversized rules, headingless rules,
 * and rules in subdirectories without paths frontmatter.
 */
export function scanStructure(context: ScanContext): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  for (const rule of context.rules) {
    const trimmedLength = rule.content.trim().length;

    // Check 1: Empty or near-empty rules (< 10 non-whitespace characters)
    if (trimmedLength < 10) {
      recommendations.push({
        id: `rec-scan-structure-${index++}`,
        target: 'RULE',
        confidence: 'HIGH',
        pattern_type: 'scan_structure_issue',
        severity: 'problem',
        title: `Empty or near-empty rule file: ${rule.filename}`,
        description:
          `The rule file at ${rule.path} has only ${trimmedLength} characters ` +
          `of content. It appears to be a placeholder or mistake.`,
        evidence: {
          count: 1,
          examples: [rule.path],
        },
        suggested_action:
          `Remove the empty rule file at ${rule.path} or add meaningful content. ` +
          `Expected effect: reduces Claude's context loading overhead and ` +
          `eliminates confusion from placeholder files.`,
      });
      // Skip further checks for empty rules
      continue;
    }

    // Check 2: Oversized rules (> 200 lines)
    const lineCount = rule.content.split('\n').length;
    if (lineCount > 200) {
      recommendations.push({
        id: `rec-scan-structure-${index++}`,
        target: 'RULE',
        confidence: 'MEDIUM',
        pattern_type: 'scan_structure_issue',
        severity: 'suggestion',
        title: `Oversized rule file: ${rule.filename} (${lineCount} lines)`,
        description:
          `The rule file at ${rule.path} has ${lineCount} lines, ` +
          `exceeding the recommended 200-line limit.`,
        evidence: {
          count: 1,
          examples: [rule.path],
        },
        suggested_action:
          `Split ${rule.filename} (${lineCount} lines) into smaller focused rules, ` +
          `or move detailed reference content to docs/ with an @reference. ` +
          `Expected effect: reduces context bloat and improves Claude's ability ` +
          `to find relevant instructions.`,
      });
    }

    // Check 3: Rules without headings (skip already-flagged empty rules)
    if (rule.headings.length === 0) {
      recommendations.push({
        id: `rec-scan-structure-${index++}`,
        target: 'RULE',
        confidence: 'LOW',
        pattern_type: 'scan_structure_issue',
        severity: 'suggestion',
        title: `Rule file without headings: ${rule.filename}`,
        description:
          `The rule file at ${rule.path} has no markdown headings. ` +
          `Adding headings improves organization and discoverability.`,
        evidence: {
          count: 1,
          examples: [rule.path],
        },
        suggested_action:
          `Add markdown headings to ${rule.filename} to improve organization. ` +
          `Expected effect: Claude can parse and reference specific sections ` +
          `more accurately.`,
      });
    }

    // Check 4: Rules in subdirectory without paths frontmatter
    if (isInSubdirectory(rule.path)) {
      const hasPaths =
        rule.frontmatter?.paths !== undefined &&
        rule.frontmatter.paths.length > 0;
      if (!hasPaths) {
        recommendations.push({
          id: `rec-scan-structure-${index++}`,
          target: 'RULE',
          confidence: 'MEDIUM',
          pattern_type: 'scan_structure_issue',
          severity: 'suggestion',
          title: `Unscoped subdirectory rule: ${rule.filename}`,
          description:
            `The rule file at ${rule.path} is in a subdirectory but lacks ` +
            `a paths: frontmatter. It fires on all files, defeating the ` +
            `purpose of subdirectory organization.`,
          evidence: {
            count: 1,
            examples: [rule.path],
          },
          suggested_action:
            `Add a paths: frontmatter to ${rule.filename} to scope it to specific files. ` +
            `Expected effect: rule only loads when editing matching files, ` +
            `reducing irrelevant context.`,
        });
      }
    }
  }

  return recommendations;
}
