# Deep Formatting Test for Ruby
# Covers: Nested modules/classes, blocks, lambdas, arrays, hashes, case statements, error handling, heredocs

module Deep
  class Formatter
    attr_reader :data

    def initialize(data)
@data = data
    end

    def process
      result = @data.map do |item|
        if item.is_a?(Hash)
          transform_hash(item)
        elsif item.is_a?(Array)
          transform_array(item)
        else
          item
        end
      end

      log_result(result)
      result
    end

    private

    def transform_hash(hash)
      hash.transform_keys(&:to_s).transform_values do |v|
        case v
        when String then v.upcase
        when Integer then v * 2
        when Proc
          v.call
        else
          v
        end
      end
    end

    def transform_array(array)
      array.select { |x| x.is_a?(Integer) }
           .map { |x| x + 1 }
           .sort
           .reverse
    end

    def log_result(result)
      puts <<~LOG
        Processing complete.
        Result summary: #{result.inspect}
        Timestamp: #{Time.now}
      LOG
    end
  end
end

formatter = Deep::Formatter.new([
  { name: "test", value: 123, action: -> { "proc_result" } },
  [1, 5, 2, "skip"],
  "simple_string"
])

puts formatter.process
