QUnit.test("Test illegal instruction", function (assert) {
    assert.throws(
        function () {
            PatternEngine().ExecuteBytecode([["EFAKE", 1, 2, 3]], null);
        },
        /Illegal bytecode/,
        'An illegal instruction results in an Error.'
    );
});

QUnit.test("Test legal instruction", function (assert) {
    assert.ok(
        PatternEngine().ExecuteBytecode([["MOVC", 0, 100, 0]], null),
        'A legal instruction can be parsed'
    );
});