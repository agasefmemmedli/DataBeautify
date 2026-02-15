public class BrokenTest {
    public void test() {
        if (true) {
            System.out.println("Missing semicolon")
        }
    }
}
