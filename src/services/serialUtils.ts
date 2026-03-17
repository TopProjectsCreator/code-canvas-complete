/**
 * Shared serial port types and utilities for Arduino flash protocols.
 * Centralizes the port acquisition logic to ensure requestPort()
 * is only called from user gesture contexts.
 */

export interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  getInfo?(): { usbProductId?: number; usbVendorId?: number };
}

export interface SerialLike {
  requestPort(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}

export const ARDUINO_USB_VENDOR_IDS = [0x2341, 0x2a03, 0x1a86, 0x0403] as const;

export const getSerial = (): SerialLike | undefined =>
  (navigator as unknown as { serial?: SerialLike }).serial;

/**
 * Request a serial port from the user. MUST be called from a user gesture handler.
 * Includes official Arduino vendor IDs plus the most common Uno USB-serial bridge vendors.
 */
export async function requestArduinoPort(): Promise<SerialPortLike> {
  const serial = getSerial();
  if (!serial) throw new Error('Web Serial API not supported. Use Chrome or Edge.');
  return serial.requestPort({
    filters: ARDUINO_USB_VENDOR_IDS.map((usbVendorId) => ({ usbVendorId })),
  });
}

/**
 * Request any serial port (no vendor filter). MUST be called from a user gesture handler.
 */
export async function requestAnyPort(): Promise<SerialPortLike> {
  const serial = getSerial();
  if (!serial) throw new Error('Web Serial API not supported. Use Chrome or Edge.');
  return serial.requestPort();
}

/**
 * After a 1200-baud touch, the board re-enumerates as a new CDC device.
 * Poll getPorts() to find it — this does NOT require a user gesture.
 * Falls back to the provided port if no new port appears.
 */
export async function waitForNewPort(
  existingPorts: SerialPortLike[],
  timeoutMs = 5000,
  pollMs = 500
): Promise<SerialPortLike> {
  const serial = getSerial();
  if (!serial) throw new Error('Web Serial API not supported.');

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, pollMs));
    const currentPorts = await serial.getPorts();
    // Find a port that wasn't in the original list
    const newPort = currentPorts.find(p =>
      !existingPorts.some(ep => ep === p)
    );
    if (newPort) return newPort;
    // If same count, return the last one (likely the re-enumerated one)
    if (currentPorts.length > 0) {
      // After enough wait time, just return whatever we have
      if (Date.now() > deadline - pollMs) {
        return currentPorts[currentPorts.length - 1];
      }
    }
  }

  // Fallback: return any available port
  const ports = await serial.getPorts();
  if (ports.length > 0) return ports[ports.length - 1];
  throw new Error('No serial port found after bootloader reset. Try selecting the port manually.');
}

/**
 * Perform 1200-baud touch on a pre-acquired port to trigger bootloader.
 */
export async function perform1200BaudTouch(port: SerialPortLike): Promise<void> {
  await port.open({ baudRate: 1200 });
  if (port.setSignals) {
    await port.setSignals({ dataTerminalReady: false });
    await new Promise(r => setTimeout(r, 100));
    await port.setSignals({ dataTerminalReady: true });
    await new Promise(r => setTimeout(r, 100));
    await port.setSignals({ dataTerminalReady: false });
  }
  await new Promise(r => setTimeout(r, 300));
  await port.close();
}
