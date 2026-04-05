// Conflict detection scanner for deep scan module.
// Detects contradictory directives between CLAUDE.md files and rule files
// by finding opposing keyword pairs that reference the same subject.

import type { ScanContext } from '../schemas.js';
import type { Recommendation } from '../../schemas/recommendation.js';

/**
 * Opposition pairs: [regexA, regexB, description].
 * When regexA matches text in one source and regexB matches the same
 * subject word in another source, a contradiction is detected.
 */
export const OPPOSITION_PAIRS: Array<[RegExp, RegExp, string]> = [
  [
    /\b(?:always|must)\s+(?:(?:use|allow|always)\s+)*(\S+)/i,
    /\b(?:never|must\s+not|do\s+not)\s+(?:(?:use|allow|always)\s+)*(\S+)/i,
    'always vs. never',
  ],
  [/\benable\s+(\S+)/i, /\bdisable\s+(\S+)/i, 'enable vs. disable'],
  [/\brequire\s+(\S+)/i, /\bforbid\s+(\S+)/i, 'require vs. forbid'],
];

interface Directive {
  fullMatch: string;
  subject: string;
  source: string;
}

/**
 * Extract all directives from a text using a given regex.
 * Returns the full match and the normalized captured subject (group 1).
 */
function extractDirectives(
  content: string,
  regex: RegExp,
  sourcePath: string,
): Directive[] {
  const directives: Directive[] = [];
  // Use global version of the regex to find all matches
  const globalRegex = new RegExp(regex.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = globalRegex.exec(content)) !== null) {
    if (match[1]) {
      directives.push({
        fullMatch: match[0],
        subject: match[1].toLowerCase().replace(/[^a-z0-9]/g, ''),
        source: sourcePath,
      });
    }
  }
  return directives;
}

/**
 * Scan for contradictory directives between CLAUDE.md files and rule files.
 * Finds opposing keyword pairs (always/never, enable/disable, require/forbid)
 * that reference the same subject across different configuration sources.
 */
export function scanConflicts(context: ScanContext): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let index = 0;

  const claudeMdSources = context.claude_md_files.map((f) => ({
    content: f.content,
    path: f.path,
  }));
  const ruleSources = context.rules.map((r) => ({
    content: r.content,
    path: r.path,
  }));

  // Track already-reported pairs to avoid duplicates
  const reported = new Set<string>();

  for (const [regexA, regexB, description] of OPPOSITION_PAIRS) {
    // Direction 1: regexA in CLAUDE.md, regexB in rules
    for (const cmdSource of claudeMdSources) {
      const directivesA = extractDirectives(
        cmdSource.content,
        regexA,
        cmdSource.path,
      );
      for (const ruleSource of ruleSources) {
        const directivesB = extractDirectives(
          ruleSource.content,
          regexB,
          ruleSource.path,
        );
        for (const dA of directivesA) {
          for (const dB of directivesB) {
            if (dA.subject === dB.subject) {
              const key = `${dA.source}|${dB.source}|${dA.subject}|${description}`;
              if (reported.has(key)) continue;
              reported.add(key);

              recommendations.push({
                id: `rec-scan-conflict-${index++}`,
                target: 'RULE',
                confidence: 'HIGH',
                pattern_type: 'scan_rule_conflict',
                severity: 'problem',
                title: `Conflicting directives: "${dA.fullMatch}" vs "${dB.fullMatch}"`,
                description:
                  `Found contradictory ${description} directives across ` +
                  `${dA.source} and ${dB.source}. ` +
                  `"${dA.fullMatch}" contradicts "${dB.fullMatch}".`,
                evidence: {
                  count: 2,
                  examples: [dA.source, dB.source],
                },
                suggested_action:
                  `Resolve the contradiction between ${dA.source} and ${dB.source}. ` +
                  `Either remove the directive from one source or align them. ` +
                  `Expected effect: Claude will follow a single, unambiguous ` +
                  `instruction instead of choosing between conflicting ones.`,
              });
            }
          }
        }
      }
    }

    // Direction 2: regexB in CLAUDE.md, regexA in rules
    for (const cmdSource of claudeMdSources) {
      const directivesB = extractDirectives(
        cmdSource.content,
        regexB,
        cmdSource.path,
      );
      for (const ruleSource of ruleSources) {
        const directivesA = extractDirectives(
          ruleSource.content,
          regexA,
          ruleSource.path,
        );
        for (const dB of directivesB) {
          for (const dA of directivesA) {
            if (dB.subject === dA.subject) {
              const key = `${cmdSource.path}|${ruleSource.path}|${dB.subject}|${description}`;
              if (reported.has(key)) continue;
              reported.add(key);

              recommendations.push({
                id: `rec-scan-conflict-${index++}`,
                target: 'RULE',
                confidence: 'HIGH',
                pattern_type: 'scan_rule_conflict',
                severity: 'problem',
                title: `Conflicting directives: "${dB.fullMatch}" vs "${dA.fullMatch}"`,
                description:
                  `Found contradictory ${description} directives across ` +
                  `${cmdSource.path} and ${ruleSource.path}. ` +
                  `"${dB.fullMatch}" contradicts "${dA.fullMatch}".`,
                evidence: {
                  count: 2,
                  examples: [cmdSource.path, ruleSource.path],
                },
                suggested_action:
                  `Resolve the contradiction between ${cmdSource.path} and ${ruleSource.path}. ` +
                  `Either remove the directive from one source or align them. ` +
                  `Expected effect: Claude will follow a single, unambiguous ` +
                  `instruction instead of choosing between conflicting ones.`,
              });
            }
          }
        }
      }
    }
  }

  return recommendations;
}
