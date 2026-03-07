

## Plan: Browser-Only Arduino Uno Flashing

### The Problem
The current upload code sends raw sketch text over serial — the board receives ASCII source code, not a compiled binary. Arduino boards need compiled Intel HEX firmware flashed via the STK500v1 bootloader protocol.

### Solution: Two-Stage Pipeline

```text
  sketch.ino ──▶ [Edge Function: compile] ──▶ .hex binary
                                                   │
  Browser ◀── Web Serial + STK500v1 protocol ◀─────┘
```

**Stage 1 — Server-side compilation** via a new `compile-arduino` edge function:
- Receives sketch code + board type (uno)
- Prepends minimal Arduino core stubs (implementations of `pinMode`, `digitalWrite`, `analogWrite`, `delay`, `Serial.begin/print/println`, `millis`, etc.) so simple sketches compile without the full Arduino framework
- Calls the free Compiler Explorer (Godbolt) API with `avr-gcc` targeting ATmega328P
- Extracts the compiled ELF, converts to Intel HEX, and returns it

**Stage 2 — Browser-side flashing** via a new STK500v1 protocol module:
- Opens Web Serial port at 115200 baud
- Toggles DTR to reset the board into bootloader mode
- Syncs with the Optiboot bootloader using STK500v1 commands (`STK_GET_SYNC`, `STK_SET_DEVICE`, `STK_ENTER_PROGMODE`, `STK_LOAD_ADDRESS`, `STK_PROG_PAGE`, `STK_LEAVE_PROGMODE`)
- Sends hex data in 128-byte pages (Uno page size)
- Reports progress back to the UI

### Files to Create/Modify

1. **`supabase/functions/compile-arduino/index.ts`** (new)
   - Edge function that compiles sketches via Compiler Explorer API
   - Includes minimal Arduino core stubs for common functions
   - Returns Intel HEX string or compilation errors

2. **`src/services/stk500.ts`** (new)
   - STK500v1 protocol constants and state machine
   - `flashHex(port: SerialPort, hexData: string, onProgress)` — parses Intel HEX, sends pages via bootloader protocol
   - Board reset via DTR toggle

3. **`src/services/hexParser.ts`** (new)
   - Intel HEX format parser: converts hex string to binary pages

4. **`src/services/arduinoUploadService.ts`** (rewrite)
   - `uploadViaSerial` now: calls compile edge function → parses hex → flashes via STK500v1
   - Shows step-by-step progress: "Compiling..." → "Resetting board..." → "Flashing page X/Y..." → "Done"

5. **`src/components/arduino/ArduinoUploadDialog.tsx`** (update)
   - Add progress log showing compilation and flash stages
   - Show compilation errors with line numbers if sketch fails to compile

6. **`supabase/config.toml`** — add `compile-arduino` function config with `verify_jwt = false`

### Limitations (Documented in UI)
- Only supports sketches using common Arduino functions (digital/analog I/O, Serial, delay, millis)
- Complex libraries (Wire, SPI, Servo) won't compile without full Arduino core — the dialog will explain this
- Only Arduino Uno (ATmega328P with Optiboot) is supported initially
- User must use Chrome/Edge for Web Serial API

### No API Keys Needed
- Compiler Explorer API is free and public (no auth required)
- Web Serial is a browser-native API

