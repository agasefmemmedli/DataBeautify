#include <vector>
#include <string>

namespace Outer {
    namespace Inner {
    // Namespace contents should not be indented
    class MyClass {
    public:
    // Public members should be indented 2 spaces
        MyClass() : m_val(0), m_name("default"),
          m_data(10) {} // Constructor list continuation should be 4 spaces

        int doSomething() {
          // Function body indented 2 spaces
          int    x = 1;
          double y   = 2.0;
          std::string z = "hello";
          int* p = &x;
          int * p2 = &x; // Should be formatted to int* p2
          std::string url = "http://example.com"; // Should not be broken by //

          if (x > 0) {
              x++; // standard indent
              return x; // Should NOT be aligned with declarations
          }
          return 0;
        }

    private:
        int m_val;
        std::string m_name;
        std::vector<int> m_data;
    };

    template <typename T>
    class TemplatedClass {
        T value;
    };

    void func() {
        std::vector<std::vector<int>> vec; // Nested template test
        auto lambda = [=]() {
            return 1;
        }; // Lambda test
    }
    }
}
