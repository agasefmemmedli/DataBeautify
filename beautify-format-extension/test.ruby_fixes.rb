
def regression_tests
  # Unary operators
  x = -1
  y = +2
  if !x
    puts "Neg"
  end

  # Guard clause
  return if x < 0
  puts "Should not be indented"

  # Splat
  args = *[1, 2]

  # Comments
  a = 1 # Comment 1
  b = 2 # Comment 2
end
