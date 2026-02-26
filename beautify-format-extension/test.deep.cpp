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

// --- NEW DEEP FORMATTING TESTS ---

namespace MyProject {
namespace Internal {

class ComplexClass {
 public:
  ComplexClass(int x, int y, std::string name)
      : x_(x),
        y_(y),
        name_(std::move(name)),
        data_({1, 2, 3}) {}

  void ProcessData() {
    int    shortVar   = 10;
    double longVarName = 3.14159;
    bool   flag       = true;

    if (flag) {
      auto lambda = [=](int a, int b) -> int {
        return a + b;
      };
      int result = lambda(x_, y_);
    }
  }

 private:
  int         x_;
  int         y_;
  std::string name_;
  std::vector<int> data_;
};

template <typename T, typename U>
struct Pair {
  T first;
  U second;
};

void GlobalFunction() {
  std::map<int, std::string> mapOfStrings;
  mapOfStrings[1] = "One";
  mapOfStrings[10] = "Ten";

  int a = 1;
  int b = 2;
  int c = a + b;
}

}  // namespace Internal
}  // namespace MyProject
