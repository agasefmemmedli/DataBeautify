#!/bin/bash
if [ "$1" = "hello" ]; then
echo "Hello World"
else
echo "Goodbye"
fi

for i in 1 2 3; do
echo "Count: $i"
done

while true; do
echo "loop"
break
done

case $VAR in
p1)
echo "p1"
;;
*)
echo "default"
;;
esac

{
echo "block"
}

cat <<EOF
This is a heredoc
EOF
