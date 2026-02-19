#!/bin/bash
cd beautify-format-extension
for f in verify-*-deep.cjs; do
    echo "Running $f..."
    node "$f"
    if [ $? -ne 0 ]; then
        echo "❌ $f FAILED"
        exit 1
    fi
done
echo "✅ All verifications PASSED"
