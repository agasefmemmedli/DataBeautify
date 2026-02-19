#include <iostream>
#include <vector>
#include <algorithm>

#define MAX(a,b) ((a) > (b) ? (a) : (b))

namespace MyApp {
    namespace Utils {
        template<typename T>
        class Buffer {
        public:
            using value_type = T;

            explicit Buffer(size_t size) : m_size(size), m_data(new T[size]) {
                std::fill(m_data, m_data + m_size, T());
            }

            ~Buffer() { delete[] m_data; }

            // Move constructor
            Buffer(Buffer&& other) noexcept
                : m_data(other.m_data), m_size(other.m_size) {
                other.m_data = nullptr;
                other.m_size = 0;
            }

            T& operator[](size_t index) { return m_data[index]; }
            const T& operator[](size_t index) const { return m_data[index]; }

            void process(std::function<void(T&)> func) {
                for(size_t i=0; i<m_size; ++i) {
                    func(m_data[i]);
                }
            }

        private:
            size_t m_size;
            T* m_data;
        };
    }
}

[[nodiscard]] int calculate(int a, int b) {
    auto lambda = [a, &b](int x) -> int {
        return a * x + b;
    };

    if(a > b) {
        return lambda(5);
    } else {
        return lambda(10);
    }
}

int main() {
    MyApp::Utils::Buffer<int> buffer(10);
    buffer.process([](int& x) {
        x = x * 2;
    });

    int* ptr = nullptr;
    int &ref = *ptr; // Syntax to fix

    std::vector<std::pair<int,int>> vec; // Nested templates

    return 0;
}
