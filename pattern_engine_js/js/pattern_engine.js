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
  if (!/^-?\d+$/.test(token)) {
    throw new Error("Invalid literal value in operand: " + token);
  }
  v = parseInt(token, 10);
  if (long_form_ok) {
    if (v < -32768 || v > 32767) {
      throw new Error("Literal out of range: " + token);
    }
    if (v < -128 || v > 127) {
      this.long_form = true;
    }
  } else {
    if (v < -128 || v > 127) {
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
pattern_engine.parse_line = function(line) {
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

function PatternEngine(opt) {
    //hide "new"
    if (!(this instanceof PatternEngine))
        return new PatternEngine(opt);
    //make params optional
    opt = opt || {};

    this.strip = opt.strip || {};
    // handle other options...

    this.R = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    this.psr = 0;

    var that = this;

    this.getOp2Value = function (m, locmask) {
        switch (locmask) {
        case 0:
            return that.R[m];
        case 1:
            return m;
        default:
            throw new Error('Locmask ' + locmask + ' undefined');
        }
    };

    this.mask = function (value, mask) {
        return (value & mask) == mask;
    };

    this.getVal = function (value, start, end) {
        return (value >> end) & ~(~0 << (start - end + 1));
    };




    this.operations = {
        'ADD': {
            opcode: 0,
            fn: function (n, m) {
                return n + m;
            }
        },
        'SUB': {
            opcode: 1,
            fn: function (n, m) {
                return n - m;
            }
        },
        'MUL': {
            opcode: 2,
            fn: function (n, m) {
                return n * m;
            }
        },
        'DIV': {
            opcode: 3,
            fn: function (n, m) {
                return n / m;
            }
        },
        'MOD': {
            opcode: 4,
            fn: function (n, m) {
                return n % m;
            }
        },
        'MOV': {
            opcode: 5,
            fn: function (n, m) {
                return m;
            }
        },
        'LOAD': {
            opcode: 6,
            fn: function (ioAddr, unused) {
                return that.ioAddrs[ioAddr]();
            }
        },
        'WHSL': {
            opcode: 7,
            fn: function (hue, saturation, lightness) {
                that.strip.setPixel(that.currentPixelNo, jQuery.Color({
                    hue: hue,
                    saturation: saturation,
                    lightness: lightness
                }));
            }
        }
    };

    this.ioAddrs = {
        '/ticks': function () {
            return new Date();
        },
        '/total_pixels': function () {
            return that.strip.getLength();
        },
        '/pixel_number': function () {
            return this.currentPixelNo;
        }
    };

    // 31 30 29 28
    // N  Z  C  V
    var N = 1 << 31 >>> 0;
    var Z = 1 << 30 >>> 0;
    var C = 1 << 29 >>> 0;
    var V = 1 << 28 >>> 0;

    var testCondSet = function (cond) {
        return that.mask(that.psr, cond);
    };

    var testCondClear = function (cond) {
        return !(testCondSet(cond));
    };

    this.conditionals = {
        'EQ': {
            condCode: 0,
            fn: function () {
                return testCondSet(Z);
            }
        },
        'NE': {
            condCode: 1,
            fn: function () {
                return testCondClear(Z);
            }
        },
        'CS': {
            condCode: 2,
            fn: function () {
                return testCondSet(C);
            }
        },
        'CC': {
            condCode: 3,
            fn: function () {
                return testCondClear(C);
            }
        },
        'MI': {
            condCode: 4,
            fn: function () {
                return testCondSet(N);
            }
        },
        'PL': {
            condCode: 5,
            fn: function () {
                return testCondClear(N);
            }
        },
        'VS': {
            condCode: 6,
            fn: function () {
                return testCondSet(V);
            }
        },
        'VC': {
            condCode: 7,
            fn: function () {
                return testCondClear(V);
            }
        },
        'HI': {
            condCode: 8,
            fn: function () {
                return testCondSet(C) & testCondClear(Z);
            }
        },
        'LS': {
            condCode: 9,
            fn: function () {
                return testCondClear(C) | testCondSet(Z);
            }
        },
        'GE': {
            condCode: 10,
            fn: function () {
                return (
                    (testCondSet(N) & testCondSet(V)) |
                    (testCondClear(N) & testCondClear(V))
                );
            }
        },
        'LT': {
            condCode: 11,
            fn: function () {
                return (
                    (testCondSet(N) & testCondClear(V)) |
                    (testCondClear(N) & testCondSet(V))
                );
            }
        },
        'GT': {
            condCode: 12,
            fn: function () {
                return (
                    testCondClear(Z) &
                    (testCondSet(N) & testCondSet(V)) |
                    (testCondClear(N) & testCondSet(V))
                );
            }
        },
        'LE': {
            condCode: 13,
            fn: function () {
                return (
                    testCondSet(Z) |
                    (testCondSet(N) & testCondClear(V)) |
                    (testCondClear(N) & testCondSet(V))
                );
            }
        },
        'AL': {
            condCode: 14,
            fn: function () {
                return true;
            }
        },
        'NV': {
            condCode: 15,
            fn: function () {
                return false;
            }
        }
    };

    this.opcode_map = {};
    this.symbol_map = {};
    this.condcode_map = {};
    this.condsymbol_map = {};


    // Build efficient datastructures for traversing opcodes and symbols
    $.each(that.operations, function (index, value) {
        if (value.opcode in that.opcode_map) {
            throw new Error('Opcode ' + value.opcode + ' already defined');
        }
        if (index in that.symbol_map) {
            throw new Error('Symbol ' + index + ' already defined');
        }
        that.opcode_map[value.opcode] = value.fn;
        that.symbol_map[index] = value.opcode;
    });

    // Build efficient datastructures for traversing conditionals
    $.each(that.conditionals, function (index, value) {
        if (value.condCode in that.condcode_map) {
            throw new Error('Condition code ' + value.condCode + ' already defined');
        }
        if (index in that.condsymbol_map) {
            throw new Error('Conditional symbol ' + index + ' already defined');
        }
        that.condcode_map[value.condcode] = value.fn;
        that.condsymbol_map[index] = value.condCode;
    });

    this.Tokenize = function (textAssembly) {
        var lines = textAssembly.split('\n');
        var ins = [];
        $.each(lines, function () {
            ins.push(this.split(' '));
        });
        return ins;
    };

    this.Assemble = function (ins) {
        var INS_LENGTH_BYTES = 4;
        var bytecode = [];
        $.each(ins, function (index, value) {
            if (value.length != 4) {
                throw new Error('Illegal bytecode: Each instruction should have 4 elements');
            }
            var updateConditionals = false;
            if (value[0].substring(value[0].length - 1, value[0].length) == 'S') {
                updateConditionals = true;
                value[0] = value[0].substring(0, value[0].length - 1);
            }
            var rightTwo = value[0].substring(value[0].length - 2, value[0].length);
            var conditional = (that.conditionals.AL.condCode << 28) >>> 0;
            if (rightTwo in that.condsymbol_map) {
                conditional = (that.condsymbol_map[rightTwo] << 28) >>> 0;
                value[0] = value[0].substring(0, value[0].length - 2);
            }
            if (!(value[0] in that.symbol_map)) {
                throw new Error('Illegal assembly: ' + value[0] + ' is not a valid instruction');
            }
            var opcode = that.symbol_map[value[0]] << 21;
            var S = updateConditionals ? 1 << 20 : 0;
            var immediate = 0;
            if (value[1] > 15 | value[2] > 15) {
                throw new Error('Illegal assembly, all register values must be less than 15');
            }
            var Rd = (value[1] << 12) >>> 0;
            var Rn = (value[2] << 16) >>> 0;
            var Rs = value[3];
            var opcode2 = Rs;
            if (Rs[0] == '#') {
                Rs = Rs.substring(1, Rs.length);
                opcode2 = parseInt(Rs, 10);
                immediate = (1 << 24) >>> 0;
            }

            bytecode.push((conditional | immediate | opcode | S | Rn | Rd | opcode2) >>> 0);
        });
        return bytecode;
    };

    this.executeDSR = function (fn, dest, n, m, locmask, updateCond, condSuffix) {
        var rtn = fn(that.R[n], that.getOp2Value(m, locmask));
        var nCond = (rtn & -0x80000000) === -0x80000000 ? 1 : 0;
        var zCond = rtn === 0 ? 1 : 0;
        var cCond = rtn > (Math.pow(2, 31) - 1) ? 1 : 0;
        var vCond = rtn > 0x7fffffff ? 1 : 0;

        if (cCond === 1) {
            rtn = rtn - Math.pow(2, 31);
        }

        if (updateCond) {
            // Update conditionals
            this.psr = (nCond << 31) >>> 0 | (zCond << 30) >>> 0 | (cCond << 29) >>> 0 | (vCond << 28) >>> 0;
        }
        that.R[dest] = rtn;

    };

    this.opTypes = {
        'DSO': function (insBytecode) {
            return (that.getVal(insBytecode, 27, 26) === 0);
        }
    };

    this.getOpType = function (insBytecode) {
        var type;
        $.each(that.opTypes, function (index, value) {
            if (value(insBytecode)) {
                type = index;
            }
        });
        return type;
    };

    this.DecorateBytecode = function (ins) {
        var decorations = [];
        $.each(ins, function (index, value) {
            var type = that.getOpType(value);
            decorations.push(type);
        });
        return decorations;
    };

    this.ExecuteBytecode = function (ins) {
        var that = this;
        var getVal = that.getVal;
        $.each(ins, function (index, value) {
            if ((value >>> 0) != value) {
                throw new Error('Illegal bytecode: Each instruction should be less than 32 bits');
            }
            if (getVal(value, 27, 26) === 0) {
                // Data store operation
                /**
                 * 31-28: conditional
                 * 24-21: opcode
                 * 19-16: Rn
                 * 15-12: Rd
                 * 11-0: Operand2
                 */
                var cond = getVal(value, 31, 28);
                var opcode = getVal(value, 24, 21);
                if (!(opcode in that.opcode_map)) {
                    return new Error('Illegal bytecode: Unknown DSR opcode ' + opcode);
                }
                var Rn = getVal(value, 19, 16);
                var Rd = getVal(value, 15, 12);
                var immediate = getVal(value, 25, 25);
                var updateConditionals = getVal(value, 20, 20);
                if (immediate) {
                    var rot = getVal(value, 11, 8);
                    var imm = getVal(value, 7, 0);
                    var val = imm << rot >>> 0;
                    that.executeDSR(that.opcode_map[opcode], Rd, Rn, val, 1, updateConditionals, cond);

                } else {
                    var regnum = getVal(value, 3, 0);
                    that.executeDSR(that.opcode_map[opcode], Rd, Rn, regnum, 0, updateConditionals, cond);
                }

            } else {
                throw new Error('Bytecode couldn\'t be parsed: ' + value.toString(2));
            }

            //that.operations[value[0]](value[1], value[2], value[3]);
        });
        return true;
    };

}

module.exports = PatternEngine;
