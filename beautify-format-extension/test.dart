import 'dart:async';

/// A sample class
class Sample {
  final String name;
  Sample(this.name);

  void sayHello() {
    print('Hello, $name!');
  }

  String get description => "Sample: $name";
}

void main() async {
  var sample = Sample('Dart');
  sample.sayHello();

  // Multiline string
  var multi = '''
    This is a
    multiline string
  ''';

  // Raw string
  var raw = r'C:\Windows\System32';

  print(multi);
  print(raw);
}
