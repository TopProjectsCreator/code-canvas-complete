import net from 'net';

export const A_CNXN = 0x4e584e43;
export const A_OPEN = 0x4e45504f;
export const A_OKAY = 0x59414b4f;
export const A_WRTE = 0x45545257;
export const A_CLSE = 0x45534c43;
export const A_AUTH = 0x48545541;
export const ADB_VERSION = 0x01000000;
export const MAX_PAYLOAD = 4096;

const textEncoder = new TextEncoder();

export function buildMessage(command, arg0, arg1, data = new Uint8Array(0)) {
  const header = new ArrayBuffer(24);
  const view = new DataView(header);
  view.setUint32(0, command, true);
  view.setUint32(4, arg0, true);
  view.setUint32(8, arg1, true);
  view.setUint32(12, data.length, true);
  let checksum = 0;
  for (let i = 0; i < data.length; i++) checksum += data[i];
  view.setUint32(16, checksum, true);
  view.setUint32(20, (command ^ 0xffffffff) >>> 0, true);
  const result = new Uint8Array(24 + data.length);
  result.set(new Uint8Array(header), 0);
  result.set(data, 24);
  return result.buffer;
}

export function parseMessage(buffer) {
  const view = new DataView(buffer);
  return {
    command: view.getUint32(0, true),
    arg0: view.getUint32(4, true),
    arg1: view.getUint32(8, true),
    dataLen: view.getUint32(12, true),
    data: new Uint8Array(buffer, 24, view.getUint32(12, true)),
  };
}

/**
 * Fake adbd — models real adbd behavior for sync (SEND/DATA/DONE/QUIT) and shell.
 */
export class FakeAdbd {
  constructor() {
    this.receivedFile = Buffer.alloc(0);
    this.pushedPath = null;
    this.pushedMode = null;
    this.shellRequests = [];
    this.hostWrteOkays = 0;
    this.server = null;
    this.port = 0;
    this.authed = true;
    // Paths containing any of these substrings get a sync FAIL (like real
    // adbd when the target directory does not exist).
    this.rejectPathContaining = [];
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
    const sync = { phase: 'idle', outStream: null };
    const conn = { deviceLocal: 0 };

    const send = (command, arg0, arg1, data = new Uint8Array(0)) => {
      socket.write(Buffer.from(buildMessage(command, arg0, arg1, data)));
    };

    const handleSyncPacket = (packet, hostLocalId) => {
      if (packet.length < 8) return;
      const id = packet.slice(0, 4).toString('latin1');
      const idLen = packet.readUInt32LE(4);
      const payload = packet.slice(8, 8 + idLen);
      if (id === 'SEND') {
        const str = payload.toString('latin1');
        const commaIdx = str.indexOf(',');
        this.pushedPath = commaIdx >= 0 ? str.slice(0, commaIdx) : str;
        this.pushedMode = commaIdx >= 0 ? parseInt(str.slice(commaIdx + 1), 10) || 0 : 0;
        if (this.rejectPathContaining.some((s) => this.pushedPath.includes(s))) {
          // Real adbd replies with a sync-level FAIL packet (WRTE with FAIL + errno).
          const fail = Buffer.concat([Buffer.from('FAIL'), Buffer.from('No such file or directory')]);
          socket.write(Buffer.from(buildMessage(A_WRTE, conn.deviceLocal, hostLocalId, new Uint8Array(fail))));
          sync.phase = 'idle';
          sync.outStream = null;
          return;
        }
        sync.outStream = [];
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
            socket.write(Buffer.from(buildMessage(A_WRTE, remoteId, arg0, new Uint8Array(out))));
            send(A_CLSE, remoteId, arg0, new Uint8Array(0));
            send(A_CLSE, remoteId, arg0, new Uint8Array(0));
          }
        } else if (cmd === A_WRTE) {
          this.hostWrteOkays++;
          if (sync.phase === 'sync') {
            try {
              handleSyncPacket(Buffer.from(data), arg0);
            } catch (err) {
              send(A_CLSE, arg1, arg0, new Uint8Array(0));
              return;
            }
          }
          send(A_OKAY, arg1, arg0, new Uint8Array(0));
        }
      }
    });
  }
}
