# TODOs

Items discovered during development — candidates for future phases.

## From Phase 19.1 Manual Testing (2026-04-06)

- [ ] **OBS-1**: Scan output should default to English regardless of session language
- [ ] **OBS-2**: Apply command should use interactive numbered options (like GSD) instead of free-form text — user selects from: Claude recommended, alternative, let Claude decide, collect info then submit
- [ ] **OBS-3**: Scan output should show "areas scanned" summary (e.g., "7 scanners checked, N issues in M areas") not just issues found
- [x] **OBS-4**: Add E2E dirty-config integration test — create intentionally broken Claude Code config and verify scan detects issues from all 7 scanners

## From Phase 20 Human Verification (2026-04-06)

- [ ] **BUG-01**: Hooks scanner reads nested Claude Code hooks structure as empty. `extractHooksFromAllSettings` (context-builder.ts:266-298) assumes flat `{type, command}` array elements, but real Claude Code format is `{matcher, hooks: [{type, command}]}`. Causes 21 false positives (empty command + duplicate registration) on real user configs.
- [ ] **ARCH-01**: Replace hardcoded scanner functions with Claude-driven analysis. Current 7 scanners use regex/string matching — fragile against format changes (BUG-01 proves this) and semantically blind (can't detect "use ESM" vs "use CommonJS" conflicts). `/evolve:scan` should feed config files to Claude for intelligent analysis with detailed guidance documents, not run pure code detectors.
- [ ] **ARCH-02**: Create scanner guidance documentation for Claude-driven analysis. When scanners are model-driven, need structured docs that define: what to look for, severity classification rules, output format spec, and edge case handling — so Claude produces consistent, actionable scan results.
