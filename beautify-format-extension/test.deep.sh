#!/bin/bash
# Complex Shell Script Test Case for Deep Formatting

# Variables and Arrays
readonly SCRIPT_NAME="deep-formatter"
declare -a servers=("srv1" "srv2" "srv3")
declare -A config=([key1]="val1" [key2]="val2")

# Nested Functions
function main() {
local arg1="$1"

if [[ -z "$arg1" ]]; then
echo "Usage: $SCRIPT_NAME <arg>" >&2
exit 1
elif [[ "$arg1" == "--help" ]]; then
usage
return 0
fi

# Complex Loop
for srv in "${servers[@]}"; do
echo "Processing $srv..."
if ping -c 1 "$srv" &> /dev/null; then
echo "$srv is online."
case "$srv" in
"srv1")
deploy_app "v1"
;;
"srv2"|"srv3")
deploy_app "v2"
;;
*)
echo "Unknown server type"
;;
esac
else
echo "WARN: $srv is offline!"
fi
done
}

# Heredocs (Indented and Unindented)
function usage() {
cat <<EOF
$SCRIPT_NAME - A test script for deep formatting.

Options:
--help      Show this help message.
EOF

cat <<-INDENTED_EOF
    This is an indented heredoc.
    It should verify tab/space handling.
INDENTED_EOF
}

# Command Substitution and Arithmetic
current_date=$(date +%Y-%m-%d)
count=$(( 1 + 2 * 3 ))

# Subshells and Redirection
(
cd /tmp || exit
ls -la | grep "test" > output.log 2>&1
)

# Call main
main "$@"
