
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
