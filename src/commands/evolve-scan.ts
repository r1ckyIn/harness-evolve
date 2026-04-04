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
- **Configuration drift** -- inconsistencies between .claude/commands/, rules, and settings

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

Present the results grouped by confidence level (HIGH first, then MEDIUM, then LOW):

1. **HIGH confidence** -- Issues that are very likely real problems. Recommend immediate action.
2. **MEDIUM confidence** -- Probable issues worth reviewing. Present with context for user to decide.
3. **LOW confidence** -- Possible improvements. Mention briefly and let user prioritize.

For each issue, show:
- Confidence level and category
- Description of the problem
- Affected file(s)
- Suggested fix

If issues are found, suggest running \`/evolve:apply\` to review and apply the recommendations interactively.

If no issues are found, congratulate the user on a clean configuration.
`;
}
