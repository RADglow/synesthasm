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
    asmInput: 'MOV R0, 130\n//comment\nWHSL R0, 255, 127',
    assembled: [],
    pc: 0,
    state: new pattern_engine.State(),
  };

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
    $scope.progData.assembled = pattern_engine.assemble(
        $scope.progData.asmInput);
  };

  $scope.reboot = function () {
    $scope.progData.state = new pattern_engine.State();
    $scope.progData.pc = 0;
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
    var pc = $scope.progData.pc;
    $.each($scope.progData.assembled, function(_, item) {
      if (item.address == pc) {
        $scope.progData.state = item.instruction.execute(
            $scope.progData.state, pixelHandler);
      }
    });
    $scope.progData.pc++;
  };

  $scope.run = function() {
    var maxPc = 0;
    $.each($scope.progData.assembled, function(_, item) {
      if (item.address && item.address > maxPc) {
        maxPc = item.address;
      }
    });
    while ($scope.progData.pc <= maxPc) {
      // TODO: add timeout.
      $scope.step();
    }
  };

  $scope.assemble();
});

patternApp.filter('getbit', function () {
    return function (int32, position) {
        return (int32 & Math.pow(2, position)) >>> position;
    }
});
