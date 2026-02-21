
package com.example.deep.formatting

import kotlin.collections.*
import java.util.Date
import com.example.deep.formatting.User

@Deprecated("Use new formatting")
data class User(val id: Int, var name: String, val email: String? = null)

enum class Status {
    ACTIVE, INACTIVE, PENDING
}

interface Repository<T> {
    fun getById(id: Int): T?
    fun getAll(): List<T>
    fun save(item: T): Boolean
}

class UserRepository : Repository<User> {
    private val users = mutableListOf<User>()

    override fun getById(id: Int): User? {
        return users.find { it.id == id }
    }

    override fun getAll(): List<User> = users.toList()

    override fun save(item: User): Boolean {
        return if (users.any { it.id == item.id }) {
            false
        } else {
            users.add(item)
            true
        }
    }
}

fun main() {
    val repo = UserRepository()
    repo.save(User(1, "Alice", "alice@example.com"))
    repo.save(User(2, "Bob"))

    val user = repo.getById(1)
    user?.let {
        println("Found user: ${it.name}")
    } ?: run {
        println("User not found")
    }

    val numbers = listOf(1, 2, 3, 4, 5)
    val doubled = numbers.map { it * 2 }
                         .filter { it > 5 }

    for (i in 1..10 step 2) {
        println(i)
    }

    val x = 10
    val result = when (x) {
        1 -> "One"
        2, 3 -> "Two or Three"
        in 4..10 -> "Four to Ten"
        else -> "Unknown"
    }

    println(result)
}

// Complex nesting and lambdas
fun complex(input: Map<String, List<Int?>>): Int {
    return input.entries.sumOf { (key, values) ->
        values.filterNotNull()
              .filter { it % 2 == 0 }
              .sum()
    }
}
