var patternApp = angular.module('patternApp', []);

patternApp.controller('BytecodeCtrl', function ($scope, $interval) {
  // Contains pre-baked programs from programs.js. At some point in the
  // future we might pull this in dynamically from server side.
  $scope.programs = $.map(programs, function(value, name) {
    return {name: name, code: value};
  });
  // Currently picked <option> for the program selection.
  $scope.programToLoad = null;
  // Data about the program.
  $scope.progData = {
    // Textarea contents - code to be assembled.
    asmInput: '',
    // Assembled code, output of pattern_engine.assemble().
    assembled: [],
    // Maximum code address (PC).
    maxAddress: 0,
    // Current virtual machine state.
    state: new pattern_engine.State(),
  };

  // Assembly errors, if any.
  $scope.errors = '';

  // Bit array for generating the bytecode table.
  $scope.bits = [];
  for (var i = 31; i >= 0; i--) {
    $scope.bits.push('' + Math.floor(i / 10) + ' ' + (i % 10));
  };

  // For debugging: pixel that was updated most recently.
  $scope.pixel = {
    r: 0, g: 0, b: 0,
    h: 0, s: 0, l: 0,
    style: {
      'background-color': 'black',
    },
  };

  // Assembles the code.
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

  // Resets the interpreter state.
  $scope.reset = function() {
    $scope.stopAnimation();
    $scope.progData.state = new pattern_engine.State();
    $scope.strip.currentPixel = 0;
    $scope.strip.currentTick = 0;
    $scope.setSpecialRegisters();
    $scope.strip.pixels = [];
    for (var i = 0; i < $scope.strip.pixelCount; i++) {
      $scope.strip.pixels.push(jQuery.Color(0, 0, 0));
    }
  };

  // Sets S0..S2 registers in program state.
  $scope.setSpecialRegisters = function() {
    $scope.progData.state.s[0] = $scope.strip.currentTick;
    $scope.progData.state.s[1] = $scope.strip.currentPixel;
    $scope.progData.state.s[2] = $scope.strip.pixelCount;
  }

  // Handler passed to patter engine to set pixel color.
  var pixelHandler = {
    setRgb: function(r, g, b) {
      var color = jQuery.Color({
        red: r, green: g, blue: b, alpha: 1,
      });
      $scope.strip.pixels[$scope.strip.currentPixel] = color;
      $scope.pixel.r = r; $scope.pixel.g = g; $scope.pixel.b = b;
      $scope.pixel.h = 0; $scope.pixel.s = 0; $scope.pixel.l = 0;
      $scope.pixel.style['background-color'] = color;
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
      $scope.pixel.style['background-color'] = color;
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

  // Runs virtual machine for the current pixel. Advances tick
  // time if we looped back to first pixel.
  $scope.runPixel = function() {
    for (var i = 0; i < 10000; i++) {
      if (!$scope.step()) {
        if ($scope.strip.currentPixel == 0) {
          $scope.strip.currentTick += 20;
        }
        return;
      }
    }
    throw new Error('Program did not finish within 10000 cycles.');
  };

  // Runs code for all (remaining) pixels for the current frame.
  $scope.runFrame = function() {
    for (;;) {
      $scope.runPixel();
      if ($scope.strip.currentPixel == 0) {
        return;
      }
    }
  };

  // Structure describing the strip.
  $scope.strip = {
    // Number of pixels in the strip.
    pixelCount: 24,
    // Which pixel is currently being debugged.
    currentPixel: 0,
    // Simulation time in ticks (milliseconds).
    currentTick: 0,
    // Array of objects, where each object describes one
    // pixel and contains CSS style to apply to that pixel.
    pixels: [],
  };

  // Handle for $interval, if animation is running.
  var animation = null;

  // Sets up periodic handler for animation.
  $scope.startAnimation = function() {
      if (animation !== null) {
        return;
      }
      $scope.assemble();
      animation = $interval(function() {
        $scope.runFrame();
      }, 20);
  };

  // Stops animation, removes the handler.
  $scope.stopAnimation = function() {
    if (animation !== null) {
      $interval.cancel(animation);
      animation = null;
    }
  };

  // Loads program selected by the 'programToLoad' picker.
  $scope.loadProgram = function() {
    $scope.reset();
    $scope.progData.asmInput = $scope.programToLoad.code();
    $scope.assemble();
  };

  // When starting, pick and load the first program.
  $scope.programToLoad = $scope.programs[0];
  $scope.loadProgram();

  // And assemble it.
  $scope.assemble();
  $scope.reset();
});

patternApp.filter('getbit', function() {
  return function(int32, position) {
    return (int32 & Math.pow(2, position)) >>> position;
  }
});

patternApp.filter('byteCodeNotNull', function() {
  return function(instructions) {
    return $.grep(instructions, function(instr) {
      return instr.byteCode !== null;
    });
  };
});

patternApp.filter('toHex', function() {
  return function(num) {
    var hex = parseInt(num, 10).toString(16);
    var padded = ('00000000' + hex).substring(hex.length);
    return '0x' + padded;
  }
});
