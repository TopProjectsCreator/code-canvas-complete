import { useState } from 'react';
import { 
  RefreshCw, 
  ExternalLink, 
  Smartphone, 
  Monitor, 
  Tablet,
  X,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreviewProps {
  htmlContent: string;
  cssContent: string;
  jsContent: string;
  isRunning: boolean;
}

type DeviceType = 'desktop' | 'tablet' | 'mobile';

export const Preview = ({ htmlContent, cssContent, jsContent, isRunning }: PreviewProps) => {
  const [device, setDevice] = useState<DeviceType>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [key, setKey] = useState(0);

  const getDeviceWidth = () => {
    switch (device) {
      case 'mobile':
        return 'max-w-[375px]';
      case 'tablet':
        return 'max-w-[768px]';
      default:
        return 'w-full';
    }
  };

  const createPreviewDocument = () => {
    // Inject CSS and JS into the HTML
    let processedHtml = htmlContent;
    
    // Add CSS
    if (cssContent) {
      const styleTag = `<style>${cssContent}</style>`;
      if (processedHtml.includes('</head>')) {
        processedHtml = processedHtml.replace('</head>', `${styleTag}</head>`);
      } else {
        processedHtml = styleTag + processedHtml;
      }
    }
    
    // Add JS
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
    setKey((prev) => prev + 1);
  };

  const devices = [
    { id: 'desktop' as const, icon: Monitor, label: 'Desktop' },
    { id: 'tablet' as const, icon: Tablet, label: 'Tablet' },
    { id: 'mobile' as const, icon: Smartphone, label: 'Mobile' },
  ];

  return (
    <div className={cn(
      'flex flex-col bg-background h-full',
      isFullscreen && 'fixed inset-0 z-50'
    )}>
      {/* Toolbar - Replit style */}
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
                  device === id
                    ? 'text-foreground bg-accent'
                    : 'text-muted-foreground hover:text-foreground'
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

      {/* URL bar - Replit style */}
      <div className="px-2 py-1.5 border-b border-border bg-card">
        <div className="flex items-center gap-2 px-2.5 py-1 bg-background rounded-md text-xs">
          <span className="text-success">●</span>
          <span className="text-muted-foreground flex-1 truncate font-mono">
            https://my-repl.replit.app
          </span>
        </div>
      </div>

      {/* Preview frame */}
      <div className="flex-1 flex items-start justify-center p-3 bg-muted/30 overflow-auto">
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
    </div>
  );
};
