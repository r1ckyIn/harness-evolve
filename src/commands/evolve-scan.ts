// Slash command template generator for /evolve:scan

// Template version -- bump when content changes materially
const SCAN_TEMPLATE_VERSION = '5';

/**
 * Return the current scan template version for version-aware updates.
 */
export function getScanTemplateVersion(): string {
  return SCAN_TEMPLATE_VERSION;
}

/**
 * Generate the Markdown content for the /evolve:scan slash command.
 *
 * v5: Imperative pipeline language with verification gates, first-scan
 * detection, inline error handling per step, and explicit command allowlists.
 */
export function generateScanCommand(): string {
  return `---
name: scan
description: Run a model-driven harness-evolve configuration analysis
disable-model-invocation: true
allowed-tools: Bash(npx harness-evolve *)
---
<!-- template-version: ${SCAN_TEMPLATE_VERSION} -->

# Evolve Scan

> You are executing a pipeline. Follow each step exactly.
> Do not improvise, skip steps, or run commands not listed here.
> The ONLY commands you may run are: \`npx harness-evolve scan-context\` and \`npx harness-evolve store-findings\`.

## Step 0: Detect Scan Mode

MANDATORY: Determine whether this is a first scan or a subsequent scan.

\`\`\`bash
ls ~/.harness-evolve/analysis/pre-processed/summary.json 2>/dev/null
\`\`\`

- If the file DOES NOT exist: This is a **first scan**. Analyze configuration files only.
- If the file EXISTS: This is a **subsequent scan**. You will also read historical data in Step 2.

Note the result. You will use it in Step 2.

## Step 1: Gather Context

MANDATORY: Run the scan-context CLI to collect raw configuration data.

\`\`\`bash
npx harness-evolve scan-context
\`\`\`

Capture the JSON output. It contains: \`claude_md_files\`, \`rules\`, \`settings\`, \`commands\`, \`hooks_registered\`.

If this command fails, STOP. Show the error to the user. Suggest \`harness-evolve init\`. DO NOT proceed.

If output is valid JSON with \`claude_md_files\`, \`rules\`, \`settings\` fields, proceed to Step 2.

## Step 2: Analyze Configuration

For each of the 7 analysis areas below, examine the relevant ScanContext fields and check each item.

If Step 0 determined this is a **subsequent scan**, ALSO read historical data:
\`\`\`bash
cat ~/.harness-evolve/analysis/pre-processed/summary.json
\`\`\`
Include historical pattern insights alongside configuration findings.

If Step 0 determined this is a **first scan**, analyze configuration files only. DO NOT reference or fabricate historical data.

### Area 1: Redundancy
**pattern_type:** \`scan_redundancy\` | **Default target:** \`RULE\`

**What to Check**
- Same constraint in CLAUDE.md AND .claude/rules/ (duplication across files)
- Same setting in user AND project settings.json (scope duplication)
- Rule file repeating CLAUDE.md content verbatim

**Severity Rules:** problem if contradictory duplicates; suggestion if benign duplicates.
**Confidence:** HIGH if exact text match; MEDIUM if same intent, different wording; LOW if related but unclear.

**Do NOT Flag**
- Intentional overrides (project settings overriding user settings)
- CLAUDE.md referencing a rule file (cross-referencing, not duplication)

### Area 2: Missing Mechanization
**pattern_type:** \`scan_missing_mechanization\` | **Default target:** \`HOOK\`

**What to Check**
- Natural language instructions in CLAUDE.md or rules describing hookable operations (e.g., "always run tests before commit", "never push to main")
- Validation steps described as "Claude should check" that could be automated as hooks

**Severity Rules:** problem if critical (data loss, security); suggestion if workflow optimization.
**Confidence:** HIGH if imperative language + hookable event; MEDIUM if strong preference; LOW if guideline.

**Do NOT Flag**
- Subjective guidance ("prefer X over Y")
- Patterns already covered by existing hooks (check \`hooks_registered\`)
- Complex multi-step workflows better suited for skills

### Area 3: Stale References
**pattern_type:** \`scan_stale_reference\` | **Default target:** \`CLAUDE_MD\`

**What to Check**
- @path references in CLAUDE.md pointing to non-existent files
- Rule files referencing paths that do not exist
- Mentions of tools or commands that are not installed or recognized

**Severity Rules:** problem if actively followed instruction; suggestion if secondary reference.
**Confidence:** HIGH if path clearly non-existent; MEDIUM if path might exist outside scanned scope.

**Do NOT Flag**
- npm scoped packages (\`@scope/package\`) -- package names, not file references
- URL user paths (\`@user/path\`) -- URL patterns, not file references
- References to external tools that might be globally installed

### Area 4: Conflicts
**pattern_type:** \`scan_rule_conflict\` | **Default target:** \`RULE\`

**What to Check**
- Contradictory directives (e.g., "use ESM" vs "use CommonJS")
- Conflicting settings between user and project scope without intentional override
- Rules that negate each other

**Severity Rules:** problem if conflict causes broken behavior; suggestion if confusion only.
**Confidence:** HIGH if explicit contradiction; MEDIUM if semantic conflict; LOW if potentially intentional.

**Do NOT Flag**
- Intentional scope overrides (project overrides user is valid)
- Complementary rules covering different scopes

### Area 5: Structure Issues
**pattern_type:** \`scan_structure_issue\` | **Default target:** \`RULE\`

**What to Check**
- Empty rule files (0 bytes or only whitespace)
- Oversized rule files (>200 lines)
- Rule files without headings
- Rules in subdirectories without path-scoping frontmatter
- CLAUDE.md exceeding 500 lines

**Severity Rules:** problem if empty rule file; suggestion for oversized or poor organization.
**Confidence:** HIGH if empty; MEDIUM if oversized; LOW if organization could improve.

**Do NOT Flag**
- Small focused rule files (<10 lines)
- CLAUDE.md under 200 lines
- Subdirectory rules that are intentionally broad

### Area 6: Hooks Quality
**pattern_type:** \`scan_hooks_redundancy\` | **Default target:** \`SETTINGS\`

**What to Check**
- Duplicate hooks (same event + same command)
- Overlapping hooks (different commands, same check, same event)
- Hooks pointing to non-existent scripts
- Hooks without error handling (missing \`|| true\` for non-critical)

**Severity Rules:** problem if script missing or exact duplicate; suggestion if overlap.
**Confidence:** HIGH if script non-existent or exact duplicate; MEDIUM if purpose overlap.

**Do NOT Flag**
- Multiple hooks on the same event doing different things
- harness-evolve's own hooks

### Area 7: Commands Quality
**pattern_type:** \`scan_command_convention\` | **Default target:** \`SKILL\`

**What to Check**
- Command files missing YAML frontmatter (name, description)
- Empty command files
- Commands without \`description\` field
- Commands with overly generic names
- Commands referencing non-existent tools or paths

**Severity Rules:** problem if empty; suggestion for missing frontmatter or poor naming.
**Confidence:** HIGH if empty; MEDIUM if frontmatter missing; LOW if naming could improve.

**Do NOT Flag**
- Commands that intentionally skip frontmatter
- Short commands (<5 lines) that are clear without description

You should have 3-8 findings. If zero, confirm config is clean. If over 20, reduce to highest severity. Proceed to Step 3.

## Severity Classification

| Condition | severity | confidence |
|-----------|----------|------------|
| Config is broken or contradictory | problem | HIGH |
| Config works but has redundancy or duplication | suggestion | MEDIUM |
| Config could benefit from mechanization | suggestion | MEDIUM |
| Style or convention improvement | suggestion | LOW |
| Referenced file does not exist | problem | HIGH |
| Referenced file might not exist | suggestion | MEDIUM |

> When in doubt, prefer \`suggestion\` over \`problem\`, and \`MEDIUM\` over \`HIGH\`.

## Step 3: Store Findings

MANDATORY: Format all findings as a JSON array and pipe to store-findings.

\`\`\`bash
echo '<json_array>' | npx harness-evolve store-findings
\`\`\`

If \`skipped > 0\`, check the \`errors\` array. Fix invalid fields and re-pipe corrected findings. DO NOT skip this step.

If \`stored > 0\`, proceed to Step 4.

## Step 4: Present Results

Show a human-readable summary:

> Analyzed **N** areas, found **M** finding(s).

Group by severity (problems first, then suggestions). For each finding show title, description, and suggested action.

End with:

> Run \`/evolve:apply\` to review and apply fixes.

## Output Format

**Language: Default to English for all output. If the user has explicitly requested a different language for this session, use that language for the human-readable summary only. JSON findings MUST always use English.**

Format each finding as a JSON object matching this structure:

\`\`\`json
{
  "id": "scan-redundancy-abc123",
  "target": "RULE",
  "confidence": "HIGH",
  "pattern_type": "scan_redundancy",
  "title": "Duplicate constraint in CLAUDE.md and rules/coding.md",
  "description": "The instruction 'always use TypeScript strict mode' appears in both CLAUDE.md (line 12) and .claude/rules/coding.md (line 5).",
  "evidence": {
    "count": 1,
    "examples": ["CLAUDE.md line 12: 'Use TypeScript strict mode'", "rules/coding.md line 5: 'Always enable strict mode'"]
  },
  "suggested_action": "Remove the constraint from CLAUDE.md and keep it in .claude/rules/coding.md.",
  "severity": "suggestion"
}
\`\`\`

**Valid values:**
- \`pattern_type\`: scan_redundancy, scan_missing_mechanization, scan_stale_reference, scan_rule_conflict, scan_structure_issue, scan_hooks_redundancy, scan_command_convention
- \`target\`: HOOK, SKILL, RULE, CLAUDE_MD, MEMORY, SETTINGS
- \`confidence\`: HIGH, MEDIUM, LOW
- \`severity\`: problem, suggestion
- \`evidence.examples\`: maximum 3 strings
- \`id\` format: \`scan-{area}-{short-hash}\`

## Boundary Conditions

Global exclusions across all analysis areas:

- npm scoped packages (\`@scope/package\`) are NOT stale references
- URL user paths (\`/@user/path\`) are NOT stale references
- Empty \`.claude/\` directory is normal for new projects
- Global-only configuration (no project-level config) is valid
- harness-evolve's own hooks are NOT redundant
- Intentional scope overrides are NOT conflicts
- Do not produce more than 20 findings total
- Aim for 3-8 findings on a typical config. Zero findings is valid for clean configs.
- **No \`.claude/\` directory:** Report minimal findings. Normal for new projects.
- **Very large configs (50+ rules files):** Focus on highest-severity findings.
`;
}
