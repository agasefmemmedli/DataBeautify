#include <iostream>
#include <vector>
#include <string>

template <typename T>
class MyContainer {
public:
    MyContainer(T value) : data(value) {}
    void print() {
        std::cout << "Value: " << data << std::endl;
    }
private:
    T data;
};

int main() {
    std::vector<int> numbers = {1, 2, 3, 4, 5};
    for (int n : numbers) {
        std::cout << n << " ";
    }
    std::cout << std::endl;

    MyContainer<std::string> container("Hello C++");
    container.print();

    return 0;
}
