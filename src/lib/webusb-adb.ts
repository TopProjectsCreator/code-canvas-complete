/**
 * WebUSB-based ADB (Android Debug Bridge) implementation.
 * Handles connecting to Android devices (FTC Control Hubs, phones) via WebUSB
 * and pushing compiled APK files.
 */

const ADB_CLASS = 0xff;
const ADB_SUBCLASS = 0x42;
const ADB_PROTOCOL = 0x01;

// ADB protocol constants
const A_CNXN = 0x4e584e43;
const A_OPEN = 0x4e45504f;
const A_OKAY = 0x59414b4f;
const A_WRTE = 0x45545257;
const A_CLSE = 0x45534c43;

const ADB_VERSION = 0x01000000;
const MAX_PAYLOAD = 4096;

interface AdbMessage {
  command: number;
  arg0: number;
  arg1: number;
  data: Uint8Array;
}

export interface AdbDevice {
   
  device: any; // USBDevice — WebUSB types vary across TS environments
  interfaceNumber: number;
  endpointIn: number;
  endpointOut: number;
}

export interface AdbConnection {
  adbDevice: AdbDevice;
  localId: number;
  remoteId: number;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function buildMessage(command: number, arg0: number, arg1: number, data: Uint8Array = new Uint8Array(0)): ArrayBuffer {
  const header = new ArrayBuffer(24);
  const view = new DataView(header);
  view.setUint32(0, command, true);
  view.setUint32(4, arg0, true);
  view.setUint32(8, arg1, true);
  view.setUint32(12, data.length, true);

  // data checksum
  let checksum = 0;
  for (let i = 0; i < data.length; i++) checksum += data[i];
  view.setUint32(16, checksum, true);
  view.setUint32(20, command ^ 0xffffffff, true);

  const result = new Uint8Array(24 + data.length);
  result.set(new Uint8Array(header), 0);
  result.set(data, 24);
  return result.buffer;
}

function parseMessage(buffer: ArrayBuffer): AdbMessage {
  const view = new DataView(buffer);
  const command = view.getUint32(0, true);
  const arg0 = view.getUint32(4, true);
  const arg1 = view.getUint32(8, true);
  const dataLen = view.getUint32(12, true);
  const data = new Uint8Array(buffer, 24, dataLen);
  return { command, arg0, arg1, data };
}

/**
 * Read the next ADB packet that belongs to the given host stream (every
 * device->host packet carries the host's local id in arg1). Stale packets
 * left over from a previous stream (e.g. a duplicate CLSE) are discarded,
 * otherwise they would be mistaken for the next stream's response.
 */
async function readStreamMessage(adbDevice: AdbDevice, localId: number): Promise<AdbMessage> {
  // Stale packets are bounded (a few leftovers at most); cap defensively so a
  // misbehaving device can never wedge the stream read in an infinite loop.
  for (let attempts = 0; attempts < 50; attempts++) {
    const resp = await adbDevice.device.transferIn(adbDevice.endpointIn, 24 + MAX_PAYLOAD);
    if (!resp.data) throw new Error('No data from device');
    const msg = parseMessage(resp.data.buffer);
    if (msg.arg1 === localId) return msg;
  }
  throw new Error(`No response for stream ${localId} (stale packet flood)`);
}

/** Request an ADB-capable USB device from the user */
export async function requestAdbDevice(): Promise<AdbDevice> {
  if (!navigator.usb) {
    throw new Error('WebUSB is not supported in this browser. Use Chrome or Edge.');
  }

  // Request any USB device – we'll filter for ADB interface
  const device = await navigator.usb.requestDevice({
    filters: [
      { classCode: ADB_CLASS, subclassCode: ADB_SUBCLASS, protocolCode: ADB_PROTOCOL },
      // Common FTC Control Hub / REV vendor IDs
      { vendorId: 0x18d1 }, // Google
      { vendorId: 0x0403 }, // FTDI
      { vendorId: 0x1d6b }, // Linux Foundation (Control Hub)
    ],
  });

  await device.open();

  // Find ADB interface
  let interfaceNumber = -1;
  let endpointIn = -1;
  let endpointOut = -1;

  if (device.configuration) {
    for (const iface of device.configuration.interfaces) {
      for (const alt of iface.alternates) {
        if (alt.interfaceClass === ADB_CLASS && alt.interfaceSubclass === ADB_SUBCLASS) {
          interfaceNumber = iface.interfaceNumber;
          break;
        }
      }
      if (interfaceNumber >= 0) break;
    }
  }

  if (interfaceNumber < 0) {
    // Fallback: use first interface
    interfaceNumber = 0;
  }

  await device.selectConfiguration(1);
  await device.claimInterface(interfaceNumber);

  // Find bulk endpoints (simplified – real implementation reads endpoint descriptors)
  endpointIn = 1;  // typical
  endpointOut = 1;  // typical

  return { device, interfaceNumber, endpointIn, endpointOut };
}

/** Send ADB connect handshake */
export async function adbConnect(adbDevice: AdbDevice): Promise<void> {
  const banner = textEncoder.encode('host::features=shell_v2');
  const msg = buildMessage(A_CNXN, ADB_VERSION, MAX_PAYLOAD, banner);

  await adbDevice.device.transferOut(adbDevice.endpointOut, msg);

  // Read CNXN response
  const response = await adbDevice.device.transferIn(adbDevice.endpointIn, 24 + MAX_PAYLOAD);
  if (!response.data) throw new Error('No response from device');

  const parsed = parseMessage(response.data.buffer);
  if (parsed.command !== A_CNXN) {
    throw new Error(`Expected CNXN response, got 0x${parsed.command.toString(16)}`);
  }
}

/** Open a shell stream on the device */
export async function adbShell(adbDevice: AdbDevice, command: string): Promise<string> {
  const localId = Math.floor(Math.random() * 0xffffffff);
  const destination = textEncoder.encode(`shell:${command}\0`);

  // OPEN
  const openMsg = buildMessage(A_OPEN, localId, 0, destination);
  await adbDevice.device.transferOut(adbDevice.endpointOut, openMsg);

  // Read OKAY
  const okResp = await readStreamMessage(adbDevice, localId);
  if (okResp.command !== A_OKAY) {
    throw new Error(`Shell open rejected (0x${okResp.command.toString(16)})`);
  }

  // Read data until CLSE
  let output = '';
  const maxReads = 100;
  for (let i = 0; i < maxReads; i++) {
    try {
      const msg = await readStreamMessage(adbDevice, localId);
      if (msg.command === A_CLSE) break;
      if (msg.command === A_WRTE) {
        output += textDecoder.decode(msg.data);
        // Send OKAY
        const okayMsg = buildMessage(A_OKAY, localId, msg.arg0, new Uint8Array(0));
        await adbDevice.device.transferOut(adbDevice.endpointOut, okayMsg);
      }
    } catch {
      break;
    }
  }

  return output;
}

/** Push a file to the device via ADB sync protocol */
export async function adbPush(
  adbDevice: AdbDevice,
  fileData: Uint8Array,
  remotePath: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const localId = Math.floor(Math.random() * 0xffffffff);
  const destination = textEncoder.encode(`sync:\0`);

  // OPEN sync stream
  const openMsg = buildMessage(A_OPEN, localId, 0, destination);
  await adbDevice.device.transferOut(adbDevice.endpointOut, openMsg);

  const okResp = await readStreamMessage(adbDevice, localId);
  if (okResp.command !== A_OKAY) {
    throw new Error(`Sync open rejected (0x${okResp.command.toString(16)})`);
  }
  const remoteId = okResp.arg0;

  // SEND command: "SEND" + path + "," + mode
  const sendPacket = new Uint8Array(8 + remotePath.length + 6);
  sendPacket.set(textEncoder.encode('SEND'), 0);
  new DataView(sendPacket.buffer).setUint32(4, remotePath.length + 6, true); // path,mode
  sendPacket.set(textEncoder.encode(remotePath + ',33261'), 8);

  const wrteMsg = buildMessage(A_WRTE, localId, remoteId, sendPacket);
  await adbDevice.device.transferOut(adbDevice.endpointOut, wrteMsg);
  await expectSyncOk(adbDevice, localId, remoteId, 'SEND');

  // Send file data in chunks
  const chunkSize = MAX_PAYLOAD - 8;
  let offset = 0;
  while (offset < fileData.length) {
    const end = Math.min(offset + chunkSize, fileData.length);
    const chunk = fileData.slice(offset, end);

    // DATA + length + payload
    const dataPacket = new Uint8Array(8 + chunk.length);
    dataPacket.set(textEncoder.encode('DATA'), 0);
    new DataView(dataPacket.buffer).setUint32(4, chunk.length, true);
    dataPacket.set(chunk, 8);

    const dataMsg = buildMessage(A_WRTE, localId, remoteId, dataPacket);
    await adbDevice.device.transferOut(adbDevice.endpointOut, dataMsg);
    await expectSyncOk(adbDevice, localId, remoteId, 'DATA');

    offset = end;
    onProgress?.(Math.round((offset / fileData.length) * 100));
  }

  // DONE + mtime
  const donePacket = new Uint8Array(8);
  donePacket.set(textEncoder.encode('DONE'), 0);
  new DataView(donePacket.buffer).setUint32(4, Math.floor(Date.now() / 1000), true);

  const doneMsg = buildMessage(A_WRTE, localId, remoteId, donePacket);
  await adbDevice.device.transferOut(adbDevice.endpointOut, doneMsg);
  await expectSyncOk(adbDevice, localId, remoteId, 'DONE');

  // QUIT
  const quitPacket = textEncoder.encode('QUIT\0\0\0\0');
  const quitMsg = buildMessage(A_WRTE, localId, remoteId, quitPacket);
  await adbDevice.device.transferOut(adbDevice.endpointOut, quitMsg);

  // Close
  const clseMsg = buildMessage(A_CLSE, localId, remoteId, new Uint8Array(0));
  await adbDevice.device.transferOut(adbDevice.endpointOut, clseMsg);
}

/**
 * Wait for the stream OKAY after a sync WRTE. If adbd rejects the sync packet
 * (e.g. missing parent directory), it sends a sync-level FAIL packet — surface
 * that as a real error instead of silently continuing.
 */
async function expectSyncOk(
  adbDevice: AdbDevice,
  localId: number,
  remoteId: number,
  stage: string,
): Promise<void> {
  const resp = await readStreamMessage(adbDevice, localId);
  const msg = resp;
  if (msg.command === A_OKAY) return;
  if (msg.command === A_WRTE && msg.arg0 === remoteId && msg.arg1 === localId) {
    const syncId = String.fromCharCode(...msg.data.slice(0, 4));
    const detail = textDecoder.decode(msg.data).slice(4);
    throw new Error(`Sync ${stage} rejected by device: ${syncId} ${detail}`);
  }
  throw new Error(`Sync ${stage}: unexpected packet 0x${msg.command.toString(16)}`);
}

/** Disconnect and release the USB device */
export async function adbDisconnect(adbDevice: AdbDevice): Promise<void> {
  try {
    await adbDevice.device.releaseInterface(adbDevice.interfaceNumber);
    await adbDevice.device.close();
  } catch {
    // ignore cleanup errors
  }
}
