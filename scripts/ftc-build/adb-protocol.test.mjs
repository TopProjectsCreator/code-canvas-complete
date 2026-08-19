#!/usr/bin/env node
/**
 * ADB wire-protocol test for the webusb-adb.ts upload path.
 *
 * Runs the EXACT packet logic used by src/lib/webusb-adb.ts (message framing,
 * CNXN handshake, sync SEND/DATA/DONE/QUIT push, shell streams) over a TCP
 * socket against a fake adbd server that models real adbd behavior. Pushes a
 * real built APK end-to-end and verifies the bytes arrive intact.
 *
 * Usage: node scripts/ftc-build/adb-protocol.test.mjs [apkPath]
 */
import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_APK = path.join(
  __dirname, '..', '..', '.ftc-toolchain', 'projects', 'repos',
  'EdwardCasler-FTC-DECODE-25-Edward_branch', 'TeamCode', 'build', 'outputs', 'apk', 'debug', 'TeamCode-debug.apk',
);
const args = process.argv.slice(2);
const REAL = args.includes('--real');
const APK_PATH = args.find((a) => !a.startsWith('--')) || DEFAULT_APK;

// ---------------------------------------------------------------------------
// Protocol constants — mirrors src/lib/webusb-adb.ts exactly
// ---------------------------------------------------------------------------
const A_CNXN = 0x4e584e43;
const A_OPEN = 0x4e45504f;
const A_OKAY = 0x59414b4f;
const A_WRTE = 0x45545257;
const A_CLSE = 0x45534c43;
const A_AUTH = 0x48545541;
const ADB_VERSION = 0x01000000;
const MAX_PAYLOAD = 4096;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let failures = 0;
let checks = 0;
function check(name, ok, detail = '') {
  checks++;
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`);
  }
}

// Same framing helpers as webusb-adb.ts
function buildMessage(command, arg0, arg1, data = new Uint8Array(0)) {
  const header = new ArrayBuffer(24);
  const view = new DataView(header);
  view.setUint32(0, command, true);
  view.setUint32(4, arg0, true);
  view.setUint32(8, arg1, true);
  view.setUint32(12, data.length, true);
  let checksum = 0;
  for (let i = 0; i < data.length; i++) checksum += data[i];
  view.setUint32(16, checksum, true);
  view.setUint32(20, command ^ 0xffffffff, true);
  const result = new Uint8Array(24 + data.length);
  result.set(new Uint8Array(header), 0);
  result.set(data, 24);
  return result.buffer;
}

function parseMessage(buffer) {
  const view = new DataView(buffer);
  const command = view.getUint32(0, true);
  const arg0 = view.getUint32(4, true);
  const arg1 = view.getUint32(8, true);
  const dataLen = view.getUint32(12, true);
  const data = new Uint8Array(buffer, 24, dataLen);
  return { command, arg0, arg1, data };
}

// ---------------------------------------------------------------------------
// Fake adbd — models real adbd behavior for sync (SEND/DATA/DONE/QUIT) and shell
// ---------------------------------------------------------------------------
class FakeAdbd {
  constructor(apkSha) {
    this.apkSha = apkSha;
    this.receivedFile = Buffer.alloc(0);
    this.pushedPath = null;
    this.pushedMode = null;
    this.shellRequests = [];
    this.hostWrteOkays = 0;
    this.server = null;
    this.port = 0;
  }

  start() {
    return new Promise((resolve) => {
      this.server = net.createServer((socket) => this.handleConnection(socket));
      this.server.listen(0, '127.0.0.1', () => {
        this.port = this.server.address().port;
        resolve(this.port);
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) this.server.close(() => resolve());
      else resolve();
    });
  }

  handleConnection(socket) {
    let buf = Buffer.alloc(0);
    const expect = { command: null, arg0: 0, arg1: 0, dataLen: 0 };
    const sync = { phase: 'idle', outFile: null, outStream: null, sendIdLen: 0, sendPath: '', sendMode: 0 };
    const conn = { hostLocal: 0, deviceLocal: 0 };

    const send = (command, arg0, arg1, data = new Uint8Array(0)) => {
      socket.write(Buffer.from(buildMessage(command, arg0, arg1, data)));
    };

    const handleSyncPacket = (packet) => {
      if (packet.length < 8) return;
      const id = packet.slice(0, 4).toString('latin1');
      const idLen = packet.readUInt32LE(4);
      const payload = packet.slice(8, 8 + idLen);
      if (id === 'SEND') {
        // adbd: strchr(path, ',') bounded by id_length; mode via strtoul(base 0)
        const str = payload.toString('latin1');
        const commaIdx = str.indexOf(',');
        sync.sendPath = commaIdx >= 0 ? str.slice(0, commaIdx) : str;
        sync.sendMode = commaIdx >= 0 ? parseInt(str.slice(commaIdx + 1), 10) || 0 : 0;
        sync.outStream = [];
        this.pushedPath = sync.sendPath;
        this.pushedMode = sync.sendMode;
      } else if (id === 'DATA') {
        if (sync.outStream) sync.outStream.push(packet.slice(8, 8 + idLen));
      } else if (id === 'DONE') {
        if (sync.outStream) {
          this.receivedFile = Buffer.concat(sync.outStream);
          sync.outStream = null;
        }
      } else if (id === 'QUIT') {
        // end of sync stream
      } else {
        throw new Error(`unknown sync id: ${id}`);
      }
    };

    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        if (expect.command === null) {
          if (buf.length < 24) return;
          expect.command = buf.readUInt32LE(0);
          expect.arg0 = buf.readUInt32LE(4);
          expect.arg1 = buf.readUInt32LE(8);
          expect.dataLen = buf.readUInt32LE(12);
          buf = buf.slice(24);
        }
        if (buf.length < expect.dataLen) return;
        const data = buf.slice(0, expect.dataLen);
        buf = buf.slice(expect.dataLen);

        const cmd = expect.command;
        const arg0 = expect.arg0;
        const arg1 = expect.arg1;
        expect.command = null;

        if (cmd === A_CNXN) {
          conn.hostLocal = arg0;
          conn.deviceLocal = 1;
          const banner = textEncoder.encode('device::features=shell_v2,cmd,stat_v2');
          send(A_CNXN, ADB_VERSION, MAX_PAYLOAD, banner);
        } else if (cmd === A_OPEN) {
          const service = Buffer.from(data).toString('latin1').replace(/\0.*$/, '');
          conn.deviceLocal++;
          const remoteId = conn.deviceLocal;
          send(A_OKAY, remoteId, arg0, new Uint8Array(0));
          if (service.startsWith('sync:')) {
            sync.phase = 'sync';
            sync.outStream = [];
          } else if (service.startsWith('shell:')) {
            const cmdText = service.slice('shell:'.length).replace(/\0+$/, '');
            this.shellRequests.push(cmdText);
            const out = Buffer.from(`mock-output-of:${cmdText}\n`);
            const wrte = buildMessage(A_WRTE, remoteId, arg0, new Uint8Array(out));
            socket.write(Buffer.from(wrte));
            send(A_CLSE, remoteId, arg0, new Uint8Array(0));
          }
        } else if (cmd === A_WRTE) {
          this.hostWrteOkays++;
          if (sync.phase === 'sync') {
            try {
              handleSyncPacket(Buffer.from(data));
            } catch (err) {
              send(A_CLSE, arg1, arg0, new Uint8Array(0));
              return;
            }
          }
          send(A_OKAY, arg1, arg0, new Uint8Array(0));
        } else if (cmd === A_CLSE) {
          // stream closed by host
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Minimal ADB client — same packet flow as webusb-adb.ts
// ---------------------------------------------------------------------------
class AdbClient {
  constructor(port, host = '127.0.0.1') {
    this.port = port;
    this.host = host;
    this.socket = null;
    this.buf = Buffer.alloc(0);
    this.pending = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.connect(this.port, this.host, resolve);
      this.socket.on('error', reject);
      this.socket.on('data', (chunk) => {
        this.buf = Buffer.concat([this.buf, chunk]);
        this.drain();
      });
    });
  }

  readMessage() {
    return new Promise((resolve) => {
      this.pending.push(resolve);
      this.drain();
    });
  }

  // Read the next message belonging to a specific host stream (arg1 is the
  // host's local id on every device->host packet). Stale packets from a
  // previous stream (e.g. a duplicate CLSE) are discarded, mirroring how
  // WebUSB transports can deliver leftovers.
  async readStreamMessage(localId) {
    for (;;) {
      const msg = await this.readMessage();
      if (msg.arg1 === localId) return msg;
    }
  }

  drain() {
    while (this.pending.length > 0 && this.buf.length >= 24) {
      const dataLen = this.buf.readUInt32LE(12);
      if (this.buf.length < 24 + dataLen) return;
      // Copy into an exact-sized ArrayBuffer: Buffer.from() can share Node's
      // 8KB slab, and parseMessage expects buffer.byteLength === 24 + dataLen
      // (WebUSB provides exact buffers, so webusb-adb.ts is unaffected).
      const exact = new Uint8Array(24 + dataLen);
      exact.set(this.buf.subarray(0, 24 + dataLen));
      const msg = parseMessage(exact.buffer);
      if (process.env.ADB_DEBUG) {
        const cmdName = ['CNXN', 'OPEN', 'OKAY', 'WRTE', 'CLSE', 'AUTH'][[A_CNXN, A_OPEN, A_OKAY, A_WRTE, A_CLSE, A_AUTH].indexOf(msg.command)] || `0x${msg.command.toString(16)}`;
        const preview = Buffer.from(msg.data).toString('latin1').replace(/[^\x20-\x7e]/g, '.').slice(0, 40);
        console.log(`    [recv] ${cmdName} arg0=${msg.arg0} arg1=${msg.arg1} data="${preview}"`);
      }
      this.buf = this.buf.subarray(24 + dataLen);
      this.pending.shift()(msg);
    }
  }

  write(msg) {
    return new Promise((resolve) => this.socket.write(Buffer.from(msg), resolve));
  }

  close() {
    this.socket.destroy();
  }
}

async function adbConnect(client) {
  const banner = textEncoder.encode('host::features=shell_v2');
  await client.write(buildMessage(A_CNXN, ADB_VERSION, MAX_PAYLOAD, banner));
  const response = await client.readMessage();
  return response;
}

// Mirrors webusb-adb.ts adbPush, with response verification added (each
// response must be A_OKAY; a sync-level FAIL from adbd is surfaced as an error).
async function adbPush(client, fileData, remotePath, onProgress) {
  const localId = Math.floor(Math.random() * 0xffffffff);
  const destination = textEncoder.encode('sync:\0');
  await client.write(buildMessage(A_OPEN, localId, 0, destination));
  const okResp = await client.readStreamMessage(localId);
  if (okResp.command !== A_OKAY) throw new Error(`sync open failed: cmd=0x${okResp.command.toString(16)}`);
  const remoteId = okResp.arg0;

  const sendPacket = new Uint8Array(8 + remotePath.length + 6);
  sendPacket.set(textEncoder.encode('SEND'), 0);
  new DataView(sendPacket.buffer).setUint32(4, remotePath.length + 6, true);
  sendPacket.set(textEncoder.encode(remotePath + ',33261'), 8);

  await client.write(buildMessage(A_WRTE, localId, remoteId, sendPacket));
  await expectOkOrFail(client, localId, remoteId, 'SEND');

  const chunkSize = MAX_PAYLOAD - 8;
  let offset = 0;
  let lastPct = -1;
  while (offset < fileData.length) {
    const end = Math.min(offset + chunkSize, fileData.length);
    const chunk = fileData.slice(offset, end);
    const dataPacket = new Uint8Array(8 + chunk.length);
    dataPacket.set(textEncoder.encode('DATA'), 0);
    new DataView(dataPacket.buffer).setUint32(4, chunk.length, true);
    dataPacket.set(chunk, 8);
    await client.write(buildMessage(A_WRTE, localId, remoteId, dataPacket));
    await expectOkOrFail(client, localId, remoteId, 'DATA');
    offset = end;
    const pct = Math.round((offset / fileData.length) * 100);
    if (pct !== lastPct) {
      lastPct = pct;
      onProgress?.(pct);
    }
  }

  const donePacket = new Uint8Array(8);
  donePacket.set(textEncoder.encode('DONE'), 0);
  new DataView(donePacket.buffer).setUint32(4, Math.floor(Date.now() / 1000), true);
  await client.write(buildMessage(A_WRTE, localId, remoteId, donePacket));
  await expectOkOrFail(client, localId, remoteId, 'DONE');

  const quitPacket = textEncoder.encode('QUIT\0\0\0\0');
  await client.write(buildMessage(A_WRTE, localId, remoteId, quitPacket));
  await client.write(buildMessage(A_CLSE, localId, remoteId, new Uint8Array(0)));
}

async function expectOkOrFail(client, localId, remoteId, stage) {
  const msg = await client.readStreamMessage(localId);
  if (msg.command === A_OKAY) return;
  if (msg.command === A_WRTE && msg.arg0 === remoteId && msg.arg1 === localId) {
    const syncId = Buffer.from(msg.data.slice(0, 4)).toString('latin1');
    const detail = Buffer.from(msg.data).toString('latin1').slice(4);
    throw new Error(`sync ${stage} rejected by device: ${syncId} ${detail}`);
  }
  throw new Error(`sync ${stage}: unexpected packet cmd=0x${msg.command.toString(16)}`);
}

// Mirrors webusb-adb.ts adbShell
async function adbShell(client, command) {
  const localId = Math.floor(Math.random() * 0xffffffff);
  const destination = textEncoder.encode(`shell:${command}\0`);
  await client.write(buildMessage(A_OPEN, localId, 0, destination));
  await client.readStreamMessage(localId); // OKAY
  let output = '';
  for (let i = 0; i < 100; i++) {
    const msg = await client.readStreamMessage(localId);
    if (msg.command === A_CLSE) break;
    if (msg.command === A_WRTE) {
      output += textDecoder.decode(msg.data);
      await client.write(buildMessage(A_OKAY, localId, msg.arg0, new Uint8Array(0)));
    }
  }
  return output;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`ADB protocol test — APK: ${APK_PATH}${REAL ? ' [REAL DEVICE MODE]' : ''}`);
  if (!fs.existsSync(APK_PATH)) {
    console.log('  SKIP  APK not found — build it first (npm run test:ftc or the route)');
    process.exitCode = 0;
    return;
  }
  const apkData = fs.readFileSync(APK_PATH);
  const apkSha = createHash('sha256').update(apkData).digest('hex');

  if (REAL) {
    const host = process.env.FTC_ADB_HOST || '127.0.0.1';
    const port = parseInt(process.env.FTC_ADB_PORT || '5555', 10);
    await realDeviceTests(host, port, apkData, apkSha);
    console.log(`\n${checks - failures}/${checks} checks passed`);
    if (failures > 0) process.exitCode = 1;
    return;
  }

  const server = new FakeAdbd(apkSha);
  const port = await server.start();
  const client = new AdbClient(port);
  await client.connect();

  console.log('-- handshake --');
  const cnxn = await adbConnect(client);
  check('CNXN response received', cnxn.command === A_CNXN, `cmd=0x${cnxn.command.toString(16)}`);
  check('CNXN banner is device banner', Buffer.from(cnxn.data).toString('latin1').startsWith('device::'), Buffer.from(cnxn.data).toString('latin1').slice(0, 40));

  console.log('-- push (sync protocol) --');
  const remotePath = '/sdcard/FIRST/TeamCode.apk';
  await adbPush(client, new Uint8Array(apkData), remotePath, () => {});
  check('server received SEND path', server.pushedPath === remotePath, server.pushedPath || 'none');
  check('mode parsed as 0100755', server.pushedMode === 33261, `mode=${server.pushedMode}`);
  check('file size matches', server.receivedFile.length === apkData.length, `${server.receivedFile.length} vs ${apkData.length}`);
  const receivedSha = createHash('sha256').update(server.receivedFile).digest('hex');
  check('file content matches (sha256)', receivedSha === apkSha, receivedSha.slice(0, 16));
  check('stream okays observed', server.hostWrteOkays >= 2, `${server.hostWrteOkays}`);

  console.log('-- shell --');
  const output = await adbShell(client, 'pm install -r /sdcard/FIRST/TeamCode.apk');
  check('shell command delivered to server', server.shellRequests.length === 1, server.shellRequests[0] || 'none');
  check('shell command text correct', server.shellRequests[0] === 'pm install -r /sdcard/FIRST/TeamCode.apk');
  check('shell output received by client', output.includes('mock-output-of:pm install'), output.trim().slice(0, 60));

  client.close();
  await server.stop();

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) process.exitCode = 1;
}

async function realDeviceTests(host, port, apkData, apkSha) {
  console.log(`-- real adbd at ${host}:${port} --`);
  const client = new AdbClient(port, host);
  await client.connect();
  try {
    const cnxn = await adbConnect(client);
    check('CNXN response from real adbd', cnxn.command === A_CNXN, `cmd=0x${cnxn.command.toString(16)}`);
    if (cnxn.command === A_AUTH) {
      check('AUTH handled', false, 'real device requires adb RSA auth — not supported by the WebUSB client either');
      return;
    }

    const remotePath = process.env.FTC_ADB_REMOTE_PATH || '/sdcard/FIRST/TeamCode.apk';
    console.log(`-- push real APK to ${remotePath} --`);
    const t0 = Date.now();
    await adbPush(client, new Uint8Array(apkData), remotePath, (pct) => {
      if (pct % 25 === 0) process.stdout.write(`  push ${pct}%...\n`);
    });
    const pushMs = Date.now() - t0;
    check('push completed', true, `${(apkData.length / 1024 / 1024).toFixed(1)}MB in ${(pushMs / 1000).toFixed(1)}s`);

    console.log('-- verify file landed on device --');
    const lsOut = await adbShell(client, `ls -l ${remotePath}`);
    check('file exists on device', lsOut.includes('TeamCode.apk'), lsOut.trim().split('\n').pop() || '');
    const shaOut = await adbShell(client, `sha256sum ${remotePath}`);
    const deviceSha = (shaOut.match(/[0-9a-f]{64}/) || [''])[0];
    check('device sha256 matches source', deviceSha === apkSha, deviceSha ? deviceSha.slice(0, 16) : 'no sha output');

    console.log('-- pm install -r (the panel command) --');
    const installOut = await adbShell(client, `pm install -r ${remotePath}`);
    check('pm install says Success', /Success/i.test(installOut), installOut.trim().slice(0, 80).replace(/\n/g, ' '));

    const listOut = await adbShell(client, 'pm list packages');
    check('com.qualcomm.ftcrobotcontroller installed', listOut.includes('com.qualcomm.ftcrobotcontroller'));
    const dumpsysOut = await adbShell(client, 'dumpsys package com.qualcomm.ftcrobotcontroller');
    const versionMatch = dumpsysOut.match(/versionName=([0-9.]+)/);
    check('installed version parsed', !!versionMatch, versionMatch ? `versionName=${versionMatch[1]}` : 'no version');
  } finally {
    client.close();
  }
}

main().catch((err) => {
  console.error('test crashed:', err.message);
  process.exitCode = 1;
});