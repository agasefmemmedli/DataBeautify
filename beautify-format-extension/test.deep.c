#include <stdio.h>
#include <stdlib.h>

#define MAX_SIZE 100
#define SQUARE(x) ((x) * (x))

typedef struct Point {
    int x;
    int y;
} Point;

typedef enum Color {
    RED,
    GREEN,
    BLUE
} Color;

struct Data {
    int id;
    char *name;
    struct Point p;
};

void process_data(struct Data *d) {
    if (d == NULL) {
        return;
    }

    switch (d->id) {
        case 1:
            printf("Processing ID 1\n");
            break;
        case 2:
            printf("Processing ID 2\n");
            break;
        default:
            printf("Unknown ID\n");
            break;
    }
}

// Allman style switch
void process_allman(int x)
{
    switch (x)
    {
        case 1:
            printf("One\n");
            break;
        default:
            printf("Other\n");
            break;
    }
}

int *get_array(int size) {
    int *arr = (int *)malloc(size * sizeof(int));
    if (!arr) return NULL;
    for (int i = 0; i < size; i++) {
        arr[i] = i;
    }
    return arr;
}

int main() {
    Point p1 = { .x = 10, .y = 20 };
    struct Data d1 = {
        .id = 1,
        .name = "Test",
        .p = p1
    };

    int *ptr = &d1.id;
    int val = *ptr;

    printf("Value: %d\n", val);

    int a = 5;
    int b = 10;
    int c = (a + b) * 2;

    if (a < b) {
        printf("a is less than b\n");
    } else {
        printf("a is not less than b\n");
    }

    // Test designated initializers in array
    int numbers[10] = {
        [0] = 1,
        [5] = 10,
        [9] = 100
    };

    // Test restrict keyword (C99)
    int * restrict p_res = malloc(10);

    return 0;
}
