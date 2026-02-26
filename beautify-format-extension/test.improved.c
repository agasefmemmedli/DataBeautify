#include "local.h"
#include <stdio.h>
#include <stdlib.h>
#include "config.h"

#define MAX(a,b) \
    ((a) > (b) ? (a) : (b))

void func() {
    int x;
    double y;
    char *z;
    unsigned int long_var_name;

    int * restrict p;
    int * const ptr;

    // Comment
    float f;
}
