package main

import (
    "fmt"
    "time"
)

// Person struct
type Person struct {
    Name    string
    Age     int
    Address struct {
        City, Zip string
    }
}

// Stringer interface
type Stringer interface {
    String() string
}

func (p *Person) String() string {
    return fmt.Sprintf("%s (%d)", p.Name, p.Age)
}

func variadic(nums ...int) int {
    total := 0
    for _, num := range nums {
        total += num
    }
    return total
}

func main() {
    // Nested switch
    x := 10
    switch {
    case x > 0:
        if x > 5 {
            fmt.Println("big")
        } else {
            fmt.Println("small")
        }
    case x < 0:
        fmt.Println("negative")
    default:
        fmt.Println("zero")
    }

    // Channel and Select
    ch := make(chan string)
    go func() {
        time.Sleep(1 * time.Second)
        ch <- "done"
    }()

    select {
    case msg := <-ch:
        fmt.Println("received:", msg)
    case <-time.After(2 * time.Second):
        fmt.Println("timeout")
    }

    // Operators
    a := 1 + 2*3
    b := !true
    c := &a
    d := *c
    fmt.Println(a, b, c, d)

    // Raw string
    raw := `
Line 1
Line 2
`
    fmt.Println(raw)
}
