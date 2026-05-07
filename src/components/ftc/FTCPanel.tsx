import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { FileNode } from '@/types/ide';
import {
  compileFTC,
  connectDevice,
  uploadToDevice,
  startLogcat,
  disconnectDevice,
  type BuildResult,
  type BuildStatus,
  type FTCFile,
} from '@/services/ftcUploadService';
import type { AdbDevice } from '@/lib/webusb-adb';
import { HardwareConfigEditor } from './HardwareConfigEditor';
import { isReplitLikePlatform } from '@/lib/platform';
import { detectDeploymentPlatform } from '@/lib/platform';
import { ftcTemplate } from '@/data/ftcTemplateFiles';
import {
  Hammer,
  Upload,
  Plug,
  PlugZap,
  FileCode,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  Package,
  ClipboardCheck,
  Bot,
  Camera,
} from 'lucide-react';

interface FTCPanelProps {
  files: FileNode[];
  onFileUpdate: (fileId: string, content: string) => void;
}

/** Recursively collect all .java/.kt files with their paths */
function collectSourceFiles(nodes: FileNode[], prefix = ''): FTCFile[] {
  const result: FTCFile[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'folder' && node.children) {
      result.push(...collectSourceFiles(node.children, path));
    } else if (
      node.type === 'file' &&
      (node.name.endsWith('.java') || node.name.endsWith('.kt'))
    ) {
      result.push({ path, content: node.content || '' });
    }
  }
  return result;
}

/** Collect OpModes with path-aware filtering for TeamCode and optional samples. */
function stripComments(content: string): string {
  return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function hasOpModeAnnotation(content: string): boolean {
  return /@\s*(TeleOp|Autonomous)\b/.test(stripComments(content));
}

/** Collect OpModes with path-aware filtering for TeamCode and optional samples. */
function collectOpModes(nodes: FileNode[], includeSamples: boolean, prefix = ''): string[] {
  const modes: string[] = [];
  for (const node of nodes) {
    const path = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'folder' && node.children) {
      modes.push(...collectOpModes(node.children, includeSamples, path));
      continue;
    }

    if (node.type !== 'file' || (!node.name.endsWith('.java') && !node.name.endsWith('.kt'))) continue;

    const normalizedPath = path.toLowerCase();
    const isTeamCodeSource = normalizedPath.includes('/teamcode/src/main/java/');
    if (!isTeamCodeSource) continue;

    const isSampleFile = normalizedPath.includes('/samples/');
    if (!includeSamples && isSampleFile) continue;

    const content = node.content || '';
    if (hasOpModeAnnotation(content)) {
      modes.push(path.replace(/\.(java|kt)$/i, '').split('/').pop() || node.name);
    }
  }
  return modes;
}

function countJavaKotlinFiles(nodes: FileNode[]): number {
  return collectSourceFiles(nodes).length;
}

function hasFtcTemplate(nodes: FileNode[]): boolean {
  return nodes.some((node) => {
    if (node.name === 'FtcRobotController') return true;
    if (node.type === 'folder' && node.children) return hasFtcTemplate(node.children);
    return false;
  });
}

function cloneFileNode(node: FileNode): FileNode {
  return {
    ...node,
    children: node.children ? node.children.map(cloneFileNode) : undefined,
  };
}

export function FTCPanel({ files, onFileUpdate }: FTCPanelProps) {
  const { toast } = useToast();
  const isReplit = isReplitLikePlatform();
  const [buildStatus, setBuildStatus] = useState<BuildStatus>('idle');
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [buildProgress, setBuildProgress] = useState('');
  const [buildPercent, setBuildPercent] = useState(0);

  const [device, setDevice] = useState<AdbDevice | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<string>('');

  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const [includeSamples, setIncludeSamples] = useState(false);
  const [seededTemplate, setSeededTemplate] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const [buildPhase, setBuildPhase] = useState('idle');
  const isMountedRef = useRef(true);

  const opModes = collectOpModes(files, includeSamples);
  const sourceFileCount = countJavaKotlinFiles(files);

  const ensureFtcTemplate = useCallback(() => {
    if (!isReplit || seededTemplate || hasFtcTemplate(files)) return;
    const root = ftcTemplate[0];
    if (!root) return;
    onFileUpdate('root', JSON.stringify(cloneFileNode(root).children ?? []));
    setSeededTemplate(true);
    toast({
      title: 'FTC template loaded',
      description: 'The FTC project structure was added locally for Replit.',
    });
  }, [files, isReplit, onFileUpdate, seededTemplate, toast]);

  useEffect(() => {
    ensureFtcTemplate();
  }, [ensureFtcTemplate]);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  useEffect(() => {
    if (autoScrollLogs && logRef.current) {
      logRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [logLines, autoScrollLogs]);

  const handleBuild = useCallback(async () => {
    if (isBuilding) return;
    setIsBuilding(true);
    setBuildStatus('compiling');
    setBuildResult(null);
    setBuildPercent(10);
    setBuildPhase('Collecting source files');
    setBuildProgress('Collecting source files...');

    const sourceFiles = collectSourceFiles(files);
    if (sourceFiles.length === 0) {
      if (isReplit) {
        toast({
          title: 'No FTC sources yet',
          description: 'The FTC template should be added first on Replit.',
        });
      }
      setBuildStatus('error');
      setBuildResult({ status: 'error', message: 'No .java or .kt files found in the project.' });
      return;
    }

    try {
      setBuildPercent(35);
      setBuildPhase('Submitting cloud compile request');
      const result = await compileFTC(sourceFiles, (msg) => {
        if (!isMountedRef.current) return;
        setBuildProgress(msg);
        setBuildPhase('Compiler running');
        setBuildPercent(70);
      });
      if (!isMountedRef.current) return;
      setBuildPhase('Processing results');
      setBuildResult(result);
      setBuildStatus(result.status === 'success' ? 'success' : 'error');
      setBuildPercent(result.status === 'success' ? 100 : 0);
      setBuildPhase('idle');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setBuildStatus('error');
      setBuildProgress(`Build failed: ${message}`);
      setBuildPercent(0);
      setBuildPhase('idle');
      toast({ title: 'Build failed', description: message, variant: 'destructive' });
    } finally {
      if (isMountedRef.current) setIsBuilding(false);
    }
  }, [files, isBuilding, isReplit, toast]);

  const handleConnect = useCallback(async () => {
    try {
      setDeviceStatus('Connecting...');
      const dev = await connectDevice((msg) => setDeviceStatus(msg));
      if (!isMountedRef.current) return;
      setDevice(dev);
      setDeviceStatus('Connected');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setDeviceStatus(`Connection failed: ${message}`);
      toast({ title: 'Device connection failed', description: message, variant: 'destructive' });
    }
  }, [toast]);

  const handleDisconnect = useCallback(async () => {
    if (device) {
      await disconnectDevice(device);
      setDevice(null);
      setDeviceStatus('Disconnected');
    }
  }, [device]);

  const handleUpload = useCallback(async () => {
    if (!device || !buildResult?.apkBase64 || isUploading) return;
    setBuildProgress('');
    setBuildPercent(0);
    setIsUploading(true);

    try {
      await uploadToDevice(device, buildResult.apkBase64, (msg, pct) => {
        if (!isMountedRef.current) return;
        setBuildProgress(msg);
        if (pct !== undefined) setBuildPercent(pct);
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setBuildProgress(`Upload failed: ${message}`);
      toast({ title: 'Upload failed', description: message, variant: 'destructive' });
    } finally {
      if (isMountedRef.current) setIsUploading(false);
    }
  }, [device, buildResult, isUploading, toast]);

  const handleLogcat = useCallback(async () => {
    if (!device || isLoadingLogs) return;
    setLogLines([]);
    setIsLoadingLogs(true);
    try {
      await startLogcat(device, (line) => {
        if (!isMountedRef.current) return;
        setLogLines((prev) => [...prev.slice(-500), line]);
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast({ title: 'Logcat failed', description: message, variant: 'destructive' });
    } finally {
      if (isMountedRef.current) setIsLoadingLogs(false);
    }
  }, [device, isLoadingLogs, toast]);

  const statusIcon = buildStatus === 'compiling' ? (
    <Loader2 className="w-4 h-4 animate-spin" />
  ) : buildStatus === 'success' ? (
    <CheckCircle2 className="w-4 h-4 text-green-400" />
  ) : buildStatus === 'error' ? (
    <AlertCircle className="w-4 h-4 text-red-400" />
  ) : null;

  const handleExportConfig = useCallback((xmlContent: string, javaContent: string) => {
    navigator.clipboard.writeText(`--- Java Mapping ---\n${javaContent}\n\n--- Hardware XML ---\n${xmlContent}`);
    toast({
      title: 'Hardware exports copied',
      description: 'Copied Java mapping and XML config to clipboard.',
    });
  }, [toast]);

  return (
    <div className="space-y-4 p-4 bg-slate-950 h-full overflow-auto">
      <Card className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-foreground">FTC Control Center</h2>
            <p className="text-xs text-muted-foreground">
              Build, deploy, and debug your OpModes from one panel.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{sourceFileCount} source file{sourceFileCount === 1 ? '' : 's'}</Badge>
            <Badge variant="secondary">{opModes.length} OpMode{opModes.length === 1 ? '' : 's'}</Badge>
            <Badge variant={device ? 'default' : 'outline'}>
              {device ? 'Device connected' : 'No device'}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={handleBuild}
          disabled={buildStatus === 'compiling' || isBuilding}
          className="bg-orange-600 hover:bg-orange-700"
        >
          {buildStatus === 'compiling' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Hammer className="w-4 h-4 mr-2" />
          )}
          {isBuilding ? 'Building…' : 'Build'}
        </Button>

        <Button
          onClick={handleUpload}
          disabled={!device || !buildResult?.apkBase64 || isUploading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Upload className="w-4 h-4 mr-2" /> {isUploading ? 'Uploading…' : 'Upload to Robot'}
        </Button>

        {!device ? (
          <Button onClick={handleConnect} variant="outline">
            <Plug className="w-4 h-4 mr-2" /> Connect Device
          </Button>
        ) : (
          <Button onClick={handleDisconnect} variant="outline">
            <PlugZap className="w-4 h-4 mr-2 text-green-400" /> Disconnect
          </Button>
        )}

        <Button
          variant="outline"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('open-parts-inventory', { detail: { platform: 'ftc' } }),
            )
          }
        >
          <Package className="w-4 h-4 mr-2" /> Parts
        </Button>

        <Button
          variant="outline"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('open-parts-inventory', {
                detail: { platform: 'ftc', initialTab: 'add', identifyWithImage: true },
              }),
            )
          }
        >
          <Camera className="w-4 h-4 mr-2" /> Identify Part (Image)
        </Button>
      </div>

      {/* Status */}
      {(buildProgress || deviceStatus) && (
        <Card className="p-3 bg-slate-900 border-slate-700 space-y-2">
          {buildProgress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {statusIcon}
              <span>{buildProgress}</span>
              {buildPhase !== 'idle' && (
                <Badge variant="outline" className="ml-2 text-[10px]">{buildPhase}</Badge>
              )}
            </div>
          )}
          {buildPercent > 0 && buildPercent < 100 && (
            <Progress value={buildPercent} className="h-2" />
          )}
          {deviceStatus && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Plug className="w-3 h-3" />
              <span>{deviceStatus}</span>
            </div>
          )}
        </Card>
      )}

      <Tabs defaultValue="opmodes" className="w-full">
        <TabsList className="bg-slate-900 border-b border-slate-700">
          <TabsTrigger value="opmodes">OpModes</TabsTrigger>
          <TabsTrigger value="hardware">Hardware</TabsTrigger>
          <TabsTrigger value="build">Build Output</TabsTrigger>
          <TabsTrigger value="logcat">Logcat</TabsTrigger>
        </TabsList>

        {/* OpModes Tab */}
        <TabsContent value="opmodes" className="space-y-2">
          <Card className="p-4 bg-slate-900 border-slate-700">
            <h3 className="text-sm font-medium mb-2 text-foreground flex items-center gap-2">
              <Bot className="w-4 h-4 text-orange-400" />
              Build checklist
            </h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>• Confirm each OpMode has <code>@TeleOp</code> or <code>@Autonomous</code>.</li>
              <li>• Generate hardware mapping from the Hardware tab before upload.</li>
              <li>• Connect your Control Hub/Driver Hub with WebUSB, then build and upload.</li>
            </ul>
          </Card>

          <Card className="p-4 bg-slate-900 border-slate-700">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">Detected OpModes</h3>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={includeSamples}
                  onCheckedChange={(checked) => setIncludeSamples(checked === true)}
                />
                Include samples
              </label>
            </div>
            {opModes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No OpModes detected. Add <code>@TeleOp</code> or <code>@Autonomous</code>{' '}
                annotations to Java files in <code>TeamCode/src/main/java</code>.
              </p>
            ) : (
              <div className="space-y-1">
                {opModes.map((name) => (
                  <div
                    key={name}
                    className="flex items-center gap-2 px-3 py-2 rounded bg-slate-800 border border-slate-700"
                  >
                    <FileCode className="w-4 h-4 text-orange-400" />
                    <span className="text-sm text-foreground">{name}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      OpMode
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Hardware Config Tab */}
        <TabsContent value="hardware" className="space-y-2">
          <HardwareConfigEditor onExportConfig={handleExportConfig} />
        </TabsContent>

        {/* Build Output Tab */}
        <TabsContent value="build" className="space-y-2">
          <Card className="p-4 bg-slate-900 border-slate-700">
            {!buildResult ? (
              <p className="text-sm text-muted-foreground">
                Click Build to compile your FTC project.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {buildResult.status === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  )}
                  <span className="font-medium text-foreground">{buildResult.message}</span>
                </div>

                {buildResult.warnings && buildResult.warnings.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-yellow-400">Warnings:</span>
                    <ScrollArea className="max-h-32 rounded border border-yellow-500/30 bg-yellow-950/20 p-2">
                      <div className="space-y-1">
                        {buildResult.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-yellow-300 font-mono">
                            {w}
                          </p>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {buildResult.errors && buildResult.errors.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-xs font-medium text-red-400">Errors:</span>
                    <ScrollArea className="max-h-40 rounded border border-red-500/30 bg-red-950/20 p-2">
                      <div className="space-y-1">
                        {buildResult.errors.map((e, i) => (
                          <p key={i} className="text-xs text-red-300 font-mono">
                            {e}
                          </p>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Logcat Tab */}
        <TabsContent value="logcat" className="space-y-2">
          <div className="flex flex-wrap gap-2 mb-2">
            <Button
              onClick={handleLogcat}
              disabled={!device || isLoadingLogs}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> {isLoadingLogs ? 'Loading…' : 'Refresh Logs'}
            </Button>
            <Button
              onClick={() => setLogLines([])}
              variant="ghost"
              size="sm"
            >
              <Trash2 className="w-3 h-3 mr-1" /> Clear
            </Button>
            <Button
              onClick={() => navigator.clipboard.writeText(logLines.join('\n'))}
              variant="ghost"
              size="sm"
              disabled={logLines.length === 0}
            >
              <ClipboardCheck className="w-3 h-3 mr-1" /> Copy
            </Button>
            <select className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" value={logFilter} onChange={(e) => setLogFilter(e.target.value as 'all' | 'error' | 'warn' | 'info')}>
              <option value="all">All</option>
              <option value="error">Errors</option>
              <option value="warn">Warnings</option>
              <option value="info">Info</option>
            </select>
            <input className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs" placeholder="Search logs" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} />
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <Checkbox checked={autoScrollLogs} onCheckedChange={(v) => setAutoScrollLogs(v === true)} />
              Auto-scroll
            </label>
          </div>
          <Card className="bg-black border-slate-700 p-0">
            <ScrollArea className="h-[300px]">
              <div ref={logRef} className="p-3 font-mono text-xs space-y-0.5">
                {logLines.length === 0 ? (
                  <p className="text-muted-foreground">
                    {device
                      ? 'Click Refresh Logs to fetch logcat output.'
                      : 'Connect a device to view logs.'}
                  </p>
                ) : (
                  logLines.filter((line) => {
                    const matchesSeverity = logFilter === 'all' || (logFilter === 'error' && (line.includes(' E ') || line.includes('Error'))) || (logFilter === 'warn' && line.includes(' W ')) || (logFilter === 'info' && line.includes(' I '));
                    const matchesSearch = line.toLowerCase().includes(logSearch.toLowerCase());
                    return matchesSeverity && matchesSearch;
                  }).map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.includes(' E ') || line.includes('Error')
                          ? 'text-red-400'
                          : line.includes(' W ')
                            ? 'text-yellow-400'
                            : line.includes(' I ')
                              ? 'text-green-300'
                              : 'text-gray-300'
                      }
                    >
                      {line}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
