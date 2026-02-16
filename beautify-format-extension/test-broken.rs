fn broken_rust() {
    let x = 5;
    if x > 0 {
        println!("missing closing brace"

    match x {
        1 => {
            println!("unclosed match arm")
        // missing closing brace for match
}

fn unclosed_string() {
    let s = "this string is never closed;
}

fn unclosed_comment() {
    /* this comment never ends
}
