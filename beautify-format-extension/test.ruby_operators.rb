
# Operator Tests
def check_operators
  str = "abc"
  if str === "abc"
    puts "Equal"
  end

  x = 10
  x **= 2
  x ||= 1
  x &&= 100

  range = 1...10

  val = $global_var
  hex = 0xFF
  bin = 0b1010
end
