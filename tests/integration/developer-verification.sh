#!/usr/bin/env bash
# Developer verification script for harness-evolve CLI lifecycle.
# Tests all 7 CLI subcommands against real file system state.
# Uses python3 for JSON parsing (no jq dependency).
#
# Usage: bash tests/integration/developer-verification.sh

set -uo pipefail

# Configuration
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CLI="node ${PROJECT_DIR}/dist/cli.js"
SETTINGS="$HOME/.claude/settings.json"
COMMANDS_DIR="$HOME/.claude/commands/evolve"
DATA_DIR="$HOME/.harness-evolve"
PASS=0
FAIL=0
TESTS_RUN=0

# Helper functions
pass() {
  echo "  PASS: $1"
  ((PASS++))
  ((TESTS_RUN++))
}

fail() {
  echo "  FAIL: $1 -- $2"
  ((FAIL++))
  ((TESTS_RUN++))
}

# Count harness-evolve hooks in settings.json using python3
count_hooks() {
  python3 -c "
import json, sys
try:
    with open('${SETTINGS}') as f:
        d = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    print(0)
    sys.exit(0)
hooks = d.get('hooks', {})
count = 0
for event, entries in hooks.items():
    if isinstance(entries, list):
        for entry in entries:
            for h in entry.get('hooks', []):
                if 'harness-evolve' in h.get('command', ''):
                    count += 1
print(count)
"
}

# Check if harness-evolve hooks exist in settings.json
has_hooks() {
  local count
  count=$(count_hooks)
  [ "$count" -gt 0 ]
}

echo ""
echo "============================================="
echo "  harness-evolve Developer Verification"
echo "============================================="
echo ""
echo "CLI binary: $CLI"
echo "Settings:   $SETTINGS"
echo "Commands:   $COMMANDS_DIR"
echo "Data dir:   $DATA_DIR"
echo ""

# ====================================================
# Wave 0: Clean State Setup
# ====================================================
echo "=== Wave 0: Clean State Setup ==="
echo ""

# Backup existing settings.json (critical -- restore at end)
if [ -f "$SETTINGS" ]; then
  cp "$SETTINGS" "$SETTINGS.test-backup"
  echo "  Backed up settings.json to settings.json.test-backup"
else
  echo "  No existing settings.json to backup"
fi

# Full uninstall + purge to reach clean state (per D-04)
$CLI uninstall --purge --yes >/dev/null 2>&1 || true

# TEST-00a: No harness-evolve hooks in settings.json
if ! has_hooks; then
  pass "TEST-00a: No harness-evolve hooks in settings.json (clean state)"
else
  fail "TEST-00a: No harness-evolve hooks in settings.json" "hooks still present"
fi

# TEST-00b: No slash commands directory
if [ ! -f "$COMMANDS_DIR/scan.md" ] && [ ! -f "$COMMANDS_DIR/apply.md" ]; then
  pass "TEST-00b: No slash commands at $COMMANDS_DIR (clean state)"
else
  fail "TEST-00b: No slash commands" "files still exist"
fi

# TEST-00c: No data directory (after purge)
if [ ! -d "$DATA_DIR" ]; then
  pass "TEST-00c: No data directory at $DATA_DIR (clean state)"
else
  fail "TEST-00c: No data directory" "$DATA_DIR still exists"
fi

echo ""

# ====================================================
# Wave 1: Init & Installation
# ====================================================
echo "=== Wave 1: Init & Installation ==="
echo ""

# TEST-01: init --yes exits 0
if $CLI init --yes >/dev/null 2>&1; then
  pass "TEST-01: init --yes exits 0"
else
  fail "TEST-01: init --yes exits 0" "exit code was non-zero"
fi

# TEST-02: 6 hook events registered in settings.json
HOOK_COUNT=$(count_hooks)
if [ "$HOOK_COUNT" -eq 6 ]; then
  pass "TEST-02: 6 hooks registered in settings.json (got $HOOK_COUNT)"
else
  fail "TEST-02: 6 hooks registered" "got $HOOK_COUNT instead of 6"
fi

# TEST-03: scan.md exists
if [ -f "$COMMANDS_DIR/scan.md" ]; then
  pass "TEST-03: scan.md installed at $COMMANDS_DIR/scan.md"
else
  fail "TEST-03: scan.md installed" "file not found"
fi

# TEST-04: apply.md exists
if [ -f "$COMMANDS_DIR/apply.md" ]; then
  pass "TEST-04: apply.md installed at $COMMANDS_DIR/apply.md"
else
  fail "TEST-04: apply.md installed" "file not found"
fi

# TEST-05: scan.md contains template-version: 2
if grep -q 'template-version: 2' "$COMMANDS_DIR/scan.md" 2>/dev/null; then
  pass "TEST-05: scan.md contains template-version: 2"
else
  fail "TEST-05: scan.md template-version" "version comment not found"
fi

# TEST-06: apply.md contains template-version: 2
if grep -q 'template-version: 2' "$COMMANDS_DIR/apply.md" 2>/dev/null; then
  pass "TEST-06: apply.md contains template-version: 2"
else
  fail "TEST-06: apply.md template-version" "version comment not found"
fi

# TEST-07: settings.json.backup was created
if [ -f "$SETTINGS.backup" ]; then
  pass "TEST-07: settings.json.backup created by init"
else
  fail "TEST-07: settings.json.backup" "backup file not found"
fi

echo ""

# ====================================================
# Wave 2: CLI Subcommands
# ====================================================
echo "=== Wave 2: CLI Subcommands ==="
echo ""

# TEST-08: status command exits 0
if $CLI status >/dev/null 2>&1; then
  pass "TEST-08: status command exits 0"
else
  fail "TEST-08: status command exits 0" "exit code was non-zero"
fi

# TEST-09: scan produces valid JSON
SCAN_OUTPUT=$($CLI scan 2>/dev/null) || true
SCAN_VALID=$(echo "$SCAN_OUTPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print('VALID')
except:
    print('INVALID')
" 2>/dev/null)
if [ "$SCAN_VALID" = "VALID" ]; then
  pass "TEST-09: scan produces valid JSON"
else
  fail "TEST-09: scan produces valid JSON" "output was not valid JSON"
fi

# TEST-10: scan JSON has required keys
SCAN_KEYS=$(echo "$SCAN_OUTPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    required = ['generated_at', 'recommendation_count', 'problems', 'suggestions', 'recommendations']
    missing = [k for k in required if k not in d]
    if missing:
        print(f'MISSING:{missing}')
    else:
        print('ALL_KEYS_PRESENT')
except Exception as e:
    print(f'ERROR:{e}')
" 2>/dev/null)
if [ "$SCAN_KEYS" = "ALL_KEYS_PRESENT" ]; then
  pass "TEST-10: scan JSON has all required keys (generated_at, recommendation_count, problems, suggestions, recommendations)"
else
  fail "TEST-10: scan JSON required keys" "$SCAN_KEYS"
fi

# TEST-11: pending produces valid JSON with "pending" key
PENDING_OUTPUT=$($CLI pending 2>/dev/null) || true
PENDING_CHECK=$(echo "$PENDING_OUTPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if 'pending' in d:
        print('HAS_PENDING')
    else:
        print('MISSING_PENDING_KEY')
except Exception as e:
    print(f'ERROR:{e}')
" 2>/dev/null)
if [ "$PENDING_CHECK" = "HAS_PENDING" ]; then
  pass "TEST-11: pending produces valid JSON with 'pending' key"
else
  fail "TEST-11: pending JSON" "$PENDING_CHECK"
fi

# TEST-12: apply-one with nonexistent ID exits non-zero
if $CLI apply-one nonexistent-id-12345 >/dev/null 2>&1; then
  fail "TEST-12: apply-one nonexistent ID exits non-zero" "exit code was 0 (expected non-zero)"
else
  pass "TEST-12: apply-one nonexistent ID exits non-zero (exit code 1)"
fi

# TEST-13: apply-one error output contains success:false
APPLY_OUTPUT=$($CLI apply-one nonexistent-id-12345 2>/dev/null) || true
APPLY_CHECK=$(echo "$APPLY_OUTPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if d.get('success') == False:
        print('SUCCESS_FALSE')
    else:
        print(f'UNEXPECTED:{d}')
except Exception as e:
    print(f'ERROR:{e}')
" 2>/dev/null)
if [ "$APPLY_CHECK" = "SUCCESS_FALSE" ]; then
  pass "TEST-13: apply-one error output has success:false"
else
  fail "TEST-13: apply-one error output" "$APPLY_CHECK"
fi

# TEST-14: dismiss with nonexistent ID exits 0 (creates new state entry)
# Note: dismiss does NOT validate existence -- it always sets status to dismissed
if $CLI dismiss nonexistent-dismiss-test >/dev/null 2>&1; then
  pass "TEST-14: dismiss nonexistent ID exits 0 (creates state entry)"
else
  fail "TEST-14: dismiss nonexistent ID" "exit code was non-zero (expected 0)"
fi

# TEST-15: dismiss output contains correct status
DISMISS_OUTPUT=$($CLI dismiss nonexistent-dismiss-test-2 2>/dev/null) || true
DISMISS_CHECK=$(echo "$DISMISS_OUTPUT" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if d.get('status') == 'dismissed':
        print('STATUS_DISMISSED')
    else:
        print(f'UNEXPECTED:{d}')
except Exception as e:
    print(f'ERROR:{e}')
" 2>/dev/null)
if [ "$DISMISS_CHECK" = "STATUS_DISMISSED" ]; then
  pass "TEST-15: dismiss output has status:dismissed"
else
  fail "TEST-15: dismiss output" "$DISMISS_CHECK"
fi

echo ""

# ====================================================
# Wave 3: Version-Aware Re-init
# ====================================================
echo "=== Wave 3: Version-Aware Re-init ==="
echo ""

# TEST-16: Downgrade scan.md template-version to 1
if [ -f "$COMMANDS_DIR/scan.md" ]; then
  sed -i '' 's/template-version: 2/template-version: 1/' "$COMMANDS_DIR/scan.md" 2>/dev/null
  if grep -q 'template-version: 1' "$COMMANDS_DIR/scan.md" 2>/dev/null; then
    pass "TEST-16: Downgraded scan.md template-version to 1"
  else
    fail "TEST-16: Downgrade scan.md" "sed replacement did not take effect"
  fi
else
  fail "TEST-16: Downgrade scan.md" "scan.md not found"
fi

# TEST-17: Re-run init --yes, verify scan.md updated back to version 2
$CLI init --yes >/dev/null 2>&1
if grep -q 'template-version: 2' "$COMMANDS_DIR/scan.md" 2>/dev/null; then
  pass "TEST-17: Re-init updated scan.md back to template-version: 2"
else
  fail "TEST-17: Version-aware re-init" "scan.md still at old version"
fi

# TEST-18: Hooks still registered (not duplicated -- still 6 total)
HOOK_COUNT_AFTER=$(count_hooks)
if [ "$HOOK_COUNT_AFTER" -eq 6 ]; then
  pass "TEST-18: Hooks not duplicated after re-init (still $HOOK_COUNT_AFTER)"
else
  fail "TEST-18: Hook deduplication" "expected 6 hooks, got $HOOK_COUNT_AFTER"
fi

echo ""

# ====================================================
# Wave 4: Uninstall & Teardown
# ====================================================
echo "=== Wave 4: Uninstall & Teardown ==="
echo ""

# TEST-19: uninstall --yes exits 0
if $CLI uninstall --yes >/dev/null 2>&1; then
  pass "TEST-19: uninstall --yes exits 0"
else
  fail "TEST-19: uninstall --yes" "exit code was non-zero"
fi

# TEST-20: No harness-evolve hooks in settings.json after uninstall
if ! has_hooks; then
  pass "TEST-20: No harness-evolve hooks in settings.json after uninstall"
else
  fail "TEST-20: Hooks removed" "hooks still present in settings.json"
fi

# TEST-21: scan.md removed
if [ ! -f "$COMMANDS_DIR/scan.md" ]; then
  pass "TEST-21: scan.md removed from $COMMANDS_DIR"
else
  fail "TEST-21: scan.md removal" "file still exists"
fi

# TEST-22: apply.md removed
if [ ! -f "$COMMANDS_DIR/apply.md" ]; then
  pass "TEST-22: apply.md removed from $COMMANDS_DIR"
else
  fail "TEST-22: apply.md removal" "file still exists"
fi

# Re-init for purge test
$CLI init --yes >/dev/null 2>&1

# TEST-23: uninstall --purge --yes exits 0
if $CLI uninstall --purge --yes >/dev/null 2>&1; then
  pass "TEST-23: uninstall --purge --yes exits 0"
else
  fail "TEST-23: uninstall --purge --yes" "exit code was non-zero"
fi

# TEST-24: ~/.harness-evolve/ directory does not exist
if [ ! -d "$DATA_DIR" ]; then
  pass "TEST-24: $DATA_DIR directory removed after purge"
else
  fail "TEST-24: Data directory purge" "$DATA_DIR still exists"
fi

echo ""

# ====================================================
# Restore & Summary
# ====================================================

# Restore original settings backup
if [ -f "$SETTINGS.test-backup" ]; then
  cp "$SETTINGS.test-backup" "$SETTINGS"
  rm -f "$SETTINGS.test-backup"
  echo "  Restored original settings.json from test-backup"
fi

# Clean up any leftover backup files from init/uninstall
rm -f "$SETTINGS.backup"

echo ""
echo "============================================="
echo "  RESULTS"
echo "============================================="
echo "PASSED: $PASS"
echo "FAILED: $FAIL"
echo "TOTAL:  $TESTS_RUN"
echo "============================================="
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
