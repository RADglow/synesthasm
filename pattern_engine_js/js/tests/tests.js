QUnit.test("Test unknown instruction", function (assert) {
    assert.throws(
        function () {
            PatternEngine().ExecuteBytecode([["EFAKE", 1, 2, 3]]);
        },
        /Illegal bytecode/,
        'An illegal instruction results in an Error.'
    );
});

QUnit.test("Test illegal instruction format", function (assert) {
    assert.throws(
        function () {
            PatternEngine().ExecuteBytecode([["EFAKE", 1, 2]]);
        },
        /Illegal bytecode/,
        'An illegal instruction results in an Error.'
    );
});

QUnit.test("Test legal instruction", function (assert) {
    assert.ok(
        PatternEngine().ExecuteBytecode([["MOVC", 0, 100, 0]]),
        'A legal instruction can be parsed'
    );
});

QUnit.test("Test MOVC", function (assert) {
    var engine = PatternEngine();
    engine.ExecuteBytecode([["MOVC", 0, 100, 0]]);
    assert.deepEqual(
        engine.R,
        [100, 0, 0, 0, 0, 0, 0, 0],
        'MOVC loads a constant correctly'
    );
});

QUnit.test("Test MOVC with maxint", function (assert) {
    var engine = PatternEngine();
    engine.ExecuteBytecode([["MOVC", 0, 'MAXINT32', 0]]);
    assert.deepEqual(
        engine.R,
        [4294967296, 0, 0, 0, 0, 0, 0, 0],
        'MOVC loads MAXINT32'
    );
});

QUnit.test("Test LOAD total pixels", function (assert) {
    var pixels = 100;
    var strip = function FakeStrip() {
        if (!(this instanceof FakeStrip))
            return new FakeStrip;

        this.getLength = function () {
            return pixels;
        }
    }
    var engine = PatternEngine({ strip: strip() });
    engine.ExecuteBytecode([["LOAD", 0, '/total_pixels', 0]]);
    assert.deepEqual(
        engine.R,
        [pixels, 0, 0, 0, 0, 0, 0, 0],
        'LOAD loads total pixels'
    );
});

QUnit.test("Test assemble simple add returns 4 bytes", function (assert) {
    var engine = PatternEngine();

    var bytecode = engine.Assemble([["ADD", 0, 1, 2]]);
    assert.equal(
        bytecode.length,
        1,
        'Simple ADD assembles to 1 32 bit number'
    );
});

QUnit.test("Test assemble simple add returns CORRECT 4 bytes", function (assert) {
    var engine = PatternEngine();

    var bytecode = engine.Assemble([["ADD", 0, 1, 2]]);

    assert.deepEqual(
        bytecode,
        [0b00000010000000010000000000000010],
        'Simple ADD assembles to 00000010000000010000000000000010'
    );
});
