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
  this.z = false;
  this.p = false;
};

pattern_engine.State.prototype.clone = function() {
  var state = new pattern_engine.State();
  state.r = this.r.slice();
  state.s = this.s.slice();
  state.z = this.z;
  state.p = this.p;
  return state;
};

// Instructions.

// ------------------------------------------------------------------

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
  $.each(pattern_engine.S_REGISTERS, function(k, v) {
    if (token == k) {
      this.s = v;
      return;
    }
  });
  if (!/^(?:-?\d+|0[xX][0-9a-fA-F]+)$/.test(token)) {
    throw new Error("Invalid literal value in operand: " + token);
  }
  v = parseInt(token, 0);
  if (long_form_ok) {
    if (v < -32768 || v > 32767) {
      throw new Error("Literal out of range: " + token);
    }
    if (v < 0 || v > 255) {
      this.long_form = true;
    }
  } else {
    if (v < 0 || v > 255) {
      throw new Error("Literal out of range: " + token);
    }
  }
  this.value = v;
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

// Strip (WRGB, WHSL) instructions.
pattern_engine.WriteStrip = function(tokens) {
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
  return state.clone();
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

    cmp: null,

    jmp: null,
    jeq: null,
    jne: null,
    jg: null,
    jge: null,
    jl: null,
    jle: null,

    wrgb: pattern_engine.WriteStrip,
    whsl: pattern_engine.WriteStrip,

    add: null,
    sub: null,
    mul: null,
    div: null,
    mod: null,
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

// ------------------------------------------------------------------

// XXX: document.
pattern_engine.assemble = function(text) {
  var lines = text.split('\n');
  var assembled = $.map(lines, function(line) {
    var out = {};
    out.asm = line;
    var parsed = pattern_engine.parseLine(line);
    if (parsed) {
      out.instruction = parsed;
      out.byteCode = parsed.toBytecode();
    }
    return out;
  });
  // Renumber.
  var i = 0;
  var renumbered = $.map(assembled, function(struct) {
    if (struct.byteCode) {
      struct.address = i;
      i++;
    } else {
      struct.address = null;
    }
    return struct;
  });
  return assembled;
};

// ------------------------------------------------------------------
