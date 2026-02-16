#include <iostream>

int main() {
    std::cout << "Missing semicolon" << std::endl

    if (true) {
        std::cout << "Unclosed brace" << std::endl;

    std::cout << "Mismatched parens (" << std::endl;

    const char* str = "Unclosed string;

    return 0;
}
