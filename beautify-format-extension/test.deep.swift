
import Foundation
import UIKit
import SwiftUI

@discardableResult
func perform(action: () -> Void) -> Bool {
    action()
    return true
}

struct User {
    let name: String
    let age: Int
}

class Manager {
    var users: [User] = []

    func addUser(name: String, age: Int) {
        let user = User(name: name, age: age)
        users.append(user)
    }
}

// Extension
extension Manager {
    func findUser(byName name: String) -> User? {
        // Guard
        guard !users.isEmpty else {
            return nil
        }

        // Loop
        for user in users {
            if user.name == name {
                return user
            }
        }
        return nil
    }
}

// Switch
enum Status {
    case active
    case inactive
    case unknown
}

func checkStatus(_ status: Status) {
    switch status {
    case .active:
        print("Active")
    case .inactive:
        print("Inactive")
    default:
        print("Unknown")
    }
}

// Complex Case
func complexSwitch(val: Any) {
    switch val {
    case let x where x is [String: Int]:
        print("Dictionary")
    case let str as String where str == "test":
        print("String test")
    default:
        break
    }
}

// Generics vs Operators
func testGenerics() {
    let arr: Array<Int> = []
    let count = 5
    if count < 10 {
        print("Less")
    }
    if count > 0 {
        print("Greater")
    }

    let dict: Dictionary<String, Array<Int>> = [
        "key": [1, 2, 3],
        "other": []
    ]
}

// Complex Closures and Alignment
func complexClosures() {
    UIView.animate(withDuration: 0.3, animations: {
        print("Animating")
    }, completion: { finished in
        if finished {
            print("Done")
        }
    })

    let items = [1, 2, 3].map { number -> Int in
        let result = number * 2
        return result
    }.filter { $0 > 2 }
}

// Multiline function definition
func multilineFunction(
    param1: String,
    param2: Int,
    param3: Bool
) -> String {
    return "\(param1) \(param2)"
}

// Guard with multiline conditions
func check(a: Int, b: Int) {
    guard a > 0,
          b > 0,
          a + b < 100 else {
        return
    }
    print("OK")
}

// Enum with associated values
enum Result<T, E: Error> {
    case success(T)
    case failure(E)
}

// Strings
let multiline = """
    This is a
    multiline string
    """

let interpolated = "Hello \(1 + 1)"

// Trailing closure
perform {
    print("Done")
}
