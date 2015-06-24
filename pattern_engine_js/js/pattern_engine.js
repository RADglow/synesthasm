function PatternEngine(opt) {
    //hide "new"
    if (!(this instanceof PatternEngine))
        return new PatternEngine(opt)
    //make params optional
    opt = opt || {}

    this.strip = opt.strip || {}
    // handle other options...

    this.R = [0, 0, 0, 0, 0, 0, 0, 0];
    this.currentPixelNo = 0;
    this.currentInstruction = 0;
    var that = this;
    this.operations = {
        'ADD': function (dest, n, m) {
            that.R[dest] = that.R[n] + that.R[m];
        },
        'SUB': function (dest, n, m) {
            that.R[dest] = that.R[n] - that.R[m];
        },
        'MUL': function (dest, n, m) {
            that.R[dest] = that.R[n] * that.R[m];
        },
        'DIV': function (dest, n, m) {
            that.R[dest] = that.R[n] / that.R[m];
        },
        'SUB': function (dest, n, m) {
            that.R[dest] = that.R[n] - that.R[m];
        },
        'MOD': function (dest, n, m) {
            that.R[dest] = that.R[n] % that.R[m];
        },
        'MOVC': function (dest, c, unused) {
            if (c == 'MAXINT32') {
                c = 2 ^ 32;
            }
            that.R[dest] = c;
        },
        'LOAD': function (dest, ioAddr, unused) {
            that.R[dest] = that.ioAddrs[ioAddr]();
        },
        'WHSL': function (hue, saturation, lightness) {
            that.strip.setPixel(that.currentPixelNo, jQuery.Color({
                hue: hue,
                saturation: saturation,
                lightness: lightness
            }))
        }
    };

    this.ioAddrs = {
        '/ticks': function () {
            return new Date;
        },
        '/total_pixels': function () {
            return this.strip.getLength();
        },
        '/pixel_number': function () {
            return this.currentPixelNo;
        }
    };

    this.ExecuteBytecode = function (ins, strips) {
        var that = this;
        $.each(ins, function (index, value) {
            if (value.length != 4) {
                throw new Error('Illegal bytecode: Each instruction should have 4 elements');
            }
            if (!(value[0] in that.operations)) {
                throw new Error('Illegal bytecode: ' + value[0] + ' is not a valid instruction');
            }
            that.operations[value[0]](value[1], value[2], value[3]);
        })
        return true;
    };

}

module.exports = PatternEngine