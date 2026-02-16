fn main() {
println!("Hello, world!");
let mut x = 5;
if x > 0 {
println!("x is positive");
} else {
println!("x is not positive");
}
match x {
1 => println!("one"),
2 => println!("two"),
_ => {
println!("something else");
}
}
}

#[derive(Debug)]
struct Point {
x: i32,
y: i32,
}

impl Point {
fn new(x: i32, y: i32) -> Point {
Point { x, y }
}
}

fn lifetimes<'a>(s: &'a str) -> &'a str {
s
}

fn raw_strings() {
let s = r"This is a raw string";
let s2 = r#"This is a raw string with "# hashes"#;
}
