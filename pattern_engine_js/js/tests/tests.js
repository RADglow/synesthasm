QUnit.test("parse_line comments or empty lines", function(assert) {
  assert.strictEqual(pattern_engine.parse_line('// comment'), null);
  assert.strictEqual(pattern_engine.parse_line('  // comment'), null);
  assert.strictEqual(pattern_engine.parse_line(''), null);
  assert.strictEqual(pattern_engine.parse_line('  \t'), null);
});

QUnit.test("parse_line invalid instruction", function(assert) {
  assert.throws(function() {
    pattern_engine.parse_line('WHAT');
  }, /Invalid instruction/);
});

QUnit.test("MOV parse", function(assert) {
  var mov = pattern_engine.parse_line('MOV R0, 0');
  assert.strictEqual(mov.toString(), "MOV R0, 0");

  mov = pattern_engine.parse_line('MOV R0, R1');
  assert.strictEqual(mov.toString(), "MOV R0, R1");

  mov = pattern_engine.parse_line('MOV R15, 127');
  assert.strictEqual(mov.toString(), "MOV R15, 127");

  mov = pattern_engine.parse_line('MOV R15, -128');
  assert.strictEqual(mov.toString(), "MOV R15, -128");

  mov = pattern_engine.parse_line('MOV R15, 32767');
  assert.strictEqual(mov.toString(), "MOV R15, 32767");

  mov = pattern_engine.parse_line('MOV R15, -32768');
  assert.strictEqual(mov.toString(), "MOV R15, -32768");

  assert.throws(function() {
    pattern_engine.parse_line('MOV R15, -32769');
  }, /Literal out of range/);

  assert.throws(function() {
    pattern_engine.parse_line('MOV R15, 32768');
  }, /Literal out of range/);
});

QUnit.test("MOV execute", function(assert) {
  var state1 = new pattern_engine.State();
  var state2 = pattern_engine.parse_line('MOV R0, 1').execute(state1);
  assert.notEqual(state2, state1);
  assert.equal(state2.r[0], 1);
  assert.equal(state2.r[1], 0);
  state3 = pattern_engine.parse_line('MOV R1, R0').execute(state2);
  assert.equal(state3.r[0], 1);
  assert.equal(state3.r[1], 1);
});

QUnit.test("MOV toBytecode", function(assert) {
  assert.equal(
      pattern_engine.parse_line('MOV R0, 0').toBytecode(),
      //10987654321098765432109876543210
      0b00001000000000100000000000000000);
  assert.equal(
      pattern_engine.parse_line('MOV R0, 127').toBytecode(),
      //10987654321098765432109876543210
      0b00001000000000100000000001111111);
  assert.equal(
      pattern_engine.parse_line('MOV R0, -1').toBytecode(),
      //10987654321098765432109876543210
      0b00001000000000100000000011111111);
  assert.equal(
      pattern_engine.parse_line('MOV R0, 128').toBytecode(),
      //10987654321098765432109876543210
      0b00001000000000000000000010000000);
  assert.equal(
      pattern_engine.parse_line('MOV R15, 32767').toBytecode(),
      //10987654321098765432109876543210
      0b00001000001111000111111111111111);
  assert.equal(
      pattern_engine.parse_line('MOV R15, -32768').toBytecode(),
      //10987654321098765432109876543210
      0b00001000001111001000000000000000);
  assert.equal(
      pattern_engine.parse_line('MOV R15, S2').toBytecode(),
      //10987654321098765432109876543210
      0b00001000001111100000000110000010);
  assert.equal(
      pattern_engine.parse_line('MOV R15, R14').toBytecode(),
      //10987654321098765432109876543210
      0b00001000001111100000000100001110);
});

/*
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
*/
