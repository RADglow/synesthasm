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

    this.operations = {
        'ADD': function (dest, n, m) {
            this.R[dest] = this.R[n] + this.R[m];
        },
        'SUB': function (dest, n, m) {
            this.R[dest] = this.R[n] - this.R[m];
        },
        'MUL': function (dest, n, m) {
            this.R[dest] = this.R[n] * this.R[m];
        },
        'DIV': function (dest, n, m) {
            this.R[dest] = this.R[n] / this.R[m];
        },
        'SUB': function (dest, n, m) {
            this.R[dest] = this.R[n] - this.R[m];
        },
        'MOD': function (dest, n, m) {
            this.R[dest] = this.R[n] % this.R[m];
        },
        'MOVC': function (dest, c, unused) {
            if (c == 'MAXINT32') {
                c = 2 ^ 32;
            }
            this.R[dest] = c;
        },
        'LOAD': function (dest, ioAddr, unused) {
            this.R[dest] = this.ioAddrs[ioAddr]();
        },
        'WHSL': function (hue, saturation, lightness) {
            this.strip.setPixel(this.currentPixelNo, jQuery.Color({
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
        })
        return true;
    };

}

module.exports = PatternEngine