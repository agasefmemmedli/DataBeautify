package main

import (
    "fmt"
    "math"
)

// Point represents a 2D point
type Point struct {
    X, Y float64
}

/*
Abs returns the absolute value of the point
*/
func (p Point) Abs() float64 {
    return math.Sqrt(p.X*p.X + p.Y*p.Y)
}

func main() {
    p := Point{3, 4}
    fmt.Println(p.Abs())

    x := 1
    switch x {
    case 1:
        fmt.Println("one")
    case 2:
        fmt.Println("two")
    default:
        fmt.Println("other")
    }

    go func() {
        fmt.Println("goroutine")
    }()

    ch := make(chan int)
    select {
    case val := <-ch:
        fmt.Println(val)
    default:
        fmt.Println("nothing")
    }
}
