# Model Validation Test Config Fixtures

These fixtures are used for manual validation of MODEL-01 through MODEL-04
requirements. Each directory is a self-contained fake Claude Code project
configuration designed to test a specific model capability that old regex-based
scanners cannot detect.

## Fixtures

### semantic-conflict/ (MODEL-01)

**Tests:** Semantic-level config conflict detection.

The CLAUDE.md declares "ES modules exclusively" while a rule file configures
"module: commonjs". The old `conflict.ts` scanner checks 3 opposition pairs
(always/never, enable/disable, require/forbid) -- none of which appear here.
Only a model understands the semantic contradiction between ESM and CommonJS.

### cross-file-inconsistency/ (MODEL-02)

**Tests:** Cross-file consistency evaluation.

A rule file requires "pytest" (Python) while a hook runs "npm test" (JavaScript).
No single old scanner correlates rules with hooks across different files. The
mechanization scanner would see the rule is already mechanized (hooks exist for
PreToolUse) and suppress the finding entirely.

### natural-language-hookable/ (MODEL-03)

**Tests:** Natural language hookable operation identification.

The CLAUDE.md describes three hookable operations using varied phrasing:
- "must be verified automatically before any file is saved"
- "enforced on every push"
- "should never be skipped during development"

The old `mechanization.ts` uses 6 regex patterns: `always run`, `before committing`,
`before saving`, `after every edit`, `must always`, `automatically run`. None of
these phrasings match those patterns.

### guidance-extensibility/ (MODEL-04)

**Tests:** Guidance extensibility without code changes.

A minimal project with no README.md at the project root. After adding an
"Area 8: Documentation Coverage" section to the scanner guidance doc, the model
should flag the missing README.md. No TypeScript code changes needed to add
this new scan area.

## Usage

1. Copy a fixture directory to a temporary location
2. Run `harness-evolve scan-context` from that directory (or use `buildScanContext` programmatically)
3. Feed the scan context output to `/evolve:scan` in a live Claude Code session
4. Verify the model produces the expected finding type for the specific MODEL-* requirement

## Design Principles

- Each fixture is minimal -- just enough config to trigger the specific capability
- No extraneous content that might confuse the test
- Fixtures deliberately avoid triggering old regex-based scanners
- Each fixture exercises exactly one MODEL-* requirement
