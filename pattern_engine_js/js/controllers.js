var patternApp = angular.module('patternApp', []);

// TODO: add back support for more than one pixel.
// TODO: handle strip properties and ticks.

patternApp.controller('PatternAppCtrl', function ($scope, $interval) {
  /*
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
    */
});

patternApp.controller('BytecodeCtrl', function ($scope) {
  $scope.progData = {
    asmInput: (
        '  // Are we on pixel zero?\n' +
        '  CMP PIX, 0\n' +
        '  JNE no_update\n' +
        '  // Yup, pixel zero.\n' +
        '  // Is it time to update? We use R15 for previous update time.\n' +
        '  SUB R0, TICKS, R15\n' +
        '  CMP R0, 100\n' +
        '  JLE no_update\n' +
        '  // Yes, time to update.\n' +
        '  MOV R15, TICKS\n' +
        '  ADD R14, R14, 1  // Increment current position.\n' +
        'no_update:\n' +
        '// Calculate hue as ((PIX + R14) % COUNT) * 256 / COUNT.\n' +
        '  ADD R0, R14, PIX\n' +
        '  MOD R0, R0, COUNT\n' +
        '  MOV R1, 256\n' +
        '  MUL R0, R0, R1\n' +
        '  DIV R0, R0, COUNT\n' +
        '  WHSL R0, 255, 128\n'),
    assembled: [],
    state: new pattern_engine.State(),
  };

  $scope.errors = '';

  // TODO: rework this.
  $scope.bits = [];
  for (var i = 31; i >= 0; i--) {
    $scope.bits.push(i);
  };

  $scope.pixelStyle = {
    'background-color': 'black',
  };

  $scope.pixel = {
    r: 0, g: 0, b: 0,
    h: 0, s: 0, l: 0,
  };

  $scope.assemble = function() {
    $scope.errors = '';
    $scope.reset();
    $scope.progData.assembled = [];
    try {
      $scope.progData.assembled = pattern_engine.assemble(
          $scope.progData.asmInput);
    } catch (e) {
      $scope.errors = e.toString();
      throw e;
    }
  };

  $scope.reset = function () {
    $scope.progData.state = new pattern_engine.State();
  };

  var pixelHandler = {
    setRgb: function(r, g, b) {
      $scope.pixel.r = r; $scope.pixel.g = g; $scope.pixel.b = b;
      $scope.pixel.h = 0; $scope.pixel.s = 0; $scope.pixel.l = 0;
      $scope.pixelStyle['background-color'] = jQuery.Color({
        red: r, green: g, blue: b, alpha: 1,
      });
    },
    setHsl: function(h, s, l) {
      $scope.pixel.r = 0; $scope.pixel.g = 0; $scope.pixel.b = 0;
      $scope.pixel.h = h; $scope.pixel.s = s; $scope.pixel.l = l;
      $scope.pixelStyle['background-color'] = jQuery.Color({
        hue: 360.0 * h / 255.0,
        saturation: s / 255.0,
        lightness: l / 255.0,
        alpha: 1
      });
    },
  };

  $scope.step = function () {
    var pc = $scope.progData.state.pc;
    $.each($scope.progData.assembled, function(_, item) {
      if (item.address == pc) {
        $scope.progData.state = item.instruction.execute(
            $scope.progData.state, pixelHandler);
      }
    });
  };

  $scope.run = function() {
    var maxPc = 0;
    $.each($scope.progData.assembled, function(_, item) {
      if (item.address && item.address > maxPc) {
        maxPc = item.address;
      }
    });
    for (var i = 0; i < 10000; i++) {
      if ($scope.progData.state.pc > maxPc) {
        $scope.progData.state.pc = 0;
        return;
      }
      $scope.step();
    }
    throw new Error('Program did not finish within 10000 cycles.');
  };

  $scope.assemble();
});

patternApp.filter('getbit', function () {
    return function (int32, position) {
        return (int32 & Math.pow(2, position)) >>> position;
    }
});
