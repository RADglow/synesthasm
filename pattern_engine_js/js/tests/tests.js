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

QUnit.test("Test MOVC", function (assert) {
    var engine = PatternEngine();
    engine.ExecuteBytecode([["MOVC", 0, 100, 0]], null);
    assert.deepEqual(
        engine.R,
        [100,0,0,0,0,0,0,0],
        'MOVC loads a constant correctly'
    );
});

QUnit.test("Test MOVC with maxint", function (assert) {
    var engine = PatternEngine();
    engine.ExecuteBytecode([["MOVC", 0, 'MAXINT32', 0]], null);
    assert.deepEqual(
        engine.R,
        [4294967296, 0, 0, 0, 0, 0, 0, 0],
        'MOVC loads MAXINT32'
    );
});