# Arduino Web Platform Production Readiness (Tracks 1-5)

This document records the implemented safeguards for production hardening:

## 1) Board-correct compilation safety

- The web compiler now **accepts only verified board IDs**:
  - `uno`, `nano`, `mega`, `leonardo`, `micro`, `uno_r4_wifi`.
- Any other board returns a 422 response with `supportedBoards` so clients can handle capability mismatches safely.
- In the frontend, non-verified boards are still visible for planning/simulation, but upload is blocked with a clear message.

## 2) Upload architecture hardening

- **AVR boards** (Uno, Nano, Mega, Leonardo, Micro): Flashed via Web Serial using STK500v1 protocol.
- **ARM boards** (Uno R4 WiFi): Flashed via Web Serial using SAM-BA protocol with 1200-baud bootloader trigger.
  - Previously used WebUSB DFU, which failed due to browser "protected class" restrictions on DFU interfaces.
  - Now uses the same protocol as `bossac` (Arduino's official upload tool for R4 WiFi).
- OTA/Bluetooth bridge endpoint is configurable via:
  - `VITE_OTA_BRIDGE_URL`
  - `VITE_OTA_BRIDGE_TOKEN`
- Non-local remote bridges must use HTTPS.
- OTA/Bluetooth requests include bearer auth if token is configured.

## 3) Security controls

- Compile requests include Supabase publishable key and session bearer token (when available).
- Compile function rejects anonymous unauthenticated requests (requires either `apikey` or `authorization`).

## 4) Reliability controls

- Client compile and upload requests now use request timeouts.
- Network calls include bounded retry behavior with backoff.
- OTA/Bluetooth uploads use longer timeout windows and multiple attempts.

## 5) Simulator fidelity communication

- Expanded board/component catalog remains available for planning/simulation.
- Upload UI explicitly distinguishes planning boards from verified web flash boards to prevent false production assumptions.

## Out of scope

Track #6 (compliance/governance) intentionally excluded per product direction.
