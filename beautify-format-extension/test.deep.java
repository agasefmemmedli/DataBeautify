package com.example.demo;

import java.util.List;
import java.util.ArrayList;
import java.util.Map;
import java.util.HashMap;

@Deprecated
public class DeepTest < T > {

    private final List < String > items = new ArrayList < > ();

    @Override
    public String toString() {
        return "DeepTest{items=" + items + "}";
    }

    public void processItems() {
        items.forEach((item) -> {
            if (item.length() > 5) {
                System.out.println(item.toUpperCase());
            } else {
                System.out.println(item.toLowerCase());
            }
        });
    }

    public void switchExpression(int day) {
        String dayName = switch (day) {
            case 1 -> "Monday";
            case 2 -> "Tuesday";
            default -> "Unknown";
        };
    }

    public void tryWithResources() {
        try (var resource = new AutoCloseable() {
            @Override
            public void close() throws Exception {
                System.out.println("Closed");
            }
        }) {
            System.out.println("Resource used");
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public record Person(String name, int age) {}

    public String textBlock() {
        return """
               This is a text block
               with multiple lines
               """;
    }
}
