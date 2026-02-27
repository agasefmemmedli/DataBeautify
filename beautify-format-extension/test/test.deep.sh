#!/bin/bash
# Deep Formatting Test for Shell Script (Google Style Guide)

# Basic Indentation
if [ -f "$FILE" ]; then
echo "File exists"
fi

# Case Statement (Indented Patterns)
case "$1" in
start)
echo "Starting"
;;
stop)
echo "Stopping"
;;
*)
echo "Usage: $0 {start|stop}"
exit 1
;;
esac

# Function and Compound Commands
function my_func() {
local var="test"
if [[ "$var" == "test" ]]; then
echo "Match"
else
echo "No match"
fi
}

# Line Continuations and Binary Operators
grep -r "pattern" . \
--exclude-dir={.git,node_modules} \
| sort | uniq

# Arithmetic and Parameter Expansion
count=$(( count + 1 ))
echo "${var:0:1}"

# Subshells
(
cd /tmp
ls -la
)
