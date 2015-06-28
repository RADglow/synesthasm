function PatternEngine(opt) {
    //hide "new"
    if (!(this instanceof PatternEngine))
        return new PatternEngine(opt)
    //make params optional
    opt = opt || {}

    this.strip = opt.strip || {}
    // handle other options...

    this.R = [0, 0, 0, 0, 0, 0, 0, 0];
    this.psr = 0;

    var that = this;
    this.getOp2Value = function (m, locmask) {
        switch (locmask) {
            case 0b000:
                return that.R[m];
                break;
            case 0b001:
                return m;
                break;
            default:
                throw new Error('Locmask ' + locmask + ' undefined');
        };
    };
    this.executeDSR = function (fn, dest, n, m, locmask, updateCond) {
        fn(dest, that.R[n], that.getOp2Value(m, locmask));
        if (updateCond) {
            // Update conditionals
        }

    }
    this.operations = {
        'ADD': {
            opcode: 0,
            fn: function (dest, n, m) {
                that.R[dest] = n + m;
            }
        },
        'SUB': {
            opcode: 1,
            fn: function (dest, n, m) {
                that.R[dest] = n - m;
            }
        },
        'MUL': {
            opcode: 2,
            fn: function (dest, n, m) {
                that.R[dest] = n * m;
            }
        },
        'DIV': {
            opcode: 3,
            fn: function (dest, n, m) {
                that.R[dest] = n / m;
            }
        },
        'MOD': {
            opcode: 4,
            fn: function (dest, n, m) {
                that.R[dest] = n % m;
            }
        },
        'MOV': {
            opcode: 5,
            fn: function (dest, n, m) {
                that.R[dest] = m;
            }
        },
        'LOAD': {
            opcode: 6,
            fn: function (dest, ioAddr, unused) {
                that.R[dest] = that.ioAddrs[ioAddr]();
            }
        },
        'WHSL': {
            opcode: 7,
            fn: function (hue, saturation, lightness) {
                that.strip.setPixel(that.currentPixelNo, jQuery.Color({
                    hue: hue,
                    saturation: saturation,
                    lightness: lightness
                }))
            }
        }
    };

    this.ioAddrs = {
        '/ticks': function () {
            return new Date;
        },
        '/total_pixels': function () {
            return that.strip.getLength();
        },
        '/pixel_number': function () {
            return this.currentPixelNo;
        }
    };
    /**
    this.opcode_map = {
        0b0000: that.operations.ADD,
        0b0001: that.operations.SUB,
        0b0010: that.operations.MOV,
    };
    this.symbol_map = {
        'ADD': that.operations.ADD.opcode,
        'SUB': that.operations.SUB.opcode,
        'MOV': that.operations.MOV.opcode,
    };

    **/
    this.opcode_map = {};
    this.symbol_map = {};
    $.each(that.operations, function (index, value) {
        that.opcode_map[value.opcode] = value.fn;
        that.symbol_map[index] = value.opcode
    });

    this.Assemble = function (ins) {
        var INS_LENGTH_BYTES = 4
        var bytecode = [];
        $.each(ins, function (index, value) {
            if (value.length != 4) {
                throw new Error('Illegal bytecode: Each instruction should have 4 elements');
            }
            var updateConditionals = false;
            if (value[0].substring(value[0].length - 1, value[0].length) == 'S') {
                updateConditionals = true;
            }
            if (!(value[0] in that.symbol_map)) {
                throw new Error('Illegal bytecode: ' + value[0] + ' is not a valid instruction');
            }
            var conditional = 0b0000 << 28;
            var opcode = that.symbol_map[value[0]] << 21;
            var S = updateConditionals ? 1 < 20 : 0;
            var immediate = 0;
            var Rd = value[1] << 12;
            var Rn = value[2] << 16;
            var Rs = value[3];
            if (typeof (Rs) == 'string') {
                opcode2 = parseInt(Rs);
                immediate = 1 << 25;
            }
            var opcode2 = Rs;
            bytecode.push(conditional | immediate | opcode | S | Rn | Rd | opcode2);
            bytecode.push();
        })
        return bytecode;
    };

    this.ExecuteBytecode = function (ins) {
        var mask = function (value, mask) {
            return (value & mask) == mask
        };

        var getVal = function (value, start, end) {
            return (value >> end) & ~(~0 << (start - end + 1))
        }

        var that = this;
        $.each(ins, function (index, value) {
            if ((value >> 0) != value) {
                throw new Error('Illegal bytecode: Each instruction should be less than 32 bits');
            }
            if (getVal(value, 27, 26) == 0b00) {
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
                    that.executeDSR(that.opcode_map[opcode], Rd, Rn, val, 0b001, updateConditionals);

                } else {
                    var regnum = getVal(value, 3, 0);
                    that.executeDSR(that.opcode_map[opcode], Rd, Rn, regnum, 0b000, updateConditionals);
                }

            } else {
                throw new Error('Bytecode couldn\'t be parsed: ' + value.toString(2));
            }

            //that.operations[value[0]](value[1], value[2], value[3]);
        })
        return true;
    };

}

module.exports = PatternEngine