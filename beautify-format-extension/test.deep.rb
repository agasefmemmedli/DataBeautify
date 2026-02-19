# Deep Ruby Formatting Test

# Module with nested classes
module DeepFormatting
  class User
    attr_reader :name, :email

    def initialize(name, email)
      @name = name
      @email = email
    end

    # Complex method with multi-line logic
    def complex_logic(arg1, arg2)
      if arg1 > arg2
        result = arg1 * 2
        puts "Arg1 is greater: #{result}"
      elsif arg1 == arg2
        result = arg1 + arg2
        puts "Args are equal: #{result}"
      else
        result = arg2 - arg1
        puts "Arg2 is greater: #{result}"
      end

      # Return explicit result
      return result
    end
  end

  # Nested class for configuration
  class Config
    SETTINGS = {
      timeout: 30,
      retries: 3,
      endpoints: [
        "https://api.example.com/v1",
        "https://api.example.com/v2"
      ],
      flags: {
        verbose: true,
        debug: false
      }
    }

    def self.print_settings
      SETTINGS.each do |key, value|
        puts "#{key}: #{value}"
      end
    end
  end
end

# Usage of blocks
[1, 2, 3, 4, 5].map do |n|
  n * n
end.select do |n|
  n > 10
end.each { |n| puts n }

# Heredoc example
query = <<~SQL
  SELECT *
  FROM users
  WHERE created_at > '2023-01-01'
  ORDER BY id DESC
SQL

puts query

# Method call with many arguments
DeepFormatting::User.new(
  "John Doe",
  "john.doe@example.com"
).complex_logic(
  100,
  50
)
