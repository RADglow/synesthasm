"use strict";
// Couple example programs.

var programs = {};

programs.rainbow = function() {
  return (
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
      '  WHSL R0, 255, 128\n'
  );
};

programs.flash = function() {
  return (
      '  // Flashes the whole strip in the same color.\n' +
      '\n' +
      '  // Are we on pix 0?\n' +
      '  CMP PIX, 0\n' +
      '  JNE no_update\n' +
      '\n' +
      '  // Yes, we are. Increment hue (R14).\n' +
      '  ADD R14, R14, 1\n' +
      '\n' +
      'no_update:\n' +
      '  // Calculate hue as R14 / 5. Taking lowest 8 bits for hue\n' +
      '  // is implied.\n' +
      '  DIV R0, R14, 5\n' +
      '  // Calculate lightness as: (R14 / 4) % 2 * 127\n' +
      '  DIV R2, R14, 16\n' +
      '  MOD R2, R2, 2\n' +
      '  MUL R2, R2, 127\n' +
      '  WHSL R0, 255, R2\n'
  );
};

programs.rgb = function() {
  return (
      '  // Red\n' +
      '  MOD R0, PIX, 3\n' +
      '  CMP R0, 0\n' +
      '  JEQ red\n' +
      '  CMP R0, 1\n' +
      '  JEQ green\n' +
      'blue:\n' +
      '  WRGB 0, 0, 255\n' +
      '  JMP end\n' +
      'red:\n' +
      '  WRGB 255, 0, 0\n' +
      '  JMP end\n' +
      'green:\n' +
      '  WRGB 0, 255, 0\n' +
      'end:\n'
  );
};
