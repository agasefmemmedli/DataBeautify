# Broken Makefile
	echo "Doing something before any target"

all: main.o
    $(CC) -o myapp main.o
