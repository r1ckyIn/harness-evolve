// Slash command template generator for /evolve:scan

// Template version -- bump when content changes materially
const SCAN_TEMPLATE_VERSION = '4';

/**
 * Return the current scan template version for version-aware updates.
 */
export function getScanTemplateVersion(): string {
  return SCAN_TEMPLATE_VERSION;
}

/**
 * Generate the Markdown content for the /evolve:scan slash command.
 *
 * This produces a comprehensive, self-contained model-executable guidance
 * document that instructs the model to read raw configuration data, analyze
 * it following 7 area checklists, classify findings by severity, and pipe
 * structured results to the apply pipeline. The .md body IS the context
 * injected by Claude Code -- no CLAUDE.md preloading needed.
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

You are performing a model-driven configuration analysis.
You will read raw configuration data, analyze it using the guidance below, and store structured findings.

## Prerequisites

Before running the scan, verify harness-evolve is available:

\`\`\`bash
npx harness-evolve --version
\`\`\`

- If the command prints a version number, proceed to Instructions.
- If the command fails with "not found" or similar error, install first:
  \`\`\`bash
  npm install -g harness-evolve
  \`\`\`

## Instructions

### Step 1: Gather Context

Run the scan-context CLI to collect raw configuration data:

\`\`\`bash
npx harness-evolve scan-context
\`\`\`

Capture the JSON output. It contains: \`claude_md_files\`, \`rules\`, \`settings\`, \`commands\`, \`hooks_registered\`.
If the command fails, see Error Handling below.

### Step 2: Analyze Configuration

For each of the 7 analysis areas below, examine the relevant ScanContext fields and check each item in the area's checklist.
Produce findings for any issues detected. Aim for 3-8 total findings. Do not exceed 20.

### Step 3: Store Findings

Format all findings as a JSON array and pipe to store-findings:

\`\`\`bash
echo '<json_array>' | npx harness-evolve store-findings
\`\`\`

Check the output for \`stored\` and \`skipped\` counts. If \`skipped > 0\`, review which findings failed validation.

### Step 4: Present Results

Show a human-readable summary. Start with:

> Analyzed **N** areas, found **M** finding(s).

Group by severity (problems first, then suggestions). For each finding show title, description, and suggested action.
End with:

> Run \`/evolve:apply\` to review and apply fixes.

## Analysis Guidance

### Area 1: Redundancy
**pattern_type:** \`scan_redundancy\` | **Default target:** \`RULE\`

#### What to Check
- Same constraint in CLAUDE.md AND .claude/rules/ (duplication across files)
- Same setting in user AND project settings.json (scope duplication)
- Rule file repeating CLAUDE.md content verbatim

#### Severity Rules
- **problem** if contradictory duplicates (different values for same setting)
- **suggestion** if benign duplicates (same intent, different wording)

#### Confidence
- **HIGH** if exact text match across files
- **MEDIUM** if same intent, different wording
- **LOW** if related but not clearly duplicate

#### Do NOT Flag
- Intentional overrides (project settings overriding user settings)
- CLAUDE.md referencing a rule file (cross-referencing, not duplication)

---

### Area 2: Missing Mechanization
**pattern_type:** \`scan_missing_mechanization\` | **Default target:** \`HOOK\`

#### What to Check
- Natural language instructions in CLAUDE.md or rules describing hookable operations (e.g., "always run tests before commit", "never push to main")
- Validation steps described as "Claude should check" that could be automated as hooks

#### Severity Rules
- **problem** if the operation is critical (data loss prevention, security enforcement)
- **suggestion** if the operation is a workflow optimization

#### Confidence
- **HIGH** if instruction uses imperative language ("must", "always", "never") and describes a hookable lifecycle event
- **MEDIUM** if the instruction is a strong preference
- **LOW** if it is a guideline or best practice

#### Do NOT Flag
- Subjective guidance ("prefer X over Y")
- Patterns already covered by existing hooks (check \`hooks_registered\` in ScanContext)
- Complex multi-step workflows better suited for skills than hooks

---

### Area 3: Stale References
**pattern_type:** \`scan_stale_reference\` | **Default target:** \`CLAUDE_MD\`

#### What to Check
- @path references in CLAUDE.md pointing to non-existent files
- Rule files referencing paths that do not exist in the project
- Mentions of tools or commands that are not installed or recognized

#### Severity Rules
- **problem** if the reference is in an instruction users actively follow
- **suggestion** if the reference is in a comment or secondary section

#### Confidence
- **HIGH** if the referenced path is clearly non-existent in the scan context
- **MEDIUM** if the path might exist outside the scanned scope

#### Do NOT Flag
- npm scoped packages (\`@scope/package\`) -- these are package names, not file references
- URL user paths (\`@user/path\`) -- these are URL patterns, not file references
- References to external tools that might be globally installed

---

### Area 4: Conflicts
**pattern_type:** \`scan_rule_conflict\` | **Default target:** \`RULE\`

#### What to Check
- Contradictory directives (e.g., "use ESM" in one file and "use CommonJS" in another)
- Conflicting settings between user and project scope without intentional override
- Rules that negate each other

#### Severity Rules
- **problem** if the conflict causes broken behavior (cannot satisfy both directives)
- **suggestion** if the conflict causes confusion but not breakage

#### Confidence
- **HIGH** if the contradiction is explicit (opposing values for same setting)
- **MEDIUM** if the contradiction is semantic (different wording, conflicting intent)
- **LOW** if potentially intentional tension between scopes

#### Do NOT Flag
- Intentional scope overrides (project overrides user is valid)
- Complementary rules that appear contradictory but cover different scopes

---

### Area 5: Structure Issues
**pattern_type:** \`scan_structure_issue\` | **Default target:** \`RULE\`

#### What to Check
- Empty rule files (0 bytes or only whitespace)
- Oversized rule files (>200 lines -- may need splitting)
- Rule files without headings (poor organization)
- Rules in subdirectories without path-scoping frontmatter
- CLAUDE.md exceeding 500 lines

#### Severity Rules
- **problem** if empty rule file (provides no value, adds noise)
- **suggestion** for oversized files or poor organization

#### Confidence
- **HIGH** if file is empty or missing content entirely
- **MEDIUM** if file is oversized
- **LOW** if organization could be improved

#### Do NOT Flag
- Small rule files (<10 lines) that are focused and complete
- CLAUDE.md files under 200 lines
- Subdirectory rules that are intentionally broad

---

### Area 6: Hooks Quality
**pattern_type:** \`scan_hooks_redundancy\` | **Default target:** \`SETTINGS\`

#### What to Check
- Duplicate hooks (same event + same command registered twice)
- Overlapping hooks (different commands doing the same check on the same event)
- Hooks registered in settings but pointing to non-existent scripts
- Hooks without error handling (missing \`|| true\` for non-critical hooks)

#### Severity Rules
- **problem** if hook script does not exist (will fail at runtime)
- **problem** if exact duplicate (wastes execution time)
- **suggestion** if hooks overlap in function

#### Confidence
- **HIGH** if script path is clearly non-existent
- **HIGH** if exact command match (duplicate)
- **MEDIUM** if commands appear to overlap in purpose

#### Do NOT Flag
- Multiple hooks on the same event doing different things (valid composition)
- harness-evolve's own hooks (managed by the tool itself)

---

### Area 7: Commands Quality
**pattern_type:** \`scan_command_convention\` | **Default target:** \`SKILL\`

#### What to Check
- Command files missing YAML frontmatter (name, description)
- Empty command files (non-functional)
- Commands without \`description\` field (poor discoverability)
- Commands with overly generic names
- Commands referencing non-existent tools or paths

#### Severity Rules
- **problem** if command file is empty (non-functional)
- **suggestion** for missing frontmatter or poor naming

#### Confidence
- **HIGH** if file is empty
- **MEDIUM** if frontmatter is missing
- **LOW** if naming could be improved

#### Do NOT Flag
- Commands that intentionally skip frontmatter for specific technical reasons
- Short commands (<5 lines) that are clear without description

## Severity Classification

| Condition | severity | confidence |
|-----------|----------|------------|
| Config is broken or contradictory | problem | HIGH |
| Config works but has redundancy or duplication | suggestion | MEDIUM |
| Config could benefit from mechanization | suggestion | MEDIUM |
| Style or convention improvement | suggestion | LOW |
| Referenced file does not exist | problem | HIGH |
| Referenced file might not exist | suggestion | MEDIUM |

> When in doubt, prefer \`suggestion\` over \`problem\`, and \`MEDIUM\` over \`HIGH\`. Conservative classification reduces false positives.

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
  "description": "The instruction 'always use TypeScript strict mode' appears in both CLAUDE.md (line 12) and .claude/rules/coding.md (line 5). This creates maintenance burden -- update one and the other becomes stale.",
  "evidence": {
    "count": 1,
    "examples": ["CLAUDE.md line 12: 'Use TypeScript strict mode'", "rules/coding.md line 5: 'Always enable strict mode in TypeScript'"]
  },
  "suggested_action": "Remove the constraint from CLAUDE.md and keep it in .claude/rules/coding.md where it is more specific and maintainable.",
  "severity": "suggestion"
}
\`\`\`

**Valid values:**
- \`pattern_type\`: scan_redundancy, scan_missing_mechanization, scan_stale_reference, scan_rule_conflict, scan_structure_issue, scan_hooks_redundancy, scan_command_convention
- \`target\`: HOOK, SKILL, RULE, CLAUDE_MD, MEMORY, SETTINGS
- \`confidence\`: HIGH, MEDIUM, LOW
- \`severity\`: problem, suggestion
- \`evidence.examples\`: maximum 3 strings
- \`id\` format: \`scan-{area}-{short-hash}\` (e.g., scan-redundancy-a1b2c3)

## Boundary Conditions (What NOT to Flag)

Global exclusions that apply across all analysis areas:

- npm scoped packages (\`@scope/package\`) are NOT stale references
- URL user paths (\`/@user/path\`) are NOT stale references
- Empty \`.claude/\` directory is normal for new projects
- Global-only configuration (no project-level config) is a valid setup
- harness-evolve's own hooks are NOT redundant
- Intentional scope overrides (project overriding user) are NOT conflicts
- Do not produce more than 20 findings total
- Aim for 3-8 findings on a typical config. Zero findings is valid for clean configs.

## Error Handling

### scan-context Command Fails

If \`npx harness-evolve scan-context\` exits with a non-zero code:

1. Show the error message to the user
2. Suggest: "Try running \`harness-evolve status\` to check installation health"
3. If the error mentions "not found", suggest: "Run \`harness-evolve init\` to set up"

### store-findings Reports Skipped Findings

If the store-findings output shows \`skipped > 0\`:

1. Show which findings failed validation
2. Check the \`errors\` array in the output for field-level issues
3. Fix the invalid fields and re-pipe the corrected findings

### Empty or Minimal Context

If scan-context returns empty arrays for all fields (no config files found):

- Report: "No configuration files found. This project has no Claude Code configuration yet."
- Suggest: "Run \`harness-evolve init\` to set up initial configuration."

## Edge Cases

- **No \`.claude/\` directory:** Report minimal findings. This is normal for new projects or projects that rely on global configuration only.
- **Very large configs (50+ rules files):** Focus on highest-severity findings. Stay within 20 findings maximum.
- **No internet required:** The scan runs entirely locally. No network access is needed.

## Notes

- Findings stored via store-findings are available in \`/evolve:apply\`.
- Re-running scan replaces previous scan results.
- Each analysis area maps to a \`pattern_type\` value for routing and tracking.
`;
}
