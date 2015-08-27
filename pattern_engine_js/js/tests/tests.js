QUnit.test('parseLine comments or empty lines', function(assert) {
  assert.strictEqual(pattern_engine.parseLine('// comment'), null);
  assert.strictEqual(pattern_engine.parseLine('  // comment'), null);
  assert.strictEqual(pattern_engine.parseLine(''), null);
  assert.strictEqual(pattern_engine.parseLine('  \t'), null);
});

QUnit.test('parseLine invalid instruction', function(assert) {
  assert.throws(function() {
    pattern_engine.parseLine('WHAT');
  }, /Invalid instruction/);
});

QUnit.test('MOV parse', function(assert) {
  var mov = pattern_engine.parseLine('MOV R0, 0');
  assert.strictEqual(mov.toString(), 'MOV R0, 0');

  mov = pattern_engine.parseLine('MOV R0, R1');
  assert.strictEqual(mov.toString(), 'MOV R0, R1');

  mov = pattern_engine.parseLine('MOV R15, 127');
  assert.strictEqual(mov.toString(), 'MOV R15, 127');

  mov = pattern_engine.parseLine('MOV R15, -128');
  assert.strictEqual(mov.toString(), 'MOV R15, -128');

  mov = pattern_engine.parseLine('MOV R15, 32767');
  assert.strictEqual(mov.toString(), 'MOV R15, 32767');

  mov = pattern_engine.parseLine('MOV R15, -32768');
  assert.strictEqual(mov.toString(), 'MOV R15, -32768');

  assert.throws(function() {
    pattern_engine.parseLine('MOV R15, -32769');
  }, /Literal out of range/);

  assert.throws(function() {
    pattern_engine.parseLine('MOV R15, 32768');
  }, /Literal out of range/);
});

QUnit.test('MOV execute', function(assert) {
  var state1 = new pattern_engine.State();
  var state2 = pattern_engine.parseLine('MOV R0, 1').execute(state1);
  assert.notEqual(state2, state1);
  assert.equal(state2.r[0], 1);
  assert.equal(state2.r[1], 0);
  state3 = pattern_engine.parseLine('MOV R1, R0').execute(state2);
  assert.equal(state3.r[0], 1);
  assert.equal(state3.r[1], 1);
});

QUnit.test('MOV toBytecode', function(assert) {
  assert.equal(
      pattern_engine.parseLine('MOV R0, 0').toBytecode(),
      //10987654321098765432109876543210
      0b00001000000000100000000000000000);
  assert.equal(
      pattern_engine.parseLine('MOV R0, 127').toBytecode(),
      //10987654321098765432109876543210
      0b00001000000000100000000001111111);
  assert.equal(
      pattern_engine.parseLine('MOV R0, -1').toBytecode(),
      //10987654321098765432109876543210
      0b00001000000000100000000011111111);
  assert.equal(
      pattern_engine.parseLine('MOV R0, 128').toBytecode(),
      //10987654321098765432109876543210
      0b00001000000000000000000010000000);
  assert.equal(
      pattern_engine.parseLine('MOV R15, 32767').toBytecode(),
      //10987654321098765432109876543210
      0b00001000001111000111111111111111);
  assert.equal(
      pattern_engine.parseLine('MOV R15, -32768').toBytecode(),
      //10987654321098765432109876543210
      0b00001000001111001000000000000000);
  assert.equal(
      pattern_engine.parseLine('MOV R15, S2').toBytecode(),
      //10987654321098765432109876543210
      0b00001000001111100000000110000010);
  assert.equal(
      pattern_engine.parseLine('MOV R15, R14').toBytecode(),
      //10987654321098765432109876543210
      0b00001000001111100000000100001110);
});

QUnit.test('strip command parse', function(assert) {
  var mov = pattern_engine.parseLine('WRGB 127, 127, 127');
  assert.strictEqual(mov.toString(), 'WRGB 127, 127, 127');

  mov = pattern_engine.parseLine('WHSL R0, R1, R2');
  assert.strictEqual(mov.toString(), 'WHSL R0, R1, R2');
});

var FakePixel = function() {
  this.r = null;
  this.g = null;
  this.b = null;
  this.h = null;
  this.s = null;
  this.l = null;
};

FakePixel.prototype.setRgb = function(r, g, b) {
  this.r = r; this.g = g; this.b = b;
  this.h = null; this.s = null; this.l = null;
}

FakePixel.prototype.setHsl = function(h, s, l) {
  this.h = h; this.s = s; this.l = l;
  this.r = null; this.g = null; this.b = null;
}

QUnit.test('strip command execute', function(assert) {
  var state = new pattern_engine.State();
  state.r[0] = 255;
  state.r[1] = 120;
  state.r[2] = 10;
  var pixel = new FakePixel();
  var state2 = pattern_engine.parseLine('WRGB R0, R1, R2').execute(
      state, pixel);
  assert.equal(pixel.r, 255);
  assert.equal(pixel.g, 120);
  assert.equal(pixel.b, 10);
  console.log(state);
  console.log(state2);
  // Make sure that state stays the same.
  assert.deepEqual(state2, state);
  pattern_engine.parseLine('WHSL 10, 20, R1').execute(
      state, pixel);
  assert.equal(pixel.r, null);
  assert.equal(pixel.g, null);
  assert.equal(pixel.b, null);
  assert.equal(pixel.h, 10);
  assert.equal(pixel.s, 20);
  assert.equal(pixel.l, 120);
});

QUnit.test('strip command toBytecode', function(assert) {
  assert.equal(
      pattern_engine.parseLine('WRGB 0, 1, 2').toBytecode(),
      //10987654321098765432109876543210
      0b01110000000000000000001000000010);
  assert.equal(
      pattern_engine.parseLine('WHSL 0, 0, R15').toBytecode(),
      //10987654321098765432109876543210
      0b01111000000000000000000100001111);
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
