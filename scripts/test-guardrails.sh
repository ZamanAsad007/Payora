#!/usr/bin/env bash
set -euo pipefail

echo "==> Testing pre-commit security guardrail..."

# Test 1: Staging a forbidden filename (.env)
echo "Testing filename blocking (.env.test)..."
touch .env.test
git add -f .env.test 2>/dev/null || git add .env.test
if .githooks/pre-commit 2>/dev/null; then
  echo "FAIL: .env.test was NOT blocked!"
  git rm -f --cached .env.test 2>/dev/null || rm -f .env.test
  exit 1
else
  echo "PASS: .env.test correctly blocked by hook."
  git rm -f --cached .env.test 2>/dev/null || true
  rm -f .env.test
fi

# Test 2: Gitleaks content scan on staged secret
# The dummy test token is generated at runtime so it's not checked in as a static string
echo "Testing secret content detection..."
printf '%s%s\n' "ghp_" "123456789012345678901234567890123456" > test_secret.txt
git add test_secret.txt
if .githooks/pre-commit 2>/dev/null; then
  echo "FAIL: Staged fake secret was NOT blocked!"
  git rm -f --cached test_secret.txt 2>/dev/null || rm -f test_secret.txt
  exit 1
else
  echo "PASS: Fake secret detected and blocked by gitleaks hook."
  git rm -f --cached test_secret.txt 2>/dev/null || true
  rm -f test_secret.txt
fi

echo "==> All guardrail tests passed successfully!"
