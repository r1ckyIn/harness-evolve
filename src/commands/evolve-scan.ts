// Slash command template generator for /evolve:scan

/**
 * Generate the Markdown content for the /evolve:scan slash command.
 *
 * This command instructs Claude Code to run a deep configuration scan
 * using the harness-evolve CLI and present results grouped by confidence.
 */
export function generateScanCommand(): string {
  return `---
name: scan
description: Run a deep harness-evolve configuration scan to detect quality issues
disable-model-invocation: true
---

# Evolve Scan

Run a deep scan of the current project's Claude Code configuration to detect quality issues and optimization opportunities.

## What This Does

Analyzes your Claude Code configuration files to detect:
- **Redundant rules** -- same constraint defined in multiple files (CLAUDE.md, .claude/rules/, settings.json)
- **Missing mechanization** -- operations in rules or CLAUDE.md that should be hooks for 100% reliability
- **Stale config** -- references to non-existent files, outdated commands, or unused settings
- **Rule conflicts** -- contradictory directives across CLAUDE.md and rules files
- **Structure issues** -- empty rules, oversized rules, unscoped subdirectory rules
- **Hook redundancy** -- duplicate or overlapping hook registrations in settings.json
- **Command conventions** -- missing frontmatter, empty commands, missing descriptions

Files scanned: CLAUDE.md, .claude/rules/, settings.json, .claude/commands/

## Instructions

Run the scan CLI command:

\`\`\`bash
npx harness-evolve scan
\`\`\`

Or if globally installed:

\`\`\`bash
harness-evolve scan
\`\`\`

## Presenting Results

Present the results in two clearly separated sections:

### 1. Problems (must fix)
Issues that are broken, conflicting, or misconfigured. These need attention.
Show items where \`severity\` is \`"problem"\` (found in the \`problems\` array).

For each problem, show:
- **PROBLEM** badge with confidence level (HIGH/MEDIUM/LOW)
- Description of what's wrong
- Affected file(s)
- Suggested fix with expected effect

### 2. Optimization Suggestions (optional improvements)
Things that work but could be better. These are optional.
Show items where \`severity\` is \`"suggestion"\` (found in the \`suggestions\` array).

For each suggestion, show:
- **SUGGESTION** badge with confidence level (HIGH/MEDIUM/LOW)
- Description of the opportunity
- Affected file(s)
- Suggested improvement with expected effect

If no problems are found, congratulate the user on a clean configuration.
If suggestions exist, mention them as optional improvements.

If issues are found, suggest running \`/evolve:apply\` to review and apply the recommendations interactively.
`;
}
