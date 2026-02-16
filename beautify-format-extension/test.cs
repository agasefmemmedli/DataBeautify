using System;
using System.Collections.Generic;

namespace HelloWorld
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("Hello World!");
            var numbers = new List<int> { 1, 2, 3 };
            foreach (var n in numbers)
            {
                Console.WriteLine(n);
            }
        }
    }
}
