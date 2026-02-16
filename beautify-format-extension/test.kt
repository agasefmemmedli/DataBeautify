package com.example

import java.util.*

/**
 * A sample Kotlin class
 * /* Nested block comment */
 */
class Sample(val name: String) {
    fun greet() {
        val message = "Hello, $name!"
        println(message)

        val rawString = """
            This is a
            raw string
            with $name
        """.trimIndent()

        when(name) {
            "Kotlin" -> println("Nice!")
            else -> println("Hello!")
        }
    }
}

fun main() {
    val s = Sample("Kotlin")
    s.greet()
}
