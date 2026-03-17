#!/usr/bin/env node
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';

const PORT = Number(process.env.ARDUINO_BRIDGE_PORT || 3232);
const HOST = process.env.ARDUINO_BRIDGE_HOST || '127.0.0.1';
const BRIDGE_TOKEN = process.env.ARDUINO_BRIDGE_TOKEN || process.env.VITE_OTA_BRIDGE_TOKEN || '';
const TEMP_ROOT = process.env.ARDUINO_BRIDGE_TMP || path.join(os.tmpdir(), 'arduino-upload-bridge');

const AVR_BOARD_CONFIG = {
  uno: { mcu: 'atmega328p', programmer: 'arduino', baud: 115200 },
  nano: { mcu: 'atmega328p', programmer: 'arduino', baud: 115200 },
  mega: { mcu: 'atmega2560', programmer: 'wiring', baud: 115200 },
  leonardo: { mcu: 'atmega32u4', programmer: 'avr109', baud: 57600 },
  micro: { mcu: 'atmega32u4', programmer: 'avr109', baud: 57600 },
};

const ESP_BOARDS = new Set(['esp32', 'esp8266']);

function hasBin(bin) {
  const check = spawnSync('which', [bin], { stdio: 'ignore' });
  return check.status === 0;
}

function findEspota() {
  if (process.env.ESPOTA_PY) return process.env.ESPOTA_PY;
  if (hasBin('espota.py')) return 'espota.py';
  return null;
}

function json(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function ensureAuthorized(req) {
  if (!BRIDGE_TOKEN) return true;
  const auth = req.headers.authorization || '';
  return auth === `Bearer ${BRIDGE_TOKEN}`;
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function writeFirmwareFiles(dir, { binary, hex }) {
  const files = {};
  if (binary) {
    files.binaryPath = path.join(dir, 'firmware.bin');
    await fs.writeFile(files.binaryPath, Buffer.from(binary, 'base64'));
  }
  if (hex) {
    files.hexPath = path.join(dir, 'firmware.hex');
    await fs.writeFile(files.hexPath, hex, 'utf8');
  }
  return files;
}

function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      reject(new Error(`${command} exited with code ${code}\n${stderr || stdout}`));
    });
  });
}

async function handleOtaUpload(payload) {
  const { boardId, host, binary } = payload;
  if (!boardId || !host || !binary) {
    throw new Error('OTA requires boardId, host, and base64 binary');
  }

  const espota = findEspota();
  if (!espota) {
    throw new Error('espota.py not found. Set ESPOTA_PY or install ESP Arduino core tools.');
  }
  if (!ESP_BOARDS.has(boardId)) {
    throw new Error(`OTA bridge currently supports esp32/esp8266 only. Received: ${boardId}`);
  }

  const dir = await fs.mkdtemp(path.join(TEMP_ROOT, 'ota-'));
  try {
    const { binaryPath } = await writeFirmwareFiles(dir, payload);
    const cmd = `${espota} -i ${host} -f ${binaryPath}`;
    await runCommand('bash', ['-lc', cmd]);
    return { ok: true, method: 'ota', boardId, host };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function handleBluetoothUpload(payload) {
  const { boardId, device } = payload;
  if (!boardId || !device) {
    throw new Error('Bluetooth upload requires boardId and device');
  }

  const dir = await fs.mkdtemp(path.join(TEMP_ROOT, 'bt-'));
  try {
    const files = await writeFirmwareFiles(dir, payload);

    if (AVR_BOARD_CONFIG[boardId]) {
      if (!files.hexPath) throw new Error('AVR bluetooth upload requires hex payload');
      if (!hasBin('avrdude')) throw new Error('avrdude not found in PATH');
      const cfg = AVR_BOARD_CONFIG[boardId];
      await runCommand('avrdude', [
        '-p', cfg.mcu,
        '-c', cfg.programmer,
        '-P', device,
        '-b', String(cfg.baud),
        '-D',
        '-U', `flash:w:${files.hexPath}:i`,
      ]);
      return { ok: true, method: 'bluetooth', boardId, device, uploader: 'avrdude' };
    }

    if (ESP_BOARDS.has(boardId)) {
      if (!files.binaryPath) throw new Error('ESP bluetooth upload requires binary payload');
      if (!hasBin('esptool.py') && !hasBin('esptool')) {
        throw new Error('esptool.py/esptool not found in PATH');
      }
      const esptool = hasBin('esptool.py') ? 'esptool.py' : 'esptool';
      const offset = boardId === 'esp32' ? '0x10000' : '0x00000';
      await runCommand(esptool, ['--chip', boardId, '--port', device, 'write_flash', offset, files.binaryPath]);
      return { ok: true, method: 'bluetooth', boardId, device, uploader: esptool };
    }

    throw new Error(`Bluetooth bridge currently supports AVR+ESP boards. Received: ${boardId}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return;
  }

  try {
    if (req.url === '/health' && req.method === 'GET') {
      return json(res, 200, {
        ok: true,
        bridge: 'arduino-local-uploader',
        toolchain: {
          avrdude: hasBin('avrdude'),
          esptool: hasBin('esptool.py') || hasBin('esptool'),
          espota: Boolean(findEspota()),
        },
      });
    }

    if (!ensureAuthorized(req)) {
      return json(res, 401, { error: 'Unauthorized' });
    }

    if (req.url === '/upload/ota' && req.method === 'POST') {
      const payload = await readJson(req);
      const result = await handleOtaUpload(payload);
      return json(res, 200, result);
    }

    if (req.url === '/upload/bluetooth' && req.method === 'POST') {
      const payload = await readJson(req);
      const result = await handleBluetoothUpload(payload);
      return json(res, 200, result);
    }

    return json(res, 404, { error: 'Not found' });
  } catch (error) {
    return json(res, 400, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

await fs.mkdir(TEMP_ROOT, { recursive: true });
server.listen(PORT, HOST, () => {
  console.log(`[arduino-bridge] listening on http://${HOST}:${PORT}`);
});
