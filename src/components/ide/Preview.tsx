import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  RefreshCw, 
  ExternalLink, 
  Smartphone, 
  Monitor, 
  Tablet,
  Maximize2,
  Minimize2,
  Bug,
  X,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreviewProps {
  htmlContent: string;
  cssContent: string;
  jsContent: string;
  isRunning: boolean;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';
type DevToolsTab = 'console' | 'elements' | 'network' | 'storage';

interface ConsoleEntry {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

interface NetworkEntry {
  id: string;
  method: string;
  url: string;
  status: number | null;
  time: number;
  timestamp: Date;
}

export const Preview = ({ htmlContent, cssContent, jsContent, isRunning }: PreviewProps) => {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);
  const [showDevTools, setShowDevTools] = useState(false);
  const [devToolsTab, setDevToolsTab] = useState<DevToolsTab>('console');
  const [consoleLogs, setConsoleLogs] = useState<ConsoleEntry[]>([]);
  const [networkLogs, setNetworkLogs] = useState<NetworkEntry[]>([]);
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'log' | 'warn' | 'error'>('all');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'console') {
        setConsoleLogs(prev => [...prev, {
          id: Math.random().toString(36).slice(2),
          type: e.data.level || 'log',
          message: e.data.message,
          timestamp: new Date(),
        }]);
      }
      if (e.data?.type === 'network') {
        setNetworkLogs(prev => [...prev, {
          id: Math.random().toString(36).slice(2),
          method: e.data.method,
          url: e.data.url,
          status: e.data.status,
          time: e.data.time || 0,
          timestamp: new Date(),
        }]);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const getDeviceWidth = () => {
    switch (device) {
      case 'mobile': return 'max-w-[375px]';
      case 'tablet': return 'max-w-[768px]';
      default: return 'w-full';
    }
  };

  const createPreviewDocument = () => {
    let processedHtml = htmlContent;
    
    // Inject console interceptor script
    const interceptor = `<script>
(function(){
  const origLog = console.log, origWarn = console.warn, origError = console.error, origInfo = console.info;
  function send(level, args) {
    try {
      parent.postMessage({ type: 'console', level, message: Array.from(args).map(a => {
        try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); } catch(e) { return String(a); }
      }).join(' ') }, '*');
    } catch(e) {}
  }
  console.log = function(){ send('log', arguments); origLog.apply(console, arguments); };
  console.warn = function(){ send('warn', arguments); origWarn.apply(console, arguments); };
  console.error = function(){ send('error', arguments); origError.apply(console, arguments); };
  console.info = function(){ send('info', arguments); origInfo.apply(console, arguments); };
  window.onerror = function(msg, src, line, col, err) {
    send('error', [msg + (src ? ' at ' + src + ':' + line + ':' + col : '')]);
  };
  window.onunhandledrejection = function(e) {
    send('error', ['Unhandled Promise: ' + (e.reason?.message || e.reason || 'unknown')]);
  };
})();
</script>`;

    if (cssContent) {
      const styleTag = `<style>${cssContent}</style>`;
      if (processedHtml.includes('</head>')) {
        processedHtml = processedHtml.replace('</head>', `${styleTag}</head>`);
      } else {
        processedHtml = styleTag + processedHtml;
      }
    }
    
    // Add interceptor before any user JS
    if (processedHtml.includes('<head>')) {
      processedHtml = processedHtml.replace('<head>', `<head>${interceptor}`);
    } else if (processedHtml.includes('<html>')) {
      processedHtml = processedHtml.replace('<html>', `<html><head>${interceptor}</head>`);
    } else {
      processedHtml = interceptor + processedHtml;
    }
    
    if (jsContent) {
      const scriptTag = `<script>${jsContent}</script>`;
      if (processedHtml.includes('</body>')) {
        processedHtml = processedHtml.replace('</body>', `${scriptTag}</body>`);
      } else {
        processedHtml = processedHtml + scriptTag;
      }
    }
    
    return processedHtml;
  };

  const handleRefresh = () => {
    setKey(prev => prev + 1);
    setConsoleLogs([]);
    setNetworkLogs([]);
  };

  const devices = [
    { id: 'desktop' as const, icon: Monitor, label: 'Desktop' },
    { id: 'tablet' as const, icon: Tablet, label: 'Tablet' },
    { id: 'mobile' as const, icon: Smartphone, label: 'Mobile' },
  ];

  const filteredLogs = consoleFilter === 'all' 
    ? consoleLogs 
    : consoleLogs.filter(l => l.type === consoleFilter);

  const errorCount = consoleLogs.filter(l => l.type === 'error').length;
  const warnCount = consoleLogs.filter(l => l.type === 'warn').length;

  const devToolsTabs: { id: DevToolsTab; label: string }[] = [
    { id: 'console', label: 'Console' },
    { id: 'elements', label: 'Elements' },
    { id: 'network', label: 'Network' },
    { id: 'storage', label: 'Storage' },
  ];

  return (
    <div className={cn(
      'flex flex-col bg-background h-full',
      isFullscreen && 'fixed inset-0 z-50'
    )}>
      {/* Toolbar */}
      <div className="flex items-center justify-between h-9 px-2 border-b border-border bg-card">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-foreground px-2">Webview</span>
          <div className="w-px h-4 bg-border mx-1" />
          <div className="flex items-center">
            {devices.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setDevice(id)}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  device === id ? 'text-foreground bg-accent' : 'text-muted-foreground hover:text-foreground'
                )}
                title={label}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setShowDevTools(!showDevTools)}
            className={cn(
              'p-1.5 rounded transition-colors relative',
              showDevTools ? 'text-foreground bg-accent' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
            title="DevTools"
          >
            <Bug className="w-3.5 h-3.5" />
            {errorCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-destructive text-destructive-foreground text-[8px] font-bold rounded-full flex items-center justify-center">
                {errorCount > 9 ? '9+' : errorCount}
              </span>
            )}
          </button>
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Open in new tab"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* URL bar */}
      <div className="px-2 py-1.5 border-b border-border bg-card">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-background rounded-md text-xs">
          <span className="text-success">●</span>
          <span className="text-muted-foreground flex-1 truncate font-mono">
            https://my-repl.replit.app
          </span>
        </div>
      </div>

      {/* Preview + DevTools */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Preview frame */}
        <div className={cn(
          'flex items-start justify-center p-3 bg-muted/30 overflow-auto',
          showDevTools ? 'flex-1 min-h-0' : 'flex-1'
        )}>
          {isRunning ? (
            <div className={cn(
              'bg-white rounded-md shadow-lg overflow-hidden transition-all h-full',
              getDeviceWidth()
            )}>
              <iframe
                key={key}
                srcDoc={createPreviewDocument()}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-modals"
                title="Preview"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                  <Monitor className="w-8 h-8 opacity-40" />
                </div>
                <p className="text-sm font-medium mb-1">No preview available</p>
                <p className="text-xs opacity-70">Click Run to start your Repl</p>
              </div>
            </div>
          )}
        </div>

        {/* DevTools Panel */}
        {showDevTools && (
          <div className="h-[240px] border-t border-border bg-card flex flex-col shrink-0">
            {/* DevTools tabs */}
            <div className="flex items-center border-b border-border px-1 h-8 shrink-0">
              {devToolsTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setDevToolsTab(tab.id)}
                  className={cn(
                    'px-3 py-1 text-xs transition-colors relative',
                    devToolsTab === tab.id
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                  {tab.id === 'console' && errorCount > 0 && (
                    <span className="ml-1 text-[10px] text-destructive font-medium">({errorCount})</span>
                  )}
                  {devToolsTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              ))}
              <div className="flex-1" />
              {devToolsTab === 'console' && (
                <button
                  onClick={() => setConsoleLogs([])}
                  className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                  title="Clear console"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => setShowDevTools(false)}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                title="Close DevTools"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            {/* Console tab */}
            {devToolsTab === 'console' && (
              <div className="flex flex-col flex-1 min-h-0">
                {/* Console filters */}
                <div className="flex items-center gap-1 px-2 py-1 border-b border-border shrink-0">
                  {(['all', 'log', 'warn', 'error'] as const).map(filter => (
                    <button
                      key={filter}
                      onClick={() => setConsoleFilter(filter)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                        consoleFilter === filter
                          ? 'bg-accent text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                      {filter === 'error' && errorCount > 0 && (
                        <span className="ml-0.5 text-destructive">({errorCount})</span>
                      )}
                      {filter === 'warn' && warnCount > 0 && (
                        <span className="ml-0.5 text-yellow-500">({warnCount})</span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="flex-1 overflow-auto ide-scrollbar font-mono text-xs">
                  {filteredLogs.length === 0 ? (
                    <p className="p-3 text-muted-foreground text-center text-[11px]">
                      {consoleLogs.length === 0 ? 'No console output yet. Run your code to see logs here.' : 'No matching logs.'}
                    </p>
                  ) : (
                    filteredLogs.map(log => (
                      <div
                        key={log.id}
                        className={cn(
                          'px-3 py-1 border-b border-border/50 flex items-start gap-2',
                          log.type === 'error' && 'bg-destructive/5 text-destructive',
                          log.type === 'warn' && 'bg-yellow-500/5 text-yellow-500',
                          log.type === 'info' && 'text-blue-400',
                          log.type === 'log' && 'text-foreground'
                        )}
                      >
                        <span className="text-[10px] text-muted-foreground shrink-0 pt-0.5 w-12">
                          {log.timestamp.toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="break-all whitespace-pre-wrap">{log.message}</span>
                      </div>
                    ))
                  )}
                  <div ref={consoleEndRef} />
                </div>
              </div>
            )}

            {/* Elements tab */}
            {devToolsTab === 'elements' && (
              <div className="flex-1 overflow-auto ide-scrollbar p-3">
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                  {isRunning ? (
                    htmlContent ? (
                      <code>{htmlContent.slice(0, 3000)}{htmlContent.length > 3000 ? '\n\n... (truncated)' : ''}</code>
                    ) : (
                      <span className="text-muted-foreground">No HTML content</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">Run your code to inspect elements</span>
                  )}
                </pre>
              </div>
            )}

            {/* Network tab */}
            {devToolsTab === 'network' && (
              <div className="flex-1 overflow-auto ide-scrollbar">
                {networkLogs.length === 0 ? (
                  <p className="p-3 text-muted-foreground text-center text-[11px]">
                    No network requests recorded. Network activity from the preview will appear here.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="px-2 py-1 font-medium">Method</th>
                        <th className="px-2 py-1 font-medium">URL</th>
                        <th className="px-2 py-1 font-medium">Status</th>
                        <th className="px-2 py-1 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {networkLogs.map(req => (
                        <tr key={req.id} className="border-b border-border/50 hover:bg-accent/30">
                          <td className="px-2 py-1 font-mono text-primary">{req.method}</td>
                          <td className="px-2 py-1 truncate max-w-[200px]">{req.url}</td>
                          <td className={cn(
                            'px-2 py-1',
                            req.status && req.status >= 400 ? 'text-destructive' : 'text-green-400'
                          )}>
                            {req.status || '—'}
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">{req.time}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Storage tab */}
            {devToolsTab === 'storage' && (
              <div className="flex-1 overflow-auto ide-scrollbar p-3">
                <p className="text-xs text-muted-foreground mb-3">
                  Storage is sandboxed per iframe session. Data shown here is from the preview context.
                </p>
                <div className="space-y-3">
                  <div>
                    <h5 className="text-xs font-medium text-foreground mb-1">Local Storage</h5>
                    <div className="bg-background rounded p-2 text-xs text-muted-foreground font-mono">
                      Sandboxed — not accessible from parent frame
                    </div>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-foreground mb-1">Session Storage</h5>
                    <div className="bg-background rounded p-2 text-xs text-muted-foreground font-mono">
                      Sandboxed — not accessible from parent frame
                    </div>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-foreground mb-1">Cookies</h5>
                    <div className="bg-background rounded p-2 text-xs text-muted-foreground font-mono">
                      Sandboxed — not accessible from parent frame
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
