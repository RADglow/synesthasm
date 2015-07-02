var patternApp = angular.module('patternApp', []);

patternApp.controller('PatternAppCtrl', function ($scope, $interval) {

    $scope.rainbows = function (clockMs, pixelNo, numPixels, registers) {
        if (pixelNo == 0 && (clockMs - registers.R1 > 100)) {
            registers.R0++;
            registers.R1 = clockMs;
        }
        return jQuery.Color({
            hue: (360.0 / numPixels) * ((pixelNo + registers.R0) % numPixels),
            saturation: 1,
            lightness: 0.5,
            alpha: 1
        });
    };

    $scope.flash = function (clockMs, pixelNo, numPixels, registers) {
        if (pixelNo == 0 && (clockMs - registers.R1 > 400)) {
            registers.R0++;
            registers.R1 = clockMs;
        }
        return jQuery.Color({
            hue: (360.0 / numPixels) * ((pixelNo + registers.R0) % numPixels),
            saturation: 1,
            lightness: 0.5 * (registers.R0 % 2),
            alpha: 1
        });
    };
    var stop;

    $scope.pattern = $scope.rainbows
    $scope.registers = {
        'R0': 0,
        'R1': 0
    }

    $scope.strips = [{
        'name': 'Party Scarf Strip',
        'numPixels': 48,
        'pixelSize': 1,
        'layout': 'linear',
        'startSide': 'left'
    }];

    $scope.strips.map(function (strip) {
        strip.pixels = []
        for (var i = 0; i < strip.numPixels; i++) {
            strip.pixels.push(jQuery.Color(0, 0, 0));
        }
    })

    $scope.startAnimation = function () {
        if (angular.isDefined(stop)) return;
        stop = $interval(function () {
            $scope.animate(new Date)
        }, 10);
    };

    $scope.stopAnimation = function () {
        if (angular.isDefined(stop)) {
            $interval.cancel(stop);
            stop = undefined;
        }
    };

    $scope.animate = function (elapsedMs) {
        angular.forEach($scope.strips, function (strip, stripNo) {
            angular.forEach(strip.pixels, function (pixel, pixelNo) {
                strip.pixels[pixelNo] = $scope.pattern(elapsedMs, pixelNo, strip.pixels.length, $scope.registers);
            });
        });
    };

    $scope.setRainbowPattern = function () {
        $scope.pattern = $scope.rainbows;
    };

    $scope.setFlashPattern = function () {
        $scope.pattern = $scope.flash;
    };

    $scope.R = [0, 0, 0, 0, 0, 0, 0, 0];
    $scope.currentStrip = null;
    $scope.currentPixelNo = 0;

    $scope.operations = {
        'ADD': function (dest, n, m) {
            $scope.R[dest] = $scope.R[n] + $scope.R[m];
        },
        'SUB': function (dest, n, m) {
            $scope.R[dest] = $scope.R[n] - $scope.R[m];
        },
        'MUL': function (dest, n, m) {
            $scope.R[dest] = $scope.R[n] * $scope.R[m];
        },
        'DIV': function (dest, n, m) {
            $scope.R[dest] = $scope.R[n] / $scope.R[m];
        },
        'SUB': function (dest, n, m) {
            $scope.R[dest] = $scope.R[n] - $scope.R[m];
        },
        'MOD': function (dest, n, m) {
            $scope.R[dest] = $scope.R[n] % $scope.R[m];
        },
        'MOVC': function (dest, c, unused) {
            if (c == 'MAXINT32') {
                c = 2 ^ 32;
            }
            $scope.R[dest] = c;
        },
        'LOAD': function (dest, ioAddr, unused) {
            $scope.R[dest] = $scope.ioAddrs[ioAddr]();
        },
        'WHSL': function (hue, saturation, lightness) {
            $scope.currentStrip[currentPixelNo] = jQuery.Color({
                hue: hue,
                saturation: saturation,
                lightness: lightness
            })
        }
    };

    $scope.ioAddrs = {
        '/ticks': function () {
            return new Date;
        },
        '/total_pixels': function () {
            return $scope.currentStrip.pixels.length;
        },
        '/pixel_number': function () {
            return $scope.currentPixelNo;
        }
    };
});

patternApp.controller('BytecodeCtrl', function ($scope) {

    $scope.progData = {
        asmInput: 'MOV 0 0 #1',
        bytecodeOutput: 0,
        ins: [],
        currentLine: 0
    };

    $scope.bits = [];

    for (var i = 31; i >= 0; i--) {
        $scope.bits.push(i);
    };


    $scope.engine = PatternEngine();

    $scope.assemble = function () {
        $scope.progData.ins = $scope.engine.Tokenize($scope.progData.asmInput);
        $scope.progData.bytecodeOutput = $scope.engine.Assemble($scope.progData.ins);
    };

    $scope.reboot = function () {
        $scope.engine = PatternEngine();
        $scope.progData.currentLine = 0;
    };

    $scope.step = function () {
        var line = $scope.progData.currentLine;
        var bytecode = $scope.progData.bytecodeOutput[line];
        $scope.engine.ExecuteBytecode([bytecode]);
        $scope.progData.currentLine++;
    };

    $scope.run = function() {
        $scope.engine.ExecuteBytecode($scope.progData.bytecodeOutput);
        $scope.progData.currentLine = $scope.progData.bytecodeOutput.length + 1;
    }



});

patternApp.filter('getbit', function () {
    return function (int32, position) {
        return (int32 & Math.pow(2, position)) >> position;
    }
});
