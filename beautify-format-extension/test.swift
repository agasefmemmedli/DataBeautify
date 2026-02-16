import Foundation

func helloWorld() {
print("Hello, world!")
}

class MyClass {
var name: String
init(name: String) {
self.name = name
}
func greet() {
/*
Nested comment
/* Deep nested */
*/
print("Hello, \(name)!")
}
}

let multiline = """
This is a
multiline string
"""

if true {
print("True")
} else {
print("False")
}
