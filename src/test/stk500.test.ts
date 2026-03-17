import { describe, expect, it, vi } from 'vitest';
import { flashHex } from '@/services/stk500';

const TEST_HEX = `:1000000041C0FFFFFFFFFFFFFFFFFFFFFFFFFFFFFD
:00000001FF`;

class MockBootloaderPort {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  private controller!: ReadableStreamDefaultController<Uint8Array>;
  private programmedPage = new Uint8Array();
  public readonly signalCalls: Array<{ dataTerminalReady?: boolean; requestToSend?: boolean }> = [];

  constructor(
    private readonly options: {
      requireReset?: boolean;
      syncDelayMs?: number;
    } = {}
  ) {
    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller;
      },
    });

    this.writable = new WritableStream<Uint8Array>({
      write: async (chunk) => {
        await this.handleCommand(chunk);
      },
    });
  }

  async open(): Promise<void> {}
  async close(): Promise<void> {}

  async setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void> {
    this.signalCalls.push(signals);
  }

  private enqueue(bytes: number[], delay = 0): void {
    setTimeout(() => {
      this.controller.enqueue(Uint8Array.from(bytes));
    }, delay);
  }

  private async handleCommand(chunk: Uint8Array): Promise<void> {
    const command = chunk[0];

    switch (command) {
      case 0x30: {
        if (this.options.requireReset && this.signalCalls.length === 0) {
          return;
        }
        this.enqueue([0x14, 0x10], this.options.syncDelayMs ?? 0);
        return;
      }

      case 0x75:
        this.enqueue([0x14, 0x1e, 0x95, 0x0f, 0x10]);
        return;

      case 0x50:
      case 0x51:
      case 0x55:
        this.enqueue([0x14, 0x10]);
        return;

      case 0x64: {
        const pageLength = (chunk[1] << 8) | chunk[2];
        this.programmedPage = chunk.slice(4, 4 + pageLength);
        this.enqueue([0x14, 0x10]);
        return;
      }

      case 0x74:
        this.enqueue([0x14, ...Array.from(this.programmedPage), 0x10]);
        return;

      default:
        throw new Error(`Unexpected STK500 command 0x${command.toString(16)}`);
    }
  }
}

describe('flashHex', () => {
  it('uploads successfully when sync arrives late', async () => {
    const port = new MockBootloaderPort({ syncDelayMs: 150 });
    const onProgress = vi.fn();

    await flashHex(port, TEST_HEX, onProgress);

    expect(onProgress).toHaveBeenCalledWith('Upload complete!', 100);
  });

  it('falls back to reset strategies when sync is only available after reset', async () => {
    const port = new MockBootloaderPort({ requireReset: true, syncDelayMs: 150 });

    await flashHex(port, TEST_HEX);

    expect(port.signalCalls.length).toBeGreaterThan(0);
  });
});
