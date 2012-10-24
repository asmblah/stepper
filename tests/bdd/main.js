require({
    paths: {
        "root": "../..",
        "vendor": "../../vendor",
        "js": "../../js"
    }
}, [
    "require"
], function (
    require
) {
    "use strict";

    mocha.setup({
        "ui": "bdd",
        "reporter": mocha.reporters.HTML,
        "globals": ["_gaq", "jQuery*", "setTimeout", "setInterval", "clearTimeout", "clearInterval"]
    });

    require({
        cache: false
    }, [
        "./acceptance/SampleDebugTest.js"
    ], function () {
        mocha.run();
    });
});
