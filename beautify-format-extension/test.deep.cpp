#include <iostream>
#include <vector>
#include <string>

// Namespace
namespace MyNamespace {

// Template Class
template <typename T>
class MyClass {
public:
    // Constructor
    MyClass(T val) : value(val) {}

    // Method with pointer and reference
    void process(T* ptr, T& ref) {
        if (ptr != nullptr) {
            *ptr = ref * 2; // Binary multiply and Unary dereference
        }
    }

    // Accessor
    T getValue() const {
        return value;
    }

private:
    T value;
};

} // namespace MyNamespace

// Main function
int main() {
    using namespace MyNamespace;

    // Object creation
    MyClass<int> obj(10);
    int x = 5;
    int y = 20;

    // Comparison
    if (x < y) {
        std::cout << "x is less than y" << std::endl;
    }

    // Function call
    obj.process(&x, y);

    // Lambda
    auto lambda = [](int a, int b) {
        return a + b;
    };

    // Vector
    std::vector<std::string> items;
    items.push_back("Hello");

    // Switch case
    switch (x) {
        case 5:
            std::cout << "Five" << std::endl;
            break;
        default:
            std::cout << "Other" << std::endl;
            break;
    }

    // Raw String
    std::string raw = R"(
        Line 1
        Line 2
    )";

    return 0;
}
