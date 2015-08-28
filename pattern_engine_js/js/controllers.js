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

// XXX: split out byte code controller from strip controller.
patternApp.controller('BytecodeCtrl', function ($scope, $interval) {
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
    maxAddress: 0,
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
    $scope.progData.maxAddress = 0;
    try {
      $scope.progData.assembled = pattern_engine.assemble(
          $scope.progData.asmInput);
    } catch (e) {
      $scope.errors = e.toString();
      throw e;
    }
    $.each($scope.progData.assembled, function(_, item) {
      if (item.address && item.address > $scope.progData.maxAddress) {
        $scope.progData.maxAddress = item.address;
      }
    });
  };

  $scope.reset = function() {
    $scope.progData.state = new pattern_engine.State();
    $scope.strip.currentPixel = 0;
    $scope.strip.currentTick = 0;
    $scope.setSpecialRegisters();
    $scope.strip.pixels = [];
    for (var i = 0; i < $scope.strip.pixelCount; i++) {
      $scope.strip.pixels.push(jQuery.Color(0, 0, 0));
    }
  };

  $scope.setSpecialRegisters = function() {
    $scope.progData.state.s[0] = $scope.strip.currentTick;
    $scope.progData.state.s[1] = $scope.strip.currentPixel;
    $scope.progData.state.s[2] = $scope.strip.pixelCount;
  }

  var pixelHandler = {
    setRgb: function(r, g, b) {
      var color = jQuery.Color({
        red: r, green: g, blue: b, alpha: 1,
      });
      $scope.strip.pixels[$scope.strip.currentPixel] = color;
      $scope.pixel.r = r; $scope.pixel.g = g; $scope.pixel.b = b;
      $scope.pixel.h = 0; $scope.pixel.s = 0; $scope.pixel.l = 0;
      $scope.pixelStyle['background-color'] = color;
    },
    setHsl: function(h, s, l) {
      var color = jQuery.Color({
        hue: 360.0 * h / 255.0,
        saturation: s / 255.0,
        lightness: l / 255.0,
        alpha: 1
      });
      $scope.strip.pixels[$scope.strip.currentPixel] = color;
      $scope.pixel.r = 0; $scope.pixel.g = 0; $scope.pixel.b = 0;
      $scope.pixel.h = h; $scope.pixel.s = s; $scope.pixel.l = l;
      $scope.pixelStyle['background-color'] = color;
    },
  };

  // Performs one step of the program. Returns true if program is not finished
  // yet for the current pixel.
  $scope.step = function () {
    var pc = $scope.progData.state.pc;
    $.each($scope.progData.assembled, function(_, item) {
      if (item.address == pc) {
        $scope.progData.state = item.instruction.execute(
            $scope.progData.state, pixelHandler);
      }
    });
    if ($scope.progData.state.pc > $scope.progData.maxAddress) {
      $scope.progData.state.pc = 0;
      var pixel = $scope.strip.currentPixel + 1;
      if (pixel >= $scope.strip.pixelCount) {
        pixel = 0;
      }
      $scope.strip.currentPixel = pixel;
      $scope.setSpecialRegisters();
      return false;
    }
    return true;
  };

  $scope.runPixel = function() {
    for (var i = 0; i < 10000; i++) {
      if (!$scope.step()) {
        return;
      }
    }
    throw new Error('Program did not finish within 10000 cycles.');
  };

  $scope.runFrame = function() {
    for (;;) {
      $scope.runPixel();
      if ($scope.strip.currentPixel == 0) {
        $scope.strip.currentTick += 100;
        return;
      }
    }
  };

  $scope.strip = {
    pixelCount: 24,
    currentPixel: 0,
    currentTick: 0,
    pixels: [],
  };

  $scope.changePixelCount = function() {
    $scope.reset();
  };

  var animation = null;

  $scope.startAnimation = function() {
      if (animation !== null) {
        return;
      }
      animation = $interval(function() {
        $scope.runFrame();
      }, 100);
  };

  $scope.stopAnimation = function() {
    if (animation !== null) {
      $interval.cancel(animation);
      animation = null;
    }
  };

  $scope.assemble();
  $scope.changePixelCount();
});

patternApp.filter('getbit', function () {
    return function (int32, position) {
        return (int32 & Math.pow(2, position)) >>> position;
    }
});
