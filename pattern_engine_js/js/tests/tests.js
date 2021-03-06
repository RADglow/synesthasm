QUnit.test("Test unknown instruction", function (assert) {
    assert.throws(
        function () {
            PatternEngine().ExecuteBytecode(
                PatternEngine().Assemble([["EFAKE", 1, 2, 3]]));
        },
        /Illegal assembly/,
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
        0b11100000000000010000000000000010,
        'Simple ADD assembles to 11100000000000010000000000000010'
    );
});

QUnit.test("Test execute ADD bytecode with register arg", function (assert) {
	var engine = PatternEngine();
    engine.R = [0, 10, 20, 0, 0, 0, 0, 0];
    var bytecode = engine.Assemble(
        [["ADD", 0, 1, 2]])
    engine.ExecuteBytecode(bytecode);
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

QUnit.test("Test execute SUBS bytecode with PSR update sets N", function (assert) {
    var engine = PatternEngine();
    engine.R = [0, 10, 20, 0, 0, 0, 0, 0];
    var bytecode = engine.Assemble(
        [["SUBS", 0, 1, 2]])
    engine.ExecuteBytecode(bytecode);
    assert.equal(engine.psr, 1 << 31);
});

QUnit.test("Test execute SUBS bytecode with PSR update sets Z", function (assert) {
    var engine = PatternEngine();
    engine.R = [0, 10, 10, 0, 0, 0, 0, 0];
    var bytecode = engine.Assemble(
        [["SUBS", 0, 1, 2]])
    engine.ExecuteBytecode(bytecode);
    assert.equal(engine.psr, 1 << 30);
});

QUnit.test("Test execute ADDS bytecode overflows correctly", function (assert) {
    var engine = PatternEngine();
    engine.R = [0, Math.pow(2, 31) - 1, 2, 0, 0, 0, 0, 0];
    var bytecode = engine.Assemble(
        [["ADDS", 0, 1, 2]])
    engine.ExecuteBytecode(bytecode);
    assert.equal(engine.psr, 1 << 31 | 1 << 29 | 1 << 28);
    assert.deepEqual(
        engine.R,
        [1, Math.pow(2, 31) - 1, 2, 0, 0, 0, 0, 0],
        'ADDS overflows correctly'
    );
});

