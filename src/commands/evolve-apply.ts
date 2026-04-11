// Slash command template generator for /evolve:apply

// Template version -- bump when content changes materially
const APPLY_TEMPLATE_VERSION = '5';

/**
 * Return the current apply template version for version-aware updates.
 */
export function getApplyTemplateVersion(): string {
  return APPLY_TEMPLATE_VERSION;
}

/**
 * Generate the Markdown content for the /evolve:apply slash command.
 *
 * This produces a comprehensive, self-contained workflow document that fully
 * specifies Claude's behavior when the command is invoked. The .md body IS
 * the context injected by Claude Code -- no CLAUDE.md preloading needed.
 *
 * v5 changes: imperative preamble, one-at-a-time enforcement with MANDATORY
 * markers, per-decision confirmation gates, inline error handling per step.
 */
export function generateApplyCommand(): string {
  return `---
name: apply
description: Review and apply pending harness-evolve recommendations one by one
disable-model-invocation: true
argument-hint: "[filter: all|high|medium|low]"
allowed-tools: Bash(npx harness-evolve *)
---
<!-- template-version: ${APPLY_TEMPLATE_VERSION} -->

# Evolve Apply

> You are executing an interactive review pipeline. Follow each step exactly.
> Do not improvise or batch multiple recommendations.
> The ONLY commands you may run are: \`npx harness-evolve pending\`, \`npx harness-evolve apply-one <id>\`, and \`npx harness-evolve dismiss <id>\`.

## Arguments

If \`$ARGUMENTS\` is provided:
- **"high"**, **"medium"**, or **"low"**: Filter to only show recommendations at that confidence level
- **"all"** or empty: Show all pending recommendations
- Unrecognized value: Show all pending recommendations and note that the filter was ignored

## Prerequisites

Verify harness-evolve is available before proceeding.

## Instructions

### Step 1: Verify Installation

\`\`\`bash
npx harness-evolve --version
\`\`\`

If the command prints a version number, proceed to Step 2.
If not found, STOP. Tell the user to run \`npm install -g harness-evolve\` or \`npx harness-evolve init\`.

### Step 2: Read Pending Recommendations

MANDATORY: Run the pending command to retrieve all recommendations.

\`\`\`bash
npx harness-evolve pending
\`\`\`

If the command fails, STOP. Show the error to the user. Suggest running \`harness-evolve status\` to check installation health.

If the output contains no pending recommendations (empty array or zero items):

> No pending recommendations. Run \`/evolve:scan\` to generate new recommendations.

STOP here.

If \`$ARGUMENTS\` specifies a filter (high/medium/low), note how many total recommendations exist and how many match the filter. If the filter returns zero matches, inform: "No [level] recommendations pending. Run without a filter to see all, or \`/evolve:scan\` for fresh analysis."

### Step 3: Present ONE Recommendation

MANDATORY: Present exactly ONE recommendation using the card format below.
DO NOT present multiple recommendations at once.
DO NOT summarize all recommendations before asking for decisions.

Present as a card:

\`\`\`
**[SEVERITY] [CONFIDENCE]** Title of the recommendation
Description text explaining the issue or opportunity.
- **Evidence:** What triggered this recommendation
- **Suggested:** Action to take
\`\`\`

Where:
- SEVERITY is \`PROBLEM\` or \`SUGGESTION\`
- CONFIDENCE is \`HIGH\`, \`MEDIUM\`, or \`LOW\`

Then present the 4 numbered options:

**Choose an action:**
1. **Apply** -- Execute this recommendation now
2. **Skip** -- Leave it pending for later
3. **Dismiss** -- Permanently remove this recommendation
4. **Let Claude decide** -- Apply if HIGH confidence, skip if MEDIUM/LOW

### Step 4: Process User Decision

MANDATORY: Wait for the user to choose 1-4. If the user responds with text instead of a number, map it to the closest option.

**Option 1 (Apply):**
\`\`\`bash
npx harness-evolve apply-one <id>
\`\`\`
Report the result (success or failure) and show what changed.
If apply fails, show the error. Offer skip or dismiss as alternatives. DO NOT retry automatically.

**Option 2 (Skip):** Leave it pending for future review. No CLI command needed.

**Option 3 (Dismiss):**
\`\`\`bash
npx harness-evolve dismiss <id>
\`\`\`
Confirm the recommendation has been dismissed.
If dismiss fails, show the error and continue to the next recommendation.

**Option 4 (Let Claude decide):** If the recommendation has HIGH confidence, apply it (same as option 1). If MEDIUM or LOW, skip it (same as option 2).

MANDATORY: After processing the choice, confirm the result to the user before moving to the next recommendation.

### Step 5: Next Recommendation

ONLY THEN proceed to the next recommendation.
Repeat Steps 3-4 for each remaining recommendation.
DO NOT batch multiple decisions.

### Step 6: Show Summary

After all recommendations are processed, show:

> Done: **X** applied, **Y** skipped, **Z** dismissed.

If all were skipped or dismissed, suggest:

> Run \`/evolve:scan\` for fresh analysis if you'd like new recommendations.

## Output Format

Each recommendation uses the card format defined in Step 3. The summary at the end uses the format defined in Step 6.

## Edge Cases

- **Only 1 recommendation pending:** Still show the full card format. Skip the "next recommendation" transition and go directly to summary.
- **User asks to stop mid-way:** Summarize what was processed so far and note how many remain pending.
- **Recommendation references a file that no longer exists:** Show a warning but still allow the user to apply, skip, or dismiss.
- **Filter returns zero matches:** Inform: "No [level] recommendations pending. Run without a filter to see all, or \`/evolve:scan\` for fresh analysis."

## Notes

- Recommendations are generated by \`/evolve:scan\` (model-driven configuration analysis) or automatic background analysis hooks.
- Applied recommendations modify configuration files (settings.json, CLAUDE.md, .claude/rules/, etc.).
- Dismissed recommendations will not reappear until a new scan generates them.
- Skipped recommendations remain pending for the next \`/evolve:apply\` session.
- For overall system health, run \`harness-evolve status\`.
`;
}
