QUnit.test("Test unknown instruction", function (assert) {
    assert.throws(
        function () {
            PatternEngine().ExecuteBytecode(
                PatternEngine().Assemble([["EFAKE", 1, 2, 3]]));
        },
        /Illegal bytecode/,
        'An illegal instruction results in an Error.'
    );
});

QUnit.test("Test illegal instruction format", function (assert) {
    assert.throws(
        function () {
            PatternEngine().ExecuteBytecode(
                PatternEngine().Assemble([["EFAKE", 1, 2]]));
        },
        /Illegal bytecode/,
        'An illegal instruction results in an Error.'
    );
});

QUnit.test("Test legal instruction", function (assert) {
    assert.ok(
        PatternEngine().ExecuteBytecode(
            PatternEngine().Assemble([["MOVC", 0, 100, 0]])),
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

    assert.equal(
        bytecode[0],
        0b00000000000000010000000000000010,
        'Simple ADD assembles to 00000000000000010000000000000010'
    );
});

QUnit.test("Test execute ADD bytecode with register arg", function (assert) {
    var engine = PatternEngine();
    engine.R = [0, 10, 20, 0, 0, 0, 0, 0];
    engine.ExecuteBytecode(
        engine.Assemble(
        [["ADD", 0, 1, 2]]));
    assert.deepEqual(
        engine.R,
        [30, 10, 20, 0, 0, 0, 0, 0],
        'ADD 0, 1, 2 puts 30 in register 0'
    );
});

QUnit.test("Test execute MOV bytecode with an immediate", function (assert) {
    var engine = PatternEngine();
    engine.ExecuteBytecode(
        engine.Assemble(
        [["MOV", 0, 0, '245']]));
    assert.deepEqual(
        engine.R,
        [245, 0, 0, 0, 0, 0, 0, 0],
        'MOV 0 0 \'245\' puts 245 in register 0'
    );
});
