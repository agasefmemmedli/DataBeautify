package com.example.broken;

public class Broken {
    public void method() {
        System.out.println("Hello") // Missing semicolon

        if (true) {
             System.out.println("Indent me please");
        // Missing closing brace
    }
}
