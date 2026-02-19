using System;
using System.Collections.Generic;
using System.Linq;

namespace DeepFormatting
{
    [Obsolete("Use NewClass instead")]
    public class LegacyClass<T> where T : class, new()
    {
        public T Value { get; set; }

        [SerializeField] private int _count;

        public event EventHandler OnChanged;

        public LegacyClass(int count)
        {
            _count = count;
        }

        public void Process(List<string> items)
        {
            var query = from item in items
                        where item.Length > 5
                        orderby item
                        select item.ToUpper();

            foreach (var item in query)
            {
                Console.WriteLine($"Item: {item}");
            }

            var squares = items.Select(x => x.Length * x.Length).ToList();
        }

        public int? GetNullable()
        {
            return _count > 0 ? _count : null;
        }
    }

    public record Person(string FirstName, string LastName);

    public class ModernFeatures
    {
        public static void Main()
        {
            object o = "hello";
            if (o is string s && s.Length > 0)
            {
                Console.WriteLine(s);
            }

            var result = o switch
            {
                string str => "String",
                int i => "Integer",
                _ => "Unknown"
            };

            string path = @"C:\Windows\System32";
            int[] numbers = { 1, 2, 3, 4, 5 };
        }
    }
}

// Regression Test Section
public class Regression
{
    public void Compare()
    {
        int a = 5;
        int b = 10;
        if (a < b)
        {
            Console.WriteLine("a is less than b");
        }

        if (b > a)
        {
            Console.WriteLine("b is greater than a");
        }

        for (int i = 0; i < 10; i++)
        {
            Console.WriteLine(i);
        }

        while (a < b)
        {
            a++;
        }

        bool result = a < b && b > a;

        // Generic Test
        List<int> list = new List<int>();
        Dictionary<string, int> dict = new Dictionary<string, int>();

        Process<int>(list);
    }

    public void Process<T>(List<T> items)
    {
    }
}
