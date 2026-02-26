package com.example.demo;

import java.util.List;
import java.util.stream.Collectors;

@Deprecated(
    since = "1.0",
    forRemoval = true
)
public record Person(String name, int age) {
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
        return status;
    }

    public void printInfo() {
        String info = """
                Name: %s
                Age: %d
                Status: %s
                """.formatted(name, age, getStatus());
        System.out.println(info);
    }

    public static void main(String[] args) {
        List<Person> people = List.of(new Person("Alice", 25), new Person("Bob", 17));
        List<String> names = people.stream()
            .filter(p -> p.age >= 18)
            .map(Person::name)
            .collect(Collectors.toList());
    }
}
