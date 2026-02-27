#!/bin/bash
set -e

echo "Running all verifications..."

# Shell Script Deep Formatting
echo "-----------------------------------"
echo "Verifying Shell Script..."
node beautify-format-extension/verify-shell-deep.cjs

# Verify no regression in others (Sample)
echo "-----------------------------------"
echo "Verifying C (Sample)..."
node beautify-format-extension/verify-c-deep.cjs

echo "-----------------------------------"
echo "Verifying Java (Sample)..."
node beautify-format-extension/verify-java-deep.cjs

echo "-----------------------------------"
echo "Verifying Python (Sample)..."
node beautify-format-extension/verify-python-deep.cjs

echo "-----------------------------------"
echo "ALL TESTS PASSED"
