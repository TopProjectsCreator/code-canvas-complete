import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { arduinoBoards } from '@/data/arduinoTemplates';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

declare global {
  interface Navigator {
    serial?: {
      requestPort(): Promise<{ open: (opts: { baudRate: number }) => Promise<void>; close: () => Promise<void>; getInfo: () => { usbProductId?: number } }>;
      getPorts(): Promise<Array<{ getInfo: () => { usbProductId?: number } }>>;
    };
  }
}

export interface UploadConfig {
  boardId: string;
  portName: string;
  baudRate: number;
  uploadMethod: 'serial' | 'wifi' | 'bluetooth';
}

interface ArduinoUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (config: UploadConfig, onProgress?: (message: string, percent?: number) => void) => Promise<void>;
  sketchCode: string;
}

const DFU_BOARDS = ['uno_r4_wifi'];

export function ArduinoUploadDialog({
  open,
  onOpenChange,
  onUpload,
  sketchCode,
}: ArduinoUploadDialogProps) {
  const isDFUBoard = DFU_BOARDS.includes(config.boardId);
  const [config, setConfig] = useState<UploadConfig>({
    boardId: 'uno',
    portName: 'COM3',
    baudRate: 115200,
    uploadMethod: 'serial',
  });

  const [ports, setPorts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [progressLog, setProgressLog] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState(0);

  useEffect(() => {
    if (open) {
      detectSerialPorts();
    }
  }, [open]);

  // if board changes and current method becomes unsupported, fall back to serial
  useEffect(() => {
    const board = arduinoBoards[config.boardId];
    if (config.uploadMethod === 'wifi' && !board?.wifi) {
      setConfig(prev => ({ ...prev, uploadMethod: 'serial' }));
    }
    if (config.uploadMethod === 'bluetooth' && !board?.bluetooth) {
      setConfig(prev => ({ ...prev, uploadMethod: 'serial' }));
    }
  }, [config.boardId]);

  const detectSerialPorts = async () => {
    try {
      const nav = navigator as unknown as { serial?: { getPorts(): Promise<Array<{ getInfo: () => { usbProductId?: number; usbVendorId?: number } }>>; requestPort(): Promise<{ getInfo: () => { usbProductId?: number; usbVendorId?: number } }> } };
      if (!nav.serial) {
        setError('Web Serial API not supported in this browser. Use Chrome or Edge.');
        return;
      }

      const availablePorts = await nav.serial.getPorts();
      if (availablePorts.length === 0) {
        setError('No previously authorized ports. Click "Select Port" to grant access.');
      } else {
        setPorts(availablePorts.map((port, index) => {
          const info = port.getInfo();
          return info.usbProductId ? `USB Device (${info.usbProductId.toString(16)})` : `Port ${index + 1}`;
        }));
        setError('');
      }
    } catch (err) {
      setError('Failed to detect serial ports');
    }
  };

  const requestSerialPort = async () => {
    try {
      const nav = navigator as unknown as { serial?: { requestPort(): Promise<{ getInfo: () => { usbProductId?: number; usbVendorId?: number } }>; getPorts(): Promise<Array<{ getInfo: () => { usbProductId?: number; usbVendorId?: number } }>> } };
      if (!nav.serial) {
        setError('Web Serial API not supported in this browser. Use Chrome or Edge.');
        return;
      }

      const port = await nav.serial.requestPort();
      const info = port.getInfo();
      const portName = info.usbProductId ? `USB Device (${info.usbProductId.toString(16)})` : 'Serial Port';

      // Refresh full list
      const allPorts = await nav.serial.getPorts();
      const portNames = allPorts.map((p, i) => {
        const pInfo = p.getInfo();
        return pInfo.usbProductId ? `USB Device (${pInfo.usbProductId.toString(16)})` : `Port ${i + 1}`;
      });
      setPorts(portNames);
      setConfig(prev => ({ ...prev, portName: portName }));
      setError('');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        // User cancelled the picker
        return;
      }
      setError('Failed to select port');
    }
  };

  const handleUpload = async () => {
    setLoading(true);
    setError('');
    setProgressLog([]);
    setProgressPercent(0);

    try {
      await onUpload(config, (message, percent) => {
        setProgressLog(prev => [...prev, message]);
        if (percent !== undefined) setProgressPercent(percent);
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle>Upload to Arduino Board</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="board">Board Type</Label>
            <Select
              value={config.boardId}
              onValueChange={(value) => setConfig({ ...config, boardId: value })}
            >
              <SelectTrigger id="board">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(arduinoBoards).map(([id, board]) => (
                  <SelectItem key={id} value={id}>
                    {board.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="method">Upload Method</Label>
            <Select
              value={config.uploadMethod}
              onValueChange={(value) =>
                setConfig({ ...config, uploadMethod: value as UploadConfig['uploadMethod'] })
              }
            >
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="serial">USB Serial</SelectItem>
                <SelectItem value="wifi" disabled={!arduinoBoards[config.boardId]?.wifi}>
                  WiFi (OTA){!arduinoBoards[config.boardId]?.wifi && ' — unsupported'}
                </SelectItem>
                <SelectItem value="bluetooth" disabled={!arduinoBoards[config.boardId]?.bluetooth}>
                  Bluetooth{!arduinoBoards[config.boardId]?.bluetooth && ' — unsupported'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.uploadMethod === 'serial' && (
            <>
              <div>
                <Label htmlFor="port">Serial Port</Label>
                <div className="flex gap-2">
                  <Select
                    value={config.portName}
                    onValueChange={(value) => setConfig({ ...config, portName: value })}
                  >
                    <SelectTrigger id="port" className="flex-1">
                      <SelectValue placeholder="No port selected" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.length > 0 ? (
                        ports.map((port) => (
                          <SelectItem key={port} value={port}>
                            {port}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No ports detected
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="secondary" size="sm" onClick={requestSerialPort} className="shrink-0">
                    Select Port
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Click "Select Port" to grant browser access to your USB device.</p>
              </div>

              <div>
                <Label htmlFor="baudrate">Baud Rate</Label>
                <Select
                  value={String(config.baudRate)}
                  onValueChange={(value) => setConfig({ ...config, baudRate: parseInt(value) })}
                >
                  <SelectTrigger id="baudrate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9600">9600</SelectItem>
                    <SelectItem value="115200">115200</SelectItem>
                    <SelectItem value="230400">230400</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {config.uploadMethod === 'wifi' && (
            <div>
              <Label htmlFor="ipaddress">Board IP Address</Label>
              <Input
                id="ipaddress"
                placeholder="192.168.1.100"
                value={config.portName}
                onChange={(e) => setConfig({ ...config, portName: e.target.value })}
              />
            </div>
          )}
          {(config.uploadMethod === 'wifi' && !arduinoBoards[config.boardId]?.wifi) && (
            <div className="text-sm text-red-500">Selected board does not support WiFi uploads.</div>
          )}
          {(config.uploadMethod === 'bluetooth' && !arduinoBoards[config.boardId]?.bluetooth) && (
            <div className="text-sm text-red-500">Selected board does not support Bluetooth uploads.</div>
          )}

          {error && (
            <div className="text-sm text-destructive whitespace-pre-wrap max-h-32 overflow-auto bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}

          {loading && progressLog.length > 0 && (
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-2" />
              <div className="text-xs text-muted-foreground max-h-24 overflow-auto space-y-0.5">
                {progressLog.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground flex items-start gap-1.5 bg-muted/50 p-2 rounded">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Browser flashing supports basic Arduino functions only (digital/analog I/O, Serial, delay). For complex libraries, use Arduino IDE.</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...
              </>
            ) : (
              'Upload Sketch'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
