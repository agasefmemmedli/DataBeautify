class MyClass
  def my_method(arg)
    if arg > 0
      puts "Positive"
    else
      puts "Non-positive"
    end
  end

  def self.static_method
    [1, 2, 3].each do |i|
      puts i
    end
  end
end

MyClass.new.my_method(5)
MyClass.static_method
