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

  mov = pattern_engine.parseLine('MOV R15, 0xf');
  assert.strictEqual(mov.toString(), 'MOV R15, 15');

  mov = pattern_engine.parseLine('MOV R15, 255');
  assert.strictEqual(mov.toString(), 'MOV R15, 255');

  mov = pattern_engine.parseLine('MOV R15, 32767');
  assert.strictEqual(mov.toString(), 'MOV R15, 32767');

  mov = pattern_engine.parseLine('MOV R15, -1');
  assert.strictEqual(mov.toString(), 'MOV R15, -1');

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
  assert.equal(state2.pc, 1);
  var state3 = pattern_engine.parseLine('MOV R1, R0').execute(state2);
  assert.equal(state3.r[0], 1);
  assert.equal(state3.r[1], 1);
  assert.equal(state3.pc, 2);
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
      pattern_engine.parseLine('MOV R0, 255').toBytecode(),
      //10987654321098765432109876543210
      0b00001000000000100000000011111111);
  assert.equal(
      pattern_engine.parseLine('MOV R0, -1').toBytecode(),
      //10987654321098765432109876543210
      0b00001000000000001111111111111111);
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

  assert.throws(function() {
    pattern_engine.parseLine('WHSL R0, R0, -1');
  }, /Literal out of range/);

  assert.throws(function() {
    pattern_engine.parseLine('WHSL R0, R0, 256');
  }, /Literal out of range/);
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
  assert.equal(state2.pc, 1);
  // Make sure that state stays the same, minus pc.
  state2.pc = 0;
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

QUnit.test('CMP parse', function(assert) {
  var mov = pattern_engine.parseLine('CMP R0, 0');
  assert.strictEqual(mov.toString(), 'CMP R0, 0');

  mov = pattern_engine.parseLine('CMP 5, R1');
  assert.strictEqual(mov.toString(), 'CMP 5, R1');

  assert.throws(function() {
    pattern_engine.parseLine('CMP R0, -1');
  }, /Literal out of range/);
});

QUnit.test('CMP execute', function(assert) {
  var state = new pattern_engine.State();
  state = pattern_engine.parseLine('CMP 5, 5').execute(state);
  assert.equal(state.z, true);
  assert.equal(state.p, true);
  state = pattern_engine.parseLine('CMP 5, 6').execute(state);
  assert.equal(state.z, false);
  assert.equal(state.p, false);
  state = pattern_engine.parseLine('CMP 6, 5').execute(state);
  assert.equal(state.z, false);
  assert.equal(state.p, true);
  // TODO: write a test with 0xffffffff.
  state = pattern_engine.parseLine('MOV R0, 0x7fff').execute(state);
  state = pattern_engine.parseLine('CMP R0, R0').execute(state);
  assert.equal(state.z, true);
  assert.equal(state.p, true);
});

QUnit.test('CMP toBytecode', function(assert) {
  assert.equal(
      pattern_engine.parseLine('CMP R0, S0').toBytecode(),
      //10987654321098765432109876543210
      0b00011000000000100000000110000000);
});

QUnit.test('JMP parse', function(assert) {
  var mov = pattern_engine.parseLine('JMP 0');
  assert.strictEqual(mov.toString(), 'JMP 0');

  var mov = pattern_engine.parseLine('JMP 0xffff');
  assert.strictEqual(mov.toString(), 'JMP 65535');

  mov = pattern_engine.parseLine('JNE 123');
  assert.strictEqual(mov.toString(), 'JNE 123');

  mov = pattern_engine.parseLine('JG 123');
  assert.strictEqual(mov.toString(), 'JG 123');

  assert.throws(function() {
    pattern_engine.parseLine('JMP 65536');
  }, /Literal out of range/);
});

QUnit.test('JMP execute', function(assert) {
  var state = new pattern_engine.State();
  state = pattern_engine.parseLine('JMP 5').execute(state);
  assert.equal(state.pc, 5);
  assert.equal(state.z, 0);
  assert.equal(state.p, 0);
  state = pattern_engine.parseLine('JEQ 10').execute(state);
  assert.equal(state.pc, 6);
  state = pattern_engine.parseLine('JNE 10').execute(state);
  assert.equal(state.pc, 10);
  state = pattern_engine.parseLine('CMP 1, 2').execute(state);
  state = pattern_engine.parseLine('JL 15').execute(state);
  assert.equal(state.pc, 15);
  state = pattern_engine.parseLine('JLE 20').execute(state);
  assert.equal(state.pc, 20);
  state = pattern_engine.parseLine('JG 25').execute(state);
  assert.equal(state.pc, 21);
  state = pattern_engine.parseLine('JGE 25').execute(state);
  assert.equal(state.pc, 22);
  state = pattern_engine.parseLine('JEQ 25').execute(state);
  assert.equal(state.pc, 23);
});

QUnit.test('JMP toBytecode', function(assert) {
  assert.equal(
      pattern_engine.parseLine('JMP 3').toBytecode(),
      //10987654321098765432109876543210
      0b00010000000000000000000000000011);
  assert.equal(
      pattern_engine.parseLine('JMP 0xffff').toBytecode(),
      //10987654321098765432109876543210
      0b00010000000000001111111111111111);
  assert.equal(
      pattern_engine.parseLine('JNE 0').toBytecode(),
      //10987654321098765432109876543210
      0b00010000100000000000000000000000);
});
