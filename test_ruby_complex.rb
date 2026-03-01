class User
def initialize(name, age)
@name=name
@age=age
end

def process
if @age>18
puts "adult"
else
puts "minor"
end
end
end

user = User.new("Test", 20)
user.process
