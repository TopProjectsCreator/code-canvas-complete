# Arduino Web Platform Production Readiness (Tracks 1-5)

This document records the implemented safeguards for production hardening:

## 1) Board-correct compilation safety

- The web compiler now **accepts only verified board IDs**.
- Any other board returns a 422 response with `supportedBoards` so clients can handle capability mismatches safely.
- In the frontend, non-verified boards are still visible for planning/simulation, but upload is blocked with a clear message.

## 2) Upload architecture — Flash protocols by board family

### STK500v1 (AVR classic)
- **Boards**: Uno, Nano, Mega
- **Protocol**: Direct Web Serial → STK500v1 page writes
- **Implementation**: `stk500.ts` + `hexParser.ts`

### AVR109 / Caterina (ATmega32u4)
- **Boards**: Leonardo, Micro
- **Protocol**: 1200-baud touch → re-enumerate → AVR109 block writes at 57600 baud
- **Implementation**: `avr109.ts`

### SAM-BA (ARM — Arduino bootloader)
- **Boards**: Uno R4 WiFi (RA4M1), Due (SAM3X8E), Zero (SAMD21), MKR WiFi 1010 (SAMD21), Nano 33 IoT (SAMD21)
- **Protocol**: 1200-baud touch → SAM-BA CDC serial → page writes (board-specific geometry)
- **Implementation**: `sambaFlash.ts` with `SAMBA_BOARD_CONFIGS` per-board config
- Board differences handled by config: flash base, page size, bootloader reservation

### esptool SLIP (ESP ROM bootloader)
- **Boards**: ESP32, ESP8266
- **Protocol**: DTR/RTS toggle → SLIP-framed ROM bootloader → erase + write 16KB blocks
- **Implementation**: `esptool.ts`

### STM32 UART System Bootloader
- **Boards**: Portenta H7, GIGA R1 WiFi (STM32H747)
- **Protocol**: 1200-baud touch → 0x7F auto-baud → UART command set (AN3155) → 256-byte writes
- **Implementation**: `stm32serial.ts`

### Not supported (UF2 mass storage)
- **Boards**: Nano 33 BLE (nRF52840), Nano RP2040 Connect (RP2040)
- **Reason**: These boards use UF2 mass storage bootloader which browsers cannot access via WebSerial or WebUSB
- **Workaround**: Users directed to Arduino IDE or drag-and-drop .uf2 file

### OTA/Bluetooth bridge
- Endpoint configurable via `VITE_OTA_BRIDGE_URL` and `VITE_OTA_BRIDGE_TOKEN`
- This repo includes a local bridge server at `tools/arduino-bridge/server.mjs` (`npm run bridge:arduino`)
- Non-local remote bridges must use HTTPS
- Available for boards with WiFi/BT capability

## 3) Security controls

- Compile requests include Supabase publishable key and session bearer token (when available).
- Compile function rejects anonymous unauthenticated requests (requires either `apikey` or `authorization`).

## 4) Reliability controls

- Client compile and upload requests now use request timeouts.
- Network calls include bounded retry behavior with backoff.
- OTA/Bluetooth uploads use longer timeout windows and multiple attempts.

## 5) Simulator fidelity communication

- Expanded board/component catalog remains available for planning/simulation.
- Upload UI explicitly distinguishes planning boards from verified web flash boards.
- UF2-only boards show specific guidance instead of generic "not supported" message.

## Out of scope

Track #6 (compliance/governance) intentionally excluded per product direction.
