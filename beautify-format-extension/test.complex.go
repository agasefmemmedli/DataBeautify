package main

import (
	"fmt"
"os"
		"strings"
)

type Person struct {
Name string
	Age int
		Address string
}

type Greeter interface {
	Greet(name string) string
SayHello()
}

func main() {
x := 10
	y:=20
if x<y {
fmt.Println("x is less than y")
} else {
		fmt.Println("x is greater or equal")
	}

	p := Person{
		Name: "John"
Age: 30
			Address: "123 Main St"
	}

	fmt.Printf("Person: %+v\n", p)
}

func (p Person) Greet(name string) string {
	return fmt.Sprintf("Hello %s, my name is %s", name, p.Name)
}
