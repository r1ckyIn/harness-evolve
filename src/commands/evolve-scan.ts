// Slash command template generator for /evolve:scan

// Template version -- bump when content changes materially
const SCAN_TEMPLATE_VERSION = '2';

/**
 * Return the current scan template version for version-aware updates.
 */
export function getScanTemplateVersion(): string {
  return SCAN_TEMPLATE_VERSION;
}

/**
 * Generate the Markdown content for the /evolve:scan slash command.
 *
 * This produces a comprehensive, self-contained workflow document that fully
 * specifies Claude's behavior when the command is invoked. The .md body IS
 * the context injected by Claude Code -- no CLAUDE.md preloading needed.
 */
export function generateScanCommand(): string {
  return `---
name: scan
description: Run a deep harness-evolve configuration scan to detect quality issues
disable-model-invocation: true
allowed-tools: Bash(npx harness-evolve *)
---
<!-- template-version: ${SCAN_TEMPLATE_VERSION} -->

# Evolve Scan

Run a deep scan of your Claude Code configuration to detect quality issues and optimization opportunities.

## Context

This command analyzes your Claude Code configuration files using 7 specialized scanners:

1. **Redundancy scanner** -- same constraint defined in multiple files (CLAUDE.md, .claude/rules/, settings.json)
2. **Mechanization scanner** -- operations in rules or CLAUDE.md that should be hooks for 100% reliability
3. **Staleness scanner** -- references to non-existent files, outdated commands, or unused settings
4. **Conflict scanner** -- contradictory directives across CLAUDE.md and rules files
5. **Structure scanner** -- empty rules, oversized rules, unscoped subdirectory rules
6. **Hooks redundancy scanner** -- duplicate or overlapping hook registrations in settings.json
7. **Commands convention scanner** -- missing frontmatter, empty commands, missing descriptions

Files scanned: CLAUDE.md, .claude/rules/, settings.json, .claude/commands/

## Prerequisites

Before running the scan, verify harness-evolve is available:

\`\`\`bash
npx harness-evolve --version
\`\`\`

- If the command prints a version number, proceed to Instructions.
- If the command fails with "not found" or similar error, install harness-evolve first:
  \`\`\`bash
  npm install -g harness-evolve
  \`\`\`
  Or for first-time setup:
  \`\`\`bash
  npx harness-evolve init
  \`\`\`

## Instructions

### Step 1: Run the Scan

Execute the scan CLI command:

\`\`\`bash
npx harness-evolve scan
\`\`\`

### Step 2: Capture JSON Output

The CLI outputs structured JSON to stdout. Capture the full output. The JSON contains:
- \`problems\` array -- issues that are broken, conflicting, or misconfigured
- \`suggestions\` array -- things that work but could be improved
- Each item has: \`id\`, \`title\`, \`description\`, \`confidence\` (HIGH/MEDIUM/LOW), \`severity\` (problem/suggestion), \`scanner\`, \`file\`, \`suggestedAction\`, \`expectedEffect\`

### Step 3: Parse the JSON

Parse the JSON output. If parsing fails, see Error Handling below.

### Step 4: Present Results

Present the results using the exact Output Format specified below.

## Output Format

Start with a summary line:

> Found **X** problem(s) and **Y** suggestion(s).

**If problems exist**, show a "### Problems (must fix)" section. For each problem:

\`\`\`
**PROBLEM** [HIGH] Title of the problem
Description of what is wrong.
- **File:** path/to/affected/file
- **Fix:** Suggested action to resolve
- **Effect:** Expected improvement after fix
\`\`\`

**If suggestions exist**, show a "### Suggestions (optional improvements)" section. For each suggestion:

\`\`\`
**SUGGESTION** [MEDIUM] Title of the suggestion
Description of the improvement opportunity.
- **File:** path/to/affected/file
- **Improvement:** Suggested action
- **Effect:** Expected improvement after change
\`\`\`

**If zero problems are found:**

> No problems detected -- your configuration is clean.

If suggestions exist alongside zero problems, show them as optional improvements.

**End with:**

> Run \`/evolve:apply\` to review and apply recommendations interactively.

## Error Handling

### CLI Command Fails

If \`npx harness-evolve scan\` exits with a non-zero code or outputs JSON containing an \`error\` field:

1. Show the error message to the user
2. Suggest: "Try running \`harness-evolve status\` to check installation health"
3. If the error mentions "not found", suggest: "Run \`harness-evolve init\` to set up"

### No Results Found

If the scan returns zero problems and zero suggestions (both arrays empty):

- Congratulate the user: "Your configuration looks clean -- no issues detected."
- Suggest: "Run \`harness-evolve status\` for overall health information."

### JSON Parse Error

If the CLI output is not valid JSON:

1. Show the raw output to the user for debugging
2. Suggest: "This may be a version mismatch. Try \`npx harness-evolve@latest scan\`"

## Edge Cases

- **Project has no \`.claude/\` directory:** The scan still runs but may find fewer issues. This is normal for new projects or projects that rely on global configuration only.
- **Multiple CLAUDE.md files in parent directories:** The scanner checks the project-level CLAUDE.md only. Parent directory files are not in scope.
- **Large number of rules files (50+):** The scan may take a few seconds longer but will complete normally.
- **No internet connection:** The scan runs entirely locally. No network access is required.

## Notes

- Recommendations from this scan are stored and can be reviewed with \`/evolve:apply\`.
- Background analysis (via hooks) also generates recommendations on the same pipeline.
- Re-running scan replaces previous scan results with fresh analysis.
- For overall system health, run \`harness-evolve status\`.
`;
}
