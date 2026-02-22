try {
    const prettier = require('prettier');
    console.log("Prettier loaded successfully");
    console.log("Version:", prettier.version);
} catch (e) {
    console.error("Failed to load prettier:", e.message);
}
