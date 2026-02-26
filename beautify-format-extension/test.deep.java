package com.example.deep;

import java.util.List;
import static java.lang.Math.PI;
import java.util.stream.Collectors;
import static java.lang.Math.abs;
import java.util.stream.Stream;

/**
 * Deep Formatting Test for Java
 */
public enum TestEnum {
    VALUE_ONE,
    VALUE_TWO;
}

@FunctionalInterface
interface Converter<F, T> {
    T convert(F from);
}

public record Point(int x, int y) {}

public class DeepJavaTest<T> {

    private final List<T> items;
    protected int count;
    public String name;

    // Unaligned variables
    private int x = 1;
    public double y = 2.0;
    protected String z = "test";

    public DeepJavaTest(List<T> items) {
        this.items = items;
    }

    public void complexMethod() {
        // Lambda with block
        Converter<String, Integer> converter = (from) -> {
            return Integer.valueOf(from);
        };

        // Switch Expression (Java 14+)
        var result = switch (TestEnum.VALUE_ONE) {
            case VALUE_ONE -> "One";
            case VALUE_TWO -> "Two";
            default -> "Unknown";
        };

        // Text Block (Java 15+)
        String html = """
              <html>
                  <body>
                      <p>Hello, World</p>
                  </body>
              </html>
              """;

        // Streams with vertical alignment
        List<String> filtered = items.stream()
            .map(Object::toString)
            .filter(s -> s.length() > 5)
            .sorted()
            .collect(Collectors.toList());

        // Try-with-resources
        try (Stream<String> s = filtered.stream()) {
            s.forEach(System.out::println);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // Inner class with generics
    private static class Inner<U> {
        U value;
        Inner(U value) { this.value = value; }
    }
}
