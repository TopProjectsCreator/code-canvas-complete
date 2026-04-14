/**
/**
 * WebUSB DFU (Device Firmware Update) protocol for Arduino Uno R4 WiFi
 * The R4 uses a Renesas RA4M1 with a USB DFU bootloader.
 * User must double-tap reset to enter DFU mode before flashing.
 */

// DFU class-specific requests
const DFU_DETACH = 0x00;
const DFU_DNLOAD = 0x01;
const DFU_GETSTATUS = 0x03;
const DFU_CLRSTATUS = 0x04;
const DFU_ABORT = 0x06;

// DFU states
const DFU_STATE_IDLE = 2;
const DFU_STATE_DNLOAD_IDLE = 5;
const DFU_STATE_MANIFEST = 7;
const DFU_STATE_ERROR = 10;

// R4 WiFi DFU USB identifiers
const R4_WIFI_DFU_VENDOR_ID = 0x2341; // Arduino
const R4_WIFI_DFU_PRODUCT_ID = 0x0069; // R4 WiFi in DFU mode

const TRANSFER_SIZE = 256; // DFU transfer size (bytes per block)

interface DFUStatus {
  status: number;
  pollTimeout: number;
  state: number;
}

async function getStatus(device: USBDevice, interfaceNum: number): Promise<DFUStatus> {
  const result = await device.controlTransferIn(
    {
      requestType: 'class',
      recipient: 'interface',
      request: DFU_GETSTATUS,
      value: 0,
      index: interfaceNum,
    },
    6
  );

  if (!result.data || result.data.byteLength < 6) {
    throw new Error('Failed to get DFU status');
  }

  const data = new DataView(result.data.buffer);
  return {
    status: data.getUint8(0),
    pollTimeout: data.getUint8(1) | (data.getUint8(2) << 8) | (data.getUint8(3) << 16),
    state: data.getUint8(4),
  };
}

async function clearStatus(device: USBDevice, interfaceNum: number): Promise<void> {
  await device.controlTransferOut({
    requestType: 'class',
    recipient: 'interface',
    request: DFU_CLRSTATUS,
    value: 0,
    index: interfaceNum,
  });
}

async function abort(device: USBDevice, interfaceNum: number): Promise<void> {
  await device.controlTransferOut({
    requestType: 'class',
    recipient: 'interface',
    request: DFU_ABORT,
    value: 0,
    index: interfaceNum,
  });
}

async function waitForState(
  device: USBDevice,
  interfaceNum: number,
  targetStates: number[],
  maxAttempts = 100
): Promise<DFUStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getStatus(device, interfaceNum);

    if (status.state === DFU_STATE_ERROR) {
      await clearStatus(device, interfaceNum);
      continue;
    }

    if (targetStates.includes(status.state)) {
      return status;
    }

    if (status.pollTimeout > 0) {
      await new Promise((r) => setTimeout(r, status.pollTimeout));
    } else {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  throw new Error('DFU timeout waiting for target state');
}

async function downloadBlock(
  device: USBDevice,
  interfaceNum: number,
  blockNum: number,
  data: ArrayBuffer
): Promise<void> {
  await device.controlTransferOut(
    {
      requestType: 'class',
      recipient: 'interface',
      request: DFU_DNLOAD,
      value: blockNum,
      index: interfaceNum,
    },
    data
  );
}

/**
 * Request the user to select a USB device in DFU mode.
 * Returns a USBDevice or throws if cancelled.
 */
export async function requestDFUDevice(): Promise<USBDevice> {
  if (!navigator.usb) {
    throw new Error('WebUSB API not supported. Use Chrome or Edge.');
  }

  const device = await navigator.usb.requestDevice({
    filters: [
      { vendorId: R4_WIFI_DFU_VENDOR_ID, productId: R4_WIFI_DFU_PRODUCT_ID },
      // Also accept generic Arduino DFU devices
      { vendorId: R4_WIFI_DFU_VENDOR_ID },
    ],
  });

  return device;
}

/**
 * Flash a raw binary firmware image to an Arduino R4 WiFi via USB DFU.
 *
 * @param device - USBDevice obtained from `requestDFUDevice()`
 * @param firmware - Raw binary firmware as Uint8Array
 * @param onProgress - Optional progress callback
 */
export async function flashDFU(
  device: USBDevice,
  firmware: Uint8Array,
  onProgress?: (message: string, percent: number) => void
): Promise<void> {
  await device.open();

  // Find DFU interface
  const config = device.configuration;
  if (!config) {
    await device.selectConfiguration(1);
  }

  let interfaceNum = 0;
  const iface = device.configuration?.interfaces.find((i) =>
    i.alternates.some(
      (a) => a.interfaceClass === 0xfe && a.interfaceSubclass === 0x01
    )
  );

  if (iface) {
    interfaceNum = iface.interfaceNumber;
  }

  try {
    await device.claimInterface(interfaceNum);
  } catch (err) {
    throw new Error(
      `Cannot claim USB interface. Make sure the board is in DFU mode (double-tap reset). ${
        err instanceof Error ? err.message : ''
      }`
    );
  }

  onProgress?.('Connected to DFU device', 5);

  // Ensure we're in IDLE state
  try {
    await abort(device, interfaceNum);
    await waitForState(device, interfaceNum, [DFU_STATE_IDLE]);
  } catch {
    // Try clearing error state
    await clearStatus(device, interfaceNum);
    await waitForState(device, interfaceNum, [DFU_STATE_IDLE]);
  }

  onProgress?.('Device ready, starting download...', 10);

  // Send firmware in blocks
  const totalBlocks = Math.ceil(firmware.length / TRANSFER_SIZE);

  for (let blockNum = 0; blockNum < totalBlocks; blockNum++) {
    const offset = blockNum * TRANSFER_SIZE;
    const end = Math.min(offset + TRANSFER_SIZE, firmware.length);
    const block = firmware.slice(offset, end);

    await downloadBlock(device, interfaceNum, blockNum + 2, block.buffer);

    // Wait for device to process
    await waitForState(device, interfaceNum, [DFU_STATE_DNLOAD_IDLE]);

    const pct = 10 + Math.round((blockNum / totalBlocks) * 80);
    onProgress?.(`Flashing block ${blockNum + 1}/${totalBlocks}`, pct);
  }

  // Send zero-length download to signal end
  await downloadBlock(device, interfaceNum, totalBlocks + 2, new ArrayBuffer(0));

  onProgress?.('Finalizing...', 92);

  // Wait for manifest
  try {
    await waitForState(device, interfaceNum, [DFU_STATE_MANIFEST, DFU_STATE_IDLE], 200);
  } catch {
    // Some devices reset immediately during manifest — that's OK
  }

  onProgress?.('Flash complete! Board is resetting...', 100);

  try {
    await device.releaseInterface(interfaceNum);
    await device.close();
  } catch {
    // Device may have already reset/disconnected
  }
}
