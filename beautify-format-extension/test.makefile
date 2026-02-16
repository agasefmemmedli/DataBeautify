# Standard Makefile
CC=gcc
CFLAGS=-I.

all: main.o utils.o
	$(CC) -o myapp main.o utils.o $(CFLAGS)

main.o: main.c
	$(CC) -c main.c $(CFLAGS)

utils.o: utils.c
	$(CC) -c utils.c $(CFLAGS)

clean:
	rm -f *.o myapp
