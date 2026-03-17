# Arduino Local Uploader Bridge (WiFi / Bluetooth)

This repo now includes a local bridge server for the frontend upload dialog:

- `POST /upload/ota`
- `POST /upload/bluetooth`
- `GET /health`

Default bind: `http://127.0.0.1:3232` (matches `VITE_OTA_BRIDGE_URL` fallback used by the app).

## Run

```bash
npm run bridge:arduino
```

## Optional environment variables

- `ARDUINO_BRIDGE_HOST` (default `127.0.0.1`)
- `ARDUINO_BRIDGE_PORT` (default `3232`)
- `ARDUINO_BRIDGE_TOKEN` (if set, requests must include `Authorization: Bearer <token>`)
- `ESPOTA_PY` (path to `espota.py` if it is not discoverable in PATH)
- `ARDUINO_BRIDGE_TMP` (temp dir for uploaded artifacts)

## Current protocol support

### OTA (`/upload/ota`)

- Supported boards: `esp32`, `esp8266`
- Requires base64 `binary` and `host`
- Uses `espota.py`

Example payload:

```json
{
  "boardId": "esp32",
  "host": "192.168.1.42",
  "binary": "<base64 firmware>",
  "baudRate": 115200
}
```

### Bluetooth (`/upload/bluetooth`)

- AVR boards (`uno`, `nano`, `mega`, `leonardo`, `micro`) via `avrdude` + Intel HEX
- ESP boards (`esp32`, `esp8266`) via `esptool(.py)` + BIN

`device` should be a serial device path already provided by your OS Bluetooth stack (for example `/dev/rfcomm0` on Linux).

Example payload:

```json
{
  "boardId": "uno",
  "device": "/dev/rfcomm0",
  "hex": ":100000000C945C000C946E000C946E000C946E00F2"
}
```

## Health check

```bash
curl http://127.0.0.1:3232/health
```

The response reports which uploader tools are available in your environment.
