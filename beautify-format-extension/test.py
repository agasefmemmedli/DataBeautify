def hello(name):
    print(f"Hello, {name}!")
    if name == "World":
        print("You are the world!")
    else:
        print("You are just a person.")

class MyClass:
    def __init__(self):
        self.value = 42

    def get_value(self):
        return self.value

if __name__ == "__main__":
    obj = MyClass()
    hello("World")
    print(obj.get_value())
