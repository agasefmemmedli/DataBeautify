public class SwitchTest {
    void test() {
        int x = 1;
        switch (x) {
        case 1:
        System.out.println("One");
        break;
        case 2: System.out.println("Two"); break;
        default:
        System.out.println("Default");
        }

        MISSING_SEMICOLON // syntax error
    }
}
