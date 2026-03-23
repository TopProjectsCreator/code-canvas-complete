/**
 * FTC Upload Service
 * Orchestrates cloud compilation and ADB-over-WebUSB deployment.
 */

import { supabase } from '@/integrations/supabase/client';
import {
  requestAdbDevice,
  adbConnect,
  adbPush,
  adbShell,
  adbDisconnect,
  type AdbDevice,
} from '@/lib/webusb-adb';

export type BuildStatus = 'idle' | 'compiling' | 'success' | 'error';

export interface BuildResult {
  status: BuildStatus;
  message: string;
  apkBase64?: string;
  errors?: string[];
  warnings?: string[];
}

export interface FTCFile {
  path: string;
  content: string;
}

/** Send source files to the compile-ftc edge function */
export async function compileFTC(
  files: FTCFile[],
  onProgress?: (msg: string) => void,
): Promise<BuildResult> {
  onProgress?.('Sending files to build server...');

  const { data, error } = await supabase.functions.invoke('compile-ftc', {
    body: { files },
  });

  if (error) {
    return {
      status: 'error',
      message: error.message || 'Build request failed',
      errors: [error.message],
    };
  }

  if (data?.status === 'error') {
    return {
      status: 'error',
      message: data.message || 'Compilation failed',
      errors: data.errors || [],
      warnings: data.warnings || [],
    };
  }

  return {
    status: 'success',
    message: data?.message || 'Build successful',
    apkBase64: data?.apkBase64,
    warnings: data?.warnings || [],
  };
}

/** Connect to an ADB device via WebUSB */
export async function connectDevice(
  onProgress?: (msg: string) => void,
): Promise<AdbDevice> {
  onProgress?.('Requesting USB device access...');
  const device = await requestAdbDevice();

  onProgress?.('Establishing ADB connection...');
  await adbConnect(device);

  onProgress?.('Connected to device');
  return device;
}

/** Push compiled APK to device */
export async function uploadToDevice(
  device: AdbDevice,
  apkBase64: string,
  onProgress?: (msg: string, percent?: number) => void,
): Promise<void> {
  onProgress?.('Decoding APK...');
  const binary = Uint8Array.from(atob(apkBase64), (c) => c.charCodeAt(0));

  const remotePath = '/sdcard/FIRST/TeamCode.apk';
  onProgress?.(`Pushing to ${remotePath}...`, 0);

  await adbPush(device, binary, remotePath, (pct) => {
    onProgress?.(`Uploading... ${pct}%`, pct);
  });

  onProgress?.('Installing on device...', 95);
  await adbShell(device, `pm install -r ${remotePath}`);

  onProgress?.('Upload complete!', 100);
}

/** Stream logcat output from device */
export async function startLogcat(
  device: AdbDevice,
  onLine: (line: string) => void,
): Promise<void> {
  try {
    const output = await adbShell(device, 'logcat -d -s RobotCore:* TeamCode:*');
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.trim()) onLine(line);
    }
  } catch (e) {
    onLine(`[logcat error] ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Disconnect the device */
export async function disconnectDevice(device: AdbDevice): Promise<void> {
  await adbDisconnect(device);
}
