function PatternEngine(opt) {
    //hide "new"
    if (!(this instanceof PatternEngine))
        return new PatternEngine(opt);
    //make params optional
    opt = opt || {};

    this.strip = opt.strip || {};
    // handle other options...

    this.R = [0, 0, 0, 0, 0, 0, 0, 0];
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

    this.executeDSR = function (fn, dest, n, m, locmask, updateCond, condSuffix) {
        var rtn = fn(that.R[n], that.getOp2Value(m, locmask));
        var nCond = (rtn & -0x80000000) === -0x80000000 ? 1 : 0;
        var zCond = rtn === 0 ? 1 : 0;
        var cCond = rtn > (Math.pow(2,31) - 1) ? 1 : 0;
        var vCond = rtn > 0x7fffffff ? 1 : 0;
           
        if (cCond === 1) {            
            rtn = rtn - Math.pow(2, 31);
        }

        if (updateCond) {
            // Update conditionals
            this.psr = nCond << 31 | zCond << 30 | cCond << 29 | vCond << 28;
        }
        that.R[dest] = rtn;

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
    var N = 1 << 31;
    var Z = 1 << 30;
    var C = 1 << 29;
    var V = 1 << 28;

    var testCondSet = function(cond) {
        return that.mask(that.psr, cond);
    };

    var testCondClear = function(cond) {
        return !(testCondSet(cond));
    };

    this.conditionals = {
        'EQ': {
            condCode: 0,
            fn: function() { return testCondSet(Z); }
        },
        'NE': {
            condCode: 1,
            fn: function() { return testCondClear(Z); }
        },
        'CS': {
            condCode: 2,
            fn: function() { return testCondSet(C); }
        },
        'CC': {
            condCode: 3,
            fn: function() { return testCondClear(C); }
        },
        'MI': {
            condCode: 4,
            fn: function() { return testCondSet(N); }
        },
        'PL': {
            condCode: 5,
            fn: function() { return testCondClear(N); }
        },
        'VS': {
            condCode: 6,
            fn: function() { return testCondSet(V); }
        },
        'VC': {
            condCode: 7,
            fn: function() { return testCondClear(V); }
        },
        'HI': {
            condCode: 8,
            fn: function() {
                return testCondSet(C) & testCondClear(Z);
            }
        },
        'LS': {
            condCode: 9,
            fn: function() {
                return testCondClear(C) | testCondSet(Z);
            }
        },
        'GE': {
            condCode: 10,
            fn: function() {
                return (
                    (testCondSet(N) & testCondSet(V)) |
                    (testCondClear(N) & testCondClear(V))
                );
            }
        },
        'LT': {
            condCode: 11,
            fn: function() {
                return (
                    (testCondSet(N) & testCondClear(V)) |
                    (testCondClear(N) & testCondSet(V))
                );
            }
        },
        'GT': {
            condCode: 12,
            fn: function() {
                return (
                    testCondClear(Z) &
                    (testCondSet(N) & testCondSet(V)) |
                    (testCondClear(N) & testCondSet(V))
                );
            }
        },
        'LE': {
            condCode: 13,
            fn: function() {
                return (
                    testCondSet(Z) |
                    (testCondSet(N) & testCondClear(V)) |
                    (testCondClear(N) & testCondSet(V))
                );
            }
        },
        'AL': {
            condCode: 14,
            fn: function() {
                return true;
            }
        },
        'NV': {
            condCode: 15,
            fn: function() {
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
            if (!(value[0] in that.symbol_map)) {
                throw new Error('Illegal bytecode: ' + value[0] + ' is not a valid instruction');
            }
            var rightTwo = value[0].substring(value[0].length - 2, value[0].length);
            var conditional = 0;
            if (rightTwo in that.condsymbol_map) {
                conditional = that.condsymbol_map[rightTwo] << 27;
                value[0] = value[0].substring(0, value[0].length - 2);
            }
            var opcode = that.symbol_map[value[0]] << 21;
            var S = updateConditionals ? 1 << 20 : 0;
            var immediate = 0;
            var Rd = value[1] << 12;
            var Rn = value[2] << 16;
            var Rs = value[3];
            var opcode2 = Rs;
            if (typeof (Rs) == 'string') {
                opcode2 = parseInt(Rs, 10);
                immediate = 1 << 25;
            }

            bytecode.push(conditional | immediate | opcode | S | Rn | Rd | opcode2);
            bytecode.push();
        });
        return bytecode;
    };

    this.ExecuteBytecode = function (ins) {
        var that = this;
        var getVal = that.getVal;
        $.each(ins, function (index, value) {
            if ((value >> 0) != value) {
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
                    return Error('Illegal bytecode: Unknown DSR opcode ' + opcode);
                }
                var Rn = getVal(value, 19, 16);
                var Rd = getVal(value, 15, 12);
                var immediate = getVal(value, 25, 25);
                var updateConditionals = getVal(value, 20, 20);
                if (immediate) {
                    var rot = getVal(value, 11, 8);
                    var imm = getVal(value, 7, 0);
                    var val = imm << rot;
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
