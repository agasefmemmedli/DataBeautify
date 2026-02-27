package com.example.demo;

import java.util.List;
import java.util.stream.Collectors;

@Deprecated(
    since = "1.0",
    forRemoval = true
)
public record Person(
    String name,
    int age
) {
    public Person {
        if (age < 0) {
            throw new IllegalArgumentException("Age cannot be negative");
        }
    }

    public String getStatus() {
        var status = switch (age) {
            case 0, 1, 2 -> "Baby";
            case 3, 4, 5 -> "Toddler";
            case 6, 7, 8, 9, 10, 11, 12 -> "Child";
            default -> {
                if (age < 18) {
                    yield "Teenager";
                } else {
                    yield "Adult";
                }
            }
        };
        // Verify switch expression without block and commas
        var x = switch(age) { case 1 -> method(1, 2); default -> 0; };
        return status;
    }
}
