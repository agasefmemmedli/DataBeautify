#!/bin/bash
# Broken Shell Script (Fault Tolerance Test)

if [ -f "missing_fi" ]; then
  echo "Where is fi?"

case "$1" in
  start)
    echo "Starting"
    # Missing ;;
  stop)
    echo "Stopping"
    ;;
