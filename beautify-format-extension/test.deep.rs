// Deep Formatting Test for Rust
#![allow(unused)]
use std::collections::HashMap;
use std::fmt::Debug;

#[derive(Debug, Clone)]
pub struct Point<T> {
x: T,
y: T,
}

impl<T> Point<T> where T: Debug + Copy {
pub fn new(x: T, y: T) -> Self {
Self { x, y }
}

pub fn dist(&self) -> T {
self.x
}
}

pub enum Option<T> {
Some(T),
None,
}

fn lifetimes<'a, 'b>(x: &'a str, y: &'b str) -> &'a str {
if x.len() > y.len() {
x
} else {
y
}
}

async fn async_fn() -> Result<(), String> {
let x = 5;
let y = 10;
if x < y {
println!("x is less than y");
} else {
println!("x is greater than or equal to y");
}

let sum = |a: i32, b: i32| -> i32 {
a + b
};

let v = vec![1, 2, 3, 4, 5];
let doubled: Vec<_> = v.iter().map(|x| x * 2).collect();

match x {
1 => println!("one"),
2 | 3 => {
println!("two or three");
},
_ => println!("other"),
}

let raw = r"This is a raw string";
let raw_hash = r#"This is a raw string with "quotes" inside"#;
let raw_multiline = r#"
This is a multiline
raw string
"#;

let range = 1..10;
let inclusive_range = 1..=10;

Ok(())
}

trait Summary {
fn summarize(&self) -> String;
}

impl Summary for Point<i32> {
fn summarize(&self) -> String {
format!("Point({}, {})", self.x, self.y)
}
}

macro_rules! say_hello {
() => {
println!("Hello!");
};
}

fn main() {
say_hello!();
let p = Point::new(10, 20);
println!("{:?}", p);
}
