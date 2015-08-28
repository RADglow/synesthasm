"use strict";
// jshint globalstrict:true
// jshint node:true
// jshint jquery:true

var pattern_engine = {};  // namespace

pattern_engine.S_REGISTERS = {
  TICKS: 0,
  PIX: 1,
  COUNT: 2,
};

// Interpreter state.
pattern_engine.State = function() {
  this.r = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  // S registers: TICKS, PIX, COUNT.
  this.s = [0, 0, 0];
  this.z = false;  // zero
  this.p = false;  // positive

  this.pc = 0;
};

pattern_engine.State.prototype.clone = function() {
  var state = new pattern_engine.State();
  state.r = this.r.slice();
  state.s = this.s.slice();
  state.z = this.z;
  state.p = this.p;
  state.pc = this.pc;
  return state;
};

// Instructions.

// ------------------------------------------------------------------

pattern_engine.expectParameterCount = function(expected, tokens) {
  if (tokens.length != (expected + 1)) {
    throw new Error('Expected ' + expected + ' parameter' +
        ((expected == 1) ? '' : 's') + ' when parsing ' +
        tokens[0]);
  }
};

// Parses the operand as a register, returns the register number
// as an integer, or raises an error.
pattern_engine.parseRegister = function(token) {
  if (!/^[rR](\d+)$/.test(token)) {
    throw new Error('Invalid register: ' + token);
  }
  var r = parseInt(token.substring(1), 10);
  if (r < 0 || r > 15) {
    throw new Error('Invalid register: ' + token);
  }
  return r;
};

// Parses given token as a literal, enforcing that it is between
// minRange and maxRange (both inclusive).
pattern_engine.parseLiteral = function(token, minRange, maxRange) {
  if (!/^(?:-?\d+|0[xX][0-9a-fA-F]+)$/.test(token)) {
    throw new Error("Invalid literal value: " + token);
  }
  var v = parseInt(token, 0);
  if (v < minRange || v > maxRange) {
    throw new Error("Literal out of range: " + token);
  }
  return v;
};

/**
 * Parses the operand or throws on error.
 * @param {string} token Uppercase token to parse.
 * @param {?boolean} long_form_ok Whether 16b literals are ok.
 * @constructor
 */
pattern_engine.Operand = function(token, long_form_ok) {
  this.r = null;
  this.s = null;
  this.value = null;
  this.long_form = false;

  var rs_match = token.match(/^([RS])(\d+)$/);
  var v;
  if (rs_match) {
    v = parseInt(rs_match[2], 10);
    if (rs_match[1] == 'R') {
      if (v < 0 || v > 15) {
        throw new Error("Invalid register: " + token);
      }
      this.r = v;
    } else {
      if (v < 0 || v > 2) {
        throw new Error("Invalid special register: " + token);
      }
      this.s = v;
    }
    return;
  }
  if (token in pattern_engine.S_REGISTERS) {
    this.s = pattern_engine.S_REGISTERS[token];
    return;
  }
  if (long_form_ok) {
    this.value = pattern_engine.parseLiteral(token, -32768, 32767);
    if (this.value < 0 || this.value > 255) {
      this.long_form = true;
    }
  } else {
    this.value = pattern_engine.parseLiteral(token, 0, 255);
  }
};

pattern_engine.Operand.prototype.toString = function() {
  if (this.r !== null) {
    return 'R' + this.r;
  }
  if (this.s !== null) {
    return 'S' + this.s;
  }
  return '' + this.value;
};

pattern_engine.Operand.prototype.getValue = function(state) {
  if (this.r !== null) {
    return state.r[this.r];
  }
  if (this.s !== null) {
    return state.s[this.s];
  }
  return this.value;
};

pattern_engine.Operand.prototype.toBytecode = function() {
  if (this.r !== null) {
    return (1 << 8) | this.r;
  } else if (this.s !== null) {
    return (1 << 8) | (1 << 7) | this.s;
  } else {
    if (this.long_form) {
      return this.value & 0xffff;
    } else {
      return this.value & 0xff;
    }
  }
};

// ------------------------------------------------------------------

// MOV instruction.
pattern_engine.Mov = function(tokens) {
  pattern_engine.expectParameterCount(2, tokens);
  this.dest_r = pattern_engine.parseRegister(tokens[1]);
  this.src = new pattern_engine.Operand(tokens[2], true);
};

// Pretty prints MOV instruction..
pattern_engine.Mov.prototype.toString = function() {
  return "MOV R" + this.dest_r + ", " + this.src.toString();
};

// Executes MOV instruction.
pattern_engine.Mov.prototype.execute = function(state) {
  var newState = state.clone();
  newState.r[this.dest_r] = this.src.getValue(state);
  newState.pc++;
  return newState;
};

// Returns bytecode.
pattern_engine.Mov.prototype.toBytecode = function() {
  return (
      (1 << 27) |  // opcode
      (this.dest_r << 18) |
      (this.src.long_form ? 0 : 1) << 17 |
      this.src.toBytecode()
      ) >>> 0;
};

// ------------------------------------------------------------------

// CMP instruction.
pattern_engine.Cmp = function(tokens) {
  pattern_engine.expectParameterCount(2, tokens);
  this.srcs = [
    new pattern_engine.Operand(tokens[1]),
    new pattern_engine.Operand(tokens[2]),
  ];
};

// Pretty prints CMP instruction..
pattern_engine.Cmp.prototype.toString = function() {
  return "CMP " + this.srcs[0].toString() + ", " + this.srcs[1].toString();
};

// Executes CMP instruction.
pattern_engine.Cmp.prototype.execute = function(state) {
  var newState = state.clone();
  var v0 = this.srcs[0].getValue(state);
  var v1 = this.srcs[1].getValue(state);
  var diff = (v0 - v1) >> 0;
  newState.z = (diff === 0);
  newState.p = (diff >= 0);
  newState.pc++;
  return newState;
};

// Returns CMP bytecode.
pattern_engine.Cmp.prototype.toBytecode = function() {
  return (
      (3 << 27) |  // opcode
      (this.srcs[0].toBytecode() << 9) |
      this.srcs[1].toBytecode()
      ) >>> 0;
};

// ------------------------------------------------------------------

// Map from jump instruction names to their matcher bitmask (P, NP, Z, NZ).
pattern_engine.JMP_INSTRUCTIONS = {
  JMP: 0x0,  // 0b0000
  JEQ: 0x2,  // 0b0010
  JNE: 0x1,  // 0b0001
  JG:  0x9,  // 0b1001
  JGE: 0x8,  // 0b1000
  JL:  0x5,  // 0b0101
  JLE: 0x4,  // 0b0100
};

// JMP instruction.
pattern_engine.Jmp = function(tokens) {
  pattern_engine.expectParameterCount(1, tokens);
  this.instruction = tokens[0].toUpperCase();
  if (!(this.instruction in pattern_engine.JMP_INSTRUCTIONS)) {
    throw new Error('Invalid branch instruction: ' + tokens[0]);
  }
  if (/^\D/.test(tokens[1])) {
    this.label = tokens[1];
    this.address = null;
  } else {
    this.label = null;
    this.address = pattern_engine.parseLiteral(tokens[1], 0, 0xffff);
  }
};

// Pretty prints JMP instruction..
pattern_engine.Jmp.prototype.toString = function() {
  var s = this.instruction + ' ';
  if (this.label !== null) {
    s += this.label + '  // ';
  }
  if (this.address !== null) {
    s += this.address;
  } else {
    s += '???';
  }
  return s;
};

// Executes JMP instruction.
pattern_engine.Jmp.prototype.execute = function(state) {
  var comparison_pattern = pattern_engine.JMP_INSTRUCTIONS[this.instruction];
  var p = !!(comparison_pattern & 8);
  var np = !!(comparison_pattern & 4);
  var z = !!(comparison_pattern & 2);
  var nz = !!(comparison_pattern & 1);

  var fail = (p && !state.p) || (np && state.p) ||
    (z && !state.z) || (nz && state.z);

  var newState = state.clone();
  if (fail) {
    newState.pc++;
  } else {
    newState.pc = this.address;
  }
  return newState;
};

// Returns JMP bytecode.
pattern_engine.Jmp.prototype.toBytecode = function() {
  return (
      (2 << 27) |  // opcode
      (pattern_engine.JMP_INSTRUCTIONS[this.instruction] << 23) |
      this.address
      ) >>> 0;
};

// ------------------------------------------------------------------

pattern_engine.DATA_INSTRUCTION_OPCODES = {
  ADD: 16,
  SUB: 17,
  MUL: 18,
  DIV: 19,
  MOD: 20,
};

pattern_engine.DATA_INSTRUCTION_FUNCTIONS = {
  ADD: function(a, b) { return a + b; },
  SUB: function(a, b) { return a - b; },
  MUL: function(a, b) { return a * b; },
  DIV: function(a, b) { return Math.floor(a / b); },
  MOD: function(a, b) { return a % b; },
};

// Data instructions.
pattern_engine.Data = function(tokens) {
  pattern_engine.expectParameterCount(3, tokens);
  this.instruction = tokens[0].toUpperCase();
  this.dest_r = pattern_engine.parseRegister(tokens[1]);
  this.srcs = [
    new pattern_engine.Operand(tokens[2]),
    new pattern_engine.Operand(tokens[3]),
  ];
  if (!(this.instruction in pattern_engine.DATA_INSTRUCTION_OPCODES)) {
    throw new Error('Invalid instruction: ' + this.instruction);
  }
};

// Pretty prints data instruction..
pattern_engine.Data.prototype.toString = function() {
  return this.instruction + ' R' + this.dest_r + ', ' +
    this.srcs[0].toString() + ', ' + this.srcs[1].toString();
};

// Executes data instruction.
pattern_engine.Data.prototype.execute = function(state) {
  var newState = state.clone();
  var fun = pattern_engine.DATA_INSTRUCTION_FUNCTIONS[this.instruction];
  var v0 = this.srcs[0].getValue(state);
  var v1 = this.srcs[1].getValue(state);
  // Reduce to 32 bits and make signed.
  var val = (fun(v0, v1) & 0xffffffff) >> 0;
  newState.r[this.dest_r] = val;
  newState.pc++;
  return newState;
};

// Returns data bytecode.
pattern_engine.Data.prototype.toBytecode = function() {
  return (
      (pattern_engine.DATA_INSTRUCTION_OPCODES[this.instruction] << 27) |
      (this.dest_r << 18) |
      (this.srcs[0].toBytecode() << 9) |
      this.srcs[1].toBytecode()
      ) >>> 0;
};

// ------------------------------------------------------------------
// Strip (WRGB, WHSL) instructions.
pattern_engine.WriteStrip = function(tokens) {
  pattern_engine.expectParameterCount(3, tokens);
  if (tokens[0] == 'WRGB') {
    this.rgb = true;
  } else if (tokens[0] == 'WHSL') {
    this.rgb = false;
  } else {
    throw new Error('Invalid instruction: ' + tokens);
  }
  this.srcs = [
    new pattern_engine.Operand(tokens[1]),
    new pattern_engine.Operand(tokens[2]),
    new pattern_engine.Operand(tokens[3]),
  ];
};

// Pretty prints strip instruction.
pattern_engine.WriteStrip.prototype.toString = function() {
  var s = this.rgb ? 'WRGB ' : 'WHSL ';
  return s + this.srcs[0].toString() +
      ", " + this.srcs[1].toString() +
      ", " + this.srcs[2].toString();
};

// Executes strip write instruction.
pattern_engine.WriteStrip.prototype.execute = function(state, pixel) {
  var vals = $.map(this.srcs, function(src) {
    return src.getValue(state);
  });
  if (this.rgb) {
    pixel.setRgb(vals[0], vals[1], vals[2]);
  } else {
    pixel.setHsl(vals[0], vals[1], vals[2]);
  }
  var newState = state.clone();
  newState.pc++;
  return newState;
};

// Returns bytecode.
pattern_engine.WriteStrip.prototype.toBytecode = function() {
  return (
      ((this.rgb ? 14 : 15) << 27) |  // opcode
      (this.srcs[0].toBytecode() << 18) |
      (this.srcs[1].toBytecode() << 9) |
      this.srcs[2].toBytecode()
      ) >>> 0;
};

// ------------------------------------------------------------------

// Returns an assembled bytecode or null, if line was empty.
pattern_engine.parseLine = function(line) {
  var instruction_to_constructor = {
    mov: pattern_engine.Mov,

    cmp: pattern_engine.Cmp,

    jmp: pattern_engine.Jmp,
    jeq: pattern_engine.Jmp,
    jne: pattern_engine.Jmp,
    jg: pattern_engine.Jmp,
    jge: pattern_engine.Jmp,
    jl: pattern_engine.Jmp,
    jle: pattern_engine.Jmp,

    wrgb: pattern_engine.WriteStrip,
    whsl: pattern_engine.WriteStrip,

    add: pattern_engine.Data,
    sub: pattern_engine.Data,
    mul: pattern_engine.Data,
    div: pattern_engine.Data,
    mod: pattern_engine.Data,
  };

  // Strip off comments.
  line = line.replace(/\/\/.*/, '');
  // Strip off leading/trailing whitespace.
  line = line.replace(/^\s+/, '').replace(/\s+$/, '');
  if (line === '') {
    // Nothing to assemble.
    return null;
  }
  // Split on whitespace and/or commas.
  var tokens = line.split(/[ \t,]+/);
  var instruction = tokens[0].toLowerCase();
  var constructor = instruction_to_constructor[instruction];
  if (!constructor) {
    throw new Error("Invalid instruction: " + instruction);
  }
  return new constructor(tokens);  // jshint ignore:line
};

// Tries parsing a label. Returns the label as string, if it
// succeeds, null otherwise.
pattern_engine.parseLabel = function(line) {
  // Strip off comments.
  line = line.replace(/\/\/.*/, '');
  var match = line.match(/^\s*([a-zA-Z0-9_]+)\s*:\s*$/);
  if (!match) {
    return null;
  }
  return match[1];
};
// ------------------------------------------------------------------

// Splits given string (program code) into lines, assembles each line
// and returns an array of objects, where each object is {
//   asm: string, original line
//   instruction: instance of parsed instruction, if the line contained one
//   byteCode: integer, binary representation of the instruction, if the
//       line contained an instruction
//   address: integer, address of the command, if the line contained an
//       instruction
pattern_engine.assemble = function(text) {
  var lines = text.split('\n');
  var labelsToAddresses = {};
  var i = 0;
  var assembled = $.map(lines, function(line, lineNumber) {
    var label = pattern_engine.parseLabel(line);
    var instruction = null;
    var byteCode = null;
    var address = null;
    if (label !== null) {
      if (label in labelsToAddresses) {
        throw new Error('Duplicate label: ' + label);
      }
      labelsToAddresses[label] = i;
    } else {
      // Only try to parse it as instruction if it wasn't a label.
      try {
        instruction = pattern_engine.parseLine(line);
      } catch (e) {
        e.message = "Line " + lineNumber + ": " + e.message;
        throw e;
      }
      if (instruction !== null) {
        byteCode = instruction.toBytecode();
        address = i;
        i++;
      }
    }
    return {
      asm: line,
      label: label,
      instruction: instruction,
      byteCode: byteCode,
      address: address,
    };
  });
  // Assign addresses to branch instructions that have labels.
  $.each(assembled, function(_, struct) {
    if (struct.instruction &&
        struct.instruction instanceof pattern_engine.Jmp) {
      var label = struct.instruction.label;
      if (!(label in labelsToAddresses)) {
        throw new Error('Label not found: ' + label);
      }
      var address = labelsToAddresses[label];
      struct.instruction.address = address;
    }
  });
  return assembled;
};

// ------------------------------------------------------------------
