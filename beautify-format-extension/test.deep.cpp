#include <iostream>
#include <vector>
#include <map>
#include <string>
#include <type_traits>

// Macros
#define MAX(a,b) ((a) > (b) ? (a) : (b))
#define PRINT(x) std::cout << #x << " = " << x << std::endl

// Forward declaration
template<typename T>
class MyContainer;

// Enumeration
enum class Color {
    Red,
    Green,
    Blue
};

// Struct with attributes
struct [[nodiscard]] Point {
    int x;
    int y;
};

// Class with inheritance and templates
template<typename T, typename U = std::string>
class MyClass : public std::vector<T> {
public:
    using value_type = T;

    // Constructor with initializer list
    MyClass(int size) : std::vector<T>(size), m_name("default") {
        if (size > 100) {
            this->reserve(size * 2);
        }
    }

    // Function with trailing return type and noexcept
    auto getName() const noexcept -> const std::string& {
        return m_name;
    }

    // Template member function
    template<typename V>
    void process(V&& value) {
        // Lambda expression
        auto lambda = [this, &value](int x) -> bool {
            return x > 0 && value != T{};
        };

        if (lambda(1)) {
            m_data.push_back(std::forward<V>(value));
        }
    }

protected:
    std::vector<U> m_data;

private:
    std::string m_name;
    int* m_ptr = nullptr; // Pointer syntax
    int& m_ref = *m_ptr;  // Reference syntax
};

// Concept (C++20)
template<typename T>
concept Addable = requires(T a, T b) {
    { a + b } -> std::convertible_to<T>;
};

// Function using concept
void add(Addable auto a, Addable auto b) {
    // Switch case
    switch (a) {
        case 0: {
            std::cout << "Zero";
            break;
        }
        case 1:
            std::cout << "One";
            [[fallthrough]];
        default:
            std::cout << "Many";
            break;
    }
}

// Global variable with complex type
std::map<std::string, std::vector<int>> g_map = {
    {"one", {1}},
    {"two", {1, 2}}
};

int main() {
    MyClass<int> obj(10);
    obj.process(42);

    // Initializer list logic
    std::vector<int> vec = {1, 2, 3, 4, 5};

    // Complex expression
    int result = (1 + 2) * (3 - 4) / 5 % 6;
    bool check = (result > 0) && (result < 10) || !(result == 5);

    // Raw string literal
    const char* raw = R"(
        This is a raw string
        spanning multiple lines.
    )";

    // Nested templates
    std::vector<std::vector<int>> matrix;

    // Pointer alignment check
    int * p1; // Should be int* p1
    int* p2;
    int *p3;

    return 0;
}
