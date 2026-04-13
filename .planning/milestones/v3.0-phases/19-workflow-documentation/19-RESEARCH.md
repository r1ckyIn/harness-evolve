# Phase 19: Workflow Documentation - Research

**Researched:** 2026-04-05
**Domain:** Claude Code slash commands / skills system, workflow documentation design
**Confidence:** HIGH

## Summary

Phase 19 requires upgrading the existing `/evolve:scan` and `/evolve:apply` slash command `.md` files from basic instructions to comprehensive workflow documents that fully specify Claude's behavior. The key insight is that **the `.md` file IS the slash command** — its entire markdown body becomes Claude's context when invoked. There is no separate "workflow doc" to create; the TS template generators (`evolve-scan.ts` and `evolve-apply.ts`) must be enhanced to produce richer, more prescriptive content that eliminates behavioral ambiguity.

A critical discovery: the `installSlashCommands()` function in `init.ts` has a **create-only guard** — it skips files that already exist. This means users who ran `init` before Phase 18 still have outdated `.md` files with confidence-based grouping instead of severity-based grouping. Phase 19 must address this staleness problem by either (a) adding an update/force-overwrite mechanism, or (b) versioning the templates and updating on version mismatch.

The official Claude Code skills documentation (fetched from code.claude.com) confirms all frontmatter options available and how the system works. The `.md` body is injected as Claude's prompt context — no CLAUDE.md preloading is needed (satisfying WFL-02 by design). The existing `disable-model-invocation: true` setting is correct for task-type commands.

**Primary recommendation:** Rewrite the two TS template generators to produce comprehensive workflow `.md` content with error handling, edge cases, output formatting rules, and behavioral constraints. Add a version-aware update mechanism to `installSlashCommands()` so template updates propagate to installed files.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WFL-01 | Each slash command has a workflow .md document that fully defines Claude's behavior flow, solving context pollution | The `.md` file IS the command — enhancing the TS template generator output directly satisfies this. Current templates are ~75 lines; GSD-quality workflow docs are 50-150+ lines with structured sections, error handling, and behavioral constraints. |
| WFL-02 | Workflow documentation is injected via slash command template, not via CLAUDE.md preloading | Already satisfied by architecture — the `.md` body IS the context injected when the command is invoked. No CLAUDE.md rules needed. The `disable-model-invocation: true` frontmatter ensures it only loads when user invokes it. Phase 19 just needs to make the content comprehensive enough to be self-contained. |
</phase_requirements>

## Standard Stack

### Core (No new dependencies needed)

This phase is a content-only change to existing TypeScript template generators. No new libraries required.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 4.1.2 | Test framework for template generators | Already in use, 18 passing tests in templates.test.ts |
| TypeScript | ~6.0 | Type safety | Already in project |

## Architecture Patterns

### Current Architecture

```
src/commands/
├── evolve-scan.ts       # generateScanCommand() -> returns string (the .md content)
└── evolve-apply.ts      # generateApplyCommand() -> returns string (the .md content)

src/cli/
├── init.ts              # installSlashCommands() writes .md files to ~/.claude/commands/evolve/
└── uninstall.ts         # removeSlashCommands() cleans up .md files

tests/unit/commands/
└── templates.test.ts    # 18 tests validating template structure

Installed files (user's machine):
~/.claude/commands/evolve/
├── scan.md              # Installed by init, currently OUT OF SYNC with TS template
└── apply.md             # Installed by init, currently in sync
```

### Pattern 1: Slash Command as Workflow Document

**What:** The `.md` file that defines a slash command IS the workflow document. Its YAML frontmatter configures Claude Code behavior, and its markdown body becomes Claude's context.

**When to use:** Always — this is how Claude Code commands work.

**Key frontmatter fields (verified from official docs):**

```yaml
---
name: scan                          # Becomes /evolve:scan
description: Short description      # Shown in / menu
disable-model-invocation: true      # Only user can invoke (not Claude auto-loading)
argument-hint: "[optional args]"    # Shown during autocomplete
allowed-tools: Read Bash Grep       # Tools Claude can use without asking permission
effort: high                        # Override effort level (low/medium/high/max)
---
```

**Available string substitutions:**
- `$ARGUMENTS` — All arguments passed when invoking
- `$ARGUMENTS[N]` or `$N` — Access specific argument by index
- `${CLAUDE_SESSION_ID}` — Current session ID
- `${CLAUDE_SKILL_DIR}` — Directory containing the skill file
- `` !`command` `` — Shell command preprocessing (runs before Claude sees content)

### Pattern 2: Template Generator with Version Tracking

**What:** TS functions generate the `.md` content, with a version constant embedded in frontmatter or as a comment. The installer compares versions to decide whether to overwrite.

**When to use:** When template content evolves across releases and installed files must stay current.

**Example:**

```typescript
// In evolve-scan.ts
const TEMPLATE_VERSION = '2';  // Bump when content changes

export function generateScanCommand(): string {
  return `---
name: scan
description: ...
disable-model-invocation: true
---
<!-- template-version: ${TEMPLATE_VERSION} -->

# Evolve Scan
...`;
}

export function getScanTemplateVersion(): string {
  return TEMPLATE_VERSION;
}
```

```typescript
// In init.ts - installSlashCommands()
// Read existing file, extract version, compare, overwrite if stale
```

### Pattern 3: Self-Contained Workflow Document Structure

**What:** A workflow `.md` that fully specifies Claude's behavior without depending on external context (CLAUDE.md, rules, etc.).

**When to use:** For commands that must produce consistent behavior regardless of what project they're invoked in.

**Structure (derived from GSD command patterns):**

```markdown
---
name: command-name
description: One-line purpose
disable-model-invocation: true
argument-hint: "[args]"
---

# Command Title

One-line purpose statement.

## Context
What this command does and why. Sets expectations.

## Prerequisites
What must be true before running (e.g., harness-evolve must be installed).

## Instructions

### Step 1: [Action]
Exact commands to run with expected outputs.

### Step 2: [Action]
...

## Output Format
Exactly how to present results to the user.

## Error Handling
What to do when things go wrong.

## Edge Cases
Specific situations and how to handle them.

## Notes
Additional context, cross-references to other commands.
```

### Anti-Patterns to Avoid

- **Vague instructions:** "Present results nicely" — Claude interprets this differently each time. Be specific: "Present in a markdown table with columns: Severity, Description, File, Fix"
- **Missing error handling:** If `npx harness-evolve scan` fails, what should Claude do? The current templates don't say.
- **Assuming Claude remembers context:** Each command invocation starts fresh. Don't reference "previous scan results" without telling Claude how to find them.
- **Overloading CLAUDE.md:** WFL-02 explicitly requires the workflow to be self-contained in the `.md` file, NOT in CLAUDE.md preloading.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Template versioning | Custom checksum-based diffing | Simple version constant in template + compare | Checksums break on whitespace changes; explicit version is clearer |
| Frontmatter parsing | Regex extraction of YAML | Read file, split on `---`, check version comment | YAML frontmatter is a well-known format; keep it simple |
| Command discovery | Scanning filesystem for installed commands | Hardcoded list of known commands (scan, apply) | Only 2 commands; discovery is over-engineering |

## Common Pitfalls

### Pitfall 1: Create-Only Guard Prevents Updates

**What goes wrong:** Users who ran `harness-evolve init` before Phase 19 have stale `.md` files. The current `installSlashCommands()` skips existing files.
**Why it happens:** Line 57-58 in `init.ts`: `if (await fileExists(cmd.path)) { skip }` — a deliberate safety measure to avoid overwriting user customizations.
**How to avoid:** Add version tracking. Compare installed version vs template version. Overwrite only when template is newer. Optionally log what changed.
**Warning signs:** User runs `/evolve:scan` and sees confidence-based grouping instead of severity-based grouping (Phase 18 regression).

### Pitfall 2: Installed File Drift from Source Template

**What goes wrong:** The installed `~/.claude/commands/evolve/scan.md` is currently out of sync with `src/commands/evolve-scan.ts`. The installed file shows confidence grouping; the TS source shows severity grouping.
**Why it happens:** Phase 18 updated the TS template but the installed file was never regenerated (create-only guard).
**How to avoid:** This phase must fix the sync mechanism AND update the installed files.
**Warning signs:** Diff between `~/.claude/commands/evolve/scan.md` and `generateScanCommand()` output shows divergence.

### Pitfall 3: Inconsistent Claude Behavior Without Specificity

**What goes wrong:** Claude produces different output formats each time `/evolve:scan` is run because the instructions are too vague.
**Why it happens:** Current template says "present results grouped by..." but doesn't specify exact formatting (table vs list vs badges).
**How to avoid:** Provide exact output templates with markdown formatting examples. The GSD execute-phase command (60+ lines of structured process) is a good reference for specificity level.
**Warning signs:** Two consecutive `/evolve:scan` runs produce visually different reports for the same data.

### Pitfall 4: Missing Prerequisites Check

**What goes wrong:** User invokes `/evolve:scan` but harness-evolve is not installed (no `npx` available, or CLI not in PATH).
**Why it happens:** Current template jumps straight to `npx harness-evolve scan` without checking if the tool exists.
**How to avoid:** Add a prerequisite verification step that checks if the command exists before running it.
**Warning signs:** Cryptic error messages from shell when command not found.

### Pitfall 5: Uninstall Command Doesn't Clean Global Path

**What goes wrong:** `uninstall.ts` `removeSlashCommands()` uses `projectDir` (project-level path) but Phase 17 moved commands to global `~/.claude/commands/evolve/`. Global files are not cleaned up.
**Why it happens:** `removeSlashCommands()` was not updated when Phase 17 moved to global install.
**How to avoid:** Update `removeSlashCommands()` to also clean the global path (`~/.claude/commands/evolve/`). This is a pre-existing bug but directly relevant since Phase 19 will touch this code.
**Warning signs:** After `harness-evolve uninstall`, `/evolve:scan` still works because global files remain.

## Code Examples

### Current Template Generator (source of truth)

```typescript
// Source: src/commands/evolve-scan.ts
export function generateScanCommand(): string {
  return `---
name: scan
description: Run a deep harness-evolve configuration scan to detect quality issues
disable-model-invocation: true
---
// ... ~75 lines of markdown
`;
}
```

### Claude Code Frontmatter Reference (verified from official docs)

```yaml
# Source: https://code.claude.com/docs/en/skills
---
name: scan                          # Required for slash command name
description: What it does            # Recommended - shown in / menu
argument-hint: "[filter]"            # Optional - autocomplete hint
disable-model-invocation: true       # Prevent Claude auto-loading
allowed-tools: Bash Read             # Tools without permission prompts
effort: high                         # Override effort level
user-invocable: true                 # Show in / menu (default true)
---
```

### Example: Well-Structured Workflow Section

```markdown
## Error Handling

### CLI Command Fails
If `npx harness-evolve scan` exits with non-zero code or outputs JSON with an `error` field:
1. Show the error message to the user
2. Suggest: "Try running `harness-evolve status` to check installation"
3. If the error mentions "not found", suggest: "Run `harness-evolve init` to set up"

### No Results Found
If the scan returns zero recommendations:
- Congratulate the user: "Your configuration looks clean - no issues detected."
- Suggest proactive next steps: "You can also check `harness-evolve status` for overall health."

### JSON Parse Error
If the CLI output is not valid JSON:
1. Show raw output for debugging
2. Suggest: "This may be a version mismatch. Try `npx harness-evolve@latest scan`"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.claude/commands/` (project-level) | `.claude/skills/` (any level) + `.claude/commands/` (still works) | Claude Code skills system update | Commands merged into skills. Both paths work. Skills add supporting files, frontmatter control, auto-invocation. |
| Basic instructions in command `.md` | Comprehensive workflow with error handling, edge cases, output format | Best practice evolution | More consistent Claude behavior across invocations |
| No template versioning | Version-aware update on init | Needed for this phase | Prevents stale installed commands |

## Open Questions

1. **Should we use `allowed-tools` frontmatter?**
   - What we know: The frontmatter supports `allowed-tools` to grant tool access without prompts. `/evolve:scan` only needs `Bash` (to run CLI commands). `/evolve:apply` needs `Bash` (to run CLI commands).
   - What's unclear: Whether adding `allowed-tools: Bash` improves UX by avoiding permission prompts for `npx harness-evolve` commands.
   - Recommendation: Add `allowed-tools: Bash(npx harness-evolve *)` to both commands for smoother UX. This scopes permission to only harness-evolve CLI calls.

2. **Should the TS generators embed `` !`command` `` shell preprocessing?**
   - What we know: Claude Code supports `` !`command` `` syntax in skill/command `.md` to run shell commands and inject their output before Claude sees the content.
   - What's unclear: Whether preprocessing (e.g., `` !`npx harness-evolve scan` ``) would be better than instructing Claude to run the command.
   - Recommendation: Do NOT use preprocessing for the main scan/apply. The user should see Claude running the command (transparency). Preprocessing runs silently. However, a lightweight version check via preprocessing could be useful for prerequisites.

3. **Should we migrate from `.claude/commands/` to `.claude/skills/` format?**
   - What we know: Commands and skills are equivalent. Skills add directory support for files. The official docs say "Skills add optional features... Your existing `.claude/commands/` files keep working."
   - What's unclear: Whether migrating adds value for this use case.
   - Recommendation: Stay with `.claude/commands/evolve/` for now. We only have 2 single-file commands with no supporting files needed. Migration would require updating install/uninstall paths, which is churn with no user benefit.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run tests/unit/commands/templates.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WFL-01 | Scan command template contains comprehensive workflow sections (error handling, output format, edge cases) | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "workflow"` | Needs update (Wave 0) |
| WFL-01 | Apply command template contains comprehensive workflow sections | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "workflow"` | Needs update (Wave 0) |
| WFL-02 | Templates are self-contained (no references to CLAUDE.md preloading) | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "self-contained"` | Needs creation (Wave 0) |
| WFL-02 | Install function updates stale templates (version tracking) | unit | `npx vitest run tests/unit/commands/templates.test.ts -t "version"` | Needs creation (Wave 0) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit/commands/templates.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/commands/templates.test.ts` — extend with tests for: workflow section completeness (error handling, output format, edge cases, prerequisites), self-containment verification (no CLAUDE.md dependency), template version tracking
- [ ] No new test files needed — existing test file covers the right scope, just needs more assertions

## Sources

### Primary (HIGH confidence)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) — Complete frontmatter reference, string substitutions, skills vs commands, invocation control, shell preprocessing. Fetched 2026-04-05.
- Project source code: `src/commands/evolve-scan.ts`, `src/commands/evolve-apply.ts`, `src/cli/init.ts`, `tests/unit/commands/templates.test.ts` — Current implementation state.
- Installed commands: `~/.claude/commands/evolve/scan.md`, `~/.claude/commands/evolve/apply.md` — Confirmed out-of-sync with TS source.

### Secondary (MEDIUM confidence)
- [Claude Code Cheat Sheet](https://github.com/wilwaldon/claude-code-cheat-sheet) — Community reference for frontmatter options (cross-verified with official docs).
- GSD command examples: `~/.claude/commands/gsd/execute-phase.md` — Reference for comprehensive workflow document structure.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; pure content change to existing generators
- Architecture: HIGH - Verified from official Claude Code docs and existing codebase
- Pitfalls: HIGH - Confirmed by examining installed files vs source code (drift is real)

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable domain; Claude Code skills API is mature)
