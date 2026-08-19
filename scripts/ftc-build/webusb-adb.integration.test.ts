/**
 * Integration test for the REAL src/lib/webusb-adb.ts module.
 *
 * Bridges the WebUSB transport with a TCP socket (mock USB device) so the
 * shipped adbConnect/adbPush/adbShell code runs against a fake adbd — and,
 * with FTC_ADB_REMOTE_PATH set, against a real device (e.g. an emulator or
 * Control Hub reachable via adb connect).
 *
 * Run: npx tsx scripts/ftc-build/webusb-adb.integration.test.ts
 * Real mode: FTC_ADB_HOST=127.0.0.1 FTC_ADB_PORT=5555 FTC_ADB_REMOTE_PATH=/data/local/tmp/TeamCode.apk npx tsx ...
 */
import net from 'net';
import fs from 'fs';
import { createHash } from 'crypto';
import { adbConnect, adbPush, adbShell, type AdbDevice } from '../../src/lib/webusb-adb';
import { FakeAdbd } from './adb-fake-adbd.mjs';

const APK_PATH =
  process.argv.find((a) => !a.startsWith('--') && a.endsWith('.apk')) ||
  '.ftc-toolchain/projects/repos/EdwardCasler-FTC-DECODE-25-Edward_branch/TeamCode/build/outputs/apk/debug/TeamCode-debug.apk';
const REAL_HOST = process.env.FTC_ADB_HOST || null;
const REAL_PORT = parseInt(process.env.FTC_ADB_PORT || '5555', 10);
const REAL_PATH = process.env.FTC_ADB_REMOTE_PATH || '/data/local/tmp/TeamCode.apk';

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = '') {
  checks++;
  if (ok) console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`);
  else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`);
  }
}

/** WebUSB-shaped shim: transferOut writes to TCP, transferIn reads one full frame. */
class MockUsbDevice {
  private socket: net.Socket;
  private buffer = Buffer.alloc(0);
  private waiters: Array<{ resolve: (v: unknown) => void; reject: (e: Error) => void }> = [];

  constructor(port: number, host = '127.0.0.1') {
    this.socket = net.connect(port, host);
    this.socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.pump();
    });
  }

  async transferOut(_endpoint: number, buffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve) => this.socket.write(Buffer.from(buffer), resolve));
  }

  async transferIn(_endpoint: number, _maxLen: number): Promise<{ data: DataView; status: string }> {
    return new Promise((resolve, reject) => {
      this.waiters.push({ resolve: resolve as (v: unknown) => void, reject });
      this.pump();
    });
  }

  private pump() {
    while (this.waiters.length > 0) {
      if (this.buffer.length < 24) return;
      const dataLen = this.buffer.readUInt32LE(12);
      if (this.buffer.length < 24 + dataLen) return;
      const frame = this.buffer.subarray(0, 24 + dataLen);
      this.buffer = this.buffer.subarray(24 + dataLen);
      // WebUSB delivers { data: DataView } over an exact-sized buffer.
      const exact = new Uint8Array(frame.length);
      exact.set(frame);
      const waiter = this.waiters.shift()!;
      waiter.resolve({ data: new DataView(exact.buffer), status: 'ok' });
    }
  }

  close() {
    this.socket.destroy();
  }
}

function makeAdbDevice(port: number, host = '127.0.0.1'): { device: MockUsbDevice; adb: AdbDevice } {
  const device = new MockUsbDevice(port, host);
  const adb: AdbDevice = { device, interfaceNumber: 0, endpointIn: 1, endpointOut: 1 };
  return { device, adb };
}

async function waitForPort(port: number, host = '127.0.0.1', timeoutMs = 15000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const ok = await new Promise<boolean>((resolve) => {
      const sock = net.connect(port, host);
      sock.on('connect', () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('error', () => resolve(false));
    });
    if (ok) return true;
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function runDeviceFlow(host: string, port: number, remotePath: string, apkData: Buffer, apkSha: string, label: string, isReal: boolean) {
  console.log(`-- real webusb-adb.ts against ${label} (${host}:${port}) --`);
  if (!(await waitForPort(port, host))) {
    check('device reachable', false, `${host}:${port}`);
    return;
  }
  const { device, adb } = makeAdbDevice(port, host);
  try {
    await adbConnect(adb);
    check('adbConnect handshake', true);

    await adbShell(adb, 'mkdir -p /data/local/tmp');
    check('adbShell mkdir', true);

    console.log(`  pushing ${(apkData.length / 1024 / 1024).toFixed(1)}MB to ${remotePath}...`);
    const t0 = Date.now();
    await adbPush(adb, new Uint8Array(apkData), remotePath, () => {});
    const pushSec = ((Date.now() - t0) / 1000).toFixed(1);
    check('adbPush completed', true, `${pushSec}s`);

    if (!isReal) {
      console.log('  (device-content checks only run against a real device)');
      return;
    }

    const ls = await adbShell(adb, `ls -l ${remotePath}`);
    check('file exists on device', ls.includes(remotePath.split('/').pop()!), ls.trim().split('\n').pop() || '');

    const shaOut = await adbShell(adb, `sha256sum ${remotePath}`);
    const deviceSha = (shaOut.match(/[0-9a-f]{64}/) || [''])[0];
    check('device sha256 matches', deviceSha === apkSha, deviceSha ? deviceSha.slice(0, 16) : 'no sha');

    const installOut = await adbShell(adb, `pm install -r ${remotePath}`);
    check('pm install says Success', /Success/i.test(installOut), installOut.trim().slice(0, 80).replace(/\n/g, ' '));

    const listOut = await adbShell(adb, 'pm list packages');
    check('com.qualcomm.ftcrobotcontroller installed', listOut.includes('com.qualcomm.ftcrobotcontroller'));

    const dumpsysOut = await adbShell(adb, 'dumpsys package com.qualcomm.ftcrobotcontroller');
    const versionMatch = dumpsysOut.match(/versionName=([0-9.]+)/);
    check('installed version parsed', !!versionMatch, versionMatch ? `versionName=${versionMatch[1]}` : 'no version');
  } finally {
    device.close();
  }
}

async function main() {
  console.log(`webusb-adb.ts integration test — APK: ${APK_PATH}`);
  if (!fs.existsSync(APK_PATH)) {
    console.log('  SKIP  APK not found');
    return;
  }
  const apkData = fs.readFileSync(APK_PATH);
  const apkSha = createHash('sha256').update(apkData).digest('hex');

  const server = new FakeAdbd();
  const port = await server.start();
  await runDeviceFlow('127.0.0.1', port, '/sdcard/FIRST/TeamCode.apk', apkData, apkSha, 'fake adbd', false);
  check('fake adbd received correct path', server.pushedPath === '/sdcard/FIRST/TeamCode.apk', server.pushedPath || 'none');
  check('fake adbd received full file', server.receivedFile.length === apkData.length, `${server.receivedFile.length} vs ${apkData.length}`);
  const receivedSha = createHash('sha256').update(server.receivedFile).digest('hex');
  check('fake adbd file sha256 matches', receivedSha === apkSha, receivedSha.slice(0, 16));
  const shellCmd = server.shellRequests.find((c) => c.includes('mkdir') || c.includes('pm install'));
  check('shell stream delivered (incl. trailing CLSE handling)', !!shellCmd, shellCmd || 'none');
  await server.stop();

  console.log('-- negative: device rejects the push (missing directory) --');
  const rejectingServer = new FakeAdbd();
  rejectingServer.rejectPathContaining = ['NOPE'];
  const rejPort = await rejectingServer.start();
  const { device: rejDevice, adb: rejAdb } = makeAdbDevice(rejPort);
  try {
    await adbConnect(rejAdb);
    let threw = null;
    try {
      await adbPush(rejAdb, new Uint8Array(apkData), '/sdcard/NOPE/TeamCode.apk', () => {});
    } catch (err) {
      threw = err instanceof Error ? err.message : String(err);
    }
    check('adbPush throws on sync FAIL', !!threw, threw || 'no error');
    check('error names the failing stage', !!threw && /SEND rejected by device/.test(threw), threw || '');
  } finally {
    rejDevice.close();
    await rejectingServer.stop();
  }

  if (REAL_HOST) {
    await runDeviceFlow(REAL_HOST, REAL_PORT, REAL_PATH, apkData, apkSha, 'real device', true);
  } else {
    console.log('  (set FTC_ADB_HOST/PORT/REMOTE_PATH for the real-device leg)');
  }

  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('test crashed:', err.message);
  process.exitCode = 1;
});