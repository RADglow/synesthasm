# synesthasm

synesthasm is a simple bytecode "virtual machine".

# Architecture and Registers

* The virtual machine has 16 registers, named R0..R15. They contain 32 bits
  wide signed integers.
* There is a Program Counter, which is not directly accessible.
* There is a Status Register, containing Z (zero) and P (positive) flags.
  Status Register is set with CMP instruction and accessed using Jxx
  conditional branch instructions.

# Instructions

## Move stuff

~~~
MOV dest, src
~~~

## Do Maths

~~~
ADD dest, src1, src2
SUB dest, src1, src2
MUL dest, src1, src2
DIV dest, src1, src2
MOD dest, src1, src2

TODO: add shifts and bitwise operators.
~~~

## Test

~~~
CMP src1, src2 : perform (src1 - src2), update Z and P status flags.
~~~

## Branch

~~~
JMP address  # unconditional
JEQ address  # jumps if Z=1
JNE address  # jumps if Z=0
JG  address  # jumps if Z=0, P=1
JGE address  # jumps if P=1
JL  address  # jumps if Z=0 P=0
JLE address  # jumps if P=0
~~~

## Strip

Commands to write current pixel color. Each value (for either of r,g,b or hue,
sat, lightness) is in range 0..255. If a higher value is provided, lowest
8 bits are used.

~~~
WRGB r, g, b
WHSL hue, sat, lightness
~~~

## Misc

TODO: maybe add dedicated sine and cosine functions? Since we don't support
floating point, perhaps it makes sense to define them over some integer range
and implement it as a lookup table.

# Instruction encoding

All instructions are encoded as 32 bits. Bits 31..27 encode the opcode, the rest
are instruction specific.

~~~
Operands: in several instructions a 9-bit operand is used as follows. It takes
one of three forms, depending on first bits:
  8 7 6 5 4 3 2 1 0
  0 <- immediate ->   - immediate value, denoted as 123 or 0x7b.
  1 0 0 0 0 <-reg->   - register value, denoted as R0..R15.
  1 1 0 0 0 <- S ->   - special value, denoted as S0..S2, see below.

  The last form loads a special value, depending on the value of S:
  S0 (aka TICKS): number of ticks (in milliseconds since start)
  S1 (aka PIX): current pixel number
  S2 (aka COUNT): total number of pixels in the strip

MOV (opcode 1):
31 30 29 28 27 26 25 24 23 22 21 20 19 18 17 16 15 14 13 12 11 10 09 08 07 06 05 04 03 02 01 00
0  0  0  0  1  0  0  0  0  0  <- dest --> 0  0  <-- 16b immediate value, sign extended ------->
0  0  0  0  1  0  0  0  0  0  <- dest --> 0  1  <-- 16b immediate value, unsigned ------------>
0  0  0  0  1  0  0  0  0  0  <- dest --> 1  0  0  0  0  0  0  0  0  <-- operand ------------->

dest: destination register.
operand: see above.

JMP (opcode 2):
31 30 29 28 27 26 25 24 23 22 21 20 19 18 17 16 15 14 13 12 11 10 09 08 07 06 05 04 03 02 01 00
0  0  0  1  0  <- cond --> 0  0  0  0  0  0  0  <-- 16b absolute address --------------------->

cond encodes which flags must be set or not set.
  3  2   1  0
  P  NP  Z  NZ
  P: require that P=1
  NP: require that P=0
  Z: require that Z=1
  NZ: require that Z=0
  For example, a basic jump is cond=0b0000, while a JG is 0b1001.

CMP (opcode 3):
31 30 29 28 27 26 25 24 23 22 21 20 19 18 17 16 15 14 13 12 11 10 09 08 07 06 05 04 03 02 01 00
0  0  0  0  1  1  0  0  0  0  0  0  0  0  <- src1 -----------------> <- src2 ----------------->

WRGB (opcode 14):
31 30 29 28 27 26 25 24 23 22 21 20 19 18 17 16 15 14 13 12 11 10 09 08 07 06 05 04 03 02 01 00
0  1  1  1  1  <- red ------------------> <- green ----------------> <- blue ----------------->

each of red, green and blue is an operand.

WHSL (opcode 15):
31 30 29 28 27 26 25 24 23 22 21 20 19 18 17 16 15 14 13 12 11 10 09 08 07 06 05 04 03 02 01 00
0  1  1  1  1  <- hue ------------------> <- sat ------------------> <- lightness------------->

each of hue, sat and lightness is an operand.

Maths (opcodes 16..31):
31 30 29 28 27 26 25 24 23 22 21 20 19 18 17 16 15 14 13 12 11 10 09 08 07 06 05 04 03 02 01 00
<-- opcode --> 0  0  0  0  0  <- dest --> <- src1 -----------------> <- src2 ----------------->

bits 26..22 can be used in future if we run out of opcodes.

Opcodes:
16 ADD
17 SUB
18 MUL
19 DIV
20 MOD

src1 and src2 are operands, as above.
~~~

# Program flow

Initially all 16 registers are set to zeroes. For each frame, the program is
executed for each pixel from the beginning. The register contents remain valid between
invocations.

The program can read which pixel it is processing, total number of pixels and
current "tick" from special "S" registers.

Note: rough math for performance: if we are running at 16MHz with 128 pixels at
30fps, we have 4100 cycles per pixel per frame. Hopefully this will be enough.

# Example code

~~~
  // Register usage:
  // R15: previous update time.
  // R14: current shift index.

  // Are we on pixel zero?
  CMP PIX, 0
  JNE no_update
  // Yup, pixel zero.
  // Is it time to update? We use R15 for previous update time.
  SUB R0, TICKS, R15
  CMP R0, 100
  JLE no_update
  // Yes, time to update.
  MOV R15, TICKS
  ADD R14, R14, 1  // Increment current position.
no_update:
  // Calculate hue as ((PIX + R14) % COUNT) * 256 / COUNT.
  ADD R0, R14, PIX
  MOD R0, R0, COUNT
  MOV R1, 256
  MUL R0, R0, R1
  DIV R0, R0, COUNT
  WHSL R0, 255, 128
~~~
