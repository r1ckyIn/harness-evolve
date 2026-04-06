---
status: complete
phase: 20-scanner-ux-coverage-polish
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md]
started: 2026-04-06T08:00:00.000Z
updated: 2026-04-06T08:10:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Scan template contains English-language instruction
expected: The generated scan command template includes "Always present scan results in English" in the Output Format section. Template version is 3.
result: pass
evidence: src/commands/evolve-scan.ts:92 contains "Always present scan results in English", SCAN_TEMPLATE_VERSION = '3'

### 2. Apply template has numbered interactive options
expected: The generated apply command template presents 4 numbered options (1. Apply, 2. Skip, 3. Dismiss, 4. Let Claude decide) instead of the old "Choose: [Apply] [Skip] [Dismiss]" format. Template version is 3.
result: pass
evidence: src/commands/evolve-apply.ts contains "Let Claude decide" at lines 99, 118, 141; numbered options 1-4 present; old format removed; APPLY_TEMPLATE_VERSION = '3'

### 3. CLI scan JSON output includes scanner_summary
expected: Running `harness-evolve scan` produces JSON output with a `scanner_summary` field containing `total_scanners` (number), `scanners_with_findings` (number), `areas_scanned` (string array), and `areas_with_findings` (string array).
result: pass
evidence: src/cli/scan.ts:39 contains scanner_summary object with all 4 fields derived from result.scanner_meta

### 4. runDeepScan returns scanner_meta
expected: The `runDeepScan()` function returns a `ScanResult` object with a `scanner_meta` array. Each entry has `name` (string) and `finding_count` (number). Array length matches the number of registered scanners (7).
result: pass
evidence: src/scan/index.ts:20 declares scanner_meta in ScanResult, line 59 returns scannerMeta built from indexed loop over scanners/scannerNames

### 5. E2E dirty-config test covers all 7 scanners
expected: Running `npx vitest run tests/integration/dirty-config-e2e.test.ts` passes. The test creates intentionally broken config and verifies exactly 7 unique pattern_type values are detected.
result: pass
evidence: 63 test files, 722 tests all pass (verified via full suite run)

### 6. Full test suite passes with no regressions
expected: Running `npx vitest run` completes with all 722 tests passing and zero failures.
result: pass
evidence: "Test Files 63 passed (63), Tests 722 passed (722)" — zero failures

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
