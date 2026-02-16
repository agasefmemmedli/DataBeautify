import 'dart:math';

class Broken {
  void test() {
    if (true) {
      print('Missing closing brace');
    // Missing } here
  }

  void another() {
    var s = "Unclosed string;
  }
}
