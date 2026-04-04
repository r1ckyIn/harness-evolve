// Redundancy scanner for deep scan module.
// Detects duplicate headings across CLAUDE.md and rule files, and
// duplicate rule files with highly similar heading sets.

import type { ScanContext } from '../schemas.js';
import type { Recommendation } from '../../schemas/recommendation.js';

/**
 * Normalize text for comparison: lowercase, trim, collapse whitespace.
 */
export function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Scan for redundant configuration: duplicate headings across CLAUDE.md
 * and rules, and duplicate rule files with matching heading sets.
 */
export function scanRedundancy(context: ScanContext): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  // Check 1: CLAUDE.md headings vs rule headings
  const claudeMdHeadings = context.claude_md_files.flatMap(f =>
    f.headings.map(h => ({ heading: normalizeText(h), source: f.path })),
  );
  const ruleHeadings = context.rules.flatMap(r =>
    r.headings.map(h => ({ heading: normalizeText(h), source: r.path })),
  );

  for (const cmdH of claudeMdHeadings) {
    const match = ruleHeadings.find(rH => rH.heading === cmdH.heading);
    if (match) {
      recommendations.push({
        id: `rec-scan-redundancy-${index++}`,
        target: 'RULE',
        confidence: 'MEDIUM',
        pattern_type: 'scan_redundancy',
        title: `Redundant section: "${cmdH.heading}"`,
        description:
          `The heading "${cmdH.heading}" appears in both ` +
          `${cmdH.source} and ${match.source}. ` +
          `This may indicate duplicated instructions.`,
        evidence: {
          count: 2,
          examples: [cmdH.source, match.source],
        },
        suggested_action:
          'Consolidate into one location. If it belongs in rules, ' +
          'remove from CLAUDE.md. If it belongs in CLAUDE.md, remove the rule file.',
      });
    }
  }

  // Check 2: Duplicate rule files (same heading set in 2+ rule files)
  const rulesByHeadingSet = new Map<string, string[]>();
  for (const rule of context.rules) {
    const key = rule.headings
      .map(h => normalizeText(h))
      .sort()
      .join('||');
    if (!key) continue; // Skip rules with no headings
    const existing = rulesByHeadingSet.get(key) ?? [];
    existing.push(rule.path);
    rulesByHeadingSet.set(key, existing);
  }

  for (const [, paths] of rulesByHeadingSet) {
    if (paths.length < 2) continue;
    recommendations.push({
      id: `rec-scan-redundancy-${index++}`,
      target: 'RULE',
      confidence: 'MEDIUM',
      pattern_type: 'scan_redundancy',
      title: `Duplicate rule files detected (${paths.length} files with same headings)`,
      description:
        `${paths.length} rule files share the same heading structure: ` +
        `${paths.join(', ')}. They may contain redundant content.`,
      evidence: {
        count: paths.length,
        examples: paths.slice(0, 3),
      },
      suggested_action:
        'Review these rule files and merge them into a single file, ' +
        'or differentiate their content.',
    });
  }

  return recommendations;
}
