

## Plan: Arduino Uno R4 WiFi — USB DFU Flashing Only

Since OTA is not viable from a hosted web app, this plan adds Uno R4 WiFi support via **USB only** using the WebUSB DFU protocol.

### Changes

**1. Add board definition** — `src/data/arduinoTemplates.ts`
- Add `uno_r4_wifi`: RA4M1 (ARM Cortex-M4), 256KB flash, 32KB RAM, 3.3V
- Mark `wifi: true, bluetooth: true` for display but disable OTA upload methods in the dialog with a tooltip explaining why

**2. ARM compilation path** — `supabase/functions/compile-arduino/index.ts`
- Detect board type; if `uno_r4_wifi`, use Compiler Explorer's `arm-none-eabi-gcc` compiler instead of `avrg1320`
- ARM-specific flags: `-mcpu=cortex-m4 -mthumb -Os -DF_CPU=48000000UL`
- Separate minimal core stubs for ARM (GPIO via register writes, UART for Serial)
- Output raw binary (not Intel HEX) since DFU expects flat binary

**3. WebUSB DFU flash service** — `src/services/dfuFlash.ts` (new)
- Use WebUSB API to claim the R4's DFU interface
- Implement standard USB DFU protocol: `DFU_DNLOAD` to send firmware pages, poll `DFU_GETSTATUS` until complete, `DFU_DETACH` to reboot
- Progress callback for page-by-page feedback

**4. Upload service routing** — `src/services/arduinoUploadService.ts`
- If board is `uno_r4_wifi`, call `dfuFlash` instead of `stk500`
- Keep STK500v1 path for classic AVR boards

**5. Upload dialog updates** — `src/components/arduino/ArduinoUploadDialog.tsx`
- When R4 WiFi is selected: show USB as only upload method
- WiFi/Bluetooth options shown as disabled with explanation: "OTA requires local network access — use Arduino IDE for WiFi uploads"
- Serial port picker replaced with "Connect USB Device" button (WebUSB uses `navigator.usb.requestDevice()` instead of `navigator.serial`)

### Limitations documented in UI
- Only basic Arduino functions compile (no WiFi/BLE libraries — those need full Arduino core)
- WebUSB requires Chrome/Edge
- Board must be in DFU mode (double-tap reset button on R4)

